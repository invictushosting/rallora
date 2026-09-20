import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_KINDS = ["news", "result", "roundup", "fixture", "announcement"];
const CLUB_ROLES = ["owner", "admin", "organiser"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function reply(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  } });
}

function disabled() {
  return process.env.RALLORA_SOCIAL_DB_ENABLED !== "true";
}

type Payload = Record<string, unknown>;
function obj(value: unknown): Payload {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Payload : {};
}

function validPost(input: Payload, requireKind: boolean) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const kind = input.kind;
  const fixture = input.source_fixture_id;
  if (!title || title.length > 140 || !body || body.length > 3500) return null;
  if (requireKind && !ALLOWED_KINDS.includes(String(kind))) return null;
  if (fixture != null && (typeof fixture !== "string" || !UUID.test(fixture))) return null;
  return {
    title, body,
    ...(requireKind ? { kind } : {}),
    ...(fixture != null ? { source_fixture_id: fixture } : {}),
  };
}

async function context(slug: string) {
  if (!SLUG.test(slug)) return { status: 400 as const };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 503 as const };
  const jar = await cookies();
  // Only the user-scoped anon client. Never import the service role here.
  const db = createServerClient(url, key, {
    cookies: {
      getAll() { return jar.getAll(); },
      setAll(next) {
        for (const cookie of next) {
          try { jar.set(cookie.name, cookie.value, cookie.options); }
          catch { /* read-only response context; current request is still verified */ }
        }
      },
    },
  });
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return { status: 401 as const };
  const { data: club, error: clubError } = await db.from("clubs")
    .select("id,slug").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (clubError) return { status: 503 as const };
  if (!club) return { status: 404 as const };
  const [membership, operator] = await Promise.all([
    db.from("rallora_club_memberships").select("user_id,club_id,role,status")
      .eq("user_id", user.id).eq("club_id", club.id).eq("status", "active")
      .maybeSingle(),
    db.from("rallora_platform_admins").select("user_id")
      .eq("user_id", user.id).maybeSingle(),
  ]);
  if (membership.error || operator.error) return { status: 503 as const };
  const allowed = operator.data?.user_id === user.id ||
    (membership.data?.user_id === user.id &&
      membership.data.club_id === club.id &&
      membership.data.status === "active" &&
      CLUB_ROLES.includes(membership.data.role));
  if (!allowed) return { status: 403 as const };
  return { status: 200 as const, db, club, user };
}

// POST/PATCH/DELETE remain disabled until the staged SQL has passed a full
// isolated Supabase Auth/Storage test and a real restore has been verified.
// The RLS policy itself permits ONLY draft writes, never publishing.
export async function GET(request: NextRequest) {
  if (disabled()) return reply({ error: "Social cloud drafts are not enabled." }, 503);
  const slug = request.nextUrl.searchParams.get("club") || "";
  const ctx = await context(slug);
  if (ctx.status !== 200) return reply({ error: "Club draft access unavailable." }, ctx.status);
  const { data, error } = await ctx.db.from("rallora_social_posts")
    .select("id,kind,title,body,source_fixture_id,status,created_at,updated_at,created_by")
    .eq("club_id",ctx.club.id)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return reply({ error: "Could not load club drafts." }, 503);
  return reply({ posts: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (disabled()) return reply({ error: "Social cloud drafts are not enabled." }, 503);
  const input = obj(await request.json().catch(() => null));
  const slug = typeof input.club === "string" ? input.club : "";
  const post = validPost(input, true);
  if (!post) return reply({ error: "Enter a valid title, body, post type and optional fixture ID." }, 400);
  const ctx = await context(slug);
  if (ctx.status !== 200) return reply({ error: "Club draft access unavailable." }, ctx.status);
  const { count, error: countError } = await ctx.db.from("rallora_social_posts")
    .select("id",{count:"exact",head:true}).eq("club_id",ctx.club.id).eq("status","draft");
  if (countError) return reply({ error: "Could not check draft limits." }, 503);
  if ((count ?? 0) >= 50) return reply({ error: "This club has 50 drafts. Archive or remove an old draft first." }, 429);
  const { data, error } = await ctx.db.from("rallora_social_posts")
    .insert({ ...post, club_id:ctx.club.id, created_by:ctx.user.id,
      status:"draft", scheduled_for:null })
    .select("id,kind,title,body,source_fixture_id,status,created_at,updated_at")
    .single();
  if (error) return reply({ error: "Unable to create draft. Check club permissions and confirmed result." }, 403);
  return reply({ post:data },201);
}

export async function PATCH(request: NextRequest) {
  if (disabled()) return reply({ error: "Social cloud drafts are not enabled." }, 503);
  const input = obj(await request.json().catch(() => null));
  const slug = typeof input.club === "string" ? input.club : "";
  const id = typeof input.id === "string" ? input.id : "";
  const post = validPost(input, false);
  if (!UUID.test(id) || !post) return reply({ error: "Enter a valid draft ID, title and body." },400);
  const ctx = await context(slug);
  if (ctx.status !== 200) return reply({ error: "Club draft access unavailable." },ctx.status);
  const {data,error} = await ctx.db.from("rallora_social_posts")
    .update({ ...post, updated_at:new Date().toISOString() })
    .eq("id",id).eq("club_id",ctx.club.id).eq("status","draft")
    .select("id,kind,title,body,source_fixture_id,status,updated_at").maybeSingle();
  if (error || !data) return reply({error:"Draft unavailable or not editable by this user."},403);
  return reply({post:data});
}

export async function DELETE(request: NextRequest) {
  if (disabled()) return reply({ error: "Social cloud drafts are not enabled." }, 503);
  const input = obj(await request.json().catch(() => null));
  const slug = typeof input.club === "string" ? input.club : "";
  const id = typeof input.id === "string" ? input.id : "";
  if (!UUID.test(id)) return reply({error:"Invalid draft ID."},400);
  const ctx = await context(slug);
  if (ctx.status !== 200) return reply({ error: "Club draft access unavailable." },ctx.status);
  const {data,error} = await ctx.db.from("rallora_social_posts").delete()
    .eq("id",id).eq("club_id",ctx.club.id).eq("status","draft")
    .select("id").maybeSingle();
  if (error || !data) return reply({error:"Draft unavailable or not editable."},403);
  return reply({deleted:true});
}

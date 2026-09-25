import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const plans = new Set(["starter", "league", "pro"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Supabase function environment is incomplete." }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Authentication required." }, 401);

  const { data: platformAdmin, error: platformAdminError } = await adminClient
    .from("rallora_platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (platformAdminError) return json({ error: "Could not verify Platform Admin access." }, 503);
  if (!platformAdmin) return json({ error: "Platform Admin access is required." }, 403);

  const body = await req.json().catch(() => null) as null | Record<string, unknown>;
  const text = (key: string, max = 200) =>
    typeof body?.[key] === "string" ? String(body[key]).trim().slice(0, max) : "";

  const name = text("name", 120);
  const slug = text("slug", 120).toLowerCase();
  const ownerEmail = text("ownerEmail", 320).toLowerCase();
  const ownerPassword = typeof body?.ownerPassword === "string" ? String(body.ownerPassword) : "";
  const contactName = text("contactName", 120);
  const contactPhone = text("contactPhone", 40);
  const address1 = text("address1", 200);
  const town = text("town", 120);
  const postcode = text("postcode", 30);
  const country = text("country", 120) || "United Kingdom";
  const plan = text("plan", 20);

  if (
    name.length < 2 ||
    !slugPattern.test(slug) ||
    !/^\S+@\S+\.\S+$/.test(ownerEmail) ||
    !plans.has(plan) ||
    contactName.length < 2 ||
    contactPhone.length < 7 ||
    address1.length < 3 ||
    town.length < 2 ||
    postcode.length < 2
  ) return json({ error: "Check the club and owner details, then try again." }, 400);

  async function findUserByEmail(email: string) {
    for (let page = 1; page <= 20; page += 1) {
      const listed = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (listed.error) throw listed.error;
      const found = listed.data.users.find((item) => item.email?.toLowerCase() === email);
      if (found) return found;
      if (listed.data.users.length < 1000) return null;
    }
    throw new Error("User lookup exceeded the supported account range.");
  }

  let owner;
  try {
    owner = await findUserByEmail(ownerEmail);
  } catch {
    return json({ error: "Could not check the owner account." }, 503);
  }

  let createdUserId: string | null = null;

  if (!owner) {
    if (ownerPassword.length < 8) {
      return json({ error: "Enter a temporary password of at least 8 characters for this new owner." }, 400);
    }
    const created = await adminClient.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { name: contactName, phone: contactPhone, source: "platform_manual_club" },
    });
    if (created.error || !created.data.user) {
      return json({ error: created.error?.message || "Could not create the owner account." }, 400);
    }
    owner = created.data.user;
    createdUserId = owner.id;
  }

  const createdClub = await userClient.rpc("rallora_platform_create_club_with_details", {
    p_name: name,
    p_slug: slug,
    p_owner_email: ownerEmail,
    p_plan_code: plan,
    p_contact_name: contactName,
    p_contact_phone: contactPhone,
    p_address_line_1: address1,
    p_town: town,
    p_postcode: postcode,
    p_country: country,
  });

  if (createdClub.error) {
    if (createdUserId) await adminClient.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    return json({ error: createdClub.error.message }, 400);
  }

  return json({ ok: true, ownerCreated: Boolean(createdUserId), clubId: createdClub.data, ownerUserId: owner.id });
});

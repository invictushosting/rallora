import { clubSlugPattern, stripeAuthorisationUrl, stripeReply, stripeSandbox, stripeViewer } from "@/lib/leagues/stripe-connect";

export async function GET(request: Request) {
  const settings = stripeSandbox();
  if (!settings) return stripeReply({ available: false });
  const slug = new URL(request.url).searchParams.get("club") ?? "";
  if (!clubSlugPattern.test(slug)) return stripeReply({ available: false }, 400);
  const user = await stripeViewer(settings);
  if (!user) return stripeReply({ available: false }, 401);
  const { data, error } = await settings.db.rpc("rallora_stripe_account", {
    p_user: user.id, p_slug: slug, p_account: null, p_ready: null,
  });
  if (error) return stripeReply({ error: "Stripe account status is unavailable." }, 503);
  if (!data) return stripeReply({ available: false });
  return stripeReply({ available: true, connected: data.connected, ready: data.ready });
}

export async function POST(request: Request) {
  const settings = stripeSandbox();
  if (!settings) return stripeReply({ error: "The Stripe sandbox is unavailable." }, 503);
  if (request.headers.get("origin") !== settings.origin) return stripeReply({}, 403);
  const body = await request.json().catch(() => null);
  const slug = typeof body?.club === "string" ? body.club : "";
  if (!clubSlugPattern.test(slug)) return stripeReply({ error: "Choose a club." }, 400);
  const user = await stripeViewer(settings);
  if (!user) return stripeReply({ error: "Sign in to connect Stripe." }, 401);
  const { data, error } = await settings.db.rpc("rallora_stripe_oauth", {
    p_user: user.id, p_slug: slug, p_state: null,
  });
  if (error) return stripeReply({ error: "Could not start Stripe setup. Try again." }, 503);
  if (!data) return stripeReply({ error: "A club owner or admin must connect Stripe." }, 403);
  return stripeReply({ url: stripeAuthorisationUrl(settings, data) });
}

import { NextResponse } from "next/server";
import { clubSlugPattern, stripeAccountPattern, stripeReply, stripeSandbox, stripeViewer, uuidPattern } from "@/lib/leagues/stripe-connect";

export async function GET(request: Request) {
  const settings = stripeSandbox();
  if (!settings) return stripeReply({ error: "The Stripe sandbox is unavailable." }, 503);
  const params = new URL(request.url).searchParams;
  const state = params.get("state") ?? "";
  const user = await stripeViewer(settings);
  if (!user || !uuidPattern.test(state)) return stripeReply({ error: "Restart Stripe setup from club admin." }, 400);
  const consumed = await settings.db.rpc("rallora_stripe_oauth", {
    p_user: user.id, p_slug: null, p_state: state,
  });
  const slug = consumed.data as string;
  if (consumed.error || !slug || !clubSlugPattern.test(slug)) {
    return stripeReply({ error: "Stripe setup expired. Restart it from club admin." }, 409);
  }
  const redirect = (result: string) => NextResponse.redirect(
    new URL(`/clubs/${slug}/admin?stripe=${result}#methods-heading`, settings.origin), 303,
  );
  const code = params.get("code");
  if (params.get("error") || !code || code.length > 512) return redirect("cancelled");

  try {
    // Stripe can revoke a connection if the OAuth code is exchanged twice.
    const token = await settings.stripe.oauth.token({ grant_type: "authorization_code", code }, { maxNetworkRetries: 0 });
    if (token.livemode !== false || !token.stripe_user_id || !stripeAccountPattern.test(token.stripe_user_id)) {
      return redirect("error");
    }
    const account = await settings.stripe.accounts.retrieve(token.stripe_user_id);
    const connected = await settings.db.rpc("rallora_stripe_account", {
      p_user: user.id, p_slug: slug, p_account: account.id, p_ready: account.charges_enabled === true,
    });
    if (connected.error || !connected.data) return redirect("error");
    return redirect(connected.data.ready ? "connected" : "pending");
  } catch {
    return redirect("error");
  }
}

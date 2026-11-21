import type Stripe from "stripe";
import { checkoutSessionPattern, stripeReply, stripeReturnPath, stripeSandbox, stripeViewer, uuidPattern } from "@/lib/leagues/stripe-connect";

type Checkout = { attempt: string; account: string; session: string | null; amount: number };

function checkoutLink(session: Stripe.Checkout.Session) {
  return session.status === "open" && session.url?.startsWith("https://checkout.stripe.com/") ? session.url : null;
}

export async function POST(request: Request) {
  const settings = stripeSandbox();
  if (!settings) return stripeReply({ error: "Online payment is unavailable." }, 503);
  if (request.headers.get("origin") !== settings.origin) return stripeReply({}, 403);
  const user = await stripeViewer(settings);
  if (!user) return stripeReply({ error: "Sign in to pay your entry fee." }, 401);
  const body = await request.json().catch(() => null);
  const entry = typeof body?.entry === "string" ? body.entry : "";
  if (!uuidPattern.test(entry)) return stripeReply({ error: "Entry unavailable." }, 404);

  const { db, stripe, origin } = settings;
  const payerId = user.id;
  async function snapshot(attempt: string | null = null, session: string | null = null, expired = false) {
    const { data, error } = await db.rpc("rallora_stripe_checkout", {
      p_user: payerId, p_entry: entry, p_attempt: attempt, p_session: session, p_expired: expired,
    });
    if (error) throw error;
    return data as Checkout | null;
  }

  try {
    let checkout = await snapshot();
    if (!checkout) return stripeReply({ error: "This entry is no longer payable online. Check its payment status or contact the club." }, 409);
    if (checkout.session) {
      const previous = await stripe.checkout.sessions.retrieve(checkout.session, {}, { stripeAccount: checkout.account });
      const existingUrl = checkoutLink(previous);
      if (existingUrl) return stripeReply({ url: existingUrl });
      if (previous.status !== "expired") return stripeReply({ error: "Stripe is confirming this payment. Check your entry shortly." }, 409);
      checkout = await snapshot(checkout.attempt, previous.id, true);
      if (!checkout || checkout.session) return stripeReply({ error: "Checkout changed. Try again to continue." }, 409);
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allowed_payment_method_types: ["card"],
      adaptive_pricing: { enabled: false },
      line_items: [{ quantity: 1, price_data: {
        currency: "gbp", unit_amount: checkout.amount, product_data: { name: "Rallora league entry fee per pair" },
      } }],
      metadata: { rallora_attempt: checkout.attempt },
      payment_intent_data: { metadata: { rallora_attempt: checkout.attempt } },
      success_url: `${origin}/account?stripe=return&entry=${entry}#league-payments`,
      cancel_url: origin + stripeReturnPath,
    }, { stripeAccount: checkout.account, idempotencyKey: `rallora-entry-${checkout.attempt}` });
    if (!checkoutSessionPattern.test(session.id) || !await snapshot(checkout.attempt, session.id)) {
      return stripeReply({ error: "Checkout changed. Try again to continue." }, 409);
    }
    const url = checkoutLink(session);
    return url ? stripeReply({ url }) : stripeReply({ error: "Checkout is unavailable. Check your payment status." }, 409);
  } catch {
    return stripeReply({ error: "Could not open Stripe Checkout. Please try again." }, 503);
  }
}

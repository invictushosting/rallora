import type Stripe from "stripe";

export function stripePaidReceipt(session: Stripe.Checkout.Session, attempt: string, expectedCharge?: string) {
  const amount = session.amount_total;
  if (session.livemode || session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid"
      || session.currency !== "gbp" || session.metadata?.rallora_attempt !== attempt || amount === null || amount < 1) return null;
  const intent = session.payment_intent;
  if (!intent || typeof intent === "string" || intent.status !== "succeeded"
      || intent.currency !== "gbp" || intent.amount_received !== amount) return null;
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string" || !charge.paid || !charge.captured
      || charge.amount_captured !== amount || (expectedCharge && expectedCharge !== charge.id)) return null;
  return { charge, amount };
}

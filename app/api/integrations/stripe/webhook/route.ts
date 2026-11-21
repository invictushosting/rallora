import type Stripe from "stripe";
import { stripePaidReceipt } from "@/lib/leagues/stripe-receipt";
import { checkoutSessionPattern, stripeAccountPattern, stripeReply, stripeSandbox, uuidPattern, type StripeSandbox } from "@/lib/leagues/stripe-connect";

async function reconcile(settings: StripeSandbox, event: Stripe.Event, account: string) {
  const scope = { stripeAccount: account };
  let attempt: string | undefined;
  let eventSession: string | undefined;
  let eventCharge: string | undefined;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    attempt = session.metadata?.rallora_attempt;
    eventSession = session.id;
  } else if (event.type === "charge.refunded") {
    attempt = event.data.object.metadata.rallora_attempt;
    eventCharge = event.data.object.id;
  } else if (event.type === "refund.updated") {
    const charge = event.data.object.charge;
    const chargeId = typeof charge === "string" ? charge : charge?.id;
    if (!chargeId) return;
    const current = await settings.stripe.charges.retrieve(chargeId, {}, scope);
    attempt = current.metadata.rallora_attempt;
    eventCharge = current.id;
  } else {
    return;
  }

  if (!attempt || !uuidPattern.test(attempt)) return;
  const entry = await settings.db.rpc("rallora_stripe_session", { p_account: account, p_attempt: attempt });
  if (entry.error) throw entry.error;
  const sessionId = entry.data as string | null;
  if (!sessionId || !checkoutSessionPattern.test(sessionId) || (eventSession && eventSession !== sessionId)) return;

  const session = await settings.stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.latest_charge"],
  }, scope);
  const receipt = stripePaidReceipt(session, attempt, eventCharge);
  if (!receipt) return;
  const { charge, amount } = receipt;

  let refunded = 0;
  if (charge.amount_refunded > 0 || eventCharge) {
    for await (const refund of settings.stripe.refunds.list({ charge: charge.id, limit: 100 }, scope)) {
      if (refund.status === "succeeded" && refund.currency === "gbp") refunded += refund.amount;
    }
  }
  const updated = await settings.db.rpc("rallora_stripe_reconcile", {
    p_account: account, p_attempt: attempt, p_session: sessionId,
    p_amount: amount, p_refunded: refunded,
  });
  if (updated.error) throw updated.error;
}

export async function POST(request: Request) {
  const settings = stripeSandbox();
  if (!settings) return stripeReply({}, 503);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return stripeReply({}, 400);
  let event: Stripe.Event;
  try {
    event = settings.stripe.webhooks.constructEvent(await request.text(), signature, settings.webhookSecret);
  } catch {
    return stripeReply({}, 400);
  }
  const account = event.account;
  if (event.livemode || !account || !stripeAccountPattern.test(account)) return stripeReply({ received: true });
  try {
    if (event.type === "account.application.deauthorized" || event.type === "account.updated") {
      const retained = event.type === "account.updated";
      const ready = retained && (await settings.stripe.accounts.retrieve(account)).charges_enabled === true;
      const update = await settings.db.rpc("rallora_stripe_account_event", {
        p_account: account, p_authorised: retained, p_ready: ready,
      });
      if (update.error) throw update.error;
    } else {
      await reconcile(settings, event, account);
    }
    return stripeReply({ received: true });
  } catch {
    return stripeReply({ error: "Stripe event could not be processed. Retry delivery." }, 503);
  }
}

import assert from "node:assert/strict";
import { test } from "node:test";
import Stripe from "stripe";
import { stripePaidReceipt } from "../lib/leagues/stripe-receipt.ts";

function paidSession() {
  return {
    livemode: false, mode: "payment", status: "complete", payment_status: "paid",
    amount_total: 2000, currency: "gbp", metadata: { rallora_attempt: "expected-attempt" },
    payment_intent: {
      status: "succeeded", currency: "gbp", amount_received: 2000,
      latest_charge: { id: "ch_expected", paid: true, captured: true, amount_captured: 2000 },
    },
  };
}

test("Stripe confirmation must match the expected attempt, charge and settled GBP amount", () => {
  const session = paidSession();
  assert.deepEqual(stripePaidReceipt(session, "expected-attempt", "ch_expected"), {
    charge: session.payment_intent.latest_charge, amount: 2000,
  });
  assert.equal(stripePaidReceipt(session, "stale-attempt"), null);
  assert.equal(stripePaidReceipt(session, "expected-attempt", "ch_other"), null);
  session.payment_intent.latest_charge.amount_captured = 1900;
  assert.equal(stripePaidReceipt(session, "expected-attempt"), null);
});

test("A live, unpaid or uncaptured session does not confirm a sandbox payment", () => {
  for (const change of [{ livemode: true }, { status: "open" }, { payment_status: "unpaid" }, { currency: "usd" }]) {
    assert.equal(stripePaidReceipt({ ...paidSession(), ...change }, "expected-attempt"), null);
  }
  const session = paidSession();
  session.payment_intent.latest_charge.captured = false;
  assert.equal(stripePaidReceipt(session, "expected-attempt"), null);
});

test("Stripe webhook verifier checks the signature against the unmodified body", () => {
  const stripe = new Stripe("sk_test_placeholder");
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", livemode: false });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(stripe.webhooks.constructEvent(payload, signature, secret).id, "evt_test");
  assert.throws(() => stripe.webhooks.constructEvent(payload + " ", signature, secret), /signature/i);
});

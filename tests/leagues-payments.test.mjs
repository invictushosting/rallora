import test from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_METHODS, methodByKey, canShowRegistrationMethod,
  paymentStatusFromVerifiedEvents, assessRegistrationPayment,
} from "../lib/leagues/payments.ts";

const base = {
  clubId:"club-a",seasonId:"season-a",registrationId:"entry-1",
  method:"bank_transfer",currency:"GBP",
};
const capture = { ...base,id:"bank-001",type:"captured",amountPence:2500 };
const registration = {
  id:"entry-1",clubId:"club-a",seasonId:"season-a",
  currency:"GBP",feePence:2500,
};

test("club-managed collection is not falsely called an API checkout",()=>{
  assert.equal(PAYMENT_METHODS.length,7);
  for (const method of PAYMENT_METHODS) {
    assert.equal(method.group==="integrated",method.checkout);
    assert.ok(methodByKey(method.key));
  }
  assert.equal(methodByKey("crypto_now"),undefined);
});

test("unapproved provider or unpublished terms are never offered to entrants",()=>{
  const option = {
    key:"stripe_connect",readiness:"approved",clubEnabled:true,
    seasonEnabled:true,termsPublished:true,merchantReady:false,
  };
  assert.equal(canShowRegistrationMethod(option),false);
  assert.equal(canShowRegistrationMethod({...option,merchantReady:true}),true);
  assert.equal(canShowRegistrationMethod({...option,termsPublished:false,merchantReady:true}),false);
  assert.equal(canShowRegistrationMethod({...option,readiness:"awaiting_approval",merchantReady:true}),false);
  assert.equal(canShowRegistrationMethod({...option,key:"bank_transfer",merchantReady:false}),true);
  assert.equal(canShowRegistrationMethod({...option,key:"cash_at_club",seasonEnabled:false}),false);
});

test("registration alone never proves a paid entry",()=>{
  assert.equal(assessRegistrationPayment(registration,[]),"awaiting_payment");
  assert.equal(assessRegistrationPayment({...registration,feePence:0},[]),"not_required");
  assert.equal(assessRegistrationPayment(registration,[],true),"cancelled");
  assert.equal(assessRegistrationPayment(registration,[{...capture,amountPence:1000}]),
    "awaiting_reconciliation");
  assert.equal(assessRegistrationPayment(registration,[capture]),"paid");
});

test("duplicate identical provider notifications cannot count as double payment",()=>{
  assert.equal(assessRegistrationPayment(
    {...registration,feePence:5000},[capture,capture]),
    "awaiting_reconciliation");
  assert.throws(()=>assessRegistrationPayment(
    registration,[capture,{...capture,amountPence:2400}]),/Conflicting/);
});

test("refunds and disputes are never shown as paid",()=>{
  const partial = {...capture,id:"refund-1",type:"part_refunded",amountPence:500};
  const full = {...capture,id:"refund-1",type:"refunded",amountPence:2500};
  const dispute = {...capture,id:"dispute-1",type:"disputed",amountPence:2500};
  assert.equal(assessRegistrationPayment(registration,[capture,partial]),"partially_refunded");
  assert.equal(assessRegistrationPayment(registration,[capture,full]),"refunded");
  assert.equal(assessRegistrationPayment(registration,[capture,dispute]),"disputed");
  assert.equal(assessRegistrationPayment(registration,[
    capture,dispute,{...dispute,id:"reverse-1",type:"dispute_reversed"},
  ]),"paid");
});

test("cross-club, season and currency receipts cannot enter another club pot",()=>{
  for (const patch of [
    {clubId:"club-b"},{seasonId:"season-b"},
    {currency:"USD"},{registrationId:"entry-2"},
  ]) {
    assert.throws(()=>assessRegistrationPayment(registration,[{...capture,...patch}]),
      /different registration/);
  }
  assert.throws(()=>paymentStatusFromVerifiedEvents(2500,[
    {...capture,type:"refunded"},
  ]),/Inconsistent/);
  assert.throws(()=>paymentStatusFromVerifiedEvents(-1,[]),RangeError);
});

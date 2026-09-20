import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRIZE_ESTIMATE, estimatePrizeBudget, formatMinor,
} from "../lib/leagues/prize-budget.ts";

const plan = (overrides = {}) => ({
  ...DEFAULT_PRIZE_ESTIMATE,paidTeams:20,...overrides,
});

test("twenty £25 teams allocate an £400 prize pot and £100 club balance", () => {
  const result = estimatePrizeBudget(plan());
  assert.equal(result.chargeableEntries,20);
  assert.equal(result.grossPence,50000);
  assert.equal(result.prizePotPence,40000);
  assert.equal(result.clubBalancePence,10000);
  assert.deepEqual([result.winnerPence,result.runnerUpPence,result.thirdPlacePence],
    [24000,12000,4000]);
});

test("per-player entries and explicit per-transaction fees are calculated in minor units", () => {
  const result = estimatePrizeBudget(plan({
    entryUnit:"player",playersPerTeam:2,entryPence:1000,
    providerFeePence:100,platformFeePence:50,
  }));
  assert.equal(result.chargeableEntries,40);
  assert.equal(result.grossPence,40000);
  assert.equal(result.processingPence,4000);
  assert.equal(result.platformPence,2000);
  assert.equal(result.prizePotPence,27200);
  assert.equal(result.clubBalancePence,6800);
});

test("sponsor-funded free competition and guaranteed pot shortfall are explicit", () => {
  const funded = estimatePrizeBudget(plan({
    paidTeams:0,entryPence:0,potMode:"entry_percentage",sponsorPence:15000,
  }));
  assert.equal(funded.grossPence,0);
  assert.equal(funded.prizePotPence,15000);
  assert.equal(funded.organiserTopUpPence,0);
  const guaranteed = estimatePrizeBudget(plan({
    entryPence:2000,providerFeePence:100,potMode:"guaranteed",
    guaranteedPotPence:50000,sponsorPence:10000,
  }));
  assert.equal(guaranteed.netEntryPence,38000);
  assert.equal(guaranteed.organiserTopUpPence,2000);
  assert.equal(guaranteed.prizeFromEntriesPence,38000);
  assert.equal(guaranteed.prizePotPence,50000);
  assert.equal(guaranteed.clubBalancePence,0);
});

test("sponsor excess is not silently lost and all prize pence are allocated", () => {
  const result = estimatePrizeBudget(plan({
    paidTeams:0,entryPence:0,potMode:"guaranteed",
    guaranteedPotPence:10001,sponsorPence:15000,
    winnerPct:33,runnerUpPct:33,
  }));
  assert.equal(result.clubBalancePence,4999);
  assert.equal(result.winnerPence+result.runnerUpPence+result.thirdPlacePence,
    10001);
  assert.equal(result.organiserTopUpPence,0);
  const noPrize = estimatePrizeBudget(plan({
    paidTeams:0,entryPence:0,potMode:"no_prize",sponsorPence:2500,
  }));
  assert.equal(noPrize.prizePotPence,0);
  assert.equal(noPrize.clubBalancePence,2500);
});

test("reject invalid projected income, fees and prize shares", () => {
  for (const overrides of [
    {paidTeams:-1},{paidTeams:1.5},{paidTeams:10001},
    {entryPence:NaN},{entryPence:-1},{entryPence:100000001},
    {providerFeePence:3000,entryPence:1000},
    {winnerPct:80,runnerUpPct:40},
    {prizeSharePct:101},{currency:"BTC"},{potMode:"lottery"},
  ]) assert.throws(() => estimatePrizeBudget(plan(overrides)),RangeError);
});

test("currency display never changes the underlying pence", () => {
  assert.equal(formatMinor(2500,"GBP"),"£25.00");
  assert.equal(formatMinor(2500,"EUR"),"€25.00");
  assert.equal(formatMinor(0,"GBP"),"£0.00");
});

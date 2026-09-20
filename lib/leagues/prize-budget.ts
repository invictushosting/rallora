/**
 * Entry fee and prize budget planning only. Never a balance or a payout record.
 * GBP/EUR/USD use two minor units; do not silently add zero/three-decimal currencies.
 */
export type SupportedCurrency = "GBP" | "EUR" | "USD";
export type EntryUnit = "team" | "player";
export type PotMode = "no_prize" | "entry_percentage" | "guaranteed";
export type PrizeEstimateInput = {
  currency: SupportedCurrency;
  entryUnit: EntryUnit;
  paidTeams: number;
  playersPerTeam: number;
  entryPence: number;
  providerFeePence: number;
  platformFeePence: number;
  sponsorPence: number;
  potMode: PotMode;
  prizeSharePct: number;
  guaranteedPotPence: number;
  winnerPct: number;
  runnerUpPct: number;
};

export type PrizeEstimate = {
  chargeableEntries: number;
  grossPence: number;
  processingPence: number;
  platformPence: number;
  netEntryPence: number;
  sponsorPence: number;
  prizeFromEntriesPence: number;
  prizePotPence: number;
  clubBalancePence: number;
  organiserTopUpPence: number;
  winnerPence: number;
  runnerUpPence: number;
  thirdPlacePence: number;
};

export const DEFAULT_PRIZE_ESTIMATE: PrizeEstimateInput = {
  currency: "GBP",
  entryUnit: "team",
  paidTeams: 0,
  playersPerTeam: 2,
  entryPence: 2500,
  providerFeePence: 0,
  platformFeePence: 0,
  sponsorPence: 0,
  potMode: "entry_percentage",
  prizeSharePct: 80,
  guaranteedPotPence: 0,
  winnerPct: 60,
  runnerUpPct: 30,
};

function validMinor(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000) {
    throw new RangeError(`${name} must be a nonnegative integer amount in pence`);
  }
}
function validPct(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be a whole percent between 0 and 100`);
  }
}

export function estimatePrizeBudget(input: PrizeEstimateInput): PrizeEstimate {
  if (!["GBP", "EUR", "USD"].includes(input.currency)) throw new RangeError("Unsupported currency");
  if (!["team","player"].includes(input.entryUnit)) throw new RangeError("Invalid entry unit");
  if (!["no_prize","entry_percentage","guaranteed"].includes(input.potMode)) {
    throw new RangeError("Invalid prize mode");
  }
  if (!Number.isSafeInteger(input.paidTeams) || input.paidTeams < 0 || input.paidTeams > 10_000) {
    throw new RangeError("Expected paid teams must be between 0 and 10,000");
  }
  if (!Number.isSafeInteger(input.playersPerTeam) ||
      input.playersPerTeam < 1 || input.playersPerTeam > 8) {
    throw new RangeError("Players per team must be between 1 and 8");
  }
  for (const [key,value] of [
    ["Entry fee",input.entryPence], ["Provider fee",input.providerFeePence],
    ["Platform fee",input.platformFeePence], ["Sponsor contribution",input.sponsorPence],
    ["Guaranteed prize",input.guaranteedPotPence],
  ] as [string,number][]) validMinor(key,value);
  for (const [key,value] of [
    ["Prize allocation",input.prizeSharePct], ["Winner share",input.winnerPct],
    ["Runner-up share",input.runnerUpPct],
  ] as [string,number][]) validPct(key,value);
  if (input.winnerPct + input.runnerUpPct > 100) {
    throw new RangeError("Winner and runner-up percentages cannot exceed 100%");
  }
  const chargeableEntries = input.paidTeams *
    (input.entryUnit === "player" ? input.playersPerTeam : 1);
  const grossPence = chargeableEntries * input.entryPence;
  const processingPence = chargeableEntries * input.providerFeePence;
  const platformPence = chargeableEntries * input.platformFeePence;
  if (processingPence + platformPence > grossPence) {
    throw new RangeError("Combined estimated transaction fees exceed entry receipts");
  }
  const netEntryPence = grossPence - processingPence - platformPence;
  const prizeFromEntriesPence = input.potMode === "entry_percentage"
    ? Math.floor(netEntryPence * input.prizeSharePct / 100)
    : input.potMode === "guaranteed"
      ? Math.min(Math.max(0,input.guaranteedPotPence - input.sponsorPence), netEntryPence)
      : 0;
  const prizePotPence = input.potMode === "guaranteed"
    ? input.guaranteedPotPence
    : input.potMode === "entry_percentage"
      ? prizeFromEntriesPence + input.sponsorPence : 0;
  const clubBalancePence = input.potMode === "guaranteed"
    ? Math.max(0, netEntryPence + input.sponsorPence - prizePotPence)
    : input.potMode === "no_prize"
      ? netEntryPence + input.sponsorPence
      : netEntryPence - prizeFromEntriesPence;
  const organiserTopUpPence = input.potMode === "guaranteed"
    ? Math.max(0, prizePotPence - netEntryPence - input.sponsorPence) : 0;
  const winnerPence = Math.floor(prizePotPence * input.winnerPct / 100);
  const runnerUpPence = Math.floor(prizePotPence * input.runnerUpPct / 100);
  const thirdPlacePence = prizePotPence - winnerPence - runnerUpPence;
  return {
    chargeableEntries, grossPence, processingPence, platformPence,
    netEntryPence, sponsorPence:input.sponsorPence, prizeFromEntriesPence,
    prizePotPence, clubBalancePence, organiserTopUpPence,
    winnerPence, runnerUpPence, thirdPlacePence,
  };
}

export function formatMinor(pence: number, currency: SupportedCurrency): string {
  if (!Number.isSafeInteger(pence)) throw new RangeError("Invalid minor-unit amount");
  return new Intl.NumberFormat("en-GB", {
    style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2,
  }).format(pence / 100);
}

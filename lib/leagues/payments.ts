/** Provider-neutral collection options. This catalog is NOT merchant approval. */
export type PaymentMethodKey =
  | "bank_transfer" | "cash_at_club" | "stripe_connect"
  | "mollie_connect" | "paypal" | "revolut_business" | "adyen";

export type PaymentMethod = {
  key: PaymentMethodKey; label: string; group: "club_managed" | "integrated";
  description: string; checkout: boolean; requiresReview: boolean;
};

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  { key: "bank_transfer",label:"Club bank transfer",group:"club_managed",
    description:"Club supplies instructions separately and reconciles its own bank statement.",
    checkout:false,requiresReview:false },
  { key:"cash_at_club",label:"Pay at the club",group:"club_managed",
    description:"The club collects money itself and records a verified receipt.",
    checkout:false,requiresReview:false },
  { key:"stripe_connect",label:"Stripe Connect",group:"integrated",
    description:"Future connected card checkout, subject to explicit competition-model approval.",
    checkout:true,requiresReview:true },
  { key:"mollie_connect",label:"Mollie Connect",group:"integrated",
    description:"Future connected merchant checkout, subject to eligibility and approval.",
    checkout:true,requiresReview:true },
  { key:"paypal",label:"PayPal",group:"integrated",
    description:"Future club PayPal checkout only if paid-prize activity is explicitly approved.",
    checkout:true,requiresReview:true },
  { key:"revolut_business",label:"Revolut Business",group:"integrated",
    description:"Future business merchant integration after provider eligibility review.",
    checkout:true,requiresReview:true },
  { key:"adyen",label:"Adyen for Platforms",group:"integrated",
    description:"Future platform/merchant onboarding, subject to commercial approval.",
    checkout:true,requiresReview:true },
] as const;

export type MethodReadiness =
  | "not_configured" | "awaiting_approval" | "approved" | "disabled";

export type CollectionOption = {
  key: PaymentMethodKey; readiness: MethodReadiness;
  clubEnabled: boolean; seasonEnabled: boolean;
  termsPublished: boolean; merchantReady: boolean;
};

export function methodByKey(key: string): PaymentMethod | undefined {
  return PAYMENT_METHODS.find(item => item.key === key);
}

/**
 * Club-managed methods do not create an in-app payment, even if published.
 * Integrated methods require independently documented merchant readiness.
 */
export function canShowRegistrationMethod(option: CollectionOption): boolean {
  const method = methodByKey(option.key);
  if (!method || !option.clubEnabled || !option.seasonEnabled ||
      !option.termsPublished || option.readiness !== "approved") return false;
  return method.group === "club_managed" || option.merchantReady;
}

export type RegistrationPaymentStatus =
  | "not_required" | "awaiting_payment" | "awaiting_reconciliation"
  | "paid" | "partially_refunded" | "refunded" | "disputed" | "cancelled";

export type VerifiedEntryEvent = {
  id: string; registrationId: string; clubId: string; seasonId: string;
  method: PaymentMethodKey; type:
    "captured" | "part_refunded" | "refunded" | "disputed" | "dispute_reversed";
  amountPence: number; currency: "GBP" | "EUR" | "USD";
};

/** Caller supplies only already verified, club- and registration-scoped events. */
export function paymentStatusFromVerifiedEvents(
  feePence: number, events: readonly VerifiedEntryEvent[],
  cancelled = false,
): RegistrationPaymentStatus {
  if (!Number.isSafeInteger(feePence) || feePence < 0) {
    throw new RangeError("Invalid entry fee");
  }
  if (feePence === 0) return cancelled ? "cancelled" : "not_required";
  if (cancelled) return "cancelled";
  const seen = new Set<string>();
  let charged = 0;
  let refunded = 0;
  let disputed = 0;
  for (const event of events) {
    if (!event.id || seen.has(event.id)) continue;
    seen.add(event.id);
    if (!Number.isSafeInteger(event.amountPence) || event.amountPence <= 0) {
      throw new RangeError("Invalid verified event amount");
    }
    if (event.type === "captured") charged += event.amountPence;
    if (event.type === "refunded" || event.type === "part_refunded") {
      refunded += event.amountPence;
    }
    if (event.type === "disputed") disputed += event.amountPence;
    if (event.type === "dispute_reversed") disputed -= event.amountPence;
  }
  if (refunded > charged || disputed < 0 || disputed > charged - refunded) {
    throw new RangeError("Inconsistent receipt/refund/dispute history");
  }
  if (disputed > 0) return "disputed";
  if (charged > 0 && refunded === charged) return "refunded";
  if (charged > 0 && refunded > 0) return "partially_refunded";
  return charged - refunded >= feePence ? "paid" : "awaiting_reconciliation";
}

/**
 * No browser-side shortcut to "paid". All receipt types must first be
 * verified against the selected club, currency, entry and provider/reference.
 */
export function assessRegistrationPayment(
  registration: {
    id: string; clubId: string; seasonId: string;
    currency: "GBP" | "EUR" | "USD"; feePence: number;
  },
  recorded: readonly VerifiedEntryEvent[], cancelled = false,
): RegistrationPaymentStatus {
  for (const event of recorded) {
    if (event.registrationId !== registration.id ||
        event.clubId !== registration.clubId ||
        event.seasonId !== registration.seasonId ||
        event.currency !== registration.currency ||
        !methodByKey(event.method)) {
      throw new RangeError("Receipt belongs to a different registration, club, season or currency");
    }
  }
  return paymentStatusFromVerifiedEvents(registration.feePence,recorded,cancelled);
}

"use client";

import { useState } from "react";

export default function StripeEntryCheckout({ entry }: { entry: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function openCheckout() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/integrations/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      });
      const data = await response.json();
      if (response.ok && typeof data.url === "string" && data.url.startsWith("https://checkout.stripe.com/")) {
        window.location.assign(data.url);
        return;
      }
      setNotice(typeof data.error === "string" ? data.error : "Could not open Stripe Checkout.");
    } catch {
      setNotice("Could not open Stripe Checkout. Try again.");
    }
    setBusy(false);
  }

  return <div>
    <button type="button" disabled={busy} onClick={() => void openCheckout()}>
      {busy ? "Opening checkout…" : "Pay by test card"}
    </button>
    {notice && <p role="status">{notice}</p>}
  </div>;
}

export type SupportRequest = { clubId?: string; category: string; subject: string; message: string };

/** A lost response may have reached the server; never claim success without acknowledgement. */
export async function sendSupportRequest(request: SupportRequest): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch("/api/support", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request), signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => null) as { ok?: unknown; error?: unknown } | null;
    if (response.ok && body?.ok === true) return { ok: true, message: "Support request sent. Rallora has received it." };
    return { ok: false, message: typeof body?.error === "string" ? body.error : "We couldn’t confirm your request. Your message is still here; check your connection and try again." };
  } catch {
    return { ok: false, message: "We couldn’t confirm your request. Your message is still here; check your connection and try again." };
  }
}

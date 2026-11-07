export type SupportRequest = { clubId?: string; seasonId?: string; name?: string; page?: string; category: string; subject: string; message: string };

/** A lost response may have reached the server; never claim success without acknowledgement. */
export async function sendSupportRequest(request: SupportRequest, screenshot?: File | null): Promise<{ ok: boolean; message: string }> {
  try {
    let requestBody: string | FormData = JSON.stringify(request);
    if(screenshot){const form=new FormData();form.set("request",requestBody);form.set("screenshot",screenshot);requestBody=form;}
    const response = await fetch("/api/support", {
      method: "POST", headers: screenshot ? undefined : { "Content-Type": "application/json" },
      body:requestBody, signal: AbortSignal.timeout(45000),
    });
    const body = await response.json().catch(() => null) as { ok?: unknown; error?: unknown } | null;
    if (response.ok && body?.ok === true) return { ok: true, message: "Support request sent. Rallora has received it." };
    return { ok: false, message: typeof body?.error === "string" ? body.error : "We couldn’t confirm your request. Your message is still here; check your connection and try again." };
  } catch {
    return { ok: false, message: "We couldn’t confirm your request. Your message is still here; check your connection and try again." };
  }
}

const DEFAULT_FROM = "Rallora <support@rallora.app>";

export function escapeEmailHtml(value: unknown) {
  return String(value ?? "").replace(/[<>&"']/g, character => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
  }[character] ?? character));
}

export function isEmailAddress(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function cleanSenderName(value: string) {
  return value.replace(/[<>\r\n"]/g, "").trim().slice(0, 80) || "Rallora";
}

export type RalloraEmail = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  clubName?: string | null;
  replyTo?: string | null;
  from?: string;
  idempotencyKey?: string;
};

class EmailDeliveryError extends Error {
  retryable: boolean;
  retryAfterMs: number;
  constructor(message: string, retryable = false, retryAfterMs = 0) {
    super(message);
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export async function sendRalloraEmail(message: RalloraEmail): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailDeliveryError("Email delivery is not configured.");
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  if (!recipients.length || !recipients.every(isEmailAddress) || (message.replyTo && !isEmailAddress(message.replyTo))) {
    throw new EmailDeliveryError("Choose a valid email address.");
  }
  const from = message.from || (message.clubName
    ? `${cleanSenderName(message.clubName)} <support@rallora.app>` : DEFAULT_FROM);
  // Reuse one key and identical bytes across retries, including uncertain timeouts.
  const idempotencyKey = message.idempotencyKey || crypto.randomUUID();
  const body = JSON.stringify({ from, to: recipients, subject: message.subject, html: message.html,
    text: message.text, reply_to: message.replyTo || "support@rallora.app" });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body,
      });
      const data = await response.json().catch(() => null) as { id?: unknown } | null;
      if (response.ok && typeof data?.id === "string" && data.id) return { id: data.id };
      const retryAfter = response.headers.get("retry-after");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const retryAfterMs = retryAfter === null ? 0 : Number.isFinite(seconds)
        ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
      throw new EmailDeliveryError("Email could not be accepted for sending. Please try again later.",
        response.status === 429 || response.status >= 500 || response.ok, retryAfterMs);
    } catch (error) {
      const failure = error instanceof EmailDeliveryError ? error : new EmailDeliveryError("Email delivery timed out or could not connect. Please try again later.", true);
      if (!failure.retryable || attempt === 2 || failure.retryAfterMs > 5000) throw failure;
      await new Promise(resolve => setTimeout(resolve, Math.max(500 * 2 ** attempt, failure.retryAfterMs)));
    }
  }
  throw new EmailDeliveryError("Email could not be accepted for sending.");
}

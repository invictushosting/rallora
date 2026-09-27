const DEFAULT_FROM = "Rallora <support@rallora.app>";

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
};

export async function sendRalloraEmail(message: RalloraEmail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");

  const from = message.clubName
    ? `${cleanSenderName(message.clubName)} <support@rallora.app>`
    : DEFAULT_FROM;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: message.replyTo || "support@rallora.app",
    }),
  });

  const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!response.ok) throw new Error(data.message || data.name || "Email could not be sent.");
  return data;
}

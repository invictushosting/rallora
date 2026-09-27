import { Resend } from "resend";

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
  const resend = new Resend(key);
  const from = message.clubName ? `${cleanSenderName(message.clubName)} <support@rallora.app>` : DEFAULT_FROM;
  const { data, error } = await resend.emails.send({
    from, to: message.to, subject: message.subject, html: message.html,
    text: message.text, replyTo: message.replyTo || "support@rallora.app",
  });
  if (error) throw new Error(error.message);
  return data;
}

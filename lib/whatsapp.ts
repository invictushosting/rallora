import { createHmac, timingSafeEqual } from "node:crypto";

export type WhatsAppReminder = {
  id: string;
  to: string;
  title: string;
  body: string;
  actionUrl: string;
  clubName: string;
};

const phonePattern = /^\+[1-9][0-9]{7,14}$/;
const messageSidPattern = /^SM[0-9a-f]{32}$/i;

export function whatsappConfig() {
  const account = process.env.TWILIO_WHATSAPP_ACCOUNT_SID ?? "";
  const authToken = process.env.TWILIO_WHATSAPP_AUTH_TOKEN ?? "";
  const contentSid = process.env.TWILIO_WHATSAPP_REMINDER_CONTENT_SID ?? "";
  const sender = process.env.NEXT_PUBLIC_RALLORA_WHATSAPP_NUMBER ?? "";
  const webhookUrl = process.env.TWILIO_WHATSAPP_INBOUND_URL ?? "";
  if (!/^AC[0-9a-f]{32}$/i.test(account) || !authToken || !/^HX[0-9a-f]{32}$/i.test(contentSid)
      || !phonePattern.test(sender) || !webhookUrl.startsWith("https://")) return null;
  return { account, authToken, contentSid, sender, webhookUrl };
}

export function twilioSignatureMatches(url: string, values: URLSearchParams, secret: string, signature: string) {
  const names = [...new Set(values.keys())].sort();
  const payload = url + names.map(name =>
    [...new Set(values.getAll(name))].sort().map(value => name + value).join("")).join("");
  const expected = createHmac("sha1", secret).update(payload).digest("base64");
  const supplied = Buffer.from(signature);
  return supplied.length === expected.length && timingSafeEqual(supplied, Buffer.from(expected));
}

export function whatsappCommand(values: URLSearchParams, account: string, sender: string) {
  const sid = values.get("MessageSid") ?? "";
  const from = values.get("From") ?? "";
  if (values.get("AccountSid") !== account || values.get("To") !== `whatsapp:${sender}`
      || !from.startsWith("whatsapp:") || !phonePattern.test(from.slice(9)) || !messageSidPattern.test(sid)) return null;
  const body = (values.get("Body") ?? "").trim();
  const join = /^JOIN ([0-9a-f]{32})$/i.exec(body);
  const command = body.toUpperCase() === "STOP" || values.get("OptOutType") === "STOP"
    ? "STOP" : join ? `JOIN ${join[1].toLowerCase()}` : null;
  return command ? { sid, phone: from.slice(9), command } : null;
}

export async function sendWhatsAppReminder(config: NonNullable<ReturnType<typeof whatsappConfig>>, job: WhatsAppReminder, actionUrl: string) {
  const singleLine = (content: string, max: number) => content.replace(/\s+/gu, " ").trim().slice(0, max);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.account}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.account}:${config.authToken}`).toString("base64")}` },
    body: new URLSearchParams({
      From: `whatsapp:${config.sender}`,
      To: `whatsapp:${job.to}`,
      ContentSid: config.contentSid,
      ContentVariables: JSON.stringify({
        1: singleLine(job.clubName, 100),
        2: singleLine(job.title, 100),
        3: singleLine(job.body, 400),
        4: actionUrl,
      }),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return { sid: null, status: response.status >= 500 ? "unconfirmed" : "failed" };
  const { sid, status } = await response.json();
  if (typeof sid !== "string" || !messageSidPattern.test(sid)) return { sid: null, status: "unconfirmed" };
  return { sid, status: status === "failed" || status === "undelivered" ? "failed" : "accepted" };
}

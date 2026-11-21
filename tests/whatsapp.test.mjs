import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { twilioSignatureMatches, whatsappCommand } from "../lib/whatsapp.ts";

const account = "AC" + "1".repeat(32);
const sender = "+447700900111";
const number = "+447700900222";

test("Twilio signature matches a signed form and rejects altered data", () => {
  const url = "https://www.rallora.app/api/integrations/whatsapp";
  const secret = "test-secret";
  const form = new URLSearchParams({ To: "whatsapp:" + sender, Body: "STOP", From: "whatsapp:" + number });
  const payload = url + "BodySTOPFromwhatsapp:" + number + "Towhatsapp:" + sender;
  const signature = createHmac("sha1", secret).update(payload).digest("base64");
  assert.equal(twilioSignatureMatches(url, form, secret, signature), true);
  form.set("Body", "JOIN");
  assert.equal(twilioSignatureMatches(url, form, secret, signature), false);
});

test("only recognised WhatsApp commands addressed to the configured sender are processed", () => {
  const sid = "SM" + "2".repeat(32);
  const code = "3".repeat(32);
  const form = new URLSearchParams({
    AccountSid: account, MessageSid: sid, From: "whatsapp:" + number, To: "whatsapp:" + sender, Body: "join " + code,
  });
  assert.deepEqual(whatsappCommand(form, account, sender), { sid, phone: number, command: "JOIN " + code });
  form.set("Body", "stop");
  assert.deepEqual(whatsappCommand(form, account, sender), { sid, phone: number, command: "STOP" });
  form.set("From", number);
  assert.equal(whatsappCommand(form, account, sender), null);
});

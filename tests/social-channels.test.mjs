import test from "node:test";
import assert from "node:assert/strict";
import {
  SOCIAL_CHANNELS, formatSocialCaption, shortenSocial,
} from "../lib/social/channels.ts";

const url = "https://rallora.example/clubs/club-a";
const title = "Week 6 confirmed results";
const message = "Pair One 6-4, 6-3 Pair Two";
test("all destinations have distinct labels", () => {
  assert.equal(new Set(SOCIAL_CHANNELS).size, 5);
});

test("WhatsApp prepares a human-shareable announcement and real club link", () => {
  const text = formatSocialCaption("WhatsApp", title, message, url);
  assert.match(text, /^\*Week 6 confirmed results\*/);
  assert.match(text, /Full details: https:\/\/rallora.example\/clubs\/club-a/);
  assert.ok(text.includes(message));
});

test("Instagram feed caption avoids false clickable offsite link", () => {
  const text = formatSocialCaption("Instagram", title, message, url);
  assert.ok(!text.includes(url));
  assert.match(text, /#Padel #Rallora$/);
  assert.ok(Array.from(text).length <= 2200);
});

test("Facebook and website preserve text; email has a subject", () => {
  assert.ok(formatSocialCaption("Facebook", title, message, url).includes(url));
  assert.equal(formatSocialCaption("Club website", title, message, url),
    title + "\n\n" + message);
  assert.ok(formatSocialCaption("Email", title, message, url).startsWith("Subject: "));
});

test("long and Unicode-rich messages are bounded by channel", () => {
  const large = "🏆".repeat(4000);
  assert.equal(Array.from(shortenSocial(large, 1050)).length, 1050);
  assert.ok(formatSocialCaption("WhatsApp", title, large, url).length < 3000);
  assert.ok(Array.from(formatSocialCaption("Instagram", title, large, url)).length <= 2200);
  assert.match(shortenSocial(large, 10), /…$/);
});

test("leading whitespace and CRLF are cleaned for every destination", () => {
  for (const channel of SOCIAL_CHANNELS) {
    const formatted = formatSocialCaption(channel, " Hello ", " Text\r\nLine ", url);
    assert.ok(!formatted.includes("\r"));
    assert.ok(formatted.includes("Hello"));
    assert.ok(formatted.includes("Text\nLine"));
  }
});

/** Shared, pure caption preparation. This is NOT a provider publishing API. */
export type SocialChannel =
  | "Facebook" | "Instagram" | "WhatsApp" | "Email" | "Club website";

export const SOCIAL_CHANNELS: readonly SocialChannel[] = [
  "Facebook", "Instagram", "WhatsApp", "Email", "Club website",
];

const clean = (value: string) => value.trim().replace(/\r/g, "");
export function shortenSocial(value: string, limit: number): string {
  const points = Array.from(value);
  return points.length > limit
    ? points.slice(0, limit - 1).join("").trimEnd() + "…" : value;
}

export function formatSocialCaption(
  channel: SocialChannel, title: string, body: string, clubUrl: string,
): string {
  const heading = clean(title);
  const message = clean(body);
  if (channel === "WhatsApp") {
    return `*${heading}*\n\n${shortenSocial(message, 1050)}\n\nFull details: ${clubUrl}`;
  }
  if (channel === "Instagram") {
    // Ordinary Instagram feed captions do not offer a clickable outbound link.
    // The full actionable information belongs in the graphic itself.
    return `${heading}\n\n${shortenSocial(message, 1700)}\n\n#Padel #Rallora`;
  }
  if (channel === "Email") {
    return `Subject: ${heading}\n\n${message}\n\nFull details: ${clubUrl}`;
  }
  if (channel === "Club website") {
    return `${heading}\n\n${message}`;
  }
  return `${heading}\n\n${message}\n\n${clubUrl}`;
}

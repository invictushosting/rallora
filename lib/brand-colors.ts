/** Readable foregrounds for club-supplied six-digit brand colours. */
export function brandColor(value: string | null | undefined, fallback = "#2458ff"): string {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}
function luminance(hex: string): number {
  const values = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
export function contrastRatio(first: string, second: string): number {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function readableInk(background: string): string {
  if (contrastRatio("#061a39", background) >= 4.5) return "#061a39";
  return contrastRatio("#ffffff", background) >= 4.5 ? "#ffffff" : "#000000";
}
export function readableAccent(accent: string, background: string): string {
  return contrastRatio(accent, background) >= 4.5 ? accent : readableInk(background);
}

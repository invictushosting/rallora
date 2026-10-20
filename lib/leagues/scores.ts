// Older forms advertised full set scores in each pairing's field.
// The first number is that pairing's own games in each set.
const pairedSets = /^\s*\d+\s*[-:–—]\s*\d+(?:\s*,\s*\d+\s*[-:–—]\s*\d+)*\s*$/;

export function scoreSets(value: string | null | undefined): string[] {
  const text = value?.trim() ?? "";
  if (!text) return [];
  if (pairedSets.test(text)) return text.split(",").map(set => set.match(/^\s*(\d+)/)![1]);
  return text.split(/[,\s]+/).filter(Boolean);
}

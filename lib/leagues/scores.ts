// Older forms advertised full set scores in each pairing's field.
// The first number is that pairing's own games in each set.
const pairedSets = /^\s*\d+\s*[-:–—]\s*\d+(?:\s*,\s*\d+\s*[-:–—]\s*\d+)*\s*$/;

export function scoreSets(value: string | null | undefined): string[] {
  const text = value?.trim() ?? "";
  if (!text) return [];
  if (pairedSets.test(text)) return text.split(",").map(set => set.match(/^\s*(\d+)/)![1]);
  return text.split(/[,\s]+/).filter(Boolean);
}

export type SetScore = { home: string; away: string };

// Keep score orientation fixed to the fixture, including when the away player submits.
export function resultScores(sets: SetScore[]): { home: string; away: string } {
  const played = sets.filter(set => set.home.trim() || set.away.trim());
  if (!played.length) throw new Error("Enter the score for at least one set.");
  let gap = false;
  for (const set of sets) {
    if (!set.home.trim() && !set.away.trim()) { gap = true; continue; }
    if (gap) throw new Error("Enter sets in order without leaving a blank set between them.");
    if (![set.home, set.away].every(value => /^\d{1,2}$/.test(value.trim()))) {
      throw new Error("Enter both teams’ games for each played set, using whole numbers from 0 to 99.");
    }
  }
  return {
    home: played.map(set => Number(set.home)).join(","),
    away: played.map(set => Number(set.away)).join(","),
  };
}

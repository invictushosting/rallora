/**
 * Carbon Padel six-team round robin pilot rules.
 * Pure calculations only: caller must enforce tenant authorization and persist results.
 */
export const CARBON_DIVISIONS = Object.freeze([
  { name: "Diamond", minLevel: 4.5, maxLevel: null, weekday: 3 },
  { name: "Kevlar", minLevel: 4, maxLevel: 5, weekday: 1 },
  { name: "Steel", minLevel: 3, maxLevel: 4, weekday: 2 },
  { name: "Ivory", minLevel: 2, maxLevel: 3, weekday: 4 },
  { name: "Graphite", minLevel: 1, maxLevel: 2, weekday: 5 },
]);
export const CARBON_RULES = Object.freeze({
  teamsPerDivision: 6,
  weeksPerSeason: 6,
  gamesPerMatch: 6,
  roundTargetMinutes: 20,
  sessionMinutes: 120,
  startLocalTime: "19:00",
  courtsRequired: 3,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  tiebreakBonus: 1,
  oneServe: true,
  letServesPlayOn: true,
  goldenPoint: true,
  mandatoryTiebreak: true,
});
export function generateCarbonFixtures(teamIds) {
  if (!Array.isArray(teamIds) || teamIds.length !== 6 || new Set(teamIds).size !== 6 ||
      teamIds.some(id => typeof id !== "string" || !id.trim())) {
    throw new Error("Carbon fixtures require exactly six distinct team IDs.");
  }
  const rotation = [...teamIds];
  const rounds = [];
  for (let round = 0; round < 5; round++) {
    const matches = Array.from({length: 3}, (_, court) => ({
      round: round + 1,
      court: court + 1,
      teamA: rotation[court],
      teamB: rotation[5 - court],
      targetStartMinutes: round * 20,
    }));
    rounds.push(matches);
    rotation.splice(1, 0, rotation.pop());
  }
  return Array.from({length: 6}, (_, week) => rounds.flatMap(matches =>
    matches.map(match => ({ ...match, week: week + 1 }))));
}
export function scoreCarbonMatch({ teamA, teamB, gamesA, gamesB, tiebreakWinner }) {
  if (!teamA || !teamB || teamA === teamB) throw new Error("Two distinct teams required.");
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB) ||
      gamesA < 0 || gamesB < 0 || gamesA + gamesB !== 6) {
    throw new Error("The match must have exactly six completed games.");
  }
  if (tiebreakWinner !== teamA && tiebreakWinner !== teamB) {
    throw new Error("A mandatory tiebreak winner must be recorded.");
  }
  const baseA = gamesA > gamesB ? 3 : gamesA === gamesB ? 1 : 0;
  const baseB = gamesB > gamesA ? 3 : gamesA === gamesB ? 1 : 0;
  return {
    teamA, teamB, gamesA, gamesB, tiebreakWinner,
    pointsA: baseA + Number(tiebreakWinner === teamA),
    pointsB: baseB + Number(tiebreakWinner === teamB),
    winA: Number(gamesA > gamesB),
    winB: Number(gamesB > gamesA),
    gameDifferenceA: gamesA - gamesB,
    gameDifferenceB: gamesB - gamesA,
  };
}
export function carbonStandings(teamIds, results) {
  if (new Set(teamIds).size !== teamIds.length) throw new Error("Duplicate team IDs.");
  const rows = new Map(teamIds.map(team => [team, {
    team, played: 0, points: 0, wins: 0, gameDifference: 0, tiebreaksWon: 0,
  }]));
  for (const result of results) {
    const score = scoreCarbonMatch(result);
    if (!rows.has(score.teamA) || !rows.has(score.teamB)) throw new Error("Unknown team.");
    const a = rows.get(score.teamA), b = rows.get(score.teamB);
    a.played++; b.played++;
    a.points += score.pointsA; b.points += score.pointsB;
    a.wins += score.winA; b.wins += score.winB;
    a.gameDifference += score.gameDifferenceA;
    b.gameDifference += score.gameDifferenceB;
    rows.get(score.tiebreakWinner).tiebreaksWon++;
  }
  return [...rows.values()].sort((a, b) =>
    b.points - a.points || b.wins - a.wins ||
    b.gameDifference - a.gameDifference ||
    b.tiebreaksWon - a.tiebreaksWon ||
    a.team.localeCompare(b.team));
}

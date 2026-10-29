/** Search published fixtures across division, team, player and round details. */
export function fixtureMatchesQuery(
  query: string,
  values: ReadonlyArray<string | number | null | undefined>,
): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const searchable = values.filter((value) => value !== null && value !== undefined)
    .join(" ").toLocaleLowerCase();
  return terms.every((term) => searchable.includes(term));
}

/** Cancelling a court booking keeps the fixture playable; cancelling the fixture retires it. */
export function fixtureIsPublished(fixture: { status: string }): boolean {
  return fixture.status !== "cancelled";
}

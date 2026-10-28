export type FixtureRoster = {home_team_id:string;away_team_id:string;home_player_names?: (string|null)[]|null;away_player_names?: (string|null)[]|null};

/** Snapshots exist only once match activity is recorded. Open fixtures use today's pairing. */
export function fixturePlayerLabel(fixture:FixtureRoster,teamId:string,current:string):string {
  const names=teamId===fixture.home_team_id?fixture.home_player_names:teamId===fixture.away_team_id?fixture.away_player_names:null;
  return names?.filter(name=>name?.trim()).join(" / ")||current;
}

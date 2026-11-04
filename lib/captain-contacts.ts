export type CaptainContact = { teamId: string; club: string; league: string; division: string; team: string; captain: string; phone: string };
type Team = { id: string; division_id: string; name: string; captain_email: string | null; player_one_name: string | null; player_two_name: string | null; player_one_email: string | null; player_two_email: string | null };
type Roster = { team_id: string; player_user_id: string; registration_request_id: string; role: string };
type Application = { created_team_id: string | null; requested_by: string; captain_name: string; captain_phone: string | null; status: string };
type Registration = { id: string; team_id: string; player_user_id: string; player_name: string; player_phone: string | null; status: string };

// Only contact snapshots already shared with this club are used. Never read
// private player profiles, or use a former captain's application for a replacement.
export function captainContacts(club: string, league: string,
  divisions: { id: string; name: string }[], teams: Team[], roster: Roster[],
  applications: Application[], registrations: Registration[],
): CaptainContact[] {
  return teams.flatMap(team => {
    const division = divisions.find(d => d.id === team.division_id);
    if (!division) return [];
    const base = { teamId: team.id, club, league, division: division.name, team: team.name };
    const captains = roster.filter(r => r.team_id === team.id && r.role === "captain");
    if (!captains.length) {
      const email = team.captain_email?.trim().toLowerCase();
      const captain = email && email === team.player_one_email?.trim().toLowerCase() ? team.player_one_name
        : email && email === team.player_two_email?.trim().toLowerCase() ? team.player_two_name : null;
      return [{ ...base, captain: captain || "No captain assigned", phone: "" }];
    }
    return captains.map(member => {
      const registration = registrations.find(r => r.id === member.registration_request_id && r.team_id === team.id && r.player_user_id === member.player_user_id && r.status === "approved");
      const application = applications.find(a => a.created_team_id === team.id && a.requested_by === member.player_user_id && a.status === "approved");
      return { ...base, captain: registration?.player_name || application?.captain_name || "Captain name unavailable",
        phone: registration?.player_phone?.trim() || application?.captain_phone?.trim() || "" };
    });
  }).sort((a, b) => a.division.localeCompare(b.division) || a.team.localeCompare(b.team));
}

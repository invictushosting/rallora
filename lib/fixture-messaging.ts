export type FixtureMessage = {
  id: string; sequence: number; fixture_id: string; sender_user_id: string;
  sender_team_id: string | null; sender_name: string;
  kind: "message" | "proposal" | "accepted" | "declined" | "help" | "resolved";
  body: string; starts_at: string | null; ends_at: string | null; court: string | null;
  proposal_status: "pending" | "accepted" | "declined" | "superseded" | null;
  home_roster_version: number | null; away_roster_version: number | null; created_at: string;
};
export type FixtureConversation = {
  id: string; club_id: string; slug: string; club: string; league: string; division: string;
  home: string; away: string; home_team_id: string; away_team_id: string;
  home_roster_version: number; away_roster_version: number;
  play_by: string; available_from: string | null; status: string; timezone: string;
  manager: boolean; can_record_booking: boolean; viewer_team_id: string | null; writable: boolean;
  help_requested: boolean; alerts_enabled: boolean; email_enabled: boolean;
};
export function proposalIsCurrent(message: FixtureMessage, context: FixtureConversation, now = Date.now()): boolean {
  return message.kind === "proposal" && message.home_roster_version === context.home_roster_version
    && message.away_roster_version === context.away_roster_version
    && !!message.starts_at && new Date(message.starts_at).getTime() > now;
}
export function canRespondToProposal(message: FixtureMessage, context: FixtureConversation, viewerId: string): boolean {
  return context.writable && !!context.viewer_team_id && context.viewer_team_id !== message.sender_team_id
    && viewerId !== message.sender_user_id && message.proposal_status === "pending" && proposalIsCurrent(message, context);
}
export function localDateTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

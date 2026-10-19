export const OFFICIAL_RESULT_STATUSES = ["confirmed", "admin_override"];

export type CaptainSubmission = {
  id: string; fixture_id: string; submitting_team_id: string; submitted_by_user_id: string;
  home_score: string | null; away_score: string | null; notes: string | null;
  dispute_note: string | null; status: string; updated_at: string;
};
export type OfficialResult = {
  fixture_id: string; home_score: string | null; away_score: string | null; status: string;
};

export function captainResultState(fixture: { id: string; status: string }, teamId: string,
  viewerId: string, seasonStatus: string | undefined, submissions: CaptainSubmission[], results: OfficialResult[]) {
  const official = results.find(result => result.fixture_id === fixture.id && OFFICIAL_RESULT_STATUSES.includes(result.status));
  const submission = submissions.filter(item => item.fixture_id === fixture.id)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))[0];
  const confirmed = Boolean(official) || fixture.status === "confirmed";
  const playable = seasonStatus === "active" && !confirmed && fixture.status !== "cancelled";
  const needsReview = Boolean(playable && submission?.status === "pending_opponent" && submission.submitting_team_id !== teamId && submission.submitted_by_user_id !== viewerId);
  const needsSubmit = playable && fixture.status === "open" && !submission;
  return { official, submission, confirmed, needsReview, needsSubmit,
    action: needsReview || needsSubmit,
    label: confirmed ? "CONFIRMED" : needsReview ? "REVIEW RESULT" : needsSubmit ? "SUBMIT RESULT"
      : submission?.status === "disputed" || fixture.status === "disputed" ? "WITH ORGANISER"
      : submission?.status === "pending_opponent" ? "AWAITING CONFIRMATION" : "NO ACTION REQUIRED" };
}

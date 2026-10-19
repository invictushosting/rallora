import ClubLeagueHub from "../../../club-hub";

export default async function CompetitionPreview({ params }: { params: Promise<{ slug: string; seasonId: string }> }) {
  const { slug, seasonId } = await params;
  return <ClubLeagueHub slugOverride={slug} previewSeasonId={seasonId} />;
}

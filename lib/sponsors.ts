export const SPONSOR_POSITIONS = [
  { value: "after-header", label: "Below the club header" },
  { value: "above-tables", label: "Above league tables / event details" },
  { value: "beside-fixtures", label: "Beside fixtures / event rounds" },
  { value: "above-footer", label: "Above the footer" },
] as const;
export type SponsorPosition = typeof SPONSOR_POSITIONS[number]["value"];
export type SponsorScope = "club" | "league" | "division" | "event";
export type Sponsor = {
  id: string; club_id: string; name: string; sponsor_type: string | null;
  logo_url: string | null; website_url: string | null; placement: string | null;
  scope_type: SponsorScope; scope_id: string | null; is_main: boolean;
  is_active: boolean; sort_order: number;
};
export const SPONSOR_FIELDS = "id,club_id,name,sponsor_type,logo_url,website_url,placement,scope_type,scope_id,is_main,is_active,sort_order";
export type SponsorContext = { clubId: string; seasonId?: string; divisionId?: string; eventId?: string };
export function sponsorPositions(placement: string | null): SponsorPosition[] {
  const tokens = (placement ?? "").split(",").map(item => item.trim());
  const positions = SPONSOR_POSITIONS.filter(item => tokens.includes(item.value)).map(item => item.value);
  // Old placement names remain visible in the original partner area until edited.
  return positions.length ? positions : ["above-footer"];
}
export function matchingSponsors(sponsors: Sponsor[], context: SponsorContext, position: SponsorPosition): Sponsor[] {
  return sponsors.filter(sponsor => sponsor.is_active && sponsor.club_id === context.clubId &&
    sponsorPositions(sponsor.placement).includes(position) && (
      sponsor.scope_type === "club" ||
      sponsor.scope_type === "league" && !!context.seasonId && sponsor.scope_id === context.seasonId ||
      sponsor.scope_type === "division" && !!context.divisionId && sponsor.scope_id === context.divisionId ||
      sponsor.scope_type === "event" && !!context.eventId && sponsor.scope_id === context.eventId
    )).sort((a, b) => Number(b.scope_type !== "club") - Number(a.scope_type !== "club") ||
      Number(b.is_main) - Number(a.is_main) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}
export function sponsorWebsite(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
export function sponsorshipEmail(email: string | null | undefined, name: string): string | null {
  const address = email?.trim();
  if (!address || !/^[^\s@?&#%]+@[^\s@?&#%]+\.[^\s@?&#%]+$/.test(address)) return null;
  return `mailto:${address}?subject=${encodeURIComponent(`Sponsorship enquiry: ${name}`)}`;
}

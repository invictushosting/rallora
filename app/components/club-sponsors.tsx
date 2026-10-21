import { matchingSponsors, sponsorshipEmail, sponsorWebsite, type Sponsor, type SponsorContext, type SponsorPosition } from "@/lib/sponsors";
import styles from "./club-sponsors.module.css";

type Props = {
  sponsors: Sponsor[]; context: SponsorContext; position: SponsorPosition;
  enquiry?: { enabled: boolean; email: string | null; name: string; kind?: "league" | "event" };
};
export default function ClubSponsors({ sponsors, context, position, enquiry }: Props) {
  const visible = matchingSponsors(sponsors, context, position);
  const hasSpecific = sponsors.some(item => item.is_active && item.club_id === context.clubId && (
    context.seasonId && item.scope_type === "league" && item.scope_id === context.seasonId ||
    context.eventId && item.scope_type === "event" && item.scope_id === context.eventId
  ));
  const email = enquiry ? sponsorshipEmail(enquiry.email, enquiry.name) : null;
  const invite = position === "above-tables" && enquiry?.enabled && !hasSpecific && email;
  if (!visible.length && !invite) return null;
  return <section className={styles.area} aria-label="Sponsors and partnerships">
    {visible.length > 0 && <div className={styles.grid}>{visible.map(sponsor => {
      const featured = sponsor.is_main || sponsor.scope_type !== "club";
      const logo = sponsorWebsite(sponsor.logo_url);
      const url = sponsorWebsite(sponsor.website_url);
      const body = <>{logo && <span className={styles.logo}><img src={logo} alt={`${sponsor.name} logo`} /></span>}
        <span className={styles.details}><small>{sponsor.is_main ? "MAIN CLUB SPONSOR" : `${sponsor.scope_type === "club" ? "CLUB" : sponsor.scope_type.toUpperCase()} SPONSOR`}</small>
          <strong>{sponsor.name}</strong>{sponsor.sponsor_type && <span>{sponsor.sponsor_type}</span>}
          {url && <span className={styles.visit}>Visit sponsor</span>}</span></>;
      return url ? <a key={sponsor.id} className={`${styles.card} ${featured ? styles.featured : ""}`} href={url} target="_blank" rel="noopener noreferrer sponsored">{body}</a>
        : <article key={sponsor.id} className={`${styles.card} ${featured ? styles.featured : ""}`}>{body}</article>;
    })}</div>}
    {invite && <aside className={styles.invite}><div><strong>Sponsor this {enquiry?.kind ?? "league"}</strong>
      <p>Interested in supporting our players? <a href={email}>Contact the club</a> to discuss sponsorship.</p></div></aside>}
  </section>;
}

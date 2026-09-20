"use client";

import { useState } from "react";
import Link from "next/link";
import RalloraLogo from "../components/rallora-logo";
import styles from "./demo.module.css";

const teams = ["Court Collective", "Baseline Club", "Glasshouse", "The Lob Society"];
const results = [
  { home: 0, away: 1, score: "6–4, 6–3", winner: 0 },
  { home: 2, away: 3, score: "4–6, 6–3, 6–4", winner: 2 },
  { home: 0, away: 2, score: "6–2, 7–5", winner: 0 },
  { home: 1, away: 3, score: "6–3, 6–4", winner: 1 },
];
const standings = teams.map((name, id) => {
  const played = results.filter(r => r.home === id || r.away === id).length;
  const won = results.filter(r => r.winner === id).length;
  return { name, played, won, lost: played - won, points: won * 3 };
}).sort((a, b) => b.points - a.points);
const roles = ["Player", "Captain", "Organiser"] as const;
const sections = ["Table", "Fixtures", "Results"] as const;

export default function DemoClub() {
  const [role, setRole] = useState<typeof roles[number]>("Player");
  const [section, setSection] = useState<typeof sections[number]>("Table");
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" aria-label="Rallora home"><RalloraLogo width={180} /></Link>
      <Link href="/products">Explore the platform →</Link>
    </header>
    <div className={styles.notice}>DEMO ONLY · Fictional club and results · No login needed</div>
    <section className={styles.hero}>
      <p className={styles.eyebrow}>YOUR CLUB COULD LOOK LIKE THIS</p>
      <h1>Less organising.<br /><span>More time on court.</span></h1>
      <p>Take a look around Rallora Demo Club. See how a season comes together for players, captains and the people running it.</p>
      <a className={styles.cta} href="mailto:hello@rallora.app?subject=Rallora%20club%20walkthrough">Ask for a club walkthrough ↗</a>
    </section>
    <section className={styles.workspace} aria-labelledby="demo-club-title">
      <div className={styles.clubHeading}><div><p className={styles.eyebrow}>RALLORA DEMO CLUB</p><h2 id="demo-club-title">Winter League · Division One</h2><p>Sample season · 4 teams · 3 rounds</p></div><span className={styles.badge}>PREVIEW</span></div>
      <div className={styles.switches} aria-label="Choose a preview role">
        {roles.map(item => <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)}>{item} view</button>)}
      </div>
      <p className={styles.explanation}>These are illustrative role previews, not signed-in dashboards. Nothing here changes a real club.</p>
      {role === "Player" && <section aria-label="Player preview">
        <div className={styles.metrics}><div><strong>4</strong><span>Teams competing</span></div><div><strong>4 / 6</strong><span>Matches completed</span></div><div><strong>Round 3</strong><span>Up next</span></div></div>
        <div className={styles.switches} aria-label="Choose league section">{sections.map(item => <button type="button" key={item} aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}</div>
        {section === "Table" && <div className={styles.tableWrap}><table><caption>Sample standings · 3 points per win · tied teams share a position</caption><thead><tr><th scope="col">Pos</th><th scope="col">Team</th><th scope="col">Played</th><th scope="col">Won</th><th scope="col">Lost</th><th scope="col">Points</th></tr></thead><tbody>{standings.map(row => <tr key={row.name}><td>{1 + standings.filter(other => other.points > row.points).length}</td><th scope="row">{row.name}</th><td>{row.played}</td><td>{row.won}</td><td>{row.lost}</td><td><strong>{row.points}</strong></td></tr>)}</tbody></table></div>}
        {section === "Fixtures" && <div className={styles.cards}>{[[0, 3], [1, 2]].map(([home, away]) => <article key={home}><p className={styles.eyebrow}>ROUND 3 · SAMPLE FIXTURE</p><h3>{teams[home]} <span>vs</span> {teams[away]}</h3><p>Play by 22 November 2026</p><small>Illustrative deadline, not a court booking.</small></article>)}</div>}
        {section === "Results" && <div className={styles.cards}>{results.map(result => <article key={`${result.home}-${result.away}`}><p className={styles.eyebrow}>SAMPLE CONFIRMED RESULT</p><h3>{teams[result.home]} <span>vs</span> {teams[result.away]}</h3><strong>{result.score}</strong><p>Winner: {teams[result.winner]}</p></article>)}</div>}
      </section>}
      {role === "Captain" && <section className={styles.rolePanel} aria-label="Captain preview"><p className={styles.eyebrow}>YOUR TEAM, IN ONE PLACE</p><h3>Court Collective</h3><p>Your next fixture: The Lob Society · Round 3</p><div className={styles.cards}><article><h4>1. Arrange the match</h4><p>Keep track of the opposition and the play-by deadline.</p></article><article><h4>2. Report the result</h4><p>See how match reporting fits into your club’s confirmation process.</p></article><article><h4>3. Follow the season</h4><p>Check confirmed results and the published league table.</p></article></div><p className={styles.explanation}>Read-only tour. Score submission and team editing are not enabled in this demo.</p></section>}
      {role === "Organiser" && <section className={styles.rolePanel} aria-label="Organiser preview"><p className={styles.eyebrow}>A CLEAR VIEW OF YOUR SEASON</p><h3>From setup to final standings</h3><div className={styles.cards}><article><h4>Build your competition</h4><p>Preview the season, divisions and teams your club needs.</p></article><article><h4>Keep matches moving</h4><p>Review fixtures, outstanding matches and confirmed results.</p></article><article><h4>Keep players informed</h4><p>Explore club news and the Social Studio product.</p><Link href="/social">About Rallora Social →</Link></article></div><p className={styles.explanation}>Illustrative workflow, not a live admin console. Actual access and features depend on club permissions and release readiness. No invitations, payments or notifications are sent.</p></section>}
    </section>
    <section className={styles.contact}><p className={styles.eyebrow}>MAKE IT YOUR CLUB</p><h2>Bring your league to Rallora.</h2><p>Tell us about your club, teams and season. We’ll walk through what is ready and what you need for launch.</p><a className={styles.cta} href="mailto:hello@rallora.app?subject=Rallora%20club%20enquiry">Talk to us about your club ↗</a><p><small>Opens your email app. Nothing is sent automatically.</small></p></section>
    <footer className={styles.footer}>Rallora · Demo data only. No connection to GSM league records.</footer>
  </main>;
}

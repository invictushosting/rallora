import { scoreSets } from "@/lib/leagues/scores";
import styles from "./match-score.module.css";

export type MatchScoreProps = {
  homeLabel: string; awayLabel: string; homeScore?: string | null; awayScore?: string | null;
  outcome?: "home" | "away" | "draw" | null;
};

export default function MatchScore({ homeLabel, awayLabel, homeScore, awayScore, outcome }: MatchScoreProps) {
  const home = scoreSets(homeScore), away = scoreSets(awayScore);
  const count = Math.max(home.length, away.length);
  return <div className={styles.score}>
    <div className={styles.scroll}><table className={styles.table}>
      <caption className={styles.srOnly}>Match score. Each row shows one pairing’s games in each set.</caption>
      <thead><tr><th scope="col">Pairing</th>{Array.from({ length: count }, (_, index) => <th scope="col" key={index}>Set {index + 1}</th>)}</tr></thead>
      <tbody>{([{ side: "home", name: homeLabel, scores: home, other: away }, { side: "away", name: awayLabel, scores: away, other: home }] as const).map(row =>
        <tr key={row.side}><th scope="row"><span className={styles.side}>{row.side}</span><span className={styles.name}>{row.name}</span>{outcome === row.side && <span className={styles.winner}>Winner</span>}</th>
          {Array.from({ length: count }, (_, index) => <td key={index}><span className={Number(row.scores[index]) > Number(row.other[index]) ? styles.won : styles.games}>{row.scores[index] ?? "—"}</span></td>)}
        </tr>)}</tbody>
    </table></div>
    {outcome === "draw" && <p className={styles.outcome}>Draw</p>}
  </div>;
}

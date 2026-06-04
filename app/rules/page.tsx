"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import styles from "./rules.module.css";

type Club = {
  id: string;
  name: string | null;
  short_name?: string | null;
};

type Season = {
  id: string;
  name: string | null;
};

type ClubRules = {
  rule_preset: string | null;
  score_format: string | null;
  fixture_rules: string | null;
  deadline_rules: string | null;
  forfeit_rules: string | null;
  result_submission_rules: string | null;
  captain_confirmation_rules: string | null;
  league_cup_rules: string | null;
  custom_rules: string | null;
  win_points: number | null;
  draw_points: number | null;
  loss_points: number | null;
  forfeit_win_points: number | null;
  forfeit_loss_points: number | null;
  double_forfeit_points: number | null;
  standings_tiebreaker: string | null;
};

const FALLBACK_RULES: ClubRules = {
  rule_preset: "standard",
  score_format: "Best of 3 sets",
  fixture_rules: "Teams arrange their own fixture time and should play before the listed deadline.",
  deadline_rules: "Results should be submitted before the next fixture release or fixture pack deadline.",
  forfeit_rules: "If one team fails to respond, arrange or attend, the organiser may award a forfeit win. Double forfeits may result in 0 points for both teams.",
  result_submission_rules: "One captain submits the score. The opposing captain or organiser can confirm, dispute or correct it.",
  captain_confirmation_rules: "Captains are responsible for arranging fixtures, submitting results and raising disputes quickly.",
  league_cup_rules: "Cup qualification may be automatic based on league position or manually selected by the organiser.",
  custom_rules: "",
  win_points: 3,
  draw_points: 1,
  loss_points: 0,
  forfeit_win_points: 3,
  forfeit_loss_points: 0,
  double_forfeit_points: 0,
  standings_tiebreaker: "Points, wins, score difference, score for, head-to-head, alphabetical",
};

function ruleLabel(value?: string | null) {
  const map: Record<string, string> = {
    standard: "Standard League",
    monthly_pack: "Monthly Fixture Pack",
    fast4: "Fast4",
    box_league: "Box League",
    custom: "Custom",
  };
  return map[value || "standard"] || "Custom";
}

function RuleCard({ title, badge, children, full = false }: { title: string; badge?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <section className={`${styles.card} ${full ? styles.cardFull : ""}`}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {badge ? <span className={styles.badge}>{badge}</span> : null}
      </div>
      <p className={styles.text}>{children}</p>
    </section>
  );
}

export default function PublicRulesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [club, setClub] = useState<Club | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [rules, setRules] = useState<ClubRules>(FALLBACK_RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRules() {
      setLoading(true);
      setError(null);

      const { data: clubData, error: clubError } = await supabase
        .from("clubs")
        .select("id,name,short_name")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (clubError || !clubData) {
        setError(clubError?.message || "No active club found yet.");
        setLoading(false);
        return;
      }

      setClub(clubData);

      const { data: seasonData } = await supabase
        .from("seasons")
        .select("id,name")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setSeason(seasonData || null);

      const { data: rulesData, error: rulesError } = await supabase
        .from("club_rules")
        .select("rule_preset,score_format,fixture_rules,deadline_rules,forfeit_rules,result_submission_rules,captain_confirmation_rules,league_cup_rules,custom_rules,win_points,draw_points,loss_points,forfeit_win_points,forfeit_loss_points,double_forfeit_points,standings_tiebreaker")
        .eq("club_id", clubData.id)
        .eq("season_id", seasonData?.id || null)
        .maybeSingle();

      if (rulesError && rulesError.code !== "PGRST116") {
        setError(rulesError.message);
      }

      setRules({ ...FALLBACK_RULES, ...(rulesData || {}) });
      setLoading(false);
    }

    loadRules();
  }, [supabase]);

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Rallora rules</span>
          <h1 className={styles.title}>{club?.name || "Club"} Rules</h1>
          <p className={styles.subtitle}>
            Public league rules for players, captains and organisers{season?.name ? ` during ${season.name}` : ""}.
          </p>
          <div className={styles.actions}>
            <Link href="/" className={`${styles.button} ${styles.buttonSecondary}`}>Back to league hub</Link>
            <Link href="/admin/rules" className={styles.button}>Admin: edit rules</Link>
          </div>
        </section>

        {loading ? <div className={`${styles.card} ${styles.cardFull}`}>Loading club rules…</div> : null}
        {error ? <div className={`${styles.card} ${styles.empty}`}>{error}</div> : null}

        {!loading ? (
          <div className={styles.grid}>
            <RuleCard title="Rules Preset" badge={ruleLabel(rules.rule_preset)}>
              {rules.score_format || FALLBACK_RULES.score_format}
            </RuleCard>
            <RuleCard title="Points System" full>
              <span className={styles.pointsList}>
                <span><strong>Win:</strong> {rules.win_points ?? FALLBACK_RULES.win_points}</span>
                <span><strong>Draw:</strong> {rules.draw_points ?? FALLBACK_RULES.draw_points}</span>
                <span><strong>Loss:</strong> {rules.loss_points ?? FALLBACK_RULES.loss_points}</span>
                <span><strong>Forfeit win:</strong> {rules.forfeit_win_points ?? FALLBACK_RULES.forfeit_win_points}</span>
                <span><strong>Forfeit loss:</strong> {rules.forfeit_loss_points ?? FALLBACK_RULES.forfeit_loss_points}</span>
                <span><strong>Double forfeit:</strong> {rules.double_forfeit_points ?? FALLBACK_RULES.double_forfeit_points}</span>
              </span>
              <span className={styles.tieBreak}>Tie-breakers: {rules.standings_tiebreaker || FALLBACK_RULES.standings_tiebreaker}</span>
            </RuleCard>
            <RuleCard title="Fixture Arrangement Rules">{rules.fixture_rules || FALLBACK_RULES.fixture_rules}</RuleCard>
            <RuleCard title="Deadline Rules">{rules.deadline_rules || FALLBACK_RULES.deadline_rules}</RuleCard>
            <RuleCard title="Forfeit Rules">{rules.forfeit_rules || FALLBACK_RULES.forfeit_rules}</RuleCard>
            <RuleCard title="Result Submission Rules">{rules.result_submission_rules || FALLBACK_RULES.result_submission_rules}</RuleCard>
            <RuleCard title="Captain Confirmation Rules">{rules.captain_confirmation_rules || FALLBACK_RULES.captain_confirmation_rules}</RuleCard>
            <RuleCard title="League Cup Rules">{rules.league_cup_rules || FALLBACK_RULES.league_cup_rules}</RuleCard>
            {rules.custom_rules ? <RuleCard title="Additional Club Rules" full>{rules.custom_rules}</RuleCard> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

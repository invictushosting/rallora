"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import styles from "../../rules/rules.module.css";

type Club = { id: string; name: string | null };
type Season = { id: string; name: string | null };
type UserState = { email: string | null; isAdmin: boolean; loading: boolean };
type RulesForm = {
  rule_preset: string;
  score_format: string;
  fixture_rules: string;
  deadline_rules: string;
  forfeit_rules: string;
  result_submission_rules: string;
  captain_confirmation_rules: string;
  league_cup_rules: string;
  custom_rules: string;
  win_points: string;
  draw_points: string;
  loss_points: string;
  forfeit_win_points: string;
  forfeit_loss_points: string;
  double_forfeit_points: string;
  standings_tiebreaker: string;
};

const DEFAULT_RULES: RulesForm = {
  rule_preset: "standard",
  score_format: "Best of 3 sets",
  fixture_rules: "Teams arrange their own fixture time. Matches should be played before the listed deadline unless agreed by the organiser.",
  deadline_rules: "Results should be submitted before the next fixture release or before the fixture pack deadline.",
  forfeit_rules: "If one team fails to respond, arrange or attend, the organiser may award a forfeit win. If both teams fail to arrange, both teams may receive 0 points.",
  result_submission_rules: "One captain submits the score. The opposing captain or organiser can confirm, dispute or correct the result.",
  captain_confirmation_rules: "Captains are responsible for arranging fixtures, submitting results and raising disputes quickly.",
  league_cup_rules: "Cup qualification can be automatic based on league position or manually selected by the organiser.",
  custom_rules: "",
  win_points: "3",
  draw_points: "1",
  loss_points: "0",
  forfeit_win_points: "3",
  forfeit_loss_points: "0",
  double_forfeit_points: "0",
  standings_tiebreaker: "Points, wins, score difference, score for, head-to-head, alphabetical",
};

const PRESETS = [
  ["standard", "Standard Padel League Rules"],
  ["monthly_pack", "Monthly Fixture Pack Rules"],
  ["fast4", "Fast4 Rules"],
  ["box_league", "Box League Rules"],
  ["custom", "Custom Rules"],
];

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? styles.fieldFull : undefined}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}

export default function AdminRulesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userState, setUserState] = useState<UserState>({ email: null, isAdmin: false, loading: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [club, setClub] = useState<Club | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [form, setForm] = useState<RulesForm>(DEFAULT_RULES);
  const [loadingRules, setLoadingRules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userState.isAdmin) loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState.isAdmin]);

  async function checkSession() {
    setUserState((prev) => ({ ...prev, loading: true }));
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email ?? null;

    if (!userEmail) {
      setUserState({ email: null, isAdmin: false, loading: false });
      return;
    }

    const { data: adminRows, error: adminError } = await supabase
      .from("admin_users")
      .select("email")
      .ilike("email", userEmail)
      .limit(1);

    setUserState({ email: userEmail, isAdmin: !adminError && Boolean(adminRows?.length), loading: false });
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (signInError) {
      setAuthError(signInError.message);
      return;
    }
    await checkSession();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUserState({ email: null, isAdmin: false, loading: false });
  }

  async function loadRules() {
    setLoadingRules(true);
    setError(null);
    setMessage(null);

    const { data: clubData, error: clubError } = await supabase
      .from("clubs")
      .select("id,name")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (clubError || !clubData) {
      setError(clubError?.message || "No active club found. Create a club first.");
      setLoadingRules(false);
      return;
    }

    const { data: seasonData } = await supabase
      .from("seasons")
      .select("id,name")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setClub(clubData);
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

    setForm({
      ...DEFAULT_RULES,
      ...(rulesData || {}),
      win_points: normalisePoints(rulesData?.win_points, DEFAULT_RULES.win_points),
      draw_points: normalisePoints(rulesData?.draw_points, DEFAULT_RULES.draw_points),
      loss_points: normalisePoints(rulesData?.loss_points, DEFAULT_RULES.loss_points),
      forfeit_win_points: normalisePoints(rulesData?.forfeit_win_points, DEFAULT_RULES.forfeit_win_points),
      forfeit_loss_points: normalisePoints(rulesData?.forfeit_loss_points, DEFAULT_RULES.forfeit_loss_points),
      double_forfeit_points: normalisePoints(rulesData?.double_forfeit_points, DEFAULT_RULES.double_forfeit_points),
      standings_tiebreaker: rulesData?.standings_tiebreaker || DEFAULT_RULES.standings_tiebreaker,
    });
    setLoadingRules(false);
  }

  function normalisePoints(value: unknown, fallback: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? String(numberValue) : fallback;
}

function toPointNumber(value: string, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function updateForm(key: keyof RulesForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetTemplate() {
    setForm(DEFAULT_RULES);
    setMessage("Default Rallora rules template loaded. Click Save Rules to apply it.");
  }

  async function saveRules() {
    if (!club) {
      setError("No active club found.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      club_id: club.id,
      season_id: season?.id || null,
      ...form,
      win_points: toPointNumber(form.win_points, 3),
      draw_points: toPointNumber(form.draw_points, 1),
      loss_points: toPointNumber(form.loss_points, 0),
      forfeit_win_points: toPointNumber(form.forfeit_win_points, 3),
      forfeit_loss_points: toPointNumber(form.forfeit_loss_points, 0),
      double_forfeit_points: toPointNumber(form.double_forfeit_points, 0),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("club_rules")
      .upsert(payload, { onConflict: "club_id,season_id" });

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    if (season?.id) {
      const { error: recalcError } = await supabase.rpc("recalculate_standings_for_season", {
        p_season_id: season.id,
      });

      if (recalcError) {
        setMessage("Rules saved, but standings could not be recalculated automatically. Use Admin → Recalculate to apply points.");
        setError(recalcError.message);
        return;
      }
    }

    setMessage("Rules saved and standings recalculated using the updated points system.");
  }

  if (userState.loading) {
    return (
      <main className={styles.shell}>
        <div className={styles.container}><div className={styles.card}>Checking admin access…</div></div>
      </main>
    );
  }

  if (!userState.email || !userState.isAdmin) {
    return (
      <main className={styles.shell}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <span className={styles.eyebrow}>Rallora admin</span>
            <h1 className={styles.title}>Edit Club Rules</h1>
            <p className={styles.subtitle}>Sign in with an approved admin account to edit the public rules page.</p>
          </section>
          <section className={`${styles.card} ${styles.cardFull}`}>
            {userState.email && !userState.isAdmin ? (
              <p className={`${styles.status} ${styles.error}`}>Signed in as {userState.email}, but this user is not listed in admin_users.</p>
            ) : null}
            <form className={styles.formGrid} onSubmit={signIn}>
              <Field label="Admin email"><input className={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></Field>
              <Field label="Password"><input className={styles.input} value={password} onChange={(event) => setPassword(event.target.value)} type="password" required /></Field>
              <div className={styles.fieldFull}>
                <button className={styles.button} type="submit" disabled={authLoading}>{authLoading ? "Signing in…" : "Sign in"}</button>
              </div>
              {authError ? <p className={`${styles.status} ${styles.error} ${styles.fieldFull}`}>{authError}</p> : null}
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Rallora admin</span>
          <h1 className={styles.title}>Club Rules</h1>
          <p className={styles.subtitle}>
            Edit custom rules for {club?.name || "the active club"}{season?.name ? ` — ${season.name}` : ""}. These rules feed the public rules page.
          </p>
          <div className={styles.actions}>
            <Link href="/" className={`${styles.button} ${styles.buttonSecondary}`}>Back to admin hub</Link>
            <Link href="/rules" className={styles.button}>Preview public rules</Link>
            <button className={`${styles.button} ${styles.buttonSecondary}`} type="button" onClick={signOut}>Sign out {userState.email}</button>
          </div>
        </section>

        <section className={`${styles.card} ${styles.cardFull}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Rules Editor</h2>
            <span className={styles.badge}>{loadingRules ? "Loading" : "Editable"}</span>
          </div>

          {error ? <p className={`${styles.status} ${styles.error}`}>{error}</p> : null}
          {message ? <p className={`${styles.status} ${styles.success}`}>{message}</p> : null}

          <div className={styles.formGrid}>
            <Field label="Rules preset">
              <select className={styles.select} value={form.rule_preset} onChange={(event) => updateForm("rule_preset", event.target.value)}>
                {PRESETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Score format">
              <input className={styles.input} value={form.score_format} onChange={(event) => updateForm("score_format", event.target.value)} />
            </Field>

            <div className={`${styles.fieldFull} ${styles.ruleSection}`}>
              <div className={styles.sectionHeading}>
                <h3>Points system</h3>
                <p>These values explain how the public league table is scored. Later we can wire these directly into automatic standings calculations per club.</p>
              </div>
              <div className={styles.pointsGrid}>
                <Field label="Win points">
                  <input className={styles.input} type="number" min="0" max="20" value={form.win_points} onChange={(event) => updateForm("win_points", event.target.value)} />
                </Field>
                <Field label="Draw points">
                  <input className={styles.input} type="number" min="0" max="20" value={form.draw_points} onChange={(event) => updateForm("draw_points", event.target.value)} />
                </Field>
                <Field label="Loss points">
                  <input className={styles.input} type="number" min="0" max="20" value={form.loss_points} onChange={(event) => updateForm("loss_points", event.target.value)} />
                </Field>
                <Field label="Forfeit win points">
                  <input className={styles.input} type="number" min="0" max="20" value={form.forfeit_win_points} onChange={(event) => updateForm("forfeit_win_points", event.target.value)} />
                </Field>
                <Field label="Forfeit loss points">
                  <input className={styles.input} type="number" min="-20" max="20" value={form.forfeit_loss_points} onChange={(event) => updateForm("forfeit_loss_points", event.target.value)} />
                </Field>
                <Field label="Double forfeit points">
                  <input className={styles.input} type="number" min="-20" max="20" value={form.double_forfeit_points} onChange={(event) => updateForm("double_forfeit_points", event.target.value)} />
                </Field>
              </div>
              <div className={styles.fieldFull}>
                <Field label="Standings tie-breaker order" full>
                  <input className={styles.input} value={form.standings_tiebreaker} onChange={(event) => updateForm("standings_tiebreaker", event.target.value)} />
                </Field>
              </div>
            </div>

            <Field label="Fixture arrangement rules" full>
              <textarea className={styles.textarea} value={form.fixture_rules} onChange={(event) => updateForm("fixture_rules", event.target.value)} />
            </Field>
            <Field label="Deadline rules" full>
              <textarea className={styles.textarea} value={form.deadline_rules} onChange={(event) => updateForm("deadline_rules", event.target.value)} />
            </Field>
            <Field label="Forfeit rules" full>
              <textarea className={styles.textarea} value={form.forfeit_rules} onChange={(event) => updateForm("forfeit_rules", event.target.value)} />
            </Field>
            <Field label="Result submission rules" full>
              <textarea className={styles.textarea} value={form.result_submission_rules} onChange={(event) => updateForm("result_submission_rules", event.target.value)} />
            </Field>
            <Field label="Captain confirmation rules" full>
              <textarea className={styles.textarea} value={form.captain_confirmation_rules} onChange={(event) => updateForm("captain_confirmation_rules", event.target.value)} />
            </Field>
            <Field label="League Cup rules" full>
              <textarea className={styles.textarea} value={form.league_cup_rules} onChange={(event) => updateForm("league_cup_rules", event.target.value)} />
            </Field>
            <Field label="Extra custom club rules / notes" full>
              <textarea className={styles.textarea} value={form.custom_rules} onChange={(event) => updateForm("custom_rules", event.target.value)} />
            </Field>
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="button" onClick={saveRules} disabled={saving || loadingRules}>{saving ? "Saving…" : "Save Rules"}</button>
            <button className={`${styles.button} ${styles.buttonSecondary}`} type="button" onClick={resetTemplate}>Reset to default template</button>
            <button className={`${styles.button} ${styles.buttonSecondary}`} type="button" onClick={loadRules}>Reload saved rules</button>
          </div>
        </section>
      </div>
    </main>
  );
}

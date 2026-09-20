"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import RalloraLogo from "@/app/components/rallora-logo";
import { createClient } from "@/lib/supabase";
import styles from "./social.module.css";
import {
  SOCIAL_CHANNELS, formatSocialCaption, shortenSocial,
  type SocialChannel,
} from "@/lib/social/channels";

type Club = { id: string; slug: string; name: string; short_name: string | null;
  primary_color: string | null };
type Season = { id: string; name: string; club_id: string };
type Fixture = { id: string; season_id: string; division_id: string;
  home_team_id: string; away_team_id: string; week_number: number; play_by: string };
type Result = { fixture_id: string; home_score: string | null;
  away_score: string | null; status: string; confirmed_at: string | null };
type Team = { id: string; name: string; division_id: string };
type Division = { id: string; name: string; season_id: string };
type Match = { id: string; season: string; week: number; division: string;
  home: string; away: string; score: string; confirmedAt: string };
type Ready = { kind: "ready"; club: Club; userId: string; role: string; matches: Match[] };
type View = Ready | { kind: "loading" | "signed_out" | "forbidden" | "missing" } |
  { kind: "error"; message: string };
type PostType = "news" | "result" | "roundup";
type Channel = SocialChannel;
const CHANNELS = SOCIAL_CHANNELS;
const CLUB_ROLE = ["owner", "admin", "organiser"];
type GraphicSize = "square" | "portrait" | "story";
const GRAPHICS: Record<GraphicSize, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "Square · 1080 × 1080" },
  portrait: { width: 1080, height: 1350, label: "Portrait · 1080 × 1350" },
  story: { width: 1080, height: 1920, label: "Story · 1080 × 1920" },
};
const DRAFT_VERSION = 1;
type LocalDraft = { version: number; title: string; body: string;
  type: PostType; matchId: string; selected: Channel[]; updatedAt: string };
function draftKey(clubId: string, userId: string) {
  return `rallora:social:v1:${clubId}:${userId}`;
}

function colour(value: string | null) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#00B0FE";
}
// Platform-specific caption rules live in lib/social/channels.ts,
 // where they are covered by lightweight Node tests.
function wrap(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line); line = word;
      } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export default function ClubSocialStudio() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [type, setType] = useState<PostType>("news");
  const [matchId, setMatchId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Channel[]>(["Facebook", "WhatsApp"]);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [graphicSize, setGraphicSize] = useState<GraphicSize>("square");
  const [draftReadyKey, setDraftReadyKey] = useState("");
  const [draftStatus, setDraftStatus] = useState("Drafts stay in this browser.");
  const activeKey = view.kind === "ready"
    ? draftKey(view.club.id, view.userId) : "";

  useEffect(() => {
    let active = true;
    setView({ kind: "loading" });
    async function load() {
      try {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          if (active) setView({ kind: "missing" }); return;
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError && authError.name !== "AuthSessionMissingError") throw authError;
        if (!user) { if (active) setView({ kind: "signed_out" }); return; }

        const { data: club, error: clubError } = await supabase.from("clubs")
          .select("id,slug,name,short_name,primary_color")
          .eq("slug", slug).eq("is_active", true).maybeSingle();
        if (clubError) throw clubError;
        if (!club) { if (active) setView({ kind: "missing" }); return; }
        const [member, platform] = await Promise.all([
          supabase.from("rallora_club_memberships").select("club_id,user_id,role,status")
            .eq("club_id", club.id).eq("user_id", user.id)
            .eq("status", "active").maybeSingle(),
          supabase.from("rallora_platform_admins").select("user_id")
            .eq("user_id", user.id).maybeSingle(),
        ]);
        if (member.error) throw member.error;
        if (platform.error) throw platform.error;
        const allowed = Boolean(platform.data?.user_id === user.id ||
          (member.data?.user_id === user.id && member.data.club_id === club.id &&
          member.data.status === "active" && CLUB_ROLE.includes(member.data.role)));
        if (!allowed) { if (active) setView({ kind: "forbidden" }); return; }

        // Preview reads only the club's published seasons and confirmed results.
        // No cross-club records, result mutations or post publishing.
        const seasonsReply = await supabase.from("seasons")
          .select("id,name,club_id,created_at").eq("club_id", club.id)
          .in("status", ["active", "completed"])
          .order("created_at", { ascending: false }).limit(2);
        if (seasonsReply.error) throw seasonsReply.error;
        const seasons = (seasonsReply.data ?? []) as (Season & { created_at: string })[];
        const seasonIds = seasons.map(s => s.id);
        let matches: Match[] = [];
        if (seasonIds.length) {
          const [fixturesReply, divisionsReply] = await Promise.all([
            supabase.from("fixtures")
              .select("id,season_id,division_id,home_team_id,away_team_id,week_number,play_by")
              .in("season_id", seasonIds)
              .or(`available_from.is.null,available_from.lte.${new Date().toISOString().slice(0,10)}`)
              .order("play_by", { ascending: false }).limit(400),
            supabase.from("divisions").select("id,name,season_id").in("season_id", seasonIds),
          ]);
          if (fixturesReply.error) throw fixturesReply.error;
          if (divisionsReply.error) throw divisionsReply.error;
          const fixtures = (fixturesReply.data ?? []) as Fixture[];
          const divisions = (divisionsReply.data ?? []) as Division[];
          const ids = fixtures.map(f => f.id);
          if (ids.length) {
            const [resultsReply, teamsReply] = await Promise.all([
              supabase.from("results")
                .select("fixture_id,home_score,away_score,status,confirmed_at")
                .in("fixture_id", ids).in("status", ["confirmed", "admin_override"]),
              divisions.length
                ? supabase.from("teams").select("id,name,division_id")
                  .in("division_id", divisions.map(d => d.id))
                : Promise.resolve({ data: [] as Team[], error: null }),
            ]);
            if (resultsReply.error) throw resultsReply.error;
            if (teamsReply.error) throw teamsReply.error;
            const names = new Map(((teamsReply.data ?? []) as Team[]).map(t => [t.id, t.name]));
            const divNames = new Map(divisions.map(d => [d.id, d.name]));
            const seasonNames = new Map(seasons.map(s => [s.id, s.name]));
            const results = new Map(((resultsReply.data ?? []) as Result[])
              .map(r => [r.fixture_id, r]));
            matches = fixtures.flatMap(f => {
              const r = results.get(f.id);
              if (!r || !names.has(f.home_team_id) || !names.has(f.away_team_id) ||
                  !divNames.has(f.division_id) || !seasonNames.has(f.season_id)) return [];
              return [{
                id: f.id, season: seasonNames.get(f.season_id)!,
                week: f.week_number, division: divNames.get(f.division_id)!,
                home: names.get(f.home_team_id)!, away: names.get(f.away_team_id)!,
                score: `${r.home_score ?? "–"} : ${r.away_score ?? "–"}`,
                confirmedAt: r.confirmed_at ?? f.play_by,
              }];
            }).sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
          }
        }
        if (active) setView({
          kind: "ready", club: club as Club, userId: user.id,
          role: member.data?.role && CLUB_ROLE.includes(member.data.role)
            ? member.data.role : "platform administrator",
          matches,
        });
      } catch (error) {
        if (active) setView({ kind: "error",
          message: error instanceof Error ? error.message : "Could not load Social Studio." });
      }
    }
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(); }, 0);
    });
    return () => { active = false; if (timer) clearTimeout(timer);
      subscription.subscription.unsubscribe(); };
  }, [slug, supabase]);

  // Browser-only drafts: club and verified Auth user scoped. Never sent to Supabase.
  // Delay autosave until restoration finishes to avoid overwriting an existing draft.
  useEffect(() => {
    setDraftReadyKey("");
    if (!activeKey) return;
    try {
      const raw = window.localStorage.getItem(activeKey);
      if (raw) {
        const saved = JSON.parse(raw) as LocalDraft;
        if (saved.version === DRAFT_VERSION &&
            typeof saved.title === "string" && typeof saved.body === "string" &&
            ["news", "result", "roundup"].includes(saved.type) &&
            Array.isArray(saved.selected)) {
          setTitle(saved.title.slice(0, 140));
          setBody(saved.body.slice(0, 3500));
          setType(saved.type);
          setMatchId(saved.matchId ?? "");
          setSelected(CHANNELS.filter(x => saved.selected.includes(x)));
          setDraftStatus("Restored this browser’s last draft.");
        }
      }
    } catch { setDraftStatus("Browser storage unavailable; drafts will not persist."); }
    setDraftReadyKey(activeKey);
  }, [activeKey]);

  useEffect(() => {
    if (!activeKey || draftReadyKey !== activeKey) return;
    const timer = window.setTimeout(() => {
      try {
        const saved: LocalDraft = {
          version: DRAFT_VERSION, title, body, type, matchId, selected,
          updatedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(activeKey, JSON.stringify(saved));
        setDraftStatus("Draft saved on this device only.");
      } catch {
        setDraftStatus("Could not save draft on this device.");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeKey, draftReadyKey, title, body, type, matchId, selected]);

  function clearDraft() {
    if (!activeKey) return;
    try { window.localStorage.removeItem(activeKey); }
    catch { setDraftStatus("Could not clear browser storage."); return; }
    setTitle(""); setBody(""); setType("news"); setMatchId("");
    setSelected(["Facebook", "WhatsApp"]);
    // An empty workspace is the new autosaved state. No club or league data changes.
    setDraftStatus("Workspace cleared on this device.");
    setFeedback("");
  }

  function applyTemplate(next: PostType, id?: string) {
    setType(next); setFeedback("");
    if (next === "news" || view.kind !== "ready") {
      setMatchId(""); setTitle(""); setBody(""); return;
    }
    const match = view.matches.find(m => m.id === id) ?? view.matches[0];
    if (!match) {
      setMatchId(""); setTitle(""); setBody(""); return;
    }
    setMatchId(match.id);
    if (next === "result") {
      setTitle(`${match.division} · Confirmed result`);
      setBody(`${match.home} ${match.score} ${match.away}\n${match.season} · Week ${match.week}\n\nSee the full league results on Rallora.`);
    } else {
      const week = view.matches.filter(m =>
        m.week === match.week && m.season === match.season);
      setTitle(`${match.season} · Week ${match.week} roundup`);
      const lines = week.map(m =>
        `${m.division}: ${m.home} ${m.score} ${m.away}`);
      const footer = "\n\nSee the latest standings on Rallora.";
      const max = 3500 - footer.length;
      let roundup = lines.join("\n");
      if (roundup.length > max) {
        const included: string[] = [];
        for (const line of lines) {
          if ((included.join("\n") + "\n" + line).length > max - 80) break;
          included.push(line);
        }
        roundup = included.join("\n") +
          "\n… Additional confirmed matches available in the club hub.";
      }
      setBody(roundup + footer);
    }
  }

  function changeChannel(channel: Channel) {
    setSelected(list => list.includes(channel)
      ? list.filter(item => item !== channel) : [...list, channel]);
  }
  const ready = view.kind === "ready" ? view : null;
  const clubUrl = ready && typeof window !== "undefined"
    ? `${window.location.origin}/clubs/${encodeURIComponent(ready.club.slug)}`
    : `/clubs/${encodeURIComponent(slug)}`;
  const valid = Boolean(title.trim() && body.trim() && selected.length);

  async function copy(channel: Channel) {
    if (!valid) return;
    try {
      await navigator.clipboard.writeText(formatSocialCaption(channel, title, body, clubUrl));
      setFeedback(`${channel} version copied. Paste it into your own account to publish.`);
    } catch {
      setFeedback("Copy was blocked. Select the preview text and copy it manually.");
    }
  }

  async function shareViaDevice() {
    if (!valid) return;
    if (!navigator.share) {
      await copy("WhatsApp");
      setFeedback("Your device has no share sheet. The WhatsApp version was copied.");
      return;
    }
    try {
      await navigator.share({
        title: title.trim(),
        text: shortenSocial(body.trim(), 1050),
        url: clubUrl,
      });
      setFeedback("Your device’s share sheet was opened. Rallora has not published this post.");
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setFeedback("Could not open sharing. Copy a channel version instead.");
      }
    }
  }

  async function downloadGraphic() {
    if (!ready || !valid || busy) return;
    setBusy(true); setFeedback("");
    try {
      const canvas = document.createElement("canvas");
      const { height } = GRAPHICS[graphicSize];
      canvas.width = 1080; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser cannot generate a graphic.");
      ctx.fillStyle = "#061A39"; ctx.fillRect(0, 0, 1080, height);
      ctx.fillStyle = colour(ready.club.primary_color);
      ctx.fillRect(0, 0, 1080, 20); ctx.fillRect(75, 137, 72, 7);
      ctx.fillStyle = "#a9c4df"; ctx.font = "700 25px Arial";
      ctx.fillText(ready.club.name.toUpperCase().slice(0, 45), 75, 110);
      ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 65px Arial";
      wrap(ctx, title.trim(), 925).slice(0, 3).forEach((line, n) =>
        ctx.fillText(line, 75, 230 + n * 81));
      const titleLines = Math.min(3, wrap(ctx, title.trim(), 925).length);
      ctx.fillStyle = "#d4e6f5"; ctx.font = "34px Arial";
      const paragraphLines = wrap(ctx, body.trim(), 915);
      const start = 265 + titleLines * 81;
      const room = Math.max(1, Math.floor((height - 255 - start) / 52));
      paragraphLines.slice(0, room).forEach((line, n) =>
        ctx.fillText(n === room - 1 && paragraphLines.length > room
          ? line.slice(0, 42) + "…" : line, 75, start + n * 52));
      ctx.fillStyle = "#00B0FE"; ctx.fillRect(75, height - 188, 930, 2);
      const logo = new Image();
      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = () => reject(new Error("Could not load Rallora artwork."));
        logo.src = "/brand/rallora-horizontal-dark.svg";
      });
      ctx.drawImage(logo, 75, height - 152, 290, 83);
      ctx.fillStyle = "#b9d3e9"; ctx.font = "24px Arial";
      ctx.textAlign = "right"; ctx.fillText("YOUR CLUB. YOUR GAME.", 1005, height - 105);
      const href = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = href; link.download = `rallora-${ready.club.slug}-${graphicSize}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      setFeedback("Graphic downloaded. Share it with your prepared caption.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not generate graphic.");
    } finally { setBusy(false); }
  }

  if (!ready) {
    const heading = view.kind === "loading" ? "Opening Rallora Social…" :
      view.kind === "signed_out" ? "Sign in to your club" :
      view.kind === "forbidden" ? "Club access required" :
      view.kind === "missing" ? "Club unavailable" : "Social Studio unavailable";
    return <main className={styles.page}><section className={styles.empty}>
      <RalloraLogo width={200} /><h1>{heading}</h1>
      <p>{view.kind === "signed_out"
        ? "Sign in through your club administration page, then return here."
        : view.kind === "forbidden"
          ? "Only a verified club owner, admin, organiser or Rallora platform administrator can use this studio."
          : view.kind === "error" ? view.message
          : view.kind === "loading" ? "Checking your club permissions and confirmed scores…"
          : "We could not find an active club at this address."}</p>
      <Link href={`/clubs/${encodeURIComponent(slug)}/admin`}>Club administration →</Link>
      <Link href="/social">About Rallora Social →</Link>
    </section></main>;
  }
  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.header}><Link href="/" aria-label="Rallora home">
      <RalloraLogo width={190} /></Link><nav aria-label="Social navigation">
      <Link href={`/clubs/${encodeURIComponent(slug)}/admin`}>Club dashboard</Link>
      <Link href="/social">About Social</Link></nav></header>
    <section className={styles.hero}><span className={styles.eyebrow}>RALLORA SOCIAL · CONTENT STUDIO</span>
      <h1>Your club. Your story.</h1>
      <p>Build once, preview each channel and share with your community.
        You are creating content for <strong>{ready.club.name}</strong> as {ready.role}.</p>
      <span className={styles.phase}>FIRST RELEASE · MANUAL SHARING ONLY</span>
    </section>
    <div className={styles.grid}>
      <section className={styles.editor} aria-labelledby="compose-title">
        <span className={styles.step}>01 / CREATE</span>
        <h2 id="compose-title">Create a post</h2>
        <div className={styles.types} role="group" aria-label="Post type">
          <button type="button" aria-pressed={type === "news"} onClick={() => applyTemplate("news")}>Club news</button>
          <button type="button" aria-pressed={type === "result"} onClick={() => applyTemplate("result")}>Confirmed result</button>
          <button type="button" aria-pressed={type === "roundup"} onClick={() => applyTemplate("roundup")}>Weekly roundup</button>
        </div>
        {type !== "news" && <label className={styles.field}>Use a confirmed league result
          <select value={matchId} onChange={event => applyTemplate(type, event.target.value)}
            disabled={!ready.matches.length}>
            {!ready.matches.length && <option value="">No confirmed results available</option>}
            {ready.matches.map(match => <option value={match.id} key={match.id}>
              {match.season} · {match.division} · {match.home} vs {match.away}
            </option>)}
          </select>
          <span>Only confirmed scores from this club’s two latest published seasons appear.</span>
        </label>}
        <label className={styles.field}>Post headline
          <input value={title} maxLength={140} onChange={event => setTitle(event.target.value)}
            placeholder="What would you like to share?" />
        </label>
        <label className={styles.field}>Post message
          <textarea value={body} maxLength={3500}
            onChange={event => setBody(event.target.value)} rows={8}
            placeholder="Tell your club what’s happening…" />
        </label>
        <div className={styles.draftControls} role="status">
          <span>{draftStatus} Do not use shared devices for private club news.</span>
          <button type="button" onClick={clearDraft}>Clear local draft</button>
        </div>
        <span className={styles.step}>02 / CHOOSE DESTINATIONS</span>
        <div className={styles.channels} role="group" aria-label="Share destinations">
          {CHANNELS.map(channel => <label className={styles.channel} key={channel}>
            <input type="checkbox" checked={selected.includes(channel)}
              onChange={() => changeChannel(channel)} />{channel}
          </label>)}
        </div>
        <p className={styles.disclaimer}>A draft generated from a result does not
          automatically change if that result is corrected later. Re-select the
          fixture before sharing. These are manual sharing destinations.
          Accounts are not connected and this page does not send, schedule or publish
          messages on your behalf. Check that player names may be published,
          particularly for junior competitions. Website publishing will require
          approved club writes.</p>
      </section>
      <section className={styles.preview} aria-labelledby="preview-title">
        <span className={styles.step}>03 / PREVIEW & SHARE</span>
        <h2 id="preview-title">Ready for your channels</h2>
        {!valid && <p className={styles.notice}>Enter a headline and message, then select at least one destination.</p>}
        {valid && <>
          <div className={styles.graphicPreview}
            style={{ borderTopColor:colour(ready.club.primary_color),
              aspectRatio: `1080 / ${GRAPHICS[graphicSize].height}` }}>
            <span>{ready.club.name.toUpperCase()}</span><h3>{title}</h3>
            <p>{body.length > (graphicSize === "square" ? 260 : graphicSize === "portrait" ? 400 : 640)
              ? body.slice(0, graphicSize === "square" ? 260 : graphicSize === "portrait" ? 400 : 640) + "…"
              : body}</p>
            <RalloraLogo variant="dark" width={154} />
          </div>
          <label className={styles.field}>Graphic layout
            <select value={graphicSize}
              onChange={event => setGraphicSize(event.target.value as GraphicSize)}>
              {(Object.keys(GRAPHICS) as GraphicSize[]).map(size =>
                <option key={size} value={size}>{GRAPHICS[size].label}</option>)}
            </select>
          </label>
          <button type="button" className={styles.download}
            disabled={busy} onClick={() => { void downloadGraphic(); }}>
            {busy ? "Preparing graphic…" : "Download branded post graphic ↓"}
          </button>
          <button type="button" className={styles.deviceShare}
            onClick={() => { void shareViaDevice(); }}>
            Share message using my device ↗
          </button>
          {selected.map(channel => <article className={styles.channelPreview} key={channel}>
            <div className={styles.channelTop}><strong>{channel}</strong>
              <span>PREPARED · NOT PUBLISHED</span></div>
            <pre>{formatSocialCaption(channel, title, body, clubUrl)}</pre>
            <button type="button" onClick={() => { void copy(channel); }}>Copy {channel} version</button>
            {channel === "WhatsApp" && <a target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(formatSocialCaption(channel,title,body,clubUrl))}`}>
              Open WhatsApp share ↗</a>}
          </article>)}
        </>}
        {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
      </section>
    </div>
    <footer className={styles.footer}>Rallora Social · Create once. Share everywhere.
      <span>No live social integrations, club database writes or AI charges enabled.</span>
    </footer>
  </div></main>;
}

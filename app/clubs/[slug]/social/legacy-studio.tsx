"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import RalloraFooter from "@/app/components/rallora-footer";
import RalloraLogo from "@/app/components/rallora-logo";
import { createClient } from "@/lib/supabase";
import styles from "./social.module.css";
import { ARTWORK_SIZES, createArtwork, preparePost, resultFingerprint, roundMatches, type StudioMatch, type ArtworkStyle } from "@/lib/social/studio";
import { scoreSets } from "@/lib/leagues/scores";
import { downloadArtwork, loadArtworkLogo } from "@/lib/social/browser";
import {
  SOCIAL_CHANNELS, formatSocialCaption, shortenSocial,
  type SocialChannel,
} from "@/lib/social/channels";

type Club = { id: string; slug: string; name: string; short_name: string | null;
  primary_color: string | null };
type Season = { id: string; name: string; club_id: string };
type Fixture = { id: string; season_id: string; division_id: string;
  home_team_id: string; away_team_id: string; week_number: number; play_by: string; home_player_names: (string|null)[] | null; away_player_names: (string|null)[] | null };
type Result = { fixture_id: string; home_score: string | null;
  away_score: string | null; status: string; confirmed_at: string | null };
type Team = { id: string; name: string; division_id: string; player_one_name: string | null; player_two_name: string | null };
type Division = { id: string; name: string; season_id: string };
type Match = StudioMatch;
type Ready = { kind: "ready"; club: Club; userId: string; role: string; matches: Match[] };
type View = Ready | { kind: "loading" | "signed_out" | "forbidden" | "missing" } |
  { kind: "error"; message: string };
type PostType = "news" | "result" | "roundup";
type Channel = SocialChannel;
const CHANNELS = SOCIAL_CHANNELS;
const CLUB_ROLE = ["owner", "admin", "organiser"];
type GraphicSize = "square" | "portrait" | "story";
const GRAPHICS = ARTWORK_SIZES;
const DRAFT_VERSION = 2;
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
type LocalDraft = { version: number; title: string; body: string;
  type: PostType; matchId: string; selected: Channel[]; updatedAt: string;
  source: string; size: GraphicSize; style: ArtworkStyle };
function draftKey(clubId: string, userId: string) {
  return `rallora:social:v1:${clubId}:${userId}`;
}

function colour(value: string | null) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#00B0FE";
}
// Platform-specific caption rules live in lib/social/channels.ts,
 // where they are covered by lightweight Node tests.
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
  const [seasonFilter, setSeasonFilter] = useState("");
  const [search, setSearch] = useState("");
  const [artStyle, setArtStyle] = useState<ArtworkStyle>("court");
  const [sourceFingerprint, setSourceFingerprint] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [logoData, setLogoData] = useState("");
  const [artError, setArtError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [graphicSize, setGraphicSize] = useState<GraphicSize>("square");
  const [draftReadyKey, setDraftReadyKey] = useState("");
  const [draftStatus, setDraftStatus] = useState("Drafts stay in this browser for seven days.");
  const activeKey = view.kind === "ready"
    ? draftKey(view.club.id, view.userId) : "";

  useEffect(() => {
    let active = true;
    setView({ kind: "loading" });
    async function load() {
      if (active) setView({ kind: "loading" });
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
              .select("id,season_id,division_id,home_team_id,away_team_id,week_number,play_by,home_player_names,away_player_names")
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
                ? supabase.from("teams").select("id,name,division_id,player_one_name,player_two_name")
                  .in("division_id", divisions.map(d => d.id))
                : Promise.resolve({ data: [] as Team[], error: null }),
            ]);
            if (resultsReply.error) throw resultsReply.error;
            if (teamsReply.error) throw teamsReply.error;
            const names = new Map(((teamsReply.data ?? []) as Team[]).map(t => [t.id, [t.player_one_name,t.player_two_name].filter(Boolean).join(" / ") || t.name]));
            const divNames = new Map(divisions.map(d => [d.id, d.name]));
            const seasonNames = new Map(seasons.map(s => [s.id, s.name]));
            const results = new Map(((resultsReply.data ?? []) as Result[])
              .map(r => [r.fixture_id, r]));
            matches = fixtures.flatMap(f => {
              const r = results.get(f.id);
              if (!r || !names.has(f.home_team_id) || !names.has(f.away_team_id) ||
                  !divNames.has(f.division_id) || !seasonNames.has(f.season_id)) return [];
              return [{
                id: f.id, seasonId: f.season_id,
                season: seasonNames.get(f.season_id)!,
                week: f.week_number, division: divNames.get(f.division_id)!,
                home: f.home_player_names?.filter(Boolean).join(" / ") || names.get(f.home_team_id)!, away: f.away_player_names?.filter(Boolean).join(" / ") || names.get(f.away_team_id)!,
                score: `${scoreSets(r.home_score).join(" / ") || "–"} : ${scoreSets(r.away_score).join(" / ") || "–"}`,
                homeScore: scoreSets(r.home_score).join("  ") || "–",
                awayScore: scoreSets(r.away_score).join("  ") || "–",
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
    setTitle(""); setBody(""); setType("news"); setMatchId("");
    setSelected(["Facebook", "WhatsApp"]); setSourceFingerprint(""); setReviewed(false);
    setGraphicSize("square"); setArtStyle("court"); setFeedback("");
    try {
      const raw = window.localStorage.getItem(activeKey);
      if (raw) {
        const saved = JSON.parse(raw) as LocalDraft;
        const age = Date.now() - Date.parse(saved.updatedAt);
        if (!Number.isFinite(age) || age < 0 || age > DRAFT_MAX_AGE) {
          window.localStorage.removeItem(activeKey);
          setDraftStatus("The previous draft expired after seven days.");
        } else if (saved.version === DRAFT_VERSION &&
            typeof saved.title === "string" && typeof saved.body === "string" &&
            ["news", "result", "roundup"].includes(saved.type) &&
            Array.isArray(saved.selected)) {
          setTitle(saved.title.slice(0, 140));
          setBody(saved.body.slice(0, 3500));
          setType(saved.type);
          setSourceFingerprint(typeof saved.source === "string" ? saved.source : "");
          if (["square", "portrait", "story"].includes(saved.size)) setGraphicSize(saved.size);
          if (["court", "editorial", "minimal"].includes(saved.style)) setArtStyle(saved.style);
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
          updatedAt: new Date().toISOString(), source: sourceFingerprint,
          size: graphicSize, style: artStyle,
        };
        window.localStorage.setItem(activeKey, JSON.stringify(saved));
        setDraftStatus("Draft saved on this device only.");
      } catch {
        setDraftStatus("Could not save draft on this device.");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeKey, draftReadyKey, title, body, type, matchId, selected, sourceFingerprint, graphicSize, artStyle]);

  function clearDraft() {
    if (!activeKey) return;
    try { window.localStorage.removeItem(activeKey); }
    catch { setDraftStatus("Could not clear browser storage."); return; }
    setTitle(""); setBody(""); setType("news"); setMatchId("");
    setSelected(["Facebook", "WhatsApp"]);
    // An empty workspace is the new autosaved state. No club or league data changes.
    setDraftStatus("Workspace cleared on this device.");
    setFeedback(""); setSourceFingerprint(""); setReviewed(false);
  }

  function applyTemplate(next: PostType, id?: string) {
    setType(next); setFeedback("");
    if (next === "news" || view.kind !== "ready") {
      setMatchId(""); setTitle(""); setBody(""); setSourceFingerprint(""); setReviewed(false); return;
    }
    const match = view.matches.find(m => m.id === id) ?? view.matches.find(m => !seasonFilter || m.seasonId === seasonFilter);
    if (!match) {
      setMatchId(""); setTitle(""); setBody(""); setSourceFingerprint(""); setReviewed(false); return;
    }
    setMatchId(match.id);
    const post = preparePost(next, view.matches, match);
    setTitle(post.title.slice(0,140)); setBody(post.body);
    setSourceFingerprint(resultFingerprint(next === "result" ? [match] : roundMatches(view.matches, match)));
    setReviewed(false);
  }

  function changeChannel(channel: Channel) {
    setSelected(list => list.includes(channel)
      ? list.filter(item => item !== channel) : [...list, channel]);
  }
  const ready = view.kind === "ready" ? view : null;
  const clubPath = ready?.club.slug === "gsm-padel"
    ? "/clubs/gsm-padel/overview"
    : `/clubs/${encodeURIComponent(ready?.club.slug ?? slug)}`;
  const postSeasonId = ready?.matches.find(match => match.id === matchId)?.seasonId;
  const resultsView = type !== "news" && postSeasonId
    ? `?view=results&season=${encodeURIComponent(postSeasonId)}` : "";
  const clubUrl = (typeof window !== "undefined" ? window.location.origin : "") +
    clubPath + resultsView;
  const anchor = ready?.matches.find(m => m.id === matchId);
  const sourceMatches = ready && anchor && type !== "news"
    ? type === "result" ? [anchor] : roundMatches(ready.matches, anchor) : [];
  const sourceStale = type !== "news" && (!sourceMatches.length || sourceFingerprint !== resultFingerprint(sourceMatches));
  const valid = Boolean(title.trim() && body.trim() && selected.length && !sourceStale);
  const exportReady = valid && reviewed;
  const visibleMatches = ready?.matches.filter(m => (!seasonFilter || m.seasonId === seasonFilter) &&
    `${m.home} ${m.away} ${m.division} ${m.week}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const seasons = [...new Map(ready?.matches.map(m => [m.seasonId, m.season]) ?? []).entries()];
  const artwork = createArtwork({ club: ready?.club.name ?? "", accent: colour(ready?.club.primary_color ?? null),
    title, body, size: graphicSize, style: artStyle, matches: sourceMatches, logoData });
  const artworkUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(artwork.svg)}`;

  useEffect(() => { setReviewed(false); }, [title, body, type, matchId, graphicSize, artStyle, selected, sourceFingerprint]);
  useEffect(() => {
    let cancelled = false;
    loadArtworkLogo().then(data=>{if(!cancelled){setLogoData(data);setArtError("");}})
      .catch(()=>{if(!cancelled)setArtError("Rallora artwork could not load. Refresh before downloading.");});
    return () => { cancelled=true; };
  }, []);

  async function checkSource() {
    if (!exportReady || !ready) return false;
    if (type === "news") return true;
    // Re-read approved source scores before every handoff; no privileged keys.
    try {
      const ids=sourceMatches.map(m=>m.id);
      const [reply,fixtures,seasons]=await Promise.all([
        supabase.from("results").select("fixture_id,home_score,away_score,status")
          .in("fixture_id",ids).in("status",["confirmed","admin_override"]),
        supabase.from("fixtures").select("id,season_id,status,available_from,home_player_names,away_player_names")
          .in("id",ids).or(`available_from.is.null,available_from.lte.${new Date().toISOString().slice(0,10)}`),
        supabase.from("seasons").select("id").eq("club_id",ready.club.id)
          .in("id",[...new Set(sourceMatches.map(m=>m.seasonId))]).in("status",["active","completed"]),
      ]);
      if (reply.error || fixtures.error || seasons.error) throw new Error("Could not verify current results. Try again before sharing.");
      const current = new Map((reply.data ?? []).map(r=>[r.fixture_id,r]));
      const currentFixtures = new Map((fixtures.data ?? []).map(f=>[f.id,f]));
      const published = new Set((seasons.data??[]).map(s=>s.id));
      const unchanged = sourceMatches.every(m=>{
        const r=current.get(m.id), f=currentFixtures.get(m.id);
        const home=f?.home_player_names?.filter(Boolean).join(" / ");
        const away=f?.away_player_names?.filter(Boolean).join(" / ");
        return r && f && f.status!=="cancelled" && f.season_id===m.seasonId && published.has(m.seasonId) &&
          (!home || home===m.home) && (!away || away===m.away) &&
          (scoreSets(r.home_score).join("  ") || "–")===m.homeScore &&
          (scoreSets(r.away_score).join("  ") || "–")===m.awayScore;
      });
      if (!unchanged) throw new Error("A source result changed or is no longer published and confirmed. Refresh the studio and rebuild this draft before sharing.");
    } catch(error) { setReviewed(false); setFeedback(error instanceof Error?error.message:"Could not verify current results.");return false; }

    return true;
  }

  async function copy(channel: Channel) {
    if (!(await checkSource())) return false;
    try {
      await navigator.clipboard.writeText(formatSocialCaption(channel, title, body, clubUrl));
      setFeedback(`${channel} version copied. Paste it into your own account to publish.`); return true;
    } catch {
      setFeedback("Copy was blocked. Select the preview text and copy it manually."); return false;
    }
  }

  async function shareViaDevice() {
    if (!(await checkSource())) return;
    if (!navigator.share) {
      if (await copy("WhatsApp")) setFeedback("Your device has no share sheet. The WhatsApp version was copied.");
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
    if (!ready || busy || !logoData || artError || !(await checkSource())) return;
    setBusy(true); setFeedback("");
    try {
      await downloadArtwork(artwork.svg,GRAPHICS[graphicSize].height,`rallora-${ready.club.slug}-${type}-${graphicSize}.png`);
      setFeedback("Graphic downloaded. Copy the caption to share alongside it.");
    } catch(error) { setFeedback(error instanceof Error?error.message:"Could not generate graphic."); }
    finally {setBusy(false);}
  }

  async function downloadCaptions() {
    if (!(await checkSource())) return;
    const text=selected.map(channel=>`--- ${channel} ---\n${formatSocialCaption(channel,title,body,clubUrl)}`).join("\n\n");
    const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
    const link=document.createElement("a"); link.href=url; link.download=`rallora-${slug}-captions.txt`;
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    setFeedback("Selected captions downloaded.");
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
      <span className={styles.phase}>CREATE · REVIEW · EXPORT</span>
    </section>
    <details className={styles.connectionHelp}>
      <summary><span>CONNECTED ACCOUNTS</span>
        <strong>Manual sharing is ready. Automatic publishing setup comes next.</strong>
        <span>Check platform requirements ▾</span></summary>
      <div className={styles.connectionGrid}>
        <div><strong>Facebook Page</strong><p>Use the official Meta connection when the
          Rallora app and publishing permissions are approved. Club passwords are never needed.</p></div>
        <div><strong>Instagram</strong><p>Use an eligible professional account. Our planned
          combined Facebook Login flow also requires a linked Facebook Page.</p></div>
        <div><strong>WhatsApp group / Status</strong><p>Use the share button yourself.
          Group and Status auto-posting is not offered by our planned Business API integration.</p></div>
        <div><strong>WhatsApp Business / Email</strong><p>Opted-in individual recipients,
          applicable approved templates, unsubscribe controls and cost approval come first.</p></div>
      </div>
    </details>
    <div className={styles.grid}>
      <section className={styles.editor} aria-labelledby="compose-title">
        <span className={styles.step}>01 / CREATE</span>
        <h2 id="compose-title">Create a post</h2>
        <div className={styles.types} role="group" aria-label="Post type">
          <button type="button" aria-pressed={type === "news"} onClick={() => applyTemplate("news")}>Club news</button>
          <button type="button" aria-pressed={type === "result"} onClick={() => applyTemplate("result")}>Confirmed result</button>
          <button type="button" aria-pressed={type === "roundup"} onClick={() => applyTemplate("roundup")}>Weekly roundup</button>
        </div>
        {type !== "news" && <div className={styles.sourceTools}>
          <label className={styles.field}>League
            <select value={seasonFilter} onChange={event=>{setSeasonFilter(event.target.value);setSearch("");}}>
              <option value="">All loaded leagues</option>{seasons.map(([id,name])=><option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className={styles.field}>Find a result<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Player, division or round" /></label>
        </div>}
        {type !== "news" && <label className={styles.field}>Use a confirmed league result
          <select value={matchId} onChange={event => applyTemplate(type, event.target.value)}
            disabled={!visibleMatches.length}>
            <option value="">{visibleMatches.length ? "Choose a confirmed result" : "No matching confirmed results"}</option>
            {visibleMatches.map(match => <option value={match.id} key={match.id}>
              {match.season} · {match.division} · {match.home} vs {match.away}
            </option>)}
          </select>
          <span>Only confirmed scores from up to 400 released fixtures in this club’s two latest published seasons appear. Roundups include all loaded divisions for the selected league and round.</span>
        </label>}
        {sourceStale && <p className={styles.notice} role="alert">This draft’s source is missing or has changed. Select a current result to rebuild it.</p>}
        {sourceMatches.length>0 && <div className={styles.sourceSummary}><strong>{type === "result" ? "1 confirmed result" : `${sourceMatches.length} confirmed results`}</strong><span>{anchor?.season} · Round {anchor?.week}</span></div>}
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
          <span>{draftStatus} Drafts expire after seven days. Avoid shared devices.</span>
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
          <div className={styles.artControls} role="group" aria-label="Artwork style">
            <button type="button" aria-pressed={artStyle==="court"} onClick={()=>setArtStyle("court")}>Night court</button>
            <button type="button" aria-pressed={artStyle==="editorial"} onClick={()=>setArtStyle("editorial")}>Club editorial</button>
            <button type="button" aria-pressed={artStyle==="minimal"} onClick={()=>setArtStyle("minimal")}>Clean line</button>
          </div>
          {/* Self-contained generated artwork: the PNG uses this exact SVG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.artwork} src={artworkUrl} alt={`Preview: ${title}`} width={1080} height={GRAPHICS[graphicSize].height}/>
          {sourceMatches.length>0 && <p className={styles.previewHint}>The graphic uses verified score rows. Your edited message appears in the channel captions below.</p>}
          {artwork.omitted>0 && <p className={styles.notice}>Some content is shortened in this layout. Check the preview; choose a taller size or include the full caption.</p>}
          {artError && <p className={styles.notice} role="alert">{artError}</p>}
          <label className={styles.field}>Graphic layout
            <select value={graphicSize}
              onChange={event => setGraphicSize(event.target.value as GraphicSize)}>
              {(Object.keys(GRAPHICS) as GraphicSize[]).map(size =>
                <option key={size} value={size}>{GRAPHICS[size].label}</option>)}
            </select>
          </label>
          <label className={styles.reviewCheck}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>I’ve checked the artwork, captions and permission to share the named players.</span></label>
          <button type="button" className={styles.download}
            disabled={busy || !exportReady || !logoData || Boolean(artError)} onClick={() => { void downloadGraphic(); }}>
            {busy ? "Preparing graphic…" : "Download branded post graphic ↓"}
          </button>
          <button type="button" className={styles.deviceShare}
            disabled={!exportReady} onClick={() => { void shareViaDevice(); }}>
            Share message using my device ↗
          </button>
          <button type="button" className={styles.deviceShare} disabled={!exportReady} onClick={()=>{void downloadCaptions();}}>Download selected captions ↓</button>
          {selected.map(channel => <article className={styles.channelPreview} key={channel}>
            <div className={styles.channelTop}><strong>{channel}</strong>
              <span>PREPARED · NOT PUBLISHED</span></div>
            <pre>{formatSocialCaption(channel, title, body, clubUrl)}</pre>
            <button type="button" disabled={!exportReady} onClick={() => { void copy(channel); }}>Copy {channel} version</button>
            {channel === "WhatsApp" && <button type="button" disabled={!exportReady} onClick={async()=>{
              // Open synchronously to retain the browser gesture; close if validation fails.
              const popup=window.open("about:blank","_blank"); if(popup) popup.opener=null;
              if(await checkSource()) { if(popup) popup.location.href=`https://wa.me/?text=${encodeURIComponent(formatSocialCaption(channel,title,body,clubUrl))}`;
                else setFeedback("Your browser blocked WhatsApp. Copy the caption instead."); }
              else popup?.close();
            }}>Open WhatsApp share ↗</button>}
          </article>)}
        </>}
        {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
      </section>
    </div>
    <RalloraFooter club={slug} note="Connected publishing is not enabled. Download and share approved content manually." />
  </div></main>;
}

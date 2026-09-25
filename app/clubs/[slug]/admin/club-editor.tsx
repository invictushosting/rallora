"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import styles from "./editor.module.css";

export type EditableClub = {
  id: string; slug: string; name: string;
  short_name: string | null; primary_color: string | null;
  welcome_text: string | null; logo_url:string|null; cover_image_url:string|null; website_url:string|null;
  contact_email:string|null; venue_name:string|null; address_line_1:string|null;
  town:string|null; postcode:string|null; player_registration_terms:string|null;
};
export type EditableDivision = {
  id: string; name: string; sort_order: number;
  teams: { id: string; name: string }[];
};
type EditableFixture = { id:string; season_id:string; division_id:string; home_team_id:string; away_team_id:string; week_number:number; play_by:string; status:string; home_score?:string|null; away_score?:string|null; winner_team_id?:string|null };
export type EditableSeason = {
  id: string; club_id: string; name: string; status: string;
  divisions: EditableDivision[];
};

type Props = {
  club: EditableClub;
  seasons: EditableSeason[];
  onSaved: () => void;
  fixtures?: EditableFixture[];
};

type ImageKind = "logo" | "cover";

async function optimiseClubImage(file: File, kind: ImageKind): Promise<Blob> {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP image.");
  }
  if (file.size > 15 * 1024 * 1024) throw new Error("Choose an image smaller than 15 MB.");

  const bitmap = await createImageBitmap(file);
  const targetWidth = kind === "logo" ? 800 : 1600;
  const targetHeight = kind === "logo" ? 800 : 900;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Your browser could not prepare this image.");
  }

  if (kind === "logo") {
    const scale = Math.min(targetWidth / bitmap.width, targetHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    ctx.drawImage(bitmap, Math.round((targetWidth - width) / 2), Math.round((targetHeight - height) / 2), width, height);
  } else {
    const scale = Math.max(targetWidth / bitmap.width, targetHeight / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    ctx.drawImage(bitmap, (targetWidth - width) / 2, (targetHeight - height) / 2, width, height);
  }
  bitmap.close();

  const quality = kind === "logo" ? 0.9 : 0.86;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("Rallora could not resize this image.");
  return blob;
}

export default function ClubEditor({ club, seasons, onSaved, fixtures = [] }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"branding" | "seasons" | "teams" | "fixtures">("branding");

  useEffect(() => {
    const requested = searchParams.get("setup");
    if (requested === "branding" || requested === "seasons" || requested === "teams" || requested === "fixtures") {
      setActiveTab(requested);
      requestAnimationFrame(() => document.getElementById("club-management")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [searchParams]);
  const [name, setName] = useState(club.name);
  const [shortName, setShortName] = useState(club.short_name ?? "");
  const [colour, setColour] = useState(club.primary_color || "#2458ff");
  const [welcomeText, setWelcomeText] = useState(club.welcome_text ?? "");
  const [logoUrl,setLogoUrl]=useState(club.logo_url??"");
  const [coverImageUrl,setCoverImageUrl]=useState(club.cover_image_url??"");
  const [websiteUrl,setWebsiteUrl]=useState(club.website_url??"");
  const [contactEmail,setContactEmail]=useState(club.contact_email??"");
  const [venueName,setVenueName]=useState(club.venue_name??"");
  const [address,setAddress]=useState(club.address_line_1??"");
  const [town,setTown]=useState(club.town??"");
  const [postcode,setPostcode]=useState(club.postcode??"");
  const [registrationTerms,setRegistrationTerms]=useState(club.player_registration_terms??"");
  const [newSeason, setNewSeason] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [divisionSeasonId, setDivisionSeasonId] = useState(seasons[0]?.id ?? "");
  const [teamDivisionId, setTeamDivisionId] = useState(seasons[0]?.divisions[0]?.id ?? "");
  const [teamName, setTeamName] = useState("");
  const [playerOne, setPlayerOne] = useState("");
  const [playerTwo, setPlayerTwo] = useState("");
  const [fixtureDivisionId, setFixtureDivisionId] = useState(seasons[0]?.divisions[0]?.id ?? "");
  const [fixtureHome, setFixtureHome] = useState("");
  const [fixtureAway, setFixtureAway] = useState("");
  const [fixtureWeek, setFixtureWeek] = useState("1");
  const [fixtureDeadline, setFixtureDeadline] = useState("");
  const [fixturePublish, setFixturePublish] = useState(new Date().toISOString().slice(0, 10));
  const [recoveryFixture, setRecoveryFixture] = useState("");
  const [recoveryHome, setRecoveryHome] = useState("");
  const [recoveryAway, setRecoveryAway] = useState("");
  const [recoveryWinner, setRecoveryWinner] = useState("");
  const [recoveryNotes, setRecoveryNotes] = useState("");
  const [manageFixture, setManageFixture] = useState("");
  const [manageWeek, setManageWeek] = useState("1");
  const [manageDeadline, setManageDeadline] = useState("");
  const [managePublish, setManagePublish] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState<ImageKind | "">("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const divisions = seasons.flatMap((season) =>
    season.divisions.map((division) => ({ ...division, season_id: season.id,
      season_name: season.name })));
  const selectedDivision = divisions.find((division) => division.id === fixtureDivisionId);
  const recoveryOptions = fixtures.filter((fixture)=>!fixtureDivisionId || fixture.division_id===fixtureDivisionId);
  const eligibleTeams = selectedDivision?.teams ?? [];
  const selectedManagedFixture = fixtures.find((fixture)=>fixture.id===manageFixture);
  const managedDivision = selectedManagedFixture ? divisions.find((division)=>division.id===selectedManagedFixture.division_id) : undefined;
  const managedHome = managedDivision?.teams.find((team)=>team.id===selectedManagedFixture?.home_team_id)?.name ?? "Home";
  const managedAway = managedDivision?.teams.find((team)=>team.id===selectedManagedFixture?.away_team_id)?.name ?? "Away";
  const managedLocked = selectedManagedFixture?.status==="confirmed" || selectedManagedFixture?.status==="cancelled";

  useEffect(() => {
    if (!seasons.some((season) => season.id === divisionSeasonId)) {
      setDivisionSeasonId(seasons[0]?.id ?? "");
    }
    if (!divisions.some((division) => division.id === teamDivisionId)) {
      setTeamDivisionId(divisions[0]?.id ?? "");
    }
    if (!divisions.some((division) => division.id === fixtureDivisionId)) {
      setFixtureDivisionId(divisions[0]?.id ?? "");
      setFixtureHome("");
      setFixtureAway("");
    }
  }, [seasons, divisionSeasonId, teamDivisionId, fixtureDivisionId, divisions]);

  useEffect(() => {
    setName(club.name);
    setShortName(club.short_name ?? "");
    setColour(club.primary_color || "#2458ff");
    setWelcomeText(club.welcome_text ?? "");
    setLogoUrl(club.logo_url??"");setCoverImageUrl(club.cover_image_url??"");setWebsiteUrl(club.website_url??"");setContactEmail(club.contact_email??"");
    setVenueName(club.venue_name??"");setAddress(club.address_line_1??"");setTown(club.town??"");
    setPostcode(club.postcode??"");setRegistrationTerms(club.player_registration_terms??"");
  }, [club]);

  async function submit(action: () => Promise<void>, success: string) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sign in again to edit this club.");
      const [{ data: member, error: memberError }, { data: platform, error: platformError }] =
        await Promise.all([
          supabase.from("rallora_club_memberships").select("role,status")
            .eq("club_id", club.id).eq("user_id", user.id).eq("status", "active")
            .maybeSingle(),
          supabase.from("rallora_platform_admins").select("user_id")
            .eq("user_id", user.id).maybeSingle(),
        ]);
      if (memberError) throw memberError;
      if (platformError) throw platformError;
      if (!platform && !["owner", "admin", "organiser"].includes(member?.role ?? "")) {
        throw new Error("Your account cannot edit this club.");
      }
      await action();
      setMessage(success);
      onSaved();
      window.dispatchEvent(new Event("rallora:action-complete"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadClubImage(file: File | undefined, kind: ImageKind) {
    if (!file) return;
    setError("");
    setMessage("");
    setUploadBusy(kind);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sign in again before uploading images.");

      const optimised = await optimiseClubImage(file, kind);
      const path = `${club.id}/${kind}.webp`;
      const { error: uploadError } = await supabase.storage.from("club-media").upload(path, optimised, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("club-media").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
      if (kind === "logo") setLogoUrl(publicUrl);
      else setCoverImageUrl(publicUrl);
      setMessage(kind === "logo"
        ? "Logo uploaded and resized to 800 × 800. Save branding to apply it."
        : "Cover uploaded and resized to 1600 × 900. Save branding to apply it.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Image upload failed.");
    } finally {
      setUploadBusy("");
      if (kind === "logo" && logoInputRef.current) logoInputRef.current.value = "";
      if (kind === "cover" && coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function saveBranding(event: React.FormEvent) {
    event.preventDefault();
    await submit(async () => {
      if (!name.trim() || name.trim().length > 100)
        throw new Error("Club name must be 1–100 characters.");
      if (!/^#[\da-fA-F]{6}$/.test(colour)) throw new Error("Choose a valid colour.");
      if (welcomeText.length > 1000) throw new Error("Introduction is too long.");
      if(registrationTerms.length>3000) throw new Error("Player terms are too long.");
      const { data, error: mutationError } = await supabase.from("clubs")
        .update({
          name: name.trim(), short_name: shortName.trim() || null,
          primary_color: colour, welcome_text: welcomeText.trim() || null,
          logo_url:logoUrl.trim()||null,cover_image_url:coverImageUrl.trim()||null,website_url:websiteUrl.trim()||null,
          contact_email:contactEmail.trim()||null,venue_name:venueName.trim()||null,
          address_line_1:address.trim()||null,town:town.trim()||null,postcode:postcode.trim()||null,
          player_registration_terms:registrationTerms.trim()||null,
        }).eq("id", club.id).eq("slug", club.slug).select("id");
      if (mutationError) throw mutationError;
      if (data?.length !== 1) throw new Error("No club was updated. Check permissions.");
    }, "Club branding saved.");
  }

  async function createSeason(event: React.FormEvent) {
    event.preventDefault();
    await submit(async () => {
      const title = newSeason.trim();
      if (!title || title.length > 100) throw new Error("Season name must be 1–100 characters.");
      const { error: mutationError } = await supabase.from("seasons").insert({
        club_id: club.id, name: title, status: "draft",
      });
      if (mutationError) throw mutationError;
      setNewSeason("");
    }, "Draft season created. It will not be public until activated.");
  }

  async function createDivision(event: React.FormEvent) {
    event.preventDefault();
    await submit(async () => {
      const season = seasons.find((item) => item.id === divisionSeasonId &&
        item.club_id === club.id);
      if (!season) throw new Error("Select a season owned by your club.");
      if (!newDivision.trim() || newDivision.trim().length > 100)
        throw new Error("Division name must be 1–100 characters.");
      const nextOrder = Math.max(0, ...season.divisions.map((item) => item.sort_order)) + 1;
      const { error: mutationError } = await supabase.from("divisions").insert({
        season_id: season.id, name: newDivision.trim(), sort_order: nextOrder,
      });
      if (mutationError) throw mutationError;
      setNewDivision("");
    }, "Division created for the chosen club season.");
  }

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    await submit(async () => {
      const division = divisions.find((item) => item.id === teamDivisionId);
      if (!division) throw new Error("Select a division belonging to your club.");
      if (!teamName.trim() || teamName.trim().length > 100)
        throw new Error("Team name must be 1–100 characters.");
      const { error: mutationError } = await supabase.from("teams").insert({
        division_id: division.id, name: teamName.trim(),
        player_one_name: playerOne.trim() || null,
        player_two_name: playerTwo.trim() || null, is_active: true,
      });
      if (mutationError) throw mutationError;
      setTeamName(""); setPlayerOne(""); setPlayerTwo("");
    }, "Team added to the selected division.");
  }

  async function createFixture(event: React.FormEvent) {
    event.preventDefault();
    await submit(async () => {
      const division = divisions.find((item) => item.id === fixtureDivisionId);
      if (!division) throw new Error("Choose a division belonging to your club.");
      if (!fixtureHome || !fixtureAway || fixtureHome === fixtureAway)
        throw new Error("Choose two different teams from the same division.");
      if (![fixtureHome, fixtureAway].every((id) =>
        division.teams.some((team) => team.id === id)))
        throw new Error("Both teams must belong to the selected division.");
      const week = Number(fixtureWeek);
      if (!Number.isInteger(week) || week < 1 || week > 1000)
        throw new Error("Week number must be between 1 and 1000.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fixtureDeadline))
        throw new Error("Choose a play-by date.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fixturePublish) ||
        fixturePublish > fixtureDeadline) {
        throw new Error("Publish date must be on or before the fixture deadline.");
      }
      const { error: mutationError } = await supabase.from("fixtures").insert({
        season_id: division.season_id, division_id: division.id,
        home_team_id: fixtureHome, away_team_id: fixtureAway,
        week_number: week, play_by: fixtureDeadline, status: "open",
        available_from: fixturePublish,
      });
      if (mutationError) throw mutationError;
      setFixtureHome(""); setFixtureAway("");
    }, "Fixture created. Confirm its publication timing before announcing.");
  }

  async function setSeasonStatus(seasonId:string,status:"draft"|"active"|"completed") { await submit(async()=>{const {error}=await supabase.rpc("rallora_set_season_status",{p_season_id:seasonId,p_status:status});if(error)throw error;},`Season marked ${status}.`); }

  async function updateFixtureSchedule() {
    if (!manageFixture) { setError("Choose a fixture."); return; }
    if (managedLocked) { setError("Confirmed or cancelled fixtures cannot be rescheduled."); return; }
    const week=Number(manageWeek);
    if(!Number.isInteger(week)||week<1||week>1000){setError("Week number must be between 1 and 1000.");return;}
    if(!manageDeadline||!managePublish||managePublish>manageDeadline){setError("Publish date must be on or before the play-by date.");return;}
    if(!window.confirm(`Update ${managedHome} vs ${managedAway} to week ${week}, published ${new Date(managePublish+"T00:00:00").toLocaleDateString("en-GB")} and due ${new Date(manageDeadline+"T00:00:00").toLocaleDateString("en-GB")}?`)) return;
    await submit(async()=>{const {error}=await supabase.rpc("rallora_update_fixture_schedule",{p_fixture_id:manageFixture,p_week_number:week,p_play_by:manageDeadline,p_available_from:managePublish});if(error)throw error;},"Fixture schedule updated.");
  }
  async function cancelFixture() {
    if(!manageFixture){setError("Choose a fixture.");return;}
    if(selectedManagedFixture?.status==="cancelled"){setError("This fixture is already cancelled.");return;}
    if(selectedManagedFixture?.status==="confirmed"){setError("Confirmed fixtures must be reopened before they can be cancelled.");return;}
    if(!window.confirm(`Cancel ${managedHome} vs ${managedAway}? Captains will no longer see this fixture as active.`)) return;
    await submit(async()=>{const {error}=await supabase.rpc("rallora_cancel_fixture",{p_fixture_id:manageFixture});if(error)throw error;},"Fixture cancelled.");
  }

  async function resolveResult(event: React.FormEvent) {
    event.preventDefault();
    await submit(async () => {
      if (!recoveryFixture) throw new Error("Enter the fixture ID to resolve.");
      const { error: mutationError } = await supabase.rpc("rallora_admin_resolve_result", { p_fixture_id: recoveryFixture.trim(), p_home_score: recoveryHome.trim(), p_away_score: recoveryAway.trim(), p_winner_team_id: recoveryWinner.trim() || null, p_notes: recoveryNotes.trim() || null });
      if (mutationError) throw mutationError;
      setRecoveryHome(""); setRecoveryAway(""); setRecoveryWinner(""); setRecoveryNotes("");
    }, "Official result saved and standings recalculated.");
  }

  async function reopenFixture() {
    await submit(async () => {
      if (!recoveryFixture) throw new Error("Enter the fixture ID to reopen.");
      const { error: mutationError } = await supabase.rpc("rallora_admin_reopen_fixture", { p_fixture_id: recoveryFixture.trim() });
      if (mutationError) throw mutationError;
    }, "Fixture reopened and standings recalculated.");
  }

  return <section className={styles.editor} id="club-management">
    <div className={styles.editorHead}><div>
      <span className={styles.eyebrow}>CLUB MANAGEMENT</span>
      <h2>Manage {club.name}</h2>
      <p>Changes affect this club only, subject to database membership checks.</p>
    </div><span className={styles.badge}>EDITING ENABLED</span></div>
    <div className={styles.tabs}>
      {([["branding","Branding"],["seasons","Seasons & divisions"],
        ["teams","Teams"],["fixtures","Fixtures"]] as const).map(([id,label]) =>
        <button type="button" key={id} onClick={() => {
          setActiveTab(id); setMessage(""); setError("");
        }} className={activeTab === id ? styles.selected : ""}>{label}</button>)}
    </div>
    {message && <p className={styles.success} role="status">{message}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {activeTab === "branding" && <form className={styles.form} onSubmit={saveBranding}>
      <label>Club name<input required maxLength={100} value={name}
        onChange={(event) => setName(event.target.value)} /></label>
      <label>Short name<input maxLength={35} value={shortName}
        onChange={(event) => setShortName(event.target.value)} /></label>
      <label>Brand colour<input type="color" value={colour}
        onChange={(event) => setColour(event.target.value)} /></label>
      <div className={styles.imageField}>
        <div className={styles.imageFieldHead}><div><strong>Club logo</strong><p>Upload any JPG, PNG or WebP. Rallora automatically resizes it to a square 800 × 800 WebP without stretching the logo.</p></div>
          <button className={styles.uploadButton} type="button" disabled={Boolean(uploadBusy)} onClick={()=>logoInputRef.current?.click()}>{uploadBusy==="logo"?"Preparing…":logoUrl?"Replace logo":"Upload logo"}</button></div>
        <input ref={logoInputRef} className={styles.hiddenFile} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>void uploadClubImage(event.target.files?.[0],"logo")} />
        {logoUrl && <div className={styles.logoPreview}><img src={logoUrl} alt="Club logo preview" /></div>}
        <details className={styles.advancedImage}><summary>Advanced: use an image URL instead</summary><label>Logo URL<input type="url" value={logoUrl} onChange={event=>setLogoUrl(event.target.value)} /></label></details>
      </div>
      <div className={styles.imageField}>
        <div className={styles.imageFieldHead}><div><strong>Cover image</strong><p>Upload a landscape photo. Rallora automatically crops and resizes it to 1600 × 900 (16:9), keeping the centre of the image in view.</p></div>
          <button className={styles.uploadButton} type="button" disabled={Boolean(uploadBusy)} onClick={()=>coverInputRef.current?.click()}>{uploadBusy==="cover"?"Preparing…":coverImageUrl?"Replace cover":"Upload cover"}</button></div>
        <input ref={coverInputRef} className={styles.hiddenFile} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>void uploadClubImage(event.target.files?.[0],"cover")} />
        {coverImageUrl && <div className={styles.coverPreview}><img src={coverImageUrl} alt="Club cover preview" /></div>}
        <details className={styles.advancedImage}><summary>Advanced: use an image URL instead</summary><label>Cover image URL<input type="url" value={coverImageUrl} onChange={event=>setCoverImageUrl(event.target.value)} /></label></details>
      </div>
      <label>Website<input type="url" value={websiteUrl} onChange={event=>setWebsiteUrl(event.target.value)} /></label>
      <label>Contact email<input type="email" value={contactEmail} onChange={event=>setContactEmail(event.target.value)} /></label>
      <label>Venue name<input value={venueName} maxLength={160} onChange={event=>setVenueName(event.target.value)} /></label>
      <label>Address<input value={address} maxLength={200} onChange={event=>setAddress(event.target.value)} /></label>
      <label>Town or city<input value={town} maxLength={100} onChange={event=>setTown(event.target.value)} /></label>
      <label>Postcode<input value={postcode} maxLength={20} onChange={event=>setPostcode(event.target.value)} /></label>
      <label className={styles.wide}>Welcome message<textarea rows={3}
        maxLength={1000} value={welcomeText}
        onChange={(event) => setWelcomeText(event.target.value)} /></label>
      <label className={styles.wide}>Player registration terms<textarea rows={5} maxLength={3000}
        value={registrationTerms} onChange={event=>setRegistrationTerms(event.target.value)}
        placeholder="For example: all league matches must be played at this venue." /></label>
      <button disabled={busy} type="submit">{busy ? "Saving…" : "Save club branding"}</button>
    </form>}
    {activeTab === "seasons" && <div className={styles.columns}>
      <form className={styles.form} onSubmit={createSeason}>
        <h3>Add a season</h3><p>New seasons start as drafts.</p>
        <label>Season name<input required maxLength={100}
          value={newSeason} placeholder="Autumn 2026"
          onChange={(event) => setNewSeason(event.target.value)} /></label>
        <button disabled={busy} type="submit">Create draft season</button>
      </form>
      <form className={styles.form} onSubmit={createDivision}>
        <h3>Add a division</h3>
        <label>Season<select value={divisionSeasonId}
          onChange={(event) => setDivisionSeasonId(event.target.value)}>
          {seasons.map((item) => <option value={item.id} key={item.id}>
            {item.name} · {item.status}</option>)}</select></label>
        <label>Division name<input required maxLength={100} value={newDivision}
          onChange={(event) => setNewDivision(event.target.value)} /></label>
        <button disabled={busy || !seasons.length} type="submit">Add division</button>
        <div className={styles.wide}><h3>Season status</h3>{seasons.map((season)=><div key={season.id}><strong>{season.name}</strong> · {season.status} <button type="button" disabled={busy||season.status==="active"} onClick={()=>void setSeasonStatus(season.id,"active")}>Activate</button> <button type="button" disabled={busy||season.status==="completed"} onClick={()=>void setSeasonStatus(season.id,"completed")}>Complete</button></div>)}</div>
      </form>
    </div>}
    {activeTab === "teams" && <form className={styles.form} onSubmit={createTeam}>
      <h3>Add a team</h3>
      <label>Division<select value={teamDivisionId}
        onChange={(event) => setTeamDivisionId(event.target.value)}>
        {divisions.map((item) => <option value={item.id} key={item.id}>
          {item.season_name} · {item.name}</option>)}</select></label>
      <label>Team name<input required maxLength={100} value={teamName}
        onChange={(event) => setTeamName(event.target.value)} /></label>
      <label>Player one<input maxLength={100} value={playerOne}
        onChange={(event) => setPlayerOne(event.target.value)} /></label>
      <label>Player two<input maxLength={100} value={playerTwo}
        onChange={(event) => setPlayerTwo(event.target.value)} /></label>
      <button disabled={busy || !divisions.length} type="submit">Add team</button>
    </form>}
    {activeTab === "fixtures" && <form className={styles.form} onSubmit={createFixture}>
      <h3>Create a fixture</h3>
      <label>Division<select value={fixtureDivisionId}
        onChange={(event) => {
          setFixtureDivisionId(event.target.value);
          setFixtureHome(""); setFixtureAway("");
        }}>
        {divisions.map((item) => <option value={item.id} key={item.id}>
          {item.season_name} · {item.name}</option>)}</select></label>
      <label>Home team<select value={fixtureHome}
        onChange={(event) => setFixtureHome(event.target.value)}>
        <option value="">Choose a team</option>
        {eligibleTeams.map((team) => <option value={team.id}
          key={team.id}>{team.name}</option>)}</select></label>
      <label>Away team<select value={fixtureAway}
        onChange={(event) => setFixtureAway(event.target.value)}>
        <option value="">Choose a team</option>
        {eligibleTeams.map((team) => <option value={team.id}
          key={team.id}>{team.name}</option>)}</select></label>
      <label>Week number<input type="number" min={1} max={1000}
        value={fixtureWeek}
        onChange={(event) => setFixtureWeek(event.target.value)} /></label>
      <label>Play by<input type="date" required value={fixtureDeadline}
        onChange={(event) => setFixtureDeadline(event.target.value)} /></label>
      <label>Publish on<input type="date" required value={fixturePublish}
        onChange={(event) => setFixturePublish(event.target.value)} /></label>
      <button disabled={busy || eligibleTeams.length < 2}
        type="submit">Create fixture</button>

      <div className={styles.wide}><hr /><h3>Manage an existing fixture</h3><p>Reschedule open or disputed fixtures, or cancel a fixture that has no official result.</p></div>
      <label className={styles.wide}>Fixture<select value={manageFixture} onChange={(event)=>{
        const id=event.target.value; setManageFixture(id);
        const fixture=fixtures.find((item)=>item.id===id);
        if(fixture){setManageWeek(String(fixture.week_number));setManageDeadline(fixture.play_by);setManagePublish(fixture.play_by);}
      }}>
        <option value="">Choose fixture</option>
        {fixtures.map((fixture)=>{
          const division=divisions.find((item)=>item.id===fixture.division_id);
          const home=division?.teams.find((team)=>team.id===fixture.home_team_id)?.name??"Home";
          const away=division?.teams.find((team)=>team.id===fixture.away_team_id)?.name??"Away";
          return <option key={fixture.id} value={fixture.id}>Week {fixture.week_number} · {home} vs {away} · {fixture.status}</option>
        })}
      </select></label>
      {selectedManagedFixture&&<div className={styles.fixtureSummary}>
        <strong>{managedHome} vs {managedAway}</strong>
        <span>Status: {selectedManagedFixture.status}</span>
        <span>Play by: {new Date(selectedManagedFixture.play_by+"T00:00:00").toLocaleDateString("en-GB")}</span>
      </div>}
      <label>Week<input type="number" min={1} max={1000} value={manageWeek} onChange={(event)=>setManageWeek(event.target.value)} /></label>
      <label>Publish on<input type="date" value={managePublish} onChange={(event)=>setManagePublish(event.target.value)} /></label>
      <label>Play by<input type="date" value={manageDeadline} onChange={(event)=>setManageDeadline(event.target.value)} /></label>
      <button type="button" disabled={busy||!manageFixture||managedLocked} onClick={()=>void updateFixtureSchedule()}>Update fixture schedule</button>
      <button type="button" className={styles.danger} disabled={busy||!manageFixture||selectedManagedFixture?.status==="cancelled"||selectedManagedFixture?.status==="confirmed"} onClick={()=>void cancelFixture()}>Cancel fixture</button>
      {selectedManagedFixture?.status==="confirmed"&&<p className={styles.wide}>This fixture has an official result. Use Result recovery to reopen it before making schedule or cancellation changes.</p>}
    </form>}
  </section>;
}

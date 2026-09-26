"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import styles from "./editor.module.css";

export type EditableClub = {
  id: string; slug: string; name: string;
  short_name: string | null; primary_color: string | null;
  welcome_text: string | null; logo_url:string|null; cover_image_url:string|null; website_url:string|null; booking_url:string|null;
  contact_email:string|null; venue_name:string|null; address_line_1:string|null;
  town:string|null; postcode:string|null; player_registration_terms:string|null;
  playtomic_setup_choice:"later"|null;
};
export type EditableDivision = {
  id: string; name: string; sort_order: number;
  teams: { id: string; name: string; player_one_name?: string | null; player_two_name?: string | null; player_one_email?: string | null; player_two_email?: string | null; player_one_rating?: number | null; player_two_rating?: number | null }[];
};
type EditableFixture = { id:string; season_id:string; division_id:string; home_team_id:string; away_team_id:string; week_number:number; play_by:string; status:string; home_score?:string|null; away_score?:string|null; winner_team_id?:string|null };
type LeagueRule = { key:string; label:string; text:string; enabled:boolean; custom?:boolean };
const COMMON_RULES: LeagueRule[] = [
  {key:"venue",label:"Venue requirement",text:"League matches must be played at the club unless the organiser approves otherwise.",enabled:true},
  {key:"arrange",label:"Arrange your own match",text:"Teams arrange their own match time within the published fixture window.",enabled:true},
  {key:"deadline",label:"Fixture deadline",text:"All fixtures must be completed by the published deadline unless the organiser grants an extension.",enabled:true},
  {key:"results",label:"Result reporting",text:"The winning team or nominated captain must submit the result promptly after the match.",enabled:true},
  {key:"availability",label:"Player availability",text:"Teams are responsible for being available to complete all fixtures in the scheduled period.",enabled:true},
  {key:"walkover",label:"Walkovers",text:"If a team cannot complete a fixture, the organiser may award a walkover in line with the club’s competition policy.",enabled:false},
  {key:"conduct",label:"Player conduct",text:"Players must follow the club’s on-court conduct and venue rules at all times.",enabled:true},
];
export type EditableSeason = {
  id: string; club_id: string; name: string; status: string;
  fixture_schedule_mode: "weekly" | "date_window";
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  league_format: "standard" | "promotion_relegation_cycles";
  teams_per_division: number | null;
  matches_per_cycle: number | null;
  division_assignment_mode: "manual" | "combined_rating";
  max_divisions: number | null;
  allow_overflow_when_uneven: boolean;
  promotion_places: number;
  relegation_places: number;
  cycle_match_mode: "single_round_robin" | "double_round_robin";
  require_cycle_completion: boolean;
  league_rules: LeagueRule[];
  registrations: number;
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
  const [activeTab, setActiveTab] = useState<"branding" | "seasons" | "registration" | "teams" | "fixtures">("branding");
  const [message, setMessage] = useState("");
  const [waitlist,setWaitlist]=useState<{id:string;season_id:string;player_name:string;email:string;playtomic_rating:number|null;preferred_level:string|null;availability:string|null;status:string}[]>([]);
  const [replaceTarget,setReplaceTarget]=useState<{teamId:string;slot:1|2}|null>(null); const [replacementId,setReplacementId]=useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    function openSetup(event: Event) {
      const detail = (event as CustomEvent<{tab?: "branding" | "seasons" | "registration" | "teams" | "fixtures"}>).detail;
      const requested = detail?.tab;
      if (!requested) return;
      setActiveTab(requested);
      setMessage("");
      setError("");
      requestAnimationFrame(() => {
        document.getElementById("club-management")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    window.addEventListener("rallora:open-club-setup", openSetup as EventListener);
    return () => window.removeEventListener("rallora:open-club-setup", openSetup as EventListener);
  }, []);

  useEffect(() => {
    const requested = searchParams.get("setup");
    if (requested === "branding" || requested === "seasons" || requested === "registration" || requested === "teams" || requested === "fixtures") {
      setActiveTab(requested);
      const intentionalSetupNav = sessionStorage.getItem("rallora:setup-nav") === "1";
      sessionStorage.removeItem("rallora:setup-nav");

      const url = new URL(window.location.href);
      url.searchParams.delete("setup");
      url.hash = "";
      window.history.replaceState(window.history.state, "", url.pathname + (url.search ? url.search : ""));

      if (intentionalSetupNav) {
        requestAnimationFrame(() => document.getElementById("club-management")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    }
  }, [searchParams]);
  useEffect(()=>{if(activeTab!=="teams")return;void supabase.from("rallora_player_waitlist").select("id,season_id,player_name,email,playtomic_rating,preferred_level,availability,status").eq("club_id",club.id).eq("status","available").order("created_at").then(({data})=>setWaitlist((data??[]) as typeof waitlist));},[activeTab,club.id,supabase]);
  async function replacePlayer(){if(!replaceTarget||!replacementId)return;setBusy(true);setError("");const r=await supabase.rpc("rallora_replace_pairing_player",{p_team_id:replaceTarget.teamId,p_slot:replaceTarget.slot,p_waitlist_id:replacementId,p_name:null,p_email:null,p_rating:null});setBusy(false);if(r.error){setError(r.error.message);return}setMessage("Replacement player added. Existing fixtures and results remain attached to the pairing.");setReplaceTarget(null);setReplacementId("");onSaved();}
  const [name, setName] = useState(club.name);
  const [shortName, setShortName] = useState(club.short_name ?? "");
  const [colour, setColour] = useState(club.primary_color || "#2458ff");
  const [welcomeText, setWelcomeText] = useState(club.welcome_text ?? "");
  const [logoUrl,setLogoUrl]=useState(club.logo_url??"");
  const [coverImageUrl,setCoverImageUrl]=useState(club.cover_image_url??"");
  const [websiteUrl,setWebsiteUrl]=useState(club.website_url??"");
  const [bookingUrl,setBookingUrl]=useState(club.booking_url??"");
  const [contactEmail,setContactEmail]=useState(club.contact_email??"");
  const [venueName,setVenueName]=useState(club.venue_name??"");
  const [address,setAddress]=useState(club.address_line_1??"");
  const [town,setTown]=useState(club.town??"");
  const [postcode,setPostcode]=useState(club.postcode??"");
  const [registrationTerms,setRegistrationTerms]=useState(club.player_registration_terms??"");
  const [newSeason, setNewSeason] = useState("");
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [newFixtureScheduleMode, setNewFixtureScheduleMode] = useState<"weekly" | "date_window">("weekly");
  const [registrationOpens, setRegistrationOpens] = useState("");
  const [registrationCloses, setRegistrationCloses] = useState("");
  const [leagueFormat, setLeagueFormat] = useState<"standard"|"promotion_relegation_cycles">("standard");
  const [teamsPerDivision, setTeamsPerDivision] = useState("4");
  const [matchesPerCycle, setMatchesPerCycle] = useState("3");
  const [assignmentMode, setAssignmentMode] = useState<"manual"|"combined_rating">("combined_rating");
  const [maxDivisions, setMaxDivisions] = useState("6");
  const [allowOverflowWhenUneven, setAllowOverflowWhenUneven] = useState(true);
  const [promotionPlaces, setPromotionPlaces] = useState("2");
  const [relegationPlaces, setRelegationPlaces] = useState("2");
  const [cycleMatchMode, setCycleMatchMode] = useState<"single_round_robin"|"double_round_robin">("single_round_robin");
  const [requireCycleCompletion, setRequireCycleCompletion] = useState(true);
  const [leagueRules, setLeagueRules] = useState<LeagueRule[]>(COMMON_RULES);
  const [customRule, setCustomRule] = useState("");

  useEffect(() => {
    function editSeason(event: Event) {
      const detail = (event as CustomEvent<{seasonId?: string}>).detail;
      const season = seasons.find((item) => item.id === detail?.seasonId);
      if (!season) return;
      setEditingSeasonId(season.id);
      setNewSeason(season.name);
      setNewFixtureScheduleMode(season.fixture_schedule_mode);
      setRegistrationOpens(season.registration_opens_at ? season.registration_opens_at.slice(0,16) : "");
      setRegistrationCloses(season.registration_closes_at ? season.registration_closes_at.slice(0,16) : "");
      setLeagueFormat(season.league_format);
      setTeamsPerDivision(String(season.teams_per_division ?? 4));
      setMatchesPerCycle(String(season.matches_per_cycle ?? 3));
      setAssignmentMode(season.division_assignment_mode);
      setMaxDivisions(String(season.max_divisions ?? 6));
      setAllowOverflowWhenUneven(season.allow_overflow_when_uneven);
      setPromotionPlaces(String(season.promotion_places ?? 2));
      setRelegationPlaces(String(season.relegation_places ?? 2));
      setCycleMatchMode(season.cycle_match_mode ?? "single_round_robin");
      setRequireCycleCompletion(season.require_cycle_completion ?? true);
      setLeagueRules(season.league_rules?.length ? season.league_rules : COMMON_RULES);
      setActiveTab("seasons");
      setMessage("");
      setError("");
      requestAnimationFrame(() => {
        document.getElementById("club-management")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    window.addEventListener("rallora:edit-season", editSeason as EventListener);
    return () => window.removeEventListener("rallora:edit-season", editSeason as EventListener);
  }, [seasons]);

  const [newDivision, setNewDivision] = useState("");
  const [divisionSeasonId, setDivisionSeasonId] = useState(seasons[0]?.id ?? "");
  const [teamDivisionId, setTeamDivisionId] = useState(seasons[0]?.divisions[0]?.id ?? "");
  const [teamName, setTeamName] = useState("");
  const [playerOne, setPlayerOne] = useState("");
  const [playerTwo, setPlayerTwo] = useState("");
  const [playerOneEmail, setPlayerOneEmail] = useState("");
  const [playerTwoEmail, setPlayerTwoEmail] = useState("");
  const [playerOneRating, setPlayerOneRating] = useState("");
  const [playerTwoRating, setPlayerTwoRating] = useState("");
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
  const divisions = seasons.flatMap((season) =>
    season.divisions.map((division) => ({ ...division, season_id: season.id,
      season_name: season.name })));
  const activeSeason = seasons.find((season) => season.status === "active");
  const registrationReady = Boolean(activeSeason && activeSeason.divisions.length > 0);
  const selectedDivision = divisions.find((division) => division.id === fixtureDivisionId);
  const selectedFixtureSeason = selectedDivision ? seasons.find((season)=>season.id===selectedDivision.season_id) : undefined;
  const fixtureScheduleMode = selectedFixtureSeason?.fixture_schedule_mode ?? "weekly";
  const editingSeason = editingSeasonId ? seasons.find((item)=>item.id===editingSeasonId) : null;
  const formatLocked = Boolean(editingSeason && editingSeason.registrations > 0);
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
          logo_url:logoUrl.trim()||null,cover_image_url:coverImageUrl.trim()||null,website_url:websiteUrl.trim()||null,booking_url:bookingUrl.trim()||null,
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
      const payload = {
        name: title,
        fixture_schedule_mode: newFixtureScheduleMode,
        registration_opens_at: registrationOpens || null,
        registration_closes_at: registrationCloses || null,
        league_format: leagueFormat,
        teams_per_division: leagueFormat==="promotion_relegation_cycles" ? Number(teamsPerDivision) : null,
        matches_per_cycle: leagueFormat==="promotion_relegation_cycles" ? Number(matchesPerCycle) : null,
        division_assignment_mode: assignmentMode,
        max_divisions: maxDivisions ? Number(maxDivisions) : null,
        allow_overflow_when_uneven: allowOverflowWhenUneven,
        promotion_places: leagueFormat==="promotion_relegation_cycles" ? Number(promotionPlaces) : 0,
        relegation_places: leagueFormat==="promotion_relegation_cycles" ? Number(relegationPlaces) : 0,
        cycle_match_mode: cycleMatchMode,
        require_cycle_completion: requireCycleCompletion,
        league_rules: leagueRules,
      };
      if (editingSeasonId) {
        const existing = seasons.find((item)=>item.id===editingSeasonId);
        if (!existing) throw new Error("League could not be found.");
        if (existing.registrations > 0 && existing.league_format !== leagueFormat)
          throw new Error("League format cannot be changed after players have registered.");
        const { error: mutationError } = await supabase.from("seasons")
          .update(payload).eq("id", editingSeasonId).eq("club_id", club.id);
        if (mutationError) throw mutationError;
      } else {
        const { error: mutationError } = await supabase.from("seasons").insert({
          club_id: club.id, status: "draft", ...payload,
        });
        if (mutationError) throw mutationError;
      }
      setNewSeason("");
      setEditingSeasonId(null);
    }, editingSeasonId ? "League updated." : "Draft season created. It will not be public until activated.");
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
      const ratingOne = playerOneRating.trim() === "" ? null : Number(playerOneRating);
      const ratingTwo = playerTwoRating.trim() === "" ? null : Number(playerTwoRating);
      if (ratingOne !== null && (!Number.isFinite(ratingOne) || ratingOne < 0 || ratingOne > 7))
        throw new Error("Player one’s Playtomic rating must be between 0 and 7.");
      if (ratingTwo !== null && (!Number.isFinite(ratingTwo) || ratingTwo < 0 || ratingTwo > 7))
        throw new Error("Player two's Playtomic rating must be between 0 and 7.");
      const { error: mutationError } = await supabase.from("teams").insert({
        division_id: division.id, name: teamName.trim(),
        player_one_name: playerOne.trim() || null,
        player_two_name: playerTwo.trim() || null,
        player_one_email: playerOneEmail.trim().toLowerCase() || null,
        player_two_email: playerTwoEmail.trim().toLowerCase() || null,
        player_one_rating: ratingOne,
        player_two_rating: ratingTwo,
        player_one_rating_source: "manual",
        player_two_rating_source: "manual",
        captain_email: playerOneEmail.trim().toLowerCase() || null,
        is_active: true,
      });
      if (mutationError) throw mutationError;
      setTeamName(""); setPlayerOne(""); setPlayerTwo("");
      setPlayerOneEmail(""); setPlayerTwoEmail(""); setPlayerOneRating(""); setPlayerTwoRating("");
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
      const week = fixtureScheduleMode === "weekly" ? Number(fixtureWeek) : 1;
      if (fixtureScheduleMode === "weekly" && (!Number.isInteger(week) || week < 1 || week > 1000))
        throw new Error("Week number must be between 1 and 1000.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fixtureDeadline))
        throw new Error(fixtureScheduleMode === "weekly" ? "Choose a completion deadline." : "Choose a complete-by date.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fixturePublish) || fixturePublish > fixtureDeadline) {
        throw new Error(fixtureScheduleMode === "weekly"
          ? "Available date must be on or before the fixture deadline."
          : "Start date must be on or before the end date.");
      }
      const { error: mutationError } = await supabase.from("fixtures").insert({
        season_id: division.season_id, division_id: division.id,
        home_team_id: fixtureHome, away_team_id: fixtureAway,
        week_number: week, play_by: fixtureDeadline, status: "open",
        available_from: fixturePublish,
        fixture_group_type: fixtureScheduleMode === "weekly" ? "weekly" : "custom",
        fixture_group_name: fixtureScheduleMode === "weekly" ? `Week ${week}` : "Date window",
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
      <p>Set up and manage your seasons, registrations, teams and fixtures.</p>
    </div><span className={styles.badge}>CLUB ADMIN</span></div>
    <div className={styles.tabs}>
      {([["branding","Branding"],["seasons","Seasons & divisions"],
        ["registration","Registration"],["teams","Teams"],["fixtures","Fixtures"]] as const).map(([id,label]) =>
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
      <label>Player court booking link<input type="url" value={bookingUrl} onChange={event=>setBookingUrl(event.target.value)} placeholder="https://app.playtomic.io/..." /><small>Shown as Book court on fixtures that still need arranging.</small></label>
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
        <div className={styles.seasonEditorIntro}>
          <span className={styles.eyebrow}>{editingSeasonId ? "EDIT LEAGUE" : "NEW LEAGUE"}</span>
          <h3>{editingSeasonId ? `Edit ${editingSeason?.name ?? "league"}` : "Create a league"}</h3>
          <p>{editingSeasonId ? "Update this league without rebuilding it. Structural settings may be protected once registrations exist." : "New leagues start as drafts and stay private until you activate them."}</p>
        </div>
        <section className={styles.seasonSection}>
          <div className={styles.seasonSectionHead}><span>1</span><div><strong>League details</strong><p>Name the league and choose how fixtures are scheduled.</p></div></div>
        <label>Season name<input required maxLength={100}
          value={newSeason} placeholder="Autumn 2026"
          onChange={(event) => setNewSeason(event.target.value)} /></label>
        <label>Fixture scheduling<select value={newFixtureScheduleMode}
          onChange={(event)=>setNewFixtureScheduleMode(event.target.value as "weekly" | "date_window")}>
          <option value="weekly">Weekly rounds</option>
          <option value="date_window">Start &amp; end date window</option>
        </select></label>
        <p className={styles.wide}>{newFixtureScheduleMode==="weekly"
          ? "Fixtures are organised by week number, with a completion deadline."
          : "Each fixture has an available-from date and a complete-by date."}</p>
        </section>
        <section className={styles.seasonSection}>
          <div className={styles.seasonSectionHead}><span>2</span><div><strong>Registration</strong><p>Control when players can enter this league.</p></div></div>
        <label>Registration opens<input type="datetime-local" value={registrationOpens} onChange={e=>setRegistrationOpens(e.target.value)} /></label>
        <label>Registration closes<input type="datetime-local" value={registrationCloses} onChange={e=>setRegistrationCloses(e.target.value)} /></label>
        </section>
        <section className={styles.seasonSection}>
          <div className={styles.seasonSectionHead}><span>3</span><div><strong>Format &amp; divisions</strong><p>Choose the competition structure and how teams are grouped.</p></div></div>
        <label>League format<select value={leagueFormat} disabled={formatLocked} onChange={e=>setLeagueFormat(e.target.value as "standard"|"promotion_relegation_cycles")}>
          <option value="standard">Standard divisions</option>
          <option value="promotion_relegation_cycles">Short cycles with promotion &amp; relegation</option>
        </select></label>
        {formatLocked && <p className={styles.lockWarning}>⚠ League format is locked because {editingSeason?.registrations} player/team registration{editingSeason?.registrations===1?" has":"s have"} already been received. You can still update non-structural details.</p>}
        <div className={styles.formatRequestPrompt}>
          <strong>Can’t see the format you need?</strong>
          <p>Tell Rallora how your club runs it and we’ll review whether it can be added specifically to your account.</p>
          <a href={`/clubs/${encodeURIComponent(club.slug)}/admin/format-request`}>Request a format →</a>
        </div>
        <label>Division assignment<select value={assignmentMode} onChange={e=>setAssignmentMode(e.target.value as "manual"|"combined_rating")}>
          <option value="combined_rating">Auto seed by combined Playtomic rating</option>
          <option value="manual">Club assigns teams manually</option>
        </select></label>
        <label>Maximum divisions / groups<input type="number" min="1" max="100" value={maxDivisions}
          onChange={e=>setMaxDivisions(e.target.value)} /></label>
        <label>Target teams per division / group<input type="number" min="2" max="100" value={teamsPerDivision}
          onChange={e=>setTeamsPerDivision(e.target.value)} /></label>
        <label className={styles.wide}><span>Uneven registrations</span>
          <span className={styles.inlineCheck}><input type="checkbox" checked={allowOverflowWhenUneven}
            onChange={e=>setAllowOverflowWhenUneven(e.target.checked)} />
            Allow Rallora to place extra teams into a group only when registrations do not divide evenly.</span>
          <small>Example: target 4 teams per group. If the final total cannot be split evenly, Rallora may create a 5-team group rather than reject registrations or create an undersized extra group.</small>
        </label>
        </section>
        {leagueFormat==="promotion_relegation_cycles" && <section className={styles.seasonSection}>
          <div className={styles.seasonSectionHead}><span>4</span><div><strong>Promotion &amp; relegation</strong><p>Configure the rolling-cycle movement rules.</p></div></div>
          <label>Teams per group<input type="number" min="2" max="100" value={teamsPerDivision} onChange={e=>setTeamsPerDivision(e.target.value)} /></label>
          <label>Promotion places<input type="number" min="0" max="20" value={promotionPlaces} onChange={e=>setPromotionPlaces(e.target.value)} /></label>
          <label>Relegation places<input type="number" min="0" max="20" value={relegationPlaces} onChange={e=>setRelegationPlaces(e.target.value)} /></label>
          <label>Match format<select value={cycleMatchMode} onChange={e=>setCycleMatchMode(e.target.value as "single_round_robin"|"double_round_robin")}>
            <option value="single_round_robin">Play every team once</option>
            <option value="double_round_robin">Play every team twice</option>
          </select></label>
          <label className={styles.wide}><span>Rolling cycle control</span>
            <span className={styles.inlineCheck}><input type="checkbox" checked={requireCycleCompletion} onChange={e=>setRequireCycleCompletion(e.target.checked)} />
              Require every fixture in the current cycle to be completed before promotions/relegations are finalised and the next cycle can be generated.</span>
            <small>Once the cycle is complete, the club chooses the next fixture window. Rallora then applies the configured movement rules and generates the next cycle.</small>
          </label>
          <p className={styles.wide}>Fixtures are calculated from the actual group size. For example, a 4-team group playing everyone once gives 3 matches per team; a 5-team overflow group gives 4.</p>
        </section>}
        <section className={styles.seasonSection}>
          <div className={styles.seasonSectionHead}><span>{leagueFormat==="promotion_relegation_cycles" ? "5" : "4"}</span><div><strong>League rules</strong><p>Choose the rules players will see for this competition.</p></div></div>
        <div className={styles.ruleBuilder}>
          <div className={styles.ruleBuilderHead}>
            <div><strong>League rules</strong><p>Start with common padel league rules, switch off anything you do not use, and add your own.</p></div>
          </div>
          <div className={styles.ruleList}>
            {leagueRules.map((rule,index)=><label className={styles.ruleRow} key={rule.key}>
              <input type="checkbox" checked={rule.enabled} onChange={e=>setLeagueRules(current=>current.map((item,i)=>i===index?{...item,enabled:e.target.checked}:item))} />
              <span><strong>{rule.label}</strong><small>{rule.text}</small></span>
              {rule.custom&&<button type="button" onClick={()=>setLeagueRules(current=>current.filter((_,i)=>i!==index))}>Remove</button>}
            </label>)}
          </div>
          <div className={styles.customRuleAdd}>
            <input maxLength={300} value={customRule} onChange={e=>setCustomRule(e.target.value)} placeholder="Add a club-specific rule…" />
            <button type="button" disabled={!customRule.trim()} onClick={()=>{
              const text=customRule.trim();
              if(!text)return;
              setLeagueRules(current=>[...current,{key:`custom-${Date.now()}`,label:"Club rule",text,enabled:true,custom:true}]);
              setCustomRule("");
            }}>Add rule</button>
          </div>
        </div>
        </section>
        <div className={styles.seasonFormActions}>
          <button disabled={busy} type="submit">{editingSeasonId ? "Save league changes" : "Create draft season"}</button>
          {editingSeasonId && <button type="button" className={styles.secondaryButton} onClick={()=>{
            setEditingSeasonId(null); setNewSeason(""); setMessage(""); setError("");
          }}>Cancel edit</button>}
        </div>
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
    {activeTab === "registration" && <section className={styles.registrationPanel}>
      <div>
        <span className={styles.eyebrow}>TEAM REGISTRATION</span>
        <h3>{registrationReady ? "Registration is ready to open" : "Prepare team registration"}</h3>
        <p>{registrationReady
          ? `${activeSeason?.name} has at least one division, so teams can now register.`
          : "Create a season, add at least one division and activate the season before opening registration."}</p>
      </div>
      {registrationReady ? <div className={styles.registrationActions}>
        <a className={styles.primaryLink} href={`/clubs/${encodeURIComponent(club.slug)}/register`}>Open registration page →</a>
        <a href={`/clubs/${encodeURIComponent(club.slug)}/admin/registrations`}>Review registrations →</a>
      </div> : <button type="button" onClick={() => setActiveTab("seasons")}>Go to Seasons &amp; Divisions →</button>}
      <p className={styles.registrationNote}>Your club registration terms are managed in Branding and shown to entrants during registration.</p>
    </section>}
    {activeTab === "teams" && <div className={styles.teamManagement}>
      <div className={styles.wide}>
        <span className={styles.eyebrow}>PLAYERS &amp; PAIRINGS</span>
        <h3>League pairings</h3>
        <p>Manage current player pairings without breaking their fixtures or results.</p>
        {divisions.map((division) => <section key={division.id} className={styles.pairingGroup}>
          <h4>{division.season_name} · {division.name}</h4>
          {division.teams.map((team) => <article key={team.id} className={styles.pairingRow}>
            <div>
              <strong>{[team.player_one_name, team.player_two_name].filter(Boolean).join(" / ") || team.name}</strong>
              <span>{team.player_one_email || "No email"} · {team.player_two_email || "No email"}</span>
            </div>
            <div className={styles.pairingActions}>
              <button type="button" onClick={() => setReplaceTarget({ teamId: team.id, slot: 1 })}>Replace player 1</button>
              <button type="button" onClick={() => setReplaceTarget({ teamId: team.id, slot: 2 })}>Replace player 2</button>
            </div>
          </article>)}
        </section>)}
        {replaceTarget && <div className={styles.replacePanel}>
          <h4>Select replacement from waiting list</h4>
          <select value={replacementId} onChange={(event) => setReplacementId(event.target.value)}>
            <option value="">Choose available player</option>
            {waitlist.map((player) => <option key={player.id} value={player.id}>
              {player.player_name}{player.playtomic_rating != null ? ` · Playtomic ${player.playtomic_rating}` : ""}{player.preferred_level ? ` · ${player.preferred_level}` : ""}
            </option>)}
          </select>
          {waitlist.find((player) => player.id === replacementId)?.availability &&
            <p>Availability: {waitlist.find((player) => player.id === replacementId)?.availability}</p>}
          <div className={styles.pairingActions}>
            <button type="button" disabled={busy || !replacementId} onClick={() => void replacePlayer()}>Replace player</button>
            <button type="button" className={styles.secondaryButton} onClick={() => setReplaceTarget(null)}>Cancel</button>
          </div>
        </div>}
      </div>
      <form className={styles.form} onSubmit={createTeam}>
      <h3>Add a player pairing manually</h3>
      <label>Division<select value={teamDivisionId}
        onChange={(event) => setTeamDivisionId(event.target.value)}>
        {divisions.map((item) => <option value={item.id} key={item.id}>
          {item.season_name} · {item.name}</option>)}</select></label>
      <label>Pairing reference<input required maxLength={100} value={teamName} placeholder="Auto/internal reference" onChange={(event) => setTeamName(event.target.value)} /><small>Internal reference only — players are shown by their names.</small></label>
      <div className={styles.playerCard}>
        <strong>Player one · Captain</strong>
        <label>Name<input maxLength={100} value={playerOne}
          onChange={(event) => setPlayerOne(event.target.value)} /></label>
        <label>Playtomic email<input type="email" maxLength={254} value={playerOneEmail}
          placeholder="Email linked to Playtomic"
          onChange={(event) => setPlayerOneEmail(event.target.value)} /></label>
        <label>Playtomic rating<input type="number" min="0" max="7" step="0.01" value={playerOneRating}
          placeholder="e.g. 3.42"
          onChange={(event) => setPlayerOneRating(event.target.value)} /></label>
        <small>Enter the current rating manually. When Playtomic is connected, Rallora will be able to sync this instead.</small>
      </div>
      <div className={styles.playerCard}>
        <strong>Player two</strong>
        <label>Name<input maxLength={100} value={playerTwo}
          onChange={(event) => setPlayerTwo(event.target.value)} /></label>
        <label>Playtomic email<input type="email" maxLength={254} value={playerTwoEmail}
          placeholder="Email linked to Playtomic"
          onChange={(event) => setPlayerTwoEmail(event.target.value)} /></label>
        <label>Playtomic rating<input type="number" min="0" max="7" step="0.01" value={playerTwoRating}
          placeholder="e.g. 3.18"
          onChange={(event) => setPlayerTwoRating(event.target.value)} /></label>
        <small>Use the email attached to the player’s Playtomic account so it can be matched later.</small>
      </div>
      <button disabled={busy || !divisions.length} type="submit">Add pairing</button>
    </form></div>}
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
      <div className={styles.wide}><strong>Scheduling:</strong> {fixtureScheduleMode==="weekly" ? "Weekly rounds" : "Start & end date window"}</div>
      {fixtureScheduleMode==="weekly" && <label>Week number<input type="number" min={1} max={1000}
        value={fixtureWeek}
        onChange={(event) => setFixtureWeek(event.target.value)} /></label>}
      <label>{fixtureScheduleMode==="weekly" ? "Available from" : "Start date"}<input type="date" required value={fixturePublish}
        onChange={(event) => setFixturePublish(event.target.value)} /></label>
      <label>{fixtureScheduleMode==="weekly" ? "Complete by" : "End date"}<input type="date" required value={fixtureDeadline}
        onChange={(event) => setFixtureDeadline(event.target.value)} /></label>
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

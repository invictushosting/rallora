"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import { SPONSOR_FIELDS, SPONSOR_POSITIONS, sponsorPositions, sponsorWebsite, type Sponsor, type SponsorPosition, type SponsorScope } from "@/lib/sponsors";
import ClubSponsors from "@/app/components/club-sponsors";
import styles from "./sponsor-manager.module.css";

type League = { id: string; name: string; divisions: { id: string; name: string }[] };
type Props = { clubId: string; slug: string; seasons: League[] };
export default function SponsorManager({ clubId, slug, seasons }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const [editing, setEditing] = useState<Sponsor | null>(null), [formKey, setFormKey] = useState(0);
  const [scope, setScope] = useState<SponsorScope>("club"), [target, setTarget] = useState("");
  const [positions, setPositions] = useState<SponsorPosition[]>(["above-footer"]), [logo, setLogo] = useState("");
  const [enquiries, setEnquiries] = useState(true), [contactEmail, setContactEmail] = useState("");
  const load = useCallback(async () => {
    const [sponsorReply, eventReply, clubReply] = await Promise.all([
      supabase.from("sponsors").select(SPONSOR_FIELDS).eq("club_id", clubId).order("sort_order"),
      supabase.from("rallora_club_events").select("id,name").eq("club_id", clubId).order("event_date", { ascending: false }),
      supabase.from("clubs").select("contact_email,sponsor_enquiries_enabled").eq("id", clubId).single(),
    ]);
    if (sponsorReply.error || eventReply.error || clubReply.error) throw new Error(sponsorReply.error?.message || eventReply.error?.message || clubReply.error?.message);
    setSponsors((sponsorReply.data ?? []) as Sponsor[]); setEvents(eventReply.data ?? []);
    setEnquiries(clubReply.data.sponsor_enquiries_enabled); setContactEmail(clubReply.data.contact_email ?? ""); setLoaded(true);
  }, [clubId, supabase]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  function edit(sponsor: Sponsor | null) {
    setEditing(sponsor); setScope(sponsor?.scope_type ?? "club"); setTarget(sponsor?.scope_id ?? "");
    setPositions(sponsor ? sponsorPositions(sponsor.placement) : ["above-footer"]); setLogo(sponsor?.logo_url ?? "");
    setFormKey(value => value + 1); setError(""); setMessage("");
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Choose a PNG, JPEG or WebP image up to 5 MB."); return; }
    setUploading(true); setError("");
    try {
      const path = `${clubId}/sponsors/${crypto.randomUUID()}.${file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]}`;
      const reply = await supabase.storage.from("club-media").upload(path, file, { contentType: file.type, upsert: false });
      if (reply.error) throw reply.error;
      setLogo(supabase.storage.from("club-media").getPublicUrl(path).data.publicUrl);
      setMessage("Logo uploaded. Save the sponsor to publish it.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not upload logo."); }
    finally { setUploading(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || uploading) return;
    const fields = new FormData(event.currentTarget);
    setError(""); setMessage("");
    if (!positions.length) { setError("Choose at least one placement."); return; }
    const website = String(fields.get("website") ?? "").trim();
    if (website && !sponsorWebsite(website) || logo && !sponsorWebsite(logo)) { setError("Use a complete http:// or https:// address for the logo and website."); return; }
    const targets = scope === "league" ? seasons : scope === "event" ? events : seasons.flatMap(item => item.divisions);
    if (scope !== "club" && !targets.some(item => item.id === target)) { setError("Choose a valid sponsor target."); return; }
    const payload = { club_id: clubId, name: String(fields.get("name")).trim(), sponsor_type: String(fields.get("label") ?? "").trim() || null,
      website_url: website || null, logo_url: logo || null, scope_type: scope, scope_id: scope === "club" ? null : target,
      is_main: scope === "club" && fields.get("main") === "on", is_active: fields.get("active") === "on",
      sort_order: Number(fields.get("order")) || 0, placement: positions.join(",") };
    if (payload.name.length < 2) { setError("Enter the sponsor name."); return; }
    setBusy(true);
    try {
      const query = editing ? supabase.from("sponsors").update(payload).eq("club_id", clubId).eq("id", editing.id) : supabase.from("sponsors").insert(payload);
      const reply = await query.select("id").single();
      if (reply.error) throw new Error(reply.error.code === "23505" ? "This club already has an active main sponsor. Edit that sponsor first to remove its main sponsor status." : reply.error.message);
      await load(); edit(null); setMessage("Sponsor saved. View the public hub to check its placement.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save sponsor."); }
    finally { setBusy(false); }
  }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const reply = await supabase.from("clubs").update({ contact_email: contactEmail.trim() || null, sponsor_enquiries_enabled: enquiries }).eq("id", clubId).select("id").single();
      if (reply.error) throw reply.error; setMessage("Sponsorship enquiry settings saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save settings."); }
    finally { setBusy(false); }
  }
  return <section id="club-sponsors" className={styles.panel}>
    <div className={styles.heading}><div><span>CLUB PARTNERSHIPS</span><h2>Sponsors & placements</h2><p>Choose who a sponsor supports and where players see them.</p></div><a href={`/clubs/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer">View public hub</a></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}
    {!loaded ? <p>Loading sponsor settings…</p> : <>
      <div className={styles.list}>{sponsors.map(sponsor => <article key={sponsor.id}><div><strong>{sponsor.name}</strong><small>{sponsor.is_main ? "Main club sponsor" : `${sponsor.scope_type} sponsor`} · {sponsor.is_active ? "Active" : "Hidden"} · {sponsorPositions(sponsor.placement).map(value => SPONSOR_POSITIONS.find(item => item.value === value)?.label).join(", ")}</small></div><button type="button" disabled={busy || uploading} onClick={() => edit(sponsor)}>Edit sponsor</button></article>)}{!sponsors.length && <p>No sponsors yet. Add your first partner below.</p>}</div>
      <form key={formKey} onSubmit={save} className={styles.form}>
        <h3>{editing ? `Edit ${editing.name}` : "Add a sponsor"}</h3>
        <fieldset disabled={busy || uploading}><div className={styles.fields}>
          <label>Sponsor name<input name="name" required minLength={2} maxLength={150} defaultValue={editing?.name ?? ""} /></label>
          <label>Partner description<input name="label" maxLength={150} placeholder="e.g. Official equipment partner" defaultValue={editing?.sponsor_type ?? ""} /></label>
          <label>Website link<input name="website" type="url" placeholder="https://" defaultValue={editing?.website_url ?? ""} /></label>
          <label>Sponsor scope<select value={scope} onChange={e => { const next = e.target.value as SponsorScope; setScope(next); setTarget(""); setPositions(next === "club" ? ["above-footer"] : ["above-tables"]); }}><option value="club">Whole club</option><option value="league">Specific league</option><option value="division">Specific division</option><option value="event">Specific event</option></select></label>
          {scope !== "club" && <label>{scope === "league" ? "League" : scope === "division" ? "Division" : "Event"}<select required value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose {scope}</option>{scope === "division" ? seasons.map(league => <optgroup key={league.id} label={league.name}>{league.divisions.map(division => <option key={division.id} value={division.id}>{division.name}</option>)}</optgroup>) : (scope === "league" ? seasons : events).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <label>Display order<input type="number" name="order" min="0" max="9999" defaultValue={editing?.sort_order ?? 0} /><small>Lower numbers appear first within the same sponsor priority.</small></label>
          <label>Upload logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e.target.files?.[0])} /><small>PNG, JPEG or WebP, up to 5 MB. Logos keep their proportions.</small></label>
          <label>Or use a logo URL<input type="url" value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://" /></label>
        </div>
        <fieldset className={styles.placements}><legend>Show this sponsor</legend>{SPONSOR_POSITIONS.map(item => <label key={item.value}><input type="checkbox" checked={positions.includes(item.value)} onChange={e => setPositions(old => e.target.checked ? [...old, item.value] : old.filter(value => value !== item.value))} />{item.label}</label>)}</fieldset>
        {scope === "club" && <label className={styles.check}><input type="checkbox" name="main" defaultChecked={editing?.is_main ?? false} />Make this the main club sponsor</label>}
        <label className={styles.check}><input type="checkbox" name="active" defaultChecked={editing?.is_active ?? true} />Active and visible to players</label>
        <p>League, division and event sponsors use a larger logo panel. Scoped sponsors only appear with the selected competition. Placements apply to the public league hub and events pages.</p>
        <div className={styles.actions}><button type="submit">{busy ? "Saving…" : editing ? "Save sponsor" : "Add sponsor"}</button>{editing && <button type="button" onClick={() => edit(null)}>Cancel editing</button>}</div>
        </fieldset>
      </form>
      <form onSubmit={saveSettings} className={styles.form}><h3>Sponsorship enquiries</h3><p>Unsponsored leagues and events can display a small invitation linking directly to the club.</p><fieldset disabled={busy || uploading}><label>Club contact email<input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} /><small>This also updates the club’s main contact email. No invitation is shown without an email.</small></label><label className={styles.check}><input type="checkbox" checked={enquiries} onChange={e => setEnquiries(e.target.checked)} />Show “Sponsor this league / event” when there is no matching sponsor</label><button type="submit">Save enquiry settings</button></fieldset></form>
      <details className={styles.preview}><summary>Preview sponsorship invitation</summary><ClubSponsors sponsors={[]} context={{clubId}} position="above-tables" enquiry={{enabled:enquiries,email:contactEmail,name:"Your league"}} /></details>
    </>}
  </section>;
}

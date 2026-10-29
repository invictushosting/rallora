"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase";
import {accountRecoveryNotice} from "@/lib/account-recovery";
import RalloraLogo from "@/app/components/rallora-logo";
import SupportForm from "@/app/components/support-form";
import styles from "./account.module.css";

type ClubAccess={club_id:string;role:string;clubs:{slug:string;name:string}|null};
type ClubChoice={id:string;name:string;town:string|null};

export default function AccountPage(){
  const supabase=useMemo(()=>createClient(),[]);
  const [email,setEmail]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [phone,setPhone]=useState("");
  const [profileMessage,setProfileMessage]=useState("");
  const [playingLevel,setPlayingLevel]=useState("");
  const [homeTown,setHomeTown]=useState("");
  const [preferredClubs,setPreferredClubs]=useState<string[]>([]);
  const [partnerPreference,setPartnerPreference]=useState("");
  const [clubs,setClubs]=useState<ClubChoice[]>([]);
  const [profileLoading,setProfileLoading]=useState(true);
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [signedIn,setSignedIn]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [clubAccess,setClubAccess]=useState<ClubAccess[]>([]);
  const [returnClub,setReturnClub]=useState("");
  const [returnToCaptain,setReturnToCaptain]=useState(false);
  const [platformAdmin,setPlatformAdmin]=useState(false);

  useEffect(()=>{
    const params=new URL(window.location.href).searchParams;
    setMessage(accountRecoveryNotice(window.location.search,window.location.hash));
    setReturnClub(params.get("club")||"");
    setReturnToCaptain(params.get("return")==="captain");
    void (async()=>{
      const {data,error}=await supabase.auth.getUser();
      if(error||!data.user){setSignedIn(false);setProfileLoading(false);return}
      setSignedIn(true);
      setEmail(data.user.email??"");
      const [profile,clubsReply]=await Promise.all([
        supabase.from("rallora_player_profiles").select("display_name,phone,playing_level,home_town,preferred_club_ids,partner_preference").eq("user_id",data.user.id).maybeSingle(),
        supabase.from("clubs").select("id,name,town").eq("is_active",true).order("name")
      ]);
      if(!clubsReply.error)setClubs((clubsReply.data??[]) as ClubChoice[]);
      if(!profile.error&&profile.data){
        setDisplayName(profile.data.display_name??"");setPhone(profile.data.phone??"");
        setPlayingLevel(profile.data.playing_level??"");
        setHomeTown(profile.data.home_town??"");
        setPreferredClubs(profile.data.preferred_club_ids??[]);
        setPartnerPreference(profile.data.partner_preference??"");
      }
      else setDisplayName(typeof data.user.user_metadata?.display_name==="string"?data.user.user_metadata.display_name:"");
      setProfileLoading(false);
       const platform=await supabase.from("rallora_platform_admins").select("user_id").eq("user_id",data.user.id).maybeSingle();
       setPlatformAdmin(Boolean(platform.data));
      const memberships=await supabase.from("rallora_club_memberships")
        .select("club_id,role,clubs(slug,name)")
        .eq("user_id",data.user.id).eq("status","active");
      if(!memberships.error)setClubAccess((memberships.data??[]) as unknown as ClubAccess[]);
    })();
  },[supabase]);

  async function saveProfile(e:React.FormEvent){
    e.preventDefault();setProfileMessage("");
    const name=displayName.trim();
    if(name.length<2||name.length>120){setProfileMessage("Enter a name of 2–120 characters.");return;}
    setBusy(true);
    const {data:{user},error}=await supabase.auth.getUser();
    if(error||!user){setBusy(false);setProfileMessage("Please sign in again.");return;}
    const saved=await supabase.from("rallora_player_profiles").upsert({
      user_id:user.id,display_name:name,phone:phone.trim()||null,
      playing_level:playingLevel||null,home_town:homeTown.trim()||null,
      preferred_club_ids:preferredClubs,partner_preference:partnerPreference||null,
      updated_at:new Date().toISOString()
    },{onConflict:"user_id"});
    setProfileMessage(saved.error?.message??"Player profile saved.");setBusy(false);
  }

  async function reset(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/account`});
    setMessage(error?.message??"If this account exists, a secure password-reset email has been sent.");
    setBusy(false);
  }

  async function update(e:React.FormEvent){
    e.preventDefault();setMessage("");
    if(password!==confirmPassword){setMessage("Passwords do not match.");return}
    setBusy(true);
    const {error}=await supabase.auth.updateUser({password});
    setMessage(error?.message??"Password updated successfully.");
    if(!error){setPassword("");setConfirmPassword("")}
    setBusy(false);
  }

  const canManageReturnClub=platformAdmin||clubAccess.some(item=>item.clubs?.slug===returnClub&&["owner","admin","organiser"].includes(item.role));
  const returnHref=returnClub?`/clubs/${encodeURIComponent(returnClub)}${returnToCaptain?"/captain":canManageReturnClub?"/admin":""}`:platformAdmin?"/platform":"/";
  const returnLabel=returnClub?(returnToCaptain?"← Back to Captain Centre":canManageReturnClub?"← Back to club admin":"← Back to club"):platformAdmin?"← Back to Platform":"← Back to Rallora";

  return <main className={styles.page}><section className={styles.card}>
    <div className={styles.topbar}>
      <Link className={styles.brand} href="/" aria-label="Rallora home"><RalloraLogo variant="light" width={150}/></Link>
      <Link className={styles.returnLink} href={returnHref}>{returnLabel}</Link>
    </div>

    <small>YOUR ACCOUNT</small>
    <h1>{signedIn?"Profile & security":"Reset your password"}</h1>
    <p>{signedIn?"Manage your Rallora account details and password.":"Enter your Rallora account email and we’ll send a secure recovery link."}</p>

    {signedIn&&<section className={styles.profileCard}>
      <div><span>Email</span><strong>{email}</strong></div>
      <div><span>Account type</span><strong>{platformAdmin?"Platform administrator":clubAccess.length?"Club administrator":"Rallora account"}</strong></div>
      {clubAccess.length>0&&<div className={styles.clubAccess}>
        <span>Club access</span>
        {clubAccess.map(item=><p key={item.club_id}><strong>{item.clubs?.name??"Club"}</strong><em>{item.role}</em></p>)}
      </div>}
    </section>}

    {signedIn&&<section className={styles.passwordSection} aria-labelledby="player-profile-heading">
      <h2 id="player-profile-heading">Your player profile</h2>
      <p>Your Rallora profile is independent of league registration. Update your details whenever you like.</p>
      <form onSubmit={saveProfile}>
        <label>Display name<input required minLength={2} maxLength={120} autoComplete="name" value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
        <label>Phone (optional)<input type="tel" maxLength={40} autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
        <label>Playing level<select value={playingLevel} onChange={e=>setPlayingLevel(e.target.value)}>
          <option value="">Not specified</option><option value="beginner">Beginner</option><option value="improver">Improver</option>
          <option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="competitive">Competitive</option>
        </select></label>
        <label>Town or city (optional)<input type="text" maxLength={120} minLength={2} placeholder="e.g. Manchester" value={homeTown} onChange={e=>setHomeTown(e.target.value)}/></label>
        <fieldset className={styles.preferencesFieldset}><legend>Preferred clubs (choose up to 10)</legend>
          <p>These are your interests, not competition registrations.</p>
          <div className={styles.clubChoices}>{clubs.map(club=><label key={club.id} className={styles.clubChoice}>
            <input type="checkbox" checked={preferredClubs.includes(club.id)} disabled={!preferredClubs.includes(club.id)&&preferredClubs.length>=10}
              onChange={e=>setPreferredClubs(current=>e.target.checked?[...current,club.id]:current.filter(id=>id!==club.id))}/>
            <span>{club.name}{club.town?` · ${club.town}`:""}</span>
          </label>)}</div>
          {!clubs.length&&<p>No active clubs to select yet.</p>}
        </fieldset>
        <label>Partner preference<select value={partnerPreference} onChange={e=>setPartnerPreference(e.target.value)}>
          <option value="">Not specified</option><option value="open">Open to playing with others</option>
          <option value="looking">Looking for a partner</option><option value="have_partner">I have a partner</option>
          <option value="not_looking">Not looking for a partner</option>
        </select></label>
        <p className={styles.privacyNote}>These preferences are private to your account. They do not make you publicly searchable or register you for a competition.</p>
        <button disabled={busy||profileLoading}>{busy?"Saving…":profileLoading?"Loading profile…":"Save player profile"}</button>
      </form>
      {profileMessage&&<p role="status" className={styles.message}>{profileMessage}</p>}
      <p>Ready to play? <Link href="/register">Find a club and explore competitions</Link>.</p><p>Looking for a padel partner? <Link href="/players/discover">Explore Rallora Social player discovery</Link> (optional and off by default).</p>
    </section>}
    {signedIn&&<section className={styles.installSection} aria-labelledby="install-rallora-heading">
      <h2 id="install-rallora-heading">Rallora on your home screen</h2>
      <p>Add the Rallora icon for quick access to your leagues, fixtures and results.</p>
      <details>
        <summary>iPhone or iPad</summary>
        <ol>
          <li>Open Rallora in Safari.</li>
          <li>Open the Share menu and choose <strong>Add to Home Screen</strong>. You may need to scroll down or use Edit Actions to find it.</li>
          <li>If shown, turn on <strong>Open as Web App</strong>, then tap <strong>Add</strong>.</li>
        </ol>
      </details>
      <details>
        <summary>Android</summary>
        <ol>
          <li>Open Rallora in Chrome.</li>
          <li>Open the three-dot menu and choose <strong>Add to home screen</strong> or <strong>Install app</strong>.</li>
          <li>Follow the browser’s instructions to add the Rallora icon.</li>
        </ol>
      </details>
      <p className={styles.installNote}>If you opened a link inside another app, open it in Safari or Chrome first. An internet connection is needed for live fixtures and results.</p>
    </section>}

    {signedIn?<section className={styles.passwordSection}>
      <h2>Change password</h2>
      <p>Choose a new password with at least 8 characters.</p>
      <form onSubmit={update}>
        <label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label>Confirm new password<input type="password" minLength={8} required autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        <button disabled={busy}>{busy?"Updating…":"Update password"}</button>
      </form>
    </section>:<form onSubmit={reset}>
      <label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <button disabled={busy}>{busy?"Sending…":"Send reset email"}</button>
    </form>}

    {message&&<p className={styles.message} role="status">{message}</p>}
    {signedIn&&!platformAdmin&&<SupportForm clubId={clubAccess.length===1?clubAccess[0].club_id:undefined}/>}
  </section></main>
}

"use client";
/* eslint-disable @next/next/no-img-element -- SVG preview must match the exported PNG. */
import{useEffect,useLayoutEffect,useMemo,useRef,useState}from'react';
import Link from'next/link';
import type{SupabaseClient}from'@supabase/supabase-js';
import RalloraLogo from'@/app/components/rallora-logo';
import RalloraFooter from'@/app/components/rallora-footer';
import{loadClubCampaigns}from'@/lib/social/campaign-source';
import{campaignRevision,campaignClockValid,type Campaign,type CampaignKind}from'@/lib/social/campaign-content';
import{GALLERY_HEIGHTS,renderCampaignTemplate,type GallerySize}from'@/lib/social/gallery';
import{clubBrand}from'@/lib/social/club-brand';
import{verifyStudioAccess,type StudioClub}from'@/lib/social/league-source';
import{downloadArtwork,loadArtworkLogo}from'@/lib/social/browser';
import{formatSocialCaption,type SocialChannel}from'@/lib/social/channels';
import styles from'./social.module.css';
type Props={client:SupabaseClient;club:StudioClub;userId:string;role:string;onLeague:()=>void};
const labels:Record<CampaignKind,string>={open:'Entries open',deadline:'Closing soon',event:'Club events',partner:'Sponsor spotlight',movement:'Promotions & relegations'};
export default function CampaignStudio({client,club,userId,role,onLeague}:Props){
 const[campaigns,setCampaigns]=useState<Campaign[]>([]),[notices,setNotices]=useState<string[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const[kind,setKind]=useState<CampaignKind>('open'),[selected,setSelected]=useState(''),[size,setSize]=useState<GallerySize>('square'),[slide,setSlide]=useState(0);
 const[logo,setLogo]=useState(''),[clubLogo,setClubLogo]=useState(''),[partnerLogo,setPartnerLogo]=useState(''),[partnerLogoFor,setPartnerLogoFor]=useState(''),[assetError,setAssetError]=useState(''),[partnerError,setPartnerError]=useState('');
 const[body,setBody]=useState(''),[channel,setChannel]=useState<SocialChannel>('Instagram'),[approval,setApproval]=useState(''),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const revisionRef=useRef(''),lock=useRef(false);
 useEffect(()=>{let active=true;setLoading(true);setError('');setApproval('');setBody('');setSlide(0);setFeedback('');void loadClubCampaigns(client,club.id).then(data=>{if(active){setCampaigns(data.campaigns);setNotices(data.notices);setLoading(false);}}).catch(()=>{if(active){setCampaigns([]);setError('Club campaign data could not be verified. Please retry.');setLoading(false);}});return()=>{active=false;};},[client,club.id,reload]);
 const choices=campaigns.filter(c=>c.kind===kind),campaign=choices.find(c=>c.id===selected)??choices[0];
 useEffect(()=>{let active=true;setLogo('');setClubLogo('');setAssetError('');void Promise.all([loadArtworkLogo(),club.logo_url?loadArtworkLogo(club.logo_url,{width:256,height:256}):Promise.resolve('')]).then(([r,c])=>{if(active){setLogo(r);setClubLogo(c);}}).catch(()=>{if(active)setAssetError('Club or Rallora artwork could not load. Refresh before exporting.');});return()=>{active=false;};},[club.logo_url,reload]);
 useEffect(()=>{let active=true;setPartnerLogo('');setPartnerLogoFor('');setPartnerError('');if(!campaign?.partnerLogoUrl)return;void loadArtworkLogo(campaign.partnerLogoUrl,{width:1000,height:300}).then(data=>{if(active){setPartnerLogo(data);setPartnerLogoFor(campaign.partnerLogoUrl??'');}}).catch(()=>{if(active)setPartnerError('Sponsor logo could not load. Refresh or correct the sponsor profile before exporting.');});return()=>{active=false;};},[campaign?.partnerLogoUrl,reload]);
 const brand=useMemo(()=>clubBrand(club,clubLogo),[club,clubLogo]);
 const artwork=campaign?renderCampaignTemplate({campaign,size,brand,slide,ralloraLogo:logo,partnerLogo:partnerLogoFor===campaign.partnerLogoUrl?partnerLogo:''}):null;
 const caption=body||artwork?.caption||'',revision=JSON.stringify({campaign:campaign?campaignRevision(campaign):'',size,slide,logo,clubLogo,partnerLogo,partnerLogoFor,caption,channel,loading,userId,kind});
 useLayoutEffect(()=>{revisionRef.current=revision;return()=>{revisionRef.current='';};},[revision]);
 const reviewed=approval===revision&&!loading&&Boolean(campaign),graphicsReady=reviewed&&Boolean(logo)&&!assetError&&!partnerError&&(!campaign?.partnerLogoUrl||Boolean(partnerLogo)&&partnerLogoFor===campaign.partnerLogoUrl);
 const origin=typeof window!=='undefined'?window.location.origin:'';
 const id=campaign?.id.slice((campaign?.id.indexOf(':')??0)+1)??'';
 const path=kind==='open'||kind==='deadline'?`/clubs/${encodeURIComponent(club.slug)}/register?season=${encodeURIComponent(id)}`:kind==='event'?`/clubs/${encodeURIComponent(club.slug)}/events`:club.slug==='gsm-padel'?'/clubs/gsm-padel/overview':`/clubs/${encodeURIComponent(club.slug)}`;
 async function handoff(action:'graphic'|'caption'){
  if(!reviewed||!campaign||!artwork||busy||lock.current)return;lock.current=true;setBusy(true);setFeedback('');const approved=revision,baseline=campaignRevision(campaign);
  try{
   await verifyStudioAccess(client,club.id,userId);
   const clubReply=await client.from('clubs').select('name,logo_url,primary_color,secondary_color,accent_color').eq('id',club.id).eq('is_active',true).maybeSingle();if(clubReply.error||!clubReply.data)throw new Error('This active club is unavailable.');const current=clubReply.data;
   if((['name','logo_url','primary_color','secondary_color','accent_color']as const).some(k=>current[k]!==club[k]))throw new Error('Club branding changed. Refresh the page and review it again.');
   const fresh=await loadClubCampaigns(client,club.id),updated=fresh.campaigns.find(c=>c.id===campaign.id);
   if(!updated||campaignRevision(updated)!==baseline){setCampaigns(fresh.campaigns);setNotices(fresh.notices);setBody('');setSlide(0);setApproval('');throw new Error('The campaign changed, expired or is no longer publishable. Refresh the selection and review the current details.');}
   if(revisionRef.current!==approved)throw new Error('This draft changed. Review it again before sharing.');
   if(!campaignClockValid(updated,club.id))throw new Error('Registration timing changed. Refresh this campaign before sharing.');
   if(action==='graphic'){if(!graphicsReady)throw new Error('Brand artwork must finish loading before exporting.');await downloadArtwork(artwork.svg,GALLERY_HEIGHTS[size],`rallora-${club.slug}-${kind}-${size}-${slide+1}.png`,()=>revisionRef.current===approved&&campaignClockValid(updated,club.id));setFeedback(`Graphic ${slide+1} of ${artwork.slides} downloaded. Nothing published.`);}
   else{await navigator.clipboard.writeText(formatSocialCaption(channel,'',caption,origin+path));setFeedback(`${channel} caption copied. Publish through your own account.`);}
  }catch(e){setApproval('');setFeedback(e instanceof Error?e.message:'Could not verify this campaign.');}finally{lock.current=false;setBusy(false);}
 }
 return <main className={styles.page}><div className={styles.shell}><header className={styles.header}><Link href="/" aria-label="Rallora home"><RalloraLogo width={190}/></Link><nav><button type="button" className={styles.studioNavButton} onClick={onLeague}>← League gallery</button><Link href={`/clubs/${encodeURIComponent(club.slug)}/admin`}>Club dashboard</Link></nav></header>
 <section className={styles.hero}><span className={styles.eyebrow}>RALLORA SOCIAL · CLUB CAMPAIGNS</span><h1>More reasons to play.</h1><p>Verified club announcements for <strong>{club.name}</strong>. Signed in as {role}.</p><span className={styles.phase}>CREATE · REVIEW · EXPORT</span></section>
 <div className={styles.types} role="group" aria-label="Campaign type">{(Object.keys(labels)as CampaignKind[]).map(k=><button type="button" key={k} aria-pressed={kind===k} onClick={()=>{setKind(k);setSelected('');setBody('');setSlide(0);setFeedback('');}}>{labels[k]}</button>)}<button type="button" onClick={()=>setReload(n=>n+1)}>Refresh sources</button></div>
 {loading&&<p className={styles.notice} role="status">Checking club campaign sources…</p>}{error&&<p className={styles.notice} role="alert">{error}</p>}{notices.map(n=><p className={styles.notice} key={n}>{n}</p>)}
 {!loading&&!error&&<div className={styles.connectedGrid}><section className={styles.editor}><span className={styles.step}>01 / SELECT VERIFIED CONTENT</span><h2>{labels[kind]}</h2><label className={styles.field}>Club record<select value={campaign?.id??''} onChange={e=>{setSelected(e.target.value);setSlide(0);setBody('');}}>{!choices.length&&<option value="">No eligible records</option>}{choices.map(c=><option value={c.id} key={c.id}>{c.kind==='partner'?c.partnerName:c.title} · {c.context}</option>)}</select></label>
 {!campaign&&<p className={styles.notice}>{kind==='open'||kind==='deadline'?'No published registration is currently open for this design. Deadlines require a saved closing time.':kind==='event'?'No upcoming published club event is available.':kind==='partner'?'No active sponsor with a verified club, league, division or event scope is available.':'No verified promotion or relegation records are available for an active cycle. Private drafts and changed pairings are excluded.'}</p>}
 {campaign&&<div className={styles.sourceSummary}><strong>{campaign.title}</strong><span>{campaign.detail}</span>{campaign.dateLabel&&<span>{campaign.dateLabel}</span>}</div>}
 <p className={styles.disclaimer}>Dates and announcements come from club records. A countdown is checked again before export. Event artwork does not invent a time, booking availability or price. Movement posts use recorded active-cycle changes, not predicted standings. This workspace is session-only and does not publish or schedule posts.</p></section><section className={styles.preview}><span className={styles.step}>02 / REVIEW & EXPORT</span><h2>{labels[kind]}</h2><label className={styles.field}>Graphic format<select value={size} onChange={e=>{setSize(e.target.value as GallerySize);setSlide(0);}}>{Object.entries(GALLERY_HEIGHTS).map(([k,h])=><option value={k} key={k}>{k} · 1080 × {h}</option>)}</select></label>
 {artwork&&<><img className={styles.artwork} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(artwork.svg)}`} alt={`${club.name} ${labels[kind]} artwork`} width={1080} height={GALLERY_HEIGHTS[size]}/>{artwork.slides>1&&<div className={styles.slideControls}><button type="button" disabled={slide===0} onClick={()=>setSlide(n=>n-1)}>← Previous</button><span>Page {slide+1} of {artwork.slides}</span><button type="button" disabled={slide>=artwork.slides-1} onClick={()=>setSlide(n=>n+1)}>Next →</button></div>}<label className={styles.field}>Caption<textarea value={caption} onChange={e=>setBody(e.target.value)} rows={7} maxLength={20000}/></label><label className={styles.field}>Caption channel<select value={channel} onChange={e=>setChannel(e.target.value as SocialChannel)}>{['Instagram','Facebook','WhatsApp'].map(c=><option key={c}>{c}</option>)}</select></label><pre className={styles.captionPreview}>{formatSocialCaption(channel,'',caption,origin+path)}</pre><label className={styles.reviewCheck}><input type="checkbox" checked={reviewed} onChange={e=>setApproval(e.target.checked?revision:'')}/><span>I’ve checked this page, the current facts, caption and permission to share the named people and sponsor artwork.</span></label><button type="button" className={styles.download} disabled={!graphicsReady||busy} onClick={()=>void handoff('graphic')}>{busy?'Checking current source…':`Download ${artwork.slides>1?'page '+(slide+1):'graphic'} ↓`}</button><button type="button" className={styles.deviceShare} disabled={!reviewed||busy} onClick={()=>void handoff('caption')}>Copy {channel} caption</button></>}
 {(assetError||partnerError)&&<p className={styles.notice} role="alert">{assetError||partnerError}</p>}{feedback&&<p className={styles.feedback} role="status">{feedback}</p>}
 </section></div>}<RalloraFooter club={club.slug} note="Manual export only. Your social accounts are not connected."/></div></main>;
}

"use client";
/* eslint-disable @next/next/no-img-element -- SVG preview is the exact source used for PNG export. */
import{useEffect,useLayoutEffect,useMemo,useRef,useState}from'react';
import Link from 'next/link';
import type{SupabaseClient}from'@supabase/supabase-js';
import RalloraLogo from '@/app/components/rallora-logo';
import RalloraFooter from '@/app/components/rallora-footer';
import{CLUB_TEMPLATES,CONNECTED_TEMPLATE_IDS,GALLERY_HEIGHTS,renderLeagueTemplate,type ConnectedTemplate,type GallerySize,type GalleryLeagueData}from'@/lib/social/gallery';
import{loadLeagueSource,loadStudioSeasons,verifyStudioAccess,type StudioClub,type StudioSeason}from'@/lib/social/league-source';
import{leagueRevision,selectLeagueContent,type LeagueContent,type SourceSelection}from'@/lib/social/league-content';
import{downloadArtwork,loadArtworkLogo}from'@/lib/social/browser';
import{formatSocialCaption,type SocialChannel}from'@/lib/social/channels';
import{clubBrand}from'@/lib/social/club-brand';
import styles from './social.module.css';
type Props={client:SupabaseClient;club:StudioClub;userId:string;role:string;onNews:()=>void;onCampaigns:()=>void};
const allowedTemplates=CLUB_TEMPLATES.filter(t=>(CONNECTED_TEMPLATE_IDS as readonly string[]).includes(t.id));
export default function LeagueStudio({client,club,userId,role,onNews,onCampaigns}:Props){
  const[seasons,setSeasons]=useState<StudioSeason[]>([]),[seasonId,setSeasonId]=useState(''),[source,setSource]=useState<LeagueContent|null>(null);
  const[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const[kind,setKind]=useState<SourceSelection['kind']>('result'),[matchId,setMatchId]=useState(''),[round,setRound]=useState(0),[divisionId,setDivisionId]=useState('');
  const[template,setTemplate]=useState<ConnectedTemplate>('scoreboard'),[size,setSize]=useState<GallerySize>('square'),[slide,setSlide]=useState(0),[search,setSearch]=useState('');
  const[logo,setLogo]=useState(''),[clubLogo,setClubLogo]=useState(''),[assetError,setAssetError]=useState(''),[photo,setPhoto]=useState('');
  const[body,setBody]=useState(''),[approval,setApproval]=useState(''),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
  const[channel,setChannel]=useState<SocialChannel>('Instagram');
  const activeRevision=useRef('');
  const activeLeague=useRef(seasonId);
  const handoffActive=useRef(false);
  const photoSequence=useRef(0);
  useLayoutEffect(()=>{activeLeague.current=seasonId;return()=>{activeLeague.current='';};},[seasonId]);
  useEffect(()=>{let active=true;setLoading(true);setError('');void loadStudioSeasons(client,club.id).then(rows=>{if(active){setSeasons(rows);setSeasonId(rows[0]?.id??'');if(!rows.length)setLoading(false);}}).catch(()=>{if(active){setError('Could not load published leagues.');setLoading(false);}});return()=>{active=false;};},[client,club.id]);
  useEffect(()=>{let active=true;if(!seasonId)return;setSource(null);setLoading(true);setError('');photoSequence.current++;setPhoto('');setBody('');setApproval('');setFeedback('');
    void loadLeagueSource(client,club.id,seasonId).then(data=>{if(active){setSource(data);setMatchId(data.matches[0]?.id??'');setRound(data.matches[0]?.round??0);setDivisionId(data.divisions[0]?.id??'');setSlide(0);setLoading(false);}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'Could not load this league.');setLoading(false);}});return()=>{active=false;};},[client,club.id,seasonId,reload]);
  useEffect(()=>{let active=true;setLogo('');setClubLogo('');setAssetError('');void Promise.all([loadArtworkLogo(),club.logo_url?loadArtworkLogo(club.logo_url,{width:256,height:256}):Promise.resolve('')]).then(([r,c])=>{if(active){setLogo(r);setClubLogo(c);}}).catch(()=>{if(active)setAssetError('Club or Rallora artwork could not load. Check the club logo or refresh before exporting.');});return()=>{active=false;};},[club.logo_url,reload]);
  const selection:SourceSelection={kind,matchId,round,divisionId};
  const picked=source?selectLeagueContent(source,selection):null;
  const sourceRevision=source?leagueRevision(source,selection):'';
  const brand=useMemo(()=>clubBrand(club,clubLogo),[club,clubLogo]);
  const galleryData:GalleryLeagueData={season:source?.season??'',round:kind==='roundup'?round:picked?.matches[0]?.round,division:kind==='table'?source?.divisions.find(d=>d.id===divisionId)?.name:picked?.matches[0]?.division,
    matches:picked?.matches.map(m=>({id:m.id,home:m.home,away:m.away,h:m.homeScores,a:m.awayScores,division:m.division})),standings:picked?.standings};
  const available=allowedTemplates.filter(t=>kind==='result'?t.category==='Results':kind==='roundup'?t.category==='Roundups':t.category==='Tables');
  const artwork=picked?.hasContent?renderLeagueTemplate({template,size,brand,ralloraLogo:logo,photo,slide,data:galleryData}):null;
  const caption=body||artwork?.caption||'';
  const revision=JSON.stringify({club:club.id,user:userId,source:sourceRevision,template,size,slide,photo,logo,clubLogo,caption,channel,seasonId,loading,error});
  useLayoutEffect(()=>{activeRevision.current=revision;return()=>{activeRevision.current='';};},[revision]);
  const reviewed=approval===revision&&Boolean(artwork)&&source?.seasonId===seasonId&&!loading;
  const artworkUrl=artwork?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(artwork.svg)}`:'';
  const rounds=[...new Set(source?.matches.map(m=>m.round)??[])].sort((a,b)=>b-a);
  const visibleMatches=source?.matches.filter(m=>`${m.home.join(' ')} ${m.away.join(' ')} ${m.division} ${m.round}`.toLowerCase().includes(search.toLowerCase()))??[];
  const clubPath=club.slug==='gsm-padel'?'/clubs/gsm-padel/overview':`/clubs/${encodeURIComponent(club.slug)}`;
  const clubUrl=(typeof window!=='undefined'?window.location.origin:'')+clubPath+`?view=${kind==='table'?'tables':'results'}&season=${encodeURIComponent(seasonId)}`;
  const thumbnails=available.map(t=>({template:t,art:picked?.hasContent?renderLeagueTemplate({template:t.id as ConnectedTemplate,size:'square',brand,ralloraLogo:logo,photo,slide:0,data:galleryData}):null}));
  function changeKind(next:SourceSelection['kind']){setKind(next);setTemplate(next==='result'?'scoreboard':next==='roundup'?'grid':'table');setSlide(0);setBody('');setFeedback('');}
  function changeSource(update:()=>void){update();setSlide(0);setBody('');setFeedback('');}
  async function handoff(action:'graphic'|'caption'){
    if(!reviewed||!source||source.seasonId!==seasonId||!artwork||busy||handoffActive.current)return;
    handoffActive.current=true;
    const approved=revision,baseline=sourceRevision;setBusy(true);setFeedback('');
    try{
      await verifyStudioAccess(client,club.id,userId);
      const currentClub=await client.from('clubs').select('id,name,logo_url,primary_color,secondary_color,accent_color').eq('id',club.id).eq('is_active',true).maybeSingle();
      if(currentClub.error||!currentClub.data)throw new Error('This active club is no longer available.');
      const currentBrand=currentClub.data;
      if((['name','logo_url','primary_color','secondary_color','accent_color'] as const).some(key=>currentBrand[key]!==club[key]))throw new Error('Club branding changed. Refresh the page and review the updated design.');
      const fresh=await loadLeagueSource(client,club.id,seasonId);
      if(leagueRevision(fresh,selection)!==baseline){setSource(fresh);setBody('');setApproval('');setSlide(0);throw new Error('League data changed. The artwork and caption have been rebuilt. Review them before sharing.');}
      if(activeRevision.current!==approved)throw new Error('This draft changed. Review it again before sharing.');
      if(action==='graphic'){
        if(!logo||assetError)throw new Error('Brand artwork must finish loading before exporting.');
        await downloadArtwork(artwork.svg,GALLERY_HEIGHTS[size],`rallora-${club.slug}-${template}-${size}-${slide+1}.png`,()=>activeRevision.current===approved);
        setFeedback(`Graphic ${slide+1} of ${artwork.slides} downloaded. Copy the caption to share alongside it.`);
      }else{await navigator.clipboard.writeText(formatSocialCaption(channel,'',caption,clubUrl));setFeedback(`${channel} caption copied. Publish it through your own account.`);}
    }catch(e){setApproval('');setFeedback(e instanceof Error?e.message:'Could not verify this content. Please retry.');}finally{handoffActive.current=false;setBusy(false);}
  }
  async function choosePhoto(file?:File){if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024){setFeedback('Choose a PNG or JPEG under 5 MB.');return;}const selectedLeague=seasonId,photoRequest=++photoSequence.current;const url=URL.createObjectURL(file);try{const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Could not read this photo.'));img.src=url;});if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('This image is too large. Choose a smaller photo.');const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const context=canvas.getContext('2d');if(!context)throw new Error('Photo editing is unavailable in this browser.');context.drawImage(img,0,0,canvas.width,canvas.height);if(activeLeague.current!==selectedLeague||photoRequest!==photoSequence.current)return;setPhoto(canvas.toDataURL('image/jpeg',.9));setFeedback('Photo loaded for this session only. Check permission before sharing it.');}catch(e){setFeedback(e instanceof Error?e.message:'Could not read the photo.');}finally{URL.revokeObjectURL(url);}}
  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.header}><Link href="/" aria-label="Rallora home"><RalloraLogo width={190}/></Link><nav><Link href={`/clubs/${encodeURIComponent(club.slug)}/admin`}>Club dashboard</Link><Link href="/help/social-studio">Studio guide</Link></nav></header>
    <section className={styles.hero}><span className={styles.eyebrow}>RALLORA SOCIAL · CLUB COLLECTION</span><h1>Your club. Your story.</h1><p>Turn verified league activity into branded content for <strong>{club.name}</strong>. Signed in as {role}.</p><span className={styles.phase}>CREATE · REVIEW · EXPORT</span></section>
    <div className={styles.leagueToolbar}><label className={styles.field}>Published league<select value={seasonId} onChange={e=>{setSeasonId(e.target.value);setSearch('');}}>{!seasons.length&&<option value="">No published leagues</option>}{seasons.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button type="button" onClick={()=>{setApproval('');setReload(n=>n+1);}}>Refresh league data</button><button type="button" onClick={onCampaigns}>Club campaigns →</button><button type="button" onClick={onNews}>Club news editor →</button></div>
    <div className={styles.types} role="group" aria-label="Content type">{(['result','roundup','table'] as const).map(k=><button type="button" key={k} aria-pressed={kind===k} onClick={()=>changeKind(k)}>{k==='result'?'Match results':k==='roundup'?'Round roundups':'League tables'}</button>)}</div>
    {loading&&<p className={styles.notice} role="status">Loading the complete league source…</p>}{error&&<p className={styles.notice} role="alert">{error}</p>}
    {!loading&&!error&&!seasons.length&&<p className={styles.notice}>Publish a league before preparing result or table artwork. You can still create club news.</p>}
    {source&&source.seasonId===seasonId&&!loading&&!error&&<div className={styles.connectedGrid}><section className={styles.editor}>
      <span className={styles.step}>01 / CHOOSE YOUR CONTENT</span>
      {kind==='result'&&<><label className={styles.field}>Find a result<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Player, division or round"/></label><label className={styles.field}>Confirmed result<select value={matchId} onChange={e=>changeSource(()=>setMatchId(e.target.value))}><option value="">Choose a result</option>{visibleMatches.map(m=><option value={m.id} key={m.id}>{m.division} · Round {m.round} · {m.home.join(' / ')} vs {m.away.join(' / ')}</option>)}</select></label></>}
      {kind==='roundup'&&<label className={styles.field}>Round<select value={round} onChange={e=>changeSource(()=>setRound(Number(e.target.value)))}>{!rounds.length&&<option value={0}>No confirmed results</option>}{rounds.map(r=><option value={r} key={r}>Round {r}</option>)}</select><span>Includes every confirmed, released result in this league and round. Extra results continue on additional pages.</span></label>}
      {kind==='table'&&<label className={styles.field}>Division<select value={divisionId} onChange={e=>changeSource(()=>setDivisionId(e.target.value))}>{source.divisions.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select><span>Uses the same points, score difference and pairing-name order as the league hub. Additional pairings continue on more pages.</span></label>}
      {kind==='table'&&!source.tablesSafe&&<p className={styles.notice} role="alert">This table includes unreleased or incomplete source records. Table artwork is unavailable until the source can be verified.</p>}
      {!picked?.hasContent&&<p className={styles.notice}>No verified content is available for this selection. Choose another source or refresh after results are confirmed.</p>}
      <span className={styles.step}>02 / CHOOSE A DESIGN</span><div className={styles.templateGrid}>{thumbnails.map(({template:t,art})=><button type="button" key={t.id} aria-pressed={template===t.id} onClick={()=>{setTemplate(t.id as ConnectedTemplate);setSlide(0);}} disabled={!art}>{art&&<><img alt={`${t.name} preview`} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`}/></>}<strong>{t.name}</strong><span>{t.description}</span></button>)}</div>
      {template==='photo'&&<label className={styles.field}>Club photo<input type="file" accept="image/png,image/jpeg" onChange={e=>{void choosePhoto(e.target.files?.[0]);e.target.value='';}}/><span>PNG or JPEG under 5 MB. Used for this session only; never uploaded or autosaved.</span>{photo&&<button type="button" onClick={()=>{photoSequence.current++;setPhoto('');}}>Remove photo</button>}</label>}
      <p className={styles.disclaimer}>Your club name, logo and colours come from the club profile. Sponsor, registration, event and movement designs remain in the design preview until their data sources are connected. This workspace stays in memory; it is not a shared or saved draft.</p>
    </section><section className={styles.preview}>
      <span className={styles.step}>03 / REVIEW & EXPORT</span><h2>{CLUB_TEMPLATES.find(t=>t.id===template)?.name}</h2>
      <label className={styles.field}>Graphic format<select value={size} onChange={e=>{setSize(e.target.value as GallerySize);setSlide(0);}}>{Object.entries(GALLERY_HEIGHTS).map(([k,h])=><option value={k} key={k}>{k[0].toUpperCase()+k.slice(1)} · 1080 × {h}</option>)}</select></label>
      {artwork&&<><img className={styles.artwork} alt={`${club.name} ${template} artwork`} src={artworkUrl} width={1080} height={GALLERY_HEIGHTS[size]}/>
      {artwork.slides>1&&<div className={styles.slideControls}><button type="button" disabled={slide===0} onClick={()=>setSlide(n=>n-1)}>← Previous</button><span>Page {slide+1} of {artwork.slides}</span><button type="button" disabled={slide>=artwork.slides-1} onClick={()=>setSlide(n=>n+1)}>Next →</button></div>}
      <p className={styles.previewHint}>Artwork facts stay tied to the selected league source. Longer names may wrap or shorten visually; the caption contains the full names.</p>
      <label className={styles.field}>Caption<textarea value={caption} onChange={e=>setBody(e.target.value)} maxLength={20000} rows={7}/><span>Check every page before sharing. Instagram and WhatsApp captions are shortened to fit the channel; use the artwork pages and league link for complete results.</span></label>
      <label className={styles.field}>Caption channel<select value={channel} onChange={e=>setChannel(e.target.value as SocialChannel)}>{(['Instagram','Facebook','WhatsApp'] as const).map(c=><option key={c}>{c}</option>)}</select></label>
      <pre className={styles.captionPreview}>{formatSocialCaption(channel,'',caption,clubUrl)}</pre>
      <label className={styles.reviewCheck}><input type="checkbox" checked={reviewed} onChange={e=>setApproval(e.target.checked?revision:'')}/><span>I’ve checked this page, the caption and permission to share the named players and any photo.</span></label>
      <button type="button" className={styles.download} disabled={!reviewed||busy||!logo||Boolean(assetError)||(template==='photo'&&!photo)} onClick={()=>void handoff('graphic')}>{busy?'Checking current source…':`Download ${artwork.slides>1?`page ${slide+1}`:'graphic'} ↓`}</button>
      {template==='photo'&&!photo&&<p className={styles.notice}>Choose a club photo before exporting this photo-led design.</p>}
      <button type="button" className={styles.deviceShare} disabled={!reviewed||busy} onClick={()=>void handoff('caption')}>Copy {channel} caption</button></>}
      {assetError&&<p className={styles.notice} role="alert">{assetError}</p>}{feedback&&<p className={styles.feedback} role="status">{feedback}</p>}
    </section></div>}
    <RalloraFooter club={club.slug} note="Manual export only. Social accounts are not connected and nothing is automatically published."/>
  </div></main>;
}

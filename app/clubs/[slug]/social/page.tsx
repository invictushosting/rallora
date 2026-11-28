"use client";
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {createClient} from '@/lib/supabase';
import RalloraLogo from '@/app/components/rallora-logo';
import {verifyStudioAccess,type StudioClub} from '@/lib/social/league-source';
import LeagueStudio from './league-studio';
import LegacyStudio from './legacy-studio';
import CampaignStudio from './campaign-studio';
import styles from './social.module.css';
type Access={club:StudioClub;userId:string;role:string};
export default function ClubSocialStudio(){
  const params=useParams(),slug=typeof params.slug==='string'?params.slug:'';
  const client=useMemo(()=>createClient(),[]);
  const [access,setAccess]=useState<Access|null>(null),[error,setError]=useState(''),[mode,setMode]=useState<'league'|'news'|'campaigns'>('league');
  useEffect(()=>{
    let active=true,sequence=0;
    async function load(){const current=++sequence;if(active){setAccess(null);setError('');}
      try{
        if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error('Club unavailable.');
        const auth=await client.auth.getUser();if(!auth.data.user)throw new Error('Sign in through your club dashboard to open Social Studio.');
        const club=await client.from('clubs').select('id,slug,name,short_name,primary_color,secondary_color,accent_color,logo_url').eq('slug',slug).eq('is_active',true).maybeSingle();
        if(club.error||!club.data)throw new Error('This active club is unavailable.');
        const permission=await verifyStudioAccess(client,club.data.id,auth.data.user.id);
        if(active&&sequence===current)setAccess({club:club.data as StudioClub,...permission});
      }catch(e){if(active&&sequence===current)setError(e instanceof Error?e.message:'Could not open the studio.');}}
    void load();const {data}=client.auth.onAuthStateChange(()=>{window.setTimeout(()=>{if(active)void load();},0);});
    return()=>{active=false;sequence++;data.subscription.unsubscribe();};
  },[client,slug]);
  if(!access)return <main className={styles.page}><section className={styles.empty}><RalloraLogo width={180}/><h1>{error?'Social Studio unavailable':'Opening Social Studio…'}</h1><p role={error?'alert':'status'}>{error||'Checking your club permissions…'}</p><Link href={`/clubs/${encodeURIComponent(slug)}/admin`}>Club dashboard →</Link></section></main>;
  if(mode==='campaigns')return <CampaignStudio key={`${access.club.id}:${access.userId}`} client={client} {...access} onLeague={()=>setMode('league')}/>;
  if(mode==='news')return <><div className={styles.legacyBack}><button type="button" onClick={()=>setMode('league')}>← League template gallery</button></div><LegacyStudio/></>;
  return <LeagueStudio key={`${access.club.id}:${access.userId}`} client={client} {...access} onNews={()=>setMode('news')} onCampaigns={()=>setMode('campaigns')}/>;
}

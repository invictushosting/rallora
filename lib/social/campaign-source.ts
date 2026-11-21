import type{SupabaseClient}from'@supabase/supabase-js';
import{collectSourcePages}from'./league-content';
import{registrationCampaigns,samePair,type Campaign,type CampaignSeason}from'./campaign-content';
type Event={id:string;club_id:string;name:string;status:string;event_date:string;format:string;public_notes:string|null};
type Sponsor={id:string;club_id:string;name:string;sponsor_type:string|null;logo_url:string|null;scope_type:string;scope_id:string|null;is_active:boolean};
type Division={id:string;season_id:string;name:string};
type MovementTeam={id:string;division_id:string;player_one_name:string|null;player_two_name:string|null;previous_team_id:string|null;cycle_movement:string|null;is_active:boolean|null};
const names=(t:MovementTeam)=>[t.player_one_name,t.player_two_name].filter((s):s is string=>Boolean(s?.trim()));
export async function loadClubCampaigns(client:SupabaseClient,clubId:string,now=Date.now()):Promise<{campaigns:Campaign[];notices:string[]}>{
 const seasons=await collectSourcePages<CampaignSeason>((f,t)=>client.from('seasons').select('id,club_id,name,status,previous_season_id,registration_published,registration_opens_at,registration_closes_at').eq('club_id',clubId).in('status',['draft','active','completed']).order('id').range(f,t));
 const campaigns=registrationCampaigns(seasons,clubId,now),notices:string[]=[];
 let events:Event[]=[];
 try{events=await collectSourcePages<Event>((f,t)=>client.from('rallora_club_events').select('id,club_id,name,status,event_date,format,public_notes').eq('club_id',clubId).eq('status','published').order('id').range(f,t));}catch{notices.push('Event data could not be verified. Event and event-sponsor designs are unavailable.');}
 const today=new Date(now).toISOString().slice(0,10);
 for(const e of events){if(e.club_id!==clubId||e.status!=='published'||!/^\d{4}-\d{2}-\d{2}$/.test(e.event_date)||e.event_date<today)continue;const date=new Date(e.event_date+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==e.event_date)continue;
  campaigns.push({id:'event:'+e.id,kind:'event',title:e.name,context:e.format.replaceAll('_',' '),detail:e.public_notes?.trim()||'View the published club event on Rallora.',day:new Intl.DateTimeFormat('en-GB',{day:'2-digit',timeZone:'UTC'}).format(date),month:new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(date).toUpperCase(),weekday:new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(date).toUpperCase(),dateLabel:e.event_date,source:e});}
 const divisions:Division[]=[];
 for(let i=0;i<seasons.length;i+=40){const ids=seasons.slice(i,i+40).map(s=>s.id);divisions.push(...await collectSourcePages<Division>((f,t)=>client.from('divisions').select('id,season_id,name').in('season_id',ids).order('id').range(f,t)));}
 try{const sponsors=await collectSourcePages<Sponsor>((f,t)=>client.from('sponsors').select('id,club_id,name,sponsor_type,logo_url,scope_type,scope_id,is_active').eq('club_id',clubId).eq('is_active',true).order('id').range(f,t));
  for(const sponsor of sponsors){if(sponsor.club_id!==clubId||!sponsor.is_active)continue;
   const season=seasons.find(s=>s.id===sponsor.scope_id&&['active','completed'].includes(s.status)),division=divisions.find(d=>d.id===sponsor.scope_id&&seasons.some(s=>s.id===d.season_id&&['active','completed'].includes(s.status))),event=events.find(e=>e.id===sponsor.scope_id&&e.event_date>=today);
   const context=sponsor.scope_type==='club'?'Club partner':sponsor.scope_type==='league'&&season?season.name:sponsor.scope_type==='division'&&division?division.name:sponsor.scope_type==='event'&&event?event.name:null;if(!context)continue;
   campaigns.push({id:'partner:'+sponsor.id,kind:'partner',title:'In good company',context,detail:sponsor.sponsor_type?.trim()||'Supporting our club community.',partnerName:sponsor.name,partnerLogoUrl:sponsor.logo_url,source:{sponsor,context}});
  }
 }catch{notices.push('Sponsor data could not be verified. Sponsor designs are unavailable.');}
 for(const season of seasons.filter(s=>s.status==='active'&&s.previous_season_id)){
  const previous=seasons.find(s=>s.id===season.previous_season_id&&s.club_id===clubId&&['active','completed'].includes(s.status));if(!previous)continue;
  try{
   const read=(id:string)=>collectSourcePages<MovementTeam>(async(f,t)=>{const reply=await client.rpc('rallora_admin_season_teams',{p_season_id:id}).select('id,division_id,player_one_name,player_two_name,previous_team_id,cycle_movement,is_active').order('id').range(f,t);if(reply.data!==null&&!Array.isArray(reply.data))throw new Error('Unexpected movement response.');return{data:Array.isArray(reply.data)?reply.data:null,error:reply.error};});
   const[current,old]=await Promise.all([read(season.id),read(previous.id)]);const oldMap=new Map(old.map(t=>[t.id,t]));
   const movements:NonNullable<Campaign['movements']>=[];
   for(const team of current){if(team.is_active===false||!['promoted','relegated'].includes(team.cycle_movement??'')||!team.previous_team_id)continue;const before=oldMap.get(team.previous_team_id),to=divisions.find(d=>d.id===team.division_id&&d.season_id===season.id),from=before&&divisions.find(d=>d.id===before.division_id&&d.season_id===previous.id);if(!before||!to||!from||!samePair(names(team),names(before)))continue;
    movements.push({names:names(team),from:from.name,to:to.name,direction:team.cycle_movement as 'promoted'|'relegated'});
   }
   if(movements.length)campaigns.push({id:'movement:'+season.id,kind:'movement',title:season.name,context:'Recorded cycle movements',detail:'Promotions and relegations recorded for the active league cycle.',movements,source:{season,previous,movements}});
  }catch{notices.push(`Movement records could not be verified for ${season.name}. That movement design is unavailable.`);}
 }
 return{campaigns,notices};
}

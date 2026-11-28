/** Eligibility and revision rules for factual club marketing. No model generation. */
export type CampaignKind='open'|'deadline'|'event'|'partner'|'movement';
export type Campaign={id:string;kind:CampaignKind;title:string;context:string;detail:string;dateLabel?:string;day?:string;month?:string;weekday?:string;count?:string;partnerName?:string;partnerLogoUrl?:string|null;movements?:{names:string[];from:string;to:string;direction:'promoted'|'relegated'}[];source:unknown};
export type CampaignSeason={id:string;club_id:string;name:string;status:string;previous_season_id:string|null;registration_published:boolean;registration_opens_at:string|null;registration_closes_at:string|null};
export function isRegistrationOpen(s:CampaignSeason,now:number){
 if(!s.registration_published||!['draft','active'].includes(s.status)||!Number.isFinite(now))return false;
 const a=s.registration_opens_at?Date.parse(s.registration_opens_at):null,b=s.registration_closes_at?Date.parse(s.registration_closes_at):null;
 return(a===null||Number.isFinite(a)&&now>=a)&&(b===null||Number.isFinite(b)&&now<=b);
}
export function registrationCampaigns(seasons:CampaignSeason[],clubId:string,now=Date.now()):Campaign[]{
 const rows:Campaign[]=[];
 for(const s of seasons){if(s.club_id!==clubId||!isRegistrationOpen(s,now))continue;
  rows.push({id:'open:'+s.id,kind:'open',title:s.name,context:'League registration',detail:'Entries are open. View the league details and registration on Rallora.',source:s});
  if(!s.registration_closes_at)continue;
  const remaining=Date.parse(s.registration_closes_at)-now;
  const count=remaining<=60000?'NOW':remaining<86400000?`${Math.ceil(remaining/3600000)}H`:String(Math.ceil(remaining/86400000));
  const dateLabel=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(new Date(s.registration_closes_at))+' UTC';
  rows.push({id:'deadline:'+s.id,kind:'deadline',title:s.name,context:'Registration closes',detail:`Registration closes ${dateLabel}. Check the league details before entering.`,count,dateLabel,source:{...s,count}});
 }return rows;
}
export function campaignRevision(c:Campaign){return JSON.stringify(c);}
export function samePair(a:string[],b:string[]){return a.length>0&&b.length>0&&a.map(s=>s.trim().toLowerCase()).sort().join('|')===b.map(s=>s.trim().toLowerCase()).sort().join('|');}
/** Recheck clock-only changes immediately before a browser handoff. */
export function campaignClockValid(c:Campaign,clubId:string,now=Date.now()){
 if(c.kind!=='open'&&c.kind!=='deadline')return true;
 const current=registrationCampaigns([c.source as CampaignSeason],clubId,now).find(row=>row.id===c.id);
 return Boolean(current&&campaignRevision(current)===campaignRevision(c));
}

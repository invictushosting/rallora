export type ClubLink = {slug:string;name:string;is_active:boolean};
export type ClubRole = {role:string;clubs:ClubLink|null};
export type LoginDestination = {href:string;club:string;label:string};

// Navigation hints only: each destination still enforces its own permissions.
export function loginDestinations(platformAdmin:boolean,memberships:ClubRole[],roster:ClubRole[]):LoginDestination[] {
  const links=new Map<string,LoginDestination>();
  if(platformAdmin)links.set('/platform',{href:'/platform',club:'Rallora',label:'Platform dashboard'});
  const add=(row:ClubRole,suffix:string,label:string)=>{
    if(!row.clubs?.is_active||!row.clubs.slug)return;
    const href=`/clubs/${encodeURIComponent(row.clubs.slug)}${suffix}`;
    links.set(href,{href,club:row.clubs.name,label});
  };
  for(const row of memberships)if(['owner','admin','organiser'].includes(row.role))add(row,'/admin','Club dashboard');
  const captainClubs=new Set(roster.filter(row=>row.role==='captain').map(row=>row.clubs?.slug));
  for(const row of roster){
    if(row.role==='captain')add(row,'/captain','Captain centre');
    else if(row.role==='player'&&!captainClubs.has(row.clubs?.slug))add(row,'?view=fixtures','Fixtures & match chat');
  }
  return [...links.values()];
}

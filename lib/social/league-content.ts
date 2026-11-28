/** Source selection and revision checks shared by the connected studio. No demo data. */
export type LeagueMatch = {
  id:string;seasonId:string;season:string;round:number;divisionId:string;division:string;
  home:string[];away:string[];homeScores:string[];awayScores:string[];
};
export type LeagueStanding = {teamId:string;divisionId:string;names:string[];played:number;points:number;scoreDiff:number;position:number};
export type LeagueContent = {clubId:string;seasonId:string;season:string;divisions:{id:string;name:string}[];matches:LeagueMatch[];standings:LeagueStanding[];tablesSafe:boolean;loadedAt:string};
export type SourceSelection = {kind:'result'|'roundup'|'table';matchId:string;round:number;divisionId:string};
export function selectLeagueContent(source:LeagueContent,selection:SourceSelection) {
  const matches=selection.kind==='result'?source.matches.filter(m=>m.id===selection.matchId):selection.kind==='roundup'?source.matches.filter(m=>m.round===selection.round):[];
  const standings=selection.kind==='table'&&source.tablesSafe?source.standings.filter(s=>s.divisionId===selection.divisionId):[];
  const hasContent=selection.kind==='table'?standings.length>0:matches.length>0;
  return {matches,standings,hasContent};
}
export function leagueRevision(source:LeagueContent,selection:SourceSelection) {
  const picked=selectLeagueContent(source,selection);
  return JSON.stringify({club:source.clubId,season:source.seasonId,name:source.season,kind:selection.kind,
    division:source.divisions.find(d=>d.id===selection.divisionId)?.name??null,
    safe:selection.kind==='table'?source.tablesSafe:true,
    matches:[...picked.matches].sort((a,b)=>a.id.localeCompare(b.id)),standings:picked.standings});
}
/** Exact pages, deterministic ordering required by each query. Never return a partial source. */
export async function collectSourcePages<T>(read:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>,pageSize=200,maxPages=50):Promise<T[]> {
  if(!Number.isInteger(pageSize)||pageSize<1||!Number.isInteger(maxPages)||maxPages<1)throw new Error('Invalid source page limits.');
  const rows:T[]=[];
  for(let page=0;page<maxPages;page++){
    const reply=await read(page*pageSize,(page+1)*pageSize-1);
    if(reply.error)throw new Error('Could not load the full league source. Please retry.');
    const batch=reply.data??[];rows.push(...batch);
    if(batch.length<pageSize)return rows;
  }
  throw new Error('This league exceeds the studio source limit. No partial content has been prepared. Contact Rallora support.');
}
export function sortLeagueStandings(rows:Omit<LeagueStanding,'position'>[]):LeagueStanding[]{
  return [...rows].sort((a,b)=>b.points-a.points||b.scoreDiff-a.scoreDiff||a.names.join(' / ').localeCompare(b.names.join(' / '))).map((row,i)=>({...row,position:i+1}));
}

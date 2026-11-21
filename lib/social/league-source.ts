import type {SupabaseClient} from '@supabase/supabase-js';
import {scoreSets} from '@/lib/leagues/scores';
import {collectSourcePages,sortLeagueStandings,type LeagueContent,type LeagueMatch,type LeagueStanding} from './league-content';
export type StudioClub={id:string;slug:string;name:string;short_name:string|null;primary_color:string|null;secondary_color:string|null;accent_color:string|null;logo_url:string|null};
export type StudioSeason={id:string;name:string;club_id:string};
export async function verifyStudioAccess(client:SupabaseClient,clubId:string,expectedUserId?:string){
  const auth=await client.auth.getUser();const user=auth.data.user;
  if(auth.error||!user||expectedUserId&&user.id!==expectedUserId)throw new Error('Sign in again to use this club studio.');
  const [member,platform]=await Promise.all([
    client.from('rallora_club_memberships').select('user_id,club_id,role,status').eq('club_id',clubId).eq('user_id',user.id).eq('status','active').maybeSingle(),
    client.from('rallora_platform_admins').select('user_id').eq('user_id',user.id).maybeSingle(),
  ]);
  if(member.error||platform.error)throw new Error('Could not verify studio permissions.');
  if(!platform.data&&(!member.data||!['owner','admin','organiser'].includes(member.data.role)))throw new Error('Club owner, admin or organiser access is required.');
  return {userId:user.id,role:member.data?.role??'platform administrator'};
}
export async function loadStudioSeasons(client:SupabaseClient,clubId:string):Promise<StudioSeason[]>{
  return collectSourcePages<StudioSeason>((from,to)=>client.from('seasons').select('id,name,club_id').eq('club_id',clubId).in('status',['active','completed']).order('created_at',{ascending:false}).order('id').range(from,to));
}
type Fixture={id:string;season_id:string;division_id:string;home_team_id:string;away_team_id:string;week_number:number;status:string;available_from:string|null;home_player_names:(string|null)[]|null;away_player_names:(string|null)[]|null};
type Result={fixture_id:string;home_score:string|null;away_score:string|null;status:string};
type Team={id:string;division_id:string;name:string;player_one_name:string|null;player_two_name:string|null};
type Standing={team_id:string;division_id:string;played:number;points:number;score_diff:number};
export async function loadLeagueSource(client:SupabaseClient,clubId:string,seasonId:string):Promise<LeagueContent>{
  const seasonReply=await client.from('seasons').select('id,name,club_id').eq('id',seasonId).eq('club_id',clubId).in('status',['active','completed']).maybeSingle();
  if(seasonReply.error||!seasonReply.data)throw new Error('This published league is no longer available to this club.');
  const season=seasonReply.data as StudioSeason;
  const [divisions,fixtures,standingRows]=await Promise.all([
    collectSourcePages<{id:string;name:string;season_id:string}>((f,t)=>client.from('divisions').select('id,name,season_id').eq('season_id',seasonId).order('sort_order').order('id').range(f,t)),
    collectSourcePages<Fixture>((f,t)=>client.from('fixtures').select('id,season_id,division_id,home_team_id,away_team_id,week_number,status,available_from,home_player_names,away_player_names').eq('season_id',seasonId).order('id').range(f,t)),
    collectSourcePages<Standing>((f,t)=>client.from('standings').select('team_id,division_id,played,points,score_diff').eq('season_id',seasonId).order('division_id').order('team_id').range(f,t)),
  ]);
  const teams:Team[]=[],results:Result[]=[];
  // Bound each IN expression as well as every response page.
  for(let i=0;i<divisions.length;i+=40){const ids=divisions.slice(i,i+40).map(d=>d.id);teams.push(...await collectSourcePages<Team>((f,t)=>client.from('teams').select('id,division_id,name,player_one_name,player_two_name').in('division_id',ids).order('id').range(f,t)));}
  for(let i=0;i<fixtures.length;i+=100){const ids=fixtures.slice(i,i+100).map(f=>f.id);results.push(...await collectSourcePages<Result>((f,t)=>client.from('results').select('fixture_id,home_score,away_score,status').in('fixture_id',ids).in('status',['confirmed','admin_override']).order('fixture_id').range(f,t)));}
  const teamMap=new Map(teams.map(t=>[t.id,t])),divisionMap=new Map(divisions.map(d=>[d.id,d.name])),resultMap=new Map(results.map(r=>[r.fixture_id,r]));
  const names=(id:string,snapshot?:(string|null)[]|null)=>{const saved=snapshot?.filter((n):n is string=>Boolean(n?.trim()));if(saved?.length)return saved;const team=teamMap.get(id);return team?[team.player_one_name,team.player_two_name].filter((n):n is string=>Boolean(n?.trim())):[];};
  const matches:LeagueMatch[]=[];let tablesSafe=true;const today=new Date().toISOString().slice(0,10);
  for(const f of fixtures){
    const r=resultMap.get(f.id);if(!r)continue;
    const released=(!f.available_from||f.available_from.slice(0,10)<=today)&&f.status!=='cancelled';
    if(!released){tablesSafe=false;continue;}
    const home=names(f.home_team_id,f.home_player_names),away=names(f.away_team_id,f.away_player_names);
    if(!scoreSets(r.home_score).length||!scoreSets(r.away_score).length){tablesSafe=false;continue;}
    if(!divisionMap.has(f.division_id)||teamMap.get(f.home_team_id)?.division_id!==f.division_id||teamMap.get(f.away_team_id)?.division_id!==f.division_id||!home.length||!away.length){tablesSafe=false;continue;}
    matches.push({id:f.id,seasonId,season:season.name,round:f.week_number,divisionId:f.division_id,division:divisionMap.get(f.division_id)!,home,away,homeScores:scoreSets(r.home_score),awayScores:scoreSets(r.away_score)});
  }
  matches.sort((a,b)=>b.round-a.round||a.division.localeCompare(b.division)||a.id.localeCompare(b.id));
  const standings:LeagueStanding[]=[];
  for(const division of divisions){const rows:Omit<LeagueStanding,'position'>[]=[];for(const row of standingRows.filter(r=>r.division_id===division.id)){const team=teamMap.get(row.team_id),pair=names(row.team_id);if(!team||team.division_id!==division.id||!pair.length){tablesSafe=false;continue;}rows.push({teamId:row.team_id,divisionId:division.id,names:pair,played:row.played,points:row.points,scoreDiff:row.score_diff});}standings.push(...sortLeagueStandings(rows));}
  return {clubId,seasonId,season:season.name,divisions:divisions.map(d=>({id:d.id,name:d.name})),matches,standings,tablesSafe,loadedAt:new Date().toISOString()};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as content from '../lib/social/league-content.ts';
import * as scores from '../lib/leagues/scores.ts';
// Execute the actual loader with its normal imports substituted by the same tested modules.
const exports={};const code=ts.transpileModule(readFileSync(new URL('../lib/social/league-source.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(`(function(require,exports){${code}})`,{})(name=>name==='./league-content'?content:name==='@/lib/leagues/scores'?scores:(()=>{throw Error(name)})(),exports);
function clientFor(tables,user='user'){
 const requests=[];
 return {requests,auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:null})},from(table){let filters=[],from=0,to=999,single=false,orders=[];const q={select(columns){requests.push({table,columns});return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,values){filters.push(r=>values.includes(r[k]));return q},order(k,{ascending=true}={}){orders.push({k,ascending});return q},range(f,t){from=f;to=t;return q},maybeSingle(){single=true;return q},then(resolve,reject){try{let rows=(tables[table]??[]).filter(r=>filters.every(f=>f(r)));rows.sort((a,b)=>{for(const{k,ascending}of orders){const d=String(a[k]??'').localeCompare(String(b[k]??''));if(d)return ascending?d:-d;}return 0;});rows=rows.slice(from,to+1);return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject)}}};return q}};
}
const fixtures={seasons:[{id:'season',name:'Real League',club_id:'club',status:'active'}],divisions:[{id:'division',season_id:'season',name:'Real Division',sort_order:0}],teams:[{id:'home',division_id:'division',player_one_name:'Current Home',player_two_name:'Home Partner'},{id:'away',division_id:'division',player_one_name:'Current Away',player_two_name:'Away Partner'}],fixtures:[{id:'fixture',season_id:'season',division_id:'division',home_team_id:'home',away_team_id:'away',week_number:2,status:'completed',available_from:null,home_player_names:['Historic Home','Old Partner'],away_player_names:['Historic Away','Old Opponent']}],results:[{fixture_id:'fixture',home_score:'0,6,7',away_score:'6,4,5',status:'confirmed'}],standings:[{team_id:'home',division_id:'division',season_id:'season',played:1,points:3,score_diff:2},{team_id:'away',division_id:'division',season_id:'season',played:1,points:0,score_diff:-2}]};
const copy=()=>structuredClone(fixtures);
test('loader excludes another club and unpublished seasons before reading league tables',async()=>{
 const client=clientFor(copy());await assert.rejects(exports.loadLeagueSource(client,'other','season'),/no longer/);assert.equal(client.requests.length,1);
 const data=copy();data.seasons[0].status='draft';await assert.rejects(exports.loadLeagueSource(clientFor(data),'club','season'),/no longer/);
});
test('verified source preserves fixture names, score orientation and current standings names',async()=>{
 const client=clientFor(copy()),source=await exports.loadLeagueSource(client,'club','season');
 assert.equal(source.matches[0].home[0],'Historic Home');assert.equal(source.standings[0].names[0],'Current Home');assert.equal(source.matches[0].homeScores.join(','),'0,6,7');assert.equal(source.tablesSafe,true);
 for(const {columns}of client.requests)for(const privateField of ['email','phone','arranged_at','court_name','chat'])assert.ok(!columns.includes(privateField));
});
test('future, cancelled, unconfirmed or inconsistent results are excluded and unsafe tables blocked',async()=>{
 for(const mutate of [d=>d.fixtures[0].available_from='2999-01-01',d=>d.fixtures[0].status='cancelled',d=>d.teams[0].division_id='foreign',d=>d.results[0].home_score=null]){const d=copy();mutate(d);const s=await exports.loadLeagueSource(clientFor(d),'club','season');assert.equal(s.matches.length,0);assert.equal(s.tablesSafe,false);}
 const d=copy();d.results[0].status='pending';const s=await exports.loadLeagueSource(clientFor(d),'club','season');assert.equal(s.matches.length,0);
});
test('more than 400 fixtures and more than two leagues are loaded completely',async()=>{
 const data=copy();data.fixtures=Array.from({length:451},(_,i)=>({...data.fixtures[0],id:`f${String(i).padStart(4,'0')}`}));data.results=data.fixtures.map(f=>({...data.results[0],fixture_id:f.id}));
 const source=await exports.loadLeagueSource(clientFor(data),'club','season');assert.equal(source.matches.length,451);
 data.seasons=Array.from({length:205},(_,i)=>({...data.seasons[0],id:String(i)}));assert.equal((await exports.loadStudioSeasons(clientFor(data),'club')).length,205);
});
test('permission check rejects signed-out, revoked, wrong-user and player-only sessions',async()=>{
 const tables={rallora_club_memberships:[{user_id:'user',club_id:'club',role:'owner',status:'active'}]};
 assert.equal((await exports.verifyStudioAccess(clientFor(tables),'club','user')).userId,'user');
 await assert.rejects(exports.verifyStudioAccess(clientFor(tables,null),'club','user'),/Sign in/);
 await assert.rejects(exports.verifyStudioAccess(clientFor(tables),'club','someone'),/Sign in/);
 await assert.rejects(exports.verifyStudioAccess(clientFor({}),'club','user'),/access is required/);
 for(const row of [{...tables.rallora_club_memberships[0],role:'player'},{...tables.rallora_club_memberships[0],status:'suspended'}])await assert.rejects(exports.verifyStudioAccess(clientFor({rallora_club_memberships:[row]}),'club','user'),/access is required/);
});

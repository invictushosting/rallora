import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import vm from'node:vm';import ts from'typescript';
import*as content from'../lib/social/campaign-content.ts';import*as league from'../lib/social/league-content.ts';import{renderCampaignTemplate}from'../lib/social/gallery.ts';
const output={};const code=ts.transpileModule(readFileSync(new URL('../lib/social/campaign-source.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(`(function(require,exports){${code}})`,{})(id=>id==='./league-content'?league:content,output);
const now=Date.parse('2026-11-21T12:00:00Z');const season={id:'season',club_id:'club',name:'Real Winter',status:'draft',previous_season_id:null,registration_published:true,registration_opens_at:'2026-11-20T12:00:00Z',registration_closes_at:'2026-11-25T12:00:00Z'};
const brand={name:'Verified Club',initials:'VC',accent:'#00B0FE',dark:'#061A39',cream:'#F8F8F8'};
function client(tables,rpc={},fail=[]){const reads=[];function query(name,data){let filters=[],from=0,to=999;const q={select(columns){reads.push({name,columns});return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},range(a,b){from=a;to=b;return q},returns(){return q},then(resolve,reject){return Promise.resolve(fail.includes(name)?{data:null,error:{message:'unavailable'}}:{data:(data??[]).filter(r=>filters.every(f=>f(r))).slice(from,to+1),error:null}).then(resolve,reject)}};return q;}return{reads,from:name=>query(name,tables[name]),rpc:(name,args)=>query(name,rpc[args.p_season_id])};}
const names={player_one_name:'Real One',player_two_name:'Real Two'};
function dataset(){return{seasons:[season,{...season,id:'previous',status:'completed',registration_published:false},{...season,id:'current',status:'active',registration_published:false,previous_season_id:'previous'}],divisions:[{id:'olddiv',season_id:'previous',name:'Division 2'},{id:'newdiv',season_id:'current',name:'Division 1'}],rallora_club_events:[{id:'event',club_id:'club',name:'Actual event',status:'published',event_date:'2026-12-02',format:'americano',public_notes:'Actual public details'}],sponsors:[{id:'sponsor',club_id:'club',name:'Actual Partner',sponsor_type:'Equipment partner',logo_url:null,scope_type:'club',scope_id:null,is_active:true}]};}
const rpc={previous:[{id:'oldteam',division_id:'olddiv',...names,previous_team_id:null,cycle_movement:null,is_active:true}],current:[{id:'newteam',division_id:'newdiv',...names,previous_team_id:'oldteam',cycle_movement:'promoted',is_active:true}]};
test('registration campaigns obey ownership, publication and inclusive time windows',()=>{
 const rows=content.registrationCampaigns([season,{...season,id:'foreign',club_id:'other'},{...season,id:'hidden',registration_published:false},{...season,id:'completed',status:'completed'},{...season,id:'future',registration_opens_at:'2026-12-01'}],'club',now);
 assert.deepEqual(rows.map(r=>r.id),['open:season','deadline:season']);assert.equal(rows[1].count,'4');assert.ok(rows[1].dateLabel.endsWith('UTC'));
 assert.equal(content.registrationCampaigns([{...season,registration_closes_at:'invalid'}],'club',now).length,0);
 assert.equal(content.registrationCampaigns([season],'club',Date.parse(season.registration_closes_at)).length,2);
 assert.equal(content.registrationCampaigns([season],'club',Date.parse(season.registration_closes_at)+1).length,0);
});
test('countdown clocks invalidate old cards before handoff without inventing a closing time',()=>{
 const rows=content.registrationCampaigns([season],'club',now),deadline=rows.find(r=>r.kind==='deadline');assert.equal(content.campaignClockValid(deadline,'club',now),true);assert.equal(content.campaignClockValid(deadline,'club',now+86400000),false);assert.equal(content.campaignClockValid(rows[0],'club',Date.parse(season.registration_closes_at)+1),false);
 assert.equal(content.registrationCampaigns([{...season,registration_closes_at:null}],'club',now).some(r=>r.kind==='deadline'),false);
});
test('all five designs use verified source values with no fictional names, dates or sponsors',async()=>{
 const c=client(dataset(),rpc);const{campaigns}=await output.loadClubCampaigns(c,'club',now);assert.deepEqual([...new Set(campaigns.map(c=>c.kind))].sort(),['deadline','event','movement','open','partner']);
 for(const campaign of campaigns)for(const size of ['square','portrait','story']){const art=renderCampaignTemplate({campaign,size,brand});for(const fake of ['NORTHLINE','Alex Morgan','Jamie Reed','CLUB SOCIAL NIGHT','18:00','ALL LEVELS','WINTER BOX LEAGUE'])assert.ok(!art.svg.includes(fake)&&!art.caption.includes(fake),campaign.kind+': '+fake);assert.ok(art.caption.includes('Verified Club'));}
 for(const r of c.reads)for(const secret of ['email','phone','court','booking','contact'])assert.ok(!r.columns.includes(secret));
});
test('cancelled, private, past and malformed events and foreign sponsors cannot be shared',async()=>{
 const d=dataset();d.rallora_club_events=[...d.rallora_club_events,...['draft','cancelled','completed'].map(status=>({...d.rallora_club_events[0],id:status,status})),{...d.rallora_club_events[0],id:'past',event_date:'2020-01-01'},{...d.rallora_club_events[0],id:'invalid',event_date:'2026-11-99'},{...d.rallora_club_events[0],id:'foreign',club_id:'other'}];d.sponsors.push({...d.sponsors[0],id:'foreign',club_id:'other'},{...d.sponsors[0],id:'wrongscope',scope_type:'league',scope_id:'elsewhere'},{...d.sponsors[0],id:'draftscope',scope_type:'league',scope_id:'season'});
 const result=await output.loadClubCampaigns(client(d,rpc),'club',now);assert.deepEqual(result.campaigns.filter(c=>c.kind==='event').map(c=>c.id),['event:event']);assert.deepEqual(result.campaigns.filter(c=>c.kind==='partner').map(c=>c.id),['partner:sponsor']);
});
test('movements require an active published successor, source linkage and unchanged pairings',async()=>{
 for(const mutation of [d=>d.seasons.find(s=>s.id==='current').status='draft',d=>d.seasons.find(s=>s.id==='previous').club_id='other']){const d=dataset();mutation(d);const result=await output.loadClubCampaigns(client(d,rpc),'club',now);assert.equal(result.campaigns.some(c=>c.kind==='movement'),false);}
 for(const replacement of [{...rpc.current[0],player_one_name:'Replacement'},{...rpc.current[0],previous_team_id:'unrelated'},{...rpc.current[0],cycle_movement:'stayed'},{...rpc.current[0],is_active:false}]){const result=await output.loadClubCampaigns(client(dataset(),{...rpc,current:[replacement]}),'club',now);assert.equal(result.campaigns.some(c=>c.kind==='movement'),false);}
});
test('optional source failures produce clear unavailable states, not sample content',async()=>{
 const result=await output.loadClubCampaigns(client(dataset(),rpc,['sponsors','rallora_club_events','rallora_admin_season_teams']),'club',now);assert.ok(result.notices.length>=3);assert.deepEqual(result.campaigns.map(c=>c.kind),['open','deadline']);
});
test('movement pages include every recorded pairing and invalid sources fail closed',()=>{
 const movements=Array.from({length:7},(_,i)=>({names:['Pair '+i,'Partner '+i],from:'B',to:'A',direction:'promoted'}));const campaign={id:'moves',kind:'movement',title:'Actual cycle',context:'Recorded movements',detail:'Actual',movements,source:{}};assert.equal(renderCampaignTemplate({campaign,size:'square',brand}).slides,4);let svg='';for(let slide=0;slide<4;slide++)svg+=renderCampaignTemplate({campaign,size:'square',brand,slide}).svg;for(let i=0;i<7;i++)assert.ok(svg.includes('Pair '+i));
 assert.throws(()=>renderCampaignTemplate({campaign:{...campaign,movements:[]},size:'square',brand}),/Recorded/);
});

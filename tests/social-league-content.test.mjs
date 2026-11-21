import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSourcePages,leagueRevision,selectLeagueContent,sortLeagueStandings} from '../lib/social/league-content.ts';
import {renderLeagueTemplate} from '../lib/social/gallery.ts';
const m={id:'one',seasonId:'league',season:'Summer',round:2,divisionId:'division',division:'Division A',home:['First Home','Second Home'],away:['First Away','Second Away'],homeScores:['0','6','7'],awayScores:['6','4','5']};
const row={teamId:'home',divisionId:'division',names:m.home,played:2,points:3,scoreDiff:1,position:1};
const source={clubId:'club-a',seasonId:'league',season:'Summer',divisions:[{id:'division',name:'Division A'}],matches:[m],standings:[row],tablesSafe:true,loadedAt:''};
const result={kind:'result',matchId:'one',round:2,divisionId:'division'};
const brand={name:'Real Club',initials:'RC',accent:'#00B0FE',dark:'#061A39',cream:'#FAFAFA'};
test('complete paginated source is loaded and errors never become partial posts',async()=>{
 const rows=Array.from({length:450},(_,id)=>({id}));let reads=0;
 const data=await collectSourcePages(async(f,t)=>{reads++;return{data:rows.slice(f,t+1),error:null}});
 assert.equal(data.length,450);assert.equal(reads,3);
 await assert.rejects(collectSourcePages(async(f,t)=>f?{data:null,error:{message:'db failed'}}:{data:rows.slice(f,t+1),error:null}),/full league/);
 await assert.rejects(collectSourcePages(async()=>({data:[1,2],error:null}),2,2),/No partial/);
});
test('rounds include additions and revisions catch corrections, rosters and authority boundaries',()=>{
 const round={...result,kind:'roundup'};
 const before=leagueRevision(source,round);
 for(const changed of [{...source,clubId:'club-b'},{...source,season:'Renamed'}, {...source,matches:[{...m,homeScores:['1','6','7']}]},{...source,matches:[{...m,home:['Replacement']}]},{...source,matches:[m,{...m,id:'two'}]},{...source,matches:[]}])assert.notEqual(leagueRevision(changed,round),before);
 assert.equal(selectLeagueContent({...source,matches:[m,{...m,id:'other',round:3}]},round).matches.length,1);
});
test('unsafe or missing standings cannot create table content',()=>{
 const selection={...result,kind:'table'};
 assert.equal(selectLeagueContent({...source,tablesSafe:false},selection).hasContent,false);
 assert.notEqual(leagueRevision(source,selection),leagueRevision({...source,standings:[{...row,points:4}]},selection));
 assert.notEqual(leagueRevision(source,selection),leagueRevision({...source,standings:[{...row,names:['Replacement']}]},selection));
});
test('standing order matches hub points, difference and player-name tie break',()=>{
 const rows=sortLeagueStandings([{...row,teamId:'b',names:['Zulu'],points:6,scoreDiff:1},{...row,teamId:'a',names:['Alpha'],points:6,scoreDiff:1},{...row,teamId:'c',names:['Top'],points:6,scoreDiff:4}]);
 assert.deepEqual(rows.map(r=>r.teamId),['c','a','b']);assert.deepEqual(rows.map(r=>r.position),[1,2,3]);
});
test('connected result designs never contain demo players, scores or league names',()=>{
 for(const template of ['scoreboard','poster','photo']){
 const{svg,caption}=renderLeagueTemplate({template,size:'square',brand,data:{season:'Summer',round:2,division:'Division A',matches:[{id:m.id,home:m.home,away:m.away,h:m.homeScores,a:m.awayScores,division:m.division}]}});
 for(const forbidden of ['Alex Morgan','Jamie Reed','Winter Box','6–4 / 6–3','NORTHLINE'])assert.ok(!svg.includes(forbidden)&&!caption.includes(forbidden),template+': '+forbidden);
 assert.ok(svg.includes('First Home'));assert.ok(caption.includes('0–6 / 6–4 / 7–5'));assert.ok(!caption.includes('beat'));
 }
});
test('roundup grids, carousels and standings paginate without losing source rows',()=>{
 const matches=Array.from({length:13},(_,i)=>({id:String(i),home:['Home '+i],away:['Away '+i],h:['6'],a:['0'],division:'Division'}));
 for(const template of ['grid','carousel']){const total=renderLeagueTemplate({template,size:'square',brand,data:{season:'Summer',round:2,matches}}).slides;assert.equal(total,template==='grid'?4:8);let all='';for(let slide=0;slide<total;slide++)all+=renderLeagueTemplate({template,size:'square',brand,slide,data:{season:'Summer',round:2,matches}}).svg;for(let i=0;i<13;i++)assert.ok(all.includes('Home '+i));}
 const standings=Array.from({length:9},(_,i)=>({teamId:String(i),position:i+1,names:['Pair '+i],played:2,points:10-i}));
 const input={template:'table',size:'portrait',brand,data:{season:'Summer',division:'Division',standings}};
 assert.equal(renderLeagueTemplate(input).slides,3);let all='';for(let slide=0;slide<3;slide++)all+=renderLeagueTemplate({...input,slide}).svg;for(let i=0;i<9;i++)assert.ok(all.includes('Pair '+i));
});
test('connected renderer rejects empty sources instead of using preview samples',()=>{
 assert.throws(()=>renderLeagueTemplate({template:'scoreboard',size:'square',brand,data:{season:'Real'}}),/confirmed/);
 assert.throws(()=>renderLeagueTemplate({template:'table',size:'square',brand,data:{season:'Real',division:'A',standings:[]}}),/standings/);
});
test('compact grids retain both pairing identities using initials while wide cards use full names',()=>{
 const data={season:'Summer',round:2,matches:[{id:'long',home:['Aisling Fitzgerald','Christopher Williamson'],away:['Dominic Walker','Isabella Taylor'],h:['6'],a:['0'],division:'A'}]};
 const grid=renderLeagueTemplate({template:'grid',size:'square',brand,data});
 assert.ok(grid.svg.includes('A. Fitzgerald'));assert.ok(grid.svg.includes('C. Williamson'));assert.ok(grid.caption.includes('Christopher Williamson'));
 const carousel=renderLeagueTemplate({template:'carousel',size:'square',brand,data,slide:1});assert.ok(carousel.svg.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').includes('Christopher Williamson'));
});

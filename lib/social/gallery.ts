import type{Campaign}from './campaign-content';

/** Reusable local design gallery. All preview figures are synthetic, not live league data. */
export const CLUB_TEMPLATES = [
  {id:"scoreboard",name:"Centre court",category:"Results",description:"A bold scoreboard with fixed home and away score rows."},
  {id:"poster",name:"Match poster",category:"Results",description:"Oversized typography and a diagonal club colour panel."},
  {id:"photo",name:"Club moment",category:"Results",description:"Photo-led artwork with a compact score strip."},
  {id:"grid",name:"Round in review",category:"Roundups",description:"Four fixtures in a balanced results grid."},
  {id:"carousel",name:"The round edit",category:"Roundups",description:"A cover and two result slides, ready for a carousel."},
  {id:"table",name:"The standings",category:"Tables",description:"A clean league table with points and position."},
  {id:"leader",name:"Top of the box",category:"Tables",description:"An editorial spotlight for the current division leaders."},
  {id:"movement",name:"Moving up",category:"Tables",description:"Promotion and relegation in two clearly labelled panels."},
  {id:"open",name:"Entries open",category:"Club marketing",description:"A high-impact registration launch with a clear call to action."},
  {id:"deadline",name:"Last call",category:"Club marketing",description:"A deadline countdown built around one clear action."},
  {id:"event",name:"On the calendar",category:"Club marketing",description:"A club event styled as an invitation ticket."},
  {id:"partner",name:"In good company",category:"Club marketing",description:"A dedicated sponsor spotlight with room for their message."},
] as const;
export type ClubTemplate = typeof CLUB_TEMPLATES[number]["id"];
export type GallerySize = "square" | "portrait" | "story";
export type GalleryBrand = {name:string;initials:string;accent:string;dark:string;cream:string;logo?:string};
export type GalleryMatch = {id:string;home:string[];away:string[];h:string[];a:string[];division:string};
export type GalleryTableRow = {teamId:string;position:number;names:string[];played:number;points:number};
export type GalleryLeagueData = {season:string;round?:number;division?:string;matches?:GalleryMatch[];standings?:GalleryTableRow[]};
export const CONNECTED_TEMPLATE_IDS = ['scoreboard','poster','photo','grid','carousel','table','leader'] as const;
export type ConnectedTemplate = typeof CONNECTED_TEMPLATE_IDS[number];
export type GalleryOptions = {template:ClubTemplate;size:GallerySize;brand:GalleryBrand;sponsor:boolean;photo?:string;ralloraLogo?:string;slide?:number;data?:GalleryLeagueData;campaign?:Campaign;partnerLogo?:string};
export const GALLERY_HEIGHTS = {square:1080,portrait:1350,story:1920};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function safeColour(s:string,fallback:string){return /^#[\da-f]{6}$/i.test(s)?s:fallback;}
export function readableInk(s:string){const rgb=safeColour(s,'#00B0FE').slice(1).match(/../g)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#061A39':'#FFFFFF';}
function wrap(s:string,cols:number){const rows:string[]=[];let row='';for(const word of s.split(/\s+/)){for(let start=0;start<Array.from(word).length;start+=cols){const part=Array.from(word).slice(start,start+cols).join('');if(Array.from(row+' '+part).length>cols&&row){rows.push(row);row='';}row=row?row+' '+part:part;}}if(row)rows.push(row);return rows;}
const safeImage=(s?:string)=>s&&/^data:image\/(?:png|jpeg);base64,[a-z\d+/=]+$/i.test(s)?s:null;
const demoPairs=[['Alex Morgan','Jamie Reed'],['Taylor Green','Casey Shaw'],['Jordan Lee','Sam Ellis'],['Riley Ward','Robin Cole']];
const demoResults=[{home:demoPairs[0],away:demoPairs[1],h:['6','6'],a:['4','3'],division:'DIVISION 1A'}, {home:demoPairs[2],away:demoPairs[3],h:['4','7','6'],a:['6','5','4'],division:'DIVISION 1B'}, {home:['Morgan Fox','Drew Bell'],away:['Charlie Hart','Ash Lane'],h:['7','6'],a:['5','4'],division:'DIVISION 2A'}, {home:['Blair King','Finley West'],away:['Quinn Dale','Cameron Wood'],h:['6','3','6'],a:['2','6','4'],division:'DIVISION 2B'}];
export function renderClubTemplate(o:GalleryOptions):{svg:string;caption:string;slides:number} {
  const results=o.data?.matches??demoResults;
  const table=o.data?.standings??demoPairs.map((names,i)=>({teamId:String(i),position:i+1,names,played:1,points:i<2?3:0}));
  const season=o.data?.season??'WINTER BOX LEAGUE';
  const round=o.data?.round??1;
  const division=o.data?.division??results[0]?.division??'DIVISION 1A';
  const roundLabel=`${season} · ROUND ${round}`;
  const scoreLine=(r:typeof results[number])=>r.h.length&&r.h.length===r.a.length?r.h.map((n,i)=>`${n}–${r.a[i]}`).join(' / '):`${r.h.join(' / ')||'—'} : ${r.a.join(' / ')||'—'}`;
  const pair=(names:string[])=>names.join(' / ');
  const matchCaption=(r:typeof results[number])=>`${r.division}: ${pair(r.home)} vs ${pair(r.away)} — ${scoreLine(r)}`;
  const H=GALLERY_HEIGHTS[o.size],dark=safeColour(o.brand.dark,'#061A39'),accent=safeColour(o.brand.accent,'#00B0FE'),cream=safeColour(o.brand.cream,'#F4F0E7'),onAccent=readableInk(accent);
  const T=o.template, light=['table','leader','event','partner'].includes(T), ink=light?dark:'#FFFFFF', muted=light?'#4C605D':'#BCD0D5';
  const p:string[]=[];
  const rect=(x:number,y:number,w:number,h:number,fill:string,rx=0,extra='')=>p.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`);
  const text=(value:string,x:number,y:number,size=28,weight=500,fill=ink,extra='')=>p.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(value)}</text>`);
  const multi=(value:string,x:number,y:number,size:number,cols:number,max=3,fill=ink,weight=800)=>{const rows=wrap(value,cols);rows.slice(0,max).forEach((r,i)=>text(i===max-1&&rows.length>max?r+'…':r,x,y+i*size*1.08,size,weight,fill));};
  const line=(x1:number,y1:number,x2:number,y2:number,col=accent,width=2)=>p.push(`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${col}" stroke-width="${width}"/>`);
  const circle=(x:number,y:number,r:number,fill:string,extra='')=>p.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`);
  const image=(url:string,x:number,y:number,w:number,h:number)=>p.push(`<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`);
  const logo=(x:number,y:number)=>{const asset=safeImage(o.brand.logo);if(asset){rect(x-8,y-48,116,110,'#FFFFFF',12);image(asset,x,y-40,100,90);}else{circle(x+38,y+7,42,accent);text(o.brand.initials.slice(0,3),x+38,y+17,26,900,onAccent,'text-anchor="middle"');}};
  const header=()=>{logo(64,80);multi(o.brand.name.toUpperCase(),174,83,26,24,2,ink,800);text('RALLORA LEAGUES',174,145,18,700,muted);};
  const tag=(value:string,y:number)=>{rect(64,y,Math.min(952,Math.max(350,value.length*10+44)),42,accent,21);multi(value,86,y+28,18,48,1,onAccent,800);};
  const footer=()=>{if(T==='poster'||T==='open')rect(0,H-150,1080,150,dark);line(64,H-140,1016,H-140,light?dark:'#FFFFFF',1);const asset=safeImage(o.ralloraLogo);if(asset){rect(54,H-120,206,65,'#061A39',8);image(asset,65,H-113,180,45);}else text('RALLORA',64,H-76,27,900,ink);text(o.sponsor?'SUPPORTED BY NORTHLINE':'YOUR CLUB. YOUR GAME.',1016,H-82,20,750,muted,'text-anchor="end"');};
  const matchRows=(index:number,x:number,y:number,w:number,h:number,compact=false)=>{const r=results[index];if(!r)return;rect(x,y,w,h,light?'#FFFFFF':'#FFFFFF',18,`opacity="${light?'.85':'.08'}"`);text(r.division,x+25,y+35,19,750,muted);const font=compact?24:35,first=y+(compact?77:105),gap=compact?95:140;for(const[side,names,scores,row]of [['HOME',r.home,r.h,0],['AWAY',r.away,r.a,1]]as const){text(side,x+25,first+row*gap-18,14,750,muted);const label=compact&&w<600&&names.join(' / ').length>34?names.map(name=>{const words=name.trim().split(/\s+/);return words.length>1?`${Array.from(words[0])[0]}. ${words[words.length-1]}`:name;}).join(' / '):names.join(' / ');multi(label,x+25,first+row*gap+22,font,compact?(w<600?17:42):25,2,ink,750);scores.forEach((score,i)=>text(score,x+w-145+i*43,first+row*gap+34,compact?29:44,850));}};
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${H}" viewBox="0 0 1080 ${H}"><defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="${dark}" stop-opacity="0"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><rect width="1080" height="${H}" fill="${light?cream:dark}"/><g font-family="Arial,Helvetica,sans-serif">`);
  let caption='';let slides=1;
  if(o.campaign){
    const c=o.campaign;
    if(T==='open'){
      rect(760,0,320,H,accent);header();text('YOUR',64,Math.round(H*.38),138,900);text('NEXT',64,Math.round(H*.38)+135,138,900);text('CHAPTER.',64,Math.round(H*.38)+270,126,900);rect(64,H-390,952,200,dark,14);multi(c.title,90,H-340,30,46,2,'#FFFFFF',800);text('ENTRIES ARE OPEN',90,H-225,57,900,accent);caption=`${o.brand.name} · ${c.title}\n${c.detail}`;
    }else if(T==='deadline'){
      header();const cy=Math.round(H*.42),r=Math.min(335,(H-600)*.43);circle(540,cy,r,accent);text(c.count??'',540,cy+60,(c.count?.length??0)>2?150:Math.min(260,r),900,onAccent,'text-anchor="middle"');text(c.count?.includes('H')?'HOURS REMAINING':c.count==='NOW'?'CLOSING NOW':'DAYS TO GO',540,cy+120,27,850,onAccent,'text-anchor="middle"');text('LAST CALL.',64,H-310,105,900);multi(c.title,64,H-255,30,48,2,muted,650);text((c.dateLabel??'').slice(0,65),64,H-175,22,750,accent);caption=`${o.brand.name} · ${c.title}\n${c.detail}`;
    }else if(T==='event'){
      header();const y=Math.round(H*.25),height=H-y-225;rect(64,y,952,height,'#FFFFFF',28);rect(64,y,952,130,accent,28);text('YOU’RE INVITED.',104,y+85,59,900,onAccent);text(c.weekday??'',104,y+220,38,850,dark);text(c.day??'',104,y+355,150,900,dark);text(c.month??'',104,y+410,42,850,dark);line(355,y+180,355,y+height-70,'#C7D6CF',2);multi(c.title,405,y+220,49,17,3,dark);multi(c.context.toUpperCase(),405,y+height-98,23,29,1,muted,750);text('VIEW EVENT DETAILS',405,y+height-48,25,850,dark);caption=`${o.brand.name} · ${c.title}\n${c.dateLabel} · ${c.context}\n${c.detail}`;
    }else if(T==='partner'){
      header();text('IN GOOD',64,320,94,900);text('COMPANY.',64,420,94,900);const y=Math.round(H*.45);rect(64,y,952,Math.min(310,H-y-270),'#FFFFFF',20);const asset=safeImage(o.partnerLogo);if(asset)image(asset,120,y+35,840,Math.min(220,H-y-330));else multi(c.partnerName??'',100,y+110,60,25,2,dark);multi(c.context,64,H-245,26,55,1,dark,750);multi(c.detail,64,H-200,23,62,1,muted,500);caption=`${o.brand.name} · ${c.context}\n${c.partnerName}\n${c.detail}`;
    }else if(T==='movement'){
      header();text('ON THE',64,300,92,900);text('MOVE.',64,390,92,900,accent);const rows=c.movements??[];slides=Math.ceil(rows.length/2);const page=Math.max(0,Math.min(slides-1,o.slide??0));const y=450,ch=Math.floor((H-y-190)/2);rows.slice(page*2,page*2+2).forEach((row,i)=>{const top=y+i*(ch+20),up=row.direction==='promoted';rect(64,top,952,ch,up?accent:'#FFFFFF',16,up?'':'opacity=".08"');const col=up?onAccent:ink;text(up?'↑':'↓',100,top+ch*.58,Math.min(145,ch*.6),900,col);text(up?'PROMOTED':'RELEGATED',280,top+48,23,850,col);multi(row.names.join(' / '),280,top+95,30,35,2,col);multi(`${row.from} → ${row.to}`,280,top+ch-27,23,43,1,col,650);});caption=`${o.brand.name} · ${c.title}\n`+rows.map(row=>`${row.direction==='promoted'?'Promoted':'Relegated'}: ${row.names.join(' / ')} · ${row.from} → ${row.to}`).join('\n');if(slides>1)text(`PAGE ${page+1} / ${slides}`,1016,H-160,17,750,muted,'text-anchor="end"');
    }
    footer();p.push('</g></svg>');return{svg:p.join(''),caption,slides};
  }
  if(T==='scoreboard'){
    p.push(`<path d="M760 0V${H}M540 0V${H}M540 ${H*.4}H1080" stroke="${accent}" opacity=".12" stroke-width="3"/>`);header();tag(roundLabel,210);text('THE RESULT.',64,350,98,900);const y=Math.max(400,Math.round(H*.36));matchRows(0,64,y,952,Math.min(450,H-y-190));caption='Round 1, Division 1A: Alex Morgan / Jamie Reed beat Taylor Green / Casey Shaw, 6–4, 6–3.';
  } else if(T==='poster'){
    p.push(`<path d="M760 0H1080V${H}H${Math.max(200,760-H*.17)}Z" fill="${accent}"/>`);header();text('FULL',64,Math.round(H*.36),210,900);text('TIME',64,Math.round(H*.36)+190,210,900);rect(64,H-430,952,245,dark,18);text(`${division} · ROUND ${round}`.slice(0,54),90,H-385,21,750,'#BCD0D5');multi(scoreLine(results[0]),90,H-300,64,23,1,'#FFFFFF');multi(pair(results[0].home),90,H-242,30,48,1,'#FFFFFF',700);multi('vs '+pair(results[0].away),90,H-202,27,51,1,'#BCD0D5',500);caption='Full time at '+o.brand.name+'. Alex Morgan / Jamie Reed 6–4, 6–3 Taylor Green / Casey Shaw. Winter Box League · Round 1.';
  } else if(T==='photo'){
    const photo=safeImage(o.photo),photoH=Math.round(H*.64);if(photo){p.push(`<image href="${photo}" x="0" y="0" width="1080" height="${photoH}" preserveAspectRatio="xMidYMid slice"/>`);}else{rect(0,0,1080,photoH,'#356B64');p.push(`<path d="M80 ${photoH}L360 130H880L1080 ${photoH}M220 ${photoH*.65}H990M360 130L660 ${photoH}M600 130L800 ${photoH}" stroke="#FFFFFF" stroke-width="6" opacity=".6" fill="none"/>`);circle(780,Math.round(photoH*.5),140,accent,'opacity=".8"');text('YOUR CLUB PHOTO',540,Math.round(photoH*.36),33,750,'#FFFFFF','text-anchor="middle"');text('Upload a photo in the preview controls',540,Math.round(photoH*.36)+45,23,500,'#FFFFFF','text-anchor="middle"');}rect(0,0,1080,200,dark,0,'opacity=".8"');header();rect(0,photoH-140,1080,180,'url(#fade)');text('ON COURT.',64,photoH-10,110,900);text(`${division} · ROUND ${round}`.slice(0,58),64,photoH+60,23,750,accent);multi(scoreLine(results[0]),64,photoH+145,64,23,1);multi(pair(results[0].home),64,photoH+200,31,47,1,ink,750);multi('vs '+pair(results[0].away),64,photoH+240,27,51,1,muted,500);caption='A moment from the Winter Box League. Alex Morgan / Jamie Reed vs Taylor Green / Casey Shaw: 6–4, 6–3.';
  } else if(T==='grid'){
    header();text('ROUND IN',64,300,83,900);text('REVIEW.',64,385,83,900,accent);const y=435,cardH=Math.floor((H-y-190)/2);slides=Math.max(1,Math.ceil(results.length/4));const page=Math.max(0,Math.min(slides-1,o.slide??0));for(let i=0;i<4;i++)matchRows(page*4+i,64+(i%2)*488,y+Math.floor(i/2)*(cardH+20),464,cardH,true);caption='Your Round 1 results, all in one place. Four confirmed fixtures across our Winter Box League divisions. See the full results on Rallora.';
  } else if(T==='carousel'){
    slides=1+Math.ceil(results.length/2);const slide=Math.max(0,Math.min(slides-1,o.slide??0));header();text(`THE ROUND EDIT / 0${slide+1}`,64,230,23,750,accent);if(slide===0){text('EVERY',64,Math.round(H*.32),130,900);text('POINT.',64,Math.round(H*.32)+130,130,900);text('EVERY',64,Math.round(H*.32)+260,130,900,accent);text('PAIR.',64,Math.round(H*.32)+390,130,900,accent);multi(roundLabel,64,H-220,25,55,1,ink,750);text('Swipe for the results →',64,H-175,23,500,muted);}else{multi('THE RESULTS',64,340,85,16);const y=400,cardH=Math.floor((H-y-200)/2);matchRows((slide-1)*2,64,y,952,cardH,true);matchRows((slide-1)*2+1,64,y+cardH+20,952,cardH,true);}caption='Every point. Every pair. Swipe through the confirmed results from Round 1 of our Winter Box League.';
  } else if(T==='table'){
    header();tag(`${season} · ${division}`,215);text('THE TABLE.',64,355,94,900);text(division.toUpperCase().slice(0,50),64,410,23,750,muted);
    slides=Math.max(1,Math.ceil(table.length/4));const page=Math.max(0,Math.min(slides-1,o.slide??0));const visible=table.slice(page*4,page*4+4);
    const top=470,rowH=Math.min(145,Math.floor((H-top-200)/4));rect(64,top,952,48,dark,8);text('POS',88,top+31,18,750,'#FFFFFF');text('PAIRING',190,top+31,18,750,'#FFFFFF');text('P',824,top+31,18,750,'#FFFFFF');text('PTS',950,top+31,18,750,'#FFFFFF');
    visible.forEach((row,i)=>{const y=top+50+i*rowH;rect(64,y,952,rowH-4,row.position===1?accent:'#FFFFFF',8);const col=row.position===1?onAccent:dark;text(String(row.position).padStart(2,'0'),88,y+rowH*.58,33,850,col);multi(pair(row.names),190,y+rowH*.38,25,34,2,col,750);text(String(row.played),824,y+rowH*.58,29,750,col);text(String(row.points),960,y+rowH*.58,34,900,col);});
    caption=`${season} · ${division} standings\n`+table.map(r=>`${r.position}. ${pair(r.names)} — P ${r.played} · ${r.points} pts`).join('\n');
  } else if(T==='leader'){
    const first=table[0];header();rect(0,235,1080,Math.round(H*.26),accent);text('TOP OF',64,355,117,900,onAccent);text('THE BOX.',64,470,117,900,onAccent);const y=Math.max(560,H*.5);text(String(first.position).padStart(2,'0'),64,y+170,220,900,dark);line(375,y-10,375,y+185,dark,2);text(division.toUpperCase().slice(0,28),420,y+15,25,750,muted);multi(pair(first.names),420,y+85,42,21,3,dark);text(`${first.points} POINTS · ${first.played} PLAYED`,64,H-245,28,750,dark);caption=`${season} · ${division}\nFirst in the current table order: ${pair(first.names)} · ${first.points} points from ${first.played} played. View the full standings on Rallora.`;
  } else if(T==='movement'){
    header();text('ON THE',64,300,92,900);text('MOVE.',64,390,92,900,accent);const y=450,ch=Math.floor((H-y-190)/2);rect(64,y,952,ch,accent,16);text('↑',100,y+ch*.58,Math.min(145,ch*.6),900,onAccent);text('PROMOTED',280,y+58,25,850,onAccent);text('Alex Morgan / Jamie Reed',280,y+112,36,850,onAccent);text('Division 1B → Division 1A',280,y+160,26,650,onAccent);rect(64,y+ch+20,952,ch,'#FFFFFF',16,'opacity=".08"');text('↓',100,y+ch+20+ch*.58,Math.min(145,ch*.6),900);text('RELEGATED',280,y+ch+78,25,850,muted);text('Riley Ward / Robin Cole',280,y+ch+132,36,850);text('Division 1A → Division 1B',280,y+ch+180,26,650,muted);caption='A new round, a new challenge. Sample promotion and relegation artwork; production posts must wait for confirmed round movements.';
  } else if(T==='open'){
    rect(760,0,320,H,accent);header();text('YOUR',64,Math.round(H*.38),138,900);text('NEXT',64,Math.round(H*.38)+135,138,900);text('CHAPTER.',64,Math.round(H*.38)+270,126,900);rect(64,H-350,952,160,dark,14);text('WINTER BOX LEAGUE',90,H-295,31,800,'#FFFFFF');text('ENTRIES ARE OPEN',90,H-225,57,900,accent);caption='Entries are open for our sample Winter Box League. Find your partner, find your level and make it your league. See club details on Rallora.';
  } else if(T==='deadline'){
    header();const cy=Math.round(H*.42),r=Math.min(335,(H-600)*.43);circle(540,cy,r,accent);text('04',540,cy+60,Math.min(260,r),900,onAccent,'text-anchor="middle"');text('DAYS TO GO',540,cy+120,31,850,onAccent,'text-anchor="middle"');text('LAST CALL.',64,H-310,105,900);text('Winter Box League registration',64,H-250,30,650,muted);text('SAMPLE DEADLINE · CONFIRM BEFORE POSTING',64,H-195,20,750,accent);caption='Last call for the Winter Box League. The countdown is a sample; check the actual registration deadline before publishing.';
  } else if(T==='event'){
    header();const y=Math.round(H*.25),height=H-y-225;rect(64,y,952,height,'#FFFFFF',28);rect(64,y,952,130,accent,28);text('YOU’RE INVITED.',104,y+85,59,900,onAccent);text('SAT',104,y+220,38,850,dark);text('12',104,y+355,150,900,dark);text('DEC',104,y+410,42,850,dark);line(355,y+180,355,y+height-70,'#C7D6CF',2);multi('CLUB SOCIAL NIGHT',405,y+220,65,13,3,dark);text('18:00 · ALL LEVELS',405,y+height-95,26,750,muted);text('BOOK YOUR PLACE',405,y+height-48,25,850,dark);caption='You’re invited: a sample Club Social Night, Saturday 12 December at 18:00. This is demonstration event information, not a live booking.';
  } else if(T==='partner'){
    header();text('IN GOOD',64,320,94,900);text('COMPANY.',64,420,94,900);const y=Math.round(H*.45);rect(64,y,952,Math.min(310,H-y-270),'#FFFFFF',20);text('NORTHLINE',540,y+115,74,900,dark,'text-anchor="middle"');text('LOCAL PARTNER. BIG SUPPORT.',540,y+180,25,750,muted,'text-anchor="middle"');text('Proud supporters of our club leagues.',64,H-220,31,650,dark);caption='Meet Northline, our fictional sample club partner. Sponsor logos, message and permissions would be controlled by the club.';
  }
  if(o.data&&['scoreboard','poster','photo'].includes(T))caption=`${o.brand.name} · ${roundLabel}\n${matchCaption(results[0])}\nSee the full league results on Rallora.`;
  if(o.data&&['grid','carousel'].includes(T))caption=`${o.brand.name} · ${roundLabel}\n${results.map(matchCaption).join('\n')}\nSee all results and standings on Rallora.`;
  if(o.data&&slides>1)text(`PAGE ${Math.max(0,Math.min(slides-1,o.slide??0))+1} / ${slides}`,1016,H-160,17,750,muted,'text-anchor="end"');
  footer();p.push('</g></svg>');return {svg:p.join(''),caption,slides};
}

/** Connected entry point: no synthetic fallbacks can be selected by the application. */
export function renderLeagueTemplate(o:Omit<GalleryOptions,'template'|'data'|'sponsor'>&{template:ConnectedTemplate;data:GalleryLeagueData}):ReturnType<typeof renderClubTemplate>{
  if(!o.data.season.trim())throw new Error('Choose a published league.');
  if(['table','leader'].includes(o.template)){
    if(!o.data.standings?.length||!o.data.division)throw new Error('Choose a division with current standings.');
  }else if(!o.data.matches?.length||o.data.round===undefined)throw new Error('Choose confirmed league results.');
  return renderClubTemplate({...o,sponsor:false});
}

export function renderCampaignTemplate(o:Omit<GalleryOptions,'template'|'data'|'sponsor'>&{campaign:Campaign}):ReturnType<typeof renderClubTemplate>{
  const c=o.campaign;if(!c.title.trim()||!c.context.trim())throw new Error('Choose verified club content.');
  if(!['open','deadline','event','partner','movement'].includes(c.kind))throw new Error('Unsupported campaign.');
  if(c.kind==='deadline'&&(!c.count||!c.dateLabel))throw new Error('A verified deadline is required.');
  if(c.kind==='partner'&&!c.partnerName)throw new Error('Choose an active sponsor.');
  if(c.kind==='event'&&(!c.day||!c.month||!c.weekday))throw new Error('A published event date is required.');
  if(c.kind==='movement'&&!c.movements?.length)throw new Error('Recorded active-cycle movements are required.');
  return renderClubTemplate({...o,template:c.kind,sponsor:false});
}

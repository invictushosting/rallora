/** Local content preparation only. No model or publishing requests. */
export type StudioMatch = {
  id: string; seasonId: string; season: string; week: number; division: string;
  home: string; away: string; score: string; homeScore: string; awayScore: string;
  confirmedAt: string;
};
export type ArtworkStyle = "court" | "editorial" | "minimal";
export type ArtworkSize = "square" | "portrait" | "story";
export const ARTWORK_SIZES = {
  square: { width: 1080, height: 1080, label: "Square · 1080 × 1080" },
  portrait: { width: 1080, height: 1350, label: "Portrait · 1080 × 1350" },
  story: { width: 1080, height: 1920, label: "Story · 1080 × 1920" },
} as const;
export function roundMatches(matches: StudioMatch[], anchor: StudioMatch) {
  return matches.filter(m => m.seasonId === anchor.seasonId && m.week === anchor.week);
}
export function resultFingerprint(matches: StudioMatch[]) {
  return JSON.stringify(matches.map(m => [m.id, m.home, m.away, m.homeScore, m.awayScore])
    .sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
}
export function preparePost(type: "result" | "roundup", matches: StudioMatch[], anchor: StudioMatch) {
  if (type === "result") return {
    title: `${anchor.division} · Match result`,
    body: `${anchor.home} vs ${anchor.away}\n${anchor.score}\n${anchor.season} · Round ${anchor.week}\n\nSee the full results and standings on Rallora.`,
  };
  const round = roundMatches(matches, anchor);
  const lines = round.map(m => `${m.division}: ${m.home} vs ${m.away} — ${m.score}`);
  const included: string[] = [];
  for (const line of lines) {
    if ((included.join("\n") + line).length > 3100) break;
    included.push(line);
  }
  return { title: `${anchor.season} · Round ${anchor.week} roundup`,
    body: `${included.join("\n")}${included.length < round.length ? "\nMore confirmed results in the club hub." : ""}\n\nSee the latest standings on Rallora.` };
}
const escapeXml = (s: string) => s.replace(/[<>&"']/g, ch => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[ch]!));
function lines(text: string, columns: number) {
  const result: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) { result.push(""); continue; }
    let row = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      // Split unbroken strings too, so even pasted URLs cannot escape the artwork.
      const chunks = Array.from(word).reduce<string[]>((all, ch, i) => {
        if (i % columns === 0) all.push(""); all[all.length - 1] += ch; return all;
      }, []);
      for (const chunk of chunks) {
        if (Array.from(row + " " + chunk).length > columns && row) { result.push(row); row = ""; }
        row = row ? row + " " + chunk : chunk;
      }
    }
    if (row) result.push(row);
  }
  return result;
}
export type ArtworkInput = { club: string; accent: string; title: string; body: string;
  size: ArtworkSize; style: ArtworkStyle; matches: StudioMatch[]; logoData?: string };
/** The preview and PNG use this identical, escaped, self-contained SVG. */
export function createArtwork(input: ArtworkInput): { svg: string; omitted: number } {
  const h = ARTWORK_SIZES[input.size].height;
  const light = input.style !== "court";
  const minimal = input.style === "minimal";
  const bg = light ? input.style === "minimal" ? "#FFFFFF" : "#F5F1E8" : "#061A39", ink = light ? "#061A39" : "#FFFFFF";
  const muted = light ? "#415672" : "#B9CEE3";
  const accent = /^#[0-9a-f]{6}$/i.test(input.accent) ? input.accent : "#00B0FE";
  const parts: string[] = [];
  const text = (s: string, x: number, y: number, size: number, weight = 400, fill = ink) =>
    parts.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(s)}</text>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}"><rect width="1080" height="${h}" fill="${bg}"/><g font-family="Arial, Helvetica, sans-serif">`);
  parts.push(`<path d="M750 0V${h}M540 0V${h}M1040 0V${h}M540 ${h/2}H1080" stroke="${ink}" opacity=".045" stroke-width="3"/><rect x="64" y="65" width="68" height="9" rx="4" fill="${accent}"/>`);
  const clubLines = lines(input.club.toUpperCase(), 35).slice(0,2);
  clubLines.forEach((s,i) => text(s,64,125+i*32,28,700,muted));
  let y = clubLines.length > 1 ? 229 : 200;
  const headline = lines(input.title, 25);
  headline.slice(0,3).forEach((s,i) => text(i===2 && headline.length>3 ? s.slice(0,23)+"…" : s,64,y+i*70,60,800));
  y += Math.min(headline.length,3)*70 + 30;
  let omitted = Math.max(0,headline.length-3);
  if (input.matches.length) {
    const single = input.matches.length === 1;
    const cardHeight = single ? (input.size === "story" ? 480 : 350) : 190;
    const step = cardHeight + 20;
    const capacity = Math.max(1,Math.floor((h-205-y)/step));
    const visible = input.matches.slice(0,capacity);
    if (single) {
      const league=lines(input.matches[0].season,46).slice(0,2);
      league.forEach((line,i)=>text(line,64,y+i*34,26,600,muted));
      y=Math.max(y+league.length*34+30, Math.round((h-cardHeight)/2));
    }
    for (const m of visible) {
      parts.push(`<rect x="64" y="${y}" width="952" height="${cardHeight}" rx="${minimal ? 0 : 20}" fill="${ink}" opacity=".055"/>`);
      if (minimal) parts.push(`<path d="M64 ${y}H1016" stroke="${ink}" stroke-width="3"/>`);
      text(`${m.division} · ROUND ${m.week}`.slice(0,54),88,y+35,21,700,muted);
      if(single) {
        const rowGap = input.size === "story" ? 170 : 125;
        for(const [index,name,score] of [[0,m.home,m.homeScore],[1,m.away,m.awayScore]] as const) {
          const rowY=y+90+index*rowGap;
          text(index===0?"HOME":"AWAY",88,rowY,18,700,muted);
          lines(name,25).slice(0,2).forEach((line,i)=>text(line,88,rowY+44+i*44,36,700));
          const scores=score.trim().split(/\s+/);
          if(scores.length<=5&&scores.every(n=>/^\d{1,2}$/.test(n))) {
            scores.forEach((n,i)=>text(n,730+i*52,rowY+44,39,800));
          } else text(score.slice(0,16),730,rowY+44,25,700);
        }
      } else {
        const home=lines(m.home,30),away=lines(m.away,30);
        text(home[0]+(home.length>1?"…":""),88,y+87,29,700);
        text(m.homeScore.slice(0,16),735,y+87,27,700);
        text(away[0]+(away.length>1?"…":""),88,y+147,29,700);
        text(m.awayScore.slice(0,16),735,y+147,27,700);
        text("HOME",88,y+60,15,700,muted);text("AWAY",88,y+120,15,700,muted);
      }
      y += step;
    }
    omitted += input.matches.length-visible.length;
    if (input.matches.length>visible.length) text(`+ ${input.matches.length-visible.length} more results in the club hub`,64,h-185,23,700,muted);
  } else {
    const bodyLines=lines(input.body,47), room=Math.max(1,Math.floor((h-220-y)/41));
    bodyLines.slice(0,room).forEach((s,i)=>text(i===room-1&&bodyLines.length>room?s.slice(0,44)+"…":s,64,y+i*41,30,400,muted));
    omitted += Math.max(0,bodyLines.length-room);
  }
  parts.push(`<path d="M64 ${h-150}H1016" stroke="${accent}" stroke-width="3"/>`);
  if (light) parts.push(`<rect x="50" y="${h-132}" width="275" height="92" rx="12" fill="#061A39"/>`);
  if (input.logoData && /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(input.logoData))
    parts.push(`<image href="${input.logoData}" x="64" y="${h-120}" width="245" height="58"/>`);
  else text("RALLORA",64,h-78,32,800, light ? "#FFFFFF" : ink);
  text("YOUR CLUB. YOUR GAME.",620,h-78,22,700,muted);
  parts.push("</g></svg>");
  return { svg:parts.join(""), omitted };
}

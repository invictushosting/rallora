import{readableInk,type GalleryBrand}from'./gallery';
import type{StudioClub}from'./league-source';
const validColour=(s:string|null,fallback:string)=>s&&/^#[a-f\d]{6}$/i.test(s)?s:fallback;
export function clubBrand(club:StudioClub,logo:string):GalleryBrand{
 const primary=validColour(club.primary_color,'#061A39'),secondary=validColour(club.secondary_color,'#F4F1E7');
 const dark=readableInk(primary)==='#FFFFFF'?primary:readableInk(secondary)==='#FFFFFF'?secondary:'#061A39';
 let accent=validColour(club.accent_color,primary);if(accent.toLowerCase()===dark.toLowerCase())accent=readableInk(secondary)==='#061A39'?secondary:'#00B0FE';
 return{name:club.name,initials:club.name.split(/\s+/).map(s=>s[0]).join('').slice(0,3),accent,dark,cream:readableInk(secondary)==='#061A39'?secondary:'#F4F1E7',logo};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {CLUB_TEMPLATES,renderClubTemplate,GALLERY_HEIGHTS,readableInk} from '../lib/social/gallery.ts';
const brand={name:'Example Padel Club',initials:'EP',accent:'#A9E878',dark:'#103F35',cream:'#F4F1E7'};
test('club collection has distinct designs in all required content families',()=>{
 assert.equal(CLUB_TEMPLATES.length,12);assert.equal(new Set(CLUB_TEMPLATES.map(t=>t.id)).size,12);
 assert.deepEqual([...new Set(CLUB_TEMPLATES.map(t=>t.category))],['Results','Roundups','Tables','Club marketing']);
 const outputs=CLUB_TEMPLATES.map(t=>renderClubTemplate({template:t.id,size:'square',brand,sponsor:false}).svg);
 assert.equal(new Set(outputs).size,12);
});
test('every template exports exact dimensions for all three formats',()=>{
 for(const t of CLUB_TEMPLATES)for(const[size,h]of Object.entries(GALLERY_HEIGHTS)){
  const{svg,caption}=renderClubTemplate({template:t.id,size,brand,sponsor:true});
  assert.ok(svg.includes(`viewBox="0 0 1080 ${h}"`));assert.ok(svg.endsWith('</svg>'));assert.ok(caption.trim());
  assert.ok(!svg.includes('undefined'));assert.ok(!svg.includes('NaN'));
 }
});
test('carousel has a cover and two different result slides',()=>{
 const slides=[0,1,2].map(slide=>renderClubTemplate({template:'carousel',size:'portrait',brand,sponsor:false,slide}));
 assert.ok(slides.every(s=>s.slides===3));assert.equal(new Set(slides.map(s=>s.svg)).size,3);
 assert.ok(slides[1].svg.includes('Alex Morgan'));assert.ok(slides[2].svg.includes('Morgan Fox'));
});
test('club fields are escaped and unsafe image/colour values never become markup',()=>{
 for(const t of CLUB_TEMPLATES){const{svg}=renderClubTemplate({template:t.id,size:'square',brand:{...brand,name:'<script>alert(1)</script>',initials:'<EP>',logo:'javascript:alert(1)',accent:'red" onload="x'},photo:'https://external.example/private.jpg',sponsor:false});assert.ok(!svg.includes('<script'));assert.ok(!svg.includes('javascript:'));assert.ok(!svg.includes('https://external'));assert.ok(svg.includes('&lt;'));}
});
test('sponsor credit is optional and uploaded media is embedded, not fetched',()=>{
 const base={template:'photo',size:'square',brand};
 assert.ok(!renderClubTemplate({...base,sponsor:false}).svg.includes('SUPPORTED BY NORTHLINE'));
 assert.ok(renderClubTemplate({...base,sponsor:true}).svg.includes('SUPPORTED BY NORTHLINE'));
 const {svg}=renderClubTemplate({...base,sponsor:false,photo:'data:image/png;base64,YQ=='});
 assert.ok(svg.includes('href="data:image/png;base64,YQ=="'));
});
test('light and dark club accents select legible foregrounds',()=>{
 assert.equal(readableInk('#A9E878'),'#061A39');assert.equal(readableInk('#061A39'),'#FFFFFF');
});

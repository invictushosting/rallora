import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifySupportWebhook(raw:string,headers:Headers,secret:string,now=Date.now()):boolean{
 const id=headers.get('svix-id'),timestamp=headers.get('svix-timestamp'),signature=headers.get('svix-signature');
 if(!id||!timestamp||!signature||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!secret.startsWith('whsec_'))return false;
 const key=Buffer.from(secret.slice(6),'base64');if(key.length<16)return false;
 const expected=createHmac('sha256',key).update(`${id}.${timestamp}.${raw}`).digest();
 return signature.split(' ').some(part=>{const [version,value]=part.split(',');if(version!=='v1'||!value)return false;const actual=Buffer.from(value,'base64');return actual.length===expected.length&&timingSafeEqual(actual,expected);});
}
export function supportReplyToken(recipients:unknown,domain:string):string|null{
 if(!Array.isArray(recipients))return null;
 for(const recipient of recipients){if(typeof recipient!=='string')continue;const match=recipient.trim().toLowerCase().match(/^support\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@([a-z0-9.-]+)$/);if(match&&match[2]===domain.toLowerCase())return match[1];}
 return null;
}
export function supportSender(from:unknown):string|null{
 if(typeof from!=='string')return null;
 const value=(from.match(/<([^<>]+)>$/)?.[1]||from).trim().toLowerCase();
 return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)?value:null;
}
export function supportEmailText(email:{text?:unknown;html?:unknown;attachments?:unknown}):string{
 const plain=typeof email.text==='string'&&email.text.trim()?email.text:typeof email.html==='string'?email.html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' '):'';
 const attachmentNote=Array.isArray(email.attachments)&&email.attachments.length?'\n\n[Email attachments are available in the receiving mailbox; they are not imported into this ticket.]':'';
 return ((plain.trim()||'[Reply received without text content.]').slice(0,9500)+attachmentNote).slice(0,10000);
}

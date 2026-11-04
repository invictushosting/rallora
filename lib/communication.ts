export const COMMUNICATION_TYPES = [
  {key:'booking',title:'Match still unbooked',description:'Remind both captains to arrange a court before the fixture deadline.',timing:'Hours before the deadline',hours:168},
  {key:'upcoming',title:'Upcoming booked match',description:'Send both captains a reminder before their recorded booking.',timing:'Hours before the match',hours:24},
  {key:'missing_result',title:'Result not submitted',description:'Ask both captains for a score after the recorded match has ended.',timing:'Hours after the match',hours:24},
  {key:'confirmation',title:'Result awaiting confirmation',description:'Remind only the opposing captain to review the submitted result.',timing:'Hours after submission',hours:24},
  {key:'overdue',title:'Overdue fixture',description:'Chase unfinished fixtures. Stops when submitted, disputed or completed.',timing:'Hours after the deadline',hours:24},
  {key:'registration',title:'Registration updates & partner invitations',description:'Acknowledge entries, send decisions and invite approved partners.',hours:undefined},
  {key:'fixtures',title:'Fixtures published',description:'Notify captains when their competition is activated.',hours:undefined},
  {key:'messages',title:'Match conversations',description:'Alert fixture players to messages and time proposals, and organisers when help is requested.',hours:undefined},
  {key:'results',title:'Result actions',description:'Notify captains about a result to review, a confirmation or a dispute.',hours:undefined},
] as const;
export type CommunicationKey=typeof COMMUNICATION_TYPES[number]['key'];
export type CommunicationRule={enabled:boolean;email:boolean;in_app:boolean;hours?:number;repeat_hours?:number};
export type CommunicationSettings={club_id:string;enabled:boolean;timezone:string;send_hour:number;quiet_end_hour:number;daily_limit:number;rules:Record<CommunicationKey,CommunicationRule>};
export function defaultCommunicationSettings(clubId:string):CommunicationSettings {
 return {club_id:clubId,enabled:false,timezone:'Europe/London',send_hour:9,quiet_end_hour:20,daily_limit:3,rules:Object.fromEntries(COMMUNICATION_TYPES.map(type=>[type.key,{enabled:true,email:true,in_app:true,...(type.hours?{hours:type.hours}:{}),...(type.key==='overdue'?{repeat_hours:72}:{})}])) as CommunicationSettings['rules']};
}
export type DeliveryMessage={id:string;to:string;title:string;body:string;actionUrl:string;brand:{name:string;sender:string;logoUrl:string|null;primaryColour:string|null;replyTo:string}};
// Fixed application origin: neither scheduler requests nor queued values choose an external action destination.
export function communicationActionUrl(path:string) {
 if(!/^\/clubs\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:(captain|join-team|admin|register)(\?[^#]*)?|matches\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(path)) throw new Error('Invalid club action link');
 return `https://www.rallora.app${path}`;
}

// Keep invitation authentication on the original, validated invite URL.
export function deliveryPresentation(job: Pick<DeliveryMessage, 'actionUrl' | 'body'>) {
 const url = communicationActionUrl(job.actionUrl);
 const invitation = new URL(url).pathname.endsWith('/join-team');
 return {url, label: invitation ? 'Create your account or sign in' : 'Open your club',
  body: invitation ? `${job.body} Both team members can have their own Rallora login. Use the email address that received this invitation, create an account or sign in, then claim your team place. You can view fixtures, join match chat and propose times; captains manage results and recorded court bookings.` : job.body};
}

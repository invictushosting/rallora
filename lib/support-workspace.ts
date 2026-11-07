export type SupportPlayer={email:string;userId:string|null;name:string|null;confirmedAt:string|null;lastSignIn:string|null;playtomicEmail:string|null;teams:{id:string;active:boolean;players:string;division:string;season:string;seasonId:string;club:string;slug:string;hasAccess:boolean;fixtures:number;openFixtures:number}[];invites:{id:string;status:string;claimedAt:string|null;teamId:string|null;club:string;slug:string;season:string}[];registrations:{status:string;captain:string;partner:string;season:string;club:string;slug:string}[]};
export function playerAccessChecks(player:SupportPlayer):string[]{
 const checks=[player.userId?(player.confirmedAt?'Account confirmed':'Email confirmation needed'):'No Rallora account found'];
 const active=player.teams.filter(t=>t.active);
 if(player.invites.some(i=>i.status==='pending'&&active.some(t=>t.id===i.teamId)))checks.push('Team invitation unclaimed');
 if(active.length)checks.push(active.some(t=>t.hasAccess)?'Team access linked':'No team access linked');
 else checks.push('No active team found');
 if(active.some(t=>t.openFixtures>0))checks.push('Open fixtures available');
 return checks;
}
export function matchesSupportSearch(ticket:{id:string;subject:string;requester_name:string|null;requester_email:string;message:string;internal_notes:string|null;assignee:string|null},query:string){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const text=[ticket.id,ticket.subject,ticket.requester_name,ticket.requester_email,ticket.message,ticket.internal_notes,ticket.assignee].join(' ').toLowerCase();
 return terms.every(term=>text.includes(term));
}

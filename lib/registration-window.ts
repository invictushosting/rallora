export type RegistrationWindow = {
 registration_published:boolean;
 registration_opens_at:string|null;
 registration_closes_at:string|null;
};
/** Match the database's inclusive opening/closing checks; invalid dates fail closed. */
export function registrationWindowState(window:RegistrationWindow|null|undefined,now=Date.now()):"hidden"|"upcoming"|"open"|"closed"{
 if(!window?.registration_published)return "hidden";
 const opens=window.registration_opens_at?Date.parse(window.registration_opens_at):null;
 const closes=window.registration_closes_at?Date.parse(window.registration_closes_at):null;
 if(!Number.isFinite(now)||(opens!==null&&!Number.isFinite(opens))||(closes!==null&&!Number.isFinite(closes)))return "closed";
 if(closes!==null&&now>closes)return "closed";
 if(opens!==null&&now<opens)return "upcoming";
 return "open";
}

/** A direct competition link must never silently enrol a player in a different league. */
export function selectRegistrationSeason<T extends RegistrationWindow & {id:string}>(seasons:T[],requestedId:string,now=Date.now()):T|null{
 if(requestedId)return seasons.find(season=>season.id===requestedId)??null;
 return seasons.find(season=>registrationWindowState(season,now)==="open")??null;
}

export type EventFormat="americano"|"mexicano"|"climb_courts"|"custom";

export type ScheduleMatch={
  round_number:number;
  court_number:number;
  team_a_player_1:string;
  team_a_player_2:string;
  team_b_player_1:string;
  team_b_player_2:string;
};

export type CompletedMatch=ScheduleMatch&{
  status:string;
  team_a_score:number|null;
  team_b_score:number|null;
};

type Standing={id:string;points:number};

function validatePlayers(playerIds:string[],courts:number){
  if(!Number.isInteger(courts)||courts<1)throw new Error("Enter at least one court.");
  if(new Set(playerIds).size!==playerIds.length)throw new Error("Each player can only appear once per round.");
  const required=courts*4;
  if(playerIds.length!==required)throw new Error(`This event needs exactly ${required} players for ${courts} court${courts===1?"":"s"}.`);
}

function court(round:number,courtNumber:number,players:string[]):ScheduleMatch{
  return {round_number:round,court_number:courtNumber,team_a_player_1:players[0],team_a_player_2:players[1],team_b_player_1:players[2],team_b_player_2:players[3]};
}

export function openingRound(playerIds:string[],courts:number):ScheduleMatch[]{
  validatePlayers(playerIds,courts);
  return Array.from({length:courts},(_,index)=>court(1,index+1,playerIds.slice(index*4,index*4+4)));
}

export function americanoRound(playerIds:string[],courts:number,roundNumber:number):ScheduleMatch[]{
  validatePlayers(playerIds,courts);
  if(roundNumber<1)throw new Error("Round number must be positive.");
  if(roundNumber===1)return openingRound(playerIds,courts);
  const anchor=playerIds[0],rest=playerIds.slice(1),shift=(roundNumber-1)%rest.length;
  const rotated=[anchor,...rest.slice(shift),...rest.slice(0,shift)];
  const pattern=(roundNumber-1)%3;
  return Array.from({length:courts},(_,index)=>{
    const group=rotated.slice(index*4,index*4+4);
    const arranged=pattern===1?[group[0],group[2],group[1],group[3]]:pattern===2?[group[0],group[3],group[1],group[2]]:group;
    return court(roundNumber,index+1,arranged);
  });
}

export function mexicanoRound(playerIds:string[],standings:Standing[],courts:number,roundNumber:number):ScheduleMatch[]{
  validatePlayers(playerIds,courts);
  if(roundNumber<1)throw new Error("Round number must be positive.");
  if(roundNumber===1)return openingRound(playerIds,courts);
  const order=new Map(playerIds.map((id,index)=>[id,index]));
  const points=new Map(standings.map(row=>[row.id,row.points]));
  const ranked=[...playerIds].sort((a,b)=>(points.get(b)??0)-(points.get(a)??0)||(order.get(a)??0)-(order.get(b)??0));
  return Array.from({length:courts},(_,index)=>{
    const group=ranked.slice(index*4,index*4+4);
    return court(roundNumber,index+1,[group[0],group[3],group[1],group[2]]);
  });
}

export function climbCourtsRound(playerIds:string[],previousRound:CompletedMatch[],courts:number,roundNumber:number):ScheduleMatch[]{
  validatePlayers(playerIds,courts);
  if(roundNumber<1)throw new Error("Round number must be positive.");
  if(roundNumber===1)return openingRound(playerIds,courts);
  if(previousRound.length!==courts||previousRound.some(match=>match.status!=="complete"||match.team_a_score===null||match.team_b_score===null)){
    throw new Error("Complete every match in the previous round before climbing the courts.");
  }
  const destinations=Array.from({length:courts},()=>[] as string[][]);
  for(const match of [...previousRound].sort((a,b)=>a.court_number-b.court_number)){
    if(match.team_a_score===match.team_b_score)throw new Error("Climb the Courts matches need a winner; tied scores cannot advance.");
    const a=[match.team_a_player_1,match.team_a_player_2],b=[match.team_b_player_1,match.team_b_player_2];
    const winner=match.team_a_score! > match.team_b_score! ? a : b,loser=winner===a?b:a;
    destinations[Math.max(0,match.court_number-2)].push(winner);
    destinations[Math.min(courts-1,match.court_number)].push(loser);
  }
  return destinations.map((pairs,index)=>{
    if(pairs.length!==2)throw new Error("The previous round does not contain a valid court ladder.");
    return court(roundNumber,index+1,[...pairs[0],...pairs[1]]);
  });
}

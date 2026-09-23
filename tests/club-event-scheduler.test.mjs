import test from "node:test";
import assert from "node:assert/strict";
import {americanoRound,mexicanoRound,climbCourtsRound} from "../lib/club-event-scheduler.ts";

const players=["a","b","c","d","e","f","g","h"];

test("Americano schedules every player exactly once and rotates partners",()=>{
  const first=americanoRound(players,2,1),second=americanoRound(players,2,2);
  const ids=second.flatMap(m=>[m.team_a_player_1,m.team_a_player_2,m.team_b_player_1,m.team_b_player_2]);
  assert.deepEqual([...ids].sort(),players);
  assert.notDeepEqual(second,first);
});

test("Mexicano groups leaderboard neighbours and balances teams",()=>{
  const standings=players.map((id,index)=>({id,points:80-index*10}));
  const round=mexicanoRound(players,standings,2,2);
  assert.deepEqual([round[0].team_a_player_1,round[0].team_a_player_2],["a","d"]);
  assert.deepEqual([round[0].team_b_player_1,round[0].team_b_player_2],["b","c"]);
});

test("Climb the Courts moves winners up and losers down",()=>{
  const previous=[
    {round_number:1,court_number:1,team_a_player_1:"a",team_a_player_2:"b",team_b_player_1:"c",team_b_player_2:"d",team_a_score:21,team_b_score:14,status:"complete"},
    {round_number:1,court_number:2,team_a_player_1:"e",team_a_player_2:"f",team_b_player_1:"g",team_b_player_2:"h",team_a_score:10,team_b_score:21,status:"complete"},
  ];
  const round=climbCourtsRound(players,previous,2,2);
  assert.deepEqual([round[0].team_a_player_1,round[0].team_a_player_2,round[0].team_b_player_1,round[0].team_b_player_2],["a","b","g","h"]);
  assert.deepEqual([round[1].team_a_player_1,round[1].team_a_player_2,round[1].team_b_player_1,round[1].team_b_player_2],["c","d","e","f"]);
});

test("Climb the Courts rejects incomplete rounds and draws",()=>{
  const incomplete=[{round_number:1,court_number:1,team_a_player_1:"a",team_a_player_2:"b",team_b_player_1:"c",team_b_player_2:"d",team_a_score:null,team_b_score:null,status:"scheduled"}];
  assert.throws(()=>climbCourtsRound(["a","b","c","d"],incomplete,1,2),/Complete every match/);
  const draw=[{...incomplete[0],team_a_score:10,team_b_score:10,status:"complete"}];
  assert.throws(()=>climbCourtsRound(["a","b","c","d"],draw,1,2),/need a winner/);
});

test("all automatic formats require four players per court",()=>{
  assert.throws(()=>americanoRound(players.slice(0,7),2,1),/exactly 8 players/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {CARBON_DIVISIONS, generateCarbonFixtures, scoreCarbonMatch, carbonStandings} from "../lib/carbon-padel.mjs";

const ids = ["A","B","C","D","E","F"];
test("all five divisions are configured", () => assert.deepEqual(CARBON_DIVISIONS.map(x=>x.name), ["Diamond","Kevlar","Steel","Ivory","Graphite"]));
test("each of six weeks has 15 unique pairings in five parallel rounds", () => {
  const fixtures = generateCarbonFixtures(ids);
  assert.equal(fixtures.length, 90);
  for (let week=1; week<=6; week++){
    const matches=fixtures.filter(x=>x.week===week);
    assert.equal(matches.length,15);
    assert.equal(new Set(matches.map(x=>[x.teamA,x.teamB].sort().join("-"))).size,15);
    for(let round=1;round<=5;round++){
      const games=matches.filter(x=>x.round===round);
      assert.equal(games.length,3);
      assert.equal(new Set(games.flatMap(x=>[x.teamA,x.teamB])).size,6);
    }
  }
});
test("win earns three points, tiebreak winner independently earns one", () => {
  assert.deepEqual([scoreCarbonMatch({teamA:"A",teamB:"B",gamesA:4,gamesB:2,tiebreakWinner:"B"}).pointsA,
    scoreCarbonMatch({teamA:"A",teamB:"B",gamesA:4,gamesB:2,tiebreakWinner:"B"}).pointsB],[3,1]);
});
test("draw gives one each plus tiebreak bonus", () => {
  const s=scoreCarbonMatch({teamA:"A",teamB:"B",gamesA:3,gamesB:3,tiebreakWinner:"A"});
  assert.deepEqual([s.pointsA,s.pointsB],[2,1]);
});
test("invalid scores and missing tiebreak are rejected", () => {
  assert.throws(()=>scoreCarbonMatch({teamA:"A",teamB:"B",gamesA:4,gamesB:1,tiebreakWinner:"A"}));
  assert.throws(()=>scoreCarbonMatch({teamA:"A",teamB:"B",gamesA:4,gamesB:2}));
  assert.throws(()=>generateCarbonFixtures(["A","A","C","D","E","F"]));
});
test("standings rank points, wins, game difference, then tiebreaks won", () => {
 const s=carbonStandings(ids,[{teamA:"A",teamB:"B",gamesA:4,gamesB:2,tiebreakWinner:"B"}]);
 assert.equal(s[0].team,"A");assert.equal(s[0].points,3);assert.equal(s.find(x=>x.team==="B").tiebreaksWon,1);
});

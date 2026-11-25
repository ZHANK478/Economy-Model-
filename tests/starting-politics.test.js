import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {PARTY_FAMILIES,PRESIDENTIAL_PARTY_FAMILIES} from '../src/political-config.js';
import {pollElectorate,conductElection} from '../src/electorate.js';
import {executePolitical,validatePoliticalSystem,enableStablePreferences,decisionBudget} from '../src/political-system.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
const start=(party,seed)=>{const o=newGameOptions({party});o.politicalOptions.nameSeed=seed;return createSimulation(o);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('all eleven presidential choices have distinct platforms, randomized support and coherent seats',()=>{
 assert.equal(PRESIDENTIAL_PARTY_FAMILIES.length,11);
 assert.equal(new Set(PRESIDENTIAL_PARTY_FAMILIES.map(x=>JSON.stringify(x.platform))).size,11);
 const opponents=new Set(),seats=new Set();
 for(const [i,f] of PRESIDENTIAL_PARTY_FAMILIES.entries()){
  const s=start(f.id,i+11),p=s.politics,active=p.parties.filter(x=>x.active);
  assert.equal(active.length,3);assert.equal(p.parties.find(x=>x.id===p.executive.playerParty).family,f.id);
  const major=active.filter(x=>!x.independent);assert.equal(major.length,2);
  assert.notEqual(major[0].family,major[1].family);
  opponents.add(p.parties.find(x=>x.id===p.majorPartyIds[1]).family);
  for(const id of p.majorPartyIds){const r=p.poll.parties.find(x=>x.id===id);assert.ok(r.share>=20-1e-6&&r.share<=40+1e-6);near(r.share,p.startingRatings.parties[id]);}
  const r=p.poll.parties.find(x=>x.id===p.executive.playerParty);assert.ok(r.candidateShare>=40&&r.candidateShare<=60);
  near(r.candidateShare,p.startingRatings.president);near(p.presidentApproval*100,p.startingRatings.president);
  const count=conductElection(s,'parliament');
  for(const x of active){assert.equal(count.results.find(r=>r.id===x.id).seats,x.seats);assert.ok(Math.abs(x.seats-p.totalSeats*p.poll.parties.find(r=>r.id===x.id).share/100)<1);}
  seats.add(active.map(x=>x.seats).join(','));validatePoliticalSystem(s);
 }
 assert.ok(opponents.size>3);assert.ok(seats.size>5);
});
test('random starts survive recalculation, a month, import and replay',()=>{
 let s=start('authoritarianLeft',284),p=s.politics;
 const before=structuredClone(p.poll);pollElectorate(s,{commitMemory:false});assert.deepEqual(p.poll,before);
 for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 s=advanceMonth(s,s.policy);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.metrics,s.metrics);
 const replay=replayJournal(loaded);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.politics.startingPreferences,s.politics.startingPreferences);
});
test('legacy starts retain their original catalog and fixed opponent',()=>{
 const o=newGameOptions();delete o.politicalOptions.startingPoliticsRevision;
 const s=createSimulation(o),p=s.politics;
 assert.equal(p.parties.length,PARTY_FAMILIES.length);assert.equal(p.nextPartyId,9);
 assert.deepEqual(p.majorPartyIds.map(id=>p.parties.find(x=>x.id===id).family),['liberal','conservative']);
 assert.equal(p.startingPreferences,undefined);
});

test('a frozen electorate does not lose its calibrated support just because time passes',()=>{
 const s=start('liberal',41);assert.equal(s.politics.stablePreferences,true);
 const before=pollElectorate(s,{commitMemory:false,assignPoll:false}).poll;
 s.month=24;
 const after=pollElectorate(s,{commitMemory:false,assignPoll:false}).poll;
 for(const row of before.parties){const next=after.parties.find(x=>x.id===row.id);near(row.share,next.share);near(row.candidateShare,next.candidateShare);}
 near(before.presidentApproval,after.presidentApproval);
});
test('stabilizing a legacy game preserves current support, costs no decision and replays',()=>{
 const o=newGameOptions();delete o.politicalOptions.stablePreferences;
 let s=createSimulation(o);for(let i=0;i<5;i++)s=advanceMonth(s);
 const before=pollElectorate(s,{commitMemory:false,assignPoll:false}).poll;
 const budget=decisionBudget(s).used;enableStablePreferences(s);
 assert.equal(decisionBudget(s).used,budget);
 const after=pollElectorate(s,{commitMemory:false,assignPoll:false}).poll;
 for(const row of before.parties){const next=after.parties.find(x=>x.id===row.id);near(row.share,next.share);near(row.candidateShare,next.candidateShare);}
 near(before.presidentApproval,after.presidentApproval);
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).metrics,s.metrics);
 s=advanceMonth(s);assert.deepEqual(replayJournal(s).metrics,s.metrics);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,runMonths,executePolitical,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {validatePoliticalSystem,decisionBudget} from '../src/political-system.js';
const country=(constitution={},extra={})=>createSimulation({politicalMode:true,seed:11,politicalOptions:{partyContinuity:true,constitution:{presidentTerm:12,parliamentOffset:84,parliamentTerm:84,...constitution},...extra}});
test('successors can win across multiple personal term limits without resetting the country',()=>{
 let s=country({regime:'personalist',termLimit:1});const first=s.politics.executive.presidentName;
 s=runMonths(s,36);const p=s.politics;
 assert.equal(s.month,36);assert.equal(p.executive.inOffice,true);assert.equal(p.executive.termsServed,1);
 assert.equal(p.executive.startedMonth,0);assert.equal(p.executive.leaderStartedMonth,36);
 assert.equal(p.executive.leaderHistory.length,3);assert.equal(p.executive.leaderHistory[0].name,first);
 assert.equal(p.executive.leaderHistory[0].endedMonth,12);assert.equal(p.constitution.termLimit,1);
 assert.equal(p.parties.find(x=>x.id===p.executive.playerParty).candidateIncumbent,true);
 validatePoliticalSystem(s);const loaded=importSimulation(exportSimulation(s));
 assert.deepEqual(replayJournal(loaded).politics,loaded.politics);assert.deepEqual(replayJournal(loaded).metrics,loaded.metrics);
});
test('a successor is nominated before election and does not receive personal incumbency',()=>{
 let s=country({regime:'personalist',termLimit:1});const name=s.politics.executive.presidentName;s=advanceMonth(s);
 const own=s.politics.parties.find(x=>x.id===s.politics.executive.playerParty);
 assert.equal(s.politics.executive.presidentName,name);assert.notEqual(own.candidateName,name);
 assert.equal(own.candidateIncumbent,false);assert.equal(s.politics.executive.termsServed,1);
});
test('defeat still ends office, even at a personal term limit',()=>{
 const s=runMonths(country({termLimit:1}),24);
 assert.equal(s.month,12);assert.equal(s.politics.executive.inOffice,false);
 assert.equal(s.politics.executive.reason,'Поражение на президентских выборах');
 assert.notEqual(s.politics.elections.at(-1).winner,s.politics.executive.playerParty);
});
test('a minority cabinet survives the negotiation deadline when constructive replacement lacks a majority',()=>{
 let s=country({form:'parliamentary',confidence:'constructive'});
 s.politics.coalition=[s.politics.executive.playerParty];s.politics.executive.formationDeadline=1;
 s.politics.parameters.coalitionTolerance=0;
 s=advanceMonth(s);assert.equal(s.politics.executive.inOffice,true);assert.equal(s.politics.executive.formationDeadline,null);
 assert.ok(s.politics.parliamentSupport<.5);const vote=s.politics.lastActions.find(x=>x.kind==='confidence');
 assert.ok(vote);assert.equal(vote.passed,false);assert.ok(s.lastReport.events.some(x=>x.includes('в меньшинстве')));
});
test('a successful ordinary no-confidence vote still removes a PM, while a separately elected president stays',()=>{
 for(const role of ['primeMinister','president']){
  let s=country({form:'semiPresidential',playerRole:role,confidence:'ordinary'});
  s.politics.coalition=[];s.politics.executive.formationDeadline=1;s=advanceMonth(s);
  assert.equal(s.politics.lastActions.find(x=>x.kind==='confidence').passed,true);
  assert.equal(s.politics.executive.inOffice,role==='president');
 }
});
test('recorded upgrade of an old game preserves its prior history and does not consume a decision',()=>{
 let s=country({regime:'personalist',termLimit:1},{partyContinuity:false,decisionLimit:3});s=runMonths(s,5);
 const before=JSON.stringify(s.history),used=decisionBudget(s).used;
 executePolitical(s,{kind:'setPartyContinuity'});assert.equal(JSON.stringify(s.history),before);assert.equal(decisionBudget(s).used,used);
 assert.deepEqual(replayJournal(s).politics,s.politics);
 s=runMonths(s,20);assert.equal(s.month,25);assert.ok(s.politics.executive.inOffice);
 assert.deepEqual(replayJournal(s).metrics,s.metrics);assert.deepEqual(replayJournal(s).politics,s.politics);
});

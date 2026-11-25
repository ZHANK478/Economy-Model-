import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSimulation,executePolitical,advanceMonth,exportSimulation,importSimulation,replayJournal,copy} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {enableAccountability,validatePoliticalSystem} from '../src/political-system.js';
import {pollElectorate} from '../src/electorate.js';
import {createBill,rollCall} from '../src/legislation.js';
import {metricSeries} from '../src/dashboard-data.js';
import {ratingExplanation} from '../src/political-reporting.js';
import {independentPlatform} from '../src/political-accountability.js';
const start=()=>{const o=newGameOptions({resource:false});o.politicalOptions.nameSeed=7;return createSimulation(o);};
const poll=s=>pollElectorate(s,{commitMemory:false,assignPoll:false}).poll;
test('presidential scenario has two parties and diverse independents, no coalition or cabinet quota',()=>{
 const s=start(),p=s.politics;assert.equal(p.parties.filter(x=>x.active&&!x.independent).length,2);assert.equal(p.parties.filter(x=>x.active&&x.independent).length,1);
 assert.deepEqual(p.coalition,[]);assert.deepEqual(p.coalitionAgreements,[]);assert.ok(p.parties.every(x=>x.cabinetPosts===0));
 const ind=p.parties.find(x=>x.independent);assert.ok(new Set(ind.deputies.map(d=>JSON.stringify(independentPlatform(s,d)))).size>1);
 assert.throws(()=>executePolitical(s,{kind:'coalitionOffer',partyId:ind.id}),/коалиций/);
 validatePoliticalSystem(s);
});
test('personal competence, organization and unknown promises cannot affect a revised election',()=>{
 const s=start(),before=poll(s);for(const x of s.politics.parties){x.competence=0;x.candidateCompetence=0;x.organization=100;x.brokenPromises=100;}
 assert.deepEqual(poll(s),before);assert.throws(()=>executePolitical(s,{kind:'promise',key:'incomeTax',value:5}),/отключены/);
});
test('repeated refusals visibly change own deputies and duplicate clicks do not farm reactions',()=>{
 const s=start(),p=s.politics,own=p.parties.find(x=>x.id===p.executive.playerParty);
 const baseline=copy(s),oldBill=createBill(baseline,{corporateTax:24},{sponsor:own.id});const yesBefore=rollCall(baseline,oldBill).parties.find(x=>x.id===own.id).yes;
 for(let i=0;i<5;i++){
  p.decisionLimit=undefined;const b=createBill(s,{corporateTax:24-i},{sponsor:own.id,monthlyInitiative:true});
  executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
  const loyalty=own.executiveLoyalty,events=p.publicEvents.length;
  executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});assert.equal(own.executiveLoyalty,loyalty);assert.equal(p.publicEvents.length,events);
 }
 const b=createBill(s,{corporateTax:24},{sponsor:own.id});b.id=oldBill.id;
 const votes=rollCall(s,b);assert.ok(votes.parties.find(x=>x.id===own.id).yes<yesBefore/2);assert.ok(own.executiveLoyalty<.15);
});
test('tax positions can change support without inventing economic outcomes',()=>{
 const s=start(),a=copy(s),b=copy(s),sponsor=s.politics.majorPartyIds[1];
 const good=createBill(a,{incomeTax:5},{sponsor,monthlyInitiative:true}),bad=createBill(b,{incomeTax:40},{sponsor,monthlyInitiative:true});
 // Record after a passed vote without relying on a particular majority draw.
 good.status='awaitingSignature';bad.status='awaitingSignature';
 executePolitical(a,{kind:'sign',billId:good.id});executePolitical(b,{kind:'sign',billId:bad.id});
 const id=s.politics.executive.playerParty,share=x=>poll(x).parties.find(y=>y.id===id).candidateShare;
 assert.notEqual(share(a),share(b));assert.deepEqual(a.households,s.households);assert.deepEqual(b.households,s.households);assert.equal(a.metrics.realIncomeIndex,s.metrics.realIncomeIndex);assert.deepEqual(a.politics.policyReputation.implementation,{});
 assert.ok(good.publicReaction.audiences.every(x=>x.impact===0));
});
test('failed legislation receives no enacted-policy credit and independent votes retain bloc counts',()=>{
 const s=start(),b=createBill(s,{incomeTax:40});const result=rollCall(s,b),ind=s.politics.independentPartyId,row=result.parties.find(x=>x.id===ind);
 assert.ok(row.blocs.length>1);assert.equal(row.blocs.reduce((n,x)=>n+x.yes+x.no+x.abstain,0),s.politics.parties.find(x=>x.id===ind).seats);
 b.status='rejected';executePolitical(s,{kind:'decideBill',billId:b.id,decision:'accept'});assert.ok(!s.politics.publicEvents.some(x=>x.billId===b.id));
});
test('rating explanation uses actual poll, is read-only, and revised decisions replay exactly',()=>{
 let s=start();const own=s.politics.executive.playerParty,b=createBill(s,{incomeTax:16},{sponsor:own,monthlyInitiative:true});executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 assert.equal(metricSeries(s,'presidentialVoteShare').at(-1).presidentialVoteShare,s.metrics.presidentialVoteShare);
 const before=copy(s),ex=ratingExplanation(s);assert.deepEqual(s,before);assert.equal(ex.current,s.politics.poll.parties.find(x=>x.id===own).candidateShare);assert.equal(ex.factors.find(x=>x.factor==='decisions').impact,0);
 // Use regular commands rather than synthetic bill injection in the replay.
 s=start();const proposal=s.politics.bills.find(x=>x.monthlyInitiative&&['draft','awaitingSignature'].includes(x.status));executePolitical(s,{kind:'decideBill',billId:proposal.id,decision:'reject'});
 s=advanceMonth(s);const restored=importSimulation(exportSimulation(s)),replay=replayJournal(restored);assert.deepEqual(replay.metrics,restored.metrics);assert.deepEqual(replay.politics,restored.politics);
});
test('legacy migration preserves economy and history, records the transition and replays it',()=>{
 let s=createSimulation({politicalMode:true,seed:42,politicalOptions:{electionExperience:1,instantRules:true}});s=advanceMonth(s);
 const metrics=copy(s.metrics),history=copy(s.history),elections=copy(s.politics.elections);enableAccountability(s);
 assert.equal(s.month,1);assert.deepEqual(s.history,history);assert.deepEqual(s.politics.elections,elections);assert.equal(s.metrics.realGDPMonthly,metrics.realGDPMonthly);assert.deepEqual(s.politics.coalition,[]);
 const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.politics,s.politics);
});

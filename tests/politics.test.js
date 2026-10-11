import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,runMonths,comparePolicies,schedulePolitical,scheduleOwnership,scheduleShock,copy,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {hash} from '../src/political-config.js';
import {apportion,integerVotes,legislatureSeats,rankedCount} from '../src/elections.js';
import {createBill,voteArticle,voteBill,presidentialDecision,amendBill,rollCall,referendum} from '../src/legislation.js';
import {electorateTotals,makeElectorate,advanceCitizenship,conductElection,pollElectorate} from '../src/electorate.js';
import {coalitionSeats,validatePoliticalSystem} from '../src/political-system.js';
const country=(constitution={},other={})=>createSimulation({politicalMode:true,politicalOptions:{constitution,instantRules:false},...other});
const sum=a=>a.reduce((v,x)=>v+x,0);
test('seeded monthly draws represent rare events without adjacent-month hash clustering',()=>{const values=Array.from({length:10000},(_,month)=>hash(11,'rare-event',month));assert.ok(values.every(x=>x>=0&&x<1));const rare=values.filter(x=>x<.005).length;assert.ok(rare>25&&rare<80);assert.ok(Math.abs(sum(values)/values.length-.5)<.015);});
function adopt(s,billId){schedulePolitical(s,{kind:'voteBill',billId});if(s.politics.executive.role==='president')schedulePolitical(s,{kind:'sign',billId});return advanceMonth(s);}

test('D’Hondt, thresholds, integer vote conservation and preferential transfers use exact rules',()=>{
  assert.deepEqual(apportion([100,80,30],5),[3,2,0]);
  assert.deepEqual(apportion([60,35,5],10,'dhondt',6),[6,4,0]);
  assert.equal(sum(apportion([1,1,1,1,1,1,1,1],120,'dhondt',15)),120);
  assert.deepEqual(integerVotes([.333,.333,.334],10),[3,3,4]);
  const r=rankedCount([{ranking:['a','b','c'],weight:4},{ranking:['b','c','a'],weight:3},{ranking:['c','b','a'],weight:2}],['a','b','c']);assert.equal(r.winner,'b');assert.equal(r.rounds.at(-1).votes.b,5);
});
test('parallel seats add district mandates; MMP compensates with explicit overhang',()=>{
  const districts=Array.from({length:5},()=>({votes:[20,80]}));
  assert.deepEqual(legislatureSeats({system:'parallel',seats:10,threshold:0,votes:[80,20],districts}).seats,[4,6]);
  const m=legislatureSeats({system:'mmp',seats:10,threshold:0,votes:[80,20],districts});assert.deepEqual(m.seats,[8,5]);assert.equal(m.overhang,3);assert.equal(m.total,13);
});
test('all legislative systems conserve voters and seats, including uneven district counts',()=>{
  for(const system of ['pr','plurality','twoRound','parallel','mmp'])for(const seats of [31,120]){
    const s=country({electoralSystem:system,seats});const e=s.politics.elections[0];
    assert.equal(sum(e.results.map(x=>x.votes)),e.voters);assert.ok(e.voters<=e.eligible);assert.equal(sum(e.results.map(x=>x.seats)),e.totalSeats);
    assert.equal(sum(s.politics.parties.map(x=>x.seats)),e.totalSeats);
    if(e.districts.length)assert.equal(sum(e.districts.map(d=>sum(d.votes))),e.voters);
    validatePoliticalSystem(s);
  }
});
test('presidential systems have integer round totals and a separate candidate ballot',()=>{
  for(const system of ['plurality','twoRound','ranked']){
    const s=country({presidentSystem:system}),e=conductElection(s,'president');assert.ok(e.winner);assert.equal(sum(e.results.map(x=>x.votes)),e.voters);
    for(const r of e.rounds)assert.equal(sum(r.results.map(x=>x.votes)),r.voters);assert.ok(e.winnerCandidate);
  }
});
test('adult citizens, residents and naturalization conserve electorate; migrants do not vote immediately',()=>{
  let s=country();const totals=electorateTotals(s);assert.ok(totals.eligible<totals.adults&&totals.adults<s.population);assert.ok(Math.abs(sum(makeElectorate(s).map(g=>g.weight))-totals.eligible)<1e-10);
  const before=copy(s);s.month=1;s.demography.netMigration=.1;s.demography.deaths=0;advanceCitizenship(s,before);
  assert.ok(Math.abs(s.politics.citizenship.residents-before.politics.citizenship.residents-.095)<1e-10);assert.equal(s.politics.citizenship.newlyNaturalized,0);
  s.month=61;s.demography.netMigration=0;advanceCitizenship(s,before);assert.ok(s.politics.citizenship.newlyNaturalized>0);assert.ok(s.politics.citizenship.residents<before.politics.citizenship.residents+.095);
});
test('ratings change while parliamentary seats remain fixed between elections',()=>{
  const s=country(),seats=s.politics.parties.map(x=>x.seats),next=runMonths(s,6);
  assert.deepEqual(next.politics.parties.map(x=>x.seats),seats);assert.notEqual(next.metrics.executiveApproval,s.metrics.executiveApproval);assert.equal(next.politics.elections.length,1);
});
test('economic experience affects voter utilities without equating approval, votes and seats',()=>{
  const s=country(),good=copy(s),bad=copy(s);for(const h of good.households)h.realIncomeIndex=150;for(const h of bad.households)h.realIncomeIndex=50;
  good.metrics.realIncomeIndex=150;bad.metrics.realIncomeIndex=50;bad.metrics.unemployment=30;bad.metrics.inflationYoY=60;
  const gp=pollElectorate(good).poll,bp=pollElectorate(bad).poll;assert.ok(gp.approval>bp.approval);assert.ok(Math.abs(gp.parties.find(x=>x.id===s.politics.executive.playerParty).share-gp.approval*100)>5);
});
test('policy draft enters a bill and cannot bypass articles, final vote or presidential signature',()=>{
  let s=country();const original=JSON.stringify(s);s=advanceMonth(s,{...s.policy,incomeTax:15});assert.equal(s.policy.incomeTax,18);assert.equal(s.politics.bills.length,1);
  const prior=copy(s);schedulePolitical(s,{kind:'voteBill',billId:1});s=advanceMonth(s);assert.equal(s.policy.incomeTax,18);assert.equal(s.politics.bills[0].status,'awaitingSignature');assert.ok(s.politics.bills[0].articles.every(a=>a.vote.passed));
  schedulePolitical(s,{kind:'sign',billId:1});s=advanceMonth(s);assert.equal(s.policy.incomeTax,15);assert.equal(s.politics.bills[0].status,'enacted');assert.equal(prior.politics.bills[0].status,'draft');assert.equal(JSON.parse(original).month,0);
});
test('amendments invalidate previous votes; unchanged article votes cannot be rerolled',()=>{
  const s=country(),b=createBill(s,{incomeTax:15});const vote=voteArticle(s,b.id,1),count=s.politics.rollCalls.length;
  assert.deepEqual(voteArticle(s,b.id,1),b.articles[0].vote);assert.equal(s.politics.rollCalls.length,count);
  assert.throws(()=>amendBill(s,b.id,1,15),/содержательно/);assert.equal(b.revision,0);assert.equal(createBill(s,{incomeTax:15}).id,b.id);
  amendBill(s,b.id,1,16);assert.equal(b.revision,1);assert.equal(b.articles[0].vote,undefined);assert.equal(b.patch.incomeTax,16);assert.ok(vote.deputies.length===s.politics.totalSeats);
});
test('law failure does not dismiss a president and constitutional rules require a higher threshold',()=>{
  const s=country(),ordinary=createBill(s,{incomeTax:15}),constitutional=createBill(s,{freeMedia:false});
  const r=rollCall(s,ordinary),c=rollCall(s,constitutional);assert.equal(r.required,61);assert.equal(c.required,80);
  s.politics.coalition=[];voteBill(s,ordinary.id);assert.equal(s.politics.executive.inOffice,true);
});
test('presidential veto suspends law; its override is an independent qualified roll call',()=>{
  const s=country(),b=createBill(s,{incomeTax:15});voteBill(s,b.id);assert.equal(b.status,'awaitingSignature');presidentialDecision(s,b.id,'veto');assert.equal(b.status,'vetoed');const vote=presidentialDecision(s,b.id,'override');assert.equal(vote.required,80);
});
test('independent central bank blocks direct operational controls but affects actual lending rates',()=>{
  const s=country(),next=advanceMonth(s,{...s.policy,rate:40,reserveRequirement:20});assert.equal(next.policy.rate,s.policy.rate);assert.equal(next.policy.reserveRequirement,s.policy.reserveRequirement);assert.ok(next.politics.lastReview.some(x=>x.reason==='independentCentralBank'));assert.notEqual(next.monetary.effectiveRate,40);
  const dependent=country({independentCB:false}),d=advanceMonth(dependent,{...dependent.policy,rate:15});assert.equal(d.policy.rate,15);assert.equal(d.monetary.effectiveRate,15);
});
test('submitted ownership operations wait for authorization and preserve exact replay',()=>{
  let s=country();const control=advanceMonth(s);scheduleOwnership(s,{kind:'privatize',sector:1,points:5,compensation:1});s=advanceMonth(s);assert.equal(s.firms[1].ownership.state,control.firms[1].ownership.state);assert.equal(s.journal[0].submittedActions.length,1);assert.equal(s.journal[0].actions.length,0);
  s=adopt(s,1);assert.ok(s.firms[1].ownership.state<.3);assert.equal(s.journal[1].actions.length,1);assert.deepEqual(replayJournal(s).metrics,s.metrics);
});
test('presidential and parliamentary calendars are independent; defeat ends player office and stops turns',()=>{
  let s=country({presidentTerm:12,parliamentTerm:24,parliamentOffset:24,termLimit:1});s=runMonths(s,24);
  assert.equal(s.month,12);assert.equal(s.politics.executive.inOffice,false);assert.equal(s.politics.elections.filter(x=>x.kind==='president').length,1);assert.equal(s.politics.elections.filter(x=>x.kind==='parliament').length,1);assert.equal(advanceMonth(s).month,12);assert.ok(s.politics.executive.report);
});
test('ordinary parliamentary no confidence can remove cabinet, not a separately elected president',()=>{
  let s=country({form:'parliamentary',confidence:'ordinary'});s.politics.coalition=[];schedulePolitical(s,{kind:'confidence'});s=advanceMonth(s);assert.equal(s.politics.executive.inOffice,false);
  let semi=country({form:'semiPresidential',playerRole:'president',confidence:'ordinary'});semi.politics.coalition=[];schedulePolitical(semi,{kind:'confidence'});semi=advanceMonth(semi);assert.equal(semi.politics.executive.inOffice,true);assert.notEqual(semi.politics.executive.primeMinisterParty,semi.politics.executive.playerParty);
  let pres=country();schedulePolitical(pres,{kind:'confidence'});pres=advanceMonth(pres);assert.equal(pres.politics.executive.inOffice,true);assert.ok(pres.politics.commandHistory.at(-1).status==='rejected');
});
test('party split and merger retain lineage and deputies without manufacturing seats',()=>{
  let s=country(),id=s.politics.executive.playerParty,total=s.politics.totalSeats;
  schedulePolitical(s,{kind:'partySplit',partyId:id});s=advanceMonth(s);const created=s.politics.parties.at(-1);assert.deepEqual(created.parentIds,[id]);assert.equal(sum(s.politics.parties.map(x=>x.seats)),total);
  schedulePolitical(s,{kind:'partyMerge',partyIds:[id,created.id]});s=advanceMonth(s);assert.equal(sum(s.politics.parties.map(x=>x.seats)),total);assert.equal(s.politics.parties.at(-1).parentIds.length,2);validatePoliticalSystem(s);
});
test('annual budget expiry follows continuity rule and political procurement reconciles in GDP',()=>{
  const s=country(),next=runMonths(s,12);assert.equal(next.politics.provisionalBudget,true);assert.ok(next.politics.bills.some(x=>x.renewBudget));assert.ok(next.lastReport.fiscal.politicalSecurity>0);assert.ok(next.lastReport.fiscal.politicalElections>0);assert.ok(next.metrics.auditError<1e-4);
  const stop=runMonths(country({budgetContinuity:false}),12);assert.equal(stop.policy.governmentConsumption,0);assert.equal(stop.policy.transfers,0);assert.ok(stop.politics.lawPolicy.governmentConsumption>0);
});
test('political commands, programs and legislation round-trip and replay full outcomes',()=>{
  let s=country({form:'parliamentary'});schedulePolitical(s,{kind:'promise',key:'incomeTax',value:15,months:3});schedulePolitical(s,{kind:'parameters',values:{economicWeight:1.3}});s=advanceMonth(s,{...s.policy,incomeTax:15});s=adopt(s,1);s=advanceMonth(s);
  const loaded=importSimulation(exportSimulation(s)),replayed=replayJournal(loaded);assert.deepEqual(replayed.metrics,s.metrics);assert.deepEqual(replayed.politics.parties,s.politics.parties);assert.deepEqual(replayed.politics.rollCalls,s.politics.rollCalls);assert.deepEqual(replayed.politics.commandHistory,s.politics.commandHistory);
  const corrupt=copy(loaded);corrupt.politics.parties[0].seats++;assert.throws(()=>importSimulation(exportSimulation(corrupt)),/партии|парламент/);
});
test('restrictions do not automatically improve production and official approval is separate',()=>{
  const s=country({regime:'party',termLimit:0}),next=runMonths(s,6);assert.ok(next.politics.officialApproval>next.politics.hiddenApproval);assert.ok(next.metrics.auditError<1e-4);assert.ok(next.politics.elites.security>=0&&next.politics.elites.security<=1);
  assert.equal(next.policy.competitiveElections,false);assert.equal(next.politics.enabled,true);
});
test('political A/B attempts new laws through parliament and has no impact on the live game',()=>{
  const s=country(),before=JSON.stringify(s),same=comparePolicies(s,s.policy,s.policy,6);assert.deepEqual(same.a.metrics,same.b.metrics);
  const result=comparePolicies(s,s.policy,{...s.policy,incomeTax:15},6);assert.equal(result.a.policy.incomeTax,18);assert.equal(result.b.policy.incomeTax,15);assert.equal(result.b.politics.bills[0].status,'enacted');assert.equal(result.politicalProtocol,'attemptOwnLaws');assert.equal(JSON.stringify(s),before);
});
test('referendum participation and yes/no counts conserve integer voters',()=>{
  const s=country({constitutionalReferendum:true}),b=createBill(s,{}, {constitutionPatch:{independentCB:false}});b.status='referendum';referendum(s,b.id);const r=b.referendum;assert.equal(r.yesVotes+r.noVotes,r.voters);assert.ok(r.voters<r.eligible);assert.equal(r.passed,r.yesVotes>r.voters/2);
});
test('constitutional rules do not immediately redistribute an elected parliament or postpone current elections',()=>{
  const s=country(),seats=s.politics.parties.map(x=>x.seats),calendar=s.politics.nextParliamentElection;
  const b=createBill(s,{}, {constitutionPatch:{seats:180,parliamentTerm:60}});b.status='passed';const next=advanceMonth(s);assert.equal(next.politics.constitution.seats,180);assert.deepEqual(next.politics.parties.map(x=>x.seats),seats);assert.equal(next.politics.nextParliamentElection,calendar);validatePoliticalSystem(next);
});
test('a ratified emergency authorizes temporary funded appropriations that expire without altering the law',()=>{
  let s=country();const base=s.policy.transfers;s.politics.emergency={start:0,expires:3,ratifyBy:1,ratified:true};s=advanceMonth(s,{...s.policy,transfers:base+1});assert.equal(s.policy.transfers,base+1);assert.equal(s.politics.lawPolicy.transfers,base);assert.ok(s.lastReport.fiscal.transfers>0);
  s=runMonths(s,2);assert.equal(s.policy.transfers,base);assert.equal(s.politics.emergency,null);
});
test('an aging electorate cannot create extra eligible people within any age range',()=>{
  const s=country({}, {parameters:{initialFertility:1.3,initialChildShare:.17,initialElderlyShare:.23}}),t=electorateTotals(s);s.politics.citizenship.residents=t.adults*.3;s.politics.citizenship.naturalized=t.adults*.1;const groups=makeElectorate(s);
  for(let age=0;age<6;age++)assert.ok(sum(groups.filter(g=>g.age===age).map(g=>g.weight))<=t.age[age]+1e-10);assert.ok(Math.abs(sum(groups.filter(g=>g.origin==='naturalized').map(g=>g.weight))-t.adults*.1)<1e-10);
});
test('a registered extreme weather shock can create a regional event even without changing the baseline world slider',()=>{let s=country();scheduleShock(s,{key:'weather',multiplier:.6,duration:2});s=advanceMonth(s);assert.equal(s.world.weather,100);assert.ok(s.politics.publicEvents.some(e=>e.type==='disaster'&&e.region===2));});

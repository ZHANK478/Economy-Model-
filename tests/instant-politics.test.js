import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,executePolitical,advanceMonth,runMonths,replayJournal,exportSimulation,importSimulation,copy,scheduleOwnership} from '../src/engine.js';
import {plannedPolicy,enableInstantPolitics,validatePoliticalSystem} from '../src/political-system.js';
import {generateMonthlyAgenda,MONTHLY_INITIATIVES} from '../src/political-agenda.js';
import {createBill,rollCall,enactBills} from '../src/legislation.js';
const country=(form='presidential',extra={})=>createSimulation({politicalMode:true,seed:11,politicalOptions:{constitution:{form},...extra}});
const proposal=s=>s.politics.bills.find(b=>b.monthlyInitiative&&b.month===s.month&&b.sponsor!==s.politics.executive.playerParty&&b.status==='draft');

test('choosing a law votes and signs in the current turn, then changes only the next economic month',()=>{
  const s=country(),before=copy(s.metrics),b=executePolitical(s,{kind:'policyDecision',patch:{incomeTax:15}});
  assert.equal(s.month,0);assert.deepEqual(s.metrics,before);assert.equal(s.politics.pendingCommands.length,0);
  assert.equal(b.status,'passed');assert.equal(b.finalVote.month,0);assert.equal(b.finalVote.yes+b.finalVote.no+b.finalVote.abstain,120);
  assert.equal(b.articles[0].before,18);assert.equal(b.articles[0].value,15);
  assert.equal(s.policy.incomeTax,18);assert.equal(plannedPolicy(s).incomeTax,15);
  const next=advanceMonth(s);assert.equal(next.policy.incomeTax,15);assert.equal(next.politics.bills.find(x=>x.id===b.id).status,'enacted');
  assert.equal(s.politics.bills.find(x=>x.id===b.id).status,'passed');validatePoliticalSystem(next);
});
test('accepting a party proposal resolves the whole vote immediately and records sponsor loyalty',()=>{
  const s=country('parliamentary'),b=proposal(s),x=s.politics.parties.find(x=>x.id===b.sponsor),before=x.executiveLoyalty;
  executePolitical(s,{kind:'decideBill',billId:b.id,decision:'accept'});
  assert.equal(s.month,0);assert.ok(b.finalVote||b.articles.some(a=>a.vote));assert.ok(['passed','rejected','vetoed'].includes(b.status));
  assert.ok(x.executiveLoyalty>before);assert.equal(b.executiveResponse.month,0);assert.equal(s.politics.pendingCommands.length,0);
});
test('executive refusals reduce loyalty immediately, with a larger parliamentary cabinet cost',()=>{
  const losses={};
  for(const form of ['parliamentary','semiPresidential','presidential']){
    const s=country(form),b=proposal(s),x=s.politics.parties.find(x=>x.id===b.sponsor),before=x.executiveLoyalty;
    executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
    losses[form]=before-x.executiveLoyalty;assert.ok(losses[form]>0);assert.ok(['declined','vetoed','rejected'].includes(b.status));assert.equal(s.month,0);
    const repeated=copy(s.politics);executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
    assert.equal(x.executiveLoyalty,repeated.parties.find(y=>y.id===x.id).executiveLoyalty);
  }
  assert.ok(losses.parliamentary>losses.semiPresidential&&losses.semiPresidential>losses.presidential);
});
test('initiative refusal can cause a coalition exit and lower support for later roll calls',()=>{
  const s=country('parliamentary'),b=proposal(s),x=s.politics.parties.find(x=>x.id===b.sponsor);
  assert.ok(s.politics.coalition.includes(x.id));x.coalitionGrievance=.95;const seats=s.politics.parliamentSupport;
  executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
  assert.ok(!s.politics.coalition.includes(x.id));assert.equal(x.cabinetPosts,0);assert.ok(s.politics.parliamentSupport<seats);
  const high=country(),low=copy(high);for(const x of high.politics.parties)x.executiveLoyalty=1;for(const x of low.politics.parties)x.executiveLoyalty=0;
  const hb=createBill(high,{incomeTax:16}),lb=createBill(low,{incomeTax:16});
  assert.ok(rollCall(high,hb).yes>rollCall(low,lb).yes);
});
test('monthly agenda is bounded, idempotent and allocated proportionally to actual seats over time',()=>{
  const s=country(),counts={};const seats=s.politics.parties.map(x=>({id:x.id,seats:x.seats}));
  for(let month=0;month<120;month++){
    s.month=month;generateMonthlyAgenda(s);const bills=s.politics.bills.filter(b=>b.month===month&&b.monthlyInitiative);
    assert.equal(bills.length,MONTHLY_INITIATIVES);const length=s.politics.bills.length;generateMonthlyAgenda(s);assert.equal(s.politics.bills.length,length);
    for(const b of bills){counts[b.sponsor]=(counts[b.sponsor]??0)+1;b.status='expired';assert.ok(b.articles.every(a=>a.before!==a.value));}
  }
  for(const x of seats)assert.ok(Math.abs((counts[x.id]??0)-120*MONTHLY_INITIATIVES*x.seats/s.politics.totalSeats)<=2,x.id);
});
test('unanswered proposals expire rather than accumulate, and carry a smaller relationship cost',()=>{
  const s=country(),b=proposal(s),x=s.politics.parties.find(x=>x.id===b.sponsor),before=x.executiveLoyalty,next=advanceMonth(s);
  const old=next.politics.bills.find(x=>x.id===b.id);assert.equal(old.status,'expired');assert.equal(old.partyReaction.decision,'ignored');
  assert.ok(next.politics.parties.find(y=>y.id===x.id).executiveLoyalty<before);
  assert.equal(next.politics.bills.filter(b=>b.monthlyInitiative&&b.status==='draft').length,3);
});
test('a failed immediate decision rolls back all political and operation mutations',()=>{
  const s=country(),before=copy(s);
  assert.throws(()=>executePolitical(s,{kind:'policyDecision',patch:{rate:20,incomeTax:15}}),/независимый/);
  assert.deepEqual(s,before);
});
test('unchanged choices and repeated accept clicks do not reroll a rejected bill',()=>{
  const s=country(),b=executePolitical(s,{kind:'policyDecision',patch:{incomeTax:15}}),calls=s.politics.rollCalls.length;
  executePolitical(s,{kind:'decideBill',billId:b.id,decision:'accept'});assert.equal(s.politics.rollCalls.length,calls);
  executePolitical(s,{kind:'policyDecision',patch:{incomeTax:15}});assert.equal(s.politics.rollCalls.length,calls);
});
test('unfinished current-turn votes survive export and exact political journal replay',()=>{
  let s=country();executePolitical(s,{kind:'policyDecision',patch:{incomeTax:15}});executePolitical(s,{kind:'decideBill',billId:proposal(s).id,decision:'reject'});
  let restored=importSimulation(exportSimulation(s));let replay=replayJournal(restored);
  assert.deepEqual(replay.politics,restored.politics);assert.deepEqual(replay.metrics,restored.metrics);
  s=advanceMonth(s);executePolitical(s,{kind:'decideBill',billId:proposal(s).id,decision:'accept'});restored=importSimulation(exportSimulation(s));replay=replayJournal(restored);
  assert.deepEqual(replay.metrics,restored.metrics);assert.deepEqual(replay.politics,restored.politics);
  const next=advanceMonth(restored),again=replayJournal(next);assert.deepEqual(next.metrics,again.metrics);assert.deepEqual(next.politics,again.politics);
});
test('old 5.0 saves switch interaction rules without resetting their economy or historical replay',()=>{
  let s=country('presidential',{instantRules:false});s=runMonths(s,7);const before=copy(s.metrics);
  delete s.politics.instantRules;delete s.politics.initialOptions.instantRules;delete s.provenance.politicalOptions.instantRules;
  const loaded=importSimulation(exportSimulation(s));enableInstantPolitics(loaded);assert.equal(loaded.month,7);assert.deepEqual(loaded.metrics,before);
  assert.equal(loaded.politics.bills.filter(b=>b.monthlyInitiative&&b.month===7).length,3);
  executePolitical(loaded,{kind:'policyDecision',patch:{incomeTax:16}});const next=advanceMonth(loaded),replay=replayJournal(next);
  assert.deepEqual(next.metrics,replay.metrics);assert.deepEqual(next.politics,replay.politics);
});
test('current-turn ownership vote executes a funded operation only once and replays its action ids',()=>{
  const s=country();scheduleOwnership(s,{kind:'privatize',sector:1,points:5,compensation:1});const a=copy(s.pendingActions.at(-1));
  const b=executePolitical(s,{kind:'chooseLaw',patch:{},actions:[a]});assert.equal(s.pendingActions.length,0);assert.equal(s.month,0);
  const next=advanceMonth(s),replay=replayJournal(next);assert.deepEqual(next.metrics,replay.metrics);assert.deepEqual(next.firms,replay.firms);
  assert.ok(next.journal[0].actions.filter(x=>x.id===a.id).length<=1);assert.equal(next.nextActionId,replay.nextActionId);
  assert.equal(b.actions[0].id,a.id);
});
test('the most recently accepted decision prevails over an older bill id for the same policy',()=>{
  const s=country(),first=createBill(s,{incomeTax:16}),second=createBill(s,{incomeTax:20});
  second.status='passed';second.decisionSequence=1;first.status='passed';first.decisionSequence=2;
  assert.equal(plannedPolicy(s).incomeTax,16);enactBills(s,[]);assert.equal(s.politics.lawPolicy.incomeTax,16);
});
test('an unconstrained executive uses the existing decree power without fabricating a parliament vote',()=>{
  const s=country('presidential',{constitution:{form:'presidential',regime:'party'}}),calls=s.politics.rollCalls.length;
  const b=executePolitical(s,{kind:'policyDecision',patch:{incomeTax:12}});
  assert.equal(b.status,'passed');assert.equal(b.byDecree,true);assert.equal(s.politics.rollCalls.length,calls);assert.equal(plannedPolicy(s).incomeTax,12);
});
test('a party founded in the same month as cabinet removal still has a valid loyalty state',()=>{
  let s=country('parliamentary',{constitution:{form:'parliamentary',confidence:'ordinary',parliamentOffset:84}});
  for(let i=0;i<35;i++){for(const b of s.politics.bills.filter(b=>b.monthlyInitiative&&b.status==='draft'))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'accept'});s=advanceMonth(s);}
  assert.equal(s.month,35);s.politics.coalition=[];s.politics.executive.formationDeadline=null;s.politics.parameters.newPartyDemand=.1;
  for(const x of s.politics.parties)for(const key of Object.keys(x.platform))x.platform[key]=1;
  const before=s.politics.parties.length;s=advanceMonth(s);
  assert.ok(s.politics.parties.length>before);assert.equal(s.politics.executive.inOffice,false);validatePoliticalSystem(s);
});
test('a coalition policy concession votes in the same turn, and supporting an exited partner repairs relations',()=>{
  const s=country('parliamentary'),outside=s.politics.parties.find(x=>x.seats>0&&!s.politics.coalition.includes(x.id)),calls=s.politics.rollCalls.length;
  executePolitical(s,{kind:'coalitionOffer',partyId:outside.id,posts:1,concessions:{incomeTax:16}});
  assert.ok(s.politics.coalition.includes(outside.id));assert.ok(s.politics.rollCalls.length>calls);assert.equal(s.month,0);assert.equal(s.politics.pendingCommands.length,0);
  assert.ok(s.politics.bills.some(b=>b.title.includes('Коалиционное соглашение')&&!['draft','articles'].includes(b.status)));
  s.politics.coalition=s.politics.coalition.filter(id=>id!==outside.id);outside.coalitionGrievance=1.2;
  const b=createBill(s,{healthcare:2.5},{sponsor:outside.id,monthlyInitiative:true}),before=outside.coalitionGrievance;
  executePolitical(s,{kind:'decideBill',billId:b.id,decision:'accept'});assert.ok(outside.coalitionGrievance<before);
});


test('single-initiative games retain seat quotas and exactly replay decisions across government forms',()=>{
  for(const form of ['presidential','parliamentary','semiPresidential']){
    let s=country(form,{agendaSlots:1});
    for(let month=0;month<24&&s.politics.executive.inOffice;month++){
      const proposals=s.politics.bills.filter(b=>b.monthlyInitiative&&b.month===s.month&&b.status==='draft');assert.equal(proposals.length,1);
      executePolitical(s,{kind:'decideBill',billId:proposals[0].id,decision:month%5===0?'reject':'accept'});s=advanceMonth(s);
    }
    const loaded=importSimulation(exportSimulation(s)),replay=replayJournal(loaded);assert.deepEqual(replay.metrics,loaded.metrics);assert.deepEqual(replay.politics,loaded.politics);
  }
  const s=country('presidential',{agendaSlots:1}),counts={};
  for(let month=0;month<120;month++){s.month=month;generateMonthlyAgenda(s);const b=s.politics.bills.find(b=>b.monthlyInitiative&&b.month===month);assert.ok(b);counts[b.sponsor]=(counts[b.sponsor]??0)+1;}
  for(const x of s.politics.parties.filter(x=>x.seats>0))assert.ok(Math.abs((counts[x.id]??0)-120*x.seats/s.politics.totalSeats)<=2,x.id);
});
test('switching an old agenda to one proposal archives surplus without penalizing loyalty and replays',()=>{
  let s=country(),loyalty=s.politics.parties.map(x=>x.executiveLoyalty);assert.equal(s.politics.bills.filter(b=>b.monthlyInitiative).length,3);
  executePolitical(s,{kind:'setAgendaSlots',slots:1});assert.equal(s.politics.bills.filter(b=>b.monthlyInitiative&&b.status==='draft').length,1);assert.deepEqual(s.politics.parties.map(x=>x.executiveLoyalty),loyalty);
  assert.deepEqual(replayJournal(s).politics,s.politics);
  const b=s.politics.bills.find(b=>b.monthlyInitiative&&b.status==='draft');executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});s=advanceMonth(s);assert.equal(s.politics.bills.filter(b=>b.monthlyInitiative&&b.month===1).length,1);assert.deepEqual(replayJournal(s).politics,s.politics);
  assert.throws(()=>executePolitical(s,{kind:'setAgendaSlots',slots:2}));
});

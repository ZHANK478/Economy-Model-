import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,executePolitical,advanceMonth,copy,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {enablePresidentialDecisions} from '../src/political-system.js';
import {newGameOptions} from '../src/start-presets.js';
import {createBill} from '../src/legislation.js';
import {resultNotice,policyNumber} from '../src/presidential-decisions.js';
import {constitutionBoard,stageConstitution,constitutionPatch} from '../src/constitution-ui.js';
const start=()=>{const o=newGameOptions({resource:false});o.politicalOptions.nameSeed=7;return createSimulation(o);};
const presented=(s,patch,sponsor=s.politics.executive.playerParty)=>{const b=createBill(s,patch,{sponsor,monthlyInitiative:true});b.status='awaitingSignature';b.parliamentPresented=true;return b;};
test('parliament votes before presenting an initiative; accepting it never runs another vote',()=>{
 const s=start(),b=s.politics.bills.find(b=>b.status==='awaitingSignature');assert.ok(b?.parliamentPresented);assert.ok(b.finalVote.passed);
 const count=s.politics.rollCalls.length;executePolitical(s,{kind:'decideBill',billId:b.id,decision:'accept'});
 assert.equal(b.status,'passed');assert.equal(s.politics.rollCalls.length,count);assert.equal(b.presidentDecision.decision,'sign');
});
test('veto does not run an ordinary vote or show a rejected-result window',()=>{
 const s=start(),b=presented(s,{incomeTax:40});for(const p of s.politics.parties)p.executiveLoyalty=1;
 const count=s.politics.rollCalls.length;executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 assert.equal(b.status,'vetoed');assert.equal(s.politics.rollCalls.length,count);assert.equal(resultNotice(b),null);assert.equal(b.presidentDecision.decision,'veto');
});
test('dissatisfied deputies try to override, but failed votes stay silent and change no law',()=>{
 const s=start(),b=presented(s,{incomeTax:40});for(const p of s.politics.parties)p.executiveLoyalty=1;s.politics.parties.find(p=>p.id===b.sponsor).executiveLoyalty=.1;
 const count=s.politics.rollCalls.length,old=s.policy.incomeTax;executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 assert.ok(b.overrideAttempt);assert.equal(b.overrideVote.override,true);assert.equal(b.overrideVote.passed,false);assert.equal(b.status,'vetoed');assert.equal(resultNotice(b),null);
 assert.equal(s.politics.rollCalls.length,count+1);const next=advanceMonth(s);assert.equal(next.policy.incomeTax,old);
 const events=s.politics.publicEvents.length;executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});assert.equal(s.politics.rollCalls.length,count+1);assert.equal(s.politics.publicEvents.length,events);
});
test('a successful two-thirds override alone notifies and enacts the law without a signature',()=>{
 const s=start(),b=presented(s,{taxEnforcement:80});for(const p of s.politics.parties)p.executiveLoyalty=0;
 executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 assert.equal(b.overrideVote.required,80);assert.ok(b.overrideVote.yes>=80);assert.equal(b.vetoOverridden,true);assert.equal(resultNotice(b),'override');assert.equal(b.status,'passed');assert.equal(b.presidentDecision.decision,'veto');
 const next=advanceMonth(s);assert.equal(next.policy.taxEnforcement,80);assert.equal(next.politics.bills.find(x=>x.id===b.id).status,'enacted');
});
test('constitution can prohibit overrides or require 75 percent of all seats, and non-democracies cannot override',()=>{
 for(const option of ['forbidden','threshold','autocracy']){
  const s=start(),b=presented(s,{incomeTax:0});for(const p of s.politics.parties)p.executiveLoyalty=0;
  if(option==='forbidden')s.politics.constitution.vetoOverrideAllowed=false;
  if(option==='threshold')s.politics.constitution.overrideFraction=.75;
  if(option==='autocracy')s.politics.constitution.regime='personalist';
  executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
  if(option==='threshold')assert.equal(b.overrideVote.required,90);else{assert.equal(b.overrideVote,undefined);assert.equal(resultNotice(b),null);assert.equal(b.status,'vetoed');}
 }
 const s=start(),ui={section:'powers',patch:{}},before=copy(s);stageConstitution(s,ui,'vetoOverrideAllowed',false);stageConstitution(s,ui,'overrideFraction','0.75');
 assert.deepEqual(constitutionPatch(s,ui),{vetoOverrideAllowed:false,overrideFraction:.75});assert.deepEqual(s,before);
 const html=constitutionBoard(s,ui,{esc:String,n:String,date:String});assert.ok(html.includes('Парламент может преодолеть вето'));assert.ok(!html.includes('Голосов для преодоления вето'));
 stageConstitution(s,ui,'vetoOverrideAllowed',true);assert.ok(constitutionBoard(s,ui,{esc:String,n:String,date:String}).includes('Две трети'));
});
test('override notifications require both a successful vote and an actually adopted law',()=>{
 for(const b of [ {status:'rejected',executiveResponse:{decision:'reject'}}, {status:'vetoed',executiveResponse:{decision:'reject'},vetoOverridden:true,overrideVote:{passed:true,yes:80,required:80}}, {status:'passed',executiveResponse:{decision:'reject'},vetoOverridden:true,overrideVote:{passed:false,yes:79,required:80}}, {status:'expired',executiveResponse:{decision:'ignored'}} ])assert.equal(resultNotice(b),null);
});
test('new decisions and migration of an existing save preserve exact replay',()=>{
 let s=start();const b=s.politics.bills.find(x=>x.status==='awaitingSignature');executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});s=advanceMonth(s);
 const restored=importSimulation(exportSimulation(s));assert.deepEqual(replayJournal(restored).politics,restored.politics);assert.deepEqual(replayJournal(restored).metrics,restored.metrics);
 let old=createSimulation({politicalMode:true,politicalOptions:{electionExperience:1,accountabilityRevision:1}});old=advanceMonth(old);const h=copy(old.history),m=old.metrics.realGDPMonthly;enablePresidentialDecisions(old);
 assert.deepEqual(old.history,h);assert.equal(old.metrics.realGDPMonthly,m);assert.deepEqual(replayJournal(old).politics,old.politics);
});
test('inline policy numbers accept decimal commas, enforce bounds, and reject unfinished input',()=>{
 assert.equal(policyNumber('12,5',0,40,.5),12.5);assert.equal(policyNumber('999',0,40,.5),40);assert.equal(policyNumber('12.74',0,40,.5),12.74);assert.equal(policyNumber('1 000',0,2000,1),1000);
 for(const value of ['', ' ', 'hello','-'])assert.equal(policyNumber(value,0,40,.5),null);
});

test('a repeated rejected policy exposes the existing result without another decision or roll call',async()=>{
 const {findReusableBill}=await import('../src/legislation.js');const {decisionBudget}=await import('../src/political-system.js');const s=start();
 for(const b of s.politics.bills.filter(b=>b.monthlyInitiative&&!b.executiveResponse))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 for(const p of s.politics.parties)p.executiveLoyalty=0;
 const patch={incomeTax:40},b=executePolitical(s,{kind:'policyDecision',patch});assert.equal(b.status,'rejected');const count=s.politics.rollCalls.length,budget=decisionBudget(s),commands=s.politics.turnCommands.length;
 assert.equal(findReusableBill(s,patch)?.id,b.id);assert.equal(resultNotice(b),'ordinary');assert.deepEqual(decisionBudget(s),budget);assert.equal(s.politics.rollCalls.length,count);assert.equal(s.politics.turnCommands.length,commands);
 assert.equal(findReusableBill(s,{incomeTax:39}),undefined);s.month+=6;assert.equal(findReusableBill(s,patch),undefined);
});

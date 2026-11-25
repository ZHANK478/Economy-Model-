import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {executePolitical,validatePoliticalSystem,enableFactionControl,decisionBudget} from '../src/political-system.js';
import {initializeParliamentaryRoster,installCabinet,formPlayerCabinet,coalitionCondition,negotiateCoalition,rotateParliamentaryParties,PARLIAMENTARY_CATALOG} from '../src/parliamentary.js';
import {playerExecutive} from '../src/parliamentary-state.js';
import {createBill,approvedPolicy,rollCall} from '../src/legislation.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
import {parliamentBoard} from '../src/parliamentary-ui.js';
import {startChoices,startFamilies} from '../src/start-ui.js';
const start=(seed=7,family='liberal')=>{const o=newGameOptions({government:'parliamentary',party:family});o.politicalOptions.nameSeed=seed;return createSimulation(o);};
const sum=a=>a.reduce((x,y)=>x+y,0);
const parties=s=>s.politics.parties.filter(x=>x.active);
function controlled(){
 const s=start(),p=s.politics,own=p.parties.find(x=>x.id===p.executive.playerParty),others=p.parties.filter(x=>x.id!==own.id&&['centerLeft','socialDemocrat'].includes(x.family));
 const selected=[own,...others];
 for(const x of p.parties){x.active=selected.includes(x);x.seats=x===own?20:selected.includes(x)?50:0;x.deputies=Array.from({length:x.seats},(_,i)=>({id:`test-${x.id}-${i}`,district:null}));}
 installCabinet(s,others[0].id,others.map(x=>x.id));return {s,p,own,others};
}
test('random parliamentary starts draw 2–10 distinct parties from the full catalog and include the player',()=>{
 const counts=new Set();
 for(let seed=0;seed<25;seed++){
  const s=start(seed,PARLIAMENTARY_CATALOG[seed%PARLIAMENTARY_CATALOG.length].id),active=parties(s);counts.add(active.length);
  assert.ok(active.length>=2&&active.length<=10);assert.equal(new Set(active.map(x=>x.family)).size,active.length);
  assert.ok(active.some(x=>x.id===s.politics.executive.playerParty&&x.seats>0));assert.ok(!active.some(x=>x.independent));
  assert.equal(sum(active.map(x=>x.seats)),s.politics.totalSeats);validatePoliticalSystem(s);
 }
 assert.ok(counts.size>=7);
});
test('the country keeps running under an opposing cabinet and executive instruments are unavailable to the player',()=>{
 let {s,own,others}=controlled();assert.equal(playerExecutive(s),false);
 assert.throws(()=>executePolitical(s,{kind:'policyDecision',patch:{foreignBorrowingShare:75}}),/оппозиции/);
 assert.throws(()=>executePolitical(s,{kind:'dissolve'}),/правительства/);
 assert.throws(()=>executePolitical(s,{kind:'emergency'}),/правительства/);
 const before=s.policy.foreignBorrowingShare;
 s=advanceMonth(s,{...s.policy,foreignBorrowingShare:75});assert.equal(s.policy.foreignBorrowingShare,before);
 for(let i=0;i<10;i++)s=advanceMonth(s);
 assert.equal(s.month,11);assert.equal(s.politics.executive.inOffice,true);assert.equal(s.politics.executive.playerParty,own.id);
 assert.equal(s.politics.executive.primeMinisterParty,others[0].id);assert.ok(s.metrics.auditError<1e-5);
 assert.ok(s.politics.bills.some(b=>b.sponsor!==own.id&&b.status==='enacted'));
});
test('an opposition vote against a bill is not a presidential veto; the majority can enact it',()=>{
 const {s,p,own,others}=controlled();
 const b=createBill(s,{education:s.policy.education+.1},{sponsor:others[0].id,title:'Образование'});
 executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 assert.equal(b.status,'passed');assert.ok(b.finalVote.yes>b.finalVote.no);
 assert.ok(b.finalVote.parties.find(x=>x.id===own.id).no>=17);
 assert.equal(p.executive.inOffice,true);assert.equal(approvedPolicy(s).education,s.policy.education+.1);
 assert.equal(p.publicEvents.at(-1).partyWeights[own.id],-.5);
});
test('negotiations do not grant cabinet power until a real majority is assembled',()=>{
 const {s,p,own,others}=controlled(),before=structuredClone(p.parliamentary.agreements);
 assert.throws(()=>formPlayerCabinet(s),/половины/);
 negotiateCoalition(s,others[0].id,'accept');assert.equal(playerExecutive(s),false);
 assert.deepEqual(p.parliamentary.agreements,before);
 formPlayerCabinet(s);assert.equal(playerExecutive(s),true);assert.equal(p.executive.playerParty,own.id);
 assert.deepEqual(new Set(p.coalition),new Set([own.id,others[0].id]));assert.ok(p.parliamentary.agreements.length===1);
 assert.ok(s.politics.bills.every(b=>!b.byDecree));
});
test('failure to form a cabinet produces an opposing government, rather than ending the game',()=>{
 let s=start(7);for(let i=0;i<4;i++)s=advanceMonth(s);
 assert.equal(s.politics.executive.inOffice,true);assert.equal(s.politics.parliamentary.phase,'government');assert.equal(playerExecutive(s),false);
});
test('coalition breach warns before withdrawal and does not end the party game',()=>{
 let {s,p,own,others}=controlled();
 const condition={key:'education',label:'Образование',before:s.policy.education-1,value:s.policy.education};
 installCabinet(s,own.id,[own.id,others[0].id],[],{agreements:[{partyId:others[0].id,condition,month:0}]});
 s.policy.education-=1;p.lawPolicy.education=s.policy.education;
 for(let i=0;i<3;i++)s=advanceMonth(s);
 assert.ok(s.politics.parliamentary.agreements[0].warningSince!==undefined);assert.ok(s.politics.coalition.includes(others[0].id));
 for(let i=0;i<3;i++)s=advanceMonth(s);
 assert.ok(!s.politics.coalition.includes(others[0].id));assert.equal(s.politics.executive.inOffice,true);
});
test('zero seats at a real election ends the game, while losing the cabinet alone does not',()=>{
 let s=start();const id=s.politics.executive.playerParty;
 s.politics.startingPreferences.parliament[id]=-100;s.politics.nextParliamentElection=1;
 s=advanceMonth(s);assert.equal(s.politics.parties.find(x=>x.id===id).seats,0);
 assert.equal(s.politics.executive.inOffice,false);assert.match(s.politics.executive.reason,/ни одного места/);
 assert.equal(advanceMonth(s).month,s.month);
});
test('parties below the threshold are replaced for the next campaign, with no fabricated seats',()=>{
 let s=start();const p=s.politics,failed=parties(s).find(x=>x.id!==p.executive.playerParty),ids=new Set(p.parties.map(x=>x.id));
 p.startingPreferences.parliament[failed.id]=-100;p.nextParliamentElection=1;
 s=advanceMonth(s);const retired=s.politics.parties.find(x=>x.id===failed.id),newcomers=s.politics.parties.filter(x=>!ids.has(x.id));
 assert.equal(retired.active,false);assert.equal(retired.seats,0);assert.ok(newcomers.length>0);assert.ok(newcomers.every(x=>x.seats===0&&x.deputies.length===0));
 assert.equal(sum(s.politics.parties.map(x=>x.seats)),120);assert.ok(!s.politics.elections.at(-1).results.some(r=>newcomers.some(x=>x.id===r.id)));
 validatePoliticalSystem(s);
});
test('new mode and opposition actions round-trip and replay without changing the player party',()=>{
 let s=start();for(let i=0;i<12;i++){
  for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:i%2?'accept':'reject'});
  s=advanceMonth(s);
 }
 const restored=importSimulation(exportSimulation(s)),replay=replayJournal(restored);
 assert.deepEqual(restored.metrics,s.metrics);assert.deepEqual(replay.metrics,s.metrics);
 assert.deepEqual(replay.politics.parliamentary,s.politics.parliamentary);assert.equal(replay.politics.executive.playerParty,s.politics.executive.playerParty);
});
test('new-game choices and parliamentary board use cards, preserve ideology selection and show campaign entrants',()=>{
 assert.equal(startFamilies('parliamentary').length,13);assert.equal(startFamilies('presidential').length,11);
 const options=startChoices({step:2,government:'parliamentary',country:'middle',party:'authoritarianLeft'});
 assert.ok(options.includes('Авторитарная партия'));assert.ok(!options.includes('Левые авторитаристы'));assert.ok(!options.includes('<table'));
 const s=start(),html=parliamentBoard(s,{n:(v)=>String(v),pct:v=>v+'%',esc:x=>String(x),date:m=>String(m),chart:()=>'<svg></svg>'});
 assert.ok(html.includes('Формирование кабинета'));assert.ok(html.includes('Ваш проект коалиции'));assert.ok(!html.includes('<table'));
});

test('opposition faction obeys every instruction exactly, including abstention and automatic ballots',()=>{
 const {s,p,own,others}=controlled();
 for(const [vote,key] of [['accept','yes'],['reject','no'],['abstain','abstain']]){
  executePolitical(s,{kind:'setFactionVote',vote});
  const b=createBill(s,{education:s.policy.education+.12+(vote==='accept'?.01:vote==='reject'?.02:.03)},{sponsor:others[0].id,title:'Проверка фракции'});
  const result=rollCall(s,b),row=result.parties.find(x=>x.id===own.id);
  assert.equal(row[key],own.seats);assert.equal(row.yes+row.no+row.abstain,own.seats);
  b.playerVote=vote==='accept'?'reject':'accept';const override=rollCall(s,b).parties.find(x=>x.id===own.id);
  assert.equal(override[vote==='accept'?'no':'yes'],own.seats);
 }
});
test('manual abstention resolves an opposition proposal with no accidental yes or no votes',()=>{
 const {s,p,own,others}=controlled();
 const b=createBill(s,{healthcare:s.policy.healthcare+.1},{sponsor:others[0].id});
 executePolitical(s,{kind:'decideBill',billId:b.id,decision:'abstain'});
 const row=b.finalVote.parties.find(x=>x.id===own.id);
 assert.equal(row.abstain,own.seats);assert.equal(row.yes,0);assert.equal(row.no,0);assert.equal(p.publicEvents.at(-1).partyWeights[own.id],0);
});
test('legacy parliamentary games activate exact faction control through a replayable free command',()=>{
 const o=newGameOptions({government:'parliamentary'});delete o.politicalOptions.factionControlRevision;o.politicalOptions.nameSeed=7;
 let s=createSimulation(o);for(let i=0;i<5;i++)s=advanceMonth(s);
 const prior=JSON.stringify(s.journal);enableFactionControl(s);executePolitical(s,{kind:'setFactionVote',vote:'abstain'});
 assert.equal(JSON.stringify(s.journal),prior);assert.equal(decisionBudget(s).used,0);
 s=advanceMonth(s);assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).metrics,s.metrics);
 assert.equal(s.politics.parliamentary.oppositionVote,'abstain');
});

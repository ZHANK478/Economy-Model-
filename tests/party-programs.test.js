import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_POLICY,POLICY_FIELDS,POLICY_CHECKS,POLICY_CHOICES} from '../src/config.js';
import {PRESIDENTIAL_PARTY_FAMILIES,platformObject,CB_KEYS} from '../src/political-config.js';
import {partyPolicyTargets,programAlignment,programCandidates,chooseProgramArticle} from '../src/party-programs.js';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,copy} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {enablePartyPrograms,decisionBudget,executePolitical} from '../src/political-system.js';
import {createBill,validatePolicyPatch,rollCall} from '../src/legislation.js';
import {generateMonthlyAgenda,unresolvedInitiatives} from '../src/political-agenda.js';
const start=(family='liberal',revision=true)=>{const o=newGameOptions({party:family});o.politicalOptions.nameSeed=7;if(!revision)delete o.politicalOptions.partyProgramRevision;return createSimulation(o);};
const archetype=f=>({id:f.id,family:f.id,platform:platformObject(f.platform),independent:false});
test('all eleven party programs cover every decision instrument with valid values',()=>{
 const s=start();
 for(const f of PRESIDENTIAL_PARTY_FAMILIES){const party=archetype(f),t=partyPolicyTargets(s,party);
  assert.deepEqual(Object.keys(t).sort(),Object.keys(BASE_POLICY).sort());validatePolicyPatch(t);
  for(const [key,target] of Object.entries(t)){
   const field=POLICY_FIELDS.find(f=>f[0]===key);const alt=field?(target===field[2]?field[3]:field[2]):typeof target==='boolean'?!target:POLICY_CHOICES.find(f=>f[0]===key)[3].find(x=>x[0]!==target)[0];
   assert.ok(programAlignment(s,party,{patch:{[key]:target},articles:[{key,before:alt}]})>0,`${f.id}/${key}`);
  }
 }
});
test('defense preferences differ by family and respond to actual threats, not a left-right spending switch',()=>{
 const s=start(),get=id=>partyPolicyTargets(s,archetype(PRESIDENTIAL_PARTY_FAMILIES.find(f=>f.id===id)));
 assert.ok(get('national').militaryBudget>get('green').militaryBudget);
 assert.ok(get('authoritarianLeft').militaryBudget>get('socialist').militaryBudget);
 const old=get('green').militaryBudget;s.defense.war={};assert.ok(get('green').militaryBudget>old);assert.equal(get('green').defensePosture,'mobilization');
});
test('proposals include all decision sections, booleans, regimes and paid ownership actions, respecting central bank authority',()=>{
 const s=start('socialist'),party=s.politics.parties.find(x=>x.id===s.politics.executive.playerParty);
 s.policy.militaryBudget=0;
 const articles=programCandidates(s,party,s.policy),topics=new Set(articles.map(a=>a.topic));
 for(const topic of ['Армия','Кредит','Налоги','Бюджет','Инфраструктура','Труд','Структура','Услуги','Институты','Собственность'])assert.ok(topics.has(topic),topic);
 assert.ok(!articles.some(a=>CB_KEYS.includes(a.key)));assert.ok(articles.some(a=>typeof a.value==='boolean'));
 assert.ok(articles.some(a=>a.actions?.[0].kind==='purchase'));
 const chosen=new Set();
 for(let i=0;i<topics.size;i++){const a=chooseProgramArticle(s,party,articles);chosen.add(a.topic);s.politics.bills.push({monthlyInitiative:true,sponsor:party.id,month:i,programTopic:a.topic,programKey:a.key});s.month++;}
 assert.equal(chosen.size,topics.size,'rotate through topics before repeating');
 s.politics.constitution.independentCB=false;assert.ok(programCandidates(s,party,s.policy).some(a=>a.key==='rate'));
});
test('party votes and amendments assess non-social instruments using the same program',()=>{
 const s=start('national'),p=s.politics,own=p.parties.find(x=>x.id===p.executive.playerParty);
 const green=archetype(PRESIDENTIAL_PARTY_FAMILIES.find(f=>f.id==='green'));
 const low=partyPolicyTargets(s,green).militaryBudget,high=partyPolicyTargets(s,own).militaryBudget;
 const b=createBill(s,{militaryBudget:high});b.articles[0].before=low;
 assert.ok(programAlignment(s,own,b)>0);assert.ok(programAlignment(s,green,b)<0);
 const vote=rollCall(s,b);assert.ok(vote.parties.find(x=>x.id===own.id).yes>own.seats/2);
 const opposed=p.parties.find(x=>x.active&&!x.independent&&x.id!==own.id);
 const proposal=createBill(s,{normalWorkweek:60});assert.ok(proposal.amendments.some(a=>a.partyId===opposed.id));
 const t=partyPolicyTargets(s,own);for(const key of ['capitalControls','privateHealthEntry','energyPricing','workerRepresentation']){
  const target=t[key],before=typeof target==='boolean'?!target:typeof target==='number'?(target?0:100):target==='market'?'regulated':'market';
  assert.ok(programAlignment(s,own,{patch:{[key]:target},articles:[{key,before}]})>0);
 }
});
test('expanded agenda enacts through existing procedures and survives import and replay',()=>{
 let s=start('socialist');
 for(let i=0;i<16;i++){
  for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:i%2?'accept':'reject',deferReferendum:true});
  s=advanceMonth(s,s.policy);
 }
 const restored=importSimulation(exportSimulation(s));assert.deepEqual(replayJournal(restored).metrics,s.metrics);
 assert.ok(s.politics.bills.some(b=>b.programTopic==='Собственность'));
});
test('migration is free, preserves history and pending proposals, and replays the boundary',()=>{
 let s=start('liberal',false);s=advanceMonth(s);const before=copy(s),budget=decisionBudget(s).used;
 enablePartyPrograms(s);assert.equal(s.politics.partyProgramRevision,1);assert.equal(decisionBudget(s).used,budget);
 assert.deepEqual(s.history,before.history);assert.deepEqual(s.journal,before.journal);assert.deepEqual(s.politics.bills,before.politics.bills);
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).politics,s.politics);
 s=advanceMonth(s);assert.deepEqual(replayJournal(s).metrics,s.metrics);
});

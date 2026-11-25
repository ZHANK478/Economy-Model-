import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation,copy} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {executePolitical,decisionBudget} from '../src/political-system.js';
import {regimeActive,regimeCouncil,reviewRegimeBill,advanceRegimeDynamics,regimeAction,regimeInvestmentPremium,regimeContractFactor,regimeEntryFactor,regimeWorkFactor,regimeMediaAdvantage,validateRegimeDynamics,REGIME_POLICY_KEYS} from '../src/regime-dynamics.js';
import {macroInvestment} from '../src/macro-core.js';
import {advanceInstitutionOutcomes} from '../src/institutions.js';
import {regimePanel} from '../src/regime-ui.js';
import {amendBill} from '../src/legislation.js';
import {decideBill} from '../src/political-agenda.js';
function start(government='personalist',extra={}){const o=newGameOptions({government});o.politicalOptions.nameSeed=42;o.politicalOptions.livingWorld=false;return createSimulation({...o,defenseMode:false,...extra});}
const tick=(s,flow={politicalSecurity:20})=>{const prev=copy(s);s.month++;return advanceRegimeDynamics(s,prev,[],flow);};

test('three autocracies start with different power sharing; economic starting accounts stay equal',()=>{
 const a=start(),b=start('party'),c=start('military');
 assert.ok(regimeCouncil(a).power<.15);assert.equal(regimeCouncil(b).kind,'party');assert.equal(regimeCouncil(c).kind,'officers');
 assert.deepEqual(a.firms,b.firms);assert.deepEqual(a.households,b.households);
 assert.equal(a.metrics.realGDPMonthly,c.metrics.realGDPMonthly);
 assert.ok(a.politics.regimeDynamics.personalControl>b.politics.regimeDynamics.personalControl);
});

test('changing only a regime label cannot alter economic mechanisms or investment plans',()=>{
 const a=advanceMonth(start()),b=copy(a);b.politics.constitution.regime='party';
 for(const fn of [regimeInvestmentPremium,regimeContractFactor,regimeEntryFactor,regimeWorkFactor])assert.equal(fn(a),fn(b));
 const va=a.firms.map(()=>1);
 assert.deepEqual(macroInvestment(a,a,1,.06,va),macroInvestment(b,b,1,.06,va));
 advanceInstitutionOutcomes(a);advanceInstitutionOutcomes(b);assert.deepEqual(a.institutions,b.institutions);
});

test('party and officer councils veto material loss of their own resources, personalist can decree',()=>{
 const party=start('party'),military=start('military'),personal=start();
 const bill=(id,patch)=>({id,title:'Пакет',patch});
 assert.equal(reviewRegimeBill(party,bill(1,{patronageBudget:0})),false);
 assert.equal(reviewRegimeBill(military,bill(1,{militaryBudget:0,securityBudget:0})),false);
 assert.equal(reviewRegimeBill(personal,bill(1,{patronageBudget:0,militaryBudget:0,securityBudget:0})),true);
 assert.equal(reviewRegimeBill(party,bill(2,{fuelPricing:'regulated',fuelTariff:80})),true);
});

test('council refusal is visible immediately and rejected resources do not change after a month',()=>{
 let s=start('party');const before=s.policy.patronageBudget;
 executePolitical(s,{kind:'chooseLaw',patch:{patronageBudget:0},title:'Отмена патронажа'});
 const b=s.politics.bills.at(-1);assert.equal(b.status,'rejected');assert.equal(b.regimeReview.accepted,false);
 s=advanceMonth(s);assert.equal(s.policy.patronageBudget,before);
 assert.deepEqual(replayJournal(s).metrics,s.metrics);
});

test('real security funding, rather than merely executing a tiny requested budget, determines capacity',()=>{
 const a=start('military'),b=copy(a);a.policy.securityBudget=.001;b.policy.securityBudget=1;
 tick(a,{politicalSecurity:.001});tick(b,{politicalSecurity:100});
 assert.ok(a.politics.regimeDynamics.securityCapacity<b.politics.regimeDynamics.securityCapacity);
 assert.ok(a.politics.regimeDynamics.last.securityTarget<b.politics.regimeDynamics.last.securityTarget);
});

test('a softened package receives a new council assessment after amendment',()=>{
 const s=start('party'),before=s.policy.patronageBudget;
 executePolitical(s,{kind:'chooseLaw',patch:{patronageBudget:0},title:'Патронаж'});
 const b=s.politics.bills.at(-1);assert.equal(b.status,'rejected');
 amendBill(s,b.id,b.articles[0].id,before*.9);assert.equal(b.regimeReview,undefined);
 decideBill(s,b.id,'accept');assert.equal(b.status,'passed');assert.equal(b.regimeReview.accepted,true);
});

test('succession agreement takes a decision and time; it cannot instantly fill readiness or be farmed',()=>{
 let s=start();const initial=s.politics.regimeDynamics.successionReadiness;
 executePolitical(s,{kind:'regimeAction',action:'successorAgreement'});
 assert.equal(s.politics.regimeDynamics.successionReadiness,initial);assert.equal(decisionBudget(s).used,1);
 const saved=JSON.stringify(s);assert.throws(()=>executePolitical(s,{kind:'regimeAction',action:'successorAgreement'}));assert.equal(JSON.stringify(s),saved);
 for(let i=0;i<18;i++)s=advanceMonth(s);
 assert.ok(s.politics.regimeDynamics.successionReadiness>initial);
 executePolitical(s,{kind:'regimeAction',action:'handover'});
 assert.equal(s.politics.regimeDynamics.leader.generation,1);assert.equal(s.politics.executive.inOffice,true);
 assert.equal(s.politics.regimeDynamics.regimeEnded,false);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.politics.regimeDynamics,s.politics.regimeDynamics);
 assert.deepEqual(replayJournal(s).politics.regimeDynamics,s.politics.regimeDynamics);
 s=advanceMonth(s);assert.deepEqual(replayJournal(s).metrics,s.metrics);
});

test('natural death, smooth succession and contested succession are separate from regime breakdown',()=>{
 let smooth=0,contested=0;
 for(let seed=1;seed<=40;seed++){
  const s=start('party',{seed});const r=s.politics.regimeDynamics;r.leader.ageMonths=110*12;r.assumptions.mortalityAt55=1;
  r.successionReadiness=.9;r.eliteCohesion=.85;
  for(let month=0;month<60&&r.leader.generation===0;month++)tick(s);
  if(r.leader.history.length){if(r.leader.history[0].disputed)contested++;else smooth++;assert.equal(r.regimeEnded,false);assert.equal(s.politics.executive.inOffice,true);}
 }
 assert.ok(smooth>0);assert.ok(contested>0);
});

test('civilian pact requires an autonomous council and can stall, complete, or break',()=>{
 assert.throws(()=>regimeAction(start(),'civilianTransition'));
 assert.throws(()=>regimeAction(start('party'),'civilianTransition'));
 const a=start('military'),b=start('military');regimeAction(a,'civilianTransition');regimeAction(b,'civilianTransition');
 for(let i=0;i<65&&a.politics.regimeDynamics.transition.status!=='completed';i++)tick(a,{politicalSecurity:100});
 assert.equal(a.politics.regimeDynamics.transition.status,'completed');assert.equal(a.policy.competitiveElections,true);
 assert.equal(a.politics.constitution.regime,'hybrid');assert.equal(a.politics.nextPresidentElection,a.month+3);
 b.politics.elites.security=.05;b.politics.regimeDynamics.eliteCohesion=.05;tick(b);
 assert.equal(b.politics.regimeDynamics.transition.status,'stalled');
 regimeAction(b,'cancelTransition');assert.ok(b.politics.regimeDynamics.electoralDispute>0);assert.throws(()=>regimeAction(b,'civilianTransition'));
});

test('low approval alone is not an automatic revolt; prolonged economic and legal grievances can mobilize',()=>{
 const s=start();s.politics.hiddenApproval=.05;s.politics.poll.groups=[];
 s.metrics.inflationYoY=100;s.metrics.unemployment=30;s.metrics.realIncomeIndex=40;
 s.policy.associationFreedom=true;s.politics.civilFreedom=.75;s.politics.mediaFreedom=.65;
 assert.equal(s.politics.regimeDynamics.nationalMobilization,0);
 for(let i=0;i<48;i++)tick(s);
 const r=s.politics.regimeDynamics;assert.ok(r.last.localMobilization>.15);assert.ok(r.nationalMobilization>.1);assert.ok(r.lostWorkFraction>0);
 assert.equal(s.politics.executive.inOffice,true);assert.ok(r.last.protestRisk>0);
});

test('complaints and independent information improve state feedback without fabricated GDP or transfers',()=>{
 const a=start(),b=copy(a);a.policy.censorshipScope='blanket';b.policy.censorshipScope='complaints';
 const cashA=a.government.cash,cashB=b.government.cash;
 for(let i=0;i<60;i++){tick(a);tick(b);}
 assert.ok(b.politics.regimeDynamics.informationQuality>a.politics.regimeDynamics.informationQuality);
 assert.equal(a.government.cash,cashA);assert.equal(b.government.cash,cashB);
});

test('hybrid elections retain meaningful competition while unequal media access alters utilities',()=>{
 const s=start('hybrid'),own=s.politics.executive.playerParty;
 assert.equal(s.policy.competitiveElections,true);assert.ok(regimeMediaAdvantage(s,own)>0);
 assert.equal(regimeMediaAdvantage(s,s.politics.parties.find(p=>p.id!==own).id),0);
 s.politics.mediaFreedom=1;assert.equal(regimeMediaAdvantage(s,own),0);
});

test('all new live state, assumptions and current-turn commands survive exact replay and reload',()=>{
 for(const type of ['personalist','party','military','hybrid']){
  let s=start(type);for(let i=0;i<12;i++)s=advanceMonth(s);
  const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded),advanceMonth(s));
  const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.politics.regimeDynamics,s.politics.regimeDynamics);
  assert.ok(s.journal.at(-1).regimeState);assert.ok(s.lastReport.politicalInstitutions);
 }
});

test('legacy migration starts at the next month and does not rewrite old journal entries',()=>{
 const o=newGameOptions({government:'personalist'});delete o.politicalOptions.regimeRevision;o.politicalOptions.nameSeed=42;o.politicalOptions.livingWorld=false;
 for(const k of REGIME_POLICY_KEYS)delete o.policy[k];
 let s=createSimulation({...o,defenseMode:false});
 // Produce an old rules month with the historical replay flag.
 s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});
 assert.equal(regimeActive(s),false);const old=JSON.stringify(s.journal[0]);
 for(const k of REGIME_POLICY_KEYS){delete s.policy[k];delete s.politics.lawPolicy[k];}
 s=advanceMonth(s);assert.equal(regimeActive(s),true);assert.equal(s.politics.regimeDynamics.startedMonth,1);
 assert.equal(JSON.stringify(s.journal[0]),old);assert.equal(s.journal[1].regimeActivation.month,1);
 const replay=replayJournal(s);assert.deepEqual(replay.politics.regimeDynamics,s.politics.regimeDynamics);assert.deepEqual(replay.metrics,s.metrics);
});

test('corrupt model state and malformed probabilities are rejected; summary stays collapsed normally',()=>{
 const s=start();const fmt={n:x=>String(x),pct:x=>String(x)+'%',row:(k,v)=>`<p>${k}: ${v}</p>`,esc:String};
 const html=regimePanel(s,fmt);assert.ok(html.includes('Согласовать преемника'));assert.ok(!html.startsWith('<details class="panel method-details regime-panel" open'));
 for(const mutate of [r=>r.capture=NaN,r=>r.securityCapacity=2,r=>r.assumptions.capacityMonths=0,r=>r.cadres[0].id=3]){const broken=copy(s);mutate(broken.politics.regimeDynamics);assert.throws(()=>validateRegimeDynamics(broken));}
});

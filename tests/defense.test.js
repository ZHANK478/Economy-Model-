import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,copy} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {enableDefense,executePolitical,decisionBudget} from '../src/political-system.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
import {defenseResponse,validateDefense,pendingDefenseNotice,acknowledgeDefenseNotice,defenseGovernmentMix} from '../src/defense.js';
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const country=(type='middle')=>{const o=newGameOptions({country:type});o.politicalMode=false;return createSimulation(o);};
const month=s=>{for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});return advanceMonth(s,s.policy);};
function audited(s){validateDefense(s);for(const [key,value] of Object.entries(s.lastReport.audit))assert.ok(Number.isFinite(value)&&Math.abs(value)<.001,`${s.month} ${key}: ${value}`);}
test('opening defense is inside existing public purchases; personnel is not counted twice',()=>{
 const s=country(),o=newGameOptions();o.defenseMode=false;const comparison=createSimulation(o);
 assert.ok(s.defense.active>0);assert.ok(s.defense.readiness>0&&s.defense.readiness<1);
 near(s.metrics.employment,s.firms.reduce((n,f)=>n+f.workers,0));
 const mix=defenseGovernmentMix(s);for(let i=0;i<5;i++)near(mix.weights[i],s.base.governmentWeights[i]);
 near(mix.imports,s.base.governmentImport);near(s.metrics.realGDPMonthly,comparison.metrics.realGDPMonthly);
});
test('funded procurement and training have delays and military components exhaust the funded envelope',()=>{
 let s=country();s.policy.militaryBudget=4;const before=copy(s.defense);
 s=month(s);audited(s);assert.ok(s.defense.deliveries.length>0);
 assert.ok(s.defense.deliveries.every(o=>o.due>=s.month+9));
 assert.ok(s.defense.training.every(o=>o.due>=s.month+6));
 assert.ok(s.defense.equipment<=before.equipment);
 near(s.defense.personnelCost+s.defense.operationsCost+s.defense.trainingCost+s.defense.procurementCost+s.defense.diplomacyCost,s.lastReport.fiscal.militaryPurchases);
 const old=s.defense.equipment;for(let i=0;i<10;i++){s=month(s);audited(s);}assert.ok(s.defense.equipment>old);
 assert.deepEqual(replayJournal(s).metrics,s.metrics);
});
test('zero funding erodes service availability but does not manufacture a hostile neighbor or instant war',()=>{
 let s=country();s.policy.militaryBudget=0;const active=s.defense.active;
 for(let i=0;i<24;i++){s=month(s);audited(s);assert.equal(s.defense.war,null);assert.equal(s.defense.crisis,null);}
 assert.ok(s.defense.active<active*.1);assert.equal(s.defense.readiness,0);
 assert.ok(!s.defense.sovereigntyLost);assert.equal(s.defense.deliveries.length,0);
});
test('casualties and refugees enter cohorts once and demographic identities remain exact',()=>{
 let s=country();s.defense.pendingDeaths=.001;s.defense.pendingRefugees=.002;const old=s.population;
 s=month(s);audited(s);near(s.demography.warDeaths,.001);near(s.demography.warRefugees,.002);
 near(s.population,old+s.demography.births-s.demography.deaths+s.demography.netMigration,1e-8);
 s=month(s);near(s.demography.warDeaths,0);near(s.demography.warRefugees,0);
});
test('a sustained invasion can end sovereignty; damage affects the next month and cannot be skipped by reload',()=>{
 let s=country();s.policy.militaryBudget=0;s.defense.occupation=.83;
 s.defense.war={id:'test-war',neighbor:'n0',started:0,months:0,intent:.95,enemyRemaining:1,negotiation:null};
 s.defense.neighbors[0].active*=10;s.defense.neighbors[0].equipment*=10;
 s=month(s);audited(s);assert.ok(s.defense.pendingDeaths>0);assert.ok(s.defense.pendingCapitalLoss>0);
 const restored=importSimulation(exportSimulation(s));s=month(restored);audited(s);
 assert.ok(s.defense.last.capitalDamageApplied>0);
 for(let i=0;i<5&&!s.defense.sovereigntyLost;i++){s=month(s);audited(s);}
 assert.equal(s.defense.sovereigntyLost,true);assert.equal(advanceMonth(s).month,s.month);
});
test('negotiations cannot be rerolled; alliances take sustained funded contributions',()=>{
 let s=country();defenseResponse(s,'alliance');
 for(let i=0;i<8;i++){s=month(s);assert.equal(s.defense.alliance.active,false);audited(s);}
 s=month(s);assert.equal(s.defense.alliance.active,true);assert.ok(s.defense.diplomacyCost>0);
 s.defense.crisis={id:'test-crisis',neighbor:'n0',started:s.month,deadline:s.month+6,intent:.8,negotiation:null};
 defenseResponse(s,'negotiate');assert.throws(()=>defenseResponse(s,'negotiate'));
 const paid=s.defense.alliance.paid;s=month(s);assert.ok(s.defense.alliance.paid>paid);audited(s);
 near(s.defense.personnelCost+s.defense.operationsCost+s.defense.trainingCost+s.defense.procurementCost+s.defense.diplomacyCost,s.lastReport.fiscal.militaryPurchases);
});
test('legacy activation is recorded, free, repeat-safe and replays without changing prior economics',()=>{
 const o=newGameOptions();o.defenseMode=false;let s=createSimulation(o);s=month(s);s=month(s);
 const old=copy(s.history.filter(h=>h.month<s.month)),used=decisionBudget(s).used;
 enableDefense(s);enableDefense(s);assert.equal(decisionBudget(s).used,used);
 assert.equal(s.politics.turnCommands.filter(c=>c.kind==='activateDefense').length,1);
 assert.deepEqual(s.history.filter(h=>h.month<s.month),old);
 s=month(s);audited(s);assert.deepEqual(replayJournal(s).metrics,s.metrics);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.defense,s.defense);
});
test('military decisions consume the same three-attempt budget and failed commands roll back',()=>{
 const s=createSimulation(newGameOptions());for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 const before=decisionBudget(s).used;executePolitical(s,{kind:'defenseResponse',action:'alliance'});assert.equal(decisionBudget(s).used,before+1);
 const unchanged=copy(s.defense);assert.throws(()=>executePolitical(s,{kind:'defenseResponse',action:'alliance'}));assert.deepEqual(s.defense,unchanged);
});
test('notices are persistent, independently acknowledged and not erased with the main screen',()=>{
 let s=country();s.defense.war={id:'test',neighbor:'n0',started:0,months:18,intent:.7,enemyRemaining:.39,negotiation:null};
 s=month(s);const n=pendingDefenseNotice(s);assert.ok(n);acknowledgeDefenseNotice(s,n.id);assert.equal(pendingDefenseNotice(importSimulation(exportSimulation(s))),null);
});
for(const type of ['poor','middle','rich'])test(`${type}: 30-year budget strategies reconcile, including termination after prolonged unpaid defense`,()=>{
 const start=country(type);let funded=copy(start),unfunded=copy(start);funded.policy.militaryBudget=4;unfunded.policy.militaryBudget=0;
 for(let i=0;i<360;i++){
  if(!funded.defense.sovereigntyLost){funded=month(funded);audited(funded);}
  if(!unfunded.defense.sovereigntyLost){unfunded=month(unfunded);audited(unfunded);}
 }
 assert.ok(funded.month>=unfunded.month);
 if(funded.month<360){assert.equal(funded.defense.sovereigntyLost,true);assert.ok(funded.defense.occupation>=funded.defense.assumptions.occupationDefeatThreshold);assert.ok(funded.defense.defeatMonths>=funded.defense.assumptions.occupationDefeatMonths);}else assert.equal(funded.defense.sovereigntyLost,false);
 assert.equal(unfunded.defense.sovereigntyLost,true);
 assert.ok(funded.defense.history.every(h=>Number.isFinite(h.readiness)&&h.readiness>=0&&h.readiness<=1));
 assert.deepEqual(replayJournal(funded).metrics,funded.metrics);
});

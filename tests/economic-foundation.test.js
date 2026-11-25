import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,accountBalances,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {matchEmployment,installTechnology,resolveBanking,reconcileBankBooks,networkFinance,serviceSettlement,populationDistribution,validateFoundation} from '../src/economic-foundation.js';
const sum=a=>a.reduce((x,y)=>x+y,0),near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=(country='middle',extra={})=>createSimulation({...newGameOptions({country}),politicalMode:false,defenseMode:false,...extra});
const run=(s,n)=>{for(let i=0;i<n;i++)s=advanceMonth(s);return s;};
test('new equations are explicit, old equations remain unchanged, both replay',()=>{
 for(const revision of [5,6]){
  let s=start('middle',{economicRevision:revision});s=run(s,24);
  assert.equal(Boolean(s.foundation),revision===6);
  assert.deepEqual(importSimulation(exportSimulation(s)).metrics,s.metrics);
  assert.deepEqual(replayJournal(s).metrics,s.metrics);
 }
});
test('search and matching conserve labour without a common unemployment floor',()=>{
 const a=start(),b=structuredClone(a);b.foundation.assumptions.matchingEfficiency=.85;
 const force=a.metrics.laborForce,desired=a.firms.map(f=>f.workers*1.015);
 const x=matchEmployment(a,desired,force),y=matchEmployment(b,desired,force);
 assert.ok(sum(y)>sum(x));assert.ok(sum(y)<=force+1e-12);assert.ok(a.foundation.labor.hires<=a.foundation.labor.vacancies+a.foundation.labor.hires);
 const empty=matchEmployment(a,a.firms.map(()=>0),force);near(sum(empty),0);
 const full=structuredClone(a);full.foundation.assumptions.separation=0;full.foundation.assumptions.matchingEfficiency=1;near(sum(matchEmployment(full,a.firms.map(f=>f.workers*2),force)),force);
});
test('paid capital and paid research do not install the same resources twice',()=>{
 const s=start(),f=s.firms[0],before=f.productivity,k=f.knowledgeCapital;
 const installed=installTechnology(s,{sector:0,amount:100,efficiency:1});
 near(installed+(f.knowledgeCapital-k),100);assert.ok(f.productivity>before);
 const zero=start();zero.foundation.assumptions.adoptionSpeed=0;zero.foundation.assumptions.innovationEfficiency=0;
 installTechnology(zero,{sector:0,amount:100,efficiency:1});near(zero.firms[0].productivity,1);
});
test('actual public research purchases accumulate knowledge and expenditure stays single counted',()=>{
 let s=start(),p={...s.policy,researchBudget:1};s=advanceMonth(s,p);const paid=s.lastReport.fiscal.research;
 assert.ok(paid>0);const next=advanceMonth(s,p);assert.ok(next.foundation.researchStock>0);assert.ok(next.metrics.auditError<1e-5);
 near(s.lastReport.fiscal.purchases,s.lastReport.fiscal.militaryPurchases+s.lastReport.fiscal.institutionCost+s.lastReport.fiscal.healthcare+s.lastReport.fiscal.education+s.lastReport.fiscal.childcare+s.lastReport.fiscal.infrastructureMaintenance+s.lastReport.fiscal.research+s.lastReport.fiscal.taxAdministration+s.metrics.publicInvestment*s.metrics.investmentPrice+s.lastReport.fiscal.purchases*s.policy.governmentConsumption/s.journal.at(-1).calculationTrace.budgetPlan.purchaseShare,1e-2);
});
test('private recapitalization and bank resolution allocate real depositor resources',()=>{
 const s=start();s.policy.bankRescue=false;s.policy.bankEntry=true;
 s.bank.equity-=2500;const before=s.bank.equity,cash=sum(s.households.map(h=>h.cash))+sum(s.firms.map(f=>f.cash));
 resolveBanking(s,10000,[]);
 const paid=cash-sum(s.households.map(h=>h.cash))-sum(s.firms.map(f=>f.cash));
 near(s.bank.equity-before,paid);assert.ok(paid>0);assert.ok(s.foundation.resolutions.length>0);
 near(sum(s.foundation.banks.map(b=>b.equity)),s.bank.equity);
 // Existing asset losses were recognized before resolution, not subtracted twice.
 assert.ok(s.bank.equity>=before);
});
test('bank entry is funded and institution books have persistent distinct capital',()=>{
 const s=start();s.month=12;s.bank.lendingRate=.12;s.bank.depositRate=.02;
 const old=s.bank.equity;resolveBanking(s,10000,[]);assert.ok(s.foundation.banks.length>3);assert.ok(s.bank.equity>old);
 const count=s.foundation.banks.length;s.policy.bankEntry=false;s.month=24;resolveBanking(s,10000,[]);assert.equal(s.foundation.banks.length,count);
 near(sum(s.foundation.banks.map(b=>b.share)),1);near(sum(s.foundation.banks.map(b=>b.interbank)),0);
});
test('network subscriptions fund separate operators and never manufacture deposits',()=>{
 const s=start();for(const h of s.households)h.cash+=h.income*10;for(const n of s.networks)n.fee=2;
 const before=sum(s.households.map(h=>h.cash))+sum(s.networks.map(n=>n.operator.cash));
 const plans=networkFinance(s,1,0,()=>assert.fail('no credit supply'));
 const after=sum(s.households.map(h=>h.cash))+sum(s.networks.map(n=>n.operator.cash));
 near(before,after);assert.ok(plans.length>0);assert.ok(s.foundation.last.networkEquity>0);
 // Main service enterprise's investment/cash does not finance these plans.
 near(sum(plans.map(p=>p.amount)),sum(s.networks.map(n=>n.operator.cash)));
});
test('health and schooling are jointly bounded by staff, facilities and operating resources',()=>{
 const s=start();for(const pool of Object.values(s.foundation.providers))for(const owner of ['public','private']){pool[owner].staff=0;pool[owner].pipeline=[];}
 const flow={healthcare:10000,education:10000};const plans=s.households.map(()=>({health:100,education:100}));
 serviceSettlement(s,s,flow,plans,1,1,1);
 near(s.services.healthCoverage,0);near(s.services.educationCoverage,0);
 assert.ok(s.foundation.providers.health.public.pipeline[0].due>s.month);
});
test('zero public and private funding cannot deliver services through historic capital',()=>{
 const s=start();serviceSettlement(s,s,{healthcare:0,education:0},s.households.map(()=>({health:0,education:0})),1,1,1);
 near(s.services.healthCoverage,0);near(s.services.educationCoverage,0);
});
test('within-decile distributions preserve population and income while unemployment changes poverty',()=>{
 const s=start();const income=s.households.map((h,i)=>100+i*30),market=income.map(x=>x*1.1);
 s.metrics.unemployment=30;const points=populationDistribution(s,income,market);
 near(sum(points.map(p=>p.weight)),1);
 for(let i=0;i<10;i++)near(sum(points.filter(p=>p.group===i).map(p=>p.income*p.weight)),income[i]*s.households[i].population);
 assert.ok(points.some(p=>p.unemployed&&p.weight>0));assert.ok(points.length>10);
});
test('appropriations use preceding rolling GDP and tax administration has gradual effects',()=>{
 const s=start();s.metrics.nominalGDPAnnual*=1.2;
 const next=advanceMonth(s,{...s.policy,militaryBudget:2,taxAdministrationBudget:0});
 near(next.lastReport.calculationTrace.budgetPlan.budgetBase,s.metrics.nominalGDPAnnual/12);
 near(next.lastReport.fiscal.militaryRequested,s.metrics.nominalGDPAnnual*.02/12);
 assert.ok(next.foundation.taxCapacity>0);assert.ok(next.foundation.taxCapacity<1);
});
test('new state and provenance reject corruption rather than silently repairing money',()=>{
 const s=run(start(),3);
 for(const mutate of [x=>x.foundation.providers.health.public.staff=-1,x=>x.foundation.banks[0].equity+=100,x=>x.networks[0].operator.cash=-1,x=>x.foundation.technologyFrontier.pop()]){
  const bad=structuredClone(s);mutate(bad);assert.throws(()=>validateFoundation(bad));
 }
});
for(const country of ['poor','middle','rich'])test(`${country}: thirty-year no-shock accounts reconcile including services, banks and infrastructure`,()=>{
 let s=start(country);for(let i=0;i<360;i++){
  s=advanceMonth(s);assert.ok(s.metrics.auditError<Math.max(1e-4,Math.abs(s.metrics.nominalGDPMonthly)*1e-8));
  const b=accountBalances(s);near(b.bankResidual,0,1e-4);assert.ok(s.metrics.unemployment>=0&&s.metrics.unemployment<=100);
 }
 assert.ok(s.metrics.productivity>100);assert.ok(s.foundation.householdDistribution.length===100);
 assert.deepEqual(importSimulation(exportSimulation(s)).metrics,s.metrics);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,runMonths,accountBalances,scheduleOwnership,scheduleNetwork,scheduleShock,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {prepareInfrastructure,infrastructurePlans,completeInfrastructure,infrastructureMetrics} from '../src/infrastructure.js';
import {reviewPolicy} from '../src/politics.js';
import {advanceLabor,laborWageShares} from '../src/labor.js';
import {GROUPS} from '../src/config.js';

const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const sum=a=>a.reduce((v,x)=>v+x,0);
const clone=s=>structuredClone(s);
function balanced(s){
  const scale=Math.max(1,accountBalances(s).bankAssets,s.metrics.nominalGDPAnnual);
  for(const [k,v] of Object.entries(s.lastReport.audit))assert.ok(Math.abs(v)<Math.max(1e-5,scale*1e-10),`${k}: ${v}`);
  assert.ok(s.households.every(h=>h.cash>=0));assert.ok(s.firms.every(f=>f.cash>=0));
  for(const f of s.firms){close(sum(Object.values(f.ownership)),1);close(sum(f.workerOwners),f.ownership.cooperative);close(sum(f.domesticOwners),f.ownership.domestic);}
}

test('each monetary regime survives a matched multi-year shock with bank, CB and external identities',()=>{
  for(const monetaryRegime of ['discretion','rule','currencyBoard','dollarized','freeBanking']){
    let s=createSimulation({policy:{monetaryRegime},stochastic:true,seed:5});
    scheduleShock(s,{key:'energyPrice',multiplier:1.5,start:13,duration:12});
    for(let i=0;i<72;i++){s=advanceMonth(s);balanced(s);}
    assert.deepEqual(importSimulation(exportSimulation(s)).metrics,s.metrics);
    assert.deepEqual(replayJournal(s).metrics,s.metrics);
    if(['currencyBoard','dollarized'].includes(monetaryRegime)){close(s.exchangeRate,1);close(s.bank.centralBorrowing,0);}
  }
});
test('a hidden discretionary rate and target cannot steer non-CB regimes',()=>{
  for(const monetaryRegime of ['currencyBoard','dollarized','freeBanking']){
    const initial=createSimulation({policy:{monetaryRegime}});
    const a=runMonths(initial,36,{...initial.policy,rate:0,inflationTarget:0});
    const b=runMonths(initial,36,{...initial.policy,rate:40,inflationTarget:20});
    assert.deepEqual(a.metrics,b.metrics);
  }
});
test('dollar custody and currency-board reserve income have distinct financial consequences',()=>{
  const a=runMonths(createSimulation({policy:{monetaryRegime:'currencyBoard'}}),24);
  const b=runMonths(createSimulation({policy:{monetaryRegime:'dollarized'}}),24);
  assert.notEqual(a.bank.depositRate,b.bank.depositRate);balanced(a);balanced(b);
});
test('market energy pricing ignores an unused tariff while administered prices change suppliers cash flow',()=>{
  const initial=createSimulation();
  assert.deepEqual(runMonths(initial,24,{...initial.policy,energyTariff:20}).metrics,runMonths(initial,24,{...initial.policy,energyTariff:180}).metrics);
  const cheap=runMonths(initial,36,{...initial.policy,energyPricing:'regulated',energyTariff:40});
  const market=runMonths(initial,36);assert.ok(cheap.firms[1].price<market.firms[1].price);assert.ok(cheap.firms[1].lastRevenue<market.firms[1].lastRevenue);balanced(cheap);
});
test('maintenance slows exact annual wear for all owners without eliminating depreciation',()=>{
  const maintained=createSimulation(),neglected=clone(maintained),initial=maintained.networks.map(n=>({...n}));
  for(const n of neglected.networks){n.maintenanceCoverage=0;n.privateMaintenanceCoverage=0;}
  for(let i=0;i<12;i++){prepareInfrastructure(maintained,clone(maintained),[]);prepareInfrastructure(neglected,clone(neglected),[]);}
  for(let i=0;i<3;i++)for(const owner of ['public','municipal','private']){
    close(maintained.networks[i][owner]/initial[i][owner],1-.03*.25);
    close(neglected.networks[i][owner]/initial[i][owner],1-.03);
  }
});
test('corporate infrastructure reflects the operators ultimate ownership',()=>{
  const s=createSimulation(),before=infrastructureMetrics(s);
  s.firms[4].ownership={state:1,foreign:0,domestic:0,municipal:0,cooperative:0};
  const after=infrastructureMetrics(s);close(after.privateInfrastructureShare,0);close(after.corporateInfrastructureShare,before.corporateInfrastructureShare);
});
test('NPV falls with financing cost and a revenue guarantee affects concession selection',()=>{
  const low=createSimulation(),high=clone(low);low.bank.lendingRate=.12;high.bank.lendingRate=.50;
  for(const s of [low,high]){prepareInfrastructure(s,clone(s),[]);infrastructurePlans(s,[100,100,100,100,100]);}
  assert.ok(low.networks[0].privateNPV>high.networks[0].privateNPV);
  const guaranteed=createSimulation({policy:{concessionGuarantee:100}});
  for(const n of guaranteed.networks){n.fee=.45;n.expectedReturn=.12*.45-.025-.03*.25;}
  guaranteed.bank.lendingRate=.10;
  const plans=infrastructurePlans(guaranteed,[100,100,100,100,100]).flat();
  assert.ok(plans.some(p=>p.owner==='concession'));assert.ok(guaranteed.networks[0].concessionNPV>guaranteed.networks[0].privateNPV);
});
test('network capital is reclassified from paid investment and appears only after construction',()=>{
  const initial=createSimulation(),s=advanceMonth(initial);
  const projects=s.projects.filter(p=>p.type==='network'&&!p.legacy);assert.ok(projects.length>0);
  for(const p of projects)assert.equal(p.due,s.month+s.parameters.publicInvestmentDelay);
  // First-month commissioning is solely the already paid initial pipeline.
  assert.ok(s.networks.every((n,i)=>n.private<initial.networks[i].private));
  assert.ok(sum(projects.map(p=>p.amount))<=s.metrics.investment);balanced(s);
});
test('concession expiry transfers the remaining physical asset without a cash purchase or new GDP',()=>{
  const s=createSimulation();completeInfrastructure(s,{network:'roads',owner:'concession',amount:100,efficiency:1,guarantee:1});
  const cash=s.government.cash,oldPublic=s.networks[0].public;s.month=360;
  const events=[];prepareInfrastructure(s,clone(s),events);
  close(s.networks[0].concession,0);assert.ok(s.networks[0].public>oldPublic);close(s.government.cash,cash);assert.ok(events.some(e=>e.includes('окончание концессии')));
});
test('existing network transfers settle the purchase without creating physical capital, and replay',()=>{
  for(const kind of ['networkSale','networkPurchase','networkMunicipalize']){
    let s=createSimulation();const initialStock=s.infrastructure;
    scheduleNetwork(s,{network:'roads',kind,points:10});s=advanceMonth(s);balanced(s);
    const action=s.journal[0].actions[0];assert.ok(action.amount>0);assert.ok(s.infrastructure<initialStock+300);
    assert.deepEqual(replayJournal(s).metrics,s.metrics);
    assert.deepEqual(importSimulation(exportSimulation(s)).metrics,s.metrics);
    if(kind==='networkSale')assert.ok(s.lastReport.fiscal.networkSales>0);
    if(kind==='networkPurchase')assert.ok(s.lastReport.fiscal.networkPurchases>0);
  }
});
test('called concession guarantees consume fiscal cash and remain transfers in GDP accounting',()=>{
  let s=createSimulation({policy:{privateInfrastructureEntry:false,concessionGuarantee:100,infrastructurePricing:'capped',infrastructureFeeCap:20}});
  s=runMonths(s,72);assert.ok(s.networks.some(n=>n.contracts.length));
  assert.ok(s.journal.some(e=>e.events.some(x=>x.includes('финансирования')))||s.government.cash>=0);
  assert.ok(s.lastReport.fiscal.concessionGuarantees>0);close(s.lastReport.gdp.production,s.lastReport.gdp.expenditure,1e-5);balanced(s);
});
test('cooperatives, municipalities and foreign privatization preserve share matrices and financial balances',()=>{
  for(const kind of ['cooperatize','municipalize','foreignSale']){
    let s=createSimulation();scheduleOwnership(s,{sector:4,kind,points:10});s=advanceMonth(s);balanced(s);
    const a=s.journal[0].actions[0];assert.ok(a.actualPoints>0);
    if(kind==='cooperatize'){assert.ok(s.firms[4].ownership.cooperative>0);assert.ok(a.cost>0);}
    if(kind==='municipalize')close(a.cost,0);
    assert.deepEqual(replayJournal(s).metrics,s.metrics);
  }
});
test('courts record a rejected uncompensated nationalization and it replays exactly',()=>{
  let s=createSimulation();scheduleOwnership(s,{sector:1,kind:'nationalize',points:50,compensation:0});s=advanceMonth(s);
  const a=s.journal[0].actions[0];assert.ok(a.rejected);assert.equal(a.reason,'judicial-review');close(a.actualPoints,0);close(s.lastReport.fiscal.equityPurchases,0);
  assert.deepEqual(replayJournal(s).metrics,s.metrics);
});
test('weak parliamentary support can reject a large fiscal package while preserving requested and applied decisions',()=>{
  const s=createSimulation(),prev=clone(s);s.politics.parliamentSupport=.2;
  const requested={...s.policy,vat:30,transfers:12},accepted=reviewPolicy(s,prev,requested,[]);
  close(accepted.vat,prev.policy.vat);assert.ok(s.politics.lastReview.some(r=>r.key==='vat'&&r.requested===30));
  const next=advanceMonth(s,requested);assert.equal(next.journal[0].requestedPolicy.vat,30);assert.equal(next.journal[0].policy.vat,prev.policy.vat);
});
test('membership is endogenous, coverage differs from membership, and coordinated bargaining changes slowly',()=>{
  const initial=createSimulation(),next=advanceMonth(initial,{...initial.policy,bargainingSystem:'sector',workerRepresentation:true});
  assert.ok(next.metrics.unionDensity<50);assert.ok(Math.abs(next.metrics.unionDensity-initial.metrics.unionDensity)<1);
  const later=runMonths(initial,120,{...initial.policy,bargainingSystem:'sector',workerRepresentation:true});
  assert.ok(later.metrics.bargainingCoverage>later.metrics.unionDensity);assert.ok(later.metrics.bargainingCoverage>next.metrics.bargainingCoverage);
});
test('collective wage compression is normalized and does not create a wage bill',()=>{
  const s=createSimulation(),f=s.firms[0],before=laborWageShares(s,f,GROUPS);f.labor.coverage=.9;
  const after=laborWageShares(s,f,GROUPS);close(sum(before),1);close(sum(after),1);assert.ok(after[9]/after[0]<before[9]/before[0]);
});
test('inflation surprise and arrears can cause lost hours; strike rights do not create free output',()=>{
  const s=createSimulation(),prev=clone(s);prev.metrics.inflationMonthly=8;
  for(const f of s.firms){f.labor.coverage=.7;f.labor.density=.4;f.arrears=f.lastRevenue*.5;}
  advanceLabor(s,prev,[]);assert.ok(s.firms.some(f=>f.labor.strikeShare>.002));
  const banned=clone(s);banned.policy.strikeRights=false;advanceLabor(banned,prev,[]);assert.ok(banned.firms.every(f=>f.labor.strikeShare===0));
});
test('shorter hours alter both productive time and the paid wage bill',()=>{
  const s=createSimulation(),a=advanceMonth(s),b=advanceMonth(s,{...s.policy,normalWorkweek:32});
  assert.ok(b.lastReport.income.wages<a.lastReport.income.wages);assert.ok(b.metrics.realGDPMonthly<a.metrics.realGDPMonthly);balanced(b);
});
test('unfunded public services can be replaced only by paid private provision, with unequal access',()=>{
  const start=createSimulation(),p={...start.policy,healthcare:0,education:0,transfers:0,familyBenefits:0};
  const open=runMonths(start,60,p),closed=runMonths(start,60,{...p,privateHealthEntry:false,privateEducationEntry:false});
  assert.ok(open.metrics.totalHealthAccess>closed.metrics.totalHealthAccess);assert.ok(open.metrics.totalEducationAccess>closed.metrics.totalEducationAccess);
  assert.ok(open.metrics.healthAccessTop>open.metrics.healthAccessBottom);assert.equal(closed.metrics.privateHealthSpending,0);balanced(open);balanced(closed);
});
test('population can contract over thirty years under low fertility and an old age structure',()=>{
  const start=createSimulation({parameters:{initialChildShare:.17,initialElderlyShare:.23,initialFertility:1.3},policy:{migrationOpenness:0}});
  const end=runMonths(start,360);assert.ok(end.population<start.population);assert.ok(end.metrics.deaths>end.metrics.births);balanced(end);
});
test('closing inward migration does not prevent outward migration',()=>{
  const start=createSimulation({policy:{migrationOpenness:0}});start.metrics.realIncomeIndex=40;start.metrics.unemployment=20;
  const end=advanceMonth(start);assert.ok(end.metrics.migration<0);
});
test('election traits and legislative control remain separate from service capacity',()=>{
  const start=createSimulation({policy:{competitiveElections:false,courtBudget:0}}),end=runMonths(start,48);
  assert.equal(end.politics.elections.length,1);assert.equal(end.politics.elections[0].competitive,false);
  assert.ok(end.metrics.judicialIndependence>50);assert.ok(end.metrics.courtCapacity<start.metrics.courtCapacity);
});
test('imports reject damaged networks, labor stocks, public coverage, political rules and construction registers',()=>{
  const source=exportSimulation(runMonths(createSimulation(),24));
  for(const mutate of [s=>s.networks[0].public=-1,s=>s.networks[0].private+=10,s=>s.firms[0].labor.coverage=2,s=>s.services.healthByGroup.pop(),s=>s.politics.judicialIndependence=2,s=>s.projects[0].due=-1,s=>s.monetary.peg=0,s=>s.policy.monetaryRegime='invalid']){
    const data=JSON.parse(source);mutate(data.state);assert.throws(()=>importSimulation(JSON.stringify(data)));
  }
  assert.throws(()=>createSimulation({parameters:{unionAdjustment:2}}));assert.throws(()=>createSimulation({parameters:{politicalAdjustment:2}}));
});

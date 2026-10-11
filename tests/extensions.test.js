import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,runMonths,comparePolicies,scheduleOwnership,scheduleRestructuring,replayJournal,scheduleShock,exportSimulation,importSimulation,accountBalances} from '../src/engine.js';
import {weightedGini,weightedQuantile,humanDevelopmentIndex} from '../src/indicators.js';
import {GROUPS,MODEL_PROFILES} from '../src/config.js';
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
function ownershipBalance(s){for(const f of s.firms){close(Object.values(f.ownership).reduce((a,b)=>a+b),1);close(f.domesticOwners.reduce((a,b)=>a+b),f.ownership.domestic);assert.ok(Object.values(f.ownership).every(v=>v>=0));}}
test('weighted Gini, quantile, and UNDP 2025 worked example',()=>{
  close(weightedGini([1,1],[.5,.5]),0);close(weightedGini([0,2],[.5,.5]),.5);
  close(weightedQuantile([5,1,3],[.2,.6,.2]),1);
  const h=humanDevelopmentIndex(60.8,3.2,10.4,3806);assert.ok(Math.abs(h.hdi-.515)<.001);close(humanDevelopmentIndex(85,15,18,75000).hdi,1);
});
test('ten strata and transfer, wages, dividends, families all sum to one',()=>{
  assert.equal(GROUPS.length,10);for(const key of ['population','wageShare','dividendShare','familyShare','transferShare'])close(GROUPS.reduce((v,g)=>v+g[key],0),1);
});
test('progressive income taxation and targeted transfers reduce disposable inequality in matched experiments',()=>{
  const origin=createSimulation({resourceMode:false}),a=runMonths(origin,60),b=runMonths(origin,60,{...origin.policy,incomeTaxProgressivity:1,transfers:7});
  assert.ok(b.metrics.giniDisposable<a.metrics.giniDisposable);assert.ok(b.metrics.giniDisposable<b.metrics.giniMarket);
});
test('funded education influences schooling slowly, not instant skills from a slider',()=>{
  const origin=createSimulation(),a=advanceMonth(origin),b=advanceMonth(origin,{...origin.policy,education:6});close(a.education.meanYears,b.education.meanYears);
  const later=runMonths(origin,120,{...origin.policy,education:6});assert.ok(later.education.meanYears>origin.education.meanYears);assert.ok(later.metrics.hdiEducation>origin.metrics.hdiEducation);
});
test('purchase, privatization, compensation and recapitalization preserve balances and ownership',()=>{
  for(const kind of ['purchase','privatize','nationalize','recapitalize']){
    let s=createSimulation({policy:{judicialReview:false}});scheduleOwnership(s,{sector:1,kind,points:10,compensation:.5});const oldCapital=s.firms[1].capital;s=advanceMonth(s);
    ownershipBalance(s);assert.ok(Math.abs(accountBalances(s).bankResidual)<1e-6);assert.ok(s.metrics.auditError<1e-6);
    assert.ok(s.lastReport.fiscal.equityPurchases>0||s.lastReport.fiscal.equitySales>0);
    // Purchase itself is financial; physical capital only changes via depreciation/completions.
    const control=advanceMonth(createSimulation());close(s.firms[1].capital,control.firms[1].capital);
    assert.ok(oldCapital>0);
  }
});
test('uncompensated seizure is not free public output and raises property risk',()=>{
  let s=createSimulation({policy:{judicialReview:false}});scheduleOwnership(s,{sector:1,kind:'nationalize',points:50,compensation:0});s=advanceMonth(s);
  close(s.lastReport.fiscal.equityPurchases,0);assert.ok(s.institutions.ownershipRisk>0);ownershipBalance(s);assert.ok(s.metrics.auditError<1e-6);
});
test('public ownership has no immediate productivity bonus; governance profiles act with lags',()=>{
  const initial=createSimulation(),base=advanceMonth(initial);scheduleOwnership(initial,{sector:1,kind:'purchase',points:20});const changed=advanceMonth(initial);
  assert.ok(Math.abs(changed.firms[1].managementEfficiency-base.firms[1].managementEfficiency)<.001);
  for(const modelProfile of Object.keys(MODEL_PROFILES)){const s=runMonths(createSimulation({modelProfile}),36);assert.ok(Number.isFinite(s.metrics.gdpPerCapitaReal));}
});
test('foreign assets and open FX positions count as risk; liquidity swap reconciles CB balance',()=>{
  const initial=createSimulation();initial.bank.foreignAssetsUSD+=30000;initial.bank.equity+=30000;
  assert.ok(accountBalances(initial).riskWeightedAssets>accountBalances(createSimulation()).riskWeightedAssets+10000);
  const s=advanceMonth(initial,{...initial.policy,liquiditySupport:false});assert.ok(s.lastReport.fiscal.reserveConversion>0);close(s.lastReport.audit.centralBank,0);close(s.lastReport.audit.bankBalance,0);
});
test('high policy rates do not force an unaffordable deposit promise regardless of asset income',()=>{
  const origin=createSimulation(),s=runMonths(origin,120,{...origin.policy,rate:27.5});
  assert.ok(s.bank.depositRate<.24);assert.ok(s.metrics.capitalRatio<500);assert.ok(s.bank.equity>=0);
});
test('CB reserve interest is settled in balances; losses defer remittances, not automatic treasury default',()=>{
  const origin=createSimulation(),s=runMonths(origin,48,{...origin.policy,rate:25});
  close(s.lastReport.audit.centralBank,0,1e-5);assert.ok(s.centralBank.deferredLoss>=0);assert.ok(s.government.cash>=0);
  if(s.centralBank.deferredLoss>0)close(s.centralBank.lastRemittance,0);
});
test('distressed debt exchange is a default even below debt-to-GDP ceiling, and haircut impairs bank equity',()=>{
  const origin=createSimulation();scheduleRestructuring(origin,{haircut:.3,extension:84});const s=advanceMonth(origin);
  assert.equal(s.government.defaults,1);assert.ok(s.lastReport.fiscal.domesticHaircut>0);assert.ok(s.government.defaultEpisodes[0].npvLossLC>0);assert.ok(s.government.excludedUntil>s.month);assert.ok(s.metrics.auditError<1e-6);
});
test('favourable exchange without haircut is not counted as sovereign default',()=>{
  const origin=createSimulation();scheduleRestructuring(origin,{haircut:0,extension:12});const s=advanceMonth(origin);
  assert.equal(s.government.defaults,0);assert.ok(s.metrics.auditError<1e-6);
});
test('actual missed coupons or principal mark default before arbitrary debt ratios',()=>{
  const origin=createSimulation();origin.parameters.maximumPublicDebtRatio=0;origin.government.cash=0;
  origin.bank.equity+=3000; // Treasury deposit removed; preserve bank accounting.
  const s=advanceMonth(origin,{...origin.policy,automaticRestructuring:false});
  assert.ok(s.government.defaultActive);assert.equal(s.government.defaults,1);assert.ok(s.metrics.debtInDefault>0);assert.ok(s.government.arrears>0);assert.ok(s.metrics.auditError<1e-6);
});
test('full journal records every month, outcomes, parameter edits, actions, notes and external conditions',()=>{
  let s=createSimulation({stochastic:true,seed:9});s.parameters.importPassThrough=.25;s.world.globalRate=5;s.pendingNote='Проверяю гипотезу';
  scheduleShock(s,{key:'commodityPrice',multiplier:.7,duration:12});scheduleOwnership(s,{sector:1,kind:'purchase',points:10});
  s=runMonths(s,12,{...s.policy,rate:12,vat:20});
  assert.equal(s.journal.length,12);assert.equal(s.journal[0].note,'Проверяю гипотезу');assert.ok(s.journal[0].parameterChanges.length);assert.ok(s.journal[0].worldChanges.length);assert.ok(s.journal[0].actions.length);assert.equal(s.journal[11].policy.vat,20);
  assert.deepEqual(replayJournal(s).metrics,s.metrics);assert.deepEqual(importSimulation(exportSimulation(s)).metrics,s.metrics);
});
test('manual favourable and distressed debt exchanges replay exactly from the journal',()=>{
  for(const haircut of [0,.3]){
    let s=createSimulation({stochastic:true,seed:17});scheduleRestructuring(s,{haircut,extension:haircut===0?12:84});s=runMonths(s,24);
    assert.equal(s.journal[0].actions[0].kind,'restructure');assert.deepEqual(replayJournal(s).metrics,s.metrics);
  }
});
test('A/B control ignores queued ownership operations while the treatment executes them',()=>{
  const s=createSimulation({policy:{judicialReview:false}});scheduleOwnership(s,{sector:1,kind:'nationalize',points:20,compensation:0});const r=comparePolicies(s,s.policy,s.policy,12);
  const standalone=runMonths({...s,pendingActions:[]},12);close(r.a.firms[1].ownership.state,standalone.firms[1].ownership.state);assert.ok(r.b.firms[1].ownership.state>r.a.firms[1].ownership.state);
  assert.equal(s.pendingActions.length,1);assert.equal(s.month,0);
});
test('monetary demand transmission remains active in the late low-credit economy',()=>{
  const origin=runMonths(createSimulation({resourceMode:false}),240);
  for(const a of [...origin.households,...origin.firms]){const total=a.loanLC+a.loanFX*origin.exchangeRate,value=Math.min(total,a.cash);if(total>0){a.loanLC*=1-value/total;a.loanFX*=1-value/total;a.cash-=value;}}
  assert.ok(accountBalances(origin).privateLoans/origin.metrics.nominalGDPAnnual<.05);close(accountBalances(origin).bankResidual,0,1e-5);
  const r=comparePolicies(origin,{...origin.policy,rate:2},{...origin.policy,rate:27.5},24);
  assert.ok(r.b.metrics.consumption<r.a.metrics.consumption);assert.ok(r.b.metrics.inflationYoY<r.a.metrics.inflationYoY);assert.ok(r.b.metrics.depositRate>r.a.metrics.depositRate);
});
test('imports reject damaged journal, CB accounting, ownership and coefficient domains',()=>{
  const source=exportSimulation(runMonths(createSimulation(),2));
  for(const mutate of [s=>s.journal[1].month=10,s=>s.centralBank.equity+=100,s=>delete s.parameters.pppConversionFactor,s=>s.parameters.pricePersistence=2,s=>s.firms[0].domesticOwners[0]=-1]){
    const data=JSON.parse(source);mutate(data.state);assert.throws(()=>importSimulation(JSON.stringify(data)));
  }
  assert.throws(()=>createSimulation({parameters:{pregnancyDelay:1.5}}));assert.throws(()=>createSimulation({parameters:{pppConversionFactor:0}}));
});
test('thirty-year fixed-policy baselines have finite development indicators and no runaway bank capital',()=>{
  for(const resourceMode of [false,true]){const s=runMonths(createSimulation({resourceMode}),360);assert.equal(s.journal.length,360);ownershipBalance(s);assert.ok(s.metrics.capitalRatio<200);assert.ok(s.metrics.hdi>0&&s.metrics.hdi<1);assert.ok(s.metrics.giniDisposable>=0&&s.metrics.giniDisposable<=100);assert.ok(s.metrics.inflationYoY<20);assert.equal(s.government.defaults,0);}
});

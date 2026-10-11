import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,runMonths,comparePolicies,annualToMonthly,monthlyToAnnual,solveLeontief,accountBalances,scheduleShock,exportSimulation,importSimulation} from '../src/engine.js';
import {INPUTS,MODULES} from '../src/config.js';

const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const same=(a,b)=>assert.deepEqual(a,b);
function checkState(s) {
  for(const [key,value] of Object.entries(s.metrics)) assert.ok(Number.isFinite(value),`${key} is not finite`);
  assert.ok(s.metrics.unemployment>=0&&s.metrics.unemployment<=100);
  assert.ok(s.metrics.fulfillment>=0&&s.metrics.fulfillment<=100);
  assert.ok(s.government.reservesUSD>=-1e-8&&s.government.fundUSD>=-1e-8);
  assert.ok(s.firms.every(f=>f.inventory>=0&&f.capital>0&&f.workers>=0&&f.price>0));
  assert.ok([...s.households,...s.firms].every(a=>a.cash>=-1e-6&&a.loanLC>=0&&a.loanFX>=0));
  assert.ok(s.government.cash>=-1e-6);
  const a=accountBalances(s);
  assert.ok(Math.abs(a.bankResidual)<Math.max(1e-5,Math.abs(a.bankAssets)*1e-9));
  for(const [key,value] of Object.entries(s.lastReport.audit)) assert.ok(Math.abs(value)<Math.max(1e-5,Math.abs(a.bankAssets)*1e-9),`${key}: ${value}`);
  close(s.population,s.ageCohorts.reduce((a,b)=>a+b,0));
}

test('effective annual rates compound exactly over twelve months, including depreciation',()=>{
  for(const r of [.01,.08,.40,-.03,-.06]) {
    close(Math.pow(1+annualToMonthly(r),12)-1,r);
    close(monthlyToAnnual(annualToMonthly(r)),r);
  }
});
test('initial country has $6000 per capita, 10 million people, 50% public debt and all 23 blocks',()=>{
  const s=createSimulation();close(s.metrics.gdpPerCapitaReal,6000);close(s.population,10);close(s.metrics.debtRatio,50);assert.equal(MODULES.length,23);checkState(s);
});
test('Leontief solution satisfies q = Aq + f; no double counting of intermediate goods',()=>{
  const f=[100,50,300,20,200],q=solveLeontief(f);
  for(let i=0;i<5;i++) close(q[i],f[i]+INPUTS[i].reduce((v,a,j)=>v+a*q[j],0));
});
test('120 months in both structures reconcile GDP, goods, bank, government and foreign accounts',()=>{
  for(const resourceMode of [true,false]) {
    let s=createSimulation({resourceMode});
    for(let i=0;i<120;i++){s=advanceMonth(s);checkState(s);}
  }
});
test('price-index inflation uses a twelve-month ratio, not monthly inflation times twelve',()=>{
  const s=runMonths(createSimulation(),18),old=s.history.find(x=>x.month===6);
  close(s.metrics.inflationYoY,(s.consumerPriceIndex/old.consumerPriceIndex-1)*100);
  close(s.metrics.gdpGrowthYoY,(s.metrics.realGDPMonthly/old.realGDPMonthly-1)*100);
  close(s.metrics.nominalGDPAnnual,s.history.filter(x=>x.month>=7&&x.month<=18).reduce((v,x)=>v+x.nominalGDPMonthly,0));
});
test('one month is pure, deterministic and does not mutate the prior state',()=>{
  const s=createSimulation(),original=exportSimulation(s);same(advanceMonth(s),advanceMonth(s));assert.equal(exportSimulation(s),original);assert.equal(advanceMonth(s).month,1);
});
test('same policy in A/B yields identical complete trajectories, also with random shocks',()=>{
  const s=createSimulation({stochastic:true,seed:573});scheduleShock(s,{key:'commodityPrice',multiplier:.7,duration:12});
  const c=comparePolicies(s,s.policy,s.policy,24);same(c.a,c.b);assert.equal(s.month,0);
});
test('matched-world monetary experiment: higher rate raises borrowing costs and lowers medium-term demand and inflation',()=>{
  const s=createSimulation(),c=comparePolicies(s,s.policy,{...s.policy,rate:15},24);
  assert.ok(c.b.metrics.lendingRate>c.a.metrics.lendingRate);
  assert.ok(c.b.metrics.investment<c.a.metrics.investment);
  assert.ok(c.b.metrics.realGDPMonthly<c.a.metrics.realGDPMonthly);
  assert.ok(c.b.metrics.inflationYoY<c.a.metrics.inflationYoY);
  same(c.a.lastReport.world,c.b.lastReport.world);
});
test('public investment first creates spending; infrastructure is added only at completion',()=>{
  const s=createSimulation(),high={...s.policy,publicInvestment:10};
  const a=advanceMonth(s),b=advanceMonth(s,high);
  close(a.infrastructure,b.infrastructure);assert.ok(b.metrics.publicInvestment>a.metrics.publicInvestment);
  const c=comparePolicies(s,s.policy,high,24);assert.ok(c.b.infrastructure>c.a.infrastructure);
});
test('education affects skills gradually; institutions and demography have active state',()=>{
  const s=createSimulation(),b=runMonths(s,24,{...s.policy,education:5,taxEnforcement:100,competition:100});
  assert.ok(b.skills>s.skills);assert.ok(b.institutions.informality<s.institutions.informality);assert.ok(b.institutions.competition>s.institutions.competition);
  assert.ok(b.population>s.population);assert.notEqual(b.ageCohorts[2],s.ageCohorts[2]);
});
test('raw materials change exports, government rents and stabilization assets',()=>{
  const low=createSimulation(),high=createSimulation();low.world.commodityPrice=70;high.world.commodityPrice=130;
  const a=runMonths(low,6),b=runMonths(high,6);
  assert.ok(b.lastReport.fiscal.royalty>a.lastReport.fiscal.royalty);assert.ok(b.government.fundUSD>a.government.fundUSD);
  assert.ok(b.lastReport.external.exportsUSD>a.lastReport.external.exportsUSD);
  const divers=runMonths(createSimulation({resourceMode:false}),6);close(divers.lastReport.fiscal.royalty,0);close(divers.government.fundUSD,0);
});
test('external supply bottlenecks draw inventories and ration physical output',()=>{
  const base=createSimulation(),shock=createSimulation();shock.world.importAvailability=30;
  const a=runMonths(base,6),b=runMonths(shock,6);
  assert.ok(b.metrics.realGDPMonthly<a.metrics.realGDPMonthly);assert.ok(b.metrics.fulfillment<a.metrics.fulfillment);checkState(b);
});
test('tariffs and VAT preserve nominal and real GDP identities',()=>{
  let s=createSimulation();for(let i=0;i<24;i++){s=advanceMonth(s,{...s.policy,tariff:20,vat:25});checkState(s);}
  assert.ok(s.lastReport.fiscal.tariff>0&&s.lastReport.fiscal.vat>0);
});
test('VAT is a one-off index shock, not a recurring monthly tax-price jump',()=>{
  const s=createSimulation(),p={...s.policy,vat:25};
  const first=advanceMonth(s,p),second=advanceMonth(first,p);
  assert.ok(first.metrics.inflationMonthly>5);assert.ok(Math.abs(second.metrics.inflationMonthly)<3);
});
test('interventions cannot spend unavailable reserves or treasury balances',()=>{
  let s=createSimulation();s.government.reservesUSD=25;
  s.centralBank.equity=s.government.reservesUSD+s.bank.centralBorrowing-s.bank.reserves;
  s=advanceMonth(s,{...s.policy,fxIntervention:500});close(s.lastReport.fiscal.reserveSale,25*s.exchangeRate);assert.ok(s.lastReport.events.some(x=>x.includes('Интервенция ограничена')));checkState(s);
});
test('old sovereign coupons are fixed after a policy-rate change',()=>{
  const s=createSimulation(),a=advanceMonth(s),b=advanceMonth(s,{...s.policy,rate:20});
  close(a.government.domesticBonds[0].rate,b.government.domesticBonds[0].rate);
  assert.ok(b.government.domesticBonds.filter(x=>x.maturity>60).every(x=>x.rate>=.20));
});
test('a foreign-rate shock reprices new external bonds while old coupons remain fixed',()=>{
  const s=createSimulation();scheduleShock(s,{key:'globalRate',multiplier:2,duration:12});
  const b=advanceMonth(s,{...s.policy,governmentConsumption:35,publicInvestment:15,transfers:20});
  const newlyIssued=b.government.externalBonds.filter(x=>x.maturity>84);
  assert.ok(newlyIssued.length>0);
  assert.ok(newlyIssued.every(x=>Math.abs(x.rate-(.08+b.lastReport.fiscal.sovereignSpread))<1e-10));
  close(b.government.externalBonds[0].rate,.065);checkState(b);
});
test('transfers are financial redistributions, not directly added to GDP',()=>{
  const s=advanceMonth(createSimulation(),{...createSimulation().policy,transfers:10});
  const g=s.lastReport.gdp;close(s.metrics.nominalGDPMonthly,g.consumption+g.investment+g.government+g.exports-g.imports+g.inventories);
  assert.ok(s.lastReport.fiscal.transfers>0);checkState(s);
});
test('matched seeds reproduce external environments despite different policies',()=>{
  const s=createSimulation({stochastic:true,seed:999}),c=comparePolicies(s,s.policy,{...s.policy,rate:14,vat:20},12);
  same(c.a.lastReport.world,c.b.lastReport.world);
  assert.notDeepEqual(c.a.metrics,c.b.metrics);
});
test('six mixed crisis policies run with finite values and reconciled accounts',()=>{
  const policies=[{rate:30},{rate:0,vat:0,incomeTax:0,corporateTax:0},{governmentConsumption:35,publicInvestment:15,transfers:20,education:8},{fxIntervention:500},{reserveRequirement:25,bankCapitalRequirement:25,liquiditySupport:false,bankRescue:false},{tariff:30,energyTariff:180,minimumWage:200}];
  for(const patch of policies) {let s=createSimulation({stochastic:true,seed:83});for(let i=0;i<60;i++){s=advanceMonth(s,{...s.policy,...patch});checkState(s);}}
});
test('save/restore preserves future trajectory and rejects corrupted balances',()=>{
  const s=runMonths(createSimulation({stochastic:true}),12),loaded=importSimulation(exportSimulation(s));
  same(runMonths(s,6),runMonths(loaded,6));
  const bad=JSON.parse(exportSimulation(s));bad.state.bank.equity+=100;assert.throws(()=>importSimulation(JSON.stringify(bad)),/балансы/);
  assert.throws(()=>importSimulation('{"format":"unknown"}'),/формат/);
});

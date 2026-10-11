import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,runMonths,realInterestRate,exportSimulation,importSimulation} from '../src/engine.js';
import {createDemography,cohortTotals,expectedBirths,advanceDemography} from '../src/demography.js';
import {PARAMETERS} from '../src/config.js';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

test('age-sex cohorts reconstruct ten million people and three economic age groups',()=>{
  const d=createDemography(10,PARAMETERS);close(cohortTotals(d).reduce((a,b)=>a+b),10);
  cohortTotals(d).forEach((n,i)=>close(n,[2.8,6.5,.7][i]));
  assert.equal(d.female.length,1201);assert.equal(d.male.length,1201);
});
test('births depend on reproductive-age women and age-specific fertility, not target population growth',()=>{
  const d=createDemography(10,PARAMETERS),initial=expectedBirths(d);
  d.female=d.female.map(x=>x*2);close(expectedBirths(d),initial*2);
  d.female.fill(0);close(expectedBirths(d),0);
});
test('one month ages a cohort exactly across the eighteenth birthday and keeps the 100+ tail',()=>{
  const prev=createSimulation();prev.demography.female.fill(0);prev.demography.male.fill(0);
  prev.demography.female[215]=.4;prev.demography.male[1200]=.6;prev.demography.pregnancies.fill(0);
  prev.population=1;prev.ageCohorts=cohortTotals(prev.demography);prev.policy.migrationOpenness=0;
  const s=structuredClone(prev);s.month=1;advanceDemography(s,prev);
  assert.ok(s.demography.female[216]>.39);assert.equal(s.demography.female[215],0);
  assert.ok(s.demography.male[1200]>.5);assert.ok(Math.abs(s.demography.populationResidual)<1e-9);
});
test('population changes reconcile births, deaths and migration on every monthly turn for twenty years',()=>{
  let s=createSimulation({resourceMode:false,stochastic:true,seed:32});
  for(let i=0;i<240;i++) {const old=s;s=advanceMonth(s);close(s.population,old.population+s.metrics.births-s.metrics.deaths+s.metrics.migration);
    assert.ok(s.demography.female.every(x=>x>=0));assert.ok(s.demography.male.every(x=>x>=0));}
});
test('more family spending does not deliver babies immediately, but affects later conceptions and births',()=>{
  const initial=createSimulation({resourceMode:false}),high={...initial.policy,familyBenefits:3};
  const a=runMonths(initial,9),b=runMonths(initial,9,high);close(a.metrics.births,b.metrics.births);
  const laterA=runMonths(initial,48),laterB=runMonths(initial,48,high);
  assert.ok(laterB.metrics.totalFertilityRate>laterA.metrics.totalFertilityRate);
  assert.ok(laterB.metrics.births>laterA.metrics.births);
});
test('paid healthcare gradually lowers mortality risk; an unfunded slider does not provide services',()=>{
  const prev=createSimulation();prev.lastReport.fiscal={healthcare:100,familyBenefits:25};
  const same=structuredClone(prev);same.month=1;same.policy.healthcare=10;advanceDemography(same,prev);
  close(same.demography.healthAccess,1);
  const d=structuredClone(prev);d.lastReport.fiscal.healthcare=250;
  const high=structuredClone(d);high.month=1;advanceDemography(high,d);
  assert.ok(high.demography.healthAccess>same.demography.healthAccess);
  assert.ok(high.demography.mortalityFactor<same.demography.mortalityFactor);
});
test('newborns do not enter the working-age population during a ten-year experiment',()=>{
  const prev=createSimulation();prev.demography.female.fill(0);prev.demography.male.fill(0);
  prev.demography.female[0]=1;prev.demography.pregnancies.fill(0);prev.demography.male[0]=1;
  prev.population=2;prev.ageCohorts=cohortTotals(prev.demography);prev.policy.migrationOpenness=0;
  let s=prev;
  for(let i=0;i<120;i++){const next=structuredClone(s);next.month++;advanceDemography(next,s);s=next;}
  close(s.ageCohorts[1],0);assert.ok(s.population>1.9);
});
test('exact Fisher rate works at high inflation',()=>{close(realInterestRate(.0875,.353),-.1962305986696231);});
test('total real and dollar GDP use monthly sums, with historical exchange rates',()=>{
  for(const n of [0,1,12,36]) {const s=runMonths(createSimulation(),n),last=s.history.filter(x=>x.month>=n-11);
    close(s.metrics.realGDPRolling,last.reduce((v,x)=>v+x.realGDPMonthly,0));
    close(s.metrics.nominalGDPAnnual,last.reduce((v,x)=>v+x.nominalGDPMonthly,0));
    close(s.metrics.gdpUSDRolling,last.reduce((v,x)=>v+x.nominalGDPMonthly/x.exchangeRate,0));
    close(s.metrics.realGDPAnnualized,s.metrics.realGDPMonthly*12);}
});
test('additional public services and family transfers appear in budgets without double-counted GDP',()=>{
  const s=advanceMonth(createSimulation(),{...createSimulation().policy,healthcare:5,familyBenefits:3}),f=s.lastReport.fiscal;
  assert.ok(f.healthcare>0&&f.familyBenefits>0&&f.institutionCost>0);
  close(s.metrics.governmentSpending,f.purchases+f.transfers+f.familyBenefits+f.businessSupport+f.interest+f.bankRescue);
  assert.ok(Math.abs(s.lastReport.audit.nominalGDP)<1e-7);
});
test('institutional policy is budgeted and stronger control has a higher administrative share',()=>{
  const s=createSimulation(),a=advanceMonth(s),b=advanceMonth(s,{...s.policy,taxEnforcement:100,competition:100});
  assert.ok(b.lastReport.fiscal.institutionCost>a.lastReport.fiscal.institutionCost);
});
test('baseline no-shock countries do not spontaneously enter the former 40–60% inflation crisis in ten years',()=>{
  for(const resourceMode of [true,false]) {const s=runMonths(createSimulation({resourceMode}),120);
    assert.ok(s.metrics.inflationYoY>0&&s.metrics.inflationYoY<15);
    assert.ok(s.metrics.debtRatio<60);assert.ok(s.metrics.gdpPerCapitaReal>6000);}
});
test('corrupted population and incompatible previous-version saves are rejected',()=>{
  const data=JSON.parse(exportSimulation(createSimulation()));data.state.demography.female[50]+=1;
  assert.throws(()=>importSimulation(JSON.stringify(data)),/населения/);
  data.version='1.0.0';assert.throws(()=>importSimulation(JSON.stringify(data)),/версия/);
  assert.throws(()=>createSimulation({parameters:{pregnancyDelay:1.5}}),/целым/);
});

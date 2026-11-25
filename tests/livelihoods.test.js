import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,accountBalances} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {initializeLivelihoods,prepareLivelihoods,enterFamilyBusinesses,familyCompanies,validateLivelihoods,finishLivelihoods,capFamilyFood} from '../src/livelihoods.js';
import {initializeFirmMarkets} from '../src/firm-markets.js';
import {enterpriseBusinesses} from '../src/enterprise-market.js';
import {validateExtendedState} from '../src/state-validation.js';
const sum=a=>a.reduce((v,x)=>v+x,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=(extra={})=>createSimulation({...newGameOptions({country:'poor',resource:false}),politicalMode:false,defenseMode:false,...extra});
const totals=s=>({cash:sum(enterpriseBusinesses(s).map(c=>c.cash))+sum(s.households.map(h=>h.cash)),capital:sum(s.firms.map(f=>f.capital)),loans:sum(enterpriseBusinesses(s).map(c=>c.loanLC+c.loanFX*s.exchangeRate)),output:s.metrics.realGDPMonthly});
test('activation partitions existing agriculture without new deposits, capital, loans or output',()=>{
 const s=start({economicRevision:23}),before=totals(s),accounts=accountBalances(s);s.economy.revision=24;initializeFirmMarkets(s);initializeLivelihoods(s);assert.deepEqual(totals(s),before);assert.deepEqual(accountBalances(s),accounts);assert.equal(familyCompanies(s).length,0);validateExtendedState(s);
});
test('entry buys specific existing equipment using a specific household deposit and bounded land',()=>{
 const s=start(),prev=structuredClone(s),before=totals(s);prepareLivelihoods(s,prev);enterFamilyBusinesses(s,prev);
 const entered=familyCompanies(s);assert.ok(entered.length>0);const after=totals(s);for(const k of Object.keys(before))near(after[k],before[k]);
 for(const c of entered){assert.equal(c.loanLC,0);assert.equal(c.loanFX,0);assert.ok(c.capital>0);assert.equal(c.domesticOwners[c.familyGroup],1);assert.ok(c.workers===0);}
 validateLivelihoods(s);
});
test('zero cash, zero equipment, closed entry or unavailable land blocks the corresponding entry',()=>{
 for(const reason of ['cash','tools','closed','land']){const s=start(),prev=structuredClone(s);prepareLivelihoods(s,prev);
  if(reason==='cash')for(const h of s.households)h.cash=0;
  if(reason==='tools')for(const m of s.firmMarkets.markets)for(const c of m.companies)c.capital=0;
  if(reason==='closed')s.policy.privateBusinessEntry=false;
  if(reason==='land')s.livelihoods.landTotal=s.livelihoods.reference[0].workers;
  enterFamilyBusinesses(s,prev);assert.equal(familyCompanies(s).filter(c=>reason==='land'?c.sector===0:true).length,0,reason);
 }
});
test('own-use does not become paid employment merely by changing the statistic',()=>{
 let s=start();s=advanceMonth(s);assert.ok(s.metrics.ownUseWorkers>0);near(s.metrics.employment+s.metrics.ownUseWorkers,s.metrics.productiveWorkers);near(s.metrics.wageEmployment+s.metrics.selfEmployment,s.metrics.employment);near(s.metrics.unemployedPeople+s.metrics.employment,s.metrics.laborForce);near(s.metrics.laborForce+s.metrics.outsideLaborForce,s.population*s.workingAgeShare);
});
test('family own-food draw is constrained by their delivered output, inputs and tools',()=>{
 let s=advanceMonth(start());assert.ok(familyCompanies(s).some(c=>c.intendedUse==='own-use'));
 const group=familyCompanies(s).find(c=>c.intendedUse==='own-use').familyGroup;near(capFamilyFood(s,group,100,0,1,100,1),0);near(capFamilyFood(s,group,100,100,1,1e9,1),0);
});
test('owner cash draws are bounded by operating returns rather than financed fictitious salaries',()=>{
 let s=start();for(let i=0;i<18;i++){s=advanceMonth(s);for(const c of familyCompanies(s)){if(!c.last||c.last.month!==s.month)continue;const available=Math.max(0,c.last.revenue-c.last.inputCost-c.last.depreciation-c.last.interest-(c.lastLandRent??0));assert.ok(c.last.payroll<=available+1e-7);}}
});
test('families cannot simultaneously take their own reserved job and another group job',()=>{
 let s=start();for(let i=0;i<18;i++){s=advanceMonth(s);for(const g of s.laborDistribution.groups)near(g.employed+g.unemployed,g.laborForce);for(let j=0;j<10;j++){const own=sum(familyCompanies(s).filter(c=>c.familyGroup===j).map(c=>c.ownerWorkers??0));assert.ok(own<=s.laborDistribution.groups[j].employed+1e-7);}validateExtendedState(s);}
});
test('income, own-food and mixed-income sources reconcile, along with GDP and banking accounts',()=>{
 let s=start();for(let i=0;i<24;i++){s=advanceMonth(s);assert.ok(s.metrics.auditError<1e-5);for(const r of s.householdEconomy.records)near(sum(Object.values(r.sources)),r.income);near(s.metrics.mixedIncome,sum(s.householdEconomy.records.map(r=>r.sources.mixed)));}assert.ok(s.metrics.mixedIncome>0);
});
test('new livelihood states round-trip and replay; old journal is preserved at migration',()=>{
 let s=start();for(let i=0;i<8;i++)s=advanceMonth(s);const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded).metrics,advanceMonth(s).metrics);assert.deepEqual(replayJournal(loaded).metrics,s.metrics);
 let old=start({economicRevision:23});old=advanceMonth(old,old.policy,{preserveEconomicRevision:true});const history=JSON.stringify(old.journal);const n=advanceMonth(old);assert.equal(n.economy.revision,24);assert.equal(JSON.stringify(n.journal.slice(0,1)),history);assert.deepEqual(replayJournal(n).metrics,n.metrics);
});
test('corrupt family land, identity and statistics assumptions are rejected on import',()=>{
 const s=advanceMonth(start());for(const change of [x=>x.livelihoods.landTotal=-1,x=>x.firmMarkets.markets.find(m=>m.sector===0).companies.find(c=>c.familyGroup!==undefined).familyGroup=99]){const data=JSON.parse(exportSimulation(s));change(data.state);assert.throws(()=>importSimulation(JSON.stringify(data)));}
});

test('a producer with no working labour cannot receive newly produced goods',()=>{
 let s=start();for(let i=0;i<14;i++){s=advanceMonth(s);for(const c of enterpriseBusinesses(s))if(c.familyGroup!==undefined&&c.workers===0)near(c.production,0);}
});
test('a weather shock reduces family physical output, without changing ownership or inventing plots',async()=>{
 const {scheduleShock}=await import('../src/engine.js');let s=start();for(let i=0;i<5;i++)s=advanceMonth(s);const b=structuredClone(s);scheduleShock(b,{key:'weather',multiplier:.3,start:b.month+1,duration:1});
 const a=advanceMonth(s),bad=advanceMonth(b),output=x=>sum(familyCompanies(x).filter(c=>c.sector===0).map(c=>c.production));assert.ok(output(bad)<output(a));near(bad.livelihoods.landTotal,a.livelihoods.landTotal);assert.ok(bad.metrics.auditError<1e-5);
});

test('facility capacity is a finite stock ratio and can exceed two while coverage remains bounded',()=>{
 const s=start();s.services.publicEducationCapacity=3;validateExtendedState(s);s.services.publicEducationCapacity=Infinity;assert.throws(()=>validateExtendedState(s));s.services.publicEducationCapacity=3;s.services.educationCoverage=1.01;assert.throws(()=>validateExtendedState(s));
});

test('land rent is charged exactly once per month and reconciles with landlord receipts',()=>{
 let s=start();for(let i=0;i<8;i++){s=advanceMonth(s);const rows=familyCompanies(s).filter(c=>c.sector===0&&c.active),paid=sum(rows.map(c=>c.lastLandRent??0));near(s.livelihoods.last.landRent,paid);const landlords=s.firmMarkets.markets.find(m=>m.sector===0).companies.filter(c=>c.familyGroup===undefined);near(sum(landlords.map(c=>c.landRentReceived??0)),paid);for(const c of rows)assert.ok((c.lastLandRent??0)<=(c.landRent??0)+1e-9);}
});

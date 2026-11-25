import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,accountBalances} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {groupBasket,basicNeeds} from '../src/household-consumption.js';
import {initializeHouseholdStructure,producerBasket} from '../src/household-structure.js';
import {initializeLaborDistribution,settleLaborDistribution,laborWageShares} from '../src/labor.js';
const sum=a=>a.reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=country=>createSimulation({...newGameOptions({country:country??'middle'}),politicalMode:false,defenseMode:false});
test('food spending stays distinct from agriculture VA and purchases reconcile across producer chains',()=>{
 const shares=[];
 for(const country of ['poor','middle','rich']){
  let s=start(country);assert.deepEqual(s.base.consumerBasket,s.economy.initial.consumptionWeights);assert.deepEqual(producerBasket(s.base.consumerBasket,s.base.foodChain),s.base.consumptionWeights);
  for(let i=0;i<12;i++)s=advanceMonth(s);
  const food=sum(s.householdEconomy.records.map(r=>r.categories.food)),consumption=sum(s.householdEconomy.records.map(r=>r.consumption));shares.push(food/consumption);
  near(consumption,s.lastReport.gdp.consumption);for(const r of s.householdEconomy.records){near(sum(Object.values(r.categories)),r.expenses);assert.ok(Object.values(r.categories).every(x=>x>=0));}
 }
 assert.ok(shares[0]>shares[1]&&shares[1]>shares[2]);assert.ok(shares[2]>.05&&shares[2]<.25);
});
test('absolute purchasing power, price increases and fixed needs have separate effects',()=>{
 const s=start(),prices=s.firms.map(f=>f.price),args=[s,0,s.base.consumptionWeights,prices,.2,1];
 const foodShare=w=>sum(w.map((x,j)=>x*w.foodFractions[j]));
 const old=groupBasket(...args),needs=basicNeeds(s,0,prices,1,.2);
 for(const h of s.households)h.income*=2;
 assert.ok(foodShare(groupBasket(...args))<foodShare(old),'richer whole economy must change food preferences even if ranks unchanged');near(basicNeeds(s,0,prices,1,.2).food,needs.food);
 const before=groupBasket(...args);const foreign=groupBasket(s,0,s.base.consumptionWeights,prices,.2,2);assert.notDeepEqual(foreign,before);assert.ok(basicNeeds(s,0,prices,2,.2).cost>needs.cost);
});
test('worker allocations conserve supplies and job totals, while payroll responds to skills and sector jobs',()=>{
 const s=start();settleLaborDistribution(s);const d=s.laborDistribution;
 for(const [i,r] of d.sectors.entries()){near(sum(r.workers),s.firms[i].workers);near(sum(r.wageShares),1);}
 for(const g of d.groups)near(g.employed+g.unemployed,g.laborForce);
 const old=s.firms.map(f=>laborWageShares(s,f,s.households)),cash=accountBalances(s),gdp=s.metrics.realGDPMonthly;
 s.laborDistribution.schooling[0]+=3;settleLaborDistribution(s);assert.notDeepEqual(s.firms.map(f=>laborWageShares(s,f,s.households)),old);assert.deepEqual(accountBalances(s),cash);near(s.metrics.realGDPMonthly,gdp);
 const base=s.laborDistribution.groups.map(g=>g.grossPayroll);const n=s.firms[0].workers*.2;s.firms[0].workers-=n;s.firms[4].workers+=n;settleLaborDistribution(s);assert.notDeepEqual(s.laborDistribution.groups.map(g=>g.grossPayroll),base);
 near(sum(s.laborDistribution.groups.map(g=>g.grossPayroll)),sum(s.firms.map(f=>f.workers*f.wage)));
});
test('bargaining compresses within-sector schooling pay differences without giving away money',()=>{
 const s=start(),f=s.firms[2];f.labor.coverage=0;let shares=laborWageShares(s,f,s.households),jobs=s.laborDistribution.sectors[2].workers;const a=(shares[9]/jobs[9])/(shares[0]/jobs[0]);
 f.labor.coverage=.9;shares=laborWageShares(s,f,s.households);jobs=s.laborDistribution.sectors[2].workers;const b=(shares[9]/jobs[9])/(shares[0]/jobs[0]);assert.ok(b<a);near(sum(shares),1);
});
test('activation preserves accounts, old journals and fixed reference baskets; JSON continuation replays',()=>{
 let old=createSimulation({...newGameOptions(),economicRevision:18,politicalMode:false,defenseMode:false});old=advanceMonth(old,old.policy,{preserveEconomicRevision:true});
 const history=JSON.stringify(old.journal),references=structuredClone(old.householdEconomy.reference),accounts=accountBalances(old),copy=structuredClone(old);copy.economy.revision=19;initializeHouseholdStructure(copy);initializeLaborDistribution(copy);settleLaborDistribution(copy);assert.deepEqual(accountBalances(copy),accounts);assert.deepEqual(copy.householdEconomy.reference,references);
 let s=advanceMonth(old);assert.equal(s.economy.revision,24);assert.equal(JSON.stringify(s.journal.slice(0,1)),history);for(let i=0;i<12;i++)s=advanceMonth(s);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded),advanceMonth(s));const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.laborDistribution,s.laborDistribution);assert.deepEqual(replay.householdStructure,s.householdStructure);
 for(const breakIt of [x=>x.laborDistribution.schooling[0]=-1,x=>x.householdStructure.foodChain[0]=2,x=>x.laborDistribution.sectors[0].wageShares[0]=2]){const x=JSON.parse(exportSimulation(s));breakIt(x.state);assert.throws(()=>importSimulation(JSON.stringify(x)));}
});

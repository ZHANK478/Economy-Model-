import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,copy,inputMatrix,accountBalances,exportSimulation,importSimulation,replayJournal,scheduleShock} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {initializeProductMarkets,productCapacityFactor,prepareProductMarkets} from '../src/product-markets.js';
import {initializeServiceIndustries,serviceDemandWeights,serviceInputMatrix,serviceTechnologyFactor,planServiceInvestment,completeServiceCapital,validateServiceIndustries} from '../src/service-industries.js';
import {OPEN_INPUTS} from '../src/open-economy.js';
const sum=a=>a.reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=()=>createSimulation({...newGameOptions(),politicalMode:false,defenseMode:false});
test('service detail partitions existing capital and labour without extra bank money or opening capacity bonus',()=>{
 const s=start();assert.equal(s.productMarkets.products.length,17);assert.equal(s.serviceIndustries.branches.length,8);near(sum(s.serviceIndustries.branches.map(c=>c.capital)),s.firms[4].capital);near(sum(s.serviceIndustries.branches.map(c=>c.workers)),s.firms[4].workers);near(serviceTechnologyFactor(s,s.firms[4].workers),1);near(productCapacityFactor(s,4),1);
 const legacy=createSimulation({...newGameOptions(),economicRevision:17,politicalMode:false,defenseMode:false}),before=copy(accountBalances(legacy)),K=legacy.firms[4].capital,inventory=legacy.firms[4].inventory;legacy.economy.revision=18;initializeProductMarkets(legacy);initializeServiceIndustries(legacy,OPEN_INPUTS);assert.deepEqual(accountBalances(legacy),before);near(sum(legacy.serviceIndustries.branches.map(c=>c.capital)),K);near(sum(legacy.productMarkets.products.filter(c=>c.sector===4).map(c=>c.inventory)),inventory);for(let i=0;i<5;i++)near(inputMatrix(legacy)[i][4],OPEN_INPUTS[i][4]);
});
test('investment, consumer spending and credit produce different demand across service industries',()=>{
 const s=start(),rows=s.productMarkets.products.filter(p=>p.sector===4),before=serviceDemandWeights(s,rows),i=copy(s);i.lastReport.market={...i.lastReport.market,requestedInvestment:s.base.investment*3};const after=serviceDemandWeights(i,rows),idx=id=>rows.findIndex(p=>p.id===id);
 assert.ok(after[idx('business')]/before[idx('business')]>after[idx('personal')]/before[idx('personal')]);
 const credit=copy(s);credit.metrics.credit*=3;const cq=serviceDemandWeights(credit,rows);assert.ok(cq[idx('financial')]>before[idx('financial')]);near(cq[idx('personal')],before[idx('personal')]);
});
test('service composition changes real intermediate purchases; transport and digital inputs differ',()=>{
 const s=start(),transport=s.serviceIndustries.branches.find(c=>c.id==='transport'),digital=s.serviceIndustries.branches.find(c=>c.id==='digital');assert.ok(transport.inputs[1]>digital.inputs[1]);const old=inputMatrix(s)[1][4];
 const rows=s.productMarkets.products.filter(p=>p.sector===4);for(const p of rows)p.demandShare=p.id==='transport'?.65:.35/7;
 assert.ok(serviceInputMatrix(s,OPEN_INPUTS)[1][4]>old);
});
test('paid service investment stays earmarked and does not become fungible capital on completion',()=>{
 const s=start(),rows=s.serviceIndustries.branches;const chosen=rows.find(c=>c.id==='digital'),old=chosen.capital,other=rows.find(c=>c.id==='transport').capital,total=s.firms[4].capital;
 s.firms[4].capital+=100;completeServiceCapital(s,100,{serviceIds:['digital'],serviceShares:[1]});near(chosen.capital,old+100);near(rows.find(c=>c.id==='transport').capital,other);near(s.firms[4].capital,total+100);validateServiceIndustries(s);
 chosen.last={operatingProfit:100,revenue:100};planServiceInvestment(s,200);near(sum(rows.map(c=>c.fundedInvestment)),200);
});
test('operating outputs, actual flows and value added reconcile with the consolidated service account',()=>{
 let s=start();for(let i=0;i<36;i++)s=advanceMonth(s);const rows=s.serviceIndustries.last.branches,p=s.productMarkets.products.filter(p=>p.sector===4);
 near(sum(rows.map(c=>c.capital)),s.firms[4].capital);near(sum(rows.map(c=>c.workers)),s.firms[4].workers);near(sum(rows.map(c=>c.production)),s.lastReport.market.production[4]);near(sum(rows.map(c=>c.revenue)),s.firms[4].lastRevenue);near(sum(rows.map(c=>c.valueAdded)),s.lastReport.gdp.sectorValueAdded[4]);near(sum(rows.map(c=>c.paidInvestment)),s.firms[4].lastInvestment);near(sum(p.map(c=>c.inventory)),s.firms[4].inventory);
 for(const [i,row] of rows.entries())near(row.valueAdded,s.lastReport.products.find(p=>p.id===row.id).valueAdded);
 assert.ok(s.projects.filter(p=>p.sector===4&&p.type==='private').every(p=>p.serviceIds.length===8&&p.serviceShares.length===8));
 const financial=rows.find(c=>c.id==='financial');assert.ok(financial.revenue<s.metrics.credit);validateServiceIndustries(s);
});
test('energy shock differentiates transport from low energy services without creating money',()=>{
 let s=start();scheduleShock(s,{key:'energyPrice',multiplier:2,start:1,duration:3});for(let i=0;i<3;i++)s=advanceMonth(s);const p=s.productMarkets.products,price=id=>p.find(p=>p.id===id).price;
 assert.ok(price('transport')>price('financial'));assert.ok(Object.values(s.lastReport.audit).every(Number.isFinite));
});
test('old journals remain immutable, JSON continuation and upgraded history replay exactly',()=>{
 let s=createSimulation({...newGameOptions(),economicRevision:17,politicalMode:false,defenseMode:false});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});const old=JSON.stringify(s.journal);for(let i=0;i<8;i++)s=advanceMonth(s);assert.equal(JSON.stringify(s.journal.slice(0,1)),old);assert.equal(s.economy.revision,24);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.serviceIndustries,s.serviceIndustries);assert.deepEqual(advanceMonth(loaded),advanceMonth(s));const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.serviceIndustries,s.serviceIndustries);assert.deepEqual(replay.productMarkets,s.productMarkets);
 const bad=JSON.parse(exportSimulation(s));bad.state.serviceIndustries.branches[0].capital+=100;assert.throws(()=>importSimulation(JSON.stringify(bad)),/услуг/);
});

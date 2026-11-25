import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,accountBalances,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {initializeRentSeeking,prepareRentSeeking,settleRentSeeking,rentConditions,validateRentSeeking} from '../src/rent-seeking.js';
import {initializeDurables,prepareDurables,planDurableConsumption,settleDurables,retireConsumerCredit,serviceConsumerCredit,validateDurables} from '../src/durable-goods.js';
import {prepareOwners,validateOwners} from '../src/wealth-owners.js';
import {validateExtendedState} from '../src/state-validation.js';
const sum=a=>a.reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=(country='middle',extra={})=>createSimulation({...newGameOptions({country,resource:false}),politicalMode:false,defenseMode:false,...extra});
const cash=s=>sum(s.households.map(h=>h.cash))+sum(s.firms.map(f=>f.cash))+s.government.cash;
function source(s){return {income:s.households.map(h=>h.income),sources:s.households.map(h=>({labor:h.income,capital:0,transfers:0,remittances:0}))};}
function rents(s,orders=s.firms.map(f=>Math.max(0,f.lastRevenue))){const flow={soeAudits:s.base.monthlyGDP*.025/100,courts:s.base.monthlyGDP*.08/100},a=source(s);settleRentSeeking(s,flow,orders,a.income,a.sources,[]);return {flow,...a};}
function rentFixture(){for(let seed=1;seed<200;seed++){const s=start();s.seed=seed;s.policy.openProcurement=false;s.policy.independentSoeAudit=false;s.politics.civilService=0;s.policy.patronageBudget=2;prepareRentSeeking(s);if(rents(s).sources.some(x=>x.rents>0))return s;}throw Error('No transfer fixture');}
test('activation imputes existing consumer stocks and records no fictional prior corruption or money',()=>{
 const s=start('middle',{economicRevision:21}),money=accountBalances(s),K=s.firms.map(f=>f.capital),gdp=s.metrics.realGDPMonthly;s.economy.revision=22;initializeDurables(s);initializeRentSeeking(s);assert.deepEqual(accountBalances(s),money);assert.deepEqual(s.firms.map(f=>f.capital),K);near(s.metrics.realGDPMonthly,gdp);assert.equal(s.rentSeeking.cases.length,0);assert.ok(s.durableGoods.initialStockImputed);validateDurables(s);validateRentSeeking(s);
});
test('rents are paid by identified firms to identified existing family accounts, with no GDP posting',()=>{
 const s=rentFixture();prepareOwners(s);prepareRentSeeking(s);const before=cash(s),gdp=s.metrics.realGDPMonthly,out=rents(s);near(cash(s),before);near(s.metrics.realGDPMonthly,gdp);near(sum(out.sources.map(x=>x.rents)),s.rentSeeking.last.rents);for(const c of s.rentSeeking.last.operations){assert.ok(c.paid>0&&c.paid<=c.exposure*.025+1e-8);assert.ok(c.company);assert.ok(c.recipient>=4);}validateRentSeeking(s);validateOwners(s);
});
test('funded audits discover existing cases, courts recover only available recipient money',()=>{
 const s=rentFixture(),d=s.rentSeeking,c=d.cases[0];d.assumptions.auditBase=1;d.assumptions.auditIntensity=0;s.institutions.courtCapacity=1;s.politics.judicialIndependence=1;s.policy.independentSoeAudit=true;s.institutions.soeAuditCapacity=1;
 s.month++;prepareRentSeeking(s);rents(s,s.firms.map(()=>0));assert.equal(c.status,'investigating');const before=cash(s),treasury=s.government.cash;s.month+=d.assumptions.caseDelayMonths;prepareRentSeeking(s);const out=rents(s,s.firms.map(()=>0));assert.equal(c.status,'adjudicated');near(cash(s),before);near(s.government.cash-treasury,out.flow.integrityReceipts);assert.ok(c.recovered<=c.paid);validateOwners(s);
});
test('audit institutions affect incentives without assuming more detected cases mean more underlying rent risk',()=>{
 const s=start();s.policy.independentSoeAudit=false;const risk=rentConditions(s).risk;s.policy.independentSoeAudit=true;s.institutions.soeAuditCapacity=1;s.institutions.courtCapacity=1;s.politics.judicialIndependence=1;s.policy.publicDisclosure=true;assert.ok(rentConditions(s).risk<risk);
});
test('no-money permit refusal delays paid capital, with no destruction or duplicate payment',()=>{
 let found=false;for(let seed=1;seed<100&&!found;seed++){const s=start();s.seed=seed;s.policy.independentSoeAudit=false;s.politics.civilService=0;s.policy.patronageBudget=2;s.policy.registrationProcedures=12;prepareRentSeeking(s);const c=s.firmMarkets.markets[0].companies[0];c.cash=0;s.rentSeeking.connections[c.id].connected=false;s.projects=[{type:'private',sector:3,amount:100,createdMonth:s.month,due:6,firmIds:[c.id],firmShares:[1]}];const before=cash(s);rents(s,s.firms.map(()=>0));if(s.rentSeeking.last.permitDelays){found=true;near(s.projects[0].amount,100);assert.equal(s.projects[0].due,8);near(cash(s),before);assert.equal(s.rentSeeking.last.permitDecisions[0].paid,0);}}assert.ok(found);
});
function durableFixture(){const s=start();prepareDurables(s);for(const g of s.durableGoods.groups){g.cohorts=[];g.referenceServices=[100,100,100];}const seller=s.durableGoods.groups[9];seller.referenceServices=[1,1,1];seller.cohorts=[{id:s.durableGoods.nextCohort++,type:'appliances',quantity:1000,broken:10,quality:1,life:144,age:70,repairCount:0}];
 const budgets=s.households.map(()=>100),baskets=s.households.map(()=>[.2,.1,.5,0,.2]),food=s.households.map(()=>[1,0,0,0,0]),units=s.households.map(()=>1),services=s.households.map(()=>({total:0}));planDurableConsumption(s,budgets,baskets,food,units,services,[1,1,1,1,1],[1,1,1,1,1],0,s.households.map(()=>0));return {s,budgets,baskets,food,units,services};}
test('wear changes physical service stock, not deposits, production or GDP',()=>{
 const s=start(),before=cash(s),gdp=s.metrics.realGDPMonthly,stock=sum(s.durableGoods.groups.flatMap(g=>g.cohorts).map(c=>c.quantity));prepareDurables(s);assert.ok(sum(s.durableGoods.groups.flatMap(g=>g.cohorts).map(c=>c.quantity))<stock);near(cash(s),before);near(s.metrics.realGDPMonthly,gdp);
});
test('used trade transfers existing goods and deposits; brokerage is already reserved as service demand',()=>{
 const {s,services}=durableFixture(),before=cash(s),gdp=s.metrics.realGDPMonthly;assert.ok(s.durableGoods.last.trades.length>0);const plannedFees=sum(s.durableGoods.last.trades.map(t=>t.broker));near(sum(services.map(p=>p.durableBroker??0)),plannedFees);const sold=sum(s.durableGoods.last.trades.filter(t=>t.type==='appliances').map(t=>t.quantity));assert.ok(sold<=1000*.02+1e-8);settleDurables(s,1);near(cash(s),before);near(s.metrics.realGDPMonthly,gdp);assert.ok(s.durableGoods.last.usedPayments>0);assert.ok(s.durableGoods.groups.some(g=>g.cohorts.some(c=>c.age===70&&c.type==='appliances')));near(sum(s.durableGoods.groups.map(g=>g.last.usedPaid)),sum(s.durableGoods.groups.map(g=>g.last.usedReceived)));validateDurables(s);
});
test('unfulfilled repair and purchase orders cannot create working equipment, income or credit',()=>{
 const {s}=durableFixture(),cohorts=JSON.stringify(s.durableGoods.groups.map(g=>g.cohorts)),before=cash(s);settleDurables(s,0);near(cash(s),before);assert.equal(s.durableGoods.last.newSpending,0);assert.equal(s.durableGoods.last.repairSpending,0);assert.equal(s.durableGoods.last.usedPayments,0);assert.equal(JSON.stringify(s.durableGoods.groups.map(g=>g.cohorts)),cohorts);
});
test('uncovered basic needs leave no money for new consumer equipment or repairs',()=>{
 const s=start();prepareDurables(s);for(const g of s.durableGoods.groups)g.cohorts=[];const budgets=s.households.map(()=>10),baskets=s.households.map(()=>[.5,.1,.2,0,.2]),food=s.households.map(()=>[1,0,0,0,0]),units=s.households.map(()=>1),services=s.households.map(()=>({total:0}));for(const h of s.households)h.cash=0;
 planDurableConsumption(s,budgets,baskets,food,units,services,[1,1,1,1,1],1,0,s.households.map(()=>10));assert.ok(s.durableGoods.plans.every(p=>p.newVolume===0&&p.repairs.length===0&&p.usedReserved===0));
});
test('consumer principal is a subset of actual bank debt; amortization and losses never create second liabilities',()=>{
 const s=start(),h=s.households[0],ledger=s.durableGoods.credit[0];h.loanLC=100;h.loanFX=0;ledger.loans=[{id:1,principal:60,installment:10,issuedMonth:0,maturity:6,arrears:0}];const before=cash(s);h.income=100;h.cash=100;h.interestPaid=0;serviceConsumerCredit(s,(_,actor,n)=>{const value=Math.min(n,actor.loanLC,actor.cash);actor.loanLC-=value;actor.cash-=value;retireConsumerCredit(s,actor,value);return value;});near(h.loanLC,90);near(ledger.loans[0].principal,50);h.loanLC-=9;retireConsumerCredit(s,h,9,'writeOff');near(ledger.loans[0].principal,45);validateDurables(s);
});
test('poor, middle and rich ledgers reconcile and preserve new states in JSON and exact replay',()=>{
 for(const country of ['poor','middle','rich']){let s=start(country);for(let i=0;i<18;i++){s=advanceMonth(s);validateExtendedState(s);near(sum(s.householdEconomy.records.map(r=>r.consumption)),s.lastReport.gdp.consumption);assert.ok(s.metrics.auditError<1e-5);}const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded),advanceMonth(s));assert.deepEqual(replayJournal(s).metrics,s.metrics);assert.ok(s.lastReport.durables);assert.ok(s.lastReport.integrity);}
});
test('historical journals remain unchanged and migrate only at the month boundary',()=>{
 let s=start('middle',{economicRevision:21});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});assert.equal(s.durableGoods,undefined);const journal=JSON.stringify(s.journal);s=advanceMonth(s);assert.equal(s.economy.revision,24);assert.equal(JSON.stringify(s.journal.slice(0,1)),journal);assert.deepEqual(replayJournal(s).metrics,s.metrics);
 for(const mutate of [x=>x.durableGoods.groups[0].cohorts[0].quantity=-1,x=>x.rentSeeking.totals.rents=-1]){const data=JSON.parse(exportSimulation(s));mutate(data.state);assert.throws(()=>importSimulation(JSON.stringify(data)));}
});
test('unfunded checks cannot discover cases even when technical detection probability is one',()=>{
 const s=rentFixture(),c=s.rentSeeking.cases[0];s.rentSeeking.assumptions.auditBase=1;s.rentSeeking.assumptions.auditIntensity=0;s.month++;prepareRentSeeking(s);const a=source(s);settleRentSeeking(s,{soeAudits:0,courts:0},s.firms.map(()=>0),a.income,a.sources,[]);assert.equal(c.status,'unobserved');assert.equal(s.rentSeeking.last.auditSlots,0);
});
test('a quiet durable purchase month cannot recursively contract ordinary consumption preferences',async()=>{
 const {macroConsumption}=await import('../src/macro-core.js');const s=start(),h=s.households[4];s.durableGoods.groups[4].macroConsumptionVolume=100;const a=macroConsumption(s,h,4,.05,1);h.consumption=0;const b=macroConsumption(s,h,4,.05,1);near(a.smoothed,b.smoothed);near(a.desired,b.desired);
});

test('adjudication survives the agriculture account migration and a removed defendant',()=>{
 for(const company of ['agriculture','removed-company']){
  const s=start();s.month=2;prepareOwners(s);prepareRentSeeking(s);s.institutions.courtCapacity=1;s.politics.judicialIndependence=1;
  s.rentSeeking.cases.push({id:s.rentSeeking.nextCase++,month:0,company,recipient:4,kind:'procurement-kickback',exposure:10,paid:1,status:'investigating',detectedMonth:1,due:2,recovered:0,finePaid:0});
  const money=cash(s);rents(s,s.firms.map(()=>0));const c=s.rentSeeking.cases.at(-1);assert.equal(c.status,'adjudicated');assert.equal(c.company,company);near(cash(s),money);
  const successor=s.firmMarkets.markets.find(m=>m.sector===0).companies.find(c=>c.agricultureProtectionClaim);assert.equal(s.rentSeeking.connections[company==='agriculture'?successor.id:company].sanctionUntil,2+s.rentSeeking.assumptions.deterrenceMonths);validateRentSeeking(s);
 }
});

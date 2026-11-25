import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,scheduleShock,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {prepareAgriculture,foodReplacementUnit,agricultureForecast,finishAgriculture} from '../src/agriculture.js';
import {worldEvent} from '../src/world-events.js';
import {newspaperCandidates,updateNewspaper} from '../src/newspaper.js';
const initial=(country='middle',extra={})=>createSimulation({...newGameOptions({country,resource:false}),politicalMode:false,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('protection is finite and delayed; funding goes through actual budget purchases',()=>{
 let s=initial(),base=structuredClone(s);s.policy.agricultureProtection=1;
 s=advanceMonth(s);base=advanceMonth(base);
 assert.equal(s.agriculture.publicStock,0);assert.ok(s.lastReport.fiscal.agricultureProtection>0);
 assert.ok(s.lastReport.calculationTrace.budgetPlan.requestedPurchases>base.lastReport.calculationTrace.budgetPlan.requestedPurchases);
 assert.ok(s.projects.some(p=>p.type==='agriculture'));
 for(let i=0;i<12;i++)s=advanceMonth(s);
 assert.ok(s.agriculture.publicStock>0);
 const unprotected=structuredClone(s),protectedState=structuredClone(s);
 unprotected.agriculture.publicStock=0;unprotected.agriculture.privateStock=0;
 const low=prepareAgriculture(unprotected,{weather:80,importAvailability:100}),high=prepareAgriculture(protectedState,{weather:80,importAvailability:100});
 assert.equal(low.weather,.8);assert.ok(high.weather>.8&&high.weather<1);assert.ok(high.protection<.65);
});
test('food substitution changes only domestic food and pays the import price including duty',()=>{
 near(foodReplacementUnit([.4,.1,.2,.1,.2],.2,[2,1,1,1,1],3,10,.5),.8*(.4*(1+1.65)+.6)+.2*3.3);
 let s=initial('poor');scheduleShock(s,{key:'weather',multiplier:.8,start:3,duration:12});
 for(let i=0;i<20;i++){
  const prev=s;s=advanceMonth(s);
  assert.ok(s.metrics.auditError<1e-5);
  const a=s.lastReport.agriculture;
  if(i>4&&i<12)assert.ok(a.foodImports>0);
  near(s.firms[0].inventory,prev.firms[0].inventory-a.spoilage+s.lastReport.market.inventoryChange[0]);
  for(const r of s.householdEconomy.records)near(Object.values(r.categories).reduce((a,b)=>a+b,0),r.expenses);
  const ex=s.lastReport.market.externalConstraint,m=s.lastReport.market;
  const need=m.production.reduce((v,q,i)=>v+q*ex.intermediateUnitUSD[i],0)+m.fulfillment*ex.finalImportsUSD-s.lastReport.external.exportsUSD;
  assert.ok(need<=ex.availableUSD+1e-5);
 }
 const restored=importSimulation(exportSimulation(s));assert.deepEqual(replayJournal(restored).metrics,s.metrics);assert.deepEqual(replayJournal(restored).agriculture,s.agriculture);
 restored.agriculture.publicStock=-1;assert.throws(()=>importSimulation(exportSimulation(restored)));
});
test('forecast arrives before impact, sometimes misses or raises a false alarm, and does not spam',()=>{
 let detected=0,missed=0,falseAlarms=0;
 for(let seed=1;seed<150;seed++){
  const s=initial('middle',{seed});s.politics.livingWorld=true;s.politics.livingWorldStart=0;
  for(let month=1;month<30;month++){
   s.month=month;const f=agricultureForecast(s);
   if(!f)continue;
   assert.ok(f.start>month&&f.start-month<=3);
   s.agriculture={forecast:f};s.history=[];s.metrics={};s.lastReport={fiscal:{}};
   const issue=newspaperCandidates(s).find(x=>x.key==='harvest-risk');
   if(month>=2){assert.equal(issue.id,f.id);const press={};assert.equal(updateNewspaper(s,press)?.key,'harvest-risk');press.pending=false;assert.equal(updateNewspaper(s,press),null);}
   const event=worldEvent({...s,month:f.start});if(event?.key==='weather'&&event.multiplier<1)detected++;else falseAlarms++;break;
  }
 }
 assert.ok(detected>0&&falseAlarms>0);
});
test('revision 11 history remains replayable and upgrades only at the next month',()=>{
 let s=initial('middle',{economicRevision:11});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});
 assert.equal(s.agriculture,undefined);const old=JSON.stringify(s.journal);s=advanceMonth(s);
 assert.equal(s.economy.revision,24);assert.equal(JSON.stringify(s.journal.slice(0,1)),old);
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).agriculture,s.agriculture);
});

test('private adaptation earmarks existing funded investment and never retags old projects',()=>{
 const s=initial();prepareAgriculture(s,{weather:80,importAvailability:100});
 s.agriculture.expectedLoss=.9;s.firms[0].lastProfit=1e5;s.firms[0].lastRevenue=1e5;
 const old={type:'private',sector:0,amount:10,due:10};
 const current={type:'private',sector:0,amount:10,due:10,createdMonth:s.month};
 s.projects=[old,current];const before=s.firms[0].cash;
 finishAgriculture(s,{paid:0,unit:1,investmentPrice:1,privateInvestment:10});
 assert.ok(current.agricultureShare>0&&current.agricultureShare<=.3);assert.equal(old.agricultureShare,undefined);assert.equal(current.amount,10);assert.equal(s.firms[0].cash,before);
});

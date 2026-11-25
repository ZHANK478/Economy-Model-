import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {basicNeeds,groupBasket,consumptionGroups,referenceValue,EXPENSE_CATEGORIES} from '../src/household-consumption.js';
import {consumptionPanel,citizenFigure} from '../src/consumption-ui.js';
const sum=a=>a.reduce((x,y)=>x+y,0),near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=country=>createSimulation({...newGameOptions({country:country??'middle'}),politicalMode:false,defenseMode:false});
test('all household purchases reconcile with sector GDP and five population budgets',()=>{
 let s=start();for(let i=0;i<18;i++){
  s=advanceMonth(s);const rows=s.householdEconomy.records,groups=consumptionGroups(s);
  near(sum(rows.map(r=>r.consumption)),s.lastReport.gdp.consumption);
  near(sum(groups.map(r=>r.income*r.population)),sum(s.households.map(h=>h.income)));
  near(sum(groups.map(r=>(r.expenses-r.interest-(r.categories?.insurance??0))*r.population))+sum(s.social?.last.healthReimbursement??[]),s.lastReport.gdp.consumption);
  for(const r of rows){near(sum(Object.values(r.categories)),r.expenses);near(sum(Object.values(r.sources)),r.income);near(r.balance,r.income-r.expenses);near(r.cashChange,r.balance+r.otherCashFlows);}
  assert.ok(s.metrics.auditError<1e-5);
 }
});
test('lower income households devote a greater share to food and the demand baskets reach actual firms',()=>{
 let s=start();s=advanceMonth(s);const rows=s.householdEconomy.records;
 assert.ok(rows[0].categories.food/rows[0].consumption>rows[9].categories.food/rows[9].consumption);
 const prices=s.firms.map(f=>f.price),base=s.base.consumptionWeights;
 const low=groupBasket(s,0,base,prices,.2,1),high=groupBasket(s,9,base,prices,.2,1);
 assert.ok(low[0]>high[0]);near(sum(low),1);near(sum(high),1);
 const a=structuredClone(s),b=structuredClone(s);b.householdStructure.assumptions.foodEngelElasticity=-.8;
 const x=advanceMonth(a),y=advanceMonth(b);assert.notEqual(x.lastReport.market.production[0],y.lastReport.market.production[0]);
});
test('a basic basket is independent of current poverty spending and reacts to prices and public provision',()=>{
 const s=start(),prices=[1,1,1,1,1],before=basicNeeds(s,0,prices,1,.2);
 s.households[0].income=0;s.households[0].cash=0;s.households[0].consumption=0;
 near(basicNeeds(s,0,prices,1,.2).cost,before.cost);
 assert.ok(basicNeeds(s,0,[2,1,1,1,1],1,.2).cost>before.cost);
 s.services.publicHealthDelivered=1;s.services.publicEducationDelivered=1;const free=basicNeeds(s,0,prices,1,.2);
 s.services.publicHealthDelivered=0;s.services.publicEducationDelivered=0;assert.ok(basicNeeds(s,0,prices,1,.2).cost>free.cost);
});
test('cutting purchases does not rebase the habitual basket or conceal inflation',()=>{
 let s=advanceMonth(start());const fixed=structuredClone(s.householdEconomy.reference[0]),cost=referenceValue(s,fixed,[1,1,1,1,1],1);
 s.households[0].consumption=0;s.households[0].income=0;
 assert.deepEqual(s.householdEconomy.reference[0],fixed);
 assert.ok(referenceValue(s,fixed,[2,1,1,1,1],1)>cost);
});
test('the first-month VAT change remains visible in the fixed basket price index',()=>{
 const s=start(),p={...s.policy,vat:s.policy.vat+10};const next=advanceMonth(s,p);
 assert.ok(next.householdEconomy.records.every(r=>r.priceIndex>100));
});
test('legacy household totals can be shown without inventing detailed old categories',()=>{
 let s=createSimulation({...newGameOptions(),economicRevision:7,politicalMode:false});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});
 const groups=consumptionGroups(s);assert.ok(groups.every(g=>g.expenses!==null&&g.categories===null));
 near(sum(groups.map(g=>(g.expenses-g.interest)*g.population)),s.lastReport.gdp.consumption);
 const past=JSON.stringify(s.journal);s=advanceMonth(s);assert.equal(s.economy.revision,24);assert.equal(JSON.stringify(s.journal.slice(0,1)),past);assert.ok(s.householdEconomy.records.length===10);
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).metrics,s.metrics);
});
test('income grouping follows current incomes and does not truncate negative balances',()=>{
 let s=advanceMonth(start());const rows=s.householdEconomy.records;
 rows[0].income=rows[9].income*2;rows[0].balance=-100;rows[0].expenses=rows[0].income+100;
 const groups=consumptionGroups(s);assert.ok(groups[4].groups.includes(0));assert.ok(groups[4].balance<0);
});
test('all country presets retain monetary identities over five years with different baskets',()=>{
 for(const country of ['poor','middle','rich']){
  let s=start(country);for(let i=0;i<60;i++){s=advanceMonth(s);assert.ok(s.metrics.auditError<Math.max(1e-4,s.metrics.nominalGDPMonthly*1e-8));}
  const replay=replayJournal(importSimulation(exportSimulation(s)));assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.householdEconomy.records,s.householdEconomy.records);
 }
});
test('consumption display contains five accessible controls and full-height native figures without tables',()=>{
 const s=advanceMonth(start());const ui=consumptionPanel(s,{open:true,selected:2,n:String,esc:String});
 assert.equal((ui.match(/data-income-group=/g)??[]).length,5);assert.ok(ui.includes('Доход после налогов'));assert.ok(ui.includes('На человека'));assert.ok(!ui.includes('<table'));
 assert.equal(new Set(Array.from({length:5},(_,i)=>citizenFigure(i))).size,5);
 assert.equal(EXPENSE_CATEGORIES.length,8);
});

test('consumption view uses each group scale and shows spending shares and modeled range',async()=>{
 const {consumptionContent}=await import('../src/consumption-ui.js');
 let s=createSimulation({...newGameOptions({country:'middle'}),politicalMode:false});s=advanceMonth(s);
 const html=consumptionContent(s,0,{n:(v,d)=>Number(v).toFixed(d),esc:String});
 assert.match(html,/Доля расходов/);assert.match(html,/Доходы внутри группы · оценка/);
 assert.match(html,/От 10-го до 90-го процентиля/);
 assert.match(html,/citizen-expense-row[\s\S]*?\d+%/);
 const widths=[...html.matchAll(/citizen-money-track"><i style="width:([\d.]+)%/g)].map(x=>Number(x[1]));
 near(Math.max(...widths),100);
});

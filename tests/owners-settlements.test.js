import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,accountBalances,exportSimulation,importSimulation,replayJournal,scheduleOwnership} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {initializeOwners,ownerBusinesses,ownerBookValue,ownerEquityByGroup,ownerWealthPoints,synchronizeOwnerClaims,inheritOwner,validateOwners} from '../src/wealth-owners.js';
import {initializeSettlements,prepareSettlements,residenceRents,reserveRelocation,validateSettlements} from '../src/settlements.js';
import {settleLaborDistribution} from '../src/labor.js';
import {socialIndicators} from '../src/indicators.js';
const sum=a=>a.reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=(country='middle',extra={})=>createSimulation({...newGameOptions({country,resource:false}),politicalMode:false,defenseMode:false,...extra});
test('activation partitions deposits and company claims without creating money, output or capital',()=>{
 const s=start('middle',{economicRevision:19}),money=accountBalances(s),gdp=s.metrics.realGDPMonthly,K=s.firms.map(f=>f.capital);s.economy.revision=20;initializeSettlements(s);initializeOwners(s);synchronizeOwnerClaims(s);validateOwners(s);validateSettlements(s);
 assert.deepEqual(accountBalances(s),money);near(s.metrics.realGDPMonthly,gdp);assert.deepEqual(s.firms.map(f=>f.capital),K);
 for(let i=0;i<10;i++){const cells=s.wealthOwners.families.filter(r=>r.group===i);near(sum(cells.map(r=>r.cash)),s.households[i].cash);near(sum(cells.map(r=>r.population)),1);}
 const wealth=s.households.map((h,i)=>h.cash+ownerEquityByGroup(s)[i]);near(sum(ownerWealthPoints(s,wealth).map(p=>p.amount)),sum(wealth));
});
test('inheritance transfers existing claims and deposits and keeps company operations unchanged',()=>{
 const s=start(),before=accountBalances(s),K=s.firms.map(f=>f.capital),gdp=s.metrics.realGDPMonthly,family=s.wealthOwners.families.find(r=>r.kind==='owner'),cash=family.cash,old={...family.stakes};inheritOwner(s,family.id);validateOwners(s);
 assert.equal(family.generation,2);near(family.cash,cash*.6);for(const [id,share] of Object.entries(old))near(family.stakes[id],share*.6);
 assert.deepEqual(accountBalances(s),before);assert.deepEqual(s.firms.map(f=>f.capital),K);near(s.metrics.realGDPMonthly,gdp);
});
test('book revaluation is wealth rather than GDP; insolvent company claims are worthless',()=>{
 const s=start(),c=s.enterpriseMarket.companies[0],before=ownerEquityByGroup(s),money=accountBalances(s),gdp=s.metrics.realGDPMonthly;c.capital*=2;
 assert.ok(sum(ownerEquityByGroup(s))>sum(before));assert.deepEqual(accountBalances(s),money);near(s.metrics.realGDPMonthly,gdp);
 c.active=false;near(ownerBookValue(s,c),0);assert.ok(ownerBookValue(s,s.enterpriseMarket.companies[1])>0);
});
test('paid privatization, purchases and foreign dilution preserve the family sub-ledger',()=>{
 let s=start();scheduleOwnership(s,{sector:4,kind:'privatize',points:2});s=advanceMonth(s);validateOwners(s);assert.ok(s.wealthOwners.last.subscriptions.some(x=>x.kind==='privatize'&&x.paid>0));
 scheduleOwnership(s,{sector:4,kind:'purchase',points:1});s=advanceMonth(s);validateOwners(s);assert.deepEqual(advanceMonth(importSimulation(exportSimulation(s))),advanceMonth(s));assert.deepEqual(replayJournal(s).wealthOwners,s.wealthOwners);
});
test('city and countryside start from recorded observations but have economic sorting and different housing costs',()=>{
 for(const [country,share] of [['poor',.233145114975244],['middle',.749203113970256],['rich',.765143983146093]]){
  const s=start(country);near(sum(s.settlements.groups.map((g,i)=>g.urbanShare*s.households[i].population)),share);settleLaborDistribution(s);const r=s.laborDistribution.residence;assert.equal(r.length,20);near(sum(r.map(x=>x.employed)),sum(s.firms.map(f=>f.workers)));
  assert.ok(residenceRents(s).urban>residenceRents(s).rural);
  const ruralAgri=sum(r.filter(x=>!x.urban).map(x=>x.workers[0])),cityAgri=sum(r.filter(x=>x.urban).map(x=>x.workers[0]));assert.ok(ruralAgri>cityAgri);
 }
});
function migrationFixture(){
 const s=start('poor');settleLaborDistribution(s);s.settlements.history=[{month:0,records:s.households.map((h,i)=>({group:i,urban:{netLivingIncome:1000},rural:{netLivingIncome:1}}))}];
 for(const r of s.laborDistribution.residence)if(r.urban)r.employed=0;return s;
}
test('profitable migration is limited by housing and liquidity, with fees reserved from existing budgets',()=>{
 const s=migrationFixture();prepareSettlements(s);const moves=s.settlements.last.requestedMoves;assert.ok(sum(moves.map(m=>m.people))>0);
 const budgets=s.households.map(h=>h.income),plans=s.households.map(()=>({total:0}));reserveRelocation(s,budgets,plans,2);near(sum(plans.map(p=>p.total))*2,sum(moves.map(m=>m.budget)));assert.ok(moves.every(m=>m.budget<=budgets[m.group]*.1+1e-8));
 const blocked=migrationFixture();const used=sum(blocked.settlements.groups.map((g,i)=>blocked.population*blocked.households[i].population*g.urbanShare/blocked.households[i].householdSize)),delta=blocked.settlements.housing.urban-used;blocked.settlements.housing.urban=used;blocked.settlements.housing.rural+=delta;prepareSettlements(blocked);near(sum(blocked.settlements.last.requestedMoves.map(m=>m.people)),0);
 const poor=migrationFixture();for(const h of poor.households)h.cash=0;prepareSettlements(poor);near(sum(poor.settlements.last.requestedMoves.map(m=>m.people)),0);
});
test('actual moves and food compensation reconcile with GDP, service payments and household budgets',()=>{
 let s=start('poor');for(let i=0;i<36;i++){s=advanceMonth(s);validateOwners(s);validateSettlements(s);near(sum(s.householdEconomy.records.map(r=>r.consumption)),s.lastReport.gdp.consumption);assert.ok(s.metrics.auditError<1e-5);near(sum(s.settlements.last.records.flatMap(r=>[r.urban.people,r.rural.people])),s.population);for(const r of s.settlements.last.records){near(r.urban.income*r.urban.people+r.rural.income*r.rural.people,s.households[r.group].income);near(r.urban.housing*r.urban.people+r.rural.housing*r.rural.people,s.householdEconomy.records[r.group].categories.housing);}}
 assert.ok(sum(s.settlements.last.ownFood)>0);const relocation=sum(s.settlements.last.moves.map(m=>m.paid));assert.ok(relocation<=sum(s.householdEconomy.records.map(r=>r.categories.services)));assert.ok(s.metrics.top01WealthShare>=0&&s.metrics.top01WealthShare<=100);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded),advanceMonth(s));assert.deepEqual(replayJournal(s).metrics,s.metrics);
});
test('historical revisions replay unchanged and acquire new ledgers only at a month boundary',()=>{
 let s=start('middle',{economicRevision:19});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});assert.equal(s.wealthOwners,undefined);assert.equal(s.settlements,undefined);const old=JSON.stringify(s.journal);s=advanceMonth(s);assert.equal(s.economy.revision,24);assert.equal(JSON.stringify(s.journal.slice(0,1)),old);assert.deepEqual(replayJournal(s).metrics,s.metrics);
 for(const mutate of [x=>x.wealthOwners.families[0].cash+=100,x=>x.wealthOwners.families[0].stakes[x.firms[0].id]+=1,x=>x.settlements.groups[0].urbanShare=2]){const x=JSON.parse(exportSimulation(s));mutate(x.state);assert.throws(()=>importSimulation(JSON.stringify(x)));}
});
test('new domestic founders receive only claims paid from existing family deposits',async()=>{
 const {financeNewEnterprises,businessDraw}=await import('../src/business-dynamics.js');const s=start();s.policy.foreignBusinessEntry=false;s.policy.privateBusinessEntry=true;s.institutions.registrationDays=30;s.institutions.contractReliability=1;
 while(businessDraw(s.seed,s.month,83)>=.08)s.seed++;
 const before=sum(s.households.map(h=>h.cash))+sum(ownerBusinesses(s).map(f=>f.cash)),old=s.enterpriseMarket.companies.length;
 financeNewEnterprises(s,[{},{},{foreignScore:1}],1,0,()=>assert.fail('foreign funding not requested'));
 assert.equal(s.enterpriseMarket.companies.length,old+1);synchronizeOwnerClaims(s);validateOwners(s);
 near(sum(s.households.map(h=>h.cash))+sum(ownerBusinesses(s).map(f=>f.cash)),before);
 const c=s.enterpriseMarket.companies.at(-1);assert.ok(s.wealthOwners.last.subscriptions.some(x=>x.company===c.id&&x.founderPaid>0));near(c.capital,0);
});

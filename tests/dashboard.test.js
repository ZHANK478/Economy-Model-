import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,executePolitical,replayJournal,importSimulation,exportSimulation,copy} from '../src/engine.js';
import {decisionBudget} from '../src/political-system.js';
import {unresolvedInitiatives,generateMonthlyAgenda} from '../src/political-agenda.js';
import {comparableGDP,budgetBalance,currentMetric,monthlyMetricChange,metricSeries,electorateSeries} from '../src/dashboard-data.js';
const create=(form='presidential',dashboardMode=true)=>createSimulation({politicalMode:true,seed:11,politicalOptions:{constitution:{form},agendaSlots:1,decisionLimit:3,...(dashboardMode?{dashboardMode:true}:{})}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function checkGroups(s){
 const p=s.politics;
 for(const dimension of ['age','income','region','origin','occupation']){
  const rows=p.poll.groups.filter(g=>g.dimension===dimension),sum=rows.reduce((n,g)=>n+g.eligible,0),voters=rows.reduce((n,g)=>n+g.voters,0);
  near(sum,p.poll.eligible);near(voters,p.poll.expectedVoters);near(rows.reduce((n,g)=>n+g.approval*g.eligible,0)/sum,p.poll.approval*100);
  for(const x of p.poll.parties){near(rows.reduce((n,g)=>n+(g.parties[x.id]??0)*g.voters,0)/voters,x.share);near(rows.reduce((n,g)=>n+(g.candidates[x.id]??0)*g.voters,0)/voters,x.candidateShare);}
 }
}
test('occasional initiatives, weighted group observations and full saves replay across government forms',()=>{
 for(const form of ['presidential','parliamentary','semiPresidential']){
  let s=create(form),offered=[];checkGroups(s);
  for(let month=0;month<24&&s.politics.executive.inOffice;month++){
   const proposals=unresolvedInitiatives(s);assert.ok(proposals.length<=1);
   if(proposals.length){offered.push(s.month);executePolitical(s,{kind:'decideBill',billId:proposals[0].id,decision:month%3===0?'reject':'accept'});}
   else assert.equal(decisionBudget(s).optionalRemaining,3);
   const length=s.politics.bills.length;generateMonthlyAgenda(s);assert.equal(s.politics.bills.length,length);
   s=advanceMonth(s);checkGroups(s);near(budgetBalance(s.metrics),-s.government.lastDeficit);
  }
  assert.ok(offered.length>=5&&offered.length<=13);for(let i=1;i<offered.length;i++)assert.ok(offered[i]-offered[i-1]>=2&&offered[i]-offered[i-1]<=4);
  const saved=importSimulation(exportSimulation(s));assert.deepEqual(replayJournal(saved).politics,saved.politics);assert.deepEqual(replayJournal(saved).metrics,saved.metrics);
  assert.ok(electorateSeries(saved,'income','party',saved.politics.executive.playerParty).every(g=>g.points.length===saved.month+1));
 }
});
test('old saves start group observations at upgrade without changing existing polls or inventing the past',()=>{
 let s=create('presidential',false);for(let i=0;i<4;i++){for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'accept'});s=advanceMonth(s);}
 const before=copy(s.politics.poll),past=copy(s.politics.partyHistory.slice(0,-1));executePolitical(s,{kind:'setDashboardMode'});
 const after=copy(s.politics.poll);delete after.groups;assert.deepEqual(after,before);assert.deepEqual(s.politics.partyHistory.slice(0,-1),past);
 assert.ok(s.politics.partyHistory.slice(0,-1).every(h=>!h.groups));assert.ok(s.politics.partyHistory.at(-1).groups);
 assert.deepEqual(replayJournal(s).politics,s.politics);
});
test('budget graph uses the complete fiscal balance and excludes uncalculated opening-month flows',()=>{
 let s=create();assert.equal(currentMetric(s,'budgetBalance'),null);assert.equal(metricSeries(s,'budgetBalance').length,0);
 const b=unresolvedInitiatives(s)[0];executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});s=advanceMonth(s);
 near(currentMetric(s,'budgetBalance'),-s.government.lastDeficit);near(metricSeries(s,'budgetBalance')[0].budgetBalance,-s.government.lastDeficit);
 const f=s.lastReport.fiscal,spending=f.purchases+f.transfers+f.familyBenefits+f.businessSupport+f.concessionGuarantees+f.bankRescue+f.interest+f.networkPurchases-f.networkSales;
 near(currentMetric(s,'budgetBalance'),f.tax+f.centralIncome+f.stateDividends-spending);
 const broken=JSON.parse(exportSimulation(s));broken.state.politics.poll.groups[0].parties.p1=101;assert.throws(()=>importSimulation(JSON.stringify(broken)));
});

test('the two visible GDP figures share prices, period and average population',()=>{
 const s={population:12,metrics:{month:12,realGDPRolling:12000,nominalGDPAnnual:80000},history:Array.from({length:13},(_,month)=>({month,population:month===0?100:10,realGDPRolling:12000}))};
 assert.deepEqual(comparableGDP(s),{total:12000,perCapita:1200});assert.equal(currentMetric(s,'gdpPerCapitaRolling'),1200);
 s.metrics.nominalGDPAnnual*=3;assert.deepEqual(comparableGDP(s),{total:12000,perCapita:1200});
 const series=metricSeries(s,'gdpPerCapitaRolling');assert.equal(series.at(-1).gdpPerCapitaRolling,1200);
 assert.ok(series.every(x=>Number.isFinite(x.gdpPerCapitaRolling)));assert.equal(JSON.stringify(s).includes('gdpPerCapitaRolling'),false);
});

test('monthly changes use matching rolling GDP and omit missing fiscal observations',()=>{
 const s={month:1,population:12,metrics:{month:1,realGDPRolling:2400,unemployment:8,inflationYoY:7},government:{lastDeficit:3},history:[{month:0,population:10,realGDPRolling:2000,unemployment:10,inflationYoY:8},{month:1,population:12,realGDPRolling:2400,unemployment:8,inflationYoY:7}]};
 near(monthlyMetricChange(s,'gdpPerCapitaRolling'),2400/11-200);
 near(monthlyMetricChange(s,'unemployment'),-2);near(monthlyMetricChange(s,'inflationYoY'),-1);
 assert.equal(monthlyMetricChange(s,'budgetBalance'),null);
 s.month=2;s.metrics={...s.metrics,month:2,unemployment:7};s.history.push(s.metrics);
 s.history[1].deficitRatio=12;s.history[1].nominalGDPAnnual=1000;
 near(monthlyMetricChange(s,'budgetBalance'),7);
 delete s.history[1].unemployment;assert.equal(monthlyMetricChange(s,'unemployment'),null);
 s.month=0;assert.equal(monthlyMetricChange(s,'inflationYoY'),null);
});

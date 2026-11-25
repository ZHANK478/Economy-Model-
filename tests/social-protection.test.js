import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation,copy} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {socialTransferPlan,socialCashBeforeSpending,prepareSocial,validateSocial,completeHousing} from '../src/social-protection.js';
import {wageBreakdown} from '../src/dashboard-data.js';
const sum=a=>a.reduce((x,y)=>x+y,0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const start=(country='middle',revision=9)=>{const o=newGameOptions({country});o.politicalMode=false;o.economicRevision=revision;return createSimulation(o);};

test('initial pensions replace the old transfer envelope rather than adding a second pension bill',()=>{
 const old=start('middle',8),s=start();
 near(s.policy.transfers,old.policy.transfers*.3);
 const oldBill=old.base.monthlyGDP*old.policy.transfers/100*(.6+.4*(old.ageCohorts[2]/old.population)/.07);
 near(sum(socialTransferPlan(s).pensions),oldBill*.7);
 assert.equal(s.social.pensionFund.cash,0);assert.equal(sum(s.social.privateAccounts),0);
});
test('public contributions and funded saving use actual wages and existing money',()=>{
 let s=start();s.policy.pensionContribution=7;
 for(let i=0;i<18;i++){
  s=advanceMonth(s);const f=s.lastReport.fiscal,z=s.social,w=wageBreakdown(s);
  near(w.net*(s.metrics.wageEmployment??s.metrics.employment),s.householdEconomy.records.reduce((a,r)=>a+r.sources.labor,0));
  near(f.tax,f.vat+f.tariff+f.incomeTax+f.corporateTax+f.royalty+f.socialContributions);
  near(sum(z.privateAccounts),z.pensionFund.cash+z.pensionFund.bankClaim);
  assert.ok(s.metrics.auditError<1e-5);validateSocial(s);
 }
 assert.ok(sum(s.social.privateAccounts)>0);assert.ok(s.social.insuranceFund.cash>0);
 const z=copy(s);z.social.privateAccounts[0]++;assert.throws(()=>validateSocial(z));
});
test('unemployment insurance distinguishes eligibility, waiting month and exhausted duration',()=>{
 const s=start();s.social.unemployment=Array.from({length:10},()=>[]);
 const cohort={people:.01,wage:500,covered:1,privateCover:0};
 s.social.unemployment[0]=[{...cohort,months:0},{...cohort,months:2},{...cohort,months:7},{...cohort,months:2,covered:0}];
 s.policy.unemploymentDuration=6;s.policy.unemploymentReplacement=40;
 near(socialTransferPlan(s).unemployment[0],3.5);
 s.policy.unemploymentDuration=12;near(socialTransferPlan(s).unemployment[0],5.5);
 s.policy.unemploymentReplacement=0;near(socialTransferPlan(s).unemployment[0],0);
});
test('private insurance is reserve limited and funded retirement draw is a withdrawal of owned assets',()=>{
 const s=start();prepareSocial(s,copy(s));const z=s.social;z.privateAccounts[0]=100;z.pensionFund.cash=100;z.insuranceFund.cash=.1;
 z.unemployment[0]=[{people:.1,wage:500,months:2,covered:1,privateCover:1}];
 const income=s.households[0].income,before=s.households[0].cash;
 s.policy.privatePensions=false;s.policy.privateUnemploymentInsurance=false;
 socialCashBeforeSpending(s);
 near(sum(z.last.privateBenefits),.1);near(z.insuranceFund.cash,0);
 assert.ok(z.last.privatePensionDraw[0]>0);assert.equal(s.households[0].income,income);
 near(s.households[0].cash-before,z.last.privatePensionDraw[0]+.1);validateSocial(s);
});
test('raising retirement age phases in and preserves previously granted pensions',()=>{
 const s=start(),before=s.social.pension.retirees,age=s.social.pension.effectiveAge;s.policy.retirementAge=70;
 prepareSocial(s,copy(s));near(s.social.pension.effectiveAge,age+.5/12);
 assert.ok(s.social.pension.retirees>=before*.99);
 const a=start(),b=copy(a);a.policy.pensionIndexation='prices';b.policy.pensionIndexation='wages';
 const prev=copy(a);prev.consumerPriceIndex*=1.1;prev.metrics.meanWageNominal*=1.02;
 prepareSocial(a,prev);prepareSocial(b,prev);assert.ok(a.social.pension.benefit[0]>b.social.pension.benefit[0]);
});
test('housing construction pays for physical orders and completes only after its delay',()=>{
 let s=start();s.policy.socialHousingBudget=1;s.policy.privateHousingEntry=false;
 const stock=s.social.housing.publicStock;s=advanceMonth(s);const project=s.projects.find(p=>p.type==='housing'&&p.public);
 assert.ok(project&&project.amount>0&&project.due>s.month+12);assert.ok(s.social.housing.publicStock<stock);
 assert.ok(!s.projects.some(p=>p.type==='housing'&&!p.public));
 const before=s.social.housing.publicStock;completeHousing(s,project);assert.ok(s.social.housing.publicStock>before);
 const a=start(),b=copy(a);b.social.housing.publicStock*=2;
 prepareSocial(a,copy(a));prepareSocial(b,copy(b));assert.ok(b.social.housing.rentIndex<a.social.housing.rentIndex);
});
test('new social decisions preserve accounts and exact replay in poor, middle and rich countries',()=>{
 for(const country of ['poor','middle','rich']){
  let s=start(country);s.policy.socialHousingBudget=.5;s.policy.housingAllowance=.2;s.policy.pensionContribution=5;s.policy.retrainingBudget=.1;
  const original=s.social.housing.publicStock;
  for(let i=0;i<36;i++)s=advanceMonth(s);
  assert.ok(s.social.housing.publicStock>original);assert.ok(s.social.history.length===36);assert.ok(s.metrics.auditError<1e-5);
  const r=replayJournal(importSimulation(exportSimulation(s)));assert.deepEqual(r.metrics,s.metrics);assert.deepEqual(r.social,s.social);
 }
});
test('revision 8 upgrades at the month boundary without rewriting history, and migration replays',()=>{
 let old=advanceMonth(start('middle',8),undefined,{preserveEconomicRevision:true});const past=JSON.stringify(old.journal),stocks=JSON.stringify(old.firms);
 const upgraded=advanceMonth(old);assert.equal(upgraded.economy.revision,24);assert.equal(upgraded.social.startedMonth,old.month);
 assert.equal(JSON.stringify(upgraded.journal.slice(0,old.month)),past);assert.equal(JSON.stringify(old.firms),stocks);
 const r=replayJournal(importSimulation(exportSimulation(upgraded)));assert.deepEqual(r.metrics,upgraded.metrics);assert.deepEqual(r.social,upgraded.social);
});

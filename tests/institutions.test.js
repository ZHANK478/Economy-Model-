import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,runMonths,sanitizePolicy,scheduleOwnership,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {fundInstitutionServices,governanceTarget} from '../src/institutions.js';
import {MODEL_PROFILES,POLICY_FIELDS,POLICY_CHECKS,BASE_POLICY} from '../src/config.js';
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const reform={registrationProcedures:2,antitrustBudget:.10,courtBudget:.16,soeAuditBudget:.05,
  openProcurement:true,meritAppointments:true,boardAutonomy:true,independentSoeAudit:true,depositPortability:true};
const capacities=['antitrustCapacity','courtCapacity','soeAuditCapacity'];
const zeroReturns={governanceEfficiencyElasticity:0,competitionEfficiencyElasticity:0,softBudgetEfficiencyPenalty:0,
  competitionPriceResponse:0,contractRiskSensitivity:0,bankContestabilitySpread:0};

test('policy controls contain instruments, not selectable institutional outcomes',()=>{
  for(const key of ['competition','soeGovernance','ruleOfLaw','bankCompetition']){
    assert.ok(!(key in BASE_POLICY));assert.ok(!POLICY_FIELDS.some(f=>f[0]===key));
  }
  for(const key of Object.keys(BASE_POLICY))assert.ok(POLICY_FIELDS.some(f=>f[0]===key)||POLICY_CHECKS.some(f=>f[0]===key));
  const p=sanitizePolicy({registrationProcedures:2.5,bankEntry:false,competition:100});
  assert.equal(p.registrationProcedures,3);assert.equal(p.bankEntry,false);assert.ok(!('competition' in p));
});
test('removed quality sliders cannot silently continue to act',()=>{
  const s=createSimulation(),a=advanceMonth(s),b=advanceMonth(s,{...s.policy,competition:100,soeGovernance:100,ruleOfLaw:100,bankCompetition:100});
  assert.deepEqual(a.metrics,b.metrics);assert.deepEqual(a.policy,b.policy);
});
test('a larger promised budget does not instantly improve this months institutional outcomes',()=>{
  const s=createSimulation(),a=advanceMonth(s),b=advanceMonth(s,{...s.policy,antitrustBudget:.5,courtBudget:1,soeAuditBudget:.5});
  for(const key of ['competition','contractReliability','registrationDays','contractDelayDays'])close(a.institutions[key],b.institutions[key]);
  for(let j=0;j<5;j++)close(a.firms[j].governance,b.firms[j].governance);
  assert.ok(b.institutions.courtCapacity>a.institutions.courtCapacity);assert.ok(b.lastReport.fiscal.courts>a.lastReport.fiscal.courts);
});
test('an unfunded institutional promise creates no services and capacity is not replenished',()=>{
  const s=createSimulation();s.parameters.maximumPublicDebtRatio=0;s.government.cash=0;s.bank.equity+=3000;
  const b=advanceMonth(s,{...s.policy,antitrustBudget:.5,courtBudget:1,soeAuditBudget:.5,automaticRestructuring:false});
  for(const key of ['antitrust','courts','soeAudits'])close(b.lastReport.fiscal[key],0);
  for(const key of capacities)assert.ok(b.institutions[key]<s.institutions[key]);
  assert.ok(b.metrics.auditError<1e-6);
});
test('capacity follows real paid services, not policy announcement or nominal inflation',()=>{
  const a=createSimulation(),b=createSimulation();
  a.policy.courtBudget=1;b.policy.courtBudget=0;
  fundInstitutionServices(a,{antitrust:2.5,courts:8,soeAudits:2.5},2);
  fundInstitutionServices(b,{antitrust:1.25,courts:4,soeAudits:1.25},1);
  for(const key of capacities)close(a.institutions[key],b.institutions[key]);
});
test('service capacity has diminishing returns and zero effectiveness is available',()=>{
  const outcomes=[1,2,4].map(r=>{const s=createSimulation();fundInstitutionServices(s,{antitrust:2.5*r,courts:4*r,soeAudits:1.25*r},1);return s.institutions.courtCapacity;});
  // Compare gain per extra budget unit, not unequal absolute budget increments.
  assert.ok(outcomes[1]-outcomes[0]>(outcomes[2]-outcomes[1])/2);
  const a=createSimulation({parameters:{institutionServiceProductivity:0}}),b=createSimulation({parameters:{institutionServiceProductivity:0}});
  fundInstitutionServices(a,{antitrust:0,courts:0,soeAudits:0},1);fundInstitutionServices(b,{antitrust:1e6,courts:1e6,soeAudits:1e6},1);
  for(const key of capacities)close(a.institutions[key],b.institutions[key]);
});
test('larger public portfolio dilutes audit coverage at the same real budget',()=>{
  const a=createSimulation(),b=createSimulation();for(const f of b.firms)f.ownership.state=1;
  const paid={antitrust:2.5,courts:4,soeAudits:1.25};fundInstitutionServices(a,paid,1);fundInstitutionServices(b,paid,1);
  assert.ok(a.institutions.soeAuditCapacity>b.institutions.soeAuditCapacity);
});
test('the ownership label itself has no governance advantage at equal baseline execution',()=>{
  const s=createSimulation(),f=s.firms[1];
  const a=governanceTarget(s,{...f,ownership:{state:0}}),b=governanceTarget(s,{...f,ownership:{state:1}});close(a,b);
  s.parameters.publicAccountabilityEffect=0;s.policy.meritAppointments=false;s.policy.boardAutonomy=false;s.policy.independentSoeAudit=false;
  close(governanceTarget(s,{...f,ownership:{state:0}}),governanceTarget(s,{...f,ownership:{state:1}}));
});
test('independent audit and executed appointment rules matter with a lag, not a governance target',()=>{
  const s=createSimulation(),a=runMonths(s,36),b=runMonths(s,36,{...s.policy,meritAppointments:false,boardAutonomy:false,independentSoeAudit:false});
  assert.ok(a.firms[1].governance>b.firms[1].governance);assert.ok(b.firms[1].governance>0);
});
test('uncompensated expropriation affects property reliability and delay',()=>{
  const s=createSimulation(),a=advanceMonth(s);scheduleOwnership(s,{sector:1,kind:'nationalize',points:50,compensation:0});const b=advanceMonth(s);
  assert.ok(b.metrics.contractReliability<a.metrics.contractReliability);assert.ok(b.metrics.contractDelayDays>a.metrics.contractDelayDays);
});
test('bank rules change an endogenous switching proxy, never directly set competition to 100',()=>{
  const s=createSimulation(),a=advanceMonth(s),b=advanceMonth(s,{...s.policy,depositPortability:true});
  assert.ok(b.metrics.bankContestability>a.metrics.bankContestability);assert.ok(b.metrics.bankContestability<65);
  const c=runMonths(s,60,{...s.policy,bankEntry:false,rateDisclosure:false,depositPortability:false});assert.ok(c.metrics.bankContestability<a.metrics.bankContestability);
});
test('institutional settings do not give a permanent exogenous TFP growth bonus',()=>{
  const s=createSimulation(),a=runMonths(s,48),b=runMonths(s,48,{...s.policy,...reform});
  for(let j=0;j<5;j++)close(a.firms[j].productivity,b.firms[j].productivity);
  assert.ok(b.metrics.marketContestability>a.metrics.marketContestability);
});
test('zero return coefficients disable output and price rewards for rules in every profile',()=>{
  for(const modelProfile of Object.keys(MODEL_PROFILES)){
    const s=createSimulation({modelProfile,parameters:zeroReturns}),a=runMonths(s,24),b=runMonths(s,24,{...s.policy,registrationProcedures:1,openProcurement:true,depositPortability:true});
    for(const key of ['realGDPMonthly','inflationYoY','depositRate','lendingRate','debtRatio'])close(a.metrics[key],b.metrics[key]);
    for(let j=0;j<5;j++)close(a.firms[j].managementEfficiency,b.firms[j].managementEfficiency);
  }
});
test('new legal choices, paid outcomes and changed hypotheses round-trip and replay exactly',()=>{
  let s=createSimulation({stochastic:true,seed:88});s=runMonths(s,24,{...s.policy,...reform});
  s.parameters.antitrustEffectiveness=0;s=runMonths(s,12);
  assert.ok(s.journal[0].policyChanges.some(x=>x.key==='openProcurement'));
  assert.ok(s.journal[24].parameterChanges.some(x=>x.key==='antitrustEffectiveness'));
  assert.deepEqual(replayJournal(s).metrics,s.metrics);assert.deepEqual(importSimulation(exportSimulation(s)).metrics,s.metrics);
  const old=JSON.parse(exportSimulation(s));old.version='3.0.0';old.state.version='3.0.0';assert.throws(()=>importSimulation(JSON.stringify(old)),/версия/);
  const damaged=JSON.parse(exportSimulation(s));damaged.state.institutions.courtCapacity=2;assert.throws(()=>importSimulation(JSON.stringify(damaged)),/институциональные/);
});

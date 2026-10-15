// Internal diagnostic scenarios, not forecasts of real parties or an ideology ranking.
// The eight existing families plus two within-family policy variants make ten
// trajectories. All countries use the same equations; only initial stocks differ.
// Scientific limits retained explicitly in code: political platforms and voting
// utilities are synthetic; minimum-wage pass-through is not calibrated to legal
// coverage; informal self-employment is not a separate household production
// sector; the consolidated bank excludes household bond portfolios; fixed IO
// recipes and within-stratum incomes omit substitution and heterogeneity.
// Twenty months cannot validate long-run demographics or identify causal effects.
// No documents or report files are generated. Decisions face actual voting rules.
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,executePolitical,exportSimulation,importSimulation,replayJournal,scheduleOwnership} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {decisionBudget,plannedPolicy} from '../src/political-system.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
import {POLICY_FIELDS} from '../src/config.js';
const variants=[
 ['socialist',{incomeTax:25,incomeTaxProgressivity:.5,corporateTax:30,transfers:5,healthcare:3,education:2.5,workerRepresentation:true,bargainingSystem:'sector'},'purchase'],
 ['socialDemocrat',{incomeTax:23,incomeTaxProgressivity:.4,transfers:4,healthcare:3,education:3,childcareBudget:1,openProcurement:true,bargainingSystem:'coordinated'}],
 ['liberal',{incomeTax:13,corporateTax:18,governmentConsumption:5,tariff:0,registrationProcedures:2,openProcurement:true,depositPortability:true},'privatize'],
 ['conservative',{corporateTax:21,governmentConsumption:6,familyBenefits:1.5,securityBudget:1,publicInvestment:3.5,registrationProcedures:4}],
 ['national',{tariff:12,capitalControls:35,publicInvestment:4,foreignBorrowingShare:10,securityBudget:1.2,businessSupport:1},'purchase'],
 ['green',{publicInvestment:4.5,education:3,healthcare:2.5,infrastructureMaintenance:1.2,municipalInvestmentShare:35,workerRepresentation:true,openProcurement:true}],
 ['agrarian',{tariff:7,publicInvestment:4,infrastructureMaintenance:1.1,municipalInvestmentShare:40,cooperativeEntry:true,familyBenefits:1.2},'cooperatize'],
 ['regional',{municipalInvestmentShare:60,infrastructureMaintenance:1.2,publicInvestment:3.5,openProcurement:true,registrationProcedures:3},'municipalize'],
 ['liberal',{vat:12,incomeTax:10,corporateTax:15,governmentConsumption:4,publicInvestment:1.5,registrationProcedures:1,privateInfrastructureEntry:true,privateHealthEntry:true,privateEducationEntry:true},'foreignSale'],
 ['socialist',{incomeTax:23,corporateTax:28,transfers:4,education:3,healthcare:3,workerRepresentation:true,cooperativeEntry:true,openProcurement:true},'cooperatize']
];
const field=k=>POLICY_FIELDS.find(x=>x[0]===k);
function difference(k,a,b){return typeof b==='number'?Math.abs(a-b)/Math.max(field(k)?.[3]-field(k)?.[2]??1,1):Number(a!==b);}
function proposalDecision(s,bill,targets){
 let improvement=0;const current=plannedPolicy(s);
 for(const [k,to] of Object.entries(bill.patch)){if(k in targets)improvement+=difference(k,current[k],targets[k])-difference(k,to,targets[k]);}
 return improvement>=0?'accept':'reject';
}
function govern(s,variant,run){
 const [family,targets,ownership]=variant;
 for(const bill of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:bill.id,decision:proposalDecision(s,bill,targets)});
 const attempted=new Set();
 if(s.month===6&&ownership&&decisionBudget(s).optionalRemaining){scheduleOwnership(s,{sector:family==='agrarian'?0:family==='national'?1:4,kind:ownership,points:10,compensation:1});executePolitical(s,{kind:'chooseLaw',actions:s.pendingActions});}
 while(decisionBudget(s).optionalRemaining>0){
  const current=plannedPolicy(s),entries=Object.entries(targets).filter(([k,v])=>current[k]!==v&&!attempted.has(k));
  if(!entries.length)break;
  // Different sequencing is a scenario assumption, never a party productivity bonus.
  const [key,target]=entries[(s.month+run)%entries.length];attempted.add(key);
  const f=field(key),step=typeof target==='number'?Math.max(f?.[4]??1,Math.min(2,Math.abs(target-current[key]))):0;
  const value=typeof target==='number'?Number((current[key]+Math.sign(target-current[key])*step).toFixed(6)):target;
  executePolitical(s,{kind:'policyDecision',patch:{[key]:value}});
 }
}
export function checkPartyPolicies(){
 const games=[];let months=0,minRatio=Infinity,maxUnemployment=0,defaults=0,early=0;
 for(let i=0;i<variants.length;i++)for(let run=0;run<7;run++){
  const country=['poor','middle','rich'][(i+run)%3],government=['presidential','parliamentary','mixedPresident'][run%3];
  let s=createSimulation({...newGameOptions({country,government,party:variants[i][0],resource:run%2===0}),seed:[42,17,91,8,125,31,57][run]});
  const initial=s.metrics.realGDPMonthly;
  for(let t=0;t<20&&s.politics.executive.inOffice;t++){
   govern(s,variants[i],run);s=advanceMonth(s);months++;
   assert.ok(Object.values(s.lastReport.audit).every(Number.isFinite));
   const scale=Math.max(1,s.metrics.nominalGDPAnnual,Math.abs(s.bank.equity));
   assert.ok(Object.values(s.lastReport.audit).every(v=>Math.abs(v)<=Math.max(1e-4,scale*1e-8)));
   assert.ok(s.metrics.realGDPMonthly>=0&&Object.values(s.metrics).every(v=>typeof v!=='number'||Number.isFinite(v)));
   minRatio=Math.min(minRatio,s.metrics.realGDPMonthly/initial);maxUnemployment=Math.max(maxUnemployment,s.metrics.unemployment);
   assert.ok(s.metrics.realGDPMonthly/initial>1e-6,'Near-zero output requires investigation; a balanced ledger is not sufficient');
   assert.ok(s.lastReport.diagnostics?.revision===2);
  }
  if(s.month<20)early++;
  const saved=importSimulation(exportSimulation(s));assert.deepEqual(saved.metrics,s.metrics);
  const replay=replayJournal(saved);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.firms,s.firms);
  defaults+=s.government.defaults;
  games.push({variant:i,family:variants[i][0],country,run,months:s.month,ratio:s.metrics.realGDPMonthly/initial,u:s.metrics.unemployment,defaults:s.government.defaults});
 }
 assert.equal(games.length,70);
 const summary={games:games.length,months,early,minRatio,maxUnemployment,defaults};
 console.log(JSON.stringify(summary));
 if(process.env.ECONOMY_DIAGNOSTIC_VERBOSE==='1')for(const game of games)console.log(JSON.stringify(game));
 return {summary,games};
}
checkPartyPolicies();

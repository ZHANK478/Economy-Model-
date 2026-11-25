// Accounting-based manpower and procurement, economic revision 10.
// Parameter values are transparent scenario choices; not empirically fitted.
import {GROUPS} from './config.js';
const sum=a=>a.reduce((x,y)=>x+y,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const defenseEconomyActive=s=>(s.economy?.revision??0)>=10&&s.defense?.enabled===true;
export const DEFENSE_ECONOMY_KEYS=['defenseService','defensePersonnelTarget','defenseSalary','defenseProcurement'];
const desiredContract={contract:1,mixed:.6,conscription:.25};
const payShare={balanced:.42,readiness:.42,equipment:.38};
export function initializeDefenseEconomy(s){
 if(!defenseEconomyActive(s)||s.defense.economy)return;
 const d=s.defense,contract=desiredContract[s.policy.defenseService]??1;
 d.economy={version:1,startedMonth:s.month,contractShare:contract,activePaid:d.active,accounts:null,
  assumptions:{initialContractShare:contract,conscriptPay:.25,officerShare:.15,officerPay:1.4,contractServiceAnnualExit:.08,conscriptMonths:12,transitionMonths:24,recruitmentSensitivity:.7,employmentOriginContract:.9,employmentOriginConscript:.6},
  reserves:{contract:d.reserve*contract,conscript:d.reserve*(1-contract)},veterans:{disabled:0},last:null};
}
export function defenseEconomicPlan(s,prev,budgetBase){
 if(!defenseEconomyActive(s))return null;
 initializeDefenseEconomy(s);const e=s.defense.economy,p=s.policy;
 const target=desiredContract[p.defenseService]??1;e.contractShare+=(target-e.contractShare)/e.assumptions.transitionMonths;
 const civilians=Math.max(0,s.population*s.workingAgeShare*s.participation-(e.veterans.disabled??0)*.5);
 const active=Math.min(s.defense.active,civilians/Math.max(.01,e.contractShare*e.assumptions.employmentOriginContract+(1-e.contractShare)*e.assumptions.employmentOriginConscript));
 const fromLabor=active*(e.contractShare*e.assumptions.employmentOriginContract+(1-e.contractShare)*e.assumptions.employmentOriginConscript);
 const voluntary=Math.max(0,active*(e.contractShare-e.assumptions.officerShare));
 const officers=active*Math.min(e.contractShare,e.assumptions.officerShare),conscripts=active*(1-e.contractShare);
 const baseWage=Math.max(1,prev.metrics.meanWageNominal??s.base.monthlyGDP/s.population*.5),contractWage=baseWage*p.defenseSalary/100;
 const desired=contractWage*(voluntary+officers*e.assumptions.officerPay)+baseWage*e.assumptions.conscriptPay*conscripts;
 const appropriation=budgetBase*(p.militaryBudget??0)/100,planned=Math.min(desired,appropriation*(payShare[p.defensePriority]??.42));
 return {active,fromLabor,civilianLaborForce:Math.max(0,civilians-fromLabor),laborForce:civilians-fromLabor+active,officers,voluntary,conscripts,baseWage,contractWage,desired,planned,appropriation,netGroups:Array(10).fill(0),grossGroups:Array(10).fill(0),tax:0,contributions:0,paid:0};
}
// Transfer gross pay once, then recover income taxes and mandatory pensions.
export function payDefenseWages(s,plan,flow,socialPayroll){
 if(!plan)return;
 const gross=Math.min(plan.planned,Math.max(0,s.government.cash));plan.paid=gross;flow.militaryWages=gross;
 for(const [i,h] of s.households.entries()){
  const amount=gross*GROUPS[i].wageShare;
  const taxRate=clamp(s.policy.incomeTax/100+s.policy.incomeTaxProgressivity*.15*Math.log(Math.max(.01,GROUPS[i].wageShare/GROUPS[i].population)),0,.6)*s.institutions.taxCompliance;
  const tax=amount*taxRate;s.government.cash-=amount-tax;h.cash+=amount-tax;flow.incomeTax+=tax;
  const contribution=socialPayroll(s,i,amount,flow);plan.tax+=tax;plan.contributions+=contribution;
  plan.netGroups[i]=amount-tax-contribution;plan.grossGroups[i]=amount;
 }
 s.defense.economy.accounts={month:s.month,people:plan.active,gross,net:sum(plan.netGroups),tax:plan.tax,contributions:plan.contributions,
  contractWage:plan.contractWage,conscripts:plan.conscripts,officers:plan.officers,contracts:plan.voluntary};
}
export function defenseGoodMix(s,fraction){
 const d=s.defense,p=s.policy,priority={balanced:{operations:.28,training:.12,equipment:.18},readiness:{operations:.36,training:.16,equipment:.06},equipment:{operations:.24,training:.08,equipment:.30}}[p.defensePriority]??{operations:.28,training:.12,equipment:.18};
 const diplomacy=(d.alliance.requested||d.alliance.active?.06:0)+((d.war??d.crisis)?.negotiation&&!(d.war??d.crisis).negotiation.completed?.08:0);
 const ops=Math.max(0,priority.operations-diplomacy),total=ops+priority.training+priority.equipment+diplomacy;
 const military=[ops/28,ops*10/28,priority.equipment+ops*12/28,ops*5/28,priority.training+diplomacy].map(v=>v/Math.max(total,1e-9));
 const mix=d.civilianWeights.map((v,i)=>(1-fraction)*v+fraction*military[i]);
 const foreign={domestic:.12,mixed:.25,imported:.60}[p.defenseProcurement]??.25;
 return {weights:mix,imports:clamp((1-fraction)*d.civilianImport+fraction*foreign,0,.8),militaryWeights:military,militaryFraction:fraction};
}
export function validateDefenseEconomy(s){
 if(!defenseEconomyActive(s)){if((s.economy?.revision??0)<10&&s.defense?.economy)throw new Error('Военные счета не соответствуют ревизии');return;}
 const e=s.defense.economy;if(!e||e.version!==1||!Number.isInteger(e.startedMonth)||e.startedMonth<0||e.startedMonth>s.month||!Number.isFinite(e.contractShare)||e.contractShare<0||e.contractShare>1||!Number.isFinite(e.activePaid)||e.activePaid<0||!e.assumptions||Object.values(e.assumptions).some(v=>!Number.isFinite(v)||v<0||v>240)||!e.reserves||Object.values(e.reserves).some(v=>!Number.isFinite(v)||v<0))throw new Error('Повреждены военные счета');
 if(!e.veterans||!Number.isFinite(e.veterans.disabled)||e.veterans.disabled<0)throw new Error('Повреждены военные потери');
 if(e.accounts&&['people','gross','net','tax','contributions','contractWage','conscripts','officers','contracts'].some(k=>!Number.isFinite(e.accounts[k])||e.accounts[k]<0))throw new Error('Повреждены выплаты военнослужащим');
}

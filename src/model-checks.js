import {MODEL_VERIFICATION_RUN} from './model-verification-results.js';
import {OPEN_INPUTS} from './open-economy.js';
import {purchaseShare} from './macro-core.js';
import {MODEL_CONTRACT} from './model-contract.js';
const sum=a=>a.reduce((x,y)=>x+y,0);
export function initialModelChecks(s,plans){
 const investmentTarget=sum(plans.map(x=>x.unsmoothedTarget??x.desired));
 const expectedPurchases=s.base.monthlyGDP*purchaseShare(s.policy)/100;
 const agriculture=s.firms[0].production*(1-sum((s.economy?OPEN_INPUTS:[]).map(row=>row[0]))-s.firms[0].importCoefficient)/s.base.monthlyGDP;
 return {investment:{observed:s.base.investment,target:investmentTarget,relativeGap:investmentTarget/s.base.investment-1},
  purchases:{opening:s.base.government,policyReference:expectedPurchases,relativeGap:expectedPurchases/s.base.government-1},
  // Do not label initialized accounts as verified recurring income.
  disposableIncome:sum(s.households.map(h=>h.income-(h.interestPaid??0))),consumptionBaseVolume:s.base.consumption,
  agricultureMoment:{model:agriculture,reference:s.economy?.initial.agricultureGDPShare??null},
  debtRatio:s.metrics.debtRatio,defaultActive:s.government.defaultActive,status:'initial consistency checks, not a sustainability certificate'};
}
export function qualitySummary(s){
 const records=s.journal.filter(e=>e.calculationTrace);
 const definitions={'negative-bank-equity':'Отрицательный капитал банка','government-purchases-stopped':'Прекращение государственных закупок','unemployment-jump-pp':'Резкий рост безработицы за месяц','monthly-output-fall':'Резкое падение выпуска за месяц','six-month-output-fall':'Падение выпуска более чем на 5 процентов за полгода','six-month-unemployment-rise-pp':'Рост безработицы более чем на 3 процентных пункта за полгода','payment-default-started':'Начало неплатежа государства','repeated-restructuring':'Повторные реструктуризации долга','unfulfilled-domestic-orders':'Часть внутренних заказов не исполнена','FX-clearing-scenario-boundary':'Поиск валютного курса упёрся в сценарное ограничение','bank-external-interest-arrears':'Неоплаченные внешние проценты банка'};
 const warnings=records.flatMap(e=>(e.calculationTrace.warnings??[]).map(w=>({month:e.month,...w,message:definitions[w.code]??w.code})));
 const auditMax=Math.max(0,...records.flatMap(e=>Object.values(e.calculationTrace.report.audit).map(Math.abs)));
 const tested=records.length;
 return {technical:{recordedMonths:tested,maxAbsoluteAccountingResidual:auditMax,units:'million LC or population millions according to account',status:tested?'recorded; tolerance depends on scale':'no completed months'},
  economicValidation:{status:'not empirically certified',alerts:warnings,explanation:'Alert thresholds are heuristics, not estimated probabilities. Their absence does not establish realism.'},
  replay:{status:'not run in browser',verificationCommand:'node scripts/verify-save.mjs SAVE.json',comparison:'recompute actual journal under recorded revisions; relative tolerance 1e-8'},
  contract:MODEL_CONTRACT,developmentChecks:MODEL_VERIFICATION_RUN,
  parameters:{behavioural:Object.fromEntries(Object.entries(s.parameters).map(([key,value])=>[key,{value,status:'assumption unless initial observation explicitly overrides it in provenance'}])),macro:s.economy?.macro??null,initialAccounts:s.initialAccounts??null}};
}

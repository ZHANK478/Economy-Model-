import {initialModelChecks,qualitySummary} from './model-checks.js';
import {CALCULATION_BUILD} from './calculation-build.js';
export {CALCULATION_BUILD};
// Observation only: never read these records in economic or political equations.
// Amounts are millions of local currency, volumes at base prices, people millions.
const clone=v=>JSON.parse(JSON.stringify(v));
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,clone(v[k])]));
export const DIAGNOSTIC_SCHEMA=2;
export function accountSnapshot(s){
 return {month:s.month,metrics:clone(s.metrics),exchangeRate:s.exchangeRate,expectedInflation:s.expectedInflation,
  bank:clone(s.bank),centralBank:clone(s.centralBank),government:clone(s.government),institutions:clone(s.institutions),
  households:s.households.map((h,group)=>({group,...pick(h,['cash','income','interestPaid','depositIncome','foreignIncome','foreignSavingsUSD','loanLC','loanFX','averageRate','consumption','mpc'])})),
  firms:s.firms.map(f=>pick(f,['id','name','cash','loanLC','loanFX','averageRate','interestPaid','production','salesExpected','expectedValueAdded','workers','wage','capital','price','inventory','lastProfit','lastRevenue','lastInvestment','arrears','defaulted','productivity','managementEfficiency','ownership']))};
}
export function initialDiagnostic(s,investmentPlans=[]){
 return {schema:DIAGNOSTIC_SCHEMA,sourceBuild:CALCULATION_BUILD,kind:s.month===0?'initial-state':'observation-start',month:s.month,
  checks:initialModelChecks(s,investmentPlans),snapshot:accountSnapshot(s),reference:{baseConsumption:s.base.consumption,baseInvestment:s.base.investment,baseGovernment:s.base.government,
   householdRecordedIncome:sum(s.households.map(h=>h.income)),householdRecordedConsumption:sum(s.households.map(h=>h.consumption)),
   scheduledPrivateInvestment:sum(s.firms.map(f=>f.lastInvestment)),monthlyWages:sum(s.firms.map(f=>f.workers*f.wage)),investmentPlans},
  limitations:['Opening income is an initialized value, not verified recurring income.','Investment comparisons are diagnostic estimates at investment price 1; taxes, prices and funding change during the turn.','No steady state or fiscal sustainability is certified by this record.']};
}
export function diagnosticWarnings(before,after,report,history=[]){
 const m=after.metrics,p=before.metrics,w=[];
 const add=(code,observed,threshold)=>w.push({code,observed,threshold});
 if((after.bank.foreignArrearsUSD??0)>1e-7)add('bank-external-interest-arrears',after.bank.foreignArrearsUSD,0);
 if(after.bank.equity<0)add('negative-bank-equity',after.bank.equity,0);
 if(p.governmentPurchases>0&&m.governmentPurchases===0)add('government-purchases-stopped',0,p.governmentPurchases);
 if(m.unemployment-p.unemployment>2)add('unemployment-jump-pp',m.unemployment-p.unemployment,2);
 if(m.realGDPMonthly<p.realGDPMonthly*.9)add('monthly-output-fall',m.realGDPMonthly/p.realGDPMonthly-1,-.1);
 if(after.government.defaultActive&&!before.government.defaultActive)add('payment-default-started',after.month,null);
 const restructurings=sum(after.government.defaultEpisodes.map(x=>x.restructurings??0));
 if(restructurings>1)add('repeated-restructuring',restructurings,1);
 if(report.diagnostics?.domesticOrderFulfillment<.99)add('unfulfilled-domestic-orders',report.diagnostics.domesticOrderFulfillment,.99);
 const six=history.find(x=>x.month===after.month-6);
 if(six&&m.realGDPMonthly<six.realGDPMonthly*.95)add('six-month-output-fall',m.realGDPMonthly/six.realGDPMonthly-1,-.05);
 if(six&&m.unemployment-six.unemployment>3)add('six-month-unemployment-rise-pp',m.unemployment-six.unemployment,3);
 if(report.diagnostics?.fxMarketSolve?.ceilingReached)add('FX-clearing-scenario-boundary',.20,.20);
 return w;
}
export function diagnosticEnvelope(s){
 const recorded=s.journal.filter(e=>e.calculationTrace).map(e=>e.month);
 return {verification:qualitySummary(s),schema:DIAGNOSTIC_SCHEMA,sourceBuild:CALCULATION_BUILD,engineVersion:s.version,economicRevision:s.economy?.revision??null,
  units:{money:'million-local-currency',foreignMoney:'million-USD',volume:'base-price-volume',population:'million',rate:'fractions unless field names or metrics specify percent'},
  coverage:{firstRecordedMonth:recorded[0]??null,lastRecordedMonth:recorded.at(-1)??null,recordedMonths:recorded.length,missingMonths:s.journal.filter(e=>!e.calculationTrace).map(e=>e.month)},
  recordsPath:'state.journal[].calculationTrace',baseline:s.diagnosticBaseline??null,
  currentTurn:{month:s.month,commands:clone(s.politics.turnCommands??[]),pendingActions:clone(s.pendingActions),requestedPolicy:clone(s.requestedPolicy??s.policy)},
  interpretation:'Records describe executed calculations, not identified causal effects or empirical validation. Warning thresholds are diagnostic heuristics. Missing past calculations are not reconstructed.'};
}

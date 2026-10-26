import {householdBonds} from './bond-market.js';
// Revision 4. A monthly, explicitly adapted macrostructural block, NOT MFMod itself.
// Reference: Burns et al. (2019), WPS8965, equations 5-10 and Box 2.
// See research/model-contract.json for evidence and assumptions. No party labels.
const sum=a=>a.reduce((x,y)=>x+y,0);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const annualFlowRate=r=>Math.expm1(Math.log1p(r)/12);
export const monthlyDepreciation=d=>-Math.expm1(Math.log1p(-d)/12);
export const adjustmentFromAnnual=a=>-Math.expm1(Math.log1p(-a)/12);
export function errorCorrection({previous,target,speed,logChange=0,accelerator=0}){
 if(!(previous>0&&target>0&&speed>=0&&speed<=1))throw new Error('Invalid error correction inputs');
 const correction=speed*Math.log(target/previous),shortRun=accelerator*logChange;
 return {value:previous*Math.exp(correction+shortRun),correction,shortRun};
}
export function balancedInvestment(capital,depreciation,growth){
 return capital*(monthlyDepreciation(depreciation)+annualFlowRate(growth));
}
export function userCost({realBorrow,debtShare,equityReturn,risk,depreciation,tax}){
 // Financing cost once, depreciation relief once; corporate taxes on profits.
 return (debtShare*realBorrow+(1-debtShare)*equityReturn+risk+depreciation*(1-tax))/Math.max(.05,1-tax);
}
export function equilibriumInvestment({valueAdded,capitalShare,depreciation,growth,annualUserCost,investmentPrice=1}){
 return (monthlyDepreciation(depreciation)+annualFlowRate(growth))*capitalShare*Math.max(0,valueAdded)*12/(Math.max(.005,annualUserCost)*investmentPrice);
}
export function calibrateMacroCore(s,depreciation){
 const growth=s.initialAccounts?.trendGrowth??s.initialMacro?.realGrowthAnnual??.03;
 const realBorrow=(1+s.bank.lendingRate)/(1+s.expectedInflation)-1;
 const risk=s.economy.parameters.riskPrice*(1-s.institutions.contractReliability)+s.institutions.ownershipRisk*.08;
 const tax=s.policy.corporateTax/100*s.institutions.taxCompliance;
 const firms=s.firms.map(f=>{
  const debtShare=clamp((f.loanLC+f.loanFX*s.exchangeRate)/f.capital,0,1);
  const explicitCost=userCost({realBorrow,debtShare,equityReturn:s.parameters.neutralRealRate,risk,depreciation,tax});
  const impliedCost=(monthlyDepreciation(depreciation)+annualFlowRate(growth))*s.economy.parameters.capitalShare*f.expectedValueAdded*12/f.lastInvestment;
  return {sector:f.id,initialInvestment:f.lastInvestment,initialValueAdded:f.expectedValueAdded,initialCapital:f.capital,
   userCostResidual:impliedCost-explicitCost,impliedCost,explicitCost,initialDebtShare:debtShare,initialWorkers:f.workers};
 });
 s.economy.macro={version:1,calibrationMonth:s.month,trendGrowth:growth,investmentSpeed:adjustmentFromAnnual(.35),
  // Time constants/elasticities below are assumptions, not country estimates.
  consumptionSpeed:adjustmentFromAnnual(.65),incomeElasticity:.9,wealthElasticity:.1,
  initialBondPremium: .09-s.bank.depositRate-(s.metrics.refinancingRisk??0)/100*s.economy.parameters.sovereignLossGivenDefault,
  source:'Burns et al 2019 WPS8965 eqs 5-10; monthly adaptation with fixed baseline residual',firms,
  households:s.households.map((h,index)=>({bondPortfolioShare:clamp(householdBonds(s,index)/Math.max(1e-9,h.cash+householdBonds(s,index)+h.foreignSavingsUSD*s.exchangeRate-h.loanLC-h.loanFX*s.exchangeRate),0,.95),consumption:h.consumption,netIncome:Math.max(1e-9,h.income-(h.interestPaid??0)),wealth:Math.max(1e-9,h.cash+householdBonds(s,index)+h.foreignSavingsUSD*s.exchangeRate)})),
  initialRealConsumptionRate:.55*((s.monetary?.effectiveRate??s.policy.rate)/100-s.expectedInflation)+.45*((1+s.bank.depositRate)/(1+s.expectedInflation)-1)};
}
export function macroInvestment(s,prev,investmentPrice,depreciation,potentialRatios){
 const m=s.economy.macro,p=s.economy.parameters,realBorrow=(1+s.bank.lendingRate)/(1+s.expectedInflation)-1;
 const tax=s.policy.corporateTax/100*s.institutions.taxCompliance;
 const risk=p.riskPrice*(1-s.institutions.contractReliability)+s.institutions.ownershipRisk*.08;
 return s.firms.map((f,i)=>{
  const debtShare=clamp((f.loanLC+f.loanFX*s.exchangeRate)/(f.capital*investmentPrice),0,1);
  const explicitCost=userCost({realBorrow,debtShare,equityReturn:s.parameters.neutralRealRate,risk,depreciation,tax});
  const rawCost=explicitCost+m.firms[i].userCostResidual,cost=Math.max(.005,rawCost);
  const potentialValueAdded=m.firms[i].initialValueAdded*potentialRatios[i]*f.price;
  const target=equilibriumInvestment({valueAdded:potentialValueAdded,capitalShare:p.capitalShare,depreciation,growth:m.trendGrowth,annualUserCost:cost,investmentPrice});
  const correction=errorCorrection({previous:Math.max(1e-9,f.lastInvestment),target:Math.max(1e-9,target),speed:m.investmentSpeed});
  const desired=target===0?f.lastInvestment*(1-m.investmentSpeed):correction.value;
  const value=Math.max(1,f.capital*investmentPrice+f.cash-f.loanLC-f.loanFX*s.exchangeRate),yieldEquity=Math.max(0,f.lastProfit)*12/value;
  return {sector:i,desired,capital:f.capital,investmentPrice,expectedValueAdded:f.expectedValueAdded,potentialValueAdded,realBorrow,debtShare,depreciation,risk,tax,
   operatingYield:p.capitalShare*Math.max(0,f.expectedValueAdded)*12/Math.max(f.capital*investmentPrice,1e-9)*(1-tax)+depreciation*tax,
   required:cost,explicitUserCost:explicitCost,userCostResidual:m.firms[i].userCostResidual,userCostClamped:rawCost!==cost,
   expectedTrendGrowth:m.trendGrowth,unsmoothedTarget:target,previousInvestment:f.lastInvestment,investmentAdjustment:m.investmentSpeed,
   errorCorrection:correction.correction,shortRun:correction.shortRun,npvPerUnit:target/Math.max(f.lastInvestment,1e-9)-1,
   foreignScore:(1+yieldEquity)*1.02-1-(s.world.globalRate/100+.025+risk),expectedSalesRatio:f.salesExpected/Math.max(f.production,1e-9)};
 });
}
export function macroConsumption(s,h,index,effectiveRealRate,effectiveUnitPrice){
 const m=s.economy.macro,ref=m.households[index],cpi=s.consumerPriceIndex/100,pop=s.population/s.base.initialPopulation;
 const net=Math.max(1e-9,h.income-(h.interestPaid??0))/cpi;
 const wealth=Math.max(1e-9,h.cash+householdBonds(s,index)+h.foreignSavingsUSD*s.exchangeRate)/cpi;
 const rateResponse=Math.exp(clamp(-s.parameters.interestConsumptionElasticity*(effectiveRealRate-m.initialRealConsumptionRate),-1,1));
 const target=ref.consumption*Math.pow(net/ref.netIncome,m.incomeElasticity)*Math.pow(wealth/ref.wealth,m.wealthElasticity)*rateResponse;
 const previous=Math.max(1e-9,h.consumption),result=errorCorrection({previous,target:Math.max(1e-9,target),speed:m.consumptionSpeed});
 return {desired:target*effectiveUnitPrice,smoothed:result.value*effectiveUnitPrice,targetVolume:target,plannedVolume:result.value,rateResponse,netRealIncome:net,realWealth:wealth,populationScale:pop,errorCorrection:result.correction};
}
export function purchaseShare(p){return p.governmentConsumption+(p.militaryBudget??0)+p.publicInvestment+p.education+p.healthcare+p.childcareBudget+p.infrastructureMaintenance+.05+.25*(p.taxEnforcement/100)**2+p.antitrustBudget+p.courtBudget+p.soeAuditBudget+p.electionAdministration+p.securityBudget+p.patronageBudget;}
export function publicPolicyFromAccounts(base,accounts){
 const p={...base},fixed=.05+.25*(p.taxEnforcement/100)**2;
 const keys=['governmentConsumption','militaryBudget','education','healthcare','childcareBudget','infrastructureMaintenance','antitrustBudget','courtBudget','soeAuditBudget','electionAdministration','securityBudget','patronageBudget'];
 const variable=sum(keys.map(k=>p[k])),factor=(accounts.governmentConsumptionGDP-fixed)/variable;
 for(const k of keys)p[k]*=factor;
 return p;
}

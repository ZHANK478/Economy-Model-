import {worldDecisionEffects} from './world-decisions.js';
import {euroAdopted,euroExchangeRate,recordERMMonth} from './foreign-programme.js';
import {advanceGovernmentGoals} from './government-goals.js';
import {recordTradeCourseMonth} from './trade-course.js';
import {companyEconomyActive,prepareCompanySpecialization,prepareIndustrialCapacity} from './company-specialization.js';
import {initializeCompanyLocations} from './company-geography.js';
import {prepareTerritorialAssets,assignTerritorialAssets,sellTerritorialEquity,creditTerritorialNetwork,territorialNetworkPlan,payTerritorialDividends,financeTerritorialInvestment,validateTerritorialAssets} from './territorial-assets.js';
import {nationalProgrammeGDP,territorialProgrammeOrders,payTerritorialBusinessSupport,generalTerritorialGrants,payTerritorialBudgetGrants,settleTerritorialPrograms,territorialProgramSpending,validateTerritorialPrograms,depreciateTerritorialProgrammeAssets,recordTerritorialProgrammeAsset} from './territorial-programs.js';
import {initializeTerritorialGovernment,updateTerritorialOffices,territorialActive,territorialCash,territorialGeography,territorialBudgetPlan,prepareTerritorialFiscal,settleTerritorialPurchases,settleTerritorialTaxes,validateTerritorialGovernment} from './territorial-government.js';
import {territorialVotes} from './electorate.js';
import {updateRegionalStatus} from './regional-status.js';
import {updateTerritorialEvents} from './territorial-requests.js';
import {partnerTradeReport} from './trade-partners.js';
import {diplomacyActive,diplomacyShare,plannedDiplomacyContributions,repairExitedEUProgramme,scenarioOrganizations,settleScenarioDiplomacy} from './scenario-diplomacy.js';
import {characterPlayerIdentity,initializeCharacters,synchronizeCharacters,validateCharacters} from './character-world.js';
import {projectRegionalEconomy,updateRegionalProduction,validateRegionalEconomy} from './regional-economy.js';
import {initializeScenario,validateScenario,applyOpeningStocks} from './scenario-state.js';
import {initializeLivelihoods,prepareLivelihoods,enterFamilyBusinesses,familyLaborTargets,settleFamilyRent,finishLivelihoods,validateLivelihoods,familyCompanies,capFamilyFood,prepareFamilyPayroll,finishFamilyPayroll,familyNetDraw} from './livelihoods.js';
import {initializeRentSeeking,prepareRentSeeking,settleRentSeeking} from './rent-seeking.js';
import {initializeDurables,prepareDurables,consumerCreditLimit,recordConsumerLoan,retireConsumerCredit,serviceConsumerCredit,planDurableConsumption,settleDurables,finishDurables} from './durable-goods.js';
import {initializeTalent,advanceTalent,finishTalent} from './talent-migration.js';
import {initializeInternationalCapital,stampForeignFunding,recordForeignCompletion,finishInternationalCapital} from './international-capital.js';
import {syncFirmOwnership,initializeFirmMarkets,prepareFirmMarkets,financeFirmInvestment,firmProjectAllocation,completeFirmCapital,firmProfitPlan,resolveFirm,finishFirmMarket,validateFirmMarkets} from './firm-markets.js';
import {initializeOwners,prepareOwners,finishOwners,recordOwnerDividend} from './wealth-owners.js';
import {initializeSettlements,prepareSettlements,ownFoodBudget,reserveRelocation,finishSettlements,nationalRentFactor} from './settlements.js';
import {producerBasket,initializeHouseholdStructure} from './household-structure.js';
import {initializeServiceIndustries,prepareServiceIndustries,serviceInputMatrix,syncServiceCapital,refreshServiceCapacity,planServiceInvestment,serviceProjectAllocation,completeServiceCapital,settleServiceIndustries,validateServiceIndustries} from './service-industries.js';
import {initializePolicyReputation,reputationActive} from './policy-reputation.js';
import {initializePerformanceVoting,performanceActive} from './electoral-performance.js';
import {serviceCorporateBonds,corporateDebt,validateCorporateBonds} from './corporate-bonds.js';
import {initializeProductMarkets,prepareProductMarkets,productCapacityFactor,updateProductPrices,completeProductCapacity,settleProductMarkets,validateProductMarkets} from './product-markets.js';
import {initializeBusinessDynamics,prepareBusinessDynamics,tagInvestmentProject,recordProjectCompletion,finishBusinessDynamics,validateBusinessDynamics,businessDynamicsActive} from './business-dynamics.js';
import {syncEnterpriseOwnership,enterpriseBusinesses,enterpriseAvailableInventory,enterpriseEndingInventory,sectorCompanies,industryCompanies,initializeEnterpriseMarket,prepareEnterpriseMarket,financeEnterpriseInvestment,completeEnterpriseCapital,enterpriseProfitPlan,settleEnterpriseDividends,resolveEnterprise,finishEnterpriseMarket,validateEnterpriseMarket} from './enterprise-market.js';
import {importGoodsPrices,basketPrice} from './goods-prices.js';
import {settlementActive,supplySettlementCredit,treasuryPaymentOutlook} from './treasury-settlement.js';
import {agricultureActive,prepareAgriculture,finishAgriculture,foodReplacementUnit} from './agriculture.js';
import {initializeDefenseEconomy,defenseEconomicPlan,payDefenseWages,defenseGoodMix,validateDefenseEconomy} from './defense-economy.js';
import {socialActive,socialDeposits,socialFunds,initializeSocial,prepareSocial,updateUnemployment,socialTransferPlan,paySocialTransfers,socialCashBeforeSpending,socialPayroll,savePrivateProtection,socialHousingPrices,housingPayment,privateHousingPlan,completeHousing,finishSocial,validateSocial,settlePrivateHealthInsurance,investPensionBankShares} from './social-protection.js';
import {consumptionActive,initializeConsumption,groupBasket,basicNeeds,settleConsumption,validateConsumption} from './household-consumption.js';
import {foundationActive,initializeFoundation,prepareFoundation,matchEmployment,resolveBanking,reconcileBankBooks,networkFinance,networkReceipts,validateFoundation,sovereignPremium,institutionalCreditFactor} from './economic-foundation.js';
import {initializeLocalGovernment,prepareLocalGovernment,localGovernmentActive,localPublicInvestmentPlan,recordLocalServices,validateLocalGovernment} from './local-government.js';
import {prepareSupplyChains,supplySalesSignal} from './supply-chains.js';
import {initializeDefense,prepareDefenseMonth,defenseGovernmentMix,defenseCapacityFactor,advanceDefense,defenseMetrics,validateDefense} from './defense.js';
import {settleBankForeignInterest,initializeNonbankHolders,nonbankDebt,bankBondPrincipal,subscribeHouseholds,domesticCouponShares,distributeCoupon,redeemDomestic} from './bond-market.js';
import {calibrateMacroCore,macroConsumption,purchaseShare,monthlyDepreciation} from './macro-core.js';
import {validateInitialAccounts} from './national-accounts.js';
import {CALCULATION_BUILD,accountSnapshot,initialDiagnostic,diagnosticWarnings,diagnosticEnvelope} from './calculation-diagnostics.js';
import {validateInitialMacro} from './macro-observations.js';
import {allocateMarket,allocateMarketWithStocks,allocateMarketWithReservedStocks} from './market-allocation.js';
import {historicalWorldFactors} from './historical-world.js';
import {worldEvent} from './world-events.js';
import {validateStructure} from './economic-structure.js';
import {OPEN_INPUTS,initializeOpenEconomy,initializeWorldAccounts,advanceWorldEconomy,sectorCapacity,structuralLaborDemand,structuralDepreciation,exportDemand,importUnitPrice,domesticImportShare,investmentOpportunities,consumptionWeights as structuralConsumptionWeights,foreignFinancing,foreignCreditLimitUSD,completeTechnology,observeOperatingSurplus,openEconomyMetrics,validateOpenEconomy,actuarialSpread} from './open-economy.js';
import {createDemography,matchInitialLifeExpectancy,advanceDemography,demographicMetrics,cohortTotals} from './demography.js';
import {VERSION,SECTORS,INPUTS,GROUPS,BASE_POLICY,POLICY_FIELDS,POLICY_CHECKS,POLICY_CHOICES,PARAMETERS,WORLD,MODEL_PROFILES} from './config.js';
import {initializePolitics,reviewPolicy,advancePolitics,politicsMetrics} from './politics.js';
import {regimeActive,initializeRegimeDynamics,regimeWorkFactor,regimeInvestmentPremium} from './regime-dynamics.js';
import {initializePoliticalSystem,schedulePolitical,executePolitical,validatePoliticalSystem} from './political-system.js';
export {schedulePolitical,executePolitical};
import {initializeMonetary,advanceMonetary,fixedExchange,hasDiscretionaryCB,monetaryMetrics} from './monetary.js';
import {initializeLabor,advanceLabor,laborWageShares,laborMetrics,initializeLaborDistribution,advanceLaborDistribution} from './labor.js';
import {initializeInfrastructure,prepareInfrastructure,infrastructurePlans,completeInfrastructure,settleInfrastructure,synchronizeInfrastructure,infrastructureMetrics,scheduleNetwork,executeNetworkTransfers} from './infrastructure.js';
import {validateExtendedState} from './state-validation.js';
import {initializeServices,privateServicePlans,settleServices,servicesMetrics} from './services.js';
import {initializeInstitutions,advanceInstitutionOutcomes,governanceTarget,fundInstitutionServices,institutionMetrics} from './institutions.js';
import {advanceEducation,socialIndicators} from './indicators.js';
import {initializeJournal,appendJournal} from './journal.js';
import {enterpriseValue,scheduleOwnership,executeOwnership} from './ownership.js';
import {refinancingRisk,openDefaultEpisode,debtInDefault,restructureDebt} from './sovereign.js';
export {scheduleOwnership,scheduleNetwork};

// Monetary amounts: million units of local currency (LC); foreign stocks: million USD.
// Volumes: million LC at the scenario start basic prices. Population/workers: million people.
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const sum=a=>a.reduce((s,v)=>s+v,0);
export const copy=x=>JSON.parse(JSON.stringify(x));
export const annualToMonthly=r=>Math.expm1(Math.log1p(r)/12);
export const monthlyToAnnual=r=>Math.expm1(Math.log1p(r)*12);
export const realInterestRate=(nominal,expected)=>(1+nominal)/(1+expected)-1;
const dot=(a,b)=>sum(a.map((v,i)=>v*b[i]));
const normalize=a=>a.map(v=>v/sum(a));
const colsum=(j,matrix=INPUTS)=>sum(matrix.map(row=>row[j]));
export const inputMatrix=s=>serviceInputMatrix(s,s.economy?OPEN_INPUTS:INPUTS);
const zeros=()=>Array(5).fill(0);
const logRatio=(x,y)=>Math.log(Math.max(x,1e-9)/Math.max(y,1e-9));
const yearCoupon=(amount,rate)=>amount*rate/12; // Coupon contracts are nominal APR.

export function solveLeontief(finalDemand,matrix=INPUTS) {
  const a=matrix.map((row,i)=>row.map((x,j)=>(i===j?1:0)-x).concat(finalDemand[i]));
  for(let k=0;k<5;k++) {
    let pivot=k;
    for(let i=k+1;i<5;i++) if(Math.abs(a[i][k])>Math.abs(a[pivot][k])) pivot=i;
    [a[k],a[pivot]]=[a[pivot],a[k]];
    const d=a[k][k];
    if(Math.abs(d)<1e-12) throw new Error('Сингулярная матрица межотраслевых связей');
    for(let j=k;j<6;j++) a[k][j]/=d;
    for(let i=0;i<5;i++) if(i!==k) {
      const f=a[i][k];
      for(let j=k;j<6;j++) a[i][j]-=f*a[k][j];
    }
  }
  return a.map(row=>row[5]);
}

// Shocks depend only on seed and month, never on policy or number of calls.
function uniform(seed,month,channel) {
  let x=(seed ^ Math.imul(month+1,0x9e3779b1) ^ Math.imul(channel+1,0x85ebca6b))>>>0;
  x^=x>>>16; x=Math.imul(x,0x7feb352d); x^=x>>>15; x=Math.imul(x,0x846ca68b); x^=x>>>16;
  return ((x>>>0)+.5)/4294967296;
}
function noise(seed,month,channel) {
  return Math.sqrt(-2*Math.log(uniform(seed,month,channel*2)))*Math.cos(2*Math.PI*uniform(seed,month,channel*2+1));
}

function borrowers(s) {return [...s.households,...s.firms.flatMap((f,i)=>sectorCompanies(s,i).length?sectorCompanies(s,i):[f]),...(foundationActive(s)&&s.foundation?s.networks.map(n=>n.operator):[])];}
function deposits(s) {return sum(borrowers(s).map(x=>x.cash))+s.government.cash+territorialCash(s)+socialDeposits(s);}
function privateLoans(s) {return sum(borrowers(s).map(x=>x.loanLC+x.loanFX*s.exchangeRate));}
function domesticDebt(s) {return sum(s.government.domesticBonds.map(x=>x.principal));}
function externalDebtUSD(s) {return sum(s.government.externalBonds.map(x=>x.principal));}
function bankAssets(s) {
  return privateLoans(s)+domesticDebt(s)-nonbankDebt(s)+s.bank.reserves+s.bank.foreignAssetsUSD*s.exchangeRate;
}
function bankResidual(s) {return bankAssets(s)-deposits(s)-s.bank.centralBorrowing-(s.bank.foreignArrearsUSD??0)*s.exchangeRate-s.bank.equity;}
function netForeignAssetsUSD(s) {
  return s.bank.foreignAssetsUSD-(s.bank.foreignArrearsUSD??0)+s.government.reservesUSD+s.government.fundUSD
    +sum(s.households.map(h=>h.foreignSavingsUSD))-externalDebtUSD(s)-sum(s.firms.map(f=>f.foreignEquityUSD));
}
function riskAssets(s) {
  const fx=Math.max(0,s.bank.foreignAssetsUSD)*s.exchangeRate;
  const openPosition=s.policy.monetaryRegime==='dollarized'?0:Math.abs(s.bank.foreignAssetsUSD-(s.bank.foreignArrearsUSD??0)+sum(borrowers(s).map(a=>a.loanFX)))*s.exchangeRate;
  return privateLoans(s)+(.2+(s.government.defaultActive?.8:0))*(domesticDebt(s)-nonbankDebt(s))+s.parameters.foreignAssetRiskWeight*fx+s.parameters.fxRiskWeight*openPosition;
}
function bankCapital(s) {return s.bank.equity/Math.max(1,riskAssets(s));}
function bankLeverage(s) {return s.bank.equity/Math.max(1,bankAssets(s)+Math.max(0,-s.bank.foreignAssetsUSD)*s.exchangeRate);}
function bankLiquidityCoverage(s) {return (s.bank.reserves+.8*Math.max(0,s.bank.foreignAssetsUSD)*s.exchangeRate+.8*domesticDebt(s))/Math.max(1,deposits(s)*s.parameters.liquidityOutflowRate);}
function settleLiquidity(s,flow) {
  const b=s.bank,desired=s.policy.reserveRequirement/100*Math.max(0,deposits(s));
  // CB acquires foreign currency in exchange for domestic reserve balances.
  // It is a balance-sheet swap: no GDP, fiscal revenue, or new bank equity.
  const excessFX=Math.max(0,b.foreignAssetsUSD*s.exchangeRate-bankAssets(s)*s.parameters.fxPortfolioShare);
  const convert=s.policy.monetaryRegime==='freeBanking'?0:Math.min(Math.max(0,b.foreignAssetsUSD)*s.exchangeRate,Math.max(desired-b.reserves,fixedExchange(s)?0:excessFX,0));
  b.foreignAssetsUSD-=convert/s.exchangeRate;b.reserves+=convert;s.government.reservesUSD+=convert/s.exchangeRate;
  flow.reserveConversion=(flow.reserveConversion??0)+convert;
  if(fixedExchange(s)){
    // Redeem reserve balances against actual foreign money; assets and liabilities
    // fall together. No discretionary domestic lender of last resort exists.
    const redeem=Math.min(Math.max(0,-b.foreignAssetsUSD),s.government.reservesUSD,Math.max(0,b.reserves)/s.exchangeRate);
    b.foreignAssetsUSD+=redeem;b.reserves-=redeem*s.exchangeRate;s.government.reservesUSD-=redeem;
    flow.reserveRedemption=(flow.reserveRedemption??0)+redeem*s.exchangeRate;
  }
  if(b.reserves<desired&&s.policy.liquiditySupport&&hasDiscretionaryCB(s)){const loan=desired-b.reserves;b.reserves+=loan;b.centralBorrowing+=loan;}
  if(b.reserves>desired*1.15&&b.centralBorrowing>0){const repay=Math.min(b.centralBorrowing,b.reserves-desired*1.15);b.reserves-=repay;b.centralBorrowing-=repay;}
}
function transfer(from,to,amount) {from.cash-=amount; to.cash+=amount;}
function foreignPayment(s,actor,usd,flow=null) {
  if(s.economy?.revision>=23&&actor===s.government&&usd<0&&flow)flow.treasuryFundFXUSD=Math.max(0,(flow.treasuryFundFXUSD??0)+usd);
  actor.cash+=usd*s.exchangeRate;
  s.bank.foreignAssetsUSD+=usd;
}
function availableForeignLiquidity(s){
  if(!s.economy)return Infinity;
  return Math.max(0,s.bank.foreignAssetsUSD+foreignCreditLimitUSD(s)+(fixedExchange(s)?Math.min(s.government.reservesUSD,Math.max(0,s.bank.reserves)/s.exchangeRate):0));
}
// Official reserves are central-bank assets. Settling a Treasury FX payment
// exchanges bank reserve balances for FX, then debits the Treasury deposit.
// No budget revenue, new government borrowing or bank equity is created.
export function treasuryForeignLiquidity(s,requestedUSD,flow){
  // Liquidation of Treasury-owned foreign assets is not private bank borrowing.
  // Even a bank already beyond its credit line can pass these exact proceeds
  // to a sovereign creditor. Never count them twice with usable bank FX.
  const fundFX=s.economy?.revision>=23?Math.min(flow.treasuryFundFXUSD??0,Math.max(0,s.government.cash)/s.exchangeRate):0;
  const privateLiquidity=Math.max(availableForeignLiquidity(s),fundFX);
  if(!(s.economy?.revision>=3))return privateLiquidity;
  if(settlementActive(s)){
    const wantedUSD=Math.min(Math.max(0,requestedUSD-privateLiquidity),Math.max(0,s.government.reservesUSD),Math.max(0,s.government.cash)/s.exchangeRate);
    supplySettlementCredit(s,Math.max(0,wantedUSD*s.exchangeRate-s.bank.reserves),flow);
  }
  const convert=Math.min(Math.max(0,requestedUSD-privateLiquidity),Math.max(0,s.government.reservesUSD),Math.max(0,s.bank.reserves)/s.exchangeRate,Math.max(0,s.government.cash)/s.exchangeRate);
  s.government.reservesUSD-=convert;s.bank.reserves-=convert*s.exchangeRate;s.bank.foreignAssetsUSD+=convert;
  flow.reserveRedemption=(flow.reserveRedemption??0)+convert*s.exchangeRate;
  // Treasury's own reserve conversion is usable for its payment even when the
  // commercial bank has already breached its private credit line. Re-applying
  // that line here incorrectly confiscated official FX and created a default.
  return s.economy.revision>=4?privateLiquidity+convert:availableForeignLiquidity(s);
}
function payTreasuryExternal(s,dueUSD,flow){
  const before={cashLC:s.government.cash,reservesUSD:s.government.reservesUSD,bankReservesLC:s.bank.reserves};
  const priorCredit=flow.settlementCredit??0,priorSale=flow.reserveRedemption??0;
  const fundedUSD=Math.min(Math.max(0,dueUSD),Math.max(0,s.government.cash)/s.exchangeRate);
  const usable=treasuryForeignLiquidity(s,fundedUSD,flow),paid=Math.min(fundedUSD,usable);
  foreignPayment(s,s.government,-paid,flow);
  const short=dueUSD-paid>Math.max(1e-8,dueUSD*1e-9);
  const reason=!short?null:fundedUSD<dueUSD-1e-8?'budget-cash':s.government.reservesUSD>1e-8?'settlement-liquidity':'foreign-currency';
  (flow.treasuryPayments??=[]).push({dueUSD,paidUSD:paid,reason,before,reservesUsedUSD:((flow.reserveRedemption??0)-priorSale)/s.exchangeRate,settlementCreditLC:(flow.settlementCredit??0)-priorCredit});
  return paid;
}
function grantLoan(s,actor,amount,fxShare=0) {
  if(amount<=0) return;
  const old=actor.loanLC+actor.loanFX*s.exchangeRate;
  actor.loanLC+=amount*(1-fxShare);
  actor.loanFX+=amount*fxShare/s.exchangeRate;
  actor.cash+=amount;
  actor.averageRate=(actor.averageRate*old+s.bank.lendingRate*amount)/Math.max(old+amount,1);
}
function writeOff(s,actor,fraction) {
  const amount=(actor.loanLC+actor.loanFX*s.exchangeRate)*fraction;
  actor.loanLC*=1-fraction; actor.loanFX*=1-fraction; s.bank.equity-=amount;retireConsumerCredit(s,actor,amount,'writeOff');
  return amount;
}
function repayLoan(s,actor,amount) {
  const total=actor.loanLC+actor.loanFX*s.exchangeRate;
  const value=Math.min(amount,total,Math.max(0,actor.cash));
  if(total>0) {actor.loanLC*=1-value/total; actor.loanFX*=1-value/total;}
  actor.cash-=value;retireConsumerCredit(s,actor,value);
  return value;
}
function issueDomestic(s,amount,flow) {
  if(amount<=0) return;
  s.government.domesticBonds.push({principal:amount,rate:(s.monetary?.effectiveRate??s.policy.rate)/100+flow.sovereignSpread,maturity:s.month+60,...(foundationActive(s)?{issuedMonth:s.month}:{})});
  s.government.cash+=amount; flow.domesticIssued+=amount;
}
function issueExternal(s,amountLC,flow) {
  if(amountLC<=0) return;
  const usd=amountLC/s.exchangeRate;
  s.government.externalBonds.push({principal:usd,rate:flow.foreignRate+flow.sovereignSpread,maturity:s.month+84,...(foundationActive(s)?{issuedMonth:s.month}:{})});
  foreignPayment(s,s.government,usd); flow.externalIssued+=usd;
}
export function withdrawTreasuryFund(s,neededLC,flow){
  const g=s.government;
  const usd=Math.min(Math.max(0,g.fundUSD),Math.max(0,neededLC-g.cash)/s.exchangeRate);
  if(usd>0){g.fundUSD-=usd;foreignPayment(s,g,usd);flow.fundWithdrawal=(flow.fundWithdrawal??0)+usd*s.exchangeRate;if(s.economy?.revision>=23)flow.treasuryFundFXUSD=(flow.treasuryFundFXUSD??0)+usd;}
  return usd;
}
function fundGovernment(s,needed,flow) {
  // Revision 23: the existing fund is a liquid Treasury-owned FX asset, unlike
  // central-bank reserves. Liquidate only the cash shortfall before issuing debt.
  if(s.economy?.revision>=23)withdrawTreasuryFund(s,needed,flow);
  const cashBefore=s.government.cash;
  const shortage=Math.max(0,needed-s.government.cash);
  if(!shortage) return;
  const gdpAnnual=Math.max(s.metrics.nominalGDPAnnual,100);
  const debt=domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate;
  const capacity=Math.max(0,s.parameters.maximumPublicDebtRatio*gdpAnnual-debt);
  const amount=Math.min(shortage,capacity);
  const access=clamp(s.institutions.confidence*(1-Math.max(0,debt/gdpAnnual-1)*.8),0,1)
    *(s.government.defaultActive||s.month<s.government.excludedUntil||flow.marketClosed?0:1);
  let foreign=amount*s.policy.foreignBorrowingShare/100*access;
  if(s.economy){
    const e=s.economy,pool=(e.globalCapitalBudgetUSD??e.previousWorldGDP/12*e.parameters.globalCrossBorderShare)*Math.pow(gdpAnnual/s.exchangeRate/e.previousWorldGDP,.85)*.3;
    const debtHeadroom=Math.max(0,gdpAnnual/s.exchangeRate*(.20+.70*s.institutions.contractReliability)-externalDebtUSD(s));
    foreign=Math.min(foreign,pool*s.exchangeRate,debtHeadroom*s.exchangeRate);
  }
  const bondWeight=s.economy&&s.government.defaultActive?1:.2;
  const bankHeadroom=Math.max(0,(s.bank.equity/(s.policy.bankCapitalRequirement/100)-riskAssets(s))/bondWeight);
  const domestic=Math.min(amount-foreign,bankHeadroom,Math.max(0,gdpAnnual*.12))*((s.economy?.revision??0)>=21?access:1);
  issueExternal(s,foreign,flow); issueDomestic(s,domestic,flow);
  const nonbank=subscribeHouseholds(s,Math.max(0,amount-foreign-domestic),flow);
  flow.unfunded+=shortage-foreign-domestic-nonbank;
  (flow.financingRequests??=[]).push({needed,cashBefore,shortage,debt,gdpAnnual,debtCeilingHeadroom:capacity,marketAccess:access,bankHeadroom,bondWeight,domesticIssued:domestic,nonbankIssued:nonbank,foreignIssuedLC:foreign,unfunded:shortage-foreign-domestic-nonbank});
}

export function sanitizePolicy(policy) {
  // Keep only real instruments. Old quality targets must not leak into journals
  // as apparently operative decisions after the equations have changed.
  const p=Object.fromEntries(Object.entries(BASE_POLICY).map(([key,value])=>[key,policy?.[key]??(key==='localElections'?(policy?.competitiveElections??value):value)]));
  for(const [key,,min,max] of POLICY_FIELDS) {
    if(!Number.isFinite(Number(p[key]))) throw new Error(`Некорректный параметр: ${key}`);
    p[key]=clamp(Number(p[key]),min,max);
    if(key==='registrationProcedures')p[key]=Math.round(p[key]);
  }
  for(const [key] of POLICY_CHECKS)p[key]=Boolean(p[key]);
  for(const [key,,,choices] of POLICY_CHOICES)if(!choices.some(([value])=>value===p[key]))throw new Error(`Неизвестный режим: ${key}`);
  return p;
}

function validateParameters(parameters) {
  if(!parameters||Object.keys(parameters).length!==Object.keys(PARAMETERS).length)throw new Error('Неполный набор параметров модели');
  const fractions=new Set(['annualDepreciation','annualInfrastructureDepreciation','pricePersistence','expectationAdjustment','investmentAdjustment','ratePassThrough','oldLoanRepricing','wageAdjustment','employmentAdjustment','inventoryAdjustment','dividendPayout','fertilityAdjustment','healthAdjustment','migrationAdjustment','skillsAdjustment','depositRateAdjustment','reserveRemunerationShare','liquidityOutflowRate','minimumLeverageRatio','fxPortfolioShare','expectationsAnchor','governanceAdjustment','ownershipRiskDecay','institutionCapacityAdjustment','competitionAdjustment','bankContestabilityAdjustment','institutionServiceProductivity','initialChildShare','initialElderlyShare','initialHousingBurden','laborMarkdown','unionAdjustment','unionWageCompression','politicalAdjustment','privateInfrastructureAdjustment','serviceCapacityAdjustment','infrastructureMaintenanceRate']);
  const periods=new Set(['pregnancyDelay','privateInvestmentDelay','publicInvestmentDelay','restructuringDelay','marketExclusionMonths']);
  for(const [key,value] of Object.entries(parameters)){
    if(!(key in PARAMETERS)||!Number.isFinite(value))throw new Error('Некорректные параметры модели');
    if(key!=='refinancingRiskIntercept'&&value<0)throw new Error(`Отрицательный параметр: ${key}`);
    if(fractions.has(key)&&(value>1||(['annualDepreciation','annualInfrastructureDepreciation'].includes(key)&&value===1)))throw new Error(`Параметр вне доли 0–1: ${key}`);
    if(periods.has(key)&&(!Number.isInteger(value)||value<1||value>600))throw new Error('Срок должен быть целым числом от 1 до 600 месяцев');
  }
  if(parameters.pppConversionFactor<=0||parameters.absolutePovertyRealMonthly<=0||parameters.liquidityOutflowRate<=0)throw new Error('Некорректная денежная или ликвидная база');
  if(parameters.initialChildShare+parameters.initialElderlyShare>=.9||parameters.initialChildShare<=0||parameters.initialElderlyShare<=0||parameters.initialHousingBurden<=0)throw new Error('Некорректная возрастная или жилищная структура');
}

export function createSimulation(options={}) {
  const initialAccounts=options.initialAccounts?validateInitialAccounts(options.initialAccounts):null;
  const initialMacro=options.initialMacro?validateInitialMacro(options.initialMacro):null;
  const structure=options.economicStructure?validateStructure(options.economicStructure):null;
  const initialGDPPerCapita=options.initialGDPPerCapita??6000;
  if(!Number.isFinite(initialGDPPerCapita)||initialGDPPerCapita<100||initialGDPPerCapita>100000)throw new Error('Некорректный начальный ВВП на человека');
  const initialPopulation=options.initialPopulation??10;
  if(!Number.isFinite(initialPopulation)||initialPopulation<=0||initialPopulation>2000)throw new Error('Некорректное начальное население');
  const incomeScale=initialGDPPerCapita/6000*(initialPopulation/10),initialAnnualGDP=initialGDPPerCapita*initialPopulation,initialMonthlyGDP=initialAnnualGDP/12;
  const resource=options.resourceMode!==false;
  if(initialMacro&&!structure)throw new Error('Макроэкономические ориентиры требуют структурной экономики');
  const p=sanitizePolicy(options.policy);
  const parameters={...PARAMETERS,...options.parameters};
  validateParameters(parameters);
  const householdDetail=structure&&(options.economicRevision??5)>=19;
  let foodChain=[1,0,0];
  let consumptionWeights=structure?[...structure.consumptionWeights]:[.28,.08,.23,.07,.34];
  const investmentWeights=[.01,.08,.31,.55,.05];
  const governmentWeights=[.03,.06,.14,.28,.49];
  const exportWeights=resource?(structure?[.04,.64,.22,.00,.10]:[.10,.64,.16,.00,.10]):structure?[...structure.exportWeights]:[.18,.08,.46,.00,.28];
  const serviceBudgetShare=initialAccounts?Math.min(.5,(p.privateHealthEntry?parameters.privateHealthDemand+.11*(1-structure.healthAccess):0)+(p.privateEducationEntry?parameters.privateEducationDemand+.08*(1-Math.min(1,structure.expectedSchooling/12))+.003:0)+.024):0;
  const serviceVolumeShare=serviceBudgetShare/(serviceBudgetShare+(1-serviceBudgetShare)/(1+p.vat/100));
  const [C,I,G]=initialAccounts?[initialAccounts.consumptionGDP/(1+(1-serviceVolumeShare)*p.vat/100),initialAccounts.investmentGDP-p.publicInvestment,initialAccounts.governmentConsumptionGDP+p.publicInvestment]:[2500,1000,700];let X=1700;
  if([C,I,G,X].some(x=>!Number.isFinite(x)||x<=0)) throw new Error('Некорректный начальный спрос');
  let cf=.16,iv=.40,gv=.13;const matrix=structure?OPEN_INPUTS:INPUTS;
  let importCoefficients=[.06,.07,.18,.10,.035];
  const initialMarket=(basket,importShare)=>{
    const va=importCoefficients.map((v,i)=>1-colsum(i,matrix)-v);
    const domestic=zeros().map((_,i)=>C*(1-serviceVolumeShare)*(1-importShare)*basket[i]+(i===4?C*serviceVolumeShare:0)+I*(1-iv)*investmentWeights[i]+G*(1-gv)*governmentWeights[i]);
    const noExports=solveLeontief(domestic,matrix),exportUnit=solveLeontief(exportWeights,matrix);
    const x=structure?structure.exportGDPShare*(dot(noExports,va)+C*(1-serviceVolumeShare)*(initialAccounts?p.vat:BASE_POLICY.vat)/100)/(1-structure.exportGDPShare*dot(exportUnit,va)):X;
    const output=noExports.map((v,i)=>v+exportUnit[i]*x),gdp=dot(output,va)+C*(1-serviceVolumeShare)*(initialAccounts?p.vat:BASE_POLICY.vat)/100;
    const imports=C*(1-serviceVolumeShare)*importShare+I*iv+G*gv+dot(output,importCoefficients);
    return {output,gdp,x,imports,agricultureShare:output[0]*va[0]/gdp};
  };
  if(structure){
    const initialBasket=[...consumptionWeights];
    const fitAgriculture=importShare=>{
      let lo=.0001,hi=.85,basket;
      for(let j=0;j<35;j++){
        const food=(lo+hi)/2;basket=initialBasket.map((v,i)=>i===0?food:v*(1-food)/(1-initialBasket[0]));
        if(initialMarket(basket,importShare).agricultureShare<structure.agricultureGDPShare)lo=food;else hi=food;
      }
      return basket;
    };
    let lo=.01,hi=1.8;
    for(let j=0;j<35;j++){
      const intensity=(lo+hi)/2;
      cf=.16*intensity;iv=.40*intensity;gv=.13*intensity;
      importCoefficients=[.06,.07,.18,.10,.035].map(v=>v*intensity);
      if(householdDetail){
        let low=0,high=1;
        for(let k=0;k<35;k++){
          const raw=(low+high)/2,chain=[raw,(1-raw)*.65,(1-raw)*.35];
          if(initialMarket(producerBasket(initialBasket,chain),cf).agricultureShare<structure.agricultureGDPShare)low=raw;else high=raw;
        }
        const raw=(low+high)/2;foodChain=[raw,(1-raw)*.65,(1-raw)*.35];
        consumptionWeights=producerBasket(initialBasket,foodChain);
      }else consumptionWeights=fitAgriculture(cf);
      const market=initialMarket(consumptionWeights,cf);
      if(market.imports/market.gdp<structure.importGDPShare)lo=intensity;else hi=intensity;
    }
  }
  const calibrated=initialMarket(consumptionWeights,cf),q=calibrated.output,baseGDP=calibrated.gdp;X=calibrated.x;
  const scale=initialMonthlyGDP/baseGDP;
  const baseOutput=q.map(v=>v*scale);
  const initialWorkers=initialPopulation*(1-parameters.initialChildShare-parameters.initialElderlyShare)*.70*.91;
  const workerShares=structure?[...structure.workerShares]:resource?[.20,.07,.20,.13,.40]:[.20,.035,.25,.13,.385];
  const householdCash=GROUPS.map(g=>32700*incomeScale*(g.dividendShare*.8+g.wageShare*.2));
  const hhShares=GROUPS.map(g=>g.wageShare*.8+g.dividendShare*.2);
  const s={
    version:VERSION,...(initialMacro?{initialMacro}:{}),month:0,startYear:options.startYear??2000,resourceMode:resource,
    ...(initialAccounts?{initialAccounts}:{}),
    seed:Number(options.seed??42)>>>0,stochastic:Boolean(options.stochastic),
    policy:p,parameters,world:{...WORLD,...options.world},shocks:[],modelProfile:options.modelProfile??'balanced',
    population:initialPopulation,ageCohorts:initialPopulation===10?[2.8,6.5,.7]:[.28,.65,.07].map(x=>x*initialPopulation),participation:.70,workingAgeShare:.65,exchangeRate:1,
    expectedInflation:initialMacro?.inflationAnnual??.08,inflationLogMonthly:Math.log1p(initialMacro?.inflationAnnual??.08)/12,
    consumerPriceIndex:100,worldPriceIndex:100,skills:1,
    infrastructure:initialAnnualGDP*(structure?.infrastructureRatio??.60),initialInfrastructure:initialAnnualGDP*(structure?.infrastructureRatio??.60),
    institutions:{confidence:.68,informality:.28,taxCompliance:.78,competition:.60,investmentEfficiency:.70,ownershipRisk:0},
    education:{access:1,meanYears:8,expectedYears:12},
    base:{monthlyGDP:initialMonthlyGDP,output:baseOutput,consumption:C*scale,investment:I*scale,government:G*scale,exports:X*scale,
      consumptionWeights,...(householdDetail?{consumerBasket:[...structure.consumptionWeights],foodChain,foodCalibration:{targetAgricultureShare:structure.agricultureGDPShare,actualAgricultureShare:calibrated.agricultureShare}}:{}),investmentWeights,governmentWeights,exportWeights,consumptionImport:cf,investmentImport:iv,governmentImport:gv,
      initialPopulation,referenceIncome:0,initialGroupIncomes:[],initialRate:.03},
    households:GROUPS.map((g,i)=>({...g,cash:householdCash[i],loanLC:8000*incomeScale*hhShares[i],loanFX:2000*incomeScale*g.dividendShare,
      averageRate:.15,foreignSavingsUSD:2500*incomeScale*g.dividendShare,income:((C*scale*hhShares[i]/g.mpc)-householdCash[i]*parameters.wealthAnnuity),
      consumption:C*scale*hhShares[i],realIncomeIndex:100})),
    firms:SECTORS.map((sector,i)=>({id:sector.id,name:sector.name,price:1,inventory:baseOutput[i]*.15,
      production:baseOutput[i],salesExpected:baseOutput[i],workers:initialWorkers*workerShares[i],
      laborProductivity:baseOutput[i]/(initialWorkers*workerShares[i]),capacity:baseOutput[i]/.90,
      capital:baseOutput[i]/.90*12*1.35,initialCapital:baseOutput[i]/.90*12*1.35,
      productivity:1,wage:2500*incomeScale*workerShares[i]/(initialWorkers*workerShares[i]),
      cash:baseOutput[i]*2.2,loanLC:baseOutput[i]*2.6,loanFX:resource&&i===1?baseOutput[i]*.9:baseOutput[i]*.2,
      averageRate:.14,foreignEquityUSD:baseOutput[i]*.18,importCoefficient:importCoefficients[i],
      lastProfit:baseOutput[i]*.10,lastRevenue:baseOutput[i],lastInvestment:I*scale*workerShares[i],
      defaulted:false,utilization:.90,arrears:0,
      ownership:{state:[.05,.30,.10,.05,.15][i],foreign:.18,domestic:1-.18-[.05,.30,.10,.05,.15][i],municipal:0,cooperative:0},workerOwners:Array(10).fill(0),
      domesticOwners:GROUPS.map(g=>g.dividendShare*(1-.18-[.05,.30,.10,.05,.15][i])),
      governance:.65,managementEfficiency:1,reorganization:0,softBudget:0})),
    government:{cash:3000*incomeScale,reservesUSD:8000*incomeScale,fundUSD:resource?2000*incomeScale:0,
      domesticBonds:Array.from({length:60},(_,i)=>({principal:21000*incomeScale/60,rate:.09,maturity:i+1})),
      externalBonds:Array.from({length:84},(_,i)=>({principal:9000*incomeScale/84,rate:.065,maturity:i+1})),
      lastDeficit:0,arrears:0,defaults:0,defaultActive:false,defaultStart:null,defaultEpisodes:[],excludedUntil:0},
    bank:{equity:0,reserves:3500*incomeScale,centralBorrowing:0,foreignAssetsUSD:0,lendingRate:.15,depositRate:.065,npl:.04,creditSupply:1,stateOwnership:0},
    centralBank:{equity:0,deferredLoss:0,lastProfit:0,lastRemittance:0},
    projects:[],history:[],incomeHistory:[],lastReport:{events:[],channels:[],fiscal:{},audit:{}},
    metrics:{nominalGDPAnnual:initialAnnualGDP,realGDPMonthly:initialMonthlyGDP,nominalGDPMonthly:initialMonthlyGDP}
  };
  if(!(s.modelProfile in MODEL_PROFILES))throw new Error('Неизвестный профиль модели');
  initializeInstitutions(s);
  initializePolitics(s);initializeMonetary(s);initializeLabor(s);initializeServices(s);initializeInfrastructure(s);
  if(structure){s.base.imports=calibrated.imports*scale;initializeOpenEconomy(s,structure,options.economicParameters,options.economicRevision??5);s.parameters.annualDepreciation=structuralDepreciation(s);}
  if(initialMacro){
    // Missing French lending data uses an explicit model spread over observed
    // deposits; it must not be mistaken for a measured French lending rate.
    const lending=initialMacro.lendingRateAnnual??initialMacro.depositRateAnnual+.025+.15*s.bank.npl+.035*(1-s.institutions.confidence);
    s.bank.lendingRate=lending;s.bank.depositRate=initialMacro.depositRateAnnual;
    for(const a of borrowers(s))a.averageRate=lending;
  }
  initializeJournal(s);
  if(options.initialPopulation!==undefined)s.provenance.initialPopulation=initialPopulation;
  if(options.scenario)initializeScenario(s,options.scenario);
  initializeWorldAccounts(s);
  if(options.initialServiceShares){const a=options.initialServiceShares;if(!Array.isArray(a)||a.length!==8||a.some(x=>!Number.isFinite(x)||x<=0)||Math.abs(sum(a)-1)>1e-9)throw Error('Некорректная структура услуг');s.initialServiceShares=copy(a);s.provenance.initialServiceShares=copy(a);}
  if(initialMacro)s.provenance.initialMacro=copy(initialMacro);
  if(initialAccounts)s.provenance.initialAccounts=copy(initialAccounts);
  if(structure){s.provenance.economicStructure=copy(structure);s.provenance.initialEconomicParameters=copy(s.economy.parameters);s.provenance.initialEconomicRevision=s.economy.revision;}
  if(options.initialGDPPerCapita!==undefined)s.provenance.initialGDPPerCapita=initialGDPPerCapita;
  s.bank.equity=bankAssets(s)-deposits(s);
  s.base.referenceIncome=sum(s.households.map(h=>h.income));
  s.base.initialGroupIncomes=s.households.map(h=>h.income);
  s.incomeHistory=Array.from({length:12},(_,i)=>({month:i-11,population:s.population,cpi:100,net:s.households.map(h=>h.income),market:s.households.map(h=>h.income),synthetic:true}));
  s.lastReport.world={...WORLD};
  for(let m=1;m<=parameters.privateInvestmentDelay;m++) {
    for(let i=0;i<5;i++) s.projects.push({type:'private',sector:i,amount:s.economy?s.firms[i].lastInvestment:s.base.investment*workerShares[i],due:m,efficiency:1,legacy:true});
  }
  for(let m=1;m<=parameters.publicInvestmentDelay;m++) s.projects.push({type:'public',amount:200*scale,due:m,efficiency:s.institutions.investmentEfficiency,legacy:true});
  s.demography=createDemography(s.population,parameters);
  if(structure){matchInitialLifeExpectancy(s.demography,parameters,structure.lifeExpectancy);s.demography.healthAccess=structure.healthAccess;}
  s.ageCohorts=cohortTotals(s.demography);s.workingAgeShare=s.ageCohorts[1]/s.population;
  s.metrics={...initialMetrics(s),...demographicMetrics(s),realGDPAnnualized:initialAnnualGDP,realGDPRolling:initialAnnualGDP,nominalGDPAnnualized:initialAnnualGDP,gdpUSDAnnualized:initialAnnualGDP,gdpUSDRolling:initialAnnualGDP,realPolicyRate:realInterestRate(s.monetary.effectiveRate/100,s.expectedInflation)*100};
  // Explicit synthetic prehistory, solely for rolling indicators at the initial date.
  for(let m=-12;m<=0;m++) s.history.push({...s.metrics,month:m,consumerPriceIndex:100*Math.pow(1+(initialMacro?.inflationAnnual??.08),m/12),
    realGDPMonthly:initialMonthlyGDP*Math.pow(1+(initialMacro?.realGrowthAnnual??.03),m/12),nominalGDPMonthly:initialMonthlyGDP*Math.pow((1+(initialMacro?.realGrowthAnnual??.03))*(1+(initialMacro?.inflationAnnual??.08)),m/12),synthetic:m<0});
  const prehistory=s.history.filter(x=>x.month>=-11);
  s.metrics.realGDPRolling=sum(prehistory.map(x=>x.realGDPMonthly));
  s.metrics.nominalGDPAnnual=sum(prehistory.map(x=>x.nominalGDPMonthly));
  s.metrics.gdpUSDRolling=s.metrics.nominalGDPAnnual;
  const debtScale=s.metrics.nominalGDPAnnual/initialAnnualGDP;
  for(const bond of [...s.government.domesticBonds,...s.government.externalBonds]) bond.principal*=debtScale;
  if(options.initialFinancialStocks)applyOpeningStocks(s,options.initialFinancialStocks,initialAnnualGDP);
  s.bank.equity=riskAssets(s)*.12;
  s.bank.reserves=deposits(s)+s.bank.equity-privateLoans(s)-domesticDebt(s);
  if(s.economy?.revision>=4)initializeFinancialStocks(s,initialAnnualGDP);
  s.centralBank.equity=s.government.reservesUSD*s.exchangeRate+s.bank.centralBorrowing-s.bank.reserves;
  s.metrics.capitalRatio=bankCapital(s)*100;s.metrics.bankLiquidity=s.bank.reserves/deposits(s)*100;
  s.metrics.foreignDebtRatio=externalDebtUSD(s)/s.metrics.nominalGDPAnnual*100;
  s.metrics={...s.metrics,...socialIndicators(s),...institutionMetrics(s),...politicsMetrics(s),...laborMetrics(s),...infrastructureMetrics(s),...servicesMetrics(s),...monetaryMetrics(s),investmentPrice:1,liquidityCoverage:bankLiquidityCoverage(s)*100,leverageRatio:bankLeverage(s)*100,debtInDefault:0,refinancingRisk:refinancingRisk(s).annualProbability*100};
  if(s.economy)s.metrics={...s.metrics,...socialIndicators(s,{wages:sum(s.firms.map(f=>f.workers*f.wage))}),...openEconomyMetrics(s),reserveMonths:structure.reserveMonths};
  if(socialActive(s))initializeSocial(s,options.socialTransferEnvelope);
  initializePoliticalSystem(s,options);
  s.metrics={...s.metrics,...politicsMetrics(s)};
  s.history[s.history.length-1]={...s.metrics,consumerPriceIndex:100,synthetic:false};
  if(s.economy?.revision>=4){
    s.base.initialLaborForce=s.population*s.workingAgeShare*s.participation;
    initializeHouseholdStructure(s);initializeSettlements(s);initializeLaborDistribution(s);
    initializeHouseholdFlowReference(s);
    calibrateMacroCore(s,structuralDepreciation(s));
    s.provenance.initialMacroCore=copy(s.economy.macro);
    s.metrics={...s.metrics,...socialIndicators(s,{wages:sum(s.firms.map(f=>f.workers*f.wage))})};
    s.history[s.history.length-1]={...s.metrics,consumerPriceIndex:100,synthetic:false};
    s.base.serviceReference={health:Math.max(1e-9,s.base.monthlyGDP*p.healthcare/100/(s.population*Math.max(.01,s.services.publicHealthCapacity))),school:Math.max(1e-9,s.base.monthlyGDP*p.education/100/(s.population*((s.ageCohorts[0]/s.population)/.28)*Math.max(.01,s.services.publicEducationCapacity)))};
    s.base.educationPerPupil=s.base.monthlyGDP*p.education/100/(s.population*((s.ageCohorts[0]/s.population)/.28));
  }
  if(options.defenseMode){initializeDefense(s,options.defenseParameters);initializeDefenseEconomy(s);s.provenance.defenseMode=true;s.provenance.defenseParameters=copy(s.defense.assumptions);s.metrics={...s.metrics,...defenseMetrics(s)};s.history[s.history.length-1]={...s.metrics,consumerPriceIndex:100,synthetic:false};}
  if(options.localGovernmentRevision===1){initializeLocalGovernment(s,options.localGovernmentAssumptions);s.provenance.localGovernmentRevision=1;s.provenance.localGovernmentAssumptions=copy(s.localGovernment.assumptions);}
  if(foundationActive(s)){initializeFoundation(s,options.foundationAssumptions);s.metrics={...s.metrics,...socialIndicators(s,{wages:sum(s.firms.map(f=>f.workers*f.wage))})};s.history[s.history.length-1]={...s.metrics,consumerPriceIndex:100,synthetic:false};}
  if(consumptionActive(s))initializeConsumption(s);
  if(socialActive(s))initializeSocial(s);
  synchronizeInfrastructure(s);
  initializeEnterpriseMarket(s);
  initializeBusinessDynamics(s);initializeProductMarkets(s);initializeServiceIndustries(s,OPEN_INPUTS);initializeFirmMarkets(s);initializeLivelihoods(s);
  initializeSettlements(s);initializeOwners(s);initializeTalent(s);initializeInternationalCapital(s);initializeDurables(s);initializeRentSeeking(s);
  if(s.economy?.revision>=20){s.metrics={...s.metrics,...socialIndicators(s,{wages:sum(s.firms.map(f=>f.workers*f.wage))})};s.history[s.history.length-1]={...s.metrics,consumerPriceIndex:100,synthetic:false};}
  const identity=characterPlayerIdentity(options.characterPlayer);
  if(!options.deferCharacters)initializeCharacters(s,identity);
  if(s.characters&&identity)s.provenance.characterPlayer=identity;
  s.diagnosticBaseline=initialDiagnostic(s,s.economy?investmentOpportunities(s,s,1):[]);
  updateRegionalProduction(s);
  initializeCompanyLocations(s);
  s.regional=projectRegionalEconomy(s,inputMatrix(s));
  updateRegionalStatus(s);
  if(options.territorialGovernment&&s.politics.enabled){
    initializeTerritorialGovernment(s,territorialVotes,{londonMayor:options.londonMayorRevision===1});
    s.provenance.territorialGovernment=true;
    if(s.territorialGovernment.londonMayorRevision===1)s.provenance.londonMayorRevision=1;
  }
  return s;
}

function initializeFinancialStocks(s,annualGDP){
 initializeNonbankHolders(s);
 const ratio=s.policy.reserveRequirement/100;
 const inferredTotal=(privateLoans(s)+domesticDebt(s)-nonbankDebt(s)-s.bank.equity)/Math.max(.1,1-ratio);
 const privateDeposits=s.initialAccounts?.broadMoneyGDP===null?Math.max(annualGDP*.1,inferredTotal-s.government.cash):(s.initialAccounts?.broadMoneyGDP??40)/100*annualGDP;
 const householdPool=privateDeposits*.7,firmPool=privateDeposits*.3;
 const referenceC=s.base.consumption*(1+s.policy.vat/100),transactionCash=Math.min(householdPool,referenceC*1.5);
 s.households.forEach(h=>{h.cash=transactionCash*h.consumption/s.base.consumption+(householdPool-transactionCash)*h.dividendShare;});
 const gross=sum(s.firms.map(f=>f.production));s.firms.forEach(f=>{f.cash=firmPool*f.production/gross;});
 s.bank.reserves=deposits(s)*ratio;
 // Solve equity and net foreign assets jointly because FX positions enter RWA.
 for(let i=0;i<100;i++){
  s.bank.foreignAssetsUSD=(deposits(s)+s.bank.equity-privateLoans(s)-(domesticDebt(s)-nonbankDebt(s))-s.bank.reserves)/s.exchangeRate;
  s.bank.equity=riskAssets(s)*.12;
 }
 s.bank.foreignAssetsUSD=(deposits(s)+s.bank.equity-privateLoans(s)-(domesticDebt(s)-nonbankDebt(s))-s.bank.reserves)/s.exchangeRate;
 s.base.financialCalibration={privateDeposits,broadMoneyReference:s.initialAccounts?.broadMoneyGDP??null,missingMoneyData:s.initialAccounts?.broadMoneyGDP==null,householdDepositShare:.7,nonbankSovereignShare:.7,transactionMonths:1.5,bankForeignAssetsUSD:s.bank.foreignAssetsUSD,bankReserves:s.bank.reserves};
}

function initializeHouseholdFlowReference(s){
 const p=s.policy,k=s.parameters,y=s.base.monthlyGDP;
 const transferTotal=y*p.transfers/100*(.6+.4*(s.ageCohorts[2]/s.population)/.07),family=y*p.familyBenefits/100*(s.ageCohorts[0]/s.population)/.28;
 const remittances=y*(s.initialAccounts?.remittancesGDP??1)/100;
 const bondCoupons=domesticCouponShares(s).households;
 const income=s.households.map((h,j)=>bondCoupons[j]+h.cash*annualToMonthly(s.bank.depositRate)+h.foreignSavingsUSD*annualToMonthly(s.world.globalRate/100)+(transferTotal+remittances)*GROUPS[j].transferShare+family*GROUPS[j].familyShare);
 for(const f of s.firms){
  const i=s.firms.indexOf(f),payroll=f.workers*f.wage,wages=laborWageShares(s,f,GROUPS);
  GROUPS.forEach((g,j)=>{const tax=clamp(p.incomeTax/100+p.incomeTaxProgressivity*.15*Math.log(Math.max(.01,wages[j]/g.population)),0,.60)*s.institutions.taxCompliance;income[j]+=payroll*wages[j]*(1-tax);});
  const revenue=f.production*f.price,input=dot(inputMatrix(s).map(row=>row[i]),s.firms.map(x=>x.price))*f.production+f.production*f.importCoefficient;
  const royalty=i===1&&s.resourceMode?revenue*p.royalty/100:0;
  const interest=(f.loanLC+f.loanFX)*annualToMonthly(f.averageRate),depreciation=f.capital*monthlyDepreciation(k.annualDepreciation);
  const profit=revenue-input-payroll-interest-royalty-depreciation,tax=Math.max(0,profit)*p.corporateTax/100*s.institutions.taxCompliance;
  const dividend=Math.max(0,profit-tax)*k.dividendPayout;
  GROUPS.forEach((g,j)=>{income[j]+=dividend*(f.domesticOwners[j]+f.workerOwners[j]);});
 }
 s.households.forEach((h,j)=>{h.income=income[j];h.interestPaid=(h.loanLC+h.loanFX)*annualToMonthly(h.averageRate);});
 s.base.referenceIncome=sum(s.households.map(h=>h.income-h.interestPaid));
 s.base.initialGroupIncomes=s.households.map(h=>h.income-h.interestPaid);
 s.incomeHistory=Array.from({length:12},(_,j)=>({month:j-11,population:s.population,cpi:100,net:[...s.base.initialGroupIncomes],market:[...s.base.initialGroupIncomes],synthetic:true}));
}

function initialMetrics(s) {
  const annualGDP=s.base.monthlyGDP*12;
  const debt=domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate;
  return {month:0,realGDPMonthly:s.base.monthlyGDP,nominalGDPMonthly:s.base.monthlyGDP,nominalGDPAnnual:annualGDP,
    gdpPerCapitaReal:annualGDP/s.population,gdpPerCapitaUSD:annualGDP/s.population,gdpGrowthYoY:(s.initialMacro?.realGrowthAnnual??.03)*100,inflationYoY:(s.initialMacro?.inflationAnnual??.08)*100,inflationMonthly:annualToMonthly(s.initialMacro?.inflationAnnual??.08)*100,
    coreInflation:(s.initialMacro?.inflationAnnual??.08)*100,foodInflation:(s.initialMacro?.inflationAnnual??.08)*100,energyInflation:(s.initialMacro?.inflationAnnual??.08)*100,unemployment:(s.initialMacro?.unemployment??.09)*100,realIncomeIndex:100,
    exchangeRate:1,outputGap:s.initialMacro?0:-8,debtRatio:debt/annualGDP*100,deficitRatio:0,
    reservesUSD:s.government.reservesUSD,fundUSD:s.government.fundUSD,tradeBalance:0,currentAccountUSD:0,
    lendingRate:s.bank.lendingRate*100,depositRate:s.bank.depositRate*100,capitalRatio:bankCapital(s)*100,npl:4,credit:privateLoans(s),
    deposits:deposits(s),consumption:s.base.consumption,investment:s.base.investment,governmentPurchases:s.base.government,
    exports:s.base.exports,imports:s.base.exports,inventoryChange:0,productivity:100,
    laborForce:s.population*s.workingAgeShare*s.participation,employment:sum(s.firms.map(f=>f.workers)),
    fulfillment:100,confidence:s.institutions.confidence*100,informality:s.institutions.informality*100,
    taxRevenue:0,governmentSpending:0,interestExpense:0,privateDebtRatio:privateLoans(s)/annualGDP*100,
    infrastructure:100,skills:100,bankLiquidity:s.bank.reserves/deposits(s)*100,
    foreignDebtRatio:externalDebtUSD(s)/annualGDP*100,realExchangeRate:100,migration:0,publicInvestment:200*(annualGDP/60000),
    moneyCreated:0,creditLosses:0,reserveMonths:6.4,sovereignSpread:3,investmentCompleted:0,
    auditError:bankResidual(s),policyRate:s.monetary.effectiveRate,expectedInflation:s.expectedInflation*100};
}

function constrainedProduction(s,finalDemand,capacity,externalConstraint=null) {
  const matrix=inputMatrix(s);
  const inventory=s.firms.map(f=>enterpriseAvailableInventory(s,f));
  const restock=s.firms.map((f,i)=>Math.max(0,s.base.output[i]*(i===0&&agricultureActive(s)?s.agriculture.stockTarget:s.parameters.inventoryTarget)-inventory[i])*s.parameters.inventoryAdjustment);
  function at(alpha,useRestock=true) {
    const requested=solveLeontief(finalDemand.map((v,i)=>v*alpha+(useRestock?restock[i]:0)),matrix);
    const production=requested.map((v,i)=>Math.max(0,Math.min(capacity[i],v)));
    const intermediate=matrix.map(row=>dot(row,production));
    const ending=production.map((v,i)=>inventory[i]+v-intermediate[i]-alpha*finalDemand[i]);
    const externalNeed=externalConstraint?dot(production,externalConstraint.intermediateUnitUSD)+alpha*(externalConstraint.finalImportsUSD-externalConstraint.exportsUSD):0;
    return {production,intermediate,ending,alpha,feasible:ending.every(v=>v>=(s.economy?-1e-12:-1e-7))&&(!externalConstraint||externalNeed<=externalConstraint.availableUSD+1e-8)};
  }
  const restockOK=at(0).feasible;
  const full=at(1,restockOK);
  if(full.feasible) return full;
  let low=0,high=1;
  for(let j=0;j<45;j++) {const m=(low+high)/2;if(at(m,restockOK).feasible) low=m;else high=m;}
  return at(low,restockOK);
}

function effectiveWorld(s) {
  const w={...s.world};
  for(const [key,factor] of Object.entries(historicalWorldFactors(s).channels))w[key]*=factor;
  const event=worldEvent(s);if(event)w[event.key]*=event.multiplier;
  if(s.stochastic) {
    const a=s.parameters.stochasticAmplitude;
    w.commodityPrice*=Math.exp(noise(s.seed,s.month,1)*.025*a);
    w.energyPrice*=Math.exp(noise(s.seed,s.month,2)*.015*a);
    w.foreignDemand*=Math.exp(noise(s.seed,s.month,3)*.008*a);
    w.weather*=Math.exp(noise(s.seed,s.month,4)*.025*a);
  }
  for(const shock of s.shocks) if(s.month>=shock.start&&s.month<shock.start+shock.duration) w[shock.key]*=shock.multiplier;
  return w;
}

export function scheduleShock(s,{key,multiplier,start=s.month+1,duration=12}) {
  if(!(key in WORLD)||!Number.isFinite(multiplier)||multiplier<=0||!Number.isInteger(start)||start<=s.month||!Number.isInteger(duration)||duration<1) throw new Error('Некорректный внешний шок');
  s.shocks.push({key,multiplier,start,duration});
}

export function advanceMonth(state,policy=state.policy,options={}) {
  const s=advanceNationalMonth(state,policy,options);
  updateRegionalProduction(s,state);
  initializeCompanyLocations(s);
  s.regional=projectRegionalEconomy(s,inputMatrix(s));
  updateRegionalStatus(s,state.regionalStatus);
  updateTerritorialOffices(s,territorialVotes);
  updateTerritorialEvents(s,state);
  return s;
}

function advanceNationalMonth(state,policy,options) {
  const first=advanceMonthCandidate(state,policy,{...options,recordDiagnostics:true});
  if(!(state.economy?.revision>=4)||fixedExchange(state)||euroAdopted(state)||euroAdopted(first)||!first.lastReport.diagnostics?.foreignFundingGapUSD)return first;
  // Find the smallest depreciation that clears desired goods payments at the
  // available private FX line. Recompute all LC postings at that rate; no FX or
  // deposits are invented. The 20% monthly log limit is a numerical scenario
  // boundary, exported as such, not an empirical exchange-rate prediction.
  const base=Math.log(first.exchangeRate/state.exchangeRate),ceiling=.20;
  if(base>=ceiling)return first;
  const at=logChange=>advanceMonthCandidate(state,policy,{...options,exchangeLogOverride:logChange,recordDiagnostics:false});
  let upper=at(ceiling),chosen=upper,chosenLog=ceiling,iterations=1;
  if((upper.lastReport.diagnostics.foreignFundingGapUSD??0)<=1e-7){
    let lo=base,hi=ceiling;
    for(let j=0;j<14;j++){const mid=(lo+hi)/2,candidate=at(mid);iterations++;if((candidate.lastReport.diagnostics.foreignFundingGapUSD??0)>1e-7)lo=mid;else {hi=mid;chosen=candidate;chosenLog=mid;}}
  }
  // Trial states are discarded. Record the selected calculation once, in full.
  chosen=advanceMonthCandidate(state,policy,{...options,exchangeLogOverride:chosenLog,recordDiagnostics:true});
  const solve={method:'minimum-depreciation-goods-FX-clearing',iterations,initialLogChange:base,settledLogChange:Math.log(chosen.exchangeRate/state.exchangeRate),ceilingReached:(chosen.lastReport.diagnostics.foreignFundingGapUSD??0)>1e-7};
  if(solve.ceilingReached){const warning={code:'FX-clearing-scenario-boundary',observed:.20,threshold:.20};chosen.lastReport.calculationTrace.warnings.push(warning);chosen.journal.at(-1).calculationTrace.warnings.push({...warning});}
  chosen.lastReport.diagnostics.fxMarketSolve=solve;chosen.lastReport.calculationTrace.report.diagnostics.fxMarketSolve=solve;
  chosen.journal.at(-1).calculationTrace.report.diagnostics.fxMarketSolve=solve;
  return chosen;
}
function advanceMonthCandidate(state,policy=state.policy,{preserveEconomicRevision=false,exchangeLogOverride=null,recordDiagnostics=true}={}) {
  if(state.defense?.sovereigntyLost||state.politics.enabled&&!state.politics.executive.inOffice)return copy(state);
  // Historical entries are immutable. Copy live accounts, not an ever-growing
  // journal on every month; callers' histories are never modified.
  const archiveKeys=['rollCalls','elections','partyHistory','commandHistory'];
  const livePolitics=state.politics.enabled?{...state.politics,...Object.fromEntries(archiveKeys.map(k=>[k,[]])),bills:state.politics.bills.filter(b=>!['enacted','withdrawn','expired','declined'].includes(b.status))}:state.politics;
  // Append-only archives never participate in the mutable live-state clone.
  // Keep their arrays independent; entries are historical records, as for journal.
  const archived=Object.fromEntries(['householdEconomy','social','defense','settlements','enterpriseMarket','wealthOwners','rentSeeking','durableGoods','talentMigration','internationalCapital'].map(key=>[key,state[key]?.history]));
  const live={...state,politics:livePolitics,history:[],journal:[],regional:undefined,regionalStatus:undefined,territorialEvents:undefined};
  for(const [key,history] of Object.entries(archived))if(history)live[key]={...state[key],history:[]};
  // Until this turn replaces it, the previous report is read-only input.
  live.lastReport=null;
  if(state.diagnosticBaseline)live.diagnosticBaseline=null;
  const s=copy(live),prev=state;
  if(territorialActive(s))s.regional=prev.regional;
  for(const [key,history] of Object.entries(archived))if(history)s[key].history=history.slice();
  s.lastReport=prev.lastReport;
  if(state.diagnosticBaseline)s.diagnosticBaseline=state.diagnosticBaseline;
  if(state.politics.enabled){for(const key of archiveKeys)s.politics[key]=state.politics[key].slice();const active=new Map(s.politics.bills.map(b=>[b.id,b]));s.politics.bills=state.politics.bills.map(b=>active.get(b.id)??b);}
  s.history=state.history.slice();s.journal=state.journal.slice();
  // Upgrade only at a month boundary and record it in that month's journal.
  // Historical replay explicitly requests the revision used at the time.
  if(s.economy&&(s.economy.revision??1)<3&&!preserveEconomicRevision){
    s.economy.revision=3;
    if(s.month===0){
      const va=s.firms.map((f,j)=>f.production*(1-colsum(j,inputMatrix(s))-f.importCoefficient)),total=sum(va);
      s.firms.forEach((f,j)=>{f.lastInvestment=s.base.investment*va[j]/total;});
    }
  }
  if(s.economy?.revision===4&&!preserveEconomicRevision)s.economy.revision=5;
  if(s.economy?.revision===6&&!preserveEconomicRevision)s.economy.revision=7;
  if(s.economy?.revision===7&&!preserveEconomicRevision)s.economy.revision=8;
  if(s.economy?.revision===8&&!preserveEconomicRevision)s.economy.revision=9;
  if(s.economy?.revision===9&&!preserveEconomicRevision)s.economy.revision=10;
  if(s.economy?.revision===10&&!preserveEconomicRevision)s.economy.revision=11;
  if(s.economy?.revision===11&&!preserveEconomicRevision)s.economy.revision=12;
  if(s.economy?.revision===12&&!preserveEconomicRevision)s.economy.revision=13;
  if(s.economy?.revision===13&&!preserveEconomicRevision)s.economy.revision=14;
  if(s.economy?.revision===14&&!preserveEconomicRevision)s.economy.revision=15;
  if(s.economy?.revision===15&&!preserveEconomicRevision)s.economy.revision=16;
  if(s.economy?.revision===16&&!preserveEconomicRevision)s.economy.revision=17;
  if(s.economy?.revision===17&&!preserveEconomicRevision)s.economy.revision=18;
  if(s.economy?.revision===18&&!preserveEconomicRevision)s.economy.revision=19;
  if(s.economy?.revision===19&&!preserveEconomicRevision)s.economy.revision=20;
  if(s.economy?.revision===20&&!preserveEconomicRevision)s.economy.revision=21;
  if(s.economy?.revision===21&&!preserveEconomicRevision)s.economy.revision=22;
  if(s.economy?.revision===22&&!preserveEconomicRevision)s.economy.revision=23;
  if(s.economy?.revision===23&&!preserveEconomicRevision)s.economy.revision=24;
  if(s.economy?.revision===24&&s.scenario?.id==='uk-2000'&&!preserveEconomicRevision)s.economy.revision=25;
  if(s.economy?.revision===25&&s.scenario?.id==='uk-2000'&&!preserveEconomicRevision)s.economy.revision=26;
  if(s.economy?.revision===27&&s.scenario?.id==='uk-2000'&&!preserveEconomicRevision)s.economy.revision=28;
  if(s.economy?.revision===26&&s.scenario?.id==='uk-2000'&&!preserveEconomicRevision)s.economy.revision=27;
  initializeHouseholdStructure(s);initializeLaborDistribution(s);
  if(s.politics.enabled&&!reputationActive(s)&&!preserveEconomicRevision)initializePolicyReputation(s);
  if(s.politics.enabled&&!performanceActive(s)&&!preserveEconomicRevision)initializePerformanceVoting(s);
  initializeEnterpriseMarket(s);
  initializeBusinessDynamics(s);initializeProductMarkets(s);initializeServiceIndustries(s,OPEN_INPUTS);initializeFirmMarkets(s);initializeLivelihoods(s);
  initializeDefenseEconomy(s);
  if(s.politics.enabled&&!regimeActive(s)&&!preserveEconomicRevision)initializeRegimeDynamics(s);
  if(consumptionActive(s))initializeConsumption(s);
  const socialMigration=initializeSocial(s);
  initializeSettlements(s);initializeOwners(s);initializeTalent(s);initializeInternationalCapital(s);initializeDurables(s);initializeRentSeeking(s);prepareOwners(s);
  const mergedPolicy={...s.policy,...policy};
  const requestedPolicy=sanitizePolicy(socialMigration&&!preserveEconomicRevision?{...mergedPolicy,transfers:mergedPolicy.transfers*.3}:mergedPolicy);s.policy=requestedPolicy; s.month++;
  const events=[];
  s.policy=reviewPolicy(s,prev,requestedPolicy,events);s.requestedPolicy=requestedPolicy;
  const nationalPolicy=s.policy;
  const territorialFiscal=prepareTerritorialFiscal(s,prev);
  if(territorialFiscal)s.policy={...nationalPolicy,...Object.fromEntries(
    Object.entries(territorialFiscal.add).map(([key,value])=>[key,nationalPolicy[key]+value]))};
  const p=s.policy,k=s.parameters,w=effectiveWorld(s);
  const agriculture=prepareAgriculture(s,w);
  prepareDefenseMonth(s,prev);
  prepareLocalGovernment(s,prev);
  prepareFoundation(s,prev);
  prepareEnterpriseMarket(s);prepareFirmMarkets(s);prepareRentSeeking(s);prepareDurables(s);
  prepareBusinessDynamics(s);prepareProductMarkets(s);prepareServiceIndustries(s);
  if(companyEconomyActive(s)){
    initializeCompanyLocations(s,{operating:true});
    prepareIndustrialCapacity(s,industryCompanies(s));
    for(const sector of [2,4])prepareCompanySpecialization(s,sector,sectorCompanies(s,sector));
  }
  let governmentMix=defenseGovernmentMix(s),governmentWeights=governmentMix.weights;
  const matrix=inputMatrix(s);
  const supply=s.economy?.revision>=5?prepareSupplyChains(s,w.importAvailability,matrix):null;
  const physicalCapacity=zeros();
  if(s.economy)advanceWorldEconomy(s,w);
  const gov=s.government,b=s.bank;
  advanceMonetary(s,prev,w,events);
  const effectiveRate=s.monetary.effectiveRate;
  const flow={tax:0,vat:0,tariff:0,incomeTax:0,corporateTax:0,royalty:0,
    purchases:0,militaryPurchases:0,militaryRequested:0,transfers:0,familyBenefits:0,healthcare:0,education:0,childcare:0,infrastructureMaintenance:0,concessionGuarantees:0,institutionCost:0,antitrust:0,courts:0,soeAudits:0,politicalElections:0,politicalSecurity:0,politicalPatronage:0,businessSupport:0,interest:0,bankRescue:0,centralIncome:0,
    domesticIssued:0,externalIssued:0,domesticRedeemed:0,externalRedeemed:0,
    reserveSale:0,fundWithdrawal:0,fundDeposit:0,domesticHaircut:0,externalHaircut:0,
    interestCapitalized:0,unfunded:0,sovereignSpread:0,stateDividends:0,equityPurchases:0,equitySales:0,networkPurchases:0,networkSales:0,externalEquityRevaluation:0,reserveConversion:0};
  const holdingEntities=s.territorialGovernment?s.firms.flatMap((firm,sector)=>{
    const companies=sectorCompanies(s,sector);
    return (companies.length?companies:[firm]).map(firm=>({firm,sector}));
  }):[];
  prepareTerritorialAssets(s,holdingEntities,flow,events);
  const initialDebt=domesticDebt(prev)+externalDebtUSD(prev)*prev.exchangeRate;
  const debtRatio=initialDebt/Math.max(prev.metrics.nominalGDPAnnual,1);
  const fundingRisk=refinancingRisk(s);
  flow.defaultProbability=fundingRisk.annualProbability;
  flow.marketClosed=s.stochastic&&uniform(s.seed,s.month,9)<fundingRisk.monthlyProbability;
  flow.sovereignSpread=.025+(s.economy?actuarialSpread(fundingRisk.annualProbability,s.economy.parameters.sovereignLossGivenDefault,w.globalRate/100):k.sovereignRiskSensitivity*Math.max(0,debtRatio-.60))+.025*(1-s.institutions.confidence)+.03*Math.max(0,prev.metrics.reserveMonths<3?1-prev.metrics.reserveMonths/3:0)
    +(gov.defaultActive||s.month<gov.excludedUntil?.05:0);
  if(foundationActive(s))flow.sovereignSpread=sovereignPremium(s,fundingRisk);
  flow.foreignRate=w.globalRate/100;
  const realPolicy=realInterestRate(effectiveRate/100,s.expectedInflation);
  const flowPressure=-(prev.lastReport.external?.bopUSD??prev.metrics.currentAccountUSD)/Math.max(prev.metrics.nominalGDPMonthly/prev.exchangeRate,1);
  const interventionUSD=fixedExchange(s)||euroAdopted(s)?0:clamp(p.fxIntervention,-Math.max(0,gov.cash/prev.exchangeRate),gov.reservesUSD);
  const exchangeChange=euroAdopted(s)?Math.log(euroExchangeRate(s)/prev.exchangeRate):exchangeLogOverride??(fixedExchange(s)?0:clamp((Math.log1p(s.expectedInflation)-Math.log1p(.02))/12+k.exchangeFlowSensitivity*flowPressure
    -k.exchangeInterestSensitivity*(realPolicy-realInterestRate(w.globalRate/100,.02))
    -k.exchangeParityAdjustment*Math.log(Math.max(.1,prev.exchangeRate*prev.worldPriceIndex/prev.consumerPriceIndex))
    +.005*Math.max(0,debtRatio-.8)+.006*(.68-s.institutions.confidence)
    -.14*interventionUSD/Math.max(prev.metrics.nominalGDPMonthly/prev.exchangeRate,1)
    +(s.stochastic?noise(s.seed,s.month,5)*.004:0),-.15,.20));
  s.exchangeRate*=Math.exp(exchangeChange);
  s.centralBank.equity+=prev.government.reservesUSD*(s.exchangeRate-prev.exchangeRate);
  const bankFXRevaluation=(b.foreignAssetsUSD-(b.foreignArrearsUSD??0)+sum(borrowers(s).map(a=>a.loanFX)))*(s.exchangeRate-prev.exchangeRate);
  b.equity+=bankFXRevaluation;
  if(interventionUSD!==0) {
    gov.reservesUSD-=interventionUSD; foreignPayment(s,gov,interventionUSD); flow.reserveSale=interventionUSD*s.exchangeRate;
    s.centralBank.equity-=flow.reserveSale;
  }
  if(Math.abs(interventionUSD-p.fxIntervention)>1) events.push('Интервенция ограничена доступными резервами или средствами казначейства.');
  s.institutions.ownershipRisk*=1-k.ownershipRiskDecay;
  const actionResults=[...executeOwnership(s,flow,events,{fundGovernment,transfer,foreignPayment:(state,actor,usd)=>foreignPayment(state,actor,usd,flow)}),...executeNetworkTransfers(s,flow,events,{fundGovernment,transfer,grantLoan})];
  assignTerritorialAssets(s,holdingEntities);
  sellTerritorialEquity(s,holdingEntities,flow,events,enterpriseValue);
  if(flow.localAssetSales){syncEnterpriseOwnership(s);for(const m of s.firmMarkets?.markets??[])syncFirmOwnership(s,m.sector);}
  s.worldPriceIndex*=1+annualToMonthly(.02);
  const migration=advanceDemography(s,prev);advanceTalent(s,prev,migration);prepareSettlements(s);
  prepareSocial(s,prev);
  s.participation=clamp(s.participation+.002*((.70+(prev.metrics.realIncomeIndex/100-1)*.03)-s.participation),.55,.82);
  const militaryBudgetBase=foundationActive(s)?prev.metrics.nominalGDPAnnual/12:s.economy?.revision>=4?s.base.monthlyGDP*prev.consumerPriceIndex/100:prev.metrics.nominalGDPAnnual/12;
  const militaryPlan=defenseEconomicPlan(s,prev,militaryBudgetBase);
  const laborForce=militaryPlan?.laborForce??s.population*s.workingAgeShare*s.participation;
  const civilianLaborForce=militaryPlan?.civilianLaborForce??laborForce;
  const taxEff=foundationActive(s)?s.foundation.taxCapacity:p.taxEnforcement/100;
  const informalTarget=s.economy?clamp(.12+.55*s.firms[0].workers/Math.max(sum(s.firms.map(f=>f.workers)),.001)+.18*(1-s.institutions.contractReliability)-.15*taxEff+(p.incomeTax+p.corporateTax-32)/100*.12,.04,.85):clamp(.42-.22*taxEff+(p.incomeTax+p.corporateTax-32)/100*.12,.08,.50);
  s.institutions.informality+=.015*(informalTarget-s.institutions.informality);
  s.institutions.taxCompliance=clamp(1-s.institutions.informality*(1.15-.35*taxEff),.4,.99);
  advanceInstitutionOutcomes(s);
  advanceLabor(s,prev,events);
  s.institutions.investmentEfficiency=localGovernmentActive(s)?.72:clamp(.72+.30*(p.taxEnforcement/100-.60)+k.competitionEfficiencyElasticity*(s.institutions.competition-.60),.35,.9);
  advanceEducation(s,prev.lastReport.fiscal?.education??(s.economy?.revision>=4?s.base.monthlyGDP*p.education/100:75));
  advanceLaborDistribution(s);
  prepareLivelihoods(s,prev);enterFamilyBusinesses(s,prev);
  prepareInfrastructure(s,prev,events);
  depreciateTerritorialProgrammeAssets(s,prev);
  let completed=0;
  for(const f of s.firms){f.capital*=1+annualToMonthly(-k.annualDepreciation);if(s.economy)f.knowledgeCapital*=Math.pow(1-s.economy.parameters.knowledgeDepreciation,1/12);}
  syncServiceCapital(s);
  for(const project of s.projects.filter(x=>x.due<=s.month)) {
    recordProjectCompletion(s,project);
    completed+=(project.localPlan?sum(project.localPlan.map(x=>x.public+x.municipal)):project.amount)*project.efficiency;
    if(project.localPlan){for(const plan of project.localPlan){const n=s.networks.find(n=>n.id===plan.network);n.public+=plan.public*project.efficiency;
      if(project.territorialOwner)creditTerritorialNetwork(n,project.territorialOwner,plan.municipal*project.efficiency);
      n.municipal+=plan.municipal*project.efficiency;}}
    else if(project.type==='housing'&&socialActive(s)){const before=s.firms[4].capital;completeHousing(s,project);const installed=s.firms[4].capital-before;if(installed>0)completeServiceCapital(s,installed,{serviceIds:['property'],serviceShares:[1]});}
    else if(project.type==='network')completeInfrastructure(s,project);
    else if(project.type==='agriculture'&&agriculture){agriculture.publicStock+=project.amount*project.efficiency;}
    else if(project.type==='private'){const physical=s.economy&&!project.legacy?completeTechnology(s,project):project.amount*project.efficiency;completeProductCapacity(s,project.sector,physical);const share=agriculture?(project.agricultureShare??0):0;if((s.economy?.revision>=24?[0,3,4]:[3,4]).includes(project.sector)&&sectorCompanies(s,project.sector).length)completeFirmCapital(s,project.sector,physical*(1-share),project);else if(project.sector!==2||!industryCompanies(s).length)s.firms[project.sector].capital+=physical*(1-share);else completeEnterpriseCapital(s,physical,project.enterpriseShares,project.enterpriseIds);if(share)agriculture.privateStock+=physical*share;if(project.sector===4)completeServiceCapital(s,physical,project);recordForeignCompletion(s,project,physical);}
    else for(const n of s.networks){const localShare=project.territory||s.territorialGovernment?.localProperty===false?0:p.municipalInvestmentShare/100;n.public+=project.amount*project.efficiency*n.weight*(1-localShare);n.municipal+=project.amount*project.efficiency*n.weight*localShare;}
    recordTerritorialProgrammeAsset(s,project);
  }
  synchronizeInfrastructure(s);
  s.projects=s.projects.filter(x=>x.due>s.month);
  const trace={schema:2,sourceBuild:CALCULATION_BUILD,decisionMonth:prev.month,month:s.month,before:recordDiagnostics?accountSnapshot(prev):null,households:[],investment:[],labor:[],debtService:[],creditGate:null};
  if(!s.diagnosticBaseline)s.diagnosticBaseline=initialDiagnostic(prev,prev.economy?investmentOpportunities(prev,prev,1):[]);
  const desiredWorkers=s.firms.map((f,i)=>{
    const profile=MODEL_PROFILES[s.modelProfile];
    const targetGovernance=governanceTarget(s,f);
    f.governance+=k.governanceAdjustment*(targetGovernance-f.governance);
    f.reorganization*=.85;
    const targetEfficiency=Math.exp(k.governanceEfficiencyElasticity*profile.governanceWeight*(f.governance-.65)
      +k.competitionEfficiencyElasticity*profile.competitionWeight*(s.institutions.competition-.60)
      -f.reorganization-k.softBudgetEfficiencyPenalty*profile.softBudgetWeight*f.softBudget*(f.ownership.state+f.ownership.municipal));
    f.managementEfficiency+=1/24*(targetEfficiency-f.managementEfficiency);
    // Static institutional quality changes a bounded LEVEL, not an automatic
    // permanent growth-rate bonus. Growth still responds via investment/skills.
    if(!s.economy)f.productivity*=1+annualToMonthly(k.annualTechnicalProgress);
    const prod=f.laborProductivity*f.productivity*s.skills*f.managementEfficiency;
    const wageCost=Math.log(Math.max(.5,f.labor.wageFactor));
    const hours=p.normalWorkweek/40;
    const demand=(s.economy?structuralLaborDemand(s,f):f.salesExpected/prod/Math.max(.75,hours))*Math.exp(-k.laborDemandWageElasticity*wageCost);
    const adjustment=k.employmentAdjustment/(1+p.employmentProtection/6);
    const adjusted=Math.max(0,f.workers+adjustment*(demand-f.workers));
    trace.labor.push({sector:i,workersBefore:f.workers,expectedSales:f.salesExpected,unadjustedDemand:demand,adjustment,adjustedDemand:adjusted,wageFactor:f.labor.wageFactor});
    return adjusted;
  });
  const familyTargets=familyLaborTargets(s);if(s.economy?.revision>=24)for(let i=0;i<5;i++)desiredWorkers[i]=Math.max(desiredWorkers[i],familyTargets[i]);
  const matchedWorkers=foundationActive(s)?matchEmployment(s,desiredWorkers,civilianLaborForce):null;
  const laborScale=foundationActive(s)?1:Math.min(1,laborForce*.985/Math.max(sum(desiredWorkers),.001));
  const wageChanges=zeros();
  const capacity=s.firms.map((f,i)=>{
    f.workers=matchedWorkers?matchedWorkers[i]:desiredWorkers[i]*laborScale;if(i===4)refreshServiceCapacity(s);
    const employmentTightness=(sum(desiredWorkers)/laborForce-(1-(s.initialMacro?.unemployment??.09)));
    // Unresolved reduced-form assumption: this index pass-through is not an
    // empirically estimated minimum-wage model. It does not yet distinguish
    // legal coverage, compliance and self-employment. Do not interpret its
    // coefficients as universal effects (ILO minimum-wage guide, chapter 7.5).
    const minimumEffect=i===0||i===4?Math.log(p.minimumWage/prev.policy.minimumWage)*.28:Math.log(p.minimumWage/prev.policy.minimumWage)*.10;
    const bargainingChange=logRatio(f.labor.wageFactor,prev.firms[i].labor.wageFactor);
    const productivityChange=s.economy?Math.log(Math.max(1e-9,f.productivity*s.skills)/Math.max(1e-9,prev.firms[i].productivity*prev.skills)):k.annualTechnicalProgress/12;
    if(s.economy?.revision>=23)Object.assign(trace.labor[i],{productivityLogChange:productivityChange,inflationIndexation:s.inflationLogMonthly*.9,laborMarketPressure:k.wageAdjustment*(employmentTightness*.04),minimumEffect,bargainingChange});
    const wageChange=clamp(s.inflationLogMonthly*.9+productivityChange+k.wageAdjustment*(employmentTightness*.04)+minimumEffect+bargainingChange,-.02,.06);
    wageChanges[i]=wageChange;f.wage*=Math.exp(wageChange);
    const physicalRaw=s.economy?sectorCapacity(s,f):f.capacity*Math.pow(f.capital/f.initialCapital,k.capitalCapacityElasticity)*f.productivity*s.skills*f.managementEfficiency
      *Math.pow(s.infrastructure/s.initialInfrastructure,k.infrastructureElasticity);
    const physical=physicalRaw*defenseCapacityFactor(s)*productCapacityFactor(s,i)*regimeWorkFactor(s);
    const labor=f.workers*f.laborProductivity*f.productivity*s.skills*f.managementEfficiency*1.08*(p.normalWorkweek/40)*(1-f.labor.strikeShare);
    const weather=i===0?(agriculture?.weather??w.weather/100):1;
    physicalCapacity[i]=physical;
    const importedComponents=physical*(supply?supply.sectors[i].capacityFactor:clamp(w.importAvailability/100,.02,1.2));
    return Math.max(0,Math.min(physical,s.economy?physical:labor,importedComponents)*weather);
  });
  const loanTarget=Math.max(0,effectiveRate/100+.025+.15*b.npl+.035*(1-s.institutions.confidence)
    +k.contractRiskSensitivity*(.65-s.institutions.contractReliability)+((s.economy?.revision??0)>=22?(s.rentSeeking?.referenceRiskPremium??0):k.politicalRiskSensitivity*s.politics.corruption)+regimeInvestmentPremium(s));
  b.lendingRate+=k.ratePassThrough*(loanTarget-b.lendingRate);
  settleLiquidity(s,flow);
  const loanYield=privateLoans(s)*b.lendingRate*(1-b.npl);
  const bondYield=sum(gov.domesticBonds.map(bond=>bankBondPrincipal(bond)*bond.rate));
  const reserveYield=hasDiscretionaryCB(s)?b.reserves*effectiveRate/100*k.reserveRemunerationShare
    :p.monetaryRegime==='dollarized'?Math.min(b.reserves,gov.reservesUSD*s.exchangeRate)*w.globalRate/100:0;
  const foreignAssetYield=Math.max(0,b.foreignAssetsUSD)*s.exchangeRate*w.globalRate/100;
  const fundingCost=b.centralBorrowing*(effectiveRate/100+.01)+Math.max(0,-b.foreignAssetsUSD)*s.exchangeRate*(w.globalRate/100+flow.sovereignSpread);
  const affordableRate=Math.max(0,(loanYield+bondYield+reserveYield+foreignAssetYield-fundingCost)/Math.max(deposits(s),1)-.004);
  const competitiveRate=p.monetaryRegime==='freeBanking'?affordableRate:Math.max(0,effectiveRate/100-.015-(1-s.institutions.bankContestability)*k.bankContestabilitySpread);
  const depositTarget=Math.min(competitiveRate,affordableRate*clamp(.85-k.bankContestabilitySpread/.025*.25*(.60-s.institutions.bankContestability),.5,.98));
  b.depositRate+=k.depositRateAdjustment*(depositTarget-b.depositRate);
  const capitalFactor=foundationActive(s)?Math.min(institutionalCreditFactor(s,riskAssets(s)),clamp(bankLeverage(s)/k.minimumLeverageRatio,0,1.3)):clamp(Math.min(bankCapital(s)/(p.bankCapitalRequirement/100),bankLeverage(s)/k.minimumLeverageRatio),0,1.3);
  const liquidityFactor=clamp(b.reserves/Math.max(1,deposits(s)*p.reserveRequirement/100),0,1);
  b.creditSupply=clamp(capitalFactor*Math.min(liquidityFactor,bankLiquidityCoverage(s))*(1-b.npl*2),0,1);
  trace.creditGate={capitalRatio:bankCapital(s),capitalRequirement:p.bankCapitalRequirement/100,leverage:bankLeverage(s),minimumLeverage:k.minimumLeverageRatio,capitalFactor,liquidityFactor,liquidityCoverage:bankLiquidityCoverage(s),npl:b.npl,creditSupply:b.creditSupply,equity:b.equity,reserves:b.reserves};
  let creditCreated=flow.networkAcquisitionCredit??0,creditLosses=0;
  // Deposit remuneration and debt service, before new credit is extended.
  for(const a of borrowers(s)) {
    const debtBefore=a.loanLC+a.loanFX*s.exchangeRate;
    const depositInterest=Math.max(0,a.cash)*annualToMonthly(b.depositRate);
    a.cash+=depositInterest;b.equity-=depositInterest;a.depositIncome=depositInterest;
    const company=businessDynamicsActive(s)&&s.firms.some((_,i)=>sectorCompanies(s,i).includes(a));
    const repricing=company?(a.debtMonthsRemaining===a.debtMaturityMonths?1:(1-a.fixedDebtShare)*k.oldLoanRepricing):k.oldLoanRepricing;
    a.averageRate+=repricing*(b.lendingRate-a.averageRate);
    const interest=(a.loanLC+a.loanFX*s.exchangeRate)*annualToMonthly(a.averageRate);
    const paid=Math.min(Math.max(0,a.cash),interest);
    a.cash-=paid;b.equity+=paid;
    const unpaid=interest-paid;
    if(unpaid>0) {a.loanLC+=unpaid;b.equity+=unpaid;if(s.economy?.revision>=22)flow.bankAccruedUnpaidInterest=(flow.bankAccruedUnpaidInterest??0)+unpaid;creditLosses+=writeOff(s,a,.03);}
    a.interestPaid=paid;if(s.firms.some((_,i)=>sectorCompanies(s,i).includes(a))){a.unpaidInterest=unpaid;a.interestDue=interest;}
    trace.debtService.push({actor:s.households.includes(a)?'household':s.firms.some((_,i)=>sectorCompanies(s,i).includes(a))?'enterprise':s.firms.includes(a)?'firm':'network',...(s.firms.some((_,i)=>sectorCompanies(s,i).includes(a))?{enterpriseId:a.id}:{}),index:s.households.includes(a)?s.households.indexOf(a):s.firms.indexOf(a),debtBefore,averageRate:a.averageRate,interestDue:interest,paid,unpaidCapitalized:unpaid,debtAfter:a.loanLC+a.loanFX*s.exchangeRate,depositInterest});
  }
  const wholesaleCost=Math.max(0,-b.foreignAssetsUSD)*annualToMonthly(w.globalRate/100+flow.sovereignSpread);
  if(s.economy?.revision>=4){
    const settlement=settleBankForeignInterest(s,wholesaleCost,availableForeignLiquidity(s),flow);
    if(settlement.unpaid>1e-7)events.push('Банк не полностью оплатил внешние проценты; просрочка записана отдельно от нового кредита.');
  }else {b.foreignAssetsUSD-=wholesaleCost;b.equity-=wholesaleCost*s.exchangeRate;}
  const foreignYield=annualToMonthly(w.globalRate/100);
  const bankForeignIncome=Math.max(0,b.foreignAssetsUSD)*foreignYield;
  b.foreignAssetsUSD+=bankForeignIncome;b.equity+=bankForeignIncome*s.exchangeRate;
  const centralForeignIncome=gov.reservesUSD*foreignYield;
  const governmentForeignIncome=gov.fundUSD*foreignYield+centralForeignIncome;
  foreignPayment(s,gov,gov.fundUSD*foreignYield);flow.centralIncome+=gov.fundUSD*foreignYield*s.exchangeRate;
  gov.reservesUSD+=centralForeignIncome;
  const reserveInterest=hasDiscretionaryCB(s)?b.reserves*annualToMonthly(effectiveRate/100*k.reserveRemunerationShare)
    :p.monetaryRegime==='dollarized'?Math.min(b.reserves*annualToMonthly(w.globalRate/100),centralForeignIncome*s.exchangeRate):0;
  b.reserves+=reserveInterest;b.equity+=reserveInterest;
  let householdForeignIncome=0;
  for(const h of s.households) {h.foreignIncome=h.foreignSavingsUSD*foreignYield;foreignPayment(s,h,h.foreignIncome);householdForeignIncome+=h.foreignIncome;}
  const foreignInvestmentIncomeUSD=bankForeignIncome+governmentForeignIncome+householdForeignIncome;
  const centralInterest=b.centralBorrowing*annualToMonthly(effectiveRate/100+.01);
  b.reserves-=centralInterest;b.equity-=centralInterest;
  const centralProfit=centralForeignIncome*s.exchangeRate+centralInterest-reserveInterest;
  s.centralBank.equity+=centralProfit;s.centralBank.lastProfit=centralProfit;
  const priorLoss=s.centralBank.deferredLoss;
  const distributable=Math.max(0,centralProfit-priorLoss);
  s.centralBank.deferredLoss=Math.max(0,priorLoss-centralProfit);
  const remittance=Math.min(distributable,Math.max(0,s.centralBank.equity),Math.max(0,gov.reservesUSD)*s.exchangeRate);
  gov.reservesUSD-=remittance/s.exchangeRate;foreignPayment(s,gov,remittance/s.exchangeRate);
  flow.centralIncome+=remittance;s.centralBank.equity-=remittance;s.centralBank.lastRemittance=remittance;
  updateUnemployment(s,prev,civilianLaborForce);
  // Budget shares refer to the known trailing-year nominal GDP. No second CPI
  // indexation and no imposed real growth unrelated to the actual tax base.
  const budgetBase=foundationActive(s)?prev.metrics.nominalGDPAnnual/12:s.economy?.revision>=4?s.base.monthlyGDP*prev.consumerPriceIndex/100:prev.metrics.nominalGDPAnnual/12;
  const administrationShare=(localGovernmentActive(s)?p.localAdministrationBudget:0)+.05+(foundationActive(s)?0:.25*Math.pow(p.taxEnforcement/100,2))+p.antitrustBudget+p.courtBudget+p.soeAuditBudget+p.electionAdministration+p.securityBudget+p.patronageBudget;
  const foundationBudget=foundationActive(s)?p.researchBudget+p.taxAdministrationBudget:0;
  const socialPurchaseShare=socialActive(s)?p.socialHousingBudget+p.retrainingBudget:0;
  const purchaseShare=(agricultureActive(s)?p.agricultureProtection:0)+socialPurchaseShare+foundationBudget+p.governmentConsumption+(p.militaryBudget??0)+p.publicInvestment+p.education+p.healthcare+p.childcareBudget+p.infrastructureMaintenance+administrationShare;
  const plannedMilitaryWages=militaryPlan?.planned??0;
  const goodsPurchaseShare=Math.max(0,purchaseShare-plannedMilitaryWages/Math.max(budgetBase,1e-9)*100);
  const requestedPurchases=budgetBase*goodsPurchaseShare/100;
  s.households.forEach(h=>{h.bondIncome=0;});
  financeTerritorialInvestment(s,prev,flow,budgetBase);
  const territorialPlan=territorialBudgetPlan(s,prev,budgetBase,requestedPurchases);
  if(militaryPlan){const militaryGoods=Math.max(0,budgetBase*(p.militaryBudget??0)/100-plannedMilitaryWages);governmentMix=defenseGoodMix(s,clamp(militaryGoods/Math.max(requestedPurchases,1e-9),0,1));governmentWeights=governmentMix.weights;}
  const requestedTransfers=budgetBase*p.transfers/100*(.6+.4*(s.ageCohorts[2]/s.population)/.07);
  const socialPlan=socialTransferPlan(s);
  const requestedSocial=socialPlan?.total??0;
  const requestedFamily=budgetBase*p.familyBenefits/100*(s.ageCohorts[0]/s.population)/.28;
  const requestedSupport=budgetBase*p.businessSupport/100;
  const debtForPlan=rows=>s.economy?.revision>=23&&foundationActive(s)?rows.filter(x=>x.issuedMonth!==s.month):rows;
  const coupons=sum(debtForPlan(gov.domesticBonds).map(x=>yearCoupon(x.principal,x.rate)))+sum(debtForPlan(gov.externalBonds).map(x=>yearCoupon(x.principal,x.rate)))*s.exchangeRate;
  const maturities=sum(gov.domesticBonds.filter(x=>x.maturity<=s.month).map(x=>x.principal))+sum(gov.externalBonds.filter(x=>x.maturity<=s.month).map(x=>x.principal))*s.exchangeRate;
  flow.militaryRequested=budgetBase*(p.militaryBudget??0)/100;
  trace.budgetPlan={requestedMilitary:budgetBase*(p.militaryBudget??0)/100,budgetBase,administrationShare,purchaseShare,requestedPurchases,requestedTransfers,...(socialPlan?{requestedSocial,pensionsRequested:sum(socialPlan.pensions),unemploymentRequested:sum(socialPlan.unemployment),housingAidRequested:sum(socialPlan.housingAid)}:{}),requestedFamily,requestedSupport,coupons,maturities,cashBeforeFunding:gov.cash};
  const takeover=territorialPlan?.takeover??[];
  const territoryOrders=territorialProgrammeOrders(s,nationalProgrammeGDP(prev));
  const generalGrants=generalTerritorialGrants(s,prev);
  const grants=[...territoryOrders.filter(row=>row.programme==='localBudget'),...generalGrants];
  const businessPrograms=territoryOrders.filter(row=>row.programme==='businessSupport');
  const localPurchases=[...territoryOrders.filter(row=>!['localBudget','businessSupport'].includes(row.programme)),...takeover];
  const recurringBudget=sum(territoryOrders.filter(row=>row.recurring).map(row=>row.amount))+sum(generalGrants.map(row=>row.amount));
  const takeoverBudget=sum(takeover.map(row=>row.amount));
  fundGovernment(s,(territorialPlan?.central??requestedPurchases)+takeoverBudget+recurringBudget+plannedDiplomacyContributions(s)+plannedMilitaryWages+requestedTransfers+requestedSocial+requestedFamily+requestedSupport+coupons+maturities,flow);
  const fullDomestic=gov.domesticBonds;if(foundationActive(s))gov.domesticBonds=fullDomestic.filter(b=>b.issuedMonth!==s.month);
  const couponShares=domesticCouponShares(s);gov.domesticBonds=fullDomestic;
  const domesticCoupons=couponShares.total;
  const dcPaid=Math.min(Math.max(0,gov.cash),domesticCoupons);
  gov.cash-=dcPaid;distributeCoupon(s,dcPaid,couponShares);flow.interest+=dcPaid;
  if(domesticCoupons-dcPaid>(s.economy?.revision>=4?1e-9*Math.max(1,domesticCoupons):0)) {
    const unpaid=domesticCoupons-dcPaid;
    gov.domesticBonds.forEach(bond=>{bond.inDefault=true;});
    const contractRate=s.economy?sum(gov.domesticBonds.filter(bond=>(s.economy?.revision??0)<21||!foundationActive(s)||bond.issuedMonth!==s.month).map(bond=>yearCoupon(bond.principal,bond.rate)*bond.rate))/domesticCoupons:effectiveRate/100+flow.sovereignSpread;
    const unpaidHoldings=couponShares.households.map(v=>v*unpaid/Math.max(domesticCoupons,1e-9));
    gov.domesticBonds.push({principal:unpaid,rate:s.economy?.revision>=22?0:contractRate,...(s.economy?.revision>=22?{interestArrears:true,originalContractRate:contractRate}:{}),maturity:s.month,inDefault:true,overdue:unpaid,...(s.economy?.revision>=4?{householdHoldings:unpaidHoldings}:{})});
    b.equity+=unpaid-sum(unpaidHoldings);if(s.economy?.revision>=22)flow.bankAccruedUnpaidInterest=(flow.bankAccruedUnpaidInterest??0)+unpaid-sum(unpaidHoldings);flow.interestCapitalized+=unpaid;flow.interest+=unpaid;
    openDefaultEpisode(s,'payment-default',events);
  }
  const externalCoupons=sum(gov.externalBonds.filter(x=>!foundationActive(s)||x.issuedMonth!==s.month).map(x=>yearCoupon(x.principal,x.rate)));
  const ecPaid=settlementActive(s)?payTreasuryExternal(s,externalCoupons,flow):Math.min(Math.max(0,gov.cash)/s.exchangeRate,externalCoupons,treasuryForeignLiquidity(s,externalCoupons,flow));
  if(!settlementActive(s))foreignPayment(s,gov,-ecPaid);flow.interest+=ecPaid*s.exchangeRate;
  if(externalCoupons-ecPaid>(s.economy?.revision>=4?1e-9*Math.max(1,externalCoupons):0)) {
    const unpaid=externalCoupons-ecPaid;
    gov.externalBonds.forEach(bond=>{bond.inDefault=true;});
    const contractRate=s.economy?sum(gov.externalBonds.filter(bond=>(s.economy?.revision??0)<22||!foundationActive(s)||bond.issuedMonth!==s.month).map(bond=>yearCoupon(bond.principal,bond.rate)*bond.rate))/externalCoupons:w.globalRate/100+flow.sovereignSpread;
    gov.externalBonds.push({principal:unpaid,rate:s.economy?.revision>=22?0:contractRate,...(s.economy?.revision>=22?{interestArrears:true,originalContractRate:contractRate}:{}),maturity:s.month,inDefault:true,overdue:unpaid});
    flow.interestCapitalized+=unpaid*s.exchangeRate;flow.interest+=unpaid*s.exchangeRate;
    openDefaultEpisode(s,'payment-default',events);
  }
  for(const bond of gov.domesticBonds.filter(x=>x.maturity<=s.month)) {
    const paid=Math.min(Math.max(gov.cash,0),bond.principal);
    gov.cash-=paid;redeemDomestic(s,bond,paid);flow.domesticRedeemed+=paid;
    if(bond.principal>1e-6) {bond.inDefault=true;bond.overdue=bond.principal;openDefaultEpisode(s,'payment-default',events);}
  }
  for(const bond of gov.externalBonds.filter(x=>x.maturity<=s.month)) {
    const paid=settlementActive(s)?payTreasuryExternal(s,bond.principal,flow):Math.min(Math.max(gov.cash,0)/s.exchangeRate,bond.principal,treasuryForeignLiquidity(s,bond.principal,flow));
    if(!settlementActive(s))foreignPayment(s,gov,-paid);bond.principal-=paid;flow.externalRedeemed+=paid;
    if(bond.principal>1e-6) {bond.inDefault=true;bond.overdue=bond.principal;openDefaultEpisode(s,'payment-default',events);}
  }
  gov.domesticBonds=gov.domesticBonds.filter(x=>x.principal>1e-8);
  gov.externalBonds=gov.externalBonds.filter(x=>x.principal>1e-8);
  gov.arrears=sum(gov.domesticBonds.map(bond=>bond.overdue??0))+sum(gov.externalBonds.map(bond=>bond.overdue??0))*s.exchangeRate;
  const manualRestructuring=s.pendingActions.find(a=>a.kind==='restructure');
  if(manualRestructuring||(gov.defaultActive&&p.automaticRestructuring&&s.month-gov.defaultStart>=k.restructuringDelay)){
    const operation=restructureDebt(s,flow,events,manualRestructuring?{haircut:manualRestructuring.haircut,extension:manualRestructuring.extension,voluntary:true}:{});
    if(operation)actionResults.push(manualRestructuring?{...manualRestructuring,...operation,kind:'restructure',classification:operation.kind}:operation);
  }else if(gov.defaultActive&&debtInDefault(s)<1e-6){gov.defaultActive=false;gov.defaultEpisodes.at(-1).end=s.month;gov.excludedUntil=s.month+k.marketExclusionMonths;}
  payDefenseWages(s,militaryPlan,flow,socialPayroll);
  const incomeTaxAt=(payroll,wageShare,population,rate)=>
    payroll*wageShare*clamp(rate/100+p.incomeTaxProgressivity*.15*Math.log(Math.max(.01,wageShare/population)),0,.60)*s.institutions.taxCompliance;
  const hasLocalIncomeTax=territorialFiscal?.local.incomeTax>0;
  let localIncomeTax=hasLocalIncomeTax&&militaryPlan?Math.max(0,militaryPlan.tax-sum(
    GROUPS.map(g=>incomeTaxAt(militaryPlan.paid,g.wageShare,g.population,nationalPolicy.incomeTax)))):0;
  const transfersPaid=Math.min(Math.max(0,gov.cash),requestedTransfers);
  GROUPS.forEach((g,i)=>transfer(gov,s.households[i],transfersPaid*g.transferShare));flow.transfers=transfersPaid;
  paySocialTransfers(s,socialPlan,flow);
  socialCashBeforeSpending(s);
  const familyPaid=Math.min(Math.max(0,gov.cash),requestedFamily);
  GROUPS.forEach((g,i)=>transfer(gov,s.households[i],familyPaid*g.familyShare));flow.familyBenefits=familyPaid;
  const supportPaid=Math.min(Math.max(0,gov.cash),requestedSupport);
  s.firms.forEach((f,i)=>transfer(gov,f,supportPaid*s.base.output[i]/sum(s.base.output)));flow.businessSupport=supportPaid;
  const territorialGrants=payTerritorialBudgetGrants(s,flow,grants);
  const territorialBusiness=payTerritorialBusinessSupport(s,businessPrograms);
  flow.businessSupport+=sum(territorialBusiness.map(row=>row.paid));
  const programmeBudget=Math.min(Math.max(0,gov.cash),sum(localPurchases.map(row=>row.amount)));
  const centralPurchaseBudget=Math.min(Math.max(0,gov.cash-programmeBudget),territorialPlan?.central??requestedPurchases);
  const gBudget=centralPurchaseBudget+(territorialPlan?.own??0);
  if(militaryPlan&&programmeBudget>0){
    governmentMix=defenseGoodMix(s,governmentMix.militaryFraction*gBudget/(gBudget+programmeBudget));
    governmentWeights=governmentMix.weights;
  }
  if(gBudget<requestedPurchases*.99) events.push('Недостаток финансирования: часть государственных закупок отложена.');
  // External equity inflows and household foreign assets have explicit counterparts.
  const structuralInvestmentMarket=s.economy?(()=>{
    const domestic=dot(s.base.investmentWeights,s.firms.map(f=>f.price)),foreign=((s.economy.revision??0)>=15?basketPrice(s.base.investmentWeights,importGoodsPrices(s,w)):importUnitPrice(s,w))*(1+p.tariff/100);
    const share=domesticImportShare(s,s.base.investmentImport,domestic,foreign);
    return {share,price:(1-share)*domestic+share*foreign};
  })():null;
  const structuralFinance=s.economy?foreignFinancing(s,prev,flow,{foreignPayment},structuralInvestmentMarket.price):null;
  const inflowUSD=structuralFinance?.inflowUSD??budgetBase/s.exchangeRate*.008*s.institutions.confidence*(1-p.capitalControls/140)*Math.exp(-2*s.institutions.ownershipRisk)*(gov.defaultActive?.4:1);
  if(!s.economy)s.firms.forEach((f,i)=>{const usd=inflowUSD*s.base.output[i]/sum(s.base.output),oldValue=enterpriseValue(s,f),newShare=usd*s.exchangeRate/(oldValue+usd*s.exchangeRate);foreignPayment(s,f,usd);f.foreignEquityUSD+=usd;for(const key of ['state','domestic','municipal','cooperative'])f.ownership[key]*=1-newShare;f.ownership.foreign=f.ownership.foreign+(1-f.ownership.foreign)*newShare;f.domesticOwners=f.domesticOwners.map(v=>v*(1-newShare));f.workerOwners=f.workerOwners.map(v=>v*(1-newShare));});
  const wealthy=s.households.at(-1);
  const flightUSD=structuralFinance?.flightUSD??Math.min(Math.max(0,wealthy.cash)/s.exchangeRate*.015,
    budgetBase/s.exchangeRate*Math.max(0,.003+(s.expectedInflation-effectiveRate/100)*.08+(1-s.institutions.confidence)*.009)*(1-p.capitalControls/100));
  if(!s.economy){foreignPayment(s,wealthy,-flightUSD);wealthy.foreignSavingsUSD+=flightUSD;}
  const remittancesUSD=budgetBase/s.exchangeRate*(s.initialAccounts?.remittancesGDP??1)/100;
  GROUPS.forEach((g,i)=>foreignPayment(s,s.households[i],remittancesUSD*g.transferShare));
  let privateInterest=0;for(const a of borrowers(s)) privateInterest+=a.interestPaid;
  const corporateBondService=serviceCorporateBonds(s,{grantLoan:(state,actor,amount)=>{grantLoan(state,actor,amount);creditCreated+=amount;}});
  const consumerUnitPrices=s.firms.map(f=>f.price);
  const importPrice=s.economy?importUnitPrice(s,w):s.exchangeRate*s.worldPriceIndex/100*(.8+.2*w.energyPrice/100);
  const goodsImports=(s.economy?.revision??0)>=15?importGoodsPrices(s,w):Array(5).fill(importPrice);
  const componentPrice=importPrice*(supply?.componentPriceFactor??1);
  const realExchangeRate=s.exchangeRate*s.worldPriceIndex/prev.consumerPriceIndex;
  const basket=s.economy?structuralConsumptionWeights(s):s.base.consumptionWeights;
  const importShareC=s.economy?domesticImportShare(s,s.base.consumptionImport,dot(basket,consumerUnitPrices),basketPrice(basket,goodsImports)*(1+p.tariff/100)):clamp(s.base.consumptionImport*Math.pow(realExchangeRate,-k.importElasticity),.05,.35);
  const foodReplacement=agriculture?.importReplacement??0;
  const unit=(weights,share,prices=consumerUnitPrices)=>foodReplacementUnit(weights,share,prices,(s.economy?.revision??0)>=15?goodsImports:importPrice,p.tariff,foodReplacement);
  const cUnit=unit(basket,importShareC);
  const groupBaskets=s.households.map((h,i)=>consumptionActive(s)?groupBasket(s,i,basket,consumerUnitPrices,importShareC,(s.economy?.revision??0)>=15?goodsImports:importPrice):basket);
  const foodFractions=groupBaskets.map(w=>w.foodFractions??[1,0,0,0,0]);
  const buyerPrices=groupBaskets.map((_,i)=>socialHousingPrices(s,i,consumerUnitPrices,foodFractions[i][4]));
  const groupUnits=groupBaskets.map((w,i)=>unit(w,importShareC,buyerPrices[i]));
  const ownFoodBudgets=s.households.map((h,i)=>ownFoodBudget(s,i));
  serviceConsumerCredit(s,repayLoan);
  const householdBudgets=s.households.map((h,group)=>{
    const cashBefore=h.cash;
    const realSavingRate=realInterestRate(b.depositRate,s.expectedInflation);
    const effectiveRealRate=.55*realPolicy+.45*realSavingRate;
    const sensitive=clamp(Math.exp(-k.interestConsumptionElasticity*(effectiveRealRate-k.neutralRealRate)*(1+(1-h.mpc)*2)),.35,1.7);
    const services=privateServicePlans(s,Array(10).fill(1),s.firms[4].price)[consumptionActive(s)?group:0]?.total??0;
    const localUnit=consumptionActive(s)?groupUnits[group]:cUnit;
    // Service demand is proportional to budget; recover purchaser price of its
    // mixture with ordinary taxed goods without counting VAT on exempt services.
    const serviceFraction=services*s.firms[4].price;
    const effectiveUnitPrice=1/((1-serviceFraction)/(localUnit*(1+p.vat/100))+serviceFraction/s.firms[4].price);
    const macro=s.economy?.revision>=4?macroConsumption(s,h,group,effectiveRealRate,effectiveUnitPrice):null;
    let desired=macro?.desired??Math.max(0,((h.income-h.interestPaid)*h.mpc+h.cash*k.wealthAnnuity)*sensitive);
    let essentialSpending=0;
    if(consumptionActive(s)){const needs=basicNeeds(s,group,consumerUnitPrices,(s.economy?.revision??0)>=15?goodsImports:importPrice,importShareC),availableNeed=(needs.cost-(p.privateHealthEntry?0:needs.health*consumerUnitPrices[4])-(p.privateEducationEntry?0:needs.school*consumerUnitPrices[4]))*s.population*h.population;
      essentialSpending=Math.min(Math.max(0,availableNeed),Math.max(0,h.income-h.interestPaid)+Math.max(0,h.cash-h.income*2)*s.householdEconomy.assumptions.liquidDrawRate);desired=Math.max(desired,essentialSpending);}
    const maxLoan=consumerCreditLimit(s,group,Math.max(0,h.income*12*.60-h.loanLC-h.loanFX*s.exchangeRate)*.025*b.creditSupply);
    const loan=Math.min(maxLoan,Math.max(0,desired-h.cash-ownFoodBudgets[group])*.5);
    grantLoan(s,h,loan,0);creditCreated+=loan;recordConsumerLoan(s,group,loan,cashBefore);
    const smoothed=macro?.smoothed??(.22*desired+.78*h.consumption*localUnit*(1+p.vat/100));
    const plannedSpending=consumptionActive(s)?Math.max(smoothed,essentialSpending):smoothed;
    const budget=Math.min(plannedSpending,Math.max(0,h.cash)*.88+ownFoodBudgets[group]);
    trace.households.push({group,...(macro?{macro}:{}),income:h.income,interestPaid:h.interestPaid,mpc:h.mpc,cashBefore,wealthAnnuity:k.wealthAnnuity,effectiveRealRate,rateResponse:sensitive,desiredSpending:desired,creditLimit:maxLoan,creditRequested:Math.max(0,desired-cashBefore-ownFoodBudgets[group])*.5,loanGranted:loan,smoothedSpending:smoothed,...(consumptionActive(s)?{essentialSpending,plannedSpending}:{}),cashSpendingLimit:Math.max(0,h.cash)*.88,...(s.economy?.revision>=20?{inKindBudget:ownFoodBudgets[group]}:{}),budget,cashBound:budget<plannedSpending,consumerUnitPrice:localUnit,vat:p.vat/100});
    return budget;
  });
  const servicePrice=s.firms[4].price;
  const servicePlans=privateServicePlans(s,householdBudgets,servicePrice);
  reserveRelocation(s,householdBudgets,servicePlans,servicePrice);
  planDurableConsumption(s,householdBudgets,groupBaskets,foodFractions,groupUnits,servicePlans,consumerUnitPrices,(s.economy?.revision??0)>=15?goodsImports:importPrice,importShareC,trace.households.map(t=>t.essentialSpending??0));
  if(s.economy?.revision>=22)trace.households.forEach((t,i)=>{t.usedAssetReserve=s.durableGoods.plans[i].usedReserved;t.durableSavingsDraw=s.durableGoods.plans[i].extra;t.durableUnspent=s.durableGoods.plans[i].originalBudget+t.durableSavingsDraw-householdBudgets[i]-t.usedAssetReserve;t.preDurableConsumerUnitPrice=t.consumerUnitPrice;t.consumerUnitPrice=groupUnits[i];t.budget=householdBudgets[i];t.durablePlan={newGoods:s.durableGoods.plans[i].plannedNewSpend,repairs:s.durableGoods.plans[i].plannedRepairSpend};});
  const householdPlans=householdBudgets.map((budget,i)=>Math.max(0,budget-servicePlans[i].total*servicePrice)/((consumptionActive(s)?groupUnits[i]:cUnit)*(1+p.vat/100)));
  const ordinaryCVolume=sum(householdPlans),privateServiceVolume=sum(servicePlans.map(x=>x.total));
  const cVolume=ordinaryCVolume+privateServiceVolume;
  const investmentImportShare=s.economy?structuralInvestmentMarket.share:.4;
  const iUnit=unit(s.base.investmentWeights,investmentImportShare);
  const investmentPlans=s.firms.map((f,i)=>{
    const expectedGrowth=clamp(f.salesExpected/Math.max(prev.firms[i].production,1)-1,-.4,.4);
    const target=s.base.investment*s.base.output[i]/sum(s.base.output)*Math.pow(Math.max(.25,f.salesExpected/s.base.output[i]),.8)
      *clamp(Math.exp(-k.interestInvestmentElasticity*(realInterestRate(b.lendingRate,s.expectedInflation)-.07)+expectedGrowth*.8),.15,2.5)
      *( .55+.65*s.institutions.confidence)*Math.exp(-s.institutions.ownershipRisk*.8)*f.managementEfficiency;
    const desired=s.economy?structuralFinance.plans[i].desired:f.lastInvestment+k.investmentAdjustment*(target-f.lastInvestment);
    if(i!==2&&sectorCompanies(s,i).length){const funded=financeFirmInvestment(s,i,desired,iUnit,grantLoan);creditCreated+=funded.loan;if(i===4)planServiceInvestment(s,funded.funded);trace.investment.push({sector:i,desired:funded.desired,cashBefore:f.cash,investmentUnitPrice:iUnit,loanGranted:funded.loan,fundedPlan:funded.funded,financeBound:funded.funded<funded.desired,firmPlans:sectorCompanies(s,i).map(c=>({id:c.id,...c.investmentDecision}))});return funded.funded;}
    const cashBefore=f.cash;
    const buffer=f.production*(s.economy?.revision>=2?f.price:1)*.20;
    const need=Math.max(0,desired*iUnit+buffer-f.cash);
    if(i===2&&industryCompanies(s).length){const funded=financeEnterpriseInvestment(s,desired,iUnit,grantLoan);creditCreated+=funded.loan;trace.investment.push({sector:i,...(structuralFinance?.plans[i]??{}),desired:funded.desired,cashBefore,buffer,investmentUnitPrice:iUnit,loanGranted:funded.loan,...(businessDynamicsActive(s)?{enterprisePlans:industryCompanies(s).map(c=>({id:c.id,...c.investmentDecision,funded:c.fundedInvestment,bondIssued:c.bondIssued??0}))}:{}),fundedPlan:funded.funded,financeBound:funded.funded<funded.desired});return funded.funded;}
    const loan=Math.min(need,Math.max(0,f.lastRevenue*12*.75-f.loanLC-f.loanFX*s.exchangeRate)*.04*b.creditSupply);
    grantLoan(s,f,loan,s.resourceMode&&i===1?.25:.08);creditCreated+=loan;
    const funded=Math.max(0,Math.min(desired,(f.cash-buffer)/Math.max(iUnit,1e-9)));
    const serviceAllocation=i===4?planServiceInvestment(s,funded):null;
    trace.investment.push({sector:i,...(structuralFinance?.plans[i]??{}),desired,cashBefore,buffer,investmentUnitPrice:iUnit,creditRequested:need,loanGranted:loan,fundedPlan:funded,financeBound:funded<desired,...(serviceAllocation?{serviceAllocation}:{})});
    return funded;
  });
  const housingPlan=privateHousingPlan(s,iUnit,investmentPlans[4]*iUnit);
  let iVolume=sum(investmentPlans)+housingPlan;
  const networkPlans=foundationActive(s)?s.firms.map(()=>[]):infrastructurePlans(s,investmentPlans);
  const operatorPlans=foundationActive(s)?networkFinance(s,iUnit,b.creditSupply,grantLoan):[];
  const operatorVolume=sum(operatorPlans.map(x=>x.amount));iVolume+=operatorVolume;trace.networkInvestment=operatorPlans;
  const governmentImportShare=s.economy?domesticImportShare(s,governmentMix.imports,dot(governmentWeights,consumerUnitPrices),basketPrice(governmentWeights,goodsImports)*(1+p.tariff/100)):.13;
  const gUnit=unit(governmentWeights,governmentImportShare);
  const gVolume=(gBudget+programmeBudget)/gUnit;
  const exportVolumes=s.economy?exportDemand(s,prev,w):s.firms.map((f,i)=>{
    const commodityFactor=s.resourceMode&&i===1?1:Math.pow(realExchangeRate,k.exportElasticity);
    const target=s.base.exports*s.base.exportWeights[i]*(w.foreignDemand/100)*Math.pow(1.025,s.month/12)*commodityFactor;
    const old=prev.lastReport.market?.exports?.[i]??s.base.exports*s.base.exportWeights[i];
    return Math.max(0,old+.22*(target-old));
  });
  let domesticC=consumptionActive(s)?basket.map((_,i)=>sum(householdPlans.map((q,j)=>q*groupBaskets[j][i]))*(1-importShareC)+(i===4?privateServiceVolume:0)):basket.map((x,i)=>x*ordinaryCVolume*(1-importShareC)+(i===4?privateServiceVolume:0));
  let domesticI=s.base.investmentWeights.map(x=>x*iVolume*(1-investmentImportShare));
  let domesticG=governmentWeights.map(x=>x*gVolume*(1-governmentImportShare));
  const foodImportVolume=(domesticC[0]+domesticI[0]+domesticG[0])*foodReplacement;
  domesticC[0]*=1-foodReplacement;domesticI[0]*=1-foodReplacement;domesticG[0]*=1-foodReplacement;
  const finalDemand=zeros().map((_,i)=>domesticC[i]+domesticI[i]+domesticG[i]+exportVolumes[i]);
  const externalConstraint=s.economy?{availableUSD:Math.max(0,b.foreignAssetsUSD+foreignCreditLimitUSD(s)),finalImportsUSD:(s.economy.revision>=15?(sum(householdPlans.map((q,j)=>q*basketPrice(groupBaskets[j],goodsImports)))*importShareC+iVolume*investmentImportShare*basketPrice(s.base.investmentWeights,goodsImports)+gVolume*governmentImportShare*basketPrice(governmentWeights,goodsImports)+foodImportVolume*goodsImports[0]):(ordinaryCVolume*importShareC+iVolume*investmentImportShare+gVolume*governmentImportShare+foodImportVolume)*importPrice)/s.exchangeRate,exportsUSD:dot(exportVolumes,s.firms.map(f=>f.price))/s.exchangeRate,intermediateUnitUSD:s.firms.map(f=>f.importCoefficient*componentPrice/s.exchangeRate)}:null;
  const proportionalMarket=constrainedProduction(s,finalDemand,capacity,externalConstraint);
  const market=s.economy?.revision>=2&&proportionalMarket.alpha<1-1e-8?(s.economy.revision>=5?allocateMarketWithReservedStocks:s.economy.revision>=4?allocateMarketWithStocks:allocateMarket)({matrix,inventory:s.firms.map(f=>enterpriseAvailableInventory(s,f)),capacity,domestic:domesticC.map((v,i)=>v+domesticI[i]+domesticG[i]),exports:exportVolumes,prices:s.firms.map(f=>f.price),external:externalConstraint,sectorExports:s.economy.revision>=7}):proportionalMarket;
  const alpha=market.alpha,exportAlpha=market.exportAlpha??alpha;
  const deliveredExports=exportVolumes.map((v,i)=>v*(market.sectorExportFulfillment?.[i]??exportAlpha));
  const deliveredExportValue=dot(deliveredExports,s.firms.map(f=>f.price));
  const deliveredFinalDemand=market.delivered??finalDemand.map(v=>v*alpha);
  const requestedProduction=solveLeontief(finalDemand,matrix);
  const production=market.production;
  const initialInventories=s.firms.map(f=>enterpriseAvailableInventory(s,f));
  const revenue=zeros(),inputCost=zeros();
  let importNominal=0,importReal=0,exportNominal=0,intermediateDuties=0;
  // Interindustry payments are simultaneous: temporary negative cash is resolved at settlement.
  s.firms.forEach((buyer,j)=>{
    s.firms.forEach((seller,i)=>{
      const value=matrix[i][j]*production[j]*seller.price;
      transfer(buyer,seller,value);revenue[i]+=value;inputCost[j]+=value;
    });
    const imported=buyer.importCoefficient*production[j];
    const value=imported*componentPrice;
    foreignPayment(s,buyer,-value/s.exchangeRate);importNominal+=value;importReal+=imported;inputCost[j]+=value;
    const duty=value*p.tariff/100;transfer(buyer,gov,duty);flow.tariff+=duty;intermediateDuties+=duty;inputCost[j]+=duty;
  });
  function finalPurchase(actor,volume,weights,foreignShare,vat=false,prices=null,inKind=0) {
    let spent=0;
    s.firms.forEach((f,i)=>{
      const value=volume*alpha*(1-foreignShare)*weights[i]*(i===0?1-foodReplacement:1)*(prices?.[i]??f.price);
      transfer(actor,f,value-(i===0?inKind:0));revenue[i]+=value;spent+=value;
    });
    const imports=volume*alpha*(foreignShare+(1-foreignShare)*weights[0]*foodReplacement);
    const value=(s.economy?.revision??0)>=15?volume*alpha*(foreignShare*basketPrice(weights,goodsImports)+(1-foreignShare)*weights[0]*foodReplacement*goodsImports[0]):imports*importPrice;
    foreignPayment(s,actor,-value/s.exchangeRate,flow);importNominal+=value;importReal+=imports;spent+=value;
    const duty=value*p.tariff/100;transfer(actor,gov,duty);flow.tariff+=duty;spent+=duty;
    if(vat) {const tax=spent*p.vat/100;transfer(actor,gov,tax);flow.vat+=tax;spent+=tax;}
    return spent;
  }
  let consumptionNominal=0,investmentNominal=0;
  const householdPayments=[],housingPaid=[],ownFoodPaid=[];
  let rentPremium=0;
  s.households.forEach((h,i)=>{h.consumption=(householdPlans[i]+servicePlans[i].total)*alpha;
    ownFoodPaid[i]=capFamilyFood(s,i,Math.min(ownFoodBudgets[i]*alpha,householdPlans[i]*alpha*(1-importShareC)*groupBaskets[i][0]*(1-foodReplacement)*buyerPrices[i][0]),production[0],consumerUnitPrices[0],inputCost[0],iUnit);
    const goods=finalPurchase(h,householdPlans[i],groupBaskets[i],importShareC,true,buyerPrices[i],ownFoodPaid[i]);
    if(socialActive(s)){housingPaid[i]=housingPayment(s,i,householdPlans[i]*alpha,groupBaskets[i],importShareC,consumerUnitPrices,foodFractions[i][4]);rentPremium+=householdPlans[i]*alpha*(1-importShareC)*groupBaskets[i][4]*(buyerPrices[i][4]-consumerUnitPrices[4]);}
    const services=finalPurchase(h,servicePlans[i].total,[0,0,0,0,1],0,false);
    consumptionNominal+=goods;consumptionNominal+=services;householdPayments.push({goods,services});});
  settleDurables(s,alpha);
  s.firms.forEach((f,i)=>{
    if(i===2&&industryCompanies(s).length)s.enterpriseMarket.mode='investment';else if(sectorCompanies(s,i).length)s.firmMarkets.markets.find(m=>m.sector===i).mode='investment';
    investmentNominal+=finalPurchase(f,investmentPlans[i],s.base.investmentWeights,investmentImportShare);
    if(i===2&&industryCompanies(s).length)s.enterpriseMarket.mode='operations';else if(sectorCompanies(s,i).length)s.firmMarkets.markets.find(m=>m.sector===i).mode='operations';
    const actual=investmentPlans[i]*alpha;f.lastInvestment=actual;if(sectorCompanies(s,i).length)for(const c of sectorCompanies(s,i))c.lastInvestment=c.fundedInvestment*alpha;
    let allocated=0;
    for(const plan of networkPlans[i]){const amount=plan.amount*alpha;allocated+=amount;if(amount>0)s.projects.push({type:'network',...plan,amount,sector:i,due:s.month+Math.round(k.publicInvestmentDelay),efficiency:1,legacy:false});}
    if(actual>allocated) s.projects.push(stampForeignFunding(s,tagInvestmentProject(s,{type:'private',...(agriculture?{createdMonth:s.month}:{}),sector:i,...(i===4?serviceProjectAllocation(s):{}),...(i!==2&&sectorCompanies(s,i).length?firmProjectAllocation(s,i):{}),...(i===2&&industryCompanies(s).length?{enterpriseShares:industryCompanies(s).map(c=>investmentPlans[i]>0?c.fundedInvestment/investmentPlans[i]:0),...(businessDynamicsActive(s)?{enterpriseIds:industryCompanies(s).map(c=>c.id)}:{})}:{}),amount:actual-allocated,due:s.month+Math.round(k.privateInvestmentDelay),efficiency:1,legacy:false,...(s.economy?{importShare:investmentImportShare}:{})}),iUnit));
  });
  for(const plan of operatorPlans){const actor=s.networks.find(n=>n.id===plan.network).operator;investmentNominal+=finalPurchase(actor,plan.amount,s.base.investmentWeights,investmentImportShare);const amount=plan.amount*alpha;if(amount>0)s.projects.push({type:'network',...plan,amount,sector:4,due:s.month+s.foundation.assumptions.networkProjectMonths,efficiency:1,legacy:false});}
  if(housingPlan>0)investmentNominal+=finalPurchase(s.firms[4],housingPlan,s.base.investmentWeights,investmentImportShare);
  flow.purchases=finalPurchase(gov,gVolume,governmentWeights,governmentImportShare);
  const programmePaid=programmeBudget>0?flow.purchases*programmeBudget/(gBudget+programmeBudget):0;
  settleTerritorialPrograms(s,flow,programmePaid,localPurchases,territorialBusiness);
  const basePurchases=flow.purchases-programmePaid;
  const programmeAmount=key=>territorialProgramSpending(flow,key);
  const territorialPurchases=settleTerritorialPurchases(s,territorialPlan,basePurchases,gBudget,centralPurchaseBudget);
  if(territorialPurchases)gov.cash+=territorialPurchases.own-territorialPurchases.grantReserve;
  const directShare=territorialPurchases?clamp((basePurchases-territorialPurchases.spending)/
    Math.max(1e-9,territorialPlan.central-territorialPlan.grant),0,1):0;
  const ordinaryPurchases=territorialPurchases?directShare*requestedPurchases:flow.purchases;
  const ordinaryAmount=share=>ordinaryPurchases*share/Math.max(goodsPurchaseShare,.001);
  const localPaid=key=>territorialPurchases?sum(territorialPurchases.rows.map(row=>row.byKey[key])):0;
  const delegatedAmount=key=>ordinaryAmount(p[key])-directShare*(territorialPlan?.planned[key]??0)+localPaid(key);
  if(militaryPlan){
    const volume=gVolume*alpha*governmentMix.militaryFraction;
    const orders=governmentMix.militaryWeights.map((weight,i)=>volume*(1-governmentImportShare)*weight*(i===0?1-foodReplacement:1)*consumerUnitPrices[i]);
    flow.defenseDomesticOrders=sum(orders);flow.defensePrivateOrders=sum(orders.map((value,i)=>value*(s.firms[i].ownership.domestic+s.firms[i].ownership.cooperative+s.firms[i].ownership.foreign)));
    flow.defenseImportedOrders=volume*(governmentImportShare+(1-governmentImportShare)*governmentMix.militaryWeights[0]*foodReplacement)*importPrice*(1+p.tariff/100);
  }
  if(foundationActive(s)){flow.research=ordinaryAmount(p.researchBudget);flow.taxAdministration=ordinaryAmount(p.taxAdministrationBudget);s.foundation.last.research=flow.research;}
  // Army is a tagged part of existing final purchases, never an additional GDP flow.
  if(socialActive(s)){flow.socialHousing=ordinaryAmount(p.socialHousingBudget)+programmeAmount('socialHousing');flow.retraining=ordinaryAmount(p.retrainingBudget)+programmeAmount('retraining');}
  flow.militaryPurchases=militaryPlan?flow.militaryWages+ordinaryAmount(Math.max(0,(p.militaryBudget??0)-plannedMilitaryWages/Math.max(budgetBase,1e-9)*100)):ordinaryPurchases*(p.militaryBudget??0)/Math.max(purchaseShare,.001);
  if(localGovernmentActive(s))flow.localAdministration=ordinaryAmount(p.localAdministrationBudget);
  if(agriculture){flow.agricultureProtection=ordinaryAmount(p.agricultureProtection)+programmeAmount('agricultureProtection');finishAgriculture(s,{paid:flow.agricultureProtection,regional:(flow.territorialPrograms??[]).filter(row=>row.programme==='agricultureProtection'&&row.paid>0),unit:gUnit,investmentPrice:iUnit,privateInvestment:investmentPlans[0]*alpha});}
  flow.healthcare=delegatedAmount('healthcare')+programmeAmount('healthcare');
  flow.education=delegatedAmount('education')+programmeAmount('education');
  flow.childcare=ordinaryAmount(p.childcareBudget);
  flow.infrastructureMaintenance=delegatedAmount('infrastructureMaintenance')+programmeAmount('infrastructureMaintenance');
  flow.institutionCost=ordinaryAmount(administrationShare);
  flow.antitrust=ordinaryAmount(p.antitrustBudget);
  flow.courts=ordinaryAmount(p.courtBudget);
  flow.soeAudits=ordinaryAmount(p.soeAuditBudget);
  flow.politicalElections=ordinaryPurchases*p.electionAdministration/Math.max(purchaseShare,.001);
  flow.politicalSecurity=ordinaryPurchases*p.securityBudget/Math.max(purchaseShare,.001);
  flow.politicalPatronage=ordinaryPurchases*p.patronageBudget/Math.max(purchaseShare,.001);
  flow.institutionRequested={antitrust:budgetBase*p.antitrustBudget/100,courts:budgetBase*p.courtBudget/100,soeAudits:budgetBase*p.soeAuditBudget/100};
  fundInstitutionServices(s,flow,gUnit);
  recordLocalServices(s,flow,territorialPurchases);
  settleServices(s,prev,flow,servicePlans,alpha,servicePrice,gUnit);
  if(territorialPurchases)flow.publicInvestment=delegatedAmount('publicInvestment')+programmeAmount('publicInvestment');
  const publicInvestmentVolume=territorialPurchases?flow.publicInvestment/gUnit:gVolume*alpha*p.publicInvestment/Math.max(goodsPurchaseShare,.001);
  const ordinaryPublicVolume=Math.max(0,publicInvestmentVolume-programmeAmount('publicInvestment')/gUnit);
  const publicProject={type:'public',due:s.month+Math.round(k.publicInvestmentDelay),efficiency:s.institutions.investmentEfficiency,legacy:false};
  const localInvestment=territorialPurchases&&s.territorialGovernment?.localProperty===true?
    territorialPurchases.rows.filter(row=>row.byKey.publicInvestment>0):[];
  const centralPublicVolume=Math.max(0,ordinaryPublicVolume-sum(localInvestment.map(row=>row.byKey.publicInvestment))/gUnit);
  if(centralPublicVolume>0)s.projects.push({...publicProject,amount:centralPublicVolume,...(localGovernmentActive(s)?{
    localPlan:localPublicInvestmentPlan(s,centralPublicVolume,s.territorialGovernment?.localProperty!==undefined?0:territorialPurchases?
      localPaid('publicInvestment')/Math.max(1e-9,ordinaryPublicVolume*gUnit):undefined),
  }:{})});
  if(localInvestment.length){
    const areas=territorialGeography(s,prev.regional?.regions);
    for(const row of localInvestment){
      const area=areas.find(item=>item.id===row.id);
      const amount=row.byKey.publicInvestment/gUnit;
      s.projects.push({...publicProject,amount,territory:{id:row.id,regionId:row.regionId},territorialOwner:row.id,
        localPlan:territorialNetworkPlan(s,area,amount)});
    }
  }
  for(const row of flow.territorialPrograms??[])if(row.programme==='publicInvestment'&&row.paid>0){
    const amount=row.paid/gUnit;
    s.projects.push({...publicProject,amount,territory:{id:row.territoryId,regionId:row.regionId},
      ...(localGovernmentActive(s)?{localPlan:localPublicInvestmentPlan(s,amount,0)}:{})});
  }
  const temporarySupply=!!supply&&production.some((v,i)=>
    v>=capacity[i]*(1-1e-7)&&(supply.sectors[i].capacityFactor<1-1e-8||i===0&&w.weather<100));
  const fxRationed=externalConstraint!==null&&dot(production,externalConstraint.intermediateUnitUSD)
    +alpha*externalConstraint.finalImportsUSD-deliveredExportValue/s.exchangeRate>=externalConstraint.availableUSD-1e-6;
  const partners=partnerTradeReport(s,prev,deliveredExports.map((v,i)=>v*s.firms[i].price/s.exchangeRate),importNominal/s.exchangeRate);
  const demandSignals=zeros();
  s.firms.forEach((f,i)=>{
    const value=deliveredExports[i]*f.price;
    foreignPayment(s,f,value/s.exchangeRate);revenue[i]+=value;exportNominal+=value;
    f.inventory=enterpriseEndingInventory(s,f,Math.max(0,market.ending[i]));
    f.production=production[i];f.utilization=production[i]/Math.max(capacity[i],1e-9);
    if(s.economy?.revision>=4)f.unfilledOrders=Math.max(0,requestedProduction[i]-production[i]);
    const salesSignal=supply?supplySalesSignal({orders:requestedProduction[i],production:production[i],
      physicalCapacity:physicalCapacity[i],normalUtilization:s.economy.parameters.normalUtilization,
      temporarySupply:temporarySupply&&!fxRationed}):s.economy?.revision>=4?production[i]:requestedProduction[i];
    demandSignals[i]=salesSignal;
    f.salesExpected+=.25*(salesSignal-f.salesExpected);
  });
  flow.infrastructureFees=sum(servicePlans.map(p=>p.fee))*alpha*servicePrice;
  s.firms.forEach((f,i)=>{f.maintenanceInputs=production[i]*(matrix[3][i]*s.firms[3].price+matrix[2][i]*s.firms[2].price)*.35;});
  if(foundationActive(s))networkReceipts(s,flow.infrastructureFees,transfer);
  settleInfrastructure(s,flow,{transfer,fundGovernment},events,iUnit);
  if((s.economy?.revision??0)>=13){inputCost[4]+=flow.infrastructureFees;revenue[4]+=sum(s.networks.map(n=>n.operator.lastMaintenance??0));}
  const socialIncome=i=>socialActive(s)?s.social.last.pensions[i]+s.social.last.unemployment[i]+s.social.last.housingAid[i]+s.social.last.privateBenefits[i]:0;
  const householdIncome=s.households.map((h,i)=>(militaryPlan?.netGroups[i]??0)+socialIncome(i)+h.depositIncome+(h.bondIncome??0)+(h.corporateBondIncome??0)+h.foreignIncome*s.exchangeRate+transfersPaid*GROUPS[i].transferShare+familyPaid*GROUPS[i].familyShare+remittancesUSD*s.exchangeRate*GROUPS[i].transferShare);
  const householdMarket=s.households.map((h,i)=>(militaryPlan?.grossGroups[i]??0)+h.depositIncome+(h.bondIncome??0)+(h.corporateBondIncome??0)+h.foreignIncome*s.exchangeRate);
  const householdSources=s.households.map((h,i)=>({labor:militaryPlan?.netGroups[i]??0,...(s.economy?.revision>=24?{mixed:0}:{}),transfers:socialIncome(i)+transfersPaid*GROUPS[i].transferShare+familyPaid*GROUPS[i].familyShare,capital:h.depositIncome+(h.bondIncome??0)+(h.corporateBondIncome??0)+h.foreignIncome*s.exchangeRate,remittances:remittancesUSD*s.exchangeRate*GROUPS[i].transferShare}));
  let totalWages=militaryPlan?.paid??0,foreignDividendsUSD=0,reinvestedFDIUSD=0;
  const grossByGroup=militaryPlan?[...militaryPlan.grossGroups]:Array(10).fill(0);
  if(socialActive(s)){const rent=Math.min(s.firms[4].cash,s.social.last.publicRent);transfer(s.firms[4],gov,rent);flow.stateDividends+=rent;inputCost[4]+=rent;}
  settleFamilyRent(s,inputCost,revenue);
  for(const c of familyCompanies(s))c.familyDividendPaid=0;
  s.firms.forEach((f,i)=>{
    if(i===2&&industryCompanies(s).length)s.enterpriseMarket.mode='payroll';else if(sectorCompanies(s,i).length)s.firmMarkets.markets.find(m=>m.sector===i).mode='payroll';
    const depreciation=(f.capital*(-annualToMonthly(-k.annualDepreciation))+(f.infrastructureDepreciation??0))*iUnit;
    const payroll=prepareFamilyPayroll(s,i,{revenue:revenue[i],inputs:inputCost[i],depreciation,ownFood:ownFoodPaid})??f.workers*f.wage*(p.normalWorkweek/40)*(1-f.labor.strikeShare);
    totalWages+=payroll;
    const wageShares=laborWageShares(s,f,GROUPS);
    const groupTaxes=GROUPS.map((g,j)=>incomeTaxAt(payroll,wageShares[j],s.households[j].population,p.incomeTax));
    const taxable=sum(groupTaxes);
    if(hasLocalIncomeTax)localIncomeTax+=Math.max(0,taxable-sum(GROUPS.map((g,j)=>
      incomeTaxAt(payroll,wageShares[j],s.households[j].population,nationalPolicy.incomeTax))));
    transfer(f,gov,taxable);flow.incomeTax+=taxable;
    GROUPS.forEach((g,j)=>{const value=payroll*wageShares[j]-groupTaxes[j];transfer(f,s.households[j],value-(i===0?ownFoodPaid[j]:0));const contribution=socialPayroll(s,j,payroll*wageShares[j],flow);grossByGroup[j]+=payroll*wageShares[j];householdIncome[j]+=value-contribution;householdMarket[j]+=payroll*wageShares[j];const mixed=familyNetDraw(s,i,j,value-contribution,payroll*wageShares[j]);householdSources[j].labor+=value-contribution-mixed;if(s.economy?.revision>=24)householdSources[j].mixed+=mixed;});
    if(i===2&&industryCompanies(s).length)s.enterpriseMarket.mode='operations';else if(sectorCompanies(s,i).length)s.firmMarkets.markets.find(m=>m.sector===i).mode='operations';
    finishFamilyPayroll(s,i);
    const royalty=i===1&&s.resourceMode?revenue[i]*p.royalty/100:0;
    transfer(f,gov,royalty);flow.royalty+=royalty;
    const profit=revenue[i]+(f.concessionSupport??0)-inputCost[i]-payroll-f.interestPaid-royalty-depreciation;
    const companies=sectorCompanies(s,i).length;
    const firmPlans=companies?(i===2?enterpriseProfitPlan(s,{revenue:revenue[i],inputs:inputCost[i],payroll,depreciation}):firmProfitPlan(s,i,{revenue:revenue[i],inputs:inputCost[i],payroll,depreciation})):null;
    const tax=companies?sum(firmPlans.map(x=>x.tax)):Math.max(0,profit)*p.corporateTax/100*s.institutions.taxCompliance;
    if(companies){const payouts=settleEnterpriseDividends(s,firmPlans,flow,{transfer,foreignPayment,availableFX:()=>availableForeignLiquidity(s),onIncome:(j,value,company)=>{if(company.familyGroup!==undefined)company.familyDividendPaid=(company.familyDividendPaid??0)+value;recordOwnerDividend(s,company,j,value);householdIncome[j]+=value;householdMarket[j]+=value;if(s.economy?.revision>=24&&company.familyGroup!==undefined)householdSources[j].mixed+=value;else householdSources[j].capital+=value;}});foreignDividendsUSD+=payouts.foreignDividendsUSD;reinvestedFDIUSD+=payouts.reinvestedFDIUSD;}
    else {transfer(f,gov,tax);flow.corporateTax+=tax;
    const excessCash=Math.max(0,f.cash-revenue[i]*2.0-investmentPlans[i]*iUnit*.5);
    const dividend=Math.min(Math.max(0,profit-tax)*k.dividendPayout+excessCash*.05,Math.max(0,f.cash)*.30);
    const foreignShare=f.ownership.foreign;
    const externalDividend=Math.min(dividend*foreignShare,availableForeignLiquidity(s)*s.exchangeRate);
    foreignPayment(s,f,-externalDividend/s.exchangeRate);foreignDividendsUSD+=externalDividend/s.exchangeRate;
    if(s.economy){
      // BPM6: retained foreign earnings debit primary income and credit direct
      // investment equally. No second cash deposit or automatic GDP addition.
      const retained=Math.max(-f.foreignEquityUSD,((profit-tax)*foreignShare-externalDividend)/s.exchangeRate);
      f.foreignEquityUSD+=retained;reinvestedFDIUSD+=retained;
    }
    payTerritorialDividends(s,f,dividend,flow,transfer);
    GROUPS.forEach((g,j)=>{const value=dividend*(f.domesticOwners[j]+f.workerOwners[j]);transfer(f,s.households[j],value);recordOwnerDividend(s,f,j,value);householdIncome[j]+=value;householdMarket[j]+=value;householdSources[j].capital+=value;});
    }
    f.lastProfit=profit-tax;f.lastRevenue=revenue[i];
    if(s.economy)observeOperatingSurplus(s,f,revenue[i],inputCost[i],payroll,royalty);
    if(companies){for(const c of sectorCompanies(s,i)){const r=i===2?resolveEnterprise(s,c,flow,events,{grantLoan,repayLoan,writeOff,transfer}):resolveFirm(s,i,c,flow,events,{grantLoan,repayLoan,writeOff,transfer});creditCreated+=r.credit;creditLosses+=r.loss;}}
    else if(f.cash<0) {
      const overdraft=-f.cash;grantLoan(s,f,overdraft);creditCreated+=overdraft;f.arrears=overdraft;
      if(overdraft>Math.max(s.economy?.revision>=2?s.base.monthlyGDP*.002:10,revenue[i]*.20)) {
        const loss=writeOff(s,f,.20);creditLosses+=loss;f.defaulted=true;
        // A debt write-off transfers financial losses; it does not physically
        // destroy equipment or establish a universal 10% fall in demand.
        // IMF Asonuma et al. 2019: credit/inflow channels depend on restructuring.
        if(!(s.economy?.revision>=2)){f.capital*=.98;f.salesExpected*=.9;}
        events.push(`${f.name}: неплатёжеспособность и списание части кредита.`);
      }
    } else {f.arrears=0;f.defaulted=false;}
    // Repeated loss support is observable for any owner, not a public label.
    const supported=s.economy?.revision>=2?(supportPaid*s.base.output[i]/sum(s.base.output)+sum(territorialBusiness.map(row=>row.bySector[i]))+(f.concessionSupport??0))>0:(f.ownership.state+f.ownership.municipal)>.5&&p.businessSupport>0;
    f.softBudget+=.05*((f.lastProfit<0&&supported?1:0)-f.softBudget);
  });
  settleRentSeeking(s,flow,governmentWeights.map((weight,i)=>gVolume*alpha*(1-governmentImportShare)*weight*consumerUnitPrices[i]),householdIncome,householdSources,events);
  flow.tax=flow.vat+flow.tariff+flow.incomeTax+flow.corporateTax+flow.royalty+(flow.socialContributions??0);
  if(territorialFiscal)flow.localTax=Object.fromEntries(Object.entries(territorialFiscal.local).map(([key,rate])=>
    [key,key==='incomeTax'?localIncomeTax:p[key]>0?flow[key]*rate/p[key]:0]));
  settleTerritorialTaxes(s,territorialPlan,flow);
  function payForeignCommitment(amount){
    const fundedUSD=Math.min(amount,Math.max(0,gov.cash))/s.exchangeRate;
    if(!fundedUSD)return 0;
    const paidUSD=Math.min(fundedUSD,treasuryForeignLiquidity(s,fundedUSD,flow));
    foreignPayment(s,gov,-paidUSD,flow);
    return paidUSD*s.exchangeRate;
  }
  if(diplomacyActive(s)){
    flow.scenarioDiplomacy=settleScenarioDiplomacy(s,
      amount=>foreignPayment(s,gov,amount/s.exchangeRate,flow),payForeignCommitment,events);
  }
  const commitment=worldDecisionEffects(s).spending*budgetBase;
  if(commitment>0){
    flow.worldCommitments=payForeignCommitment(commitment);
    if(s.politics.britishDefenseRevision===1)flow.worldCommitmentDue=commitment;
  }
  const diplomacyEntries=Object.values(flow.scenarioDiplomacy??{});
  const diplomacyPaid=sum(diplomacyEntries.map(item=>item.paid+item.programPaid))+(flow.worldCommitments??0);
  const diplomacyReceipts=sum(diplomacyEntries.map(item=>item.receipts));
  const desiredFundSaving=s.resourceMode?flow.royalty*p.stabilizationSaving/100:0;
  const fundSaving=s.economy?.revision>=23&&(flow.fundWithdrawal>0||gov.arrears>1e-8)?0:Math.min(desiredFundSaving,Math.max(0,gov.cash)*.30,...(s.economy?.revision>=23?[Math.max(0,gov.cash-budgetBase*.15)]:[]),...(foundationActive(s)?[Math.max(0,flow.tax+flow.centralIncome+flow.stateDividends+(flow.integrityReceipts??0)-flow.purchases-(militaryPlan?.paid??0)-flow.transfers-flow.familyBenefits-flow.businessSupport-flow.concessionGuarantees-flow.interest)]:[]));
  if(fundSaving>0) {foreignPayment(s,gov,-fundSaving/s.exchangeRate);gov.fundUSD+=fundSaving/s.exchangeRate;flow.fundDeposit=fundSaving;}
  if(gov.cash<budgetBase*.15&&gov.fundUSD>0) {
    const withdraw=Math.min(gov.fundUSD,(budgetBase*.15-gov.cash)/s.exchangeRate);
    gov.fundUSD-=withdraw;foreignPayment(s,gov,withdraw);flow.fundWithdrawal=(s.economy?.revision>=23?(flow.fundWithdrawal??0):0)+withdraw*s.exchangeRate;
  }
  // Delinquency is a stock; annual entry probabilities are converted to monthly
  // survival probabilities. Charge-offs (LGD) and delinquency are different objects.
  const defaultAnnual=clamp(.02+k.defaultSensitivity*Math.max(0,realInterestRate(b.lendingRate,s.expectedInflation)-.06)
    +Math.max(0,(prev.metrics.unemployment-9)/100)*.15,0,.60);
  const defaultRate=clamp(-Math.expm1(Math.log1p(-defaultAnnual)/12)+Math.max(0,exchangeChange)*.015,0,.08);
  const distressLosses=creditLosses;
  for(const a of borrowers(s)) {
    creditLosses+=writeOff(s,a,defaultRate*.45);
    repayLoan(s,a,Math.min((a.loanLC+a.loanFX*s.exchangeRate)/72,Math.max(0,a.cash-(a.income??a.lastRevenue??a.receipts??0)*.8)*.04));
  }
  b.npl=clamp(b.npl+defaultRate*(1-b.npl)-.05*b.npl+distressLosses/Math.max(privateLoans(s),1)*1.5,.005,.8);
  if(bankCapital(s)<p.bankCapitalRequirement/100*.65&&p.bankRescue) {
    const needed=Math.max(0,p.bankCapitalRequirement/100*riskAssets(s)-b.equity);
    fundGovernment(s,needed,flow);
    const bailout=Math.min(needed,Math.max(0,gov.cash));
    gov.cash-=bailout;const oldEquity=Math.max(0,b.equity);b.equity+=bailout;flow.bankRescue=bailout;
    b.stateOwnership=bailout>0?(oldEquity*b.stateOwnership+bailout)/(oldEquity+bailout):b.stateOwnership;
    if(bailout>1) events.push('Государство пополнило капитал банков; расходы отражены в бюджете.');
  }
  if(foundationActive(s))resolveBanking(s,riskAssets(s),events);
  const bankOperatingProfit=b.equity-prev.bank.equity-bankFXRevaluation-flow.bankRescue-(flow.bankAccruedUnpaidInterest??0)-(foundationActive(s)?s.foundation.last.privateRecapitalization+s.foundation.last.bailIn:0);
  const bankDividend=Math.min(Math.max(0,bankOperatingProfit)*k.dividendPayout,
    Math.max(0,b.equity-Math.max(p.bankCapitalRequirement/100*riskAssets(s)*1.2,k.minimumLeverageRatio*bankAssets(s)*1.2)));
  if((s.economy?.revision??0)>=11&&foundationActive(s)){
    const f=s.foundation,privateDividend=bankDividend*(1-b.stateOwnership),funds=socialFunds(s);
    const claims=sum(f.bankClaims)+sum(f.businessBankClaims)+sum(funds.map(fund=>fund.bankClaim));
    if(claims>0){
      f.bankClaims.forEach((holding,i)=>{const value=privateDividend*holding/claims;s.households[i].cash+=value;householdIncome[i]+=value;householdMarket[i]+=value;householdSources[i].capital+=value;});
      f.businessBankClaims.forEach((holding,i)=>{const owner=enterpriseBusinesses(s)[i];owner.cash+=privateDividend*holding/claims;});
      funds.forEach(fund=>{fund.cash+=privateDividend*fund.bankClaim/claims;});
    }else GROUPS.forEach((g,i)=>{const value=privateDividend*g.dividendShare;s.households[i].cash+=value;householdIncome[i]+=value;householdMarket[i]+=value;householdSources[i].capital+=value;});
  }else GROUPS.forEach((g,i)=>{const value=bankDividend*(1-b.stateOwnership)*g.dividendShare;s.households[i].cash+=value;householdIncome[i]+=value;householdMarket[i]+=value;householdSources[i].capital+=value;});
  b.equity-=bankDividend;
  gov.cash+=bankDividend*b.stateOwnership;flow.stateDividends+=bankDividend*b.stateOwnership;
  s.households.forEach((h,i)=>{h.income=householdIncome[i];h.marketIncome=householdMarket[i];});
  settleLiquidity(s,flow);
  // Use measured goods flows for the national-accounts change. Subtracting two
  // large almost-equal inventories loses significant digits during high inflation.
  const goodsInventoryChange=s.economy?production.map((v,i)=>v-market.intermediate[i]-deliveredFinalDemand[i]):s.firms.map((f,i)=>f.inventory-initialInventories[i]);
  savePrivateProtection(s,grossByGroup);
  settlePrivateHealthInsurance(s,servicePlans,alpha,servicePrice);
  investPensionBankShares(s);
  const inventoryNominal=dot(goodsInventoryChange,s.firms.map(f=>f.price));
  const outputNominal=dot(production,s.firms.map(f=>f.price))+rentPremium+(militaryPlan?.paid??0);
  const domesticInputsNominal=sum(matrix.map((row,i)=>dot(row,production)*s.firms[i].price));
  const intermediateImportsReal=dot(production,s.firms.map(f=>f.importCoefficient));
  const intermediateImportsNominal=intermediateImportsReal*componentPrice;
  const sectorValueAdded=s.firms.map((f,j)=>production[j]*(f.price-sum(matrix.map((row,i)=>row[j]*s.firms[i].price))-f.importCoefficient*componentPrice*(1+p.tariff/100)));
  const companySectorValueAdded=companyEconomyActive(s)?[...sectorValueAdded]:null;
  if(socialActive(s))sectorValueAdded[4]+=rentPremium;
  if(militaryPlan)sectorValueAdded[4]+=militaryPlan.paid;
  const nominalGDP=outputNominal-domesticInputsNominal-intermediateImportsNominal-intermediateDuties+flow.vat+flow.tariff;
  const realGDP=sum(production)-sum(matrix.map(row=>dot(row,production)))-intermediateImportsReal
    +ordinaryCVolume*alpha*BASE_POLICY.vat/100+(militaryPlan?.paid??0)/Math.max(prev.consumerPriceIndex/100,1e-9);
  const expenditureNominal=consumptionNominal+investmentNominal+flow.purchases+(militaryPlan?.paid??0)+exportNominal-importNominal+inventoryNominal;
  const expenditureReal=cVolume*alpha+iVolume*alpha+gVolume*alpha+(militaryPlan?.paid??0)/Math.max(prev.consumerPriceIndex/100,1e-9)+sum(deliveredExports)-importReal+sum(goodsInventoryChange)+ordinaryCVolume*alpha*BASE_POLICY.vat/100;
  const publicCapitalization=flow.interestCapitalized;
  const cashInterest=flow.interest-publicCapitalization;
  const spending=diplomacyPaid+flow.purchases+(militaryPlan?.paid??0)+flow.transfers+flow.familyBenefits+flow.businessSupport+flow.concessionGuarantees+flow.bankRescue+flow.interest+flow.networkPurchases-flow.networkSales;
  const deficit=spending-diplomacyReceipts-flow.tax-flow.centralIncome-flow.stateDividends-(flow.integrityReceipts??0);
  gov.lastDeficit=deficit+(flow.territorial?.retained??0)-(flow.territorial?.own??0)+(flow.territorial?.grantReserve??0)+territorialGrants;
  const currentAccountUSD=(exportNominal-importNominal+diplomacyReceipts-diplomacyPaid)/s.exchangeRate+remittancesUSD+foreignInvestmentIncomeUSD-externalCoupons-foreignDividendsUSD-wholesaleCost-reinvestedFDIUSD;
  const arrearsRepaid=s.economy?.revision>=4?Math.min(b.foreignArrearsUSD??0,Math.max(0,b.foreignAssetsUSD)):0;
  if(arrearsRepaid>0){b.foreignAssetsUSD-=arrearsRepaid;b.foreignArrearsUSD-=arrearsRepaid;}
  flow.bankForeignArrearsRepaidUSD=arrearsRepaid;
  const bopUSD=currentAccountUSD+inflowUSD+reinvestedFDIUSD-flightUSD+flow.externalIssued-flow.externalRedeemed+(flow.bankForeignArrearsCreatedUSD??0)-arrearsRepaid;
  const civilianEmployment=sum(s.firms.map(f=>f.workers));
  const employment=civilianEmployment+(militaryPlan?.active??0)-(s.economy?.revision>=24?sum(familyCompanies(s).filter(c=>c.intendedUse==='own-use').map(c=>c.ownerWorkers??0)):0);
  const unemployment=clamp((1-employment/laborForce)*100,0,100);
  // Hiring adjusts to demand; current staffing is not full-employment capacity.
  const potentialCapacity=s.economy?s.firms.map(f=>sectorCapacity(s,f,f.workers*civilianLaborForce*(s.initialMacro?1-s.initialMacro.unemployment:.95)/Math.max(civilianEmployment,1e-9))):capacity;
  const potentialGDP=(s.initialMacro?s.economy.parameters.normalUtilization:1)*dot(potentialCapacity,potentialCapacity.map((_,i)=>1-colsum(i,matrix)-s.firms[i].importCoefficient))+cVolume*BASE_POLICY.vat/100;
  const outputGap=realGDP/Math.max(potentialGDP,1)-1;
  const prevCommodity=(prev.lastReport.world?.commodityPrice??prev.world.commodityPrice);
  const prevEnergy=(prev.lastReport.world?.energyPrice??prev.world.energyPrice);
  const channels=[];
  let priceLogAverage=0;
  s.firms.forEach((f,i)=>{
    const scarcityGap=clamp(requestedProduction[i]/Math.max(capacity[i]+initialInventories[i],1)-1,0,.5);
    const scarcity=s.economy?scarcityGap:scarcityGap-(prev.lastReport.channels?.[i]?.scarcityGap??0);
    // Normal unused capacity is not itself a disinflationary shock.
    const normalUtilization=s.economy?s.economy.parameters.normalUtilization*(s.initialMacro?1:Math.pow(.91/.95,1-s.economy.parameters.capitalShare)):1/1.08;
    // Demand pressure compares the order flow with current productive capacity.
    // Opening stocks can meet shortages (scarcityGap above), but a normal stock
    // buffer is not a recurring addition to monthly productive capacity.
    // Full-employment potential stays in output-gap statistics.
    const priceSupply=capacity[i];
    const priceDemandGap=requestedProduction[i]/Math.max(priceSupply,1e-9)-normalUtilization;
    const demand=k.demandPriceResponse*((s.economy?(supply?demandSignals[i]:production[i])/Math.max(potentialCapacity[i],1e-9):f.utilization)-normalUtilization);
    const expectedMonthly=Math.log1p(Math.max(-.5,s.expectedInflation))/12;
    // Cost pass-through uses the deviation from the already expected price trend.
    // Adding the full import/wage trend on top of expected inflation double-counts it.
    const imported=s.economy?0:k.importPassThrough*f.importCoefficient*(exchangeChange+Math.log1p(.02)/12+logRatio(w.energyPrice,prevEnergy)*.2-expectedMonthly);
    const wages=s.economy?0:.10*(wageChanges[i]-expectedMonthly);
    const inflationInertia=s.economy?s.economy.parameters.inflationInertia:k.pricePersistence;
    const expectations=(1-inflationInertia)*expectedMonthly;
    const inertia=inflationInertia*s.inflationLogMonthly;
    const commodity=i===1&&s.resourceMode?.65*(Math.log1p(.02)/12+logRatio(w.commodityPrice,prevCommodity)+exchangeChange-inertia-expectations):0;
    const tariff=!businessDynamicsActive(s)&&p.energyPricing==='regulated'?(i===1?.22:.05)*Math.log(Math.max(.05,p.energyTariff/100)/Math.max(.05,s.firms[1].price)):0;
    const markup=-k.competitionPriceResponse*(s.institutions.competition-prev.institutions.competition);
    const normalOutput=s.economy?(supply?Math.min(sectorCapacity(s,f)*s.economy.parameters.normalUtilization,capacity[i]):sectorCapacity(s,f)*s.economy.parameters.normalUtilization):1;
    const unitCost=s.economy?dot(matrix.map(row=>row[i]),consumerUnitPrices)+f.importCoefficient*componentPrice*(1+p.tariff/100)
      +f.workers*f.wage*(p.normalWorkweek/40)*(1-f.labor.strikeShare)/(1-s.economy.parameters.capitalShare)/Math.max(normalOutput,1e-9):0;
    const costAdjustment=s.economy?s.economy.parameters.priceAdjustment*Math.log(Math.max(1e-9,unitCost*f.costMarkup)/f.price):0;
    const foundationCost=foundationActive(s)?s.foundation.assumptions.priceCostSpeed*Math.log(Math.max(1e-9,unitCost*f.costMarkup)/f.price):costAdjustment;
    const appliedDemand=foundationActive(s)?s.foundation.assumptions.priceDemandSpeed*(s.economy.revision>=23?priceDemandGap:(demandSignals[i]/Math.max(potentialCapacity[i],1e-9))-normalUtilization):demand;
    const appliedCost=foundationActive(s)?foundationCost:costAdjustment;
    let priceChange=foundationActive(s)?clamp(expectations+foundationCost+appliedDemand+k.scarcityPriceResponse*scarcity+commodity+tariff+markup,-.04,.08):clamp(inertia+expectations+demand+imported+wages+k.scarcityPriceResponse*scarcity+commodity+tariff+markup+costAdjustment,-.08,.25);
    const priceBefore=f.price;f.price=updateProductPrices(s,i,f.price*Math.exp(priceChange),w);if(sectorCompanies(s,i).length){if(i===2)finishEnterpriseMarket(s,f.price);else finishFirmMarket(s,i,f.price);priceChange=Math.log(f.price/priceBefore);}
    if(s.economy?.revision>=23)priceChange=Math.log(f.price/priceBefore);
    priceLogAverage+=s.base.consumptionWeights[i]*priceChange;
    const reportedInertia=foundationActive(s)?0:inertia;
    const rawChange=reportedInertia+expectations+appliedDemand+imported+wages+k.scarcityPriceResponse*scarcity+commodity+tariff+markup+appliedCost;
    channels.push(s.economy?.revision>=23?{sector:f.name,inertia:reportedInertia,expectations,demand:appliedDemand,imports:imported,wages,scarcityGap,scarcity:k.scarcityPriceResponse*scarcity,commodity,tariff,markup,costAdjustment:appliedCost,priceOrders:requestedProduction[i],priceSupply,priceDemandGap,priceBefore,priceAfter:f.price,adjustmentLimit:clamp(rawChange,-.04,.08)-rawChange,productAndFirmAdjustment:priceChange-clamp(rawChange,-.04,.08),total:priceChange}:{sector:f.name,inertia,expectations,demand,imports:imported,wages,scarcityGap,scarcity:k.scarcityPriceResponse*scarcity,commodity,tariff,markup,...(s.economy?{costAdjustment}:{}),total:priceChange});
  });
  const newImportPrice=s.economy?importUnitPrice(s,w):s.exchangeRate*s.worldPriceIndex/100*(.8+.2*w.energyPrice/100);
  const newGoodsImports=(s.economy?.revision??0)>=15?importGoodsPrices(s,w):Array(5).fill(newImportPrice);
  const cpiImportShare=s.economy?s.base.consumptionImport:importShareC;
  const cpi=((1-cpiImportShare)*dot(s.base.consumptionWeights,socialActive(s)?s.firms.map((f,i)=>i===4?f.price*(1-s.householdEconomy.assumptions.housingServiceShare+s.householdEconomy.assumptions.housingServiceShare*s.social.housing.rentIndex*nationalRentFactor(s)):f.price):s.firms.map(f=>f.price))+cpiImportShare*((s.economy?.revision??0)>=15?basketPrice(s.base.consumptionWeights,newGoodsImports):newImportPrice)*(1+p.tariff/100))
    *(1+p.vat/100)/(1+BASE_POLICY.vat/100)*100;
  const inflationMonthly=cpi/prev.consumerPriceIndex-1;
  s.consumerPriceIndex=cpi;
  // One-off VAT/duty changes must not become an automatic recurring price shock.
  s.inflationLogMonthly=priceLogAverage;
  const anchorInflation=euroAdopted(s)?.02:hasDiscretionaryCB(s)?p.inflationTarget/100:fixedExchange(s)?.02:prev.expectedInflation;
  const confidenceTarget=clamp(.82-.7*Math.abs(monthlyToAnnual(clamp(inflationMonthly,-.2,.3))-anchorInflation)
    -.3*Math.max(0,debtRatio-.6)-.4*b.npl-(unemployment-9)/100*.5-(gov.defaultActive||s.month<gov.excludedUntil?.15:0)-s.institutions.ownershipRisk*.25,.12,.95);
  s.institutions.confidence+=.035*(confidenceTarget-s.institutions.confidence);
  const targetWeight=foundationActive(s)?s.foundation.assumptions.expectationAnchor:(p.monetaryRegime==='freeBanking'?0:s.institutions.confidence*k.expectationsAnchor);
  const observed=clamp(monthlyToAnnual(clamp(Math.expm1(priceLogAverage),-.2,.3)),-.15,.60);
  const foundationAnchor=euroAdopted(s)?.02:foundationActive(s)?(hasDiscretionaryCB(s)?p.inflationTarget/100:.02):anchorInflation;
  const expectationTarget=targetWeight*foundationAnchor+(1-targetWeight)*observed;
  s.expectedInflation=clamp(s.expectedInflation+(foundationActive(s)?1/s.foundation.assumptions.expectationMonths:k.expectationAdjustment)*(expectationTarget-s.expectedInflation),-.15,1.2);
  const twelveAgo=s.history.find(x=>x.month===s.month-12);
  const rollingNominal=sum(s.history.filter(x=>x.month>=s.month-11).map(x=>x.nominalGDPMonthly))+nominalGDP;
  const debt=domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate;
  const realIncome=(s.economy?.revision>=4?sum(s.households.map(h=>h.income-h.interestPaid)):sum(householdIncome))/(cpi/100)/(s.population/s.base.initialPopulation)/s.base.referenceIncome*100;
  s.households.forEach((h,i)=>{h.realIncomeIndex=h.income/(cpi/100)/(s.population/s.base.initialPopulation)/Math.max(s.base.initialGroupIncomes[i],1)*100;});
  const priceHistory=twelveAgo?.sectorPrices??Array(5).fill(Math.pow(1.08,(s.month-12)/12));
  const coreWeights=normalize([0,0,.23,.07,.34]);
  const coreIndex=dot(coreWeights,s.firms.map(f=>f.price));
  const coreOld=dot(coreWeights,priceHistory);
  const gdpSafe=Math.max(rollingNominal,100);
  const audits={
    population:s.demography.populationResidual,
    centralBank:gov.reservesUSD*s.exchangeRate+b.centralBorrowing-b.reserves-s.centralBank.equity,
    bankBalance:bankResidual(s),nominalGDP:nominalGDP-expenditureNominal,realGDP:realGDP-expenditureReal,
    goods:Math.max(...market.ending.map((v,i)=>Math.abs(initialInventories[i]+production[i]-market.intermediate[i]-deliveredFinalDemand[i]-v))),
    governmentCash:gov.cash-prev.government.cash-(diplomacyReceipts-diplomacyPaid+flow.tax+flow.centralIncome+flow.stateDividends+(flow.integrityReceipts??0)-flow.purchases-(militaryPlan?.paid??0)-flow.transfers-flow.familyBenefits-flow.businessSupport-flow.concessionGuarantees-flow.bankRescue-cashInterest-flow.equityPurchases+flow.equitySales-flow.networkPurchases+flow.networkSales
      +flow.domesticIssued+flow.externalIssued*s.exchangeRate-flow.domesticRedeemed-flow.externalRedeemed*s.exchangeRate+flow.reserveSale+flow.fundWithdrawal-flow.fundDeposit+(flow.territorial?.own??0)-(flow.territorial?.retained??0)-(flow.territorial?.grantReserve??0)-territorialGrants+(flow.localCashAssumed??0)),
    externalNFA:netForeignAssetsUSD(s)-netForeignAssetsUSD(prev)-currentAccountUSD-flow.externalHaircut-flow.externalEquityRevaluation,
    governmentDebt:debt-initialDebt-(flow.domesticIssued+flow.externalIssued*s.exchangeRate-flow.domesticRedeemed-flow.externalRedeemed*s.exchangeRate
      +externalDebtUSD(prev)*(s.exchangeRate-prev.exchangeRate)+flow.interestCapitalized-flow.domesticHaircut-flow.externalHaircut*s.exchangeRate+(flow.localDebtAssumed??0))
  };
  if(flow.territorial)audits.territorialCash=territorialCash(s)-territorialCash(prev)-flow.territorial.retained+flow.territorial.own-flow.territorial.grantReserve-territorialGrants
    -(flow.localDividends??0)-(flow.localAssetSales??0)+(flow.localCashAssumed??0)-(flow.localBonds?.issued??0)
    +(flow.localBonds?.interest??0)+(flow.localBonds?.redeemed??0);
  if(flow.localBonds)audits.territorialDebt=flow.localBonds.residual;
  if(socialActive(s))audits.pensionFund=sum(s.social.privateAccounts)-s.social.pensionFund.cash-s.social.pensionFund.bankClaim;
  if(s.social?.investmentFund)audits.investmentFund=sum(s.social.investmentAccounts)-s.social.investmentFund.cash-s.social.investmentFund.bankClaim;
  if(foundationActive(s)){reconcileBankBooks(s);audits.bankBooks=sum(s.foundation.banks.map(b=>b.equity))-s.bank.equity;audits.interbankNet=sum(s.foundation.banks.map(b=>b.interbank));}
  const auditError=Math.max(...Object.values(audits).map(Math.abs));
  const realGDPRolling=sum(s.history.filter(x=>x.month>=s.month-11).map(x=>x.realGDPMonthly))+realGDP;
  const gdpUSDRolling=sum(s.history.filter(x=>x.month>=s.month-11).map(x=>x.nominalGDPMonthly/x.exchangeRate))+nominalGDP/s.exchangeRate;
  s.metrics={...demographicMetrics(s),...institutionMetrics(s),realGDPAnnualized:realGDP*12,realGDPRolling,nominalGDPAnnualized:nominalGDP*12,gdpUSDAnnualized:nominalGDP/s.exchangeRate*12,gdpUSDRolling,realPolicyRate:realPolicy*100,month:s.month,realGDPMonthly:realGDP,nominalGDPMonthly:nominalGDP,nominalGDPAnnual:rollingNominal,
    gdpPerCapitaReal:realGDP*12/s.population,gdpPerCapitaUSD:nominalGDP*12/s.exchangeRate/s.population,
    gdpGrowthYoY:twelveAgo&&twelveAgo.realGDPMonthly>0?(realGDP/twelveAgo.realGDPMonthly-1)*100:0,...(s.economy?.revision>=21?{gdpGrowthYoYDefined:twelveAgo?.realGDPMonthly>0?1:0}:{}),
    inflationYoY:twelveAgo?(cpi/twelveAgo.consumerPriceIndex-1)*100:0,inflationMonthly:inflationMonthly*100,
    coreInflation:(coreIndex/coreOld-1)*100,foodInflation:(s.firms[0].price/priceHistory[0]-1)*100,energyInflation:(s.firms[1].price/priceHistory[1]-1)*100,
    unemployment,realIncomeIndex:realIncome,exchangeRate:s.exchangeRate,outputGap:outputGap*100,
    debtRatio:debt/gdpSafe*100,deficitRatio:deficit*12/gdpSafe*100,
    reservesUSD:gov.reservesUSD,fundUSD:gov.fundUSD,tradeBalance:exportNominal-importNominal,currentAccountUSD,
    lendingRate:b.lendingRate*100,depositRate:b.depositRate*100,capitalRatio:bankCapital(s)*100,npl:b.npl*100,
    credit:privateLoans(s),deposits:deposits(s),consumption:cVolume*alpha,investment:iVolume*alpha,
    governmentPurchases:gVolume*alpha+(militaryPlan?.paid??0)/Math.max(prev.consumerPriceIndex/100,1e-9),exports:sum(deliveredExports),imports:importReal,inventoryChange:sum(goodsInventoryChange),
    productivity:dot(normalize(s.base.output),s.firms.map(f=>f.productivity))*100,laborForce,employment,
    fulfillment:alpha*100,confidence:s.institutions.confidence*100,informality:s.institutions.informality*100,
    taxRevenue:flow.tax,governmentSpending:spending,interestExpense:flow.interest,privateDebtRatio:(privateLoans(s)+corporateDebt(s))/gdpSafe*100,
    infrastructure:s.infrastructure/s.initialInfrastructure*100,skills:s.skills*100,bankLiquidity:b.reserves/Math.max(deposits(s),1)*100,
    foreignDebtRatio:externalDebtUSD(s)*s.exchangeRate/gdpSafe*100,realExchangeRate:realExchangeRate*100,migration,
    publicInvestment:publicInvestmentVolume,moneyCreated:creditCreated,creditLosses,reserveMonths:gov.reservesUSD/Math.max(importNominal/s.exchangeRate,1),
    sovereignSpread:flow.sovereignSpread*100,investmentCompleted:completed,auditError,consumerPriceIndex:cpi,
    policyRate:effectiveRate,expectedInflation:s.expectedInflation*100,investmentPrice:iUnit,
    liquidityCoverage:bankLiquidityCoverage(s)*100,leverageRatio:bankLeverage(s)*100,
    debtInDefault:debtInDefault(s),debtArrears:gov.arrears,defaultEpisodes:gov.defaults,defaultActive:gov.defaultActive?1:0,
    refinancingRisk:fundingRisk.annualProbability*100,debtServiceRevenue:fundingRisk.serviceRevenueRatio*100};
  const netPrimaryIncome=(foreignInvestmentIncomeUSD-externalCoupons-foreignDividendsUSD-wholesaleCost-reinvestedFDIUSD)*s.exchangeRate;
  s.metrics.primaryIncomeReal=netPrimaryIncome/(cpi/100);
  s.incomeHistory.push({month:s.month,population:s.population,cpi,...(s.economy?.revision>=21?{groupPopulation:s.households.map(h=>h.population)}:{}),net:s.households.map(h=>Math.max(0,h.income-h.interestPaid)),market:s.households.map(h=>Math.max(0,h.marketIncome-h.interestPaid)),synthetic:false});
  s.incomeHistory=s.incomeHistory.slice(-12);
  finishOwners(s,householdSources);
  s.metrics={...s.metrics,...socialIndicators(s,{wages:totalWages,netPrimaryIncome,...(s.economy?{sectorValueAdded}:{})})};
  if(s.economy)s.metrics={...s.metrics,...openEconomyMetrics(s)};
  if(territorialFiscal)s.policy=nationalPolicy;
  recordERMMonth(s);
  advanceGovernmentGoals(s,events,deliveredExports);
  advancePolitics(s,prev,events,flow,w);
  synchronizeCharacters(s,events);
  advanceDefense(s,prev,flow,events,w,militaryPlan);
  s.metrics={...s.metrics,...politicsMetrics(s),...laborMetrics(s),...servicesMetrics(s),...infrastructureMetrics(s),...monetaryMetrics(s),...defenseMetrics(s),energyPriceIndex:s.firms[1].price*100};
  if(fixedExchange(s)&&s.metrics.monetaryReserveCoverage<100)events.push('Фиксированный денежный режим: валютных активов недостаточно для полного покрытия расчётных резервов банков. Ликвидность не восполняется кредитом ЦБ.');
  if(alpha<.95) events.push(`Производственные ограничения: исполнено ${(alpha*100).toFixed(1)}% конечных заказов.`);
  if(b.creditSupply<.5) events.push('Банки ограничивают кредитование из-за капитала, ликвидности или риска.');
  if(gov.reservesUSD<1) events.push('Валютные резервы исчерпаны.');
  if(s.economy&&alpha<.995&&externalConstraint&&dot(requestedProduction,externalConstraint.intermediateUnitUSD)+externalConstraint.finalImportsUSD-externalConstraint.exportsUSD>externalConstraint.availableUSD)events.push('Доступная валюта и внешнее кредитование ограничили импорт и выполнение заказов.');
  if(bankCapital(s)<0) events.push('Банковская система имеет отрицательный капитал.');
  validateDefense(s);
  validateDefenseEconomy(s);
  const auditTolerance=Math.max(1e-4,Math.max(Math.abs(bankAssets(s)),Math.abs(nominalGDP),Math.abs(debt))*1e-10);
  if(!Number.isFinite(auditError)||Object.values(s.metrics).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw new Error('Расчёт содержит недопустимое число; месяц не сохранён: '+Object.entries(s.metrics).filter(([k,v])=>typeof v==='number'&&!Number.isFinite(v)).map(([k])=>k).join(', '));
  if(auditError>auditTolerance) throw new Error(`Нарушен учёт: ${JSON.stringify(audits)}`);
  const worldNews=worldEvent(s);if(worldNews?.start===s.month)events.push(worldNews.title+': '+worldNews.text);
  // Diagnostics are machine-readable, never extra UI text. Binding constraints
  // are measured at the actual allocation, not invented causal attribution.
  const diagnostics=s.economy?.revision>=2?{
    revision:s.economy.revision,month:s.month,previousMonth:prev.month,
    outputChange:realGDP-prev.metrics.realGDPMonthly,
    inflationChange:s.metrics.inflationYoY-prev.metrics.inflationYoY,
    unemploymentChange:unemployment-prev.metrics.unemployment,
    ...(supply?{supplyChains:copy(supply),physicalCapacity,demandSignals}:{}),
    capacityBound:production.map((v,i)=>capacity[i]>0&&v>=capacity[i]*(1-1e-7)),
    inventoryBound:market.ending.map((v,i)=>v<=Math.max(1,s.base.output[i])*1e-7),
    ...(s.economy?.revision>=4?{foreignFundingGapUSD:externalConstraint?Math.max(0,dot(requestedProduction,externalConstraint.intermediateUnitUSD)+externalConstraint.finalImportsUSD-externalConstraint.exportsUSD-externalConstraint.availableUSD):0,inventoryChoice:market.inventoryChoice??'planned-production'}:{}),
    foreignLiquidityBound:externalConstraint?Math.abs(dot(production,externalConstraint.intermediateUnitUSD)+alpha*externalConstraint.finalImportsUSD-deliveredExportValue/s.exchangeRate-externalConstraint.availableUSD)<=Math.max(1,externalConstraint.availableUSD)*1e-7:false,
    domesticOrderFulfillment:alpha,exportOrderFulfillment:exportAlpha,
    procurementRequested:requestedPurchases,procurementPaid:flow.purchases,
    investmentRequested:iVolume,investmentDelivered:iVolume*alpha
  }:null;
  s.lastReport={events,channels,...(regimeActive(s)?{politicalInstitutions:{...copy(s.politics.regimeDynamics.last),notices:copy(s.politics.regimeDynamics.notices.filter(n=>n.month===s.month))}}:{}),...(diagnostics?{diagnostics}:{}),...(worldNews?{worldNews}:{}),demography:{births:s.demography.births,deaths:s.demography.deaths,migration:s.demography.netMigration,balance:s.demography.populationResidual},world:w,fiscal:flow,audit:audits,
    ...(s.economy?{openEconomy:copy(s.economy.last)}:{}),
    ...(agriculture?{agriculture:{...agriculture,foodImports:foodImportVolume*alpha}}:{}),
    market:{production,capacity,finalDemand,inventoryChange:goodsInventoryChange,exports:deliveredExports,
      requestedInvestment:iVolume,requestedConsumption:cVolume,fulfillment:alpha,...(s.economy?.revision>=2?{exportFulfillment:exportAlpha,...(market.sectorExportFulfillment?{sectorExportFulfillment:market.sectorExportFulfillment}:{}),deliveredFinalDemand,externalConstraint}: {})},
    external:{exportsUSD:exportNominal/s.exchangeRate,importsUSD:importNominal/s.exchangeRate,...(partners?{partners}:{}),remittancesUSD,foreignInvestmentIncomeUSD,inflowUSD,flightUSD,foreignDividendsUSD,...(s.economy?{reinvestedFDIUSD,greenfieldUSD:s.economy.last.greenfieldUSD,portfolioEquityUSD:s.economy.last.portfolioEquityUSD}:{}),currentAccountUSD,bopUSD},
    income:{wages:totalWages,...(s.economy?.revision>=24?{employeeWages:totalWages-sum(familyCompanies(s).map(c=>c.last?.payroll??0)),employeeNetWages:sum(householdSources.map(h=>h.labor))}:{}),privateInterest,householdIncome},
    gdp:{sectorValueAdded,...(companySectorValueAdded?{companySectorValueAdded}:{}),production:nominalGDP,expenditure:expenditureNominal,consumption:consumptionNominal,investment:investmentNominal,
      government:flow.purchases+(militaryPlan?.paid??0),exports:exportNominal,imports:importNominal,inventories:inventoryNominal},
    changes:{inflation:s.metrics.inflationYoY-prev.metrics.inflationYoY,growth:s.metrics.gdpGrowthYoY-prev.metrics.gdpGrowthYoY,
      exchange:(s.exchangeRate/prev.exchangeRate-1)*100,unemployment:unemployment-prev.metrics.unemployment,
      gdp:(realGDP/Math.max(prev.metrics.realGDPMonthly,1)-1)*100}};
  if(s.politics.scenarioDiplomacy?.tradeCourse){
    const eu=scenarioOrganizations(s).find(org=>org.id==='eu');
    recordTradeCourseMonth(s,diplomacyShare(s,eu),deliveredExports,events);
  }
  if(socialActive(s))finishSocial(s,flow,housingPlan*alpha,territorialPurchases?flow.socialHousing/gUnit:gVolume*alpha*p.socialHousingBudget/Math.max(goodsPurchaseShare,.001),iUnit,gUnit);
  const enactedPolicy=s.policy;
  if(territorialFiscal)s.policy=p;
  if(consumptionActive(s))settleConsumption(s,prev,{baskets:groupBaskets,importShare:importShareC,importPrice:(s.economy?.revision??0)>=15?goodsImports:importPrice,prices:consumerUnitPrices,plans:householdPlans,services:servicePlans,paid:householdPayments,alpha,sources:householdSources,foodReplacement,foodFractions,...(socialActive(s)?{buyerPrices,housingPaid}: {})});
  if(territorialFiscal)s.policy=enactedPolicy;
  finishSettlements(s,{alpha,ownFood:ownFoodPaid,records:s.householdEconomy?.records??[]});
  finishLivelihoods(s,{military:militaryPlan?.active??0,ownFood:ownFoodPaid,sources:householdSources,wages:totalWages});validateLivelihoods(s);
  if(s.economy?.revision>=20){s.lastReport.settlements=copy(s.settlements.last);s.lastReport.owners=copy(s.wealthOwners.last);}
  finishTalent(s);finishInternationalCapital(s);finishDurables(s);if(s.economy?.revision>=22)s.lastReport.integrity=copy(s.rentSeeking.last);
  if((s.economy?.revision??0)>=15)s.lastReport.goodsPrices=s.firms.map((f,i)=>({domestic:f.price*(1+p.vat/100)/(1+BASE_POLICY.vat/100),imported:newGoodsImports[i]*(1+p.tariff/100)*(1+p.vat/100)/(1+BASE_POLICY.vat/100)}));
  if(industryCompanies(s).length){validateEnterpriseMarket(s);s.lastReport.enterprises=industryCompanies(s).map(c=>({id:c.id,name:c.name,active:c.active,cash:c.cash,loanLC:c.loanLC,loanFX:c.loanFX,capital:c.capital,workers:c.workers,production:c.production,inventory:c.inventory,offerPrice:c.price,ownership:copy(c.ownership),last:copy(c.last),...(businessDynamicsActive(s)?{foundedMonth:c.foundedMonth,entrySource:c.entrySource??'initial',investmentDecision:copy(c.investmentDecision??null),bonds:copy(c.bonds??[])}:{})}));}
  settleProductMarkets(s,{production,capacity,revenue,inputs:inputCost,sectorValueAdded,w});settleServiceIndustries(s,{revenue:revenue[4],inputCost:inputCost[4],payroll:s.firms[4].workers*s.firms[4].wage*(p.normalWorkweek/40)*(1-s.firms[4].labor.strikeShare),depreciation:(s.firms[4].capital*(-annualToMonthly(-k.annualDepreciation))+(s.firms[4].infrastructureDepreciation??0))*iUnit,interest:s.firms[4].interestPaid,operatingProfit:s.firms[4].lastProfit,sectorValueAdded:sectorValueAdded[4],componentPrice,prices:consumerUnitPrices});validateServiceIndustries(s);finishBusinessDynamics(s);if(businessDynamicsActive(s)){s.lastReport.corporateBonds=corporateBondService;s.metrics.corporateBondDebt=corporateDebt(s);}validateProductMarkets(s);validateBusinessDynamics(s);validateCorporateBonds(s);validateFirmMarkets(s);
  if(settlementActive(s))s.lastReport.paymentOutlook=treasuryPaymentOutlook(s);
  s.history.push({...s.metrics,sectorPrices:s.firms.map(f=>f.price),synthetic:false});
  if(!recordDiagnostics)return s;
  trace.after=accountSnapshot(s);
  trace.labor.forEach((row,i)=>{row.laborAvailabilityScale=laborScale;row.workersAfter=s.firms[i].workers;row.wageLogChange=wageChanges[i];});
  trace.households.forEach((row,i)=>{row.ordinaryPlannedVolume=householdPlans[i];row.privateServicePlannedVolume=servicePlans[i].total;row.deliveredVolume=s.households[i].consumption;});
  trace.investment.forEach((row,i)=>{row.deliveredVolume=investmentPlans[i]*alpha;row.deliveryFactor=alpha;});
  trace.report=copy(s.lastReport);
  trace.warnings=diagnosticWarnings(trace.before,trace.after,s.lastReport,s.history);
  s.lastReport.calculationTrace=trace;
  appendJournal(s,prev,actionResults,w);
  return s;
}

export function runMonths(s,count,policy=s.policy) {
  if(!Number.isInteger(count)||count<0||count>600) throw new Error('Горизонт: от 0 до 600 месяцев');
  let result=s;for(let i=0;i<count;i++){if(result.defense?.sovereigntyLost||result.politics.enabled&&!result.politics.executive.inOffice)break;result=advanceMonth(result,i===0||!result.politics.enabled?policy:result.policy);}return result===s?copy(s):result;
}

export function comparePolicies(s,policyA,policyB,months=24) {
  const control=copy(s);control.pendingActions=[];if(control.politics.enabled)control.politics.pendingCommands=[];
  if(s.politics.enabled){
    if(!Number.isInteger(months)||months<0||months>600)throw new Error('Горизонт: от 0 до 600 месяцев');
    const forecast=(origin,policy)=>{let r=copy(origin);for(let i=0;i<months&&r.politics.executive.inOffice;i++){
      for(const b of r.politics.bills.filter(b=>b.month>s.month&&b.sponsor===r.politics.executive.playerParty&&['draft','articles'].includes(b.status))){schedulePolitical(r,{kind:'voteBill',billId:b.id});if(r.politics.executive.role==='president')schedulePolitical(r,{kind:'sign',billId:b.id});}
      r=advanceMonth(r,i===0?policy:r.policy);
    }return r;};
    return {a:forecast(control,policyA),b:forecast(s,policyB),originMonth:s.month,months,politicalProtocol:'attemptOwnLaws'};
  }
  return {a:runMonths(control,months,policyA),b:runMonths(s,months,policyB),originMonth:s.month,months};
}

export function simulationEnvelope(s) {return {format:'economy-model',version:VERSION,state:s,calculationDiagnostics:diagnosticEnvelope(s)};}
export function exportSimulation(s) {return JSON.stringify(simulationEnvelope(s),null,2);}
export function scheduleRestructuring(s,{haircut=.30,extension=60}={}) {
  if(!Number.isFinite(haircut)||haircut<0||haircut>.7||!Number.isInteger(extension)||extension<12||extension>120)throw new Error('Некорректная реструктуризация');
  if(s.pendingActions.some(a=>a.kind==='restructure'))throw new Error('Обмен долга уже запланирован на следующий месяц. Сначала отмените его.');
  s.pendingActions.push({id:s.nextActionId++,kind:'restructure',haircut,extension,decisionMonth:s.month,effectiveMonth:s.month+1});
}
export function replayJournal(s) {
  const p=s.provenance;
  const politicalOptions=p.politicalOptions?{...p.politicalOptions,instantRules:p.politicalOptions.instantRules??false}:p.politicalOptions;
  let result=createSimulation({territorialGovernment:p.territorialGovernment===true,londonMayorRevision:p.londonMayorRevision,characterPlayer:p.characterPlayer,deferCharacters:Boolean(p.characterMigration)||!s.characters,...(p.initialFinancialStocks?{initialFinancialStocks:copy(p.initialFinancialStocks)}:{}),...(p.initialServiceShares?{initialServiceShares:copy(p.initialServiceShares)}:{}),...(p.initialPopulation!==undefined?{initialPopulation:p.initialPopulation}:{}),...(p.scenario?{scenario:copy(p.scenario)}:{}),startYear:s.startYear??2026,...(p.initialSocialTransferEnvelope!==undefined?{socialTransferEnvelope:p.initialSocialTransferEnvelope}:{}),...(p.foundationRevision===1?{foundationAssumptions:p.foundationAssumptions}:{}),...(p.localGovernmentRevision===1?{localGovernmentRevision:1,localGovernmentAssumptions:p.localGovernmentAssumptions}:{}),...(p.initialMacro?{initialMacro:copy(p.initialMacro)}:{}),...(p.initialAccounts?{initialAccounts:copy(p.initialAccounts)}:{}),...(p.initialGDPPerCapita!==undefined?{initialGDPPerCapita:p.initialGDPPerCapita}:{}),...(p.economicStructure?{economicStructure:copy(p.economicStructure),economicParameters:copy(p.initialEconomicParameters),economicRevision:p.initialEconomicRevision??1}:{}),resourceMode:p.resourceMode,seed:p.seed,modelProfile:p.modelProfile,policy:p.initialPolicy,parameters:p.initialParameters,world:p.initialWorld,stochastic:p.initialStochastic,defenseMode:p.defenseMode===true,defenseParameters:p.defenseParameters,politicalMode:p.politicalMode,politicalOptions});
  const startCharacters=(afterCommand=null)=>{
    const migration=p.characterMigration;
    if(migration?.month===result.month&&migration.afterCommand===afterCommand)initializeCharacters(result,p.characterPlayer);
  };
  const replayCommand=command=>{
    result.politics.nextCommandId=command.id;
    executePolitical(result,command);
    startCharacters(command.id);
  };
  for(const entry of s.journal){
    startCharacters();
    result.parameters=copy(entry.parameters);result.world=copy(entry.world);result.shocks=copy(entry.shocks);result.stochastic=entry.stochastic;result.pendingNote=entry.note;
    if(result.economy){
      if(entry.economicParameters)result.economy.parameters=copy(entry.economicParameters);
      result.economy.revision=entry.economicRevision??p.initialEconomicRevision??1;
      if(result.month===0&&result.economy.revision>=2&&(p.initialEconomicRevision??1)<2){
        const va=result.firms.map((f,j)=>f.production*(1-colsum(j,inputMatrix(result))-f.importCoefficient)),total=sum(va);
        result.firms.forEach((f,j)=>{f.lastInvestment=result.base.investment*va[j]/total;});
      }
    }
    if(result.politics.enabled){
      if(entry.regimeRevision===1&&!regimeActive(result))initializeRegimeDynamics(result,{rules:entry.regimeActivation?.rules});
      for(const command of entry.turnPoliticalCommands??[])replayCommand(command);
      result.pendingActions=copy(entry.submittedActions??[]);result.nextActionId=entry.nextActionId??result.nextActionId;result.politics.pendingCommands=copy(entry.politicalCommands??[]);result.politics.nextCommandId=entry.nextCommandId??result.politics.nextCommandId;
    }
    else for(const a of (entry.economicRevision>=16?entry.submittedActions??entry.actions:entry.actions))if(a.id){if(a.kind==='restructure')scheduleRestructuring(result,a);else if(a.network)scheduleNetwork(result,a);else scheduleOwnership(result,a);}
    if(entry.reputationRevision===1&&!reputationActive(result))initializePolicyReputation(result);
    if(entry.performanceRevision===1&&!performanceActive(result))initializePerformanceVoting(result);
    result=advanceMonth(result,entry.requestedPolicy??entry.policy,{preserveEconomicRevision:true});
  }
  startCharacters();
  if(result.politics.enabled)for(const command of s.politics.turnCommands??[])replayCommand(command);
  return result;
}
export function importSimulation(text) {return importSimulationData(JSON.parse(text));}
// Consumes a freshly parsed envelope and runs the same complete validation.
export function importSimulationData(data) {
  if(data.format!=='economy-model') throw new Error('Несовместимый формат сохранения');
  if(data.version!==VERSION||data.state?.version!==VERSION) throw new Error('Несовместимая версия: прошлые эксперименты нельзя продолжить по новым уравнениям 5.0. Старый файл сохраняется для анализа.');
  const s=data.state;
  if(s.bank?.foreignArrearsUSD!==undefined&&(!Number.isFinite(s.bank.foreignArrearsUSD)||s.bank.foreignArrearsUSD<0))throw new Error('Повреждена внешняя просрочка банка');
  if(!Number.isInteger(s.month)||s.month<0||s.month>12000||!Array.isArray(s.firms)||s.firms.length!==5||!Array.isArray(s.households)||s.households.length!==10||!Array.isArray(s.history)||s.history.length<13||!Array.isArray(s.journal)||s.journal.length!==s.month||!s.provenance||!Array.isArray(s.pendingActions)) throw new Error('Повреждённое состояние или журнал');
  const check=v=>{
    if(typeof v==='number'&&!Number.isFinite(v)) throw new Error('Сохранение содержит недопустимое число');
    if(v&&typeof v==='object') Object.values(v).forEach(check);
  };check(s);
  validateParameters(s.parameters);
  validateScenario(s);
  if(!s.institutions||['antitrustCapacity','courtCapacity','soeAuditCapacity','contractReliability','bankContestability','competition'].some(key=>!Number.isFinite(s.institutions[key])||s.institutions[key]<0||s.institutions[key]>1)||!Number.isFinite(s.base?.initialPublicCapital)||s.base.initialPublicCapital<=0)throw new Error('Повреждены институциональные запасы');
  if(s.history.length!==s.month+13||s.journal.some((entry,i)=>entry.month!==i+1||entry.decisionMonth!==i||entry.version!==VERSION||!entry.policy||!entry.parameters||!entry.outcome)||s.provenance.coverageStartMonth!==0||s.provenance.version!==VERSION)throw new Error('Нарушена последовательность истории решений');
  if(!s.centralBank||['equity','deferredLoss','lastProfit','lastRemittance'].some(key=>!Number.isFinite(s.centralBank[key]))||s.centralBank.deferredLoss<0)throw new Error('Повреждён баланс центрального банка');
  if(!s.demography||['female','male'].some(sex=>!Array.isArray(s.demography[sex])||s.demography[sex].length!==1201||s.demography[sex].some(x=>typeof x!=='number'||x<0))||!Array.isArray(s.demography.pregnancies)||s.demography.pregnancies.length!==s.parameters.pregnancyDelay) throw new Error('Повреждена демография');
  if(Math.abs(sum(cohortTotals(s.demography))-s.population)>1e-7) throw new Error('Нарушен баланс населения');
  for(const f of s.firms)if(!f.ownership||['state','foreign','domestic','municipal','cooperative'].some(key=>!Number.isFinite(f.ownership[key])||f.ownership[key]<0||f.ownership[key]>1)||Math.abs(sum(Object.values(f.ownership))-1)>1e-8||!Array.isArray(f.domesticOwners)||f.domesticOwners.length!==10||f.domesticOwners.some(x=>!Number.isFinite(x)||x<0)||Math.abs(sum(f.domesticOwners)-f.ownership.domestic)>1e-8||!Array.isArray(f.workerOwners)||f.workerOwners.length!==10||f.workerOwners.some(x=>!Number.isFinite(x)||x<0)||Math.abs(sum(f.workerOwners)-f.ownership.cooperative)>1e-8)throw new Error('Нарушен баланс собственности');
  // This newly separated budget line was not tracked in older saves. Zero
  // preserves their economic path; do not backfill invented historical spending.
  if(s.policy.militaryBudget===undefined)s.policy.militaryBudget=0;
  for(const [key,value] of [['defensePosture','routine'],['defensePriority','balanced'],['defenseService','contract'],['defensePersonnelTarget',4],['defenseSalary',120],['defenseProcurement','mixed']]){s.policy[key]??=value;if(s.politics?.lawPolicy)s.politics.lawPolicy[key]??=value;}
  if(s.politics?.lawPolicy&&s.politics.lawPolicy.militaryBudget===undefined)s.politics.lawPolicy.militaryBudget=0;
  for(const [key,value] of [['municipalServicesShare',0],['localAdministrationBudget',.05],['localElections',Boolean(s.policy.competitiveElections)]]){s.policy[key]??=value;if(s.politics?.lawPolicy)s.politics.lawPolicy[key]??=value;}
  s.policy.privateHealthInsurance??=true;if(s.politics?.lawPolicy)s.politics.lawPolicy.privateHealthInsurance??=true;
  for(const key of ['researchBudget','taxAdministrationBudget','regionalBudgetTransfers','cityBudgetTransfers']){s.policy[key]??=0;if(s.politics?.lawPolicy)s.politics.lawPolicy[key]??=0;}
  for(const [key,value] of [['privateBusinessEntry',true],['foreignBusinessEntry',true],['corporateBondMarket',true],['fuelPricing','market'],['fuelTariff',100]]){s.policy[key]??=value;if(s.politics?.lawPolicy)s.politics.lawPolicy[key]??=value;}
  const validatedPolicy=sanitizePolicy(s.policy);
  if(Object.keys(validatedPolicy).some(k=>s.policy[k]!==validatedPolicy[k]))throw new Error('Повреждена политика сохранения');
  validateExtendedState(s);
  validateLocalGovernment(s);
  validateTerritorialGovernment(s);
  validateTerritorialPrograms(s);
  validateTerritorialAssets(s,s.firms.flatMap((firm,sector)=>[firm,...sectorCompanies(s,sector)]));
  validateFoundation(s);
  validateConsumption(s);
  validateSocial(s);
  validateOpenEconomy(s);
  validateRegionalEconomy(s);
  validateEnterpriseMarket(s);validateProductMarkets(s);validateBusinessDynamics(s);validateCorporateBonds(s);validateFirmMarkets(s);validateFirmMarkets(s);
  repairExitedEUProgramme(s);
  validatePoliticalSystem(s);
  validateCharacters(s);
  validateDefense(s);
  validateDefenseEconomy(s);
  s.policy=validatedPolicy;
  const tolerance=Math.max(1e-4,Math.abs(bankAssets(s))*1e-10);
  const centralResidual=s.government.reservesUSD*s.exchangeRate+s.bank.centralBorrowing-s.bank.reserves-s.centralBank.equity;
  if(s.exchangeRate<=0||s.population<=0||s.government.reservesUSD<0||s.government.fundUSD<0||s.government.cash<0||borrowers(s).some(a=>a.cash<0||a.loanLC<0||a.loanFX<0)||Math.abs(bankResidual(s))>tolerance||Math.abs(centralResidual)>tolerance) throw new Error('Нарушены балансы сохранения');
  const loaded=copy(s);initializeEnterpriseMarket(loaded);initializeFirmMarkets(loaded);
  if(!loaded.characters){
    const identity=characterPlayerIdentity({...data.leader,...data.leader?.appearance});
    initializeCharacters(loaded,identity);
    if(loaded.characters){
      loaded.provenance.characterMigration={month:loaded.month,afterCommand:loaded.politics.turnCommands.at(-1)?.id??null};
      if(identity)loaded.provenance.characterPlayer=identity;
    }
  }
  initializeCompanyLocations(loaded);
  loaded.regional=projectRegionalEconomy(loaded,inputMatrix(loaded));
  updateRegionalStatus(loaded);
  return loaded;
}

export function accountBalances(s) {
  return {bankAssets:bankAssets(s),deposits:deposits(s),bankEquity:s.bank.equity,centralBorrowing:s.bank.centralBorrowing,
    bankResidual:bankResidual(s),privateLoans:privateLoans(s),domesticDebt:domesticDebt(s),externalDebtUSD:externalDebtUSD(s),
    totalGovernmentDebt:domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate,
    householdCash:sum(s.households.map(h=>h.cash)),firmCash:sum(s.firms.map(f=>f.cash)),treasuryCash:s.government.cash,
    riskWeightedAssets:riskAssets(s),leverageRatio:bankLeverage(s),liquidityCoverage:bankLiquidityCoverage(s)};
}

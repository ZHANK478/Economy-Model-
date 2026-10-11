import {createDemography,advanceDemography,demographicMetrics,cohortTotals} from './demography.js';
import {VERSION,SECTORS,INPUTS,GROUPS,BASE_POLICY,POLICY_FIELDS,POLICY_CHECKS,POLICY_CHOICES,PARAMETERS,WORLD,MODEL_PROFILES} from './config.js';
import {initializePolitics,reviewPolicy,advancePolitics,politicsMetrics} from './politics.js';
import {initializePoliticalSystem,schedulePolitical,executePolitical,validatePoliticalSystem} from './political-system.js';
export {schedulePolitical,executePolitical};
import {initializeMonetary,advanceMonetary,fixedExchange,hasDiscretionaryCB,monetaryMetrics} from './monetary.js';
import {initializeLabor,advanceLabor,laborWageShares,laborMetrics} from './labor.js';
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
// Volumes: million LC at January 2026 basic prices. Population/workers: million people.
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const sum=a=>a.reduce((s,v)=>s+v,0);
export const copy=x=>JSON.parse(JSON.stringify(x));
export const annualToMonthly=r=>Math.expm1(Math.log1p(r)/12);
export const monthlyToAnnual=r=>Math.expm1(Math.log1p(r)*12);
export const realInterestRate=(nominal,expected)=>(1+nominal)/(1+expected)-1;
const dot=(a,b)=>sum(a.map((v,i)=>v*b[i]));
const normalize=a=>a.map(v=>v/sum(a));
const colsum=j=>sum(INPUTS.map(row=>row[j]));
const zeros=()=>Array(5).fill(0);
const logRatio=(x,y)=>Math.log(Math.max(x,1e-9)/Math.max(y,1e-9));
const yearCoupon=(amount,rate)=>amount*rate/12; // Coupon contracts are nominal APR.

export function solveLeontief(finalDemand) {
  const a=INPUTS.map((row,i)=>row.map((x,j)=>(i===j?1:0)-x).concat(finalDemand[i]));
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

function borrowers(s) {return [...s.households,...s.firms];}
function deposits(s) {return sum(borrowers(s).map(x=>x.cash))+s.government.cash;}
function privateLoans(s) {return sum(borrowers(s).map(x=>x.loanLC+x.loanFX*s.exchangeRate));}
function domesticDebt(s) {return sum(s.government.domesticBonds.map(x=>x.principal));}
function externalDebtUSD(s) {return sum(s.government.externalBonds.map(x=>x.principal));}
function bankAssets(s) {
  return privateLoans(s)+domesticDebt(s)+s.bank.reserves+s.bank.foreignAssetsUSD*s.exchangeRate;
}
function bankResidual(s) {return bankAssets(s)-deposits(s)-s.bank.centralBorrowing-s.bank.equity;}
function netForeignAssetsUSD(s) {
  return s.bank.foreignAssetsUSD+s.government.reservesUSD+s.government.fundUSD
    +sum(s.households.map(h=>h.foreignSavingsUSD))-externalDebtUSD(s)-sum(s.firms.map(f=>f.foreignEquityUSD));
}
function riskAssets(s) {
  const fx=Math.max(0,s.bank.foreignAssetsUSD)*s.exchangeRate;
  const openPosition=s.policy.monetaryRegime==='dollarized'?0:Math.abs(s.bank.foreignAssetsUSD+sum(borrowers(s).map(a=>a.loanFX)))*s.exchangeRate;
  return privateLoans(s)+(.2+(s.government.defaultActive?.8:0))*domesticDebt(s)+s.parameters.foreignAssetRiskWeight*fx+s.parameters.fxRiskWeight*openPosition;
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
function foreignPayment(s,actor,usd) {
  actor.cash+=usd*s.exchangeRate;
  s.bank.foreignAssetsUSD+=usd;
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
  actor.loanLC*=1-fraction; actor.loanFX*=1-fraction; s.bank.equity-=amount;
  return amount;
}
function repayLoan(s,actor,amount) {
  const total=actor.loanLC+actor.loanFX*s.exchangeRate;
  const value=Math.min(amount,total,Math.max(0,actor.cash));
  if(total>0) {actor.loanLC*=1-value/total; actor.loanFX*=1-value/total;}
  actor.cash-=value;
  return value;
}
function issueDomestic(s,amount,flow) {
  if(amount<=0) return;
  s.government.domesticBonds.push({principal:amount,rate:(s.monetary?.effectiveRate??s.policy.rate)/100+flow.sovereignSpread,maturity:s.month+60});
  s.government.cash+=amount; flow.domesticIssued+=amount;
}
function issueExternal(s,amountLC,flow) {
  if(amountLC<=0) return;
  const usd=amountLC/s.exchangeRate;
  s.government.externalBonds.push({principal:usd,rate:flow.foreignRate+flow.sovereignSpread,maturity:s.month+84});
  foreignPayment(s,s.government,usd); flow.externalIssued+=usd;
}
function fundGovernment(s,needed,flow) {
  const shortage=Math.max(0,needed-s.government.cash);
  if(!shortage) return;
  const gdpAnnual=Math.max(s.metrics.nominalGDPAnnual,100);
  const debt=domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate;
  const capacity=Math.max(0,s.parameters.maximumPublicDebtRatio*gdpAnnual-debt);
  const amount=Math.min(shortage,capacity);
  const access=clamp(s.institutions.confidence*(1-Math.max(0,debt/gdpAnnual-1)*.8),0,1)
    *(s.government.defaultActive||s.month<s.government.excludedUntil||flow.marketClosed?0:1);
  const foreign=amount*s.policy.foreignBorrowingShare/100*access;
  const bankHeadroom=Math.max(0,(s.bank.equity/(s.policy.bankCapitalRequirement/100)-riskAssets(s))/.2);
  const domestic=Math.min(amount-foreign,bankHeadroom,Math.max(0,gdpAnnual*.12));
  issueExternal(s,foreign,flow); issueDomestic(s,domestic,flow);
  flow.unfunded+=shortage-foreign-domestic;
}

export function sanitizePolicy(policy) {
  // Keep only real instruments. Old quality targets must not leak into journals
  // as apparently operative decisions after the equations have changed.
  const p=Object.fromEntries(Object.entries(BASE_POLICY).map(([key,value])=>[key,policy?.[key]??value]));
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
  const resource=options.resourceMode!==false;
  const p=sanitizePolicy(options.policy);
  const parameters={...PARAMETERS,...options.parameters};
  validateParameters(parameters);
  const consumptionWeights=[.28,.08,.23,.07,.34];
  const investmentWeights=[.01,.08,.31,.55,.05];
  const governmentWeights=[.03,.06,.14,.28,.49];
  const exportWeights=resource?[.10,.64,.16,.00,.10]:[.18,.08,.46,.00,.28];
  const [C,I,G,X]=[2500,1000,700,1700];
  if([C,I,G,X].some(x=>!Number.isFinite(x)||x<=0)) throw new Error('Некорректный начальный спрос');
  const cf=.16,iv=.40,gv=.13;
  const f=zeros().map((_,i)=>C*(1-cf)*consumptionWeights[i]+I*(1-iv)*investmentWeights[i]+G*(1-gv)*governmentWeights[i]+X*exportWeights[i]);
  const q=solveLeontief(f);
  const importCoefficients=[.06,.07,.18,.10,.035];
  const baseGDP=dot(q,q.map((_,i)=>1-colsum(i)-importCoefficients[i]))+C*BASE_POLICY.vat/100;
  const scale=5000/baseGDP;
  const baseOutput=q.map(v=>v*scale);
  const initialWorkers=10*(1-parameters.initialChildShare-parameters.initialElderlyShare)*.70*.91;
  const workerShares=resource?[.20,.07,.20,.13,.40]:[.20,.035,.25,.13,.385];
  const householdCash=GROUPS.map(g=>32700*(g.dividendShare*.8+g.wageShare*.2));
  const hhShares=GROUPS.map(g=>g.wageShare*.8+g.dividendShare*.2);
  const s={
    version:VERSION,month:0,startYear:2026,resourceMode:resource,
    seed:Number(options.seed??42)>>>0,stochastic:Boolean(options.stochastic),
    policy:p,parameters,world:{...WORLD,...options.world},shocks:[],modelProfile:options.modelProfile??'balanced',
    population:10,ageCohorts:[2.8,6.5,.7],participation:.70,workingAgeShare:.65,exchangeRate:1,
    expectedInflation:.08,inflationLogMonthly:Math.log1p(.08)/12,
    consumerPriceIndex:100,worldPriceIndex:100,skills:1,
    infrastructure:60000*.60,initialInfrastructure:60000*.60,
    institutions:{confidence:.68,informality:.28,taxCompliance:.78,competition:.60,investmentEfficiency:.70,ownershipRisk:0},
    education:{access:1,meanYears:8,expectedYears:12},
    base:{monthlyGDP:5000,output:baseOutput,consumption:C*scale,investment:I*scale,government:G*scale,exports:X*scale,
      consumptionWeights,investmentWeights,governmentWeights,exportWeights,consumptionImport:cf,investmentImport:iv,governmentImport:gv,
      initialPopulation:10,referenceIncome:0,initialGroupIncomes:[],initialRate:.03},
    households:GROUPS.map((g,i)=>({...g,cash:householdCash[i],loanLC:8000*hhShares[i],loanFX:2000*g.dividendShare,
      averageRate:.15,foreignSavingsUSD:2500*g.dividendShare,income:((C*scale*hhShares[i]/g.mpc)-householdCash[i]*parameters.wealthAnnuity),
      consumption:C*scale*hhShares[i],realIncomeIndex:100})),
    firms:SECTORS.map((sector,i)=>({id:sector.id,name:sector.name,price:1,inventory:baseOutput[i]*.15,
      production:baseOutput[i],salesExpected:baseOutput[i],workers:initialWorkers*workerShares[i],
      laborProductivity:baseOutput[i]/(initialWorkers*workerShares[i]),capacity:baseOutput[i]/.90,
      capital:baseOutput[i]/.90*12*1.35,initialCapital:baseOutput[i]/.90*12*1.35,
      productivity:1,wage:2500*workerShares[i]/(initialWorkers*workerShares[i]),
      cash:baseOutput[i]*2.2,loanLC:baseOutput[i]*2.6,loanFX:resource&&i===1?baseOutput[i]*.9:baseOutput[i]*.2,
      averageRate:.14,foreignEquityUSD:baseOutput[i]*.18,importCoefficient:importCoefficients[i],
      lastProfit:baseOutput[i]*.10,lastRevenue:baseOutput[i],lastInvestment:I*scale*workerShares[i],
      defaulted:false,utilization:.90,arrears:0,
      ownership:{state:[.05,.30,.10,.05,.15][i],foreign:.18,domestic:1-.18-[.05,.30,.10,.05,.15][i],municipal:0,cooperative:0},workerOwners:Array(10).fill(0),
      domesticOwners:GROUPS.map(g=>g.dividendShare*(1-.18-[.05,.30,.10,.05,.15][i])),
      governance:.65,managementEfficiency:1,reorganization:0,softBudget:0})),
    government:{cash:3000,reservesUSD:8000,fundUSD:resource?2000:0,
      domesticBonds:Array.from({length:60},(_,i)=>({principal:21000/60,rate:.09,maturity:i+1})),
      externalBonds:Array.from({length:84},(_,i)=>({principal:9000/84,rate:.065,maturity:i+1})),
      lastDeficit:0,arrears:0,defaults:0,defaultActive:false,defaultStart:null,defaultEpisodes:[],excludedUntil:0},
    bank:{equity:0,reserves:3500,centralBorrowing:0,foreignAssetsUSD:0,lendingRate:.15,depositRate:.065,npl:.04,creditSupply:1,stateOwnership:0},
    centralBank:{equity:0,deferredLoss:0,lastProfit:0,lastRemittance:0},
    projects:[],history:[],incomeHistory:[],lastReport:{events:[],channels:[],fiscal:{},audit:{}},
    metrics:{nominalGDPAnnual:60000,realGDPMonthly:5000,nominalGDPMonthly:5000}
  };
  if(!(s.modelProfile in MODEL_PROFILES))throw new Error('Неизвестный профиль модели');
  initializeInstitutions(s);
  initializePolitics(s);initializeMonetary(s);initializeLabor(s);initializeServices(s);initializeInfrastructure(s);
  initializeJournal(s);
  s.bank.equity=bankAssets(s)-deposits(s);
  s.base.referenceIncome=sum(s.households.map(h=>h.income));
  s.base.initialGroupIncomes=s.households.map(h=>h.income);
  s.incomeHistory=Array.from({length:12},(_,i)=>({month:i-11,population:s.population,cpi:100,net:s.households.map(h=>h.income),market:s.households.map(h=>h.income),synthetic:true}));
  s.lastReport.world={...WORLD};
  for(let m=1;m<=parameters.privateInvestmentDelay;m++) {
    for(let i=0;i<5;i++) s.projects.push({type:'private',sector:i,amount:s.base.investment*workerShares[i],due:m,efficiency:1,legacy:true});
  }
  for(let m=1;m<=parameters.publicInvestmentDelay;m++) s.projects.push({type:'public',amount:200*scale,due:m,efficiency:s.institutions.investmentEfficiency,legacy:true});
  s.demography=createDemography(s.population,parameters);
  s.ageCohorts=cohortTotals(s.demography);s.workingAgeShare=s.ageCohorts[1]/s.population;
  s.metrics={...initialMetrics(s),...demographicMetrics(s),realGDPAnnualized:60000,realGDPRolling:60000,nominalGDPAnnualized:60000,gdpUSDAnnualized:60000,gdpUSDRolling:60000,realPolicyRate:realInterestRate(s.monetary.effectiveRate/100,.08)*100};
  // Explicit synthetic prehistory, solely for rolling indicators at the initial date.
  for(let m=-12;m<=0;m++) s.history.push({...s.metrics,month:m,consumerPriceIndex:100*Math.pow(1.08,m/12),
    realGDPMonthly:5000*Math.pow(1.03,m/12),nominalGDPMonthly:5000*Math.pow(1.03*1.08,m/12),synthetic:m<0});
  const prehistory=s.history.filter(x=>x.month>=-11);
  s.metrics.realGDPRolling=sum(prehistory.map(x=>x.realGDPMonthly));
  s.metrics.nominalGDPAnnual=sum(prehistory.map(x=>x.nominalGDPMonthly));
  s.metrics.gdpUSDRolling=s.metrics.nominalGDPAnnual;
  const debtScale=s.metrics.nominalGDPAnnual/60000;
  for(const bond of [...s.government.domesticBonds,...s.government.externalBonds]) bond.principal*=debtScale;
  s.bank.equity=riskAssets(s)*.12;
  s.bank.reserves=deposits(s)+s.bank.equity-privateLoans(s)-domesticDebt(s);
  s.centralBank.equity=s.government.reservesUSD*s.exchangeRate+s.bank.centralBorrowing-s.bank.reserves;
  s.metrics.capitalRatio=bankCapital(s)*100;s.metrics.bankLiquidity=s.bank.reserves/deposits(s)*100;
  s.metrics.foreignDebtRatio=externalDebtUSD(s)/s.metrics.nominalGDPAnnual*100;
  s.metrics={...s.metrics,...socialIndicators(s),...institutionMetrics(s),...politicsMetrics(s),...laborMetrics(s),...infrastructureMetrics(s),...servicesMetrics(s),...monetaryMetrics(s),investmentPrice:1,liquidityCoverage:bankLiquidityCoverage(s)*100,leverageRatio:bankLeverage(s)*100,debtInDefault:0,refinancingRisk:refinancingRisk(s).annualProbability*100};
  initializePoliticalSystem(s,options);
  s.metrics={...s.metrics,...politicsMetrics(s)};
  s.history[s.history.length-1]={...s.metrics,consumerPriceIndex:100,synthetic:false};
  return s;
}

function initialMetrics(s) {
  const debt=domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate;
  return {month:0,realGDPMonthly:5000,nominalGDPMonthly:5000,nominalGDPAnnual:60000,
    gdpPerCapitaReal:6000,gdpPerCapitaUSD:6000,gdpGrowthYoY:3,inflationYoY:8,inflationMonthly:annualToMonthly(.08)*100,
    coreInflation:8,foodInflation:8,energyInflation:8,unemployment:9,realIncomeIndex:100,
    exchangeRate:1,outputGap:-8,debtRatio:debt/60000*100,deficitRatio:0,
    reservesUSD:s.government.reservesUSD,fundUSD:s.government.fundUSD,tradeBalance:0,currentAccountUSD:0,
    lendingRate:15,depositRate:6.5,capitalRatio:bankCapital(s)*100,npl:4,credit:privateLoans(s),
    deposits:deposits(s),consumption:s.base.consumption,investment:s.base.investment,governmentPurchases:s.base.government,
    exports:s.base.exports,imports:s.base.exports,inventoryChange:0,productivity:100,
    laborForce:s.population*s.workingAgeShare*s.participation,employment:sum(s.firms.map(f=>f.workers)),
    fulfillment:100,confidence:s.institutions.confidence*100,informality:s.institutions.informality*100,
    taxRevenue:0,governmentSpending:0,interestExpense:0,privateDebtRatio:privateLoans(s)/60000*100,
    infrastructure:100,skills:100,bankLiquidity:s.bank.reserves/deposits(s)*100,
    foreignDebtRatio:externalDebtUSD(s)/60000*100,realExchangeRate:100,migration:0,publicInvestment:200,
    moneyCreated:0,creditLosses:0,reserveMonths:6.4,sovereignSpread:3,investmentCompleted:0,
    auditError:bankResidual(s),policyRate:s.monetary.effectiveRate,expectedInflation:s.expectedInflation*100};
}

function constrainedProduction(s,finalDemand,capacity) {
  const inventory=s.firms.map(f=>f.inventory);
  const restock=s.firms.map((f,i)=>Math.max(0,s.base.output[i]*s.parameters.inventoryTarget-inventory[i])*s.parameters.inventoryAdjustment);
  function at(alpha,useRestock=true) {
    const requested=solveLeontief(finalDemand.map((v,i)=>v*alpha+(useRestock?restock[i]:0)));
    const production=requested.map((v,i)=>Math.max(0,Math.min(capacity[i],v)));
    const intermediate=INPUTS.map(row=>dot(row,production));
    const ending=production.map((v,i)=>inventory[i]+v-intermediate[i]-alpha*finalDemand[i]);
    return {production,intermediate,ending,alpha,feasible:ending.every(v=>v>=-1e-7)};
  }
  const restockOK=at(0).feasible;
  if(at(1,restockOK).feasible) return at(1,restockOK);
  let low=0,high=1;
  for(let j=0;j<45;j++) {const m=(low+high)/2;if(at(m,restockOK).feasible) low=m;else high=m;}
  return at(low,restockOK);
}

function effectiveWorld(s) {
  const w={...s.world};
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

export function advanceMonth(state,policy=state.policy) {
  if(state.politics.enabled&&!state.politics.executive.inOffice)return copy(state);
  // Historical entries are immutable. Copy live accounts, not an ever-growing
  // journal on every month; callers' histories are never modified.
  const archiveKeys=['rollCalls','elections','partyHistory','commandHistory'];
  const livePolitics=state.politics.enabled?{...state.politics,...Object.fromEntries(archiveKeys.map(k=>[k,[]])),bills:state.politics.bills.filter(b=>!['enacted','withdrawn','expired','declined'].includes(b.status))}:state.politics;
  const s=copy({...state,politics:livePolitics,history:[],journal:[]}),prev=state;
  if(state.politics.enabled){for(const key of archiveKeys)s.politics[key]=state.politics[key].slice();const active=new Map(s.politics.bills.map(b=>[b.id,b]));s.politics.bills=state.politics.bills.map(b=>active.get(b.id)??b);}
  s.history=state.history.slice();s.journal=state.journal.slice();
  const requestedPolicy=sanitizePolicy(policy);s.policy=requestedPolicy; s.month++;
  const events=[];
  s.policy=reviewPolicy(s,prev,requestedPolicy,events);s.requestedPolicy=requestedPolicy;
  const p=s.policy,k=s.parameters,w=effectiveWorld(s);
  const gov=s.government,b=s.bank;
  advanceMonetary(s,prev,w,events);
  const effectiveRate=s.monetary.effectiveRate;
  const flow={tax:0,vat:0,tariff:0,incomeTax:0,corporateTax:0,royalty:0,
    purchases:0,transfers:0,familyBenefits:0,healthcare:0,education:0,childcare:0,infrastructureMaintenance:0,concessionGuarantees:0,institutionCost:0,antitrust:0,courts:0,soeAudits:0,politicalElections:0,politicalSecurity:0,politicalPatronage:0,businessSupport:0,interest:0,bankRescue:0,centralIncome:0,
    domesticIssued:0,externalIssued:0,domesticRedeemed:0,externalRedeemed:0,
    reserveSale:0,fundWithdrawal:0,fundDeposit:0,domesticHaircut:0,externalHaircut:0,
    interestCapitalized:0,unfunded:0,sovereignSpread:0,stateDividends:0,equityPurchases:0,equitySales:0,networkPurchases:0,networkSales:0,externalEquityRevaluation:0,reserveConversion:0};
  const initialDebt=domesticDebt(prev)+externalDebtUSD(prev)*prev.exchangeRate;
  const debtRatio=initialDebt/Math.max(prev.metrics.nominalGDPAnnual,1);
  const fundingRisk=refinancingRisk(s);
  flow.marketClosed=s.stochastic&&uniform(s.seed,s.month,9)<fundingRisk.monthlyProbability;
  flow.sovereignSpread=.025+k.sovereignRiskSensitivity*Math.max(0,debtRatio-.60)+.025*(1-s.institutions.confidence)+.03*Math.max(0,prev.metrics.reserveMonths<3?1-prev.metrics.reserveMonths/3:0)
    +(gov.defaultActive||s.month<gov.excludedUntil?.05:0);
  flow.foreignRate=w.globalRate/100;
  const realPolicy=realInterestRate(effectiveRate/100,s.expectedInflation);
  const flowPressure=-(prev.lastReport.external?.bopUSD??prev.metrics.currentAccountUSD)/Math.max(prev.metrics.nominalGDPMonthly/prev.exchangeRate,1);
  const interventionUSD=fixedExchange(s)?0:clamp(p.fxIntervention,-Math.max(0,gov.cash/prev.exchangeRate),gov.reservesUSD);
  const exchangeChange=fixedExchange(s)?0:clamp((Math.log1p(s.expectedInflation)-Math.log1p(.02))/12+k.exchangeFlowSensitivity*flowPressure
    -k.exchangeInterestSensitivity*(realPolicy-realInterestRate(w.globalRate/100,.02))
    -k.exchangeParityAdjustment*Math.log(Math.max(.1,prev.exchangeRate*prev.worldPriceIndex/prev.consumerPriceIndex))
    +.005*Math.max(0,debtRatio-.8)+.006*(.68-s.institutions.confidence)
    -.14*interventionUSD/Math.max(prev.metrics.nominalGDPMonthly/prev.exchangeRate,1)
    +(s.stochastic?noise(s.seed,s.month,5)*.004:0),-.15,.20);
  s.exchangeRate*=Math.exp(exchangeChange);
  s.centralBank.equity+=prev.government.reservesUSD*(s.exchangeRate-prev.exchangeRate);
  const bankFXRevaluation=(b.foreignAssetsUSD+sum(borrowers(s).map(a=>a.loanFX)))*(s.exchangeRate-prev.exchangeRate);
  b.equity+=bankFXRevaluation;
  if(interventionUSD!==0) {
    gov.reservesUSD-=interventionUSD; foreignPayment(s,gov,interventionUSD); flow.reserveSale=interventionUSD*s.exchangeRate;
    s.centralBank.equity-=flow.reserveSale;
  }
  if(Math.abs(interventionUSD-p.fxIntervention)>1) events.push('Интервенция ограничена доступными резервами или средствами казначейства.');
  s.institutions.ownershipRisk*=1-k.ownershipRiskDecay;
  const actionResults=[...executeOwnership(s,flow,events,{fundGovernment,transfer,foreignPayment}),...executeNetworkTransfers(s,flow,events,{fundGovernment,transfer})];
  s.worldPriceIndex*=1+annualToMonthly(.02);
  const migration=advanceDemography(s,prev);
  s.participation=clamp(s.participation+.002*((.70+(prev.metrics.realIncomeIndex/100-1)*.03)-s.participation),.55,.82);
  const laborForce=s.population*s.workingAgeShare*s.participation;
  const informalTarget=clamp(.42-.22*p.taxEnforcement/100+(p.incomeTax+p.corporateTax-32)/100*.12,.08,.50);
  s.institutions.informality+=.015*(informalTarget-s.institutions.informality);
  s.institutions.taxCompliance=clamp(1-s.institutions.informality*(1.15-.35*p.taxEnforcement/100),.4,.99);
  advanceInstitutionOutcomes(s);
  advanceLabor(s,prev,events);
  s.institutions.investmentEfficiency=clamp(.72+.30*(p.taxEnforcement/100-.60)+k.competitionEfficiencyElasticity*(s.institutions.competition-.60),.35,.9);
  advanceEducation(s,prev.lastReport.fiscal?.education??75);
  prepareInfrastructure(s,prev,events);
  let completed=0;
  for(const f of s.firms) f.capital*=1+annualToMonthly(-k.annualDepreciation);
  for(const project of s.projects.filter(x=>x.due<=s.month)) {
    completed+=project.amount*project.efficiency;
    if(project.type==='network')completeInfrastructure(s,project);
    else if(project.type==='private') s.firms[project.sector].capital+=project.amount*project.efficiency;
    else for(const n of s.networks){n.public+=project.amount*project.efficiency*n.weight*(1-p.municipalInvestmentShare/100);n.municipal+=project.amount*project.efficiency*n.weight*p.municipalInvestmentShare/100;}
  }
  synchronizeInfrastructure(s);
  s.projects=s.projects.filter(x=>x.due>s.month);
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
    f.productivity*=1+annualToMonthly(k.annualTechnicalProgress);
    const prod=f.laborProductivity*f.productivity*s.skills*f.managementEfficiency;
    const wageCost=Math.log(Math.max(.5,f.labor.wageFactor));
    const hours=p.normalWorkweek/40;
    const demand=f.salesExpected/prod/Math.max(.75,hours)*Math.exp(-k.laborDemandWageElasticity*wageCost);
    const adjustment=k.employmentAdjustment/(1+p.employmentProtection/6);
    return Math.max(0,f.workers+adjustment*(demand-f.workers));
  });
  const laborScale=Math.min(1,laborForce*.985/Math.max(sum(desiredWorkers),.001));
  const wageChanges=zeros();
  const capacity=s.firms.map((f,i)=>{
    f.workers=desiredWorkers[i]*laborScale;
    const employmentTightness=(sum(desiredWorkers)/laborForce-.91);
    const minimumEffect=i===0||i===4?Math.log(p.minimumWage/prev.policy.minimumWage)*.28:Math.log(p.minimumWage/prev.policy.minimumWage)*.10;
    const bargainingChange=logRatio(f.labor.wageFactor,prev.firms[i].labor.wageFactor);
    const wageChange=clamp(s.inflationLogMonthly*.9+k.annualTechnicalProgress/12+k.wageAdjustment*(employmentTightness*.04)+minimumEffect+bargainingChange,-.02,.06);
    wageChanges[i]=wageChange;f.wage*=Math.exp(wageChange);
    const physical=f.capacity*Math.pow(f.capital/f.initialCapital,k.capitalCapacityElasticity)*f.productivity*s.skills*f.managementEfficiency
      *Math.pow(s.infrastructure/s.initialInfrastructure,k.infrastructureElasticity);
    const labor=f.workers*f.laborProductivity*f.productivity*s.skills*f.managementEfficiency*1.08*(p.normalWorkweek/40)*(1-f.labor.strikeShare);
    const weather=i===0?w.weather/100:1;
    const importedComponents=physical*clamp(w.importAvailability/100,.02,1.2);
    return Math.max(0,Math.min(physical,labor,importedComponents)*weather);
  });
  const loanTarget=Math.max(0,effectiveRate/100+.025+.15*b.npl+.035*(1-s.institutions.confidence)
    +k.contractRiskSensitivity*(.65-s.institutions.contractReliability)+k.politicalRiskSensitivity*s.politics.corruption);
  b.lendingRate+=k.ratePassThrough*(loanTarget-b.lendingRate);
  settleLiquidity(s,flow);
  const loanYield=privateLoans(s)*b.lendingRate*(1-b.npl);
  const bondYield=sum(gov.domesticBonds.map(bond=>bond.principal*bond.rate));
  const reserveYield=hasDiscretionaryCB(s)?b.reserves*effectiveRate/100*k.reserveRemunerationShare
    :p.monetaryRegime==='dollarized'?Math.min(b.reserves,gov.reservesUSD*s.exchangeRate)*w.globalRate/100:0;
  const foreignAssetYield=Math.max(0,b.foreignAssetsUSD)*s.exchangeRate*w.globalRate/100;
  const fundingCost=b.centralBorrowing*(effectiveRate/100+.01)+Math.max(0,-b.foreignAssetsUSD)*s.exchangeRate*(w.globalRate/100+flow.sovereignSpread);
  const affordableRate=Math.max(0,(loanYield+bondYield+reserveYield+foreignAssetYield-fundingCost)/Math.max(deposits(s),1)-.004);
  const competitiveRate=p.monetaryRegime==='freeBanking'?affordableRate:Math.max(0,effectiveRate/100-.015-(1-s.institutions.bankContestability)*k.bankContestabilitySpread);
  const depositTarget=Math.min(competitiveRate,affordableRate*clamp(.85-k.bankContestabilitySpread/.025*.25*(.60-s.institutions.bankContestability),.5,.98));
  b.depositRate+=k.depositRateAdjustment*(depositTarget-b.depositRate);
  const capitalFactor=clamp(Math.min(bankCapital(s)/(p.bankCapitalRequirement/100),bankLeverage(s)/k.minimumLeverageRatio),0,1.3);
  const liquidityFactor=clamp(b.reserves/Math.max(1,deposits(s)*p.reserveRequirement/100),0,1);
  b.creditSupply=clamp(capitalFactor*Math.min(liquidityFactor,bankLiquidityCoverage(s))*(1-b.npl*2),0,1);
  let creditCreated=0,creditLosses=0;
  // Deposit remuneration and debt service, before new credit is extended.
  for(const a of borrowers(s)) {
    const depositInterest=Math.max(0,a.cash)*annualToMonthly(b.depositRate);
    a.cash+=depositInterest;b.equity-=depositInterest;a.depositIncome=depositInterest;
    a.averageRate+=k.oldLoanRepricing*(b.lendingRate-a.averageRate);
    const interest=(a.loanLC+a.loanFX*s.exchangeRate)*annualToMonthly(a.averageRate);
    const paid=Math.min(Math.max(0,a.cash),interest);
    a.cash-=paid;b.equity+=paid;
    const unpaid=interest-paid;
    if(unpaid>0) {a.loanLC+=unpaid;b.equity+=unpaid;creditLosses+=writeOff(s,a,.03);}
    a.interestPaid=paid;
  }
  const wholesaleCost=Math.max(0,-b.foreignAssetsUSD)*annualToMonthly(w.globalRate/100+flow.sovereignSpread);
  b.foreignAssetsUSD-=wholesaleCost;b.equity-=wholesaleCost*s.exchangeRate;
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
  // Budget shares refer to the known trailing-year nominal GDP. No second CPI
  // indexation and no imposed real growth unrelated to the actual tax base.
  const budgetBase=prev.metrics.nominalGDPAnnual/12;
  const administrationShare=.05+.25*Math.pow(p.taxEnforcement/100,2)+p.antitrustBudget+p.courtBudget+p.soeAuditBudget+p.electionAdministration+p.securityBudget+p.patronageBudget;
  const purchaseShare=p.governmentConsumption+p.publicInvestment+p.education+p.healthcare+p.childcareBudget+p.infrastructureMaintenance+administrationShare;
  const requestedPurchases=budgetBase*purchaseShare/100;
  const requestedTransfers=budgetBase*p.transfers/100*(.6+.4*(s.ageCohorts[2]/s.population)/.07);
  const requestedFamily=budgetBase*p.familyBenefits/100*(s.ageCohorts[0]/s.population)/.28;
  const requestedSupport=budgetBase*p.businessSupport/100;
  const coupons=sum(gov.domesticBonds.map(x=>yearCoupon(x.principal,x.rate)))+sum(gov.externalBonds.map(x=>yearCoupon(x.principal,x.rate)))*s.exchangeRate;
  const maturities=sum(gov.domesticBonds.filter(x=>x.maturity<=s.month).map(x=>x.principal))+sum(gov.externalBonds.filter(x=>x.maturity<=s.month).map(x=>x.principal))*s.exchangeRate;
  fundGovernment(s,requestedPurchases+requestedTransfers+requestedFamily+requestedSupport+coupons+maturities,flow);
  const domesticCoupons=sum(gov.domesticBonds.map(x=>yearCoupon(x.principal,x.rate)));
  const dcPaid=Math.min(Math.max(0,gov.cash),domesticCoupons);
  gov.cash-=dcPaid;b.equity+=dcPaid;flow.interest+=dcPaid;
  if(dcPaid<domesticCoupons) {
    const unpaid=domesticCoupons-dcPaid;
    gov.domesticBonds.forEach(bond=>{bond.inDefault=true;});
    gov.domesticBonds.push({principal:unpaid,rate:effectiveRate/100+flow.sovereignSpread,maturity:s.month,inDefault:true,overdue:unpaid});
    b.equity+=unpaid;flow.interestCapitalized+=unpaid;flow.interest+=unpaid;
    openDefaultEpisode(s,'payment-default',events);
  }
  const externalCoupons=sum(gov.externalBonds.map(x=>yearCoupon(x.principal,x.rate)));
  const ecPaid=Math.min(Math.max(0,gov.cash)/s.exchangeRate,externalCoupons);
  foreignPayment(s,gov,-ecPaid);flow.interest+=ecPaid*s.exchangeRate;
  if(ecPaid<externalCoupons) {
    const unpaid=externalCoupons-ecPaid;
    gov.externalBonds.forEach(bond=>{bond.inDefault=true;});
    gov.externalBonds.push({principal:unpaid,rate:w.globalRate/100+flow.sovereignSpread,maturity:s.month,inDefault:true,overdue:unpaid});
    flow.interestCapitalized+=unpaid*s.exchangeRate;flow.interest+=unpaid*s.exchangeRate;
    openDefaultEpisode(s,'payment-default',events);
  }
  for(const bond of gov.domesticBonds.filter(x=>x.maturity<=s.month)) {
    const paid=Math.min(Math.max(gov.cash,0),bond.principal);
    gov.cash-=paid;bond.principal-=paid;flow.domesticRedeemed+=paid;
    if(bond.principal>1e-6) {bond.inDefault=true;bond.overdue=bond.principal;openDefaultEpisode(s,'payment-default',events);}
  }
  for(const bond of gov.externalBonds.filter(x=>x.maturity<=s.month)) {
    const paid=Math.min(Math.max(gov.cash,0)/s.exchangeRate,bond.principal);
    foreignPayment(s,gov,-paid);bond.principal-=paid;flow.externalRedeemed+=paid;
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
  const transfersPaid=Math.min(Math.max(0,gov.cash),requestedTransfers);
  GROUPS.forEach((g,i)=>transfer(gov,s.households[i],transfersPaid*g.transferShare));flow.transfers=transfersPaid;
  const familyPaid=Math.min(Math.max(0,gov.cash),requestedFamily);
  GROUPS.forEach((g,i)=>transfer(gov,s.households[i],familyPaid*g.familyShare));flow.familyBenefits=familyPaid;
  const supportPaid=Math.min(Math.max(0,gov.cash),requestedSupport);
  s.firms.forEach((f,i)=>transfer(gov,f,supportPaid*s.base.output[i]/sum(s.base.output)));flow.businessSupport=supportPaid;
  const gBudget=Math.min(Math.max(0,gov.cash),requestedPurchases);
  if(gBudget<requestedPurchases*.99) events.push('Недостаток финансирования: часть государственных закупок отложена.');
  // External equity inflows and household foreign assets have explicit counterparts.
  const inflowUSD=budgetBase/s.exchangeRate*.008*s.institutions.confidence*(1-p.capitalControls/140)*Math.exp(-2*s.institutions.ownershipRisk)*(gov.defaultActive?.4:1);
  s.firms.forEach((f,i)=>{const usd=inflowUSD*s.base.output[i]/sum(s.base.output),oldValue=enterpriseValue(s,f),newShare=usd*s.exchangeRate/(oldValue+usd*s.exchangeRate);foreignPayment(s,f,usd);f.foreignEquityUSD+=usd;for(const key of ['state','domestic','municipal','cooperative'])f.ownership[key]*=1-newShare;f.ownership.foreign=f.ownership.foreign+(1-f.ownership.foreign)*newShare;f.domesticOwners=f.domesticOwners.map(v=>v*(1-newShare));f.workerOwners=f.workerOwners.map(v=>v*(1-newShare));});
  const wealthy=s.households.at(-1);
  const flightUSD=Math.min(Math.max(0,wealthy.cash)/s.exchangeRate*.015,
    budgetBase/s.exchangeRate*Math.max(0,.003+(s.expectedInflation-effectiveRate/100)*.08+(1-s.institutions.confidence)*.009)*(1-p.capitalControls/100));
  foreignPayment(s,wealthy,-flightUSD);wealthy.foreignSavingsUSD+=flightUSD;
  const remittancesUSD=budgetBase/s.exchangeRate*.01;
  GROUPS.forEach((g,i)=>foreignPayment(s,s.households[i],remittancesUSD*g.transferShare));
  let privateInterest=0;for(const a of borrowers(s)) privateInterest+=a.interestPaid;
  const consumerUnitPrices=s.firms.map(f=>f.price);
  const importPrice=s.exchangeRate*s.worldPriceIndex/100*(.8+.2*w.energyPrice/100);
  const realExchangeRate=s.exchangeRate*s.worldPriceIndex/prev.consumerPriceIndex;
  const importShareC=clamp(s.base.consumptionImport*Math.pow(realExchangeRate,-k.importElasticity),.05,.35);
  const cUnit=(1-importShareC)*dot(s.base.consumptionWeights,consumerUnitPrices)+importShareC*importPrice*(1+p.tariff/100);
  const householdBudgets=s.households.map(h=>{
    const realSavingRate=realInterestRate(b.depositRate,s.expectedInflation);
    const effectiveRealRate=.55*realPolicy+.45*realSavingRate;
    const sensitive=clamp(Math.exp(-k.interestConsumptionElasticity*(effectiveRealRate-k.neutralRealRate)*(1+(1-h.mpc)*2)),.35,1.7);
    const desired=Math.max(0,((h.income-h.interestPaid)*h.mpc+h.cash*k.wealthAnnuity)*sensitive);
    const maxLoan=Math.max(0,h.income*12*.60-h.loanLC-h.loanFX*s.exchangeRate)*.025*b.creditSupply;
    const loan=Math.min(maxLoan,Math.max(0,desired-h.cash)*.5);
    grantLoan(s,h,loan,0);creditCreated+=loan;
    const smoothed=.22*desired+.78*h.consumption*cUnit*(1+p.vat/100);
    const budget=Math.min(smoothed,Math.max(0,h.cash)*.88);
    return budget;
  });
  const servicePrice=s.firms[4].price;
  const servicePlans=privateServicePlans(s,householdBudgets,servicePrice);
  const householdPlans=householdBudgets.map((budget,i)=>Math.max(0,budget-servicePlans[i].total*servicePrice)/(cUnit*(1+p.vat/100)));
  const ordinaryCVolume=sum(householdPlans),privateServiceVolume=sum(servicePlans.map(x=>x.total));
  const cVolume=ordinaryCVolume+privateServiceVolume;
  const iUnit=.6*dot(s.base.investmentWeights,consumerUnitPrices)+.4*importPrice*(1+p.tariff/100);
  const investmentPlans=s.firms.map((f,i)=>{
    const expectedGrowth=clamp(f.salesExpected/Math.max(prev.firms[i].production,1)-1,-.4,.4);
    const target=s.base.investment*s.base.output[i]/sum(s.base.output)*Math.pow(Math.max(.25,f.salesExpected/s.base.output[i]),.8)
      *clamp(Math.exp(-k.interestInvestmentElasticity*(realInterestRate(b.lendingRate,s.expectedInflation)-.07)+expectedGrowth*.8),.15,2.5)
      *( .55+.65*s.institutions.confidence)*Math.exp(-s.institutions.ownershipRisk*.8)*f.managementEfficiency;
    const desired=f.lastInvestment+k.investmentAdjustment*(target-f.lastInvestment);
    const buffer=f.production*.20;
    const need=Math.max(0,desired*iUnit+buffer-f.cash);
    const loan=Math.min(need,Math.max(0,f.lastRevenue*12*.75-f.loanLC-f.loanFX*s.exchangeRate)*.04*b.creditSupply);
    grantLoan(s,f,loan,s.resourceMode&&i===1?.25:.08);creditCreated+=loan;
    return Math.max(0,Math.min(desired,(f.cash-buffer)/Math.max(iUnit,1e-9)));
  });
  const iVolume=sum(investmentPlans);
  const networkPlans=infrastructurePlans(s,investmentPlans);
  const gUnit=.87*dot(s.base.governmentWeights,consumerUnitPrices)+.13*importPrice*(1+p.tariff/100);
  const gVolume=gBudget/gUnit;
  const exportVolumes=s.firms.map((f,i)=>{
    const commodityFactor=s.resourceMode&&i===1?1:Math.pow(realExchangeRate,k.exportElasticity);
    const target=s.base.exports*s.base.exportWeights[i]*(w.foreignDemand/100)*Math.pow(1.025,s.month/12)*commodityFactor;
    const old=prev.lastReport.market?.exports?.[i]??s.base.exports*s.base.exportWeights[i];
    return Math.max(0,old+.22*(target-old));
  });
  const domesticC=s.base.consumptionWeights.map((x,i)=>x*ordinaryCVolume*(1-importShareC)+(i===4?privateServiceVolume:0));
  const domesticI=s.base.investmentWeights.map(x=>x*iVolume*.6);
  const domesticG=s.base.governmentWeights.map(x=>x*gVolume*.87);
  const finalDemand=zeros().map((_,i)=>domesticC[i]+domesticI[i]+domesticG[i]+exportVolumes[i]);
  const market=constrainedProduction(s,finalDemand,capacity);
  const alpha=market.alpha;
  const requestedProduction=solveLeontief(finalDemand);
  const production=market.production;
  const initialInventories=s.firms.map(f=>f.inventory);
  const revenue=zeros(),inputCost=zeros();
  let importNominal=0,importReal=0,exportNominal=0,intermediateDuties=0;
  // Interindustry payments are simultaneous: temporary negative cash is resolved at settlement.
  s.firms.forEach((buyer,j)=>{
    s.firms.forEach((seller,i)=>{
      const value=INPUTS[i][j]*production[j]*seller.price;
      transfer(buyer,seller,value);revenue[i]+=value;inputCost[j]+=value;
    });
    const imported=buyer.importCoefficient*production[j];
    const value=imported*importPrice;
    foreignPayment(s,buyer,-value/s.exchangeRate);importNominal+=value;importReal+=imported;inputCost[j]+=value;
    const duty=value*p.tariff/100;transfer(buyer,gov,duty);flow.tariff+=duty;intermediateDuties+=duty;inputCost[j]+=duty;
  });
  function finalPurchase(actor,volume,weights,foreignShare,vat=false) {
    let spent=0;
    s.firms.forEach((f,i)=>{
      const value=volume*alpha*(1-foreignShare)*weights[i]*f.price;
      transfer(actor,f,value);revenue[i]+=value;spent+=value;
    });
    const imports=volume*alpha*foreignShare;
    const value=imports*importPrice;
    foreignPayment(s,actor,-value/s.exchangeRate);importNominal+=value;importReal+=imports;spent+=value;
    const duty=value*p.tariff/100;transfer(actor,gov,duty);flow.tariff+=duty;spent+=duty;
    if(vat) {const tax=spent*p.vat/100;transfer(actor,gov,tax);flow.vat+=tax;spent+=tax;}
    return spent;
  }
  let consumptionNominal=0,investmentNominal=0;
  s.households.forEach((h,i)=>{h.consumption=(householdPlans[i]+servicePlans[i].total)*alpha;consumptionNominal+=finalPurchase(h,householdPlans[i],s.base.consumptionWeights,importShareC,true);
    consumptionNominal+=finalPurchase(h,servicePlans[i].total,[0,0,0,0,1],0,false);});
  s.firms.forEach((f,i)=>{
    investmentNominal+=finalPurchase(f,investmentPlans[i],s.base.investmentWeights,.4);
    const actual=investmentPlans[i]*alpha;f.lastInvestment=actual;
    let allocated=0;
    for(const plan of networkPlans[i]){const amount=plan.amount*alpha;allocated+=amount;if(amount>0)s.projects.push({type:'network',...plan,amount,sector:i,due:s.month+Math.round(k.publicInvestmentDelay),efficiency:1,legacy:false});}
    if(actual>allocated) s.projects.push({type:'private',sector:i,amount:actual-allocated,due:s.month+Math.round(k.privateInvestmentDelay),efficiency:1,legacy:false});
  });
  flow.purchases=finalPurchase(gov,gVolume,s.base.governmentWeights,.13);
  flow.healthcare=flow.purchases*p.healthcare/Math.max(purchaseShare,.001);
  flow.education=flow.purchases*p.education/Math.max(purchaseShare,.001);
  flow.childcare=flow.purchases*p.childcareBudget/Math.max(purchaseShare,.001);
  flow.infrastructureMaintenance=flow.purchases*p.infrastructureMaintenance/Math.max(purchaseShare,.001);
  flow.institutionCost=flow.purchases*administrationShare/Math.max(purchaseShare,.001);
  flow.antitrust=flow.purchases*p.antitrustBudget/Math.max(purchaseShare,.001);
  flow.courts=flow.purchases*p.courtBudget/Math.max(purchaseShare,.001);
  flow.soeAudits=flow.purchases*p.soeAuditBudget/Math.max(purchaseShare,.001);
  flow.politicalElections=flow.purchases*p.electionAdministration/Math.max(purchaseShare,.001);
  flow.politicalSecurity=flow.purchases*p.securityBudget/Math.max(purchaseShare,.001);
  flow.politicalPatronage=flow.purchases*p.patronageBudget/Math.max(purchaseShare,.001);
  flow.institutionRequested={antitrust:budgetBase*p.antitrustBudget/100,courts:budgetBase*p.courtBudget/100,soeAudits:budgetBase*p.soeAuditBudget/100};
  fundInstitutionServices(s,flow,gUnit);
  settleServices(s,prev,flow,servicePlans,alpha,servicePrice,gUnit);
  const publicInvestmentVolume=gVolume*alpha*p.publicInvestment/Math.max(purchaseShare,.001);
  if(publicInvestmentVolume>0) s.projects.push({type:'public',amount:publicInvestmentVolume,due:s.month+Math.round(k.publicInvestmentDelay),efficiency:s.institutions.investmentEfficiency,legacy:false});
  s.firms.forEach((f,i)=>{
    const value=exportVolumes[i]*alpha*f.price;
    foreignPayment(s,f,value/s.exchangeRate);revenue[i]+=value;exportNominal+=value;
    f.inventory=Math.max(0,market.ending[i]);
    f.production=production[i];f.utilization=production[i]/Math.max(capacity[i],1e-9);
    f.salesExpected+=.25*(solveLeontief(finalDemand)[i]-f.salesExpected);
  });
  flow.infrastructureFees=sum(servicePlans.map(p=>p.fee))*alpha*servicePrice;
  s.firms.forEach((f,i)=>{f.maintenanceInputs=production[i]*(INPUTS[3][i]*s.firms[3].price+INPUTS[2][i]*s.firms[2].price)*.35;});
  settleInfrastructure(s,flow,{transfer,fundGovernment},events,iUnit);
  const householdIncome=s.households.map((h,i)=>h.depositIncome+h.foreignIncome*s.exchangeRate+transfersPaid*GROUPS[i].transferShare+familyPaid*GROUPS[i].familyShare+remittancesUSD*s.exchangeRate*GROUPS[i].transferShare);
  const householdMarket=s.households.map(h=>h.depositIncome+h.foreignIncome*s.exchangeRate);
  let totalWages=0,foreignDividendsUSD=0;
  s.firms.forEach((f,i)=>{
    const payroll=f.workers*f.wage*(p.normalWorkweek/40)*(1-f.labor.strikeShare);
    totalWages+=payroll;
    const wageShares=laborWageShares(s,f,GROUPS);
    const groupTaxes=GROUPS.map((g,j)=>payroll*wageShares[j]*clamp(p.incomeTax/100+p.incomeTaxProgressivity*.15*Math.log(Math.max(.01,wageShares[j]/g.population)),0,.60)*s.institutions.taxCompliance);
    const taxable=sum(groupTaxes);
    transfer(f,gov,taxable);flow.incomeTax+=taxable;
    GROUPS.forEach((g,j)=>{const value=payroll*wageShares[j]-groupTaxes[j];transfer(f,s.households[j],value);householdIncome[j]+=value;householdMarket[j]+=payroll*wageShares[j];});
    const royalty=i===1&&s.resourceMode?revenue[i]*p.royalty/100:0;
    transfer(f,gov,royalty);flow.royalty+=royalty;
    const depreciation=(f.capital*(-annualToMonthly(-k.annualDepreciation))+(f.infrastructureDepreciation??0))*iUnit;
    const profit=revenue[i]+(f.concessionSupport??0)-inputCost[i]-payroll-f.interestPaid-royalty-depreciation;
    const tax=Math.max(0,profit)*p.corporateTax/100*s.institutions.taxCompliance;
    transfer(f,gov,tax);flow.corporateTax+=tax;
    const excessCash=Math.max(0,f.cash-revenue[i]*2.0-investmentPlans[i]*iUnit*.5);
    const dividend=Math.min(Math.max(0,profit-tax)*k.dividendPayout+excessCash*.05,Math.max(0,f.cash)*.30);
    const foreignShare=f.ownership.foreign;
    const externalDividend=dividend*foreignShare;
    foreignPayment(s,f,-externalDividend/s.exchangeRate);foreignDividendsUSD+=externalDividend/s.exchangeRate;
    const stateDividend=dividend*(f.ownership.state+f.ownership.municipal);transfer(f,gov,stateDividend);flow.stateDividends+=stateDividend;
    GROUPS.forEach((g,j)=>{const value=dividend*(f.domesticOwners[j]+f.workerOwners[j]);transfer(f,s.households[j],value);householdIncome[j]+=value;householdMarket[j]+=value;});
    f.lastProfit=profit-tax;f.lastRevenue=revenue[i];
    if(f.cash<0) {
      const overdraft=-f.cash;grantLoan(s,f,overdraft);creditCreated+=overdraft;f.arrears=overdraft;
      if(overdraft>Math.max(10,revenue[i]*.20)) {
        const loss=writeOff(s,f,.20);creditLosses+=loss;f.defaulted=true;
        f.capital*=.98;f.salesExpected*=.9;
        events.push(`${f.name}: неплатёжеспособность и списание части кредита.`);
      }
    } else {f.arrears=0;f.defaulted=false;}
    f.softBudget+=.05*((f.lastProfit<0&&(f.ownership.state+f.ownership.municipal)>.5&&p.businessSupport>0?1:0)-f.softBudget);
  });
  flow.tax=flow.vat+flow.tariff+flow.incomeTax+flow.corporateTax+flow.royalty;
  const desiredFundSaving=s.resourceMode?flow.royalty*p.stabilizationSaving/100:0;
  const fundSaving=Math.min(desiredFundSaving,Math.max(0,gov.cash)*.30);
  if(fundSaving>0) {foreignPayment(s,gov,-fundSaving/s.exchangeRate);gov.fundUSD+=fundSaving/s.exchangeRate;flow.fundDeposit=fundSaving;}
  if(gov.cash<budgetBase*.15&&gov.fundUSD>0) {
    const withdraw=Math.min(gov.fundUSD,(budgetBase*.15-gov.cash)/s.exchangeRate);
    gov.fundUSD-=withdraw;foreignPayment(s,gov,withdraw);flow.fundWithdrawal=withdraw*s.exchangeRate;
  }
  // Delinquency is a stock; annual entry probabilities are converted to monthly
  // survival probabilities. Charge-offs (LGD) and delinquency are different objects.
  const defaultAnnual=clamp(.02+k.defaultSensitivity*Math.max(0,realInterestRate(b.lendingRate,s.expectedInflation)-.06)
    +Math.max(0,(prev.metrics.unemployment-9)/100)*.15,0,.60);
  const defaultRate=clamp(-Math.expm1(Math.log1p(-defaultAnnual)/12)+Math.max(0,exchangeChange)*.015,0,.08);
  const distressLosses=creditLosses;
  for(const a of borrowers(s)) {
    creditLosses+=writeOff(s,a,defaultRate*.45);
    repayLoan(s,a,Math.min((a.loanLC+a.loanFX*s.exchangeRate)/72,Math.max(0,a.cash-(a.income??a.lastRevenue)*.8)*.04));
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
  const bankOperatingProfit=b.equity-prev.bank.equity-bankFXRevaluation-flow.bankRescue;
  const bankDividend=Math.min(Math.max(0,bankOperatingProfit)*k.dividendPayout,
    Math.max(0,b.equity-Math.max(p.bankCapitalRequirement/100*riskAssets(s)*1.2,k.minimumLeverageRatio*bankAssets(s)*1.2)));
  b.equity-=bankDividend;
  gov.cash+=bankDividend*b.stateOwnership;flow.stateDividends+=bankDividend*b.stateOwnership;
  GROUPS.forEach((g,i)=>{const value=bankDividend*(1-b.stateOwnership)*g.dividendShare;s.households[i].cash+=value;householdIncome[i]+=value;householdMarket[i]+=value;});
  s.households.forEach((h,i)=>{h.income=householdIncome[i];h.marketIncome=householdMarket[i];});
  settleLiquidity(s,flow);
  const goodsInventoryChange=s.firms.map((f,i)=>f.inventory-initialInventories[i]);
  const inventoryNominal=dot(goodsInventoryChange,s.firms.map(f=>f.price));
  const outputNominal=dot(production,s.firms.map(f=>f.price));
  const domesticInputsNominal=sum(INPUTS.map((row,i)=>dot(row,production)*s.firms[i].price));
  const intermediateImportsReal=dot(production,s.firms.map(f=>f.importCoefficient));
  const intermediateImportsNominal=intermediateImportsReal*importPrice;
  const nominalGDP=outputNominal-domesticInputsNominal-intermediateImportsNominal-intermediateDuties+flow.vat+flow.tariff;
  const realGDP=sum(production)-sum(INPUTS.map(row=>dot(row,production)))-intermediateImportsReal
    +ordinaryCVolume*alpha*BASE_POLICY.vat/100;
  const expenditureNominal=consumptionNominal+investmentNominal+flow.purchases+exportNominal-importNominal+inventoryNominal;
  const expenditureReal=cVolume*alpha+iVolume*alpha+gVolume*alpha+sum(exportVolumes)*alpha-importReal+sum(goodsInventoryChange)+ordinaryCVolume*alpha*BASE_POLICY.vat/100;
  const publicCapitalization=flow.interestCapitalized;
  const cashInterest=flow.interest-publicCapitalization;
  const spending=flow.purchases+flow.transfers+flow.familyBenefits+flow.businessSupport+flow.concessionGuarantees+flow.bankRescue+flow.interest+flow.networkPurchases-flow.networkSales;
  const deficit=spending-flow.tax-flow.centralIncome-flow.stateDividends;
  gov.lastDeficit=deficit;
  const currentAccountUSD=(exportNominal-importNominal)/s.exchangeRate+remittancesUSD+foreignInvestmentIncomeUSD-externalCoupons-foreignDividendsUSD-wholesaleCost;
  const bopUSD=currentAccountUSD+inflowUSD-flightUSD+flow.externalIssued-flow.externalRedeemed;
  const employment=sum(s.firms.map(f=>f.workers));
  const unemployment=clamp((1-employment/laborForce)*100,0,100);
  const potentialGDP=dot(capacity,capacity.map((_,i)=>1-colsum(i)-s.firms[i].importCoefficient))+cVolume*BASE_POLICY.vat/100;
  const outputGap=realGDP/Math.max(potentialGDP,1)-1;
  const prevCommodity=(prev.lastReport.world?.commodityPrice??prev.world.commodityPrice);
  const prevEnergy=(prev.lastReport.world?.energyPrice??prev.world.energyPrice);
  const channels=[];
  let priceLogAverage=0;
  s.firms.forEach((f,i)=>{
    const scarcityGap=clamp(requestedProduction[i]/Math.max(capacity[i]+initialInventories[i],1)-1,0,.5);
    const scarcity=scarcityGap-(prev.lastReport.channels?.[i]?.scarcityGap??0);
    // Normal unused capacity is not itself a disinflationary shock.
    const demand=k.demandPriceResponse*(f.utilization-1/1.08);
    const expectedMonthly=Math.log1p(Math.max(-.5,s.expectedInflation))/12;
    // Cost pass-through uses the deviation from the already expected price trend.
    // Adding the full import/wage trend on top of expected inflation double-counts it.
    const imported=k.importPassThrough*f.importCoefficient*(exchangeChange+Math.log1p(.02)/12+logRatio(w.energyPrice,prevEnergy)*.2-expectedMonthly);
    const wages=.10*(wageChanges[i]-expectedMonthly);
    const expectations=(1-k.pricePersistence)*expectedMonthly;
    const inertia=k.pricePersistence*s.inflationLogMonthly;
    const commodity=i===1&&s.resourceMode?.65*(Math.log1p(.02)/12+logRatio(w.commodityPrice,prevCommodity)+exchangeChange-inertia-expectations):0;
    const tariff=p.energyPricing==='regulated'?(i===1?.22:.05)*Math.log(Math.max(.05,p.energyTariff/100)/Math.max(.05,s.firms[1].price)):0;
    const markup=-k.competitionPriceResponse*(s.institutions.competition-prev.institutions.competition);
    const priceChange=clamp(inertia+expectations+demand+imported+wages+k.scarcityPriceResponse*scarcity+commodity+tariff+markup,-.08,.25);
    f.price*=Math.exp(priceChange);priceLogAverage+=s.base.consumptionWeights[i]*priceChange;
    channels.push({sector:f.name,inertia,expectations,demand,imports:imported,wages,scarcityGap,scarcity:k.scarcityPriceResponse*scarcity,commodity,tariff,markup,total:priceChange});
  });
  const newImportPrice=s.exchangeRate*s.worldPriceIndex/100*(.8+.2*w.energyPrice/100);
  const cpi=((1-importShareC)*dot(s.base.consumptionWeights,s.firms.map(f=>f.price))+importShareC*newImportPrice*(1+p.tariff/100))
    *(1+p.vat/100)/(1+BASE_POLICY.vat/100)*100;
  const inflationMonthly=cpi/prev.consumerPriceIndex-1;
  s.consumerPriceIndex=cpi;
  // One-off VAT/duty changes must not become an automatic recurring price shock.
  s.inflationLogMonthly=priceLogAverage;
  const anchorInflation=hasDiscretionaryCB(s)?p.inflationTarget/100:fixedExchange(s)?.02:prev.expectedInflation;
  const confidenceTarget=clamp(.82-.7*Math.abs(monthlyToAnnual(clamp(inflationMonthly,-.2,.3))-anchorInflation)
    -.3*Math.max(0,debtRatio-.6)-.4*b.npl-(unemployment-9)/100*.5-(gov.defaultActive||s.month<gov.excludedUntil?.15:0)-s.institutions.ownershipRisk*.25,.12,.95);
  s.institutions.confidence+=.035*(confidenceTarget-s.institutions.confidence);
  const targetWeight=p.monetaryRegime==='freeBanking'?0:s.institutions.confidence*k.expectationsAnchor;
  const observed=clamp(monthlyToAnnual(clamp(Math.expm1(priceLogAverage),-.2,.3)),-.15,.60);
  const expectationTarget=targetWeight*anchorInflation+(1-targetWeight)*observed;
  s.expectedInflation=clamp(s.expectedInflation+k.expectationAdjustment*(expectationTarget-s.expectedInflation),-.15,1.2);
  const twelveAgo=s.history.find(x=>x.month===s.month-12);
  const rollingNominal=sum(s.history.filter(x=>x.month>=s.month-11).map(x=>x.nominalGDPMonthly))+nominalGDP;
  const debt=domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate;
  const realIncome=sum(householdIncome)/(cpi/100)/(s.population/s.base.initialPopulation)/s.base.referenceIncome*100;
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
    goods:Math.max(...market.ending.map((v,i)=>Math.abs(initialInventories[i]+production[i]-market.intermediate[i]-finalDemand[i]*alpha-v))),
    governmentCash:gov.cash-prev.government.cash-(flow.tax+flow.centralIncome+flow.stateDividends-flow.purchases-flow.transfers-flow.familyBenefits-flow.businessSupport-flow.concessionGuarantees-flow.bankRescue-cashInterest-flow.equityPurchases+flow.equitySales-flow.networkPurchases+flow.networkSales
      +flow.domesticIssued+flow.externalIssued*s.exchangeRate-flow.domesticRedeemed-flow.externalRedeemed*s.exchangeRate+flow.reserveSale+flow.fundWithdrawal-flow.fundDeposit),
    externalNFA:netForeignAssetsUSD(s)-netForeignAssetsUSD(prev)-currentAccountUSD-flow.externalHaircut-flow.externalEquityRevaluation,
    governmentDebt:debt-initialDebt-(flow.domesticIssued+flow.externalIssued*s.exchangeRate-flow.domesticRedeemed-flow.externalRedeemed*s.exchangeRate
      +externalDebtUSD(prev)*(s.exchangeRate-prev.exchangeRate)+flow.interestCapitalized-flow.domesticHaircut-flow.externalHaircut*s.exchangeRate)
  };
  const auditError=Math.max(...Object.values(audits).map(Math.abs));
  const realGDPRolling=sum(s.history.filter(x=>x.month>=s.month-11).map(x=>x.realGDPMonthly))+realGDP;
  const gdpUSDRolling=sum(s.history.filter(x=>x.month>=s.month-11).map(x=>x.nominalGDPMonthly/x.exchangeRate))+nominalGDP/s.exchangeRate;
  s.metrics={...demographicMetrics(s),...institutionMetrics(s),realGDPAnnualized:realGDP*12,realGDPRolling,nominalGDPAnnualized:nominalGDP*12,gdpUSDAnnualized:nominalGDP/s.exchangeRate*12,gdpUSDRolling,realPolicyRate:realPolicy*100,month:s.month,realGDPMonthly:realGDP,nominalGDPMonthly:nominalGDP,nominalGDPAnnual:rollingNominal,
    gdpPerCapitaReal:realGDP*12/s.population,gdpPerCapitaUSD:nominalGDP*12/s.exchangeRate/s.population,
    gdpGrowthYoY:twelveAgo?(realGDP/twelveAgo.realGDPMonthly-1)*100:0,
    inflationYoY:twelveAgo?(cpi/twelveAgo.consumerPriceIndex-1)*100:0,inflationMonthly:inflationMonthly*100,
    coreInflation:(coreIndex/coreOld-1)*100,foodInflation:(s.firms[0].price/priceHistory[0]-1)*100,energyInflation:(s.firms[1].price/priceHistory[1]-1)*100,
    unemployment,realIncomeIndex:realIncome,exchangeRate:s.exchangeRate,outputGap:outputGap*100,
    debtRatio:debt/gdpSafe*100,deficitRatio:deficit*12/gdpSafe*100,
    reservesUSD:gov.reservesUSD,fundUSD:gov.fundUSD,tradeBalance:exportNominal-importNominal,currentAccountUSD,
    lendingRate:b.lendingRate*100,depositRate:b.depositRate*100,capitalRatio:bankCapital(s)*100,npl:b.npl*100,
    credit:privateLoans(s),deposits:deposits(s),consumption:cVolume*alpha,investment:iVolume*alpha,
    governmentPurchases:gVolume*alpha,exports:sum(exportVolumes)*alpha,imports:importReal,inventoryChange:sum(goodsInventoryChange),
    productivity:dot(normalize(s.base.output),s.firms.map(f=>f.productivity))*100,laborForce,employment,
    fulfillment:alpha*100,confidence:s.institutions.confidence*100,informality:s.institutions.informality*100,
    taxRevenue:flow.tax,governmentSpending:spending,interestExpense:flow.interest,privateDebtRatio:privateLoans(s)/gdpSafe*100,
    infrastructure:s.infrastructure/s.initialInfrastructure*100,skills:s.skills*100,bankLiquidity:b.reserves/Math.max(deposits(s),1)*100,
    foreignDebtRatio:externalDebtUSD(s)*s.exchangeRate/gdpSafe*100,realExchangeRate:realExchangeRate*100,migration,
    publicInvestment:publicInvestmentVolume,moneyCreated:creditCreated,creditLosses,reserveMonths:gov.reservesUSD/Math.max(importNominal/s.exchangeRate,1),
    sovereignSpread:flow.sovereignSpread*100,investmentCompleted:completed,auditError,consumerPriceIndex:cpi,
    policyRate:effectiveRate,expectedInflation:s.expectedInflation*100,investmentPrice:iUnit,
    liquidityCoverage:bankLiquidityCoverage(s)*100,leverageRatio:bankLeverage(s)*100,
    debtInDefault:debtInDefault(s),debtArrears:gov.arrears,defaultEpisodes:gov.defaults,defaultActive:gov.defaultActive?1:0,
    refinancingRisk:fundingRisk.annualProbability*100,debtServiceRevenue:fundingRisk.serviceRevenueRatio*100};
  const netPrimaryIncome=(foreignInvestmentIncomeUSD-externalCoupons-foreignDividendsUSD-wholesaleCost)*s.exchangeRate;
  s.metrics.primaryIncomeReal=netPrimaryIncome/(cpi/100);
  s.incomeHistory.push({month:s.month,population:s.population,cpi,net:s.households.map(h=>Math.max(0,h.income-h.interestPaid)),market:s.households.map(h=>Math.max(0,h.marketIncome-h.interestPaid)),synthetic:false});
  s.incomeHistory=s.incomeHistory.slice(-12);
  s.metrics={...s.metrics,...socialIndicators(s,{wages:totalWages,netPrimaryIncome})};
  advancePolitics(s,prev,events,flow,w);
  s.metrics={...s.metrics,...politicsMetrics(s),...laborMetrics(s),...servicesMetrics(s),...infrastructureMetrics(s),...monetaryMetrics(s),energyPriceIndex:s.firms[1].price*100};
  if(fixedExchange(s)&&s.metrics.monetaryReserveCoverage<100)events.push('Фиксированный денежный режим: валютных активов недостаточно для полного покрытия расчётных резервов банков. Ликвидность не восполняется кредитом ЦБ.');
  if(alpha<.95) events.push(`Производственные ограничения: исполнено ${(alpha*100).toFixed(1)}% конечных заказов.`);
  if(b.creditSupply<.5) events.push('Банки ограничивают кредитование из-за капитала, ликвидности или риска.');
  if(gov.reservesUSD<1) events.push('Валютные резервы исчерпаны.');
  if(bankCapital(s)<0) events.push('Банковская система имеет отрицательный капитал.');
  const auditTolerance=Math.max(1e-4,Math.max(Math.abs(bankAssets(s)),Math.abs(nominalGDP),Math.abs(debt))*1e-10);
  if(auditError>auditTolerance) throw new Error(`Нарушен учёт: ${JSON.stringify(audits)}`);
  s.lastReport={events,channels,demography:{births:s.demography.births,deaths:s.demography.deaths,migration:s.demography.netMigration,balance:s.demography.populationResidual},world:w,fiscal:flow,audit:audits,
    market:{production,capacity,finalDemand,inventoryChange:goodsInventoryChange,exports:exportVolumes.map(v=>v*alpha),
      requestedInvestment:iVolume,requestedConsumption:cVolume,fulfillment:alpha},
    external:{exportsUSD:exportNominal/s.exchangeRate,importsUSD:importNominal/s.exchangeRate,remittancesUSD,foreignInvestmentIncomeUSD,inflowUSD,flightUSD,foreignDividendsUSD,currentAccountUSD,bopUSD},
    income:{wages:totalWages,privateInterest,householdIncome},
    gdp:{production:nominalGDP,expenditure:expenditureNominal,consumption:consumptionNominal,investment:investmentNominal,
      government:flow.purchases,exports:exportNominal,imports:importNominal,inventories:inventoryNominal},
    changes:{inflation:s.metrics.inflationYoY-prev.metrics.inflationYoY,growth:s.metrics.gdpGrowthYoY-prev.metrics.gdpGrowthYoY,
      exchange:(s.exchangeRate/prev.exchangeRate-1)*100,unemployment:unemployment-prev.metrics.unemployment,
      gdp:(realGDP/Math.max(prev.metrics.realGDPMonthly,1)-1)*100}};
  s.history.push({...s.metrics,sectorPrices:s.firms.map(f=>f.price),synthetic:false});
  appendJournal(s,prev,actionResults,w);
  return s;
}

export function runMonths(s,count,policy=s.policy) {
  if(!Number.isInteger(count)||count<0||count>600) throw new Error('Горизонт: от 0 до 600 месяцев');
  let result=copy(s);for(let i=0;i<count;i++){if(result.politics.enabled&&!result.politics.executive.inOffice)break;result=advanceMonth(result,i===0||!result.politics.enabled?policy:result.policy);}return result;
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

export function exportSimulation(s) {return JSON.stringify({format:'economy-model',version:VERSION,state:s},null,2);}
export function scheduleRestructuring(s,{haircut=.30,extension=60}={}) {
  if(!Number.isFinite(haircut)||haircut<0||haircut>.7||!Number.isInteger(extension)||extension<12||extension>120)throw new Error('Некорректная реструктуризация');
  if(s.pendingActions.some(a=>a.kind==='restructure'))throw new Error('Обмен долга уже запланирован на следующий месяц. Сначала отмените его.');
  s.pendingActions.push({id:s.nextActionId++,kind:'restructure',haircut,extension,decisionMonth:s.month,effectiveMonth:s.month+1});
}
export function replayJournal(s) {
  const p=s.provenance;
  const politicalOptions=p.politicalOptions?{...p.politicalOptions,instantRules:p.politicalOptions.instantRules??false}:p.politicalOptions;
  let result=createSimulation({resourceMode:p.resourceMode,seed:p.seed,modelProfile:p.modelProfile,policy:p.initialPolicy,parameters:p.initialParameters,world:p.initialWorld,stochastic:p.initialStochastic,politicalMode:p.politicalMode,politicalOptions});
  for(const entry of s.journal){
    result.parameters=copy(entry.parameters);result.world=copy(entry.world);result.shocks=copy(entry.shocks);result.stochastic=entry.stochastic;result.pendingNote=entry.note;
    if(result.politics.enabled){
      for(const command of entry.turnPoliticalCommands??[]){result.politics.nextCommandId=command.id;executePolitical(result,command);}
      result.pendingActions=copy(entry.submittedActions??[]);result.nextActionId=entry.nextActionId??result.nextActionId;result.politics.pendingCommands=copy(entry.politicalCommands??[]);result.politics.nextCommandId=entry.nextCommandId??result.politics.nextCommandId;
    }
    else for(const a of entry.actions)if(a.id){if(a.kind==='restructure')scheduleRestructuring(result,a);else if(a.network)scheduleNetwork(result,a);else scheduleOwnership(result,a);}
    result=advanceMonth(result,entry.requestedPolicy??entry.policy);
  }
  if(result.politics.enabled)for(const command of s.politics.turnCommands??[]){result.politics.nextCommandId=command.id;executePolitical(result,command);}
  return result;
}
export function importSimulation(text) {
  const data=JSON.parse(text);
  if(data.format!=='economy-model') throw new Error('Несовместимый формат сохранения');
  if(data.version!==VERSION||data.state?.version!==VERSION) throw new Error('Несовместимая версия: прошлые эксперименты нельзя продолжить по новым уравнениям 5.0. Старый файл сохраняется для анализа.');
  const s=data.state;
  if(!Number.isInteger(s.month)||s.month<0||s.month>12000||!Array.isArray(s.firms)||s.firms.length!==5||!Array.isArray(s.households)||s.households.length!==10||!Array.isArray(s.history)||s.history.length<13||!Array.isArray(s.journal)||s.journal.length!==s.month||!s.provenance||!Array.isArray(s.pendingActions)) throw new Error('Повреждённое состояние или журнал');
  const check=v=>{
    if(typeof v==='number'&&!Number.isFinite(v)) throw new Error('Сохранение содержит недопустимое число');
    if(v&&typeof v==='object') Object.values(v).forEach(check);
  };check(s);
  validateParameters(s.parameters);
  if(!s.institutions||['antitrustCapacity','courtCapacity','soeAuditCapacity','contractReliability','bankContestability','competition'].some(key=>!Number.isFinite(s.institutions[key])||s.institutions[key]<0||s.institutions[key]>1)||!Number.isFinite(s.base?.initialPublicCapital)||s.base.initialPublicCapital<=0)throw new Error('Повреждены институциональные запасы');
  if(s.history.length!==s.month+13||s.journal.some((entry,i)=>entry.month!==i+1||entry.decisionMonth!==i||entry.version!==VERSION||!entry.policy||!entry.parameters||!entry.outcome)||s.provenance.coverageStartMonth!==0||s.provenance.version!==VERSION)throw new Error('Нарушена последовательность истории решений');
  if(!s.centralBank||['equity','deferredLoss','lastProfit','lastRemittance'].some(key=>!Number.isFinite(s.centralBank[key]))||s.centralBank.deferredLoss<0)throw new Error('Повреждён баланс центрального банка');
  if(!s.demography||['female','male'].some(sex=>!Array.isArray(s.demography[sex])||s.demography[sex].length!==1201||s.demography[sex].some(x=>typeof x!=='number'||x<0))||!Array.isArray(s.demography.pregnancies)||s.demography.pregnancies.length!==s.parameters.pregnancyDelay) throw new Error('Повреждена демография');
  if(Math.abs(sum(cohortTotals(s.demography))-s.population)>1e-7) throw new Error('Нарушен баланс населения');
  for(const f of s.firms)if(!f.ownership||['state','foreign','domestic','municipal','cooperative'].some(key=>!Number.isFinite(f.ownership[key])||f.ownership[key]<0||f.ownership[key]>1)||Math.abs(sum(Object.values(f.ownership))-1)>1e-8||!Array.isArray(f.domesticOwners)||f.domesticOwners.length!==10||f.domesticOwners.some(x=>!Number.isFinite(x)||x<0)||Math.abs(sum(f.domesticOwners)-f.ownership.domestic)>1e-8||!Array.isArray(f.workerOwners)||f.workerOwners.length!==10||f.workerOwners.some(x=>!Number.isFinite(x)||x<0)||Math.abs(sum(f.workerOwners)-f.ownership.cooperative)>1e-8)throw new Error('Нарушен баланс собственности');
  const validatedPolicy=sanitizePolicy(s.policy);
  if(Object.keys(validatedPolicy).some(k=>s.policy[k]!==validatedPolicy[k]))throw new Error('Повреждена политика сохранения');
  validateExtendedState(s);
  validatePoliticalSystem(s);
  s.policy=validatedPolicy;
  const tolerance=Math.max(1e-4,Math.abs(bankAssets(s))*1e-10);
  const centralResidual=s.government.reservesUSD*s.exchangeRate+s.bank.centralBorrowing-s.bank.reserves-s.centralBank.equity;
  if(s.exchangeRate<=0||s.population<=0||s.government.reservesUSD<0||s.government.fundUSD<0||s.government.cash<0||borrowers(s).some(a=>a.cash<0||a.loanLC<0||a.loanFX<0)||Math.abs(bankResidual(s))>tolerance||Math.abs(centralResidual)>tolerance) throw new Error('Нарушены балансы сохранения');
  return copy(s);
}

export function accountBalances(s) {
  return {bankAssets:bankAssets(s),deposits:deposits(s),bankEquity:s.bank.equity,centralBorrowing:s.bank.centralBorrowing,
    bankResidual:bankResidual(s),privateLoans:privateLoans(s),domesticDebt:domesticDebt(s),externalDebtUSD:externalDebtUSD(s),
    totalGovernmentDebt:domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate,
    householdCash:sum(s.households.map(h=>h.cash)),firmCash:sum(s.firms.map(f=>f.cash)),treasuryCash:s.government.cash,
    riskWeightedAssets:riskAssets(s),leverageRatio:bankLeverage(s),liquidityCoverage:bankLiquidityCoverage(s)};
}

import {VERSION,SECTORS,INPUTS,GROUPS,BASE_POLICY,POLICY_FIELDS,PARAMETERS,WORLD} from './config.js';

// Monetary amounts: million units of local currency (LC); foreign stocks: million USD.
// Volumes: million LC at January 2026 basic prices. Population/workers: million people.
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const sum=a=>a.reduce((s,v)=>s+v,0);
export const copy=x=>JSON.parse(JSON.stringify(x));
export const annualToMonthly=r=>Math.expm1(Math.log1p(r)/12);
export const monthlyToAnnual=r=>Math.expm1(Math.log1p(r)*12);
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
function riskAssets(s) {return privateLoans(s)+.2*domesticDebt(s);}
function bankCapital(s) {return s.bank.equity/Math.max(1,riskAssets(s));}
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
  s.government.domesticBonds.push({principal:amount,rate:s.policy.rate/100+flow.sovereignSpread,maturity:s.month+60});
  s.government.cash+=amount; flow.domesticIssued+=amount;
}
function issueExternal(s,amountLC,flow) {
  if(amountLC<=0) return;
  const usd=amountLC/s.exchangeRate;
  s.government.externalBonds.push({principal:usd,rate:s.world.globalRate/100+flow.sovereignSpread,maturity:s.month+84});
  foreignPayment(s,s.government,usd); flow.externalIssued+=usd;
}
function fundGovernment(s,needed,flow) {
  const shortage=Math.max(0,needed-s.government.cash);
  if(!shortage) return;
  const gdpAnnual=Math.max(s.metrics.nominalGDPAnnual,100);
  const debt=domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate;
  const capacity=Math.max(0,s.parameters.maximumPublicDebtRatio*gdpAnnual-debt);
  const amount=Math.min(shortage,capacity);
  const access=clamp(s.institutions.confidence*(1-Math.max(0,debt/gdpAnnual-1)*.8),0,1);
  const foreign=amount*s.policy.foreignBorrowingShare/100*access;
  issueExternal(s,foreign,flow); issueDomestic(s,amount-foreign,flow);
  flow.unfunded+=shortage-amount;
}

export function sanitizePolicy(policy) {
  const p={...BASE_POLICY,...policy};
  for(const [key,,min,max] of POLICY_FIELDS) {
    if(!Number.isFinite(Number(p[key]))) throw new Error(`Некорректный параметр: ${key}`);
    p[key]=clamp(Number(p[key]),min,max);
  }
  p.bankRescue=Boolean(p.bankRescue); p.liquiditySupport=Boolean(p.liquiditySupport);
  return p;
}

export function createSimulation(options={}) {
  const resource=options.resourceMode!==false;
  const p=sanitizePolicy(options.policy);
  const parameters={...PARAMETERS,...options.parameters};
  const consumptionWeights=[.28,.08,.23,.07,.34];
  const investmentWeights=[.01,.08,.31,.55,.05];
  const governmentWeights=[.03,.06,.14,.28,.49];
  const exportWeights=resource?[.10,.64,.16,.00,.10]:[.18,.08,.46,.00,.28];
  const C=3250,I=850,G=900,X=1500;
  const cf=.16,iv=.40,gv=.13;
  const f=zeros().map((_,i)=>C*(1-cf)*consumptionWeights[i]+I*(1-iv)*investmentWeights[i]+G*(1-gv)*governmentWeights[i]+X*exportWeights[i]);
  const q=solveLeontief(f);
  const importCoefficients=[.06,.07,.18,.10,.035];
  const baseGDP=dot(q,q.map((_,i)=>1-colsum(i)-importCoefficients[i]))+C*BASE_POLICY.vat/100;
  const scale=5000/baseGDP;
  const baseOutput=q.map(v=>v*scale);
  const initialWorkers=10*.65*.70*.91;
  const workerShares=resource?[.20,.07,.20,.13,.40]:[.20,.035,.25,.13,.385];
  const householdCash=[1700,6500,24500];
  const hhShares=[.28,.42,.30];
  const s={
    version:VERSION,month:0,startYear:2026,resourceMode:resource,
    seed:Number(options.seed??42)>>>0,stochastic:Boolean(options.stochastic),
    policy:p,parameters,world:{...WORLD,...options.world},shocks:[],
    population:10,ageCohorts:[2.8,6.5,.7],participation:.70,workingAgeShare:.65,exchangeRate:1,
    expectedInflation:.08,inflationLogMonthly:Math.log1p(.08)/12,
    consumerPriceIndex:100,worldPriceIndex:100,skills:1,
    infrastructure:60000*.60,initialInfrastructure:60000*.60,
    institutions:{confidence:.68,informality:.28,taxCompliance:.78,competition:.60,investmentEfficiency:.70},
    base:{monthlyGDP:5000,output:baseOutput,consumption:C*scale,investment:I*scale,government:G*scale,exports:X*scale,
      consumptionWeights,investmentWeights,governmentWeights,exportWeights,consumptionImport:cf,investmentImport:iv,governmentImport:gv,
      initialPopulation:10,referenceIncome:0,initialGroupIncomes:[],initialRate:.03},
    households:GROUPS.map((g,i)=>({...g,cash:householdCash[i],loanLC:[700,3300,4000][i],loanFX:[0,500,1500][i],
      averageRate:.15,foreignSavingsUSD:[0,0,2500][i],income:((C*scale*hhShares[i]/g.mpc)-householdCash[i]*parameters.wealthConsumption),
      consumption:C*scale*hhShares[i],realIncomeIndex:100})),
    firms:SECTORS.map((sector,i)=>({id:sector.id,name:sector.name,price:1,inventory:baseOutput[i]*.15,
      production:baseOutput[i],salesExpected:baseOutput[i],workers:initialWorkers*workerShares[i],
      laborProductivity:baseOutput[i]/(initialWorkers*workerShares[i]),capacity:baseOutput[i]/.90,
      capital:baseOutput[i]/.90*12*1.35,initialCapital:baseOutput[i]/.90*12*1.35,
      productivity:1,wage:2500*workerShares[i]/(initialWorkers*workerShares[i]),
      cash:baseOutput[i]*2.2,loanLC:baseOutput[i]*2.6,loanFX:resource&&i===1?baseOutput[i]*.9:baseOutput[i]*.2,
      averageRate:.14,foreignEquityUSD:baseOutput[i]*.18,importCoefficient:importCoefficients[i],
      lastProfit:baseOutput[i]*.10,lastRevenue:baseOutput[i],lastInvestment:I*scale*workerShares[i],
      defaulted:false,utilization:.90,arrears:0})),
    government:{cash:3000,reservesUSD:8000,fundUSD:resource?2000:0,
      domesticBonds:Array.from({length:60},(_,i)=>({principal:21000/60,rate:.09,maturity:i+1})),
      externalBonds:Array.from({length:84},(_,i)=>({principal:9000/84,rate:.065,maturity:i+1})),
      lastDeficit:0,arrears:0,defaults:0},
    bank:{equity:0,reserves:3500,centralBorrowing:0,foreignAssetsUSD:0,lendingRate:.15,depositRate:.065,npl:.04,creditSupply:1},
    projects:[],history:[],lastReport:{events:[],channels:[],fiscal:{},audit:{}},
    metrics:{nominalGDPAnnual:60000,realGDPMonthly:5000,nominalGDPMonthly:5000}
  };
  s.bank.equity=bankAssets(s)-deposits(s);
  s.base.referenceIncome=sum(s.households.map(h=>h.income));
  s.base.initialGroupIncomes=s.households.map(h=>h.income);
  s.lastReport.world={...WORLD};
  for(let m=1;m<=parameters.privateInvestmentDelay;m++) {
    for(let i=0;i<5;i++) s.projects.push({type:'private',sector:i,amount:s.base.investment*workerShares[i],due:m,efficiency:1,legacy:true});
  }
  for(let m=1;m<=parameters.publicInvestmentDelay;m++) s.projects.push({type:'public',amount:200*scale,due:m,efficiency:s.institutions.investmentEfficiency,legacy:true});
  s.metrics=initialMetrics(s);
  // Explicit synthetic prehistory, solely for rolling indicators at the initial date.
  for(let m=-12;m<=0;m++) s.history.push({...s.metrics,month:m,consumerPriceIndex:100*Math.pow(1.08,m/12),
    realGDPMonthly:5000*Math.pow(1.03,m/12),nominalGDPMonthly:5000*Math.pow(1.11,m/12),synthetic:m<0});
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
    auditError:bankResidual(s),policyRate:s.policy.rate,expectedInflation:s.expectedInflation*100};
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
  const s=copy(state),prev=state;
  s.policy=sanitizePolicy(policy); s.month++;
  const p=s.policy,k=s.parameters,w=effectiveWorld(s);
  const gov=s.government,b=s.bank;
  const events=[];
  const flow={tax:0,vat:0,tariff:0,incomeTax:0,corporateTax:0,royalty:0,
    purchases:0,transfers:0,businessSupport:0,interest:0,bankRescue:0,centralIncome:0,
    domesticIssued:0,externalIssued:0,domesticRedeemed:0,externalRedeemed:0,
    reserveSale:0,fundWithdrawal:0,fundDeposit:0,domesticHaircut:0,externalHaircut:0,
    interestCapitalized:0,unfunded:0,sovereignSpread:0};
  const initialDebt=domesticDebt(prev)+externalDebtUSD(prev)*prev.exchangeRate;
  const debtRatio=initialDebt/Math.max(prev.metrics.nominalGDPAnnual,1);
  flow.sovereignSpread=.025+k.sovereignRiskSensitivity*Math.max(0,debtRatio-.60)+.025*(1-s.institutions.confidence)+.03*Math.max(0,prev.metrics.reserveMonths<3?1-prev.metrics.reserveMonths/3:0);
  const realPolicy=p.rate/100-s.expectedInflation;
  const flowPressure=-(prev.lastReport.external?.bopUSD??prev.metrics.currentAccountUSD)/Math.max(prev.metrics.nominalGDPMonthly/prev.exchangeRate,1);
  const interventionUSD=clamp(p.fxIntervention,-Math.max(0,gov.cash/prev.exchangeRate),gov.reservesUSD);
  const exchangeChange=clamp((s.expectedInflation-.02)/12+k.exchangeFlowSensitivity*flowPressure
    -k.exchangeInterestSensitivity*(realPolicy-(w.globalRate/100-.02))
    +.005*Math.max(0,debtRatio-.8)+.006*(.68-s.institutions.confidence)
    -.14*interventionUSD/Math.max(prev.metrics.nominalGDPMonthly/prev.exchangeRate,1)
    +(s.stochastic?noise(s.seed,s.month,5)*.004:0),-.15,.20);
  s.exchangeRate*=Math.exp(exchangeChange);
  b.equity+=(b.foreignAssetsUSD+sum(borrowers(s).map(a=>a.loanFX)))*(s.exchangeRate-prev.exchangeRate);
  if(interventionUSD!==0) {
    gov.reservesUSD-=interventionUSD; foreignPayment(s,gov,interventionUSD); flow.reserveSale=interventionUSD*s.exchangeRate;
    if(Math.abs(interventionUSD-p.fxIntervention)>1) events.push('Интервенция ограничена доступными резервами или средствами казначейства.');
  }
  s.worldPriceIndex*=1+annualToMonthly(.02);
  const migrationAnnual=clamp((prev.metrics.realIncomeIndex/100-1)*.008-(prev.metrics.unemployment-9)/100*.05,-.012,.012)*p.migrationOpenness/100;
  const migration=s.population*migrationAnnual/12;
  const [young,working,old]=s.ageCohorts;
  const deaths=[young,working,old].map((v,i)=>-v*annualToMonthly(-[.0008,.003,.055][i]));
  const births=s.population*annualToMonthly(k.annualPopulationGrowth)+sum(deaths);
  const entering=young/216,retiring=working/564;
  s.ageCohorts=[young+births-deaths[0]-entering,working+entering-retiring-deaths[1]+migration,old+retiring-deaths[2]];
  s.population=sum(s.ageCohorts);s.workingAgeShare=s.ageCohorts[1]/s.population;
  s.participation=clamp(s.participation+.002*((.70+(prev.metrics.realIncomeIndex/100-1)*.03)-s.participation),.55,.82);
  const laborForce=s.population*s.workingAgeShare*s.participation;
  const informalTarget=clamp(.42-.22*p.taxEnforcement/100+(p.incomeTax+p.corporateTax-32)/100*.12,.08,.50);
  s.institutions.informality+=.015*(informalTarget-s.institutions.informality);
  s.institutions.taxCompliance=clamp(1-s.institutions.informality*(1.15-.35*p.taxEnforcement/100),.4,.99);
  s.institutions.competition+=.02*(p.competition/100-s.institutions.competition);
  s.institutions.investmentEfficiency=clamp(.45+.30*p.taxEnforcement/100+.15*s.institutions.competition,.35,.9);
  s.skills+=k.skillsAdjustment*(1+(p.education-1.5)*.015-s.skills);
  s.infrastructure*=1+annualToMonthly(-k.annualInfrastructureDepreciation);
  let completed=0;
  for(const f of s.firms) f.capital*=1+annualToMonthly(-k.annualDepreciation);
  for(const project of s.projects.filter(x=>x.due<=s.month)) {
    completed+=project.amount*project.efficiency;
    if(project.type==='private') s.firms[project.sector].capital+=project.amount*project.efficiency;
    else s.infrastructure+=project.amount*project.efficiency;
  }
  s.projects=s.projects.filter(x=>x.due>s.month);
  const desiredWorkers=s.firms.map((f,i)=>{
    f.productivity*=1+annualToMonthly(k.annualTechnicalProgress*(.7+.5*s.institutions.competition));
    const prod=f.laborProductivity*f.productivity*s.skills;
    return Math.max(0,f.workers+k.employmentAdjustment*(f.salesExpected/prod-f.workers));
  });
  const laborScale=Math.min(1,laborForce*.985/Math.max(sum(desiredWorkers),.001));
  const wageChanges=zeros();
  const capacity=s.firms.map((f,i)=>{
    f.workers=desiredWorkers[i]*laborScale;
    const employmentTightness=(sum(desiredWorkers)/laborForce-.91);
    const minimumEffect=i===0||i===4?Math.log(p.minimumWage/prev.policy.minimumWage)*.28:Math.log(p.minimumWage/prev.policy.minimumWage)*.10;
    const wageChange=clamp(s.inflationLogMonthly*.9+k.annualTechnicalProgress/12+k.wageAdjustment*(employmentTightness*.04)+minimumEffect,-.02,.06);
    wageChanges[i]=wageChange;f.wage*=Math.exp(wageChange);
    const physical=f.capacity*Math.pow(f.capital/f.initialCapital,k.capitalCapacityElasticity)*f.productivity*s.skills
      *Math.pow(s.infrastructure/s.initialInfrastructure,k.infrastructureElasticity);
    const labor=f.workers*f.laborProductivity*f.productivity*s.skills*1.08;
    const weather=i===0?w.weather/100:1;
    const importedComponents=s.base.output[i]*Math.pow(1.025,s.month/12)*1.12*clamp(w.importAvailability/100,.02,1.2);
    return Math.max(0,Math.min(physical,labor,importedComponents)*weather);
  });
  const loanTarget=p.rate/100+.025+.40*b.npl+.035*(1-s.institutions.confidence);
  b.lendingRate+=k.ratePassThrough*(loanTarget-b.lendingRate);
  b.depositRate+=.25*(Math.max(0,p.rate/100-.035)-b.depositRate);
  const liquidityNeeded=p.reserveRequirement/100*Math.max(0,deposits(s))-b.reserves;
  if(liquidityNeeded>0&&p.liquiditySupport) {b.reserves+=liquidityNeeded;b.centralBorrowing+=liquidityNeeded;}
  const capitalFactor=clamp(bankCapital(s)/(p.bankCapitalRequirement/100),0,1.3);
  const liquidityFactor=clamp(b.reserves/Math.max(1,deposits(s)*p.reserveRequirement/100),0,1);
  b.creditSupply=clamp(capitalFactor*liquidityFactor*(1-b.npl*2),0,1);
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
  const centralInterest=b.centralBorrowing*annualToMonthly(p.rate/100+.01);
  gov.cash+=centralInterest;b.equity-=centralInterest;flow.centralIncome=centralInterest;
  const budgetBase=s.base.monthlyGDP*Math.pow(1.02,s.month/12)*(prev.consumerPriceIndex/100);
  const requestedPurchases=budgetBase*(p.governmentConsumption+p.publicInvestment+p.education)/100;
  const requestedTransfers=budgetBase*p.transfers/100*(.6+.4*(s.ageCohorts[2]/s.population)/.07);
  const requestedSupport=budgetBase*p.businessSupport/100;
  const coupons=sum(gov.domesticBonds.map(x=>yearCoupon(x.principal,x.rate)))+sum(gov.externalBonds.map(x=>yearCoupon(x.principal,x.rate)))*s.exchangeRate;
  const maturities=sum(gov.domesticBonds.filter(x=>x.maturity<=s.month).map(x=>x.principal))+sum(gov.externalBonds.filter(x=>x.maturity<=s.month).map(x=>x.principal))*s.exchangeRate;
  fundGovernment(s,requestedPurchases+requestedTransfers+requestedSupport+coupons+maturities,flow);
  const domesticCoupons=sum(gov.domesticBonds.map(x=>yearCoupon(x.principal,x.rate)));
  const dcPaid=Math.min(Math.max(0,gov.cash),domesticCoupons);
  gov.cash-=dcPaid;b.equity+=dcPaid;flow.interest+=dcPaid;
  if(dcPaid<domesticCoupons) {
    const unpaid=domesticCoupons-dcPaid;
    gov.domesticBonds.push({principal:unpaid,rate:p.rate/100+flow.sovereignSpread,maturity:s.month+12});
    b.equity+=unpaid;flow.interestCapitalized+=unpaid;flow.interest+=unpaid;
  }
  const externalCoupons=sum(gov.externalBonds.map(x=>yearCoupon(x.principal,x.rate)));
  const ecPaid=Math.min(Math.max(0,gov.cash)/s.exchangeRate,externalCoupons);
  foreignPayment(s,gov,-ecPaid);flow.interest+=ecPaid*s.exchangeRate;
  if(ecPaid<externalCoupons) {
    const unpaid=externalCoupons-ecPaid;
    gov.externalBonds.push({principal:unpaid,rate:w.globalRate/100+flow.sovereignSpread,maturity:s.month+12});
    flow.interestCapitalized+=unpaid*s.exchangeRate;flow.interest+=unpaid*s.exchangeRate;
  }
  for(const bond of gov.domesticBonds.filter(x=>x.maturity<=s.month)) {
    const paid=Math.min(Math.max(gov.cash,0),bond.principal);
    gov.cash-=paid;bond.principal-=paid;flow.domesticRedeemed+=paid;
    if(bond.principal>1e-6) {bond.maturity=s.month+12;gov.arrears+=bond.principal;}
  }
  for(const bond of gov.externalBonds.filter(x=>x.maturity<=s.month)) {
    const paid=Math.min(Math.max(gov.cash,0)/s.exchangeRate,bond.principal);
    foreignPayment(s,gov,-paid);bond.principal-=paid;flow.externalRedeemed+=paid;
    if(bond.principal>1e-6) {bond.maturity=s.month+12;gov.arrears+=bond.principal*s.exchangeRate;}
  }
  gov.domesticBonds=gov.domesticBonds.filter(x=>x.principal>1e-8);
  gov.externalBonds=gov.externalBonds.filter(x=>x.principal>1e-8);
  if(flow.unfunded>budgetBase*.5&&debtRatio>k.maximumPublicDebtRatio*.98) {
    const haircut=.08;
    flow.domesticHaircut=domesticDebt(s)*haircut;flow.externalHaircut=externalDebtUSD(s)*haircut;
    for(const bond of gov.domesticBonds) bond.principal*=1-haircut;
    for(const bond of gov.externalBonds) bond.principal*=1-haircut;
    b.equity-=flow.domesticHaircut;gov.defaults++;
    events.push('Долговой кризис: реструктуризация 8% обязательств государства; банки понесли убытки.');
  }
  const transfersPaid=Math.min(Math.max(0,gov.cash),requestedTransfers);
  GROUPS.forEach((g,i)=>transfer(gov,s.households[i],transfersPaid*g.transferShare));flow.transfers=transfersPaid;
  const supportPaid=Math.min(Math.max(0,gov.cash),requestedSupport);
  s.firms.forEach((f,i)=>transfer(gov,f,supportPaid*s.base.output[i]/sum(s.base.output)));flow.businessSupport=supportPaid;
  const gBudget=Math.min(Math.max(0,gov.cash),requestedPurchases);
  if(gBudget<requestedPurchases*.99) events.push('Недостаток финансирования: часть государственных закупок отложена.');
  // External equity inflows and household foreign assets have explicit counterparts.
  const inflowUSD=budgetBase/s.exchangeRate*.008*s.institutions.confidence*(1-p.capitalControls/140);
  s.firms.forEach((f,i)=>{const usd=inflowUSD*s.base.output[i]/sum(s.base.output);foreignPayment(s,f,usd);f.foreignEquityUSD+=usd;});
  const flightUSD=Math.min(Math.max(0,s.households[2].cash)/s.exchangeRate*.015,
    budgetBase/s.exchangeRate*Math.max(0,.003+(s.expectedInflation-p.rate/100)*.08+(1-s.institutions.confidence)*.009)*(1-p.capitalControls/100));
  foreignPayment(s,s.households[2],-flightUSD);s.households[2].foreignSavingsUSD+=flightUSD;
  const remittancesUSD=budgetBase/s.exchangeRate*.01;
  foreignPayment(s,s.households[0],remittancesUSD*.65);foreignPayment(s,s.households[1],remittancesUSD*.35);
  let privateInterest=0;for(const a of borrowers(s)) privateInterest+=a.interestPaid;
  const consumerUnitPrices=s.firms.map(f=>f.price);
  const importPrice=s.exchangeRate*s.worldPriceIndex/100*(.8+.2*w.energyPrice/100);
  const realExchangeRate=s.exchangeRate*s.worldPriceIndex/prev.consumerPriceIndex;
  const importShareC=clamp(s.base.consumptionImport*Math.pow(realExchangeRate,-k.importElasticity),.05,.35);
  const cUnit=(1-importShareC)*dot(s.base.consumptionWeights,consumerUnitPrices)+importShareC*importPrice*(1+p.tariff/100);
  const householdPlans=s.households.map(h=>{
    const sensitive=clamp(Math.exp(-k.interestConsumptionElasticity*(realPolicy-s.base.initialRate)),.6,1.4);
    const desired=Math.max(0,((h.income-h.interestPaid)*h.mpc+h.cash*k.wealthConsumption)*sensitive);
    const maxLoan=Math.max(0,h.income*12*.60-h.loanLC-h.loanFX*s.exchangeRate)*.025*b.creditSupply;
    const loan=Math.min(maxLoan,Math.max(0,desired-h.cash)*.5);
    grantLoan(s,h,loan,0);creditCreated+=loan;
    const smoothed=.22*desired+.78*h.consumption*cUnit*(1+p.vat/100);
    const budget=Math.min(smoothed,Math.max(0,h.cash)*.88);
    return budget/(cUnit*(1+p.vat/100));
  });
  const cVolume=sum(householdPlans);
  const iUnit=.6*dot(s.base.investmentWeights,consumerUnitPrices)+.4*importPrice*(1+p.tariff/100);
  const investmentPlans=s.firms.map((f,i)=>{
    const expectedGrowth=clamp(f.salesExpected/Math.max(prev.firms[i].production,1)-1,-.4,.4);
    const target=s.base.investment*s.base.output[i]/sum(s.base.output)*Math.pow(1.02,s.month/12)
      *clamp(Math.exp(-k.interestInvestmentElasticity*(b.lendingRate-s.expectedInflation-.07)+expectedGrowth*.8),.15,2.5)
      *( .55+.65*s.institutions.confidence);
    const desired=f.lastInvestment+k.investmentAdjustment*(target-f.lastInvestment);
    const buffer=f.production*.20;
    const need=Math.max(0,desired*iUnit+buffer-f.cash);
    const loan=Math.min(need,Math.max(0,f.lastRevenue*12*.75-f.loanLC-f.loanFX*s.exchangeRate)*.04*b.creditSupply);
    grantLoan(s,f,loan,s.resourceMode&&i===1?.25:.08);creditCreated+=loan;
    return Math.max(0,Math.min(desired,(f.cash-buffer)/Math.max(iUnit,1e-9)));
  });
  const iVolume=sum(investmentPlans);
  const gUnit=.87*dot(s.base.governmentWeights,consumerUnitPrices)+.13*importPrice*(1+p.tariff/100);
  const gVolume=gBudget/gUnit;
  const exportVolumes=s.firms.map((f,i)=>{
    const commodityFactor=s.resourceMode&&i===1?1:Math.pow(realExchangeRate,k.exportElasticity);
    const target=s.base.exports*s.base.exportWeights[i]*(w.foreignDemand/100)*Math.pow(1.025,s.month/12)*commodityFactor;
    const old=prev.lastReport.market?.exports?.[i]??s.base.exports*s.base.exportWeights[i];
    return Math.max(0,old+.22*(target-old));
  });
  const domesticC=s.base.consumptionWeights.map(x=>x*cVolume*(1-importShareC));
  const domesticI=s.base.investmentWeights.map(x=>x*iVolume*.6);
  const domesticG=s.base.governmentWeights.map(x=>x*gVolume*.87);
  const finalDemand=zeros().map((_,i)=>domesticC[i]+domesticI[i]+domesticG[i]+exportVolumes[i]);
  const market=constrainedProduction(s,finalDemand,capacity);
  const alpha=market.alpha;
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
  s.households.forEach((h,i)=>{h.consumption=householdPlans[i]*alpha;consumptionNominal+=finalPurchase(h,householdPlans[i],s.base.consumptionWeights,importShareC,true);});
  s.firms.forEach((f,i)=>{
    investmentNominal+=finalPurchase(f,investmentPlans[i],s.base.investmentWeights,.4);
    const actual=investmentPlans[i]*alpha;f.lastInvestment=actual;
    if(actual>0) s.projects.push({type:'private',sector:i,amount:actual,due:s.month+Math.round(k.privateInvestmentDelay),efficiency:1,legacy:false});
  });
  flow.purchases=finalPurchase(gov,gVolume,s.base.governmentWeights,.13);
  const publicInvestmentVolume=gVolume*alpha*p.publicInvestment/Math.max(p.governmentConsumption+p.publicInvestment+p.education,.001);
  if(publicInvestmentVolume>0) s.projects.push({type:'public',amount:publicInvestmentVolume,due:s.month+Math.round(k.publicInvestmentDelay),efficiency:s.institutions.investmentEfficiency,legacy:false});
  s.firms.forEach((f,i)=>{
    const value=exportVolumes[i]*alpha*f.price;
    foreignPayment(s,f,value/s.exchangeRate);revenue[i]+=value;exportNominal+=value;
    f.inventory=Math.max(0,market.ending[i]);
    f.production=production[i];f.utilization=production[i]/Math.max(capacity[i],1e-9);
    f.salesExpected+=.25*(solveLeontief(finalDemand)[i]-f.salesExpected);
  });
  const householdIncome=s.households.map((h,i)=>h.depositIncome+transfersPaid*GROUPS[i].transferShare+remittancesUSD*s.exchangeRate*(i===0?.65:i===1?.35:0));
  let totalWages=0,foreignDividendsUSD=0;
  s.firms.forEach((f,i)=>{
    const payroll=f.workers*f.wage;
    totalWages+=payroll;
    const taxable=payroll*p.incomeTax/100*s.institutions.taxCompliance;
    transfer(f,gov,taxable);flow.incomeTax+=taxable;
    GROUPS.forEach((g,j)=>{const value=(payroll-taxable)*g.wageShare;transfer(f,s.households[j],value);householdIncome[j]+=value;});
    const royalty=i===1&&s.resourceMode?revenue[i]*p.royalty/100:0;
    transfer(f,gov,royalty);flow.royalty+=royalty;
    const depreciation=f.capital*annualToMonthly(k.annualDepreciation);
    const profit=revenue[i]-inputCost[i]-payroll-f.interestPaid-royalty-depreciation;
    const tax=Math.max(0,profit)*p.corporateTax/100*s.institutions.taxCompliance;
    transfer(f,gov,tax);flow.corporateTax+=tax;
    const excessCash=Math.max(0,f.cash-revenue[i]*2.0-investmentPlans[i]*iUnit*.5);
    const dividend=Math.min(Math.max(0,profit-tax)*k.dividendPayout+excessCash*.05,Math.max(0,f.cash)*.30);
    const foreignShare=clamp(f.foreignEquityUSD*s.exchangeRate/Math.max(f.capital,1),0,.5);
    const externalDividend=dividend*foreignShare;
    foreignPayment(s,f,-externalDividend/s.exchangeRate);foreignDividendsUSD+=externalDividend/s.exchangeRate;
    GROUPS.forEach((g,j)=>{const value=(dividend-externalDividend)*g.dividendShare;transfer(f,s.households[j],value);householdIncome[j]+=value;});
    f.lastProfit=profit-tax;f.lastRevenue=revenue[i];
    if(f.cash<0) {
      const overdraft=-f.cash;grantLoan(s,f,overdraft);creditCreated+=overdraft;f.arrears=overdraft;
      if(overdraft>Math.max(10,revenue[i]*.20)) {
        const loss=writeOff(s,f,.20);creditLosses+=loss;f.defaulted=true;
        f.capital*=.98;f.salesExpected*=.9;
        events.push(`${f.name}: неплатёжеспособность и списание части кредита.`);
      }
    } else {f.arrears=0;f.defaulted=false;}
  });
  flow.tax=flow.vat+flow.tariff+flow.incomeTax+flow.corporateTax+flow.royalty;
  const desiredFundSaving=s.resourceMode?flow.royalty*p.stabilizationSaving/100:0;
  const fundSaving=Math.min(desiredFundSaving,Math.max(0,gov.cash)*.30);
  if(fundSaving>0) {foreignPayment(s,gov,-fundSaving/s.exchangeRate);gov.fundUSD+=fundSaving/s.exchangeRate;flow.fundDeposit=fundSaving;}
  if(gov.cash<budgetBase*.15&&gov.fundUSD>0) {
    const withdraw=Math.min(gov.fundUSD,(budgetBase*.15-gov.cash)/s.exchangeRate);
    gov.fundUSD-=withdraw;foreignPayment(s,gov,withdraw);flow.fundWithdrawal=withdraw*s.exchangeRate;
  }
  const defaultRate=clamp(k.defaultSensitivity*Math.max(0,(b.lendingRate-s.expectedInflation-.06))
    +Math.max(0,(prev.metrics.unemployment-9)/100)*.025+Math.max(0,exchangeChange)*.015,0,.04);
  for(const a of borrowers(s)) {
    creditLosses+=writeOff(s,a,defaultRate);
    repayLoan(s,a,Math.min((a.loanLC+a.loanFX*s.exchangeRate)/72,Math.max(0,a.cash-(a.income??a.lastRevenue)*.8)*.04));
  }
  b.npl=clamp(b.npl*.92+defaultRate*.50+creditLosses/Math.max(privateLoans(s),1)*1.5,.005,.8);
  if(bankCapital(s)<p.bankCapitalRequirement/100*.65&&p.bankRescue) {
    const needed=Math.max(0,p.bankCapitalRequirement/100*riskAssets(s)-b.equity);
    fundGovernment(s,needed,flow);
    const bailout=Math.min(needed,Math.max(0,gov.cash));
    gov.cash-=bailout;b.equity+=bailout;flow.bankRescue=bailout;
    if(bailout>1) events.push('Государство пополнило капитал банков; расходы отражены в бюджете.');
  }
  const bankDividend=Math.max(0,b.equity-p.bankCapitalRequirement/100*riskAssets(s)*1.6)*.008;
  b.equity-=bankDividend;s.households[2].cash+=bankDividend;householdIncome[2]+=bankDividend;
  s.households.forEach((h,i)=>{h.income=householdIncome[i];});
  const goodsInventoryChange=s.firms.map((f,i)=>f.inventory-initialInventories[i]);
  const inventoryNominal=dot(goodsInventoryChange,s.firms.map(f=>f.price));
  const outputNominal=dot(production,s.firms.map(f=>f.price));
  const domesticInputsNominal=sum(INPUTS.map((row,i)=>dot(row,production)*s.firms[i].price));
  const intermediateImportsReal=dot(production,s.firms.map(f=>f.importCoefficient));
  const intermediateImportsNominal=intermediateImportsReal*importPrice;
  const nominalGDP=outputNominal-domesticInputsNominal-intermediateImportsNominal-intermediateDuties+flow.vat+flow.tariff;
  const realGDP=sum(production)-sum(INPUTS.map(row=>dot(row,production)))-intermediateImportsReal
    +cVolume*alpha*BASE_POLICY.vat/100;
  const expenditureNominal=consumptionNominal+investmentNominal+flow.purchases+exportNominal-importNominal+inventoryNominal;
  const expenditureReal=cVolume*alpha+iVolume*alpha+gVolume*alpha+sum(exportVolumes)*alpha-importReal+sum(goodsInventoryChange)+cVolume*alpha*BASE_POLICY.vat/100;
  const publicCapitalization=flow.interestCapitalized;
  const cashInterest=flow.interest-publicCapitalization;
  const spending=flow.purchases+flow.transfers+flow.businessSupport+flow.bankRescue+flow.interest;
  const deficit=spending-flow.tax-flow.centralIncome;
  gov.lastDeficit=deficit;
  const currentAccountUSD=(exportNominal-importNominal)/s.exchangeRate+remittancesUSD-externalCoupons-foreignDividendsUSD-wholesaleCost;
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
    const scarcity=Math.max(0,1-alpha);
    // Normal unused capacity is not itself a disinflationary shock.
    const demand=k.demandPriceResponse*(f.utilization-.90);
    const expectedMonthly=Math.log1p(Math.max(-.5,s.expectedInflation))/12;
    // Cost pass-through uses the deviation from the already expected price trend.
    // Adding the full import/wage trend on top of expected inflation double-counts it.
    const imported=k.importPassThrough*f.importCoefficient*(exchangeChange+Math.log1p(.02)/12+logRatio(w.energyPrice,prevEnergy)*.2-expectedMonthly);
    const wages=.10*(wageChanges[i]-expectedMonthly);
    const expectations=(1-k.pricePersistence)*expectedMonthly;
    const inertia=k.pricePersistence*s.inflationLogMonthly;
    const commodity=i===1&&s.resourceMode?.65*(Math.log1p(.02)/12+logRatio(w.commodityPrice,prevCommodity)+exchangeChange-inertia-expectations):0;
    const tariff=i===1?.22*logRatio(p.energyTariff,prev.policy.energyTariff):.05*logRatio(p.energyTariff,prev.policy.energyTariff);
    const markup=-.002*(s.institutions.competition-prev.institutions.competition);
    const priceChange=clamp(inertia+expectations+demand+imported+wages+k.scarcityPriceResponse*scarcity+commodity+tariff+markup,-.08,.25);
    f.price*=Math.exp(priceChange);priceLogAverage+=s.base.consumptionWeights[i]*priceChange;
    channels.push({sector:f.name,inertia,expectations,demand,imports:imported,wages,scarcity:k.scarcityPriceResponse*scarcity,commodity,tariff,markup,total:priceChange});
  });
  const newImportPrice=s.exchangeRate*s.worldPriceIndex/100*(.8+.2*w.energyPrice/100);
  const cpi=((1-importShareC)*dot(s.base.consumptionWeights,s.firms.map(f=>f.price))+importShareC*newImportPrice*(1+p.tariff/100))
    *(1+p.vat/100)/(1+BASE_POLICY.vat/100)*100;
  const inflationMonthly=cpi/prev.consumerPriceIndex-1;
  s.consumerPriceIndex=cpi;
  // One-off VAT/duty changes must not become an automatic recurring price shock.
  s.inflationLogMonthly=priceLogAverage;
  const confidenceTarget=clamp(.82-.7*Math.abs(monthlyToAnnual(clamp(inflationMonthly,-.2,.3))-p.inflationTarget/100)
    -.3*Math.max(0,debtRatio-.6)-.4*b.npl-(unemployment-9)/100*.5-(gov.defaults>0?.15:0),.12,.95);
  s.institutions.confidence+=.035*(confidenceTarget-s.institutions.confidence);
  const targetWeight=s.institutions.confidence*.35;
  const observed=clamp(monthlyToAnnual(clamp(Math.expm1(priceLogAverage),-.2,.3)),-.15,.60);
  const expectationTarget=targetWeight*p.inflationTarget/100+(1-targetWeight)*observed;
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
    bankBalance:bankResidual(s),nominalGDP:nominalGDP-expenditureNominal,realGDP:realGDP-expenditureReal,
    goods:Math.max(...market.ending.map((v,i)=>Math.abs(initialInventories[i]+production[i]-market.intermediate[i]-finalDemand[i]*alpha-v))),
    governmentCash:gov.cash-prev.government.cash-(flow.tax+flow.centralIncome-flow.purchases-flow.transfers-flow.businessSupport-flow.bankRescue-cashInterest
      +flow.domesticIssued+flow.externalIssued*s.exchangeRate-flow.domesticRedeemed-flow.externalRedeemed*s.exchangeRate+flow.reserveSale+flow.fundWithdrawal-flow.fundDeposit),
    externalNFA:netForeignAssetsUSD(s)-netForeignAssetsUSD(prev)-currentAccountUSD-flow.externalHaircut,
    governmentDebt:debt-initialDebt-(flow.domesticIssued+flow.externalIssued*s.exchangeRate-flow.domesticRedeemed-flow.externalRedeemed*s.exchangeRate
      +externalDebtUSD(prev)*(s.exchangeRate-prev.exchangeRate)+flow.interestCapitalized-flow.domesticHaircut-flow.externalHaircut*s.exchangeRate)
  };
  const auditError=Math.max(...Object.values(audits).map(Math.abs));
  s.metrics={month:s.month,realGDPMonthly:realGDP,nominalGDPMonthly:nominalGDP,nominalGDPAnnual:rollingNominal,
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
    policyRate:p.rate,expectedInflation:s.expectedInflation*100};
  if(alpha<.95) events.push(`Производственные ограничения: исполнено ${(alpha*100).toFixed(1)}% конечных заказов.`);
  if(b.creditSupply<.5) events.push('Банки ограничивают кредитование из-за капитала, ликвидности или риска.');
  if(gov.reservesUSD<1) events.push('Валютные резервы исчерпаны.');
  if(bankCapital(s)<0) events.push('Банковская система имеет отрицательный капитал.');
  const auditTolerance=Math.max(1e-4,Math.max(Math.abs(bankAssets(s)),Math.abs(nominalGDP),Math.abs(debt))*1e-10);
  if(auditError>auditTolerance) throw new Error(`Нарушен учёт: ${JSON.stringify(audits)}`);
  s.lastReport={events,channels,world:w,fiscal:flow,audit:audits,
    market:{production,capacity,finalDemand,inventoryChange:goodsInventoryChange,exports:exportVolumes.map(v=>v*alpha),
      requestedInvestment:iVolume,requestedConsumption:cVolume,fulfillment:alpha},
    external:{exportsUSD:exportNominal/s.exchangeRate,importsUSD:importNominal/s.exchangeRate,remittancesUSD,inflowUSD,flightUSD,foreignDividendsUSD,currentAccountUSD,bopUSD},
    income:{wages:totalWages,privateInterest,householdIncome},
    gdp:{production:nominalGDP,expenditure:expenditureNominal,consumption:consumptionNominal,investment:investmentNominal,
      government:flow.purchases,exports:exportNominal,imports:importNominal,inventories:inventoryNominal},
    changes:{inflation:s.metrics.inflationYoY-prev.metrics.inflationYoY,growth:s.metrics.gdpGrowthYoY-prev.metrics.gdpGrowthYoY,
      exchange:(s.exchangeRate/prev.exchangeRate-1)*100,unemployment:unemployment-prev.metrics.unemployment,
      gdp:(realGDP/Math.max(prev.metrics.realGDPMonthly,1)-1)*100}};
  s.history.push({...s.metrics,sectorPrices:s.firms.map(f=>f.price),synthetic:false});
  return s;
}

export function runMonths(s,count,policy=s.policy) {
  if(!Number.isInteger(count)||count<0||count>600) throw new Error('Горизонт: от 0 до 600 месяцев');
  let result=copy(s);for(let i=0;i<count;i++) result=advanceMonth(result,policy);return result;
}

export function comparePolicies(s,policyA,policyB,months=24) {
  return {a:runMonths(s,months,policyA),b:runMonths(s,months,policyB),originMonth:s.month,months};
}

export function exportSimulation(s) {return JSON.stringify({format:'economy-model',version:VERSION,state:s},null,2);}
export function importSimulation(text) {
  const data=JSON.parse(text);
  if(data.format!=='economy-model'||data.version!==VERSION||data.state?.version!==VERSION) throw new Error('Несовместимый формат сохранения');
  const s=data.state;
  if(!Number.isInteger(s.month)||s.month<0||s.month>12000||!Array.isArray(s.firms)||s.firms.length!==5||!Array.isArray(s.households)||s.households.length!==3||!Array.isArray(s.history)||s.history.length<13) throw new Error('Повреждённое состояние');
  const check=v=>{
    if(typeof v==='number'&&!Number.isFinite(v)) throw new Error('Сохранение содержит недопустимое число');
    if(v&&typeof v==='object') Object.values(v).forEach(check);
  };check(s);
  s.policy=sanitizePolicy(s.policy);
  for(const [key,value] of Object.entries(s.parameters)) if(!(key in PARAMETERS)||!Number.isFinite(value)) throw new Error('Некорректные параметры модели');
  if(s.exchangeRate<=0||s.population<=0||s.government.reservesUSD<0||Math.abs(bankResidual(s))>1e-4) throw new Error('Нарушены балансы сохранения');
  return copy(s);
}

export function accountBalances(s) {
  return {bankAssets:bankAssets(s),deposits:deposits(s),bankEquity:s.bank.equity,centralBorrowing:s.bank.centralBorrowing,
    bankResidual:bankResidual(s),privateLoans:privateLoans(s),domesticDebt:domesticDebt(s),externalDebtUSD:externalDebtUSD(s),
    totalGovernmentDebt:domesticDebt(s)+externalDebtUSD(s)*s.exchangeRate,
    householdCash:sum(s.households.map(h=>h.cash)),firmCash:sum(s.firms.map(f=>f.cash)),treasuryCash:s.government.cash};
}

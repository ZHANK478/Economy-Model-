import {territorialCash} from './territorial-government.js';
import {ownersActive,ownerIncomeDistribution} from './wealth-owners.js';
import {sectorCompanies,enterpriseBusinesses} from './enterprise-market.js';
import {socialActive,socialFunds,socialDeposits,revaluePrivateAccounts} from './social-protection.js';
// Research-informed revision 6. Behavioural coefficients below are explicit
// scenario assumptions, not estimated universal causal effects. See docs/FOUNDATION.md.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sum=a=>a.reduce((v,x)=>v+x,0);
const monthly=r=>1-Math.pow(1-r,1/12);
export const foundationActive=s=>(s.economy?.revision??0)>=6;
export const FOUNDATION_ASSUMPTIONS={
 separation:.012,matchingElasticity:.5,matchingEfficiency:.42,
 fatigue:.00035,adoptionSpeed:.28,researchShare:.025,innovationEfficiency:.035,
 trainingMonthsHealth:72,trainingMonthsSchool:48,facilityMonths:240,
 staffAttritionAnnual:.035,facilityWearAnnual:.025,withinGroupDispersion:.38,
 privateRecapitalizationRate:.025,protectedDepositsMonths:6,
 projectEquityShare:.35,projectLeverage:2,networkProjectMonths:24,
 trendUpdateMonths:60,priceCostSpeed:.035,priceDemandSpeed:.012,
 expectationMonths:24,expectationAnchor:.7
};
// Three aggregate business cohorts per sector partition existing capital.
// Relative productivity and allocation responses are scenario assumptions, not
// observed firm data. Reallocation changes aggregate productivity gradually;
// no additional enterprises, physical capital, credit or output are minted.
export function prepareBusinessGroups(s){
 const foundation=s.foundation;
 if(!foundation.businessGroups)foundation.businessGroups=s.firms.map(()=>[
  {kind:'young',capitalShare:.20,relativeProductivity:.86},
  {kind:'established',capitalShare:.45,relativeProductivity:1},
  {kind:'large',capitalShare:.35,relativeProductivity:1.08}
 ]);
 for(const [i,groups] of foundation.businessGroups.entries()){
  if(sectorCompanies(s,i).length)continue;
  const firm=s.firms[i],old=sum(groups.map(g=>g.capitalShare*g.relativeProductivity));
  const profitability=clamp(firm.lastProfit/Math.max(1,firm.lastRevenue),-.5,.5);
  const creditCost=clamp(s.bank.lendingRate-s.expectedInflation,-.05,.4);
  const contestability=clamp(s.institutions.competition,0,1);
  const scores=[clamp(1+profitability*.25-creditCost*.8+contestability*.12,.5,1.5),
                clamp(1+profitability*.15-creditCost*.3,.5,1.5),
                clamp(1+profitability*.10-creditCost*.12+(1-contestability)*.05,.5,1.5)];
  const norm=sum(groups.map((g,j)=>g.capitalShare*scores[j]));
  const step=clamp(firm.lastInvestment/Math.max(firm.capital,1),0,.025);
  groups.forEach((g,j)=>{g.capitalShare=(1-step)*g.capitalShare+step*g.capitalShare*scores[j]/norm;});
  const updated=sum(groups.map(g=>g.capitalShare*g.relativeProductivity));
  firm.productivity*=updated/Math.max(old,1e-9);
 }
}
export function effectiveHours(s){const h=s.policy.normalWorkweek;return h/40*Math.exp(-s.foundation.assumptions.fatigue*Math.max(0,h-40)**2);}
export function initializeFoundation(s,overrides={}){
 if(!foundationActive(s))return;
 const a={...FOUNDATION_ASSUMPTIONS,...overrides};
 s.foundation={revision:1,assumptions:a,technologyFrontier:s.firms.map(f=>f.productivity*(1+Math.max(.05,Math.log(25000/Math.max(500,s.metrics.gdpPerCapitaReal)+1))*.3)),
  trendGrowth:s.economy.macro.trendGrowth,labor:{hires:0,separations:0,vacancies:0,unemployed:0},
  providers:{},bankClaims:s.households.map(h=>Math.max(0,s.bank.equity)*(1-s.bank.stateOwnership)*h.dividendShare),businessBankClaims:Array(8).fill(0),banks:[],resolutions:[],nextBankId:4,taxCapacity:s.policy.taxEnforcement/100,
  householdDistribution:[],last:{privateRecapitalization:0,bailIn:0,bankEntry:0,networkEquity:0,networkCredit:0,research:0},researchStock:0};
 const f=s.foundation;
 // Providers are resource subaccounts of the existing services sector, not
 // additional GDP, employees or money. Opening capacities partition its stock.
 for(const kind of ['health','school']){
  const capacity=kind==='health'?s.services.healthCoverage:s.services.educationCoverage;
  const cost=Math.max(s.base.serviceReference[kind],s.base.monthlyGDP*.005/s.population)*.74,needs=s.population*cost*(kind==='school'?(s.ageCohorts[0]/s.population)/.28:1);
  const publicShare=clamp((kind==='health'?s.services.publicHealthCapacity:s.services.publicEducationCapacity)/Math.max(capacity,.01),0,1);
  f.providers[kind]={needs,referenceNeeds:needs,referenceCost:cost,public:{staff:capacity*publicShare,facilities:capacity*publicShare,pipeline:[],lastOutput:0},private:{staff:Math.max(.03,capacity*(1-publicShare)),facilities:Math.max(.03,capacity*(1-publicShare)),pipeline:[],lastOutput:0}};
 }
 for(const [i,share] of [.45,.35,.20].entries())f.banks.push({id:i+1,share,equity:s.bank.equity*share,loans:0,reserves:0,deposits:0,fxAssets:0,interbank:0,operating:true});
 for(const n of s.networks){n.operator={cash:0,loanLC:0,loanFX:0,averageRate:s.bank.lendingRate,equity:(n.private+n.concession),owners:s.households.map(h=>(n.private+n.concession)*h.dividendShare),receipts:0,lastDebtService:0,defaults:0};n.serviceFactor=1;n.expectedFeeIncome=0;}
 f.referenceServiceWorkers=s.firms[4].workers;
 for(const kind of ['health','school'])for(const owner of ['public','private']){const p=f.providers[kind][owner],delay=kind==='health'?a.trainingMonthsHealth:a.trainingMonthsSchool;for(let due=1;due<=delay;due++)p.pipeline.push({due,amount:p.staff*monthly(a.staffAttritionAnnual)});}
 // Additions to public budget are deliberately zero at launch; no initial shock.
 s.provenance.foundationAssumptions=structuredClone(a);
 s.provenance.foundationRevision=1;
 reconcileBankBooks(s);
}
export function prepareFoundation(s,prev){
 if(!foundationActive(s))return;
 const f=s.foundation,a=f.assumptions;
 if((s.economy?.revision??0)>=11)prepareBusinessGroups(s);
 const researchPaid=prev.lastReport.fiscal?.research??0;
 f.researchStock=f.researchStock*Math.pow(.9,1/12)+researchPaid/Math.max(prev.consumerPriceIndex/100,1e-6);
 const actual=prev.metrics.gdpGrowthYoY/100;
 // Initial historical growth is a prior, gradually replaced by realized data.
 f.trendGrowth+=(clamp(actual,-.03,.07)-f.trendGrowth)/a.trendUpdateMonths;

 f.technologyFrontier=f.technologyFrontier.map(x=>x*Math.pow(1+s.economy.parameters.worldFrontierGrowth,1/12));
 const budget=prev.lastReport.fiscal?.taxAdministration??(s.base.monthlyGDP*(s.policy.taxAdministrationBudget??.1)/100);
 const real=budget/Math.max(prev.consumerPriceIndex/100,1e-6);
 const required=s.base.monthlyGDP*.001*s.population/s.base.initialPopulation;
 const target=clamp(real/Math.max(required,1e-9)*(.5+.25*Number(s.policy.meritCivilService)+.25*Number(s.policy.publicDisclosure)),0,1);
 f.taxCapacity+=(target-f.taxCapacity)/36;
 f.last={privateRecapitalization:0,bailIn:0,bankEntry:0,networkEquity:0,networkCredit:0,research:0};
}
export function matchEmployment(s,desired,laborForce){
 const a=s.foundation.assumptions;
 const survivors=s.firms.map((f,i)=>Math.max(0,Math.min(f.workers*(1-a.separation),desired[i])));
 const existing=sum(survivors),scale=Math.min(1,laborForce/Math.max(existing,1e-12));
 for(let i=0;i<survivors.length;i++)survivors[i]*=scale;
 const unemployed=Math.max(0,laborForce-sum(survivors));
 const vacancies=desired.map((v,i)=>Math.max(0,v-survivors[i]));
 const total=sum(vacancies),skillMatch=clamp(.6+.4*s.education.meanYears/12,.4,1);
 const hires=unemployed>0&&total>0?Math.min(unemployed,total,a.matchingEfficiency*skillMatch*(socialActive(s)&&s.social?clamp(1+s.social.trainedMatch-.05*s.policy.unemploymentReplacement/100*Math.min(1,s.policy.unemploymentDuration/12),.85,1.2):1)*Math.pow(unemployed,a.matchingElasticity)*Math.pow(total,1-a.matchingElasticity)):0;
 const matched=survivors.map((v,i)=>v+hires*vacancies[i]/Math.max(total,1e-12));
 s.foundation.labor={hires,separations:Math.max(0,sum(s.firms.map(f=>f.workers))-sum(survivors)),vacancies:Math.max(0,total-hires),unemployed:Math.max(0,laborForce-sum(matched)),laborForce};
 return matched;
}
export function installTechnology(s,project){
 const a=s.foundation.assumptions,f=s.firms[project.sector];
 const amount=project.amount*project.efficiency;
 const research=project.legacy?0:amount*a.researchShare;
 const ratio=amount/Math.max(f.capital,1);
 const capacity=clamp(s.education.meanYears/12,0,1.5)*clamp(s.institutions.contractReliability/.65,.1,1.5);
 const gap=Math.max(0,Math.log(s.foundation.technologyFrontier[project.sector]/f.productivity));
 const adoption=a.adoptionSpeed*ratio*capacity*gap;
 const publicKnowledge=s.foundation.researchStock/Math.max(s.base.monthlyGDP*12,1);
 const innovation=a.innovationEfficiency*(research/Math.max(f.capital,1)+publicKnowledge*ratio)*capacity;
 f.productivity*=Math.exp(adoption+innovation);
 f.knowledgeCapital+=research;
 return amount-research;
}
// Private subscriptions exchange deposits for bank equity. Both sides are paid;
// legacy shareholders are diluted; deposit losses never counted as GDP/income.
export function revalueBankClaims(s){
 const f=s.foundation,value=Math.max(0,s.bank.equity)*(1-s.bank.stateOwnership),total=sum(f.bankClaims)+sum(f.businessBankClaims)+sum(socialFunds(s).map(x=>x.bankClaim));
 if(total>0){f.bankClaims=f.bankClaims.map(x=>x*value/total);f.businessBankClaims=f.businessBankClaims.map(x=>x*value/total);for(const fund of socialFunds(s))fund.bankClaim*=value/total;revaluePrivateAccounts(s);}
 return value;
}
function subscribeBank(s,needed){
 const total=sum(s.households.map(h=>Math.max(0,h.cash-h.income*3)));
 const raised=Math.min(needed,total*s.foundation.assumptions.privateRecapitalizationRate);
 if(raised<=0)return 0;
 const old=Math.max(0,s.bank.equity),state=old*s.bank.stateOwnership;revalueBankClaims(s);
 for(const [i,h] of s.households.entries()){const paid=raised*Math.max(0,h.cash-h.income*3)/total;h.cash-=paid;s.foundation.bankClaims[i]+=paid;}
 s.bank.equity+=raised;s.bank.stateOwnership=state/(old+raised);
 return raised;
}
export function resolveBanking(s,riskAssets,events){
 if(!foundationActive(s))return;
 const f=s.foundation;reconcileBankBooks(s);
 for(const book of [...f.banks]){
  const required=s.policy.bankCapitalRequirement/100*riskAssets*book.share;
  const before=book.equity;
  if(s.policy.bankEntry&&book.equity<required*1.1){
   const raised=subscribeBank(s,required*1.1-book.equity);book.equity+=raised;f.last.privateRecapitalization+=raised;
  }
  if(book.equity<0){
   const actors=[...s.households,...enterpriseBusinesses(s),...socialFunds(s)];
   const eligible=actors.map((h,i)=>Math.max(0,h.cash-(i<s.households.length?h.income*f.assumptions.protectedDepositsMonths:0))*book.share);
   const pool=sum(eligible),loss=Math.min(-book.equity+required*.5,pool);
   const existingState=Math.max(0,s.bank.equity)*s.bank.stateOwnership,oldPositive=Math.max(0,s.bank.equity);revalueBankClaims(s);
   actors.forEach((h,i)=>{const converted=loss*eligible[i]/Math.max(pool,1e-9);h.cash-=converted;if(i<s.households.length)f.bankClaims[i]+=converted;else if(socialFunds(s).includes(h))h.bankClaim+=converted;else f.businessBankClaims[i-s.households.length]+=converted;});
   s.bank.equity+=loss;book.equity+=loss;f.last.bailIn+=loss;s.bank.stateOwnership=existingState/Math.max(1e-9,oldPositive+loss);
   f.resolutions.push({bank:book.id,month:s.month,recognizedEquity:before,creditorConversion:loss,remainingEquity:book.equity});
   f.resolutions=f.resolutions.slice(-24);
   if(loss>0)events.push('Банк реорганизован: собственники потеряли капитал, часть крупных требований преобразована в капитал.');
  }
  book.operating=book.equity>0;
 }
 // Entry is paid, delayed and conditional on a prospective margin. Existing
 // banks' liabilities are never erased by giving a new institution free assets.
 if(s.policy.bankEntry&&s.month%12===0&&f.banks.length<8&&s.bank.lendingRate-s.bank.depositRate>.015&&s.institutions.contractReliability>.4){
  const raised=subscribeBank(s,s.metrics.nominalGDPAnnual*.001);
  if(raised>0){const share=Math.min(.05,raised/Math.max(1,s.metrics.deposits));for(const b of f.banks)b.share*=1-share;f.banks.push({id:f.nextBankId++,share,equity:raised,loans:0,reserves:0,deposits:0,fxAssets:0,interbank:0,operating:true});f.last.bankEntry=raised;f.last.privateRecapitalization+=raised;}
 }
 reconcileBankBooks(s);
}
export function reconcileBankBooks(s){
 if(!foundationActive(s))return;
 const banks=s.foundation.banks;
 // Persist institution-level equity. Common operating profit is allocated by
 // market share; losses by distinct exposure weights, not reset to one ratio.
 const delta=s.bank.equity-sum(banks.map(b=>b.equity));
 const exposure=banks.map((b,i)=>b.share*(delta<0?[.7,1,1.5][i%3]:1));
 const total=sum(exposure);
 banks.forEach((b,i)=>{b.equity+=delta*exposure[i]/Math.max(total,1e-12);});
 const actors=[...s.households,...enterpriseBusinesses(s)];
 const deposits=sum(actors.map(x=>x.cash))+s.government.cash+territorialCash(s)+socialDeposits(s);
 const loans=sum(actors.map(x=>x.loanLC+x.loanFX*s.exchangeRate));
 const bankBonds=sum(s.government.domesticBonds.map(b=>b.principal-sum(b.householdHoldings??[])));
 banks.forEach(b=>{
  const share=b.share;b.loans=loans*share;b.reserves=s.bank.reserves*share;b.fxAssets=s.bank.foreignAssetsUSD*share;b.deposits=deposits*share;
  b.bonds=bankBonds*share;b.centralBorrowing=s.bank.centralBorrowing*share;b.foreignArrears=(s.bank.foreignArrearsUSD??0)*share;
  b.interbank=b.deposits+b.centralBorrowing+b.foreignArrears*s.exchangeRate+b.equity-b.loans-b.reserves-b.fxAssets*s.exchangeRate-b.bonds;
 });
}
export function institutionalCreditFactor(s,riskAssets){
 reconcileBankBooks(s);
 const ratio=s.policy.bankCapitalRequirement/100;
 return sum(s.foundation.banks.map(b=>b.share*clamp(b.equity/Math.max(1e-9,riskAssets*b.share*ratio),0,1.3)));
}
export function networkFinance(s,investmentPrice,creditSupply,grantLoan){
 if(!foundationActive(s))return [];
 const f=s.foundation,a=f.assumptions,plans=[];
 const ownerPool=sum(s.households.map(h=>Math.max(0,h.cash-h.income*6)));
 const availableEquity=ownerPool*.003;let remaining=availableEquity;
 for(const n of s.networks){
  if(!s.policy.privateInfrastructureEntry&&!s.policy.concessionEntry)continue;
  const o=n.operator;
  if((s.economy?.revision??0)>=13)o.equity=Math.max(0,(n.private+n.concession)*investmentPrice+o.cash-o.loanLC-o.loanFX*s.exchangeRate);
  const existing=n.private+n.concession;
  const publicStock=n.public+n.municipal;
  const utilization=clamp(s.metrics.realGDPMonthly/s.base.monthlyGDP/(s.infrastructure/s.initialInfrastructure),.2,3);
  // Different services have different traffic elasticity and operating costs.
  const commercial={roads:[.13,.9],rail:[.14,.75],grid:[.12,.5]}[n.id];
  const projectedYield=commercial[0]*n.fee*Math.pow(utilization,commercial[1]);
  const observedYield=n.expectedFeeIncome>0&&existing>0?n.expectedFeeIncome*12/(existing*investmentPrice):projectedYield;
  const returnGross=.5*projectedYield+.5*observedYield;
  const returnNet=returnGross-s.parameters.infrastructureMaintenanceRate-s.parameters.annualInfrastructureDepreciation*.25;
  const hurdle=Math.max(s.parameters.infrastructureRequiredReturn,(1+s.bank.lendingRate)/(1+s.expectedInflation)-1)+.06*s.institutions.ownershipRisk;
  n.requiredReturn=hurdle;n.expectedReturn=returnNet;
  n.privateNPV=returnNet/Math.max(.01,hurdle)-1;n.concessionNPV=n.privateNPV-.05;
  const profitable=clamp(n.privateNPV,0,2);
  // Desired expansion responds to demand AND the replacement opportunity.
  const desired=(existing*s.parameters.annualInfrastructureDepreciation*.25/12+Math.max(0,publicStock*.003+existing*.001)*(utilization-.7))*profitable;
  const cost=desired*investmentPrice,own=Math.min(o.cash,cost);
  const equity=Math.min(remaining,Math.max(0,cost-own)*a.projectEquityShare);
  if(equity>0){const subscribingPool=sum(s.households.map(h=>Math.max(0,h.cash-h.income*6)));for(const [i,h] of s.households.entries()){const contribution=equity*Math.max(0,h.cash-h.income*6)/Math.max(subscribingPool,1e-9);h.cash-=contribution;o.owners[i]+=contribution;}o.cash+=equity;o.equity+=equity;remaining-=equity;f.last.networkEquity+=equity;}
  const maxDebt=Math.max(0,o.equity*a.projectLeverage-o.loanLC-o.loanFX*s.exchangeRate);
  const requested=Math.max(0,cost-o.cash);
  const loan=Math.min(requested,maxDebt)*creditSupply;
  if(loan>0)grantLoan(s,o,loan);f.last.networkCredit+=loan;
  const funded=Math.max(0,Math.min(desired,o.cash/Math.max(investmentPrice,1e-9)));
  if(funded>0)plans.push({network:n.id,owner:s.policy.privateInfrastructureEntry?'private':'concession',amount:funded,guarantee:s.policy.concessionGuarantee/100});
 }
 return plans;
}
export function networkReceipts(s,amount,transfer){
 const privateTotal=sum(s.networks.map(n=>n.private+n.concession));
 for(const n of s.networks){
  const receipt=amount*(n.private+n.concession)/Math.max(privateTotal,1e-9);
  transfer(s.firms[4],n.operator,receipt);n.operator.receipts=receipt;
  n.expectedFeeIncome+=(receipt-n.expectedFeeIncome)/24;
 }
}
export function serviceSettlement(s,prev,flow,plans,alpha,price,publicPrice){
 const a=s.foundation.assumptions,services=s.services;
 for(const [kind,paidKey,planKey] of [['health','healthcare','health'],['school','education','education']]){
  const pool=s.foundation.providers[kind];
  const needs=s.population*pool.referenceCost*(kind==='school'?(s.ageCohorts[0]/s.population)/.28:1);
  pool.needs=needs;
  const change=pool.referenceNeeds/Math.max(needs,1e-9);
  const providerOutput={};
  for(const owner of ['public','private']){
   const p=pool[owner],publicOwner=owner==='public';
   const paid=publicOwner?flow[paidKey]/publicPrice:sum(plans.map(x=>x[planKey]))*alpha;
   const financing=paid/Math.max(needs,1e-9),delivery=publicOwner?(s.localGovernment?.lastAllocation?.[paidKey]?.deliveryFactor??1):1;
   // Staff and facilities are suballocations of already purchased sector4 inputs.
   const attrition=monthly(a.staffAttritionAnnual),wear=monthly(a.facilityWearAnnual);
   p.staff*=1-attrition;p.facilities*=1-wear;
   const due=p.pipeline.filter(x=>x.due<=s.month);p.staff+=sum(due.map(x=>x.amount));p.pipeline=p.pipeline.filter(x=>x.due>s.month);
   const training=financing*.045/12;
   p.pipeline.push({due:s.month+(kind==='health'?a.trainingMonthsHealth:a.trainingMonthsSchool),amount:training});
   p.facilities+=financing*.18/72;
   const staffLimit=p.staff*change,facilityLimit=p.facilities*change;
   const resourceShare=clamp(s.firms[4].workers/Math.max(s.foundation.referenceServiceWorkers,1e-9),.1,5);
   const capacity=Math.min(staffLimit,facilityLimit,resourceShare);
   // Current budgets fund operation; capital/training are not simultaneously
   // counted as current service. Common technology across ownership types.
   const funded=financing*.74*delivery;
   const output=Math.max(0,Math.min(capacity,funded));
   p.lastOutput=output;providerOutput[owner]=output;
  }
  const publicAccess=clamp(providerOutput.public,0,1);
  const desired=plans.map((p,i)=>Math.min(Math.max(0,1-publicAccess),p[planKey]*alpha/Math.max(s.population*s.households[i].population*pool.referenceCost*(kind==='school'?(s.ageCohorts[0]/s.population)/.28:1),1e-9)));
  const total=sum(desired.map((x,i)=>x*s.households[i].population));
  const scale=Math.min(1,providerOutput.private/Math.max(total,1e-9));
  const byGroup=desired.map(x=>clamp(publicAccess+x*scale,0,1));
  if(kind==='health'){
   services.publicHealthCapacity=pool.public.facilities*change;services.publicHealthDelivered=publicAccess;services.healthByGroup=byGroup;services.healthCoverage=clamp(sum(byGroup.map((x,i)=>x*s.households[i].population)),0,1);
   services.privateHealth=sum(plans.map(x=>x.health))*alpha*price;
   services.healthFinancialHardship=sum(s.households.map((h,i)=>plans[i].health*alpha*price>Math.max(0,h.income)*.1?h.population:0));
  }else{
   services.publicEducationCapacity=pool.public.facilities*change;services.publicEducationDelivered=publicAccess;services.educationByGroup=byGroup;services.educationCoverage=clamp(sum(byGroup.map((x,i)=>x*s.households[i].population)),0,1);services.privateEducation=sum(plans.map(x=>x.education))*alpha*price;
   services.learningQuality=clamp((pool.public.lastOutput+pool.private.lastOutput)/Math.max(.01,services.educationCoverage),0,1);
  }
 }
}
export function educationTransition(s){
 const e=s.education,access=clamp(s.services.educationCoverage,0,1),quality=s.services.learningQuality??1;
 e.access+=(access-e.access)/36;
 e.expectedYears+=(12*access-e.expectedYears)/60;
 // Cohort replacement, not current adult attainment changing with today's spend.
 const replacement=1/(Math.max(20,s.demography?.lifeExpectancy??65)*12);
 e.meanYears+=(Math.max(0,e.expectedYears*.75)-e.meanYears)*replacement;
 e.learningQuality??=1;e.learningQuality+=(quality-e.learningQuality)/120;
}
export function populationDistribution(s,perPerson,market){
 if(ownersActive(s)&&s.wealthOwners){const points=ownerIncomeDistribution(s,perPerson,market);s.foundation.householdDistribution=points;return points;}
 const a=s.foundation.assumptions,cpi=s.consumerPriceIndex/100,points=[];
 const unemployment=clamp((s.metrics.unemployment??0)/100,0,1);
 // Weighted quadrature inside each reporting decile. Weights, income and wealth
 // preserve group totals. This is a calibrated distribution approximation, not
 // an agent-perfect HANK model or ten identical average people.
 for(let i=0;i<s.households.length;i++){
  const h=s.households[i],u=clamp(unemployment*(1.4-i*.08),0,.95);
  const replacement=socialActive(s)&&s.social?clamp((s.social.last.unemployment?.[i]??0)/Math.max(s.population*h.population*u*(s.metrics.meanWageNominal??1),1e-9),0,.8):clamp(.15+s.policy.transfers/20,0,.8);
  const factors=[.18,.45,.8,1.25,2.32];
  const mean=sum(factors)/factors.length;
  for(const [j,factor] of factors.entries())for(const unemployed of [false,true]){
   const weight=h.population/factors.length*(unemployed?u:1-u);
   const laborFactor=(unemployed?replacement:1)/Math.max(1e-9,1-u+u*replacement);
   const spread=1-a.withinGroupDispersion+a.withinGroupDispersion*factor/mean;
   const wageFraction=clamp(.9-i*.06,.2,.9);
   const incomeFactor=spread*((1-wageFraction)+wageFraction*laborFactor);
   points.push({group:i,subtype:j,unemployed,weight,income:perPerson[i]*incomeFactor,market:market[i]*incomeFactor,equivalent:perPerson[i]*incomeFactor*Math.sqrt(h.householdSize),wealth:(h.cash-h.loanLC-h.loanFX*s.exchangeRate)/(s.population*h.population)*spread});
  }
 }
 s.foundation.householdDistribution=points;
 return points;
}
export function validateFoundation(s){
 if(!foundationActive(s)){if(s.foundation)throw new Error('Несовместимое экономическое ядро');return;}
 const f=s.foundation,positive=x=>Number.isFinite(x)&&x>=0;
 if(f?.businessGroups&&(!Array.isArray(f.businessGroups)||f.businessGroups.length!==s.firms.length||f.businessGroups.some(groups=>!Array.isArray(groups)||groups.length!==3||groups.some(g=>!Number.isFinite(g.capitalShare)||g.capitalShare<0||!Number.isFinite(g.relativeProductivity)||g.relativeProductivity<=0)||Math.abs(sum(groups.map(g=>g.capitalShare))-1)>1e-8)))throw new Error('Повреждены группы предприятий');
 if(f?.revision!==1||!f.assumptions||Object.keys(f.assumptions).length!==Object.keys(FOUNDATION_ASSUMPTIONS).length||Object.entries(f.assumptions).some(([k,v])=>!(k in FOUNDATION_ASSUMPTIONS)||!positive(v)||v>1000)||!Array.isArray(f.banks)||f.banks.length<1||f.banks.length>8)throw new Error('Повреждено экономическое ядро');
 for(const k of ['separation','matchingElasticity','matchingEfficiency','researchShare','staffAttritionAnnual','facilityWearAnnual','withinGroupDispersion','privateRecapitalizationRate','projectEquityShare','expectationAnchor'])if(f.assumptions[k]>1)throw new Error('Некорректная доля ядра');
 if(['trainingMonthsHealth','trainingMonthsSchool','facilityMonths','networkProjectMonths','trendUpdateMonths','expectationMonths'].some(k=>f.assumptions[k]<1))throw new Error('Некорректная задержка ядра');
 if(Math.abs(sum(f.banks.map(b=>b.share))-1)>1e-8)throw new Error('Нарушены доли банков');
 if(!Array.isArray(f.technologyFrontier)||f.technologyFrontier.length!==5||f.technologyFrontier.some(x=>!positive(x)||x===0)||!Number.isFinite(f.trendGrowth)||Math.abs(f.trendGrowth)>.2||!positive(f.researchStock))throw new Error('Повреждена технология');
 for(const kind of ['health','school']){
  const p=f.providers?.[kind];if(!p||!positive(p.referenceNeeds)||p.referenceNeeds===0||!positive(p.referenceCost))throw new Error('Повреждены услуги');
  for(const owner of ['public','private'])if(!positive(p[owner]?.staff)||!positive(p[owner]?.facilities)||!Array.isArray(p[owner]?.pipeline)||p[owner].pipeline.some(x=>!positive(x.amount)||!Number.isInteger(x.due)||x.due<=s.month))throw new Error('Повреждены мощности услуг');
 }
 for(const n of s.networks)if(!n.operator||['cash','loanLC','loanFX','equity','averageRate'].some(k=>!positive(n.operator[k])))throw new Error('Повреждены счета инфраструктуры');
 for(const n of s.networks)if(!Array.isArray(n.operator.owners)||n.operator.owners.length!==10||n.operator.owners.some(x=>!positive(x)))throw new Error('Повреждена собственность операторов');
 if(!Array.isArray(f.bankClaims)||f.bankClaims.length!==10||f.bankClaims.some(x=>!positive(x))||!Array.isArray(f.businessBankClaims)||f.businessBankClaims.length!==enterpriseBusinesses(s).length||f.businessBankClaims.some(x=>!positive(x)))throw new Error('Повреждены доли капитала банков');
 const eq=sum(f.banks.map(b=>b.equity));if(Math.abs(eq-s.bank.equity)>Math.max(1e-5,Math.abs(eq)*1e-9))throw new Error('Нарушен баланс банков');
 for(const b of f.banks)if(['share','loans','reserves','deposits','centralBorrowing','foreignArrears'].some(k=>!positive(b[k]))||['equity','fxAssets','interbank'].some(k=>!Number.isFinite(b[k])))throw new Error('Повреждены банковские книги');
}
// Cash-flow-sensitive sovereign pricing. The old synthetic logistic index is
// retained as a diagnostic only, never interpreted as a measured probability.
export function sovereignPremium(s,risk){
 const debtRatio=(s.metrics.debtRatio??50)/100;
 const service=Math.max(0,risk.serviceRevenueRatio);
 const reserves=Math.max(.25,s.metrics.reserveMonths??5);
 const external=(s.metrics.foreignDebtRatio??15)/100;
 return .005+.015*debtRatio**2+.04*Math.max(0,service-.25)**2+.015*external/reserves+.015*(1-s.institutions.confidence)+(s.government.defaultActive?.04:0);
}
export function distributionConsumptionFactor(s,index){
 const group=s.foundation.householdDistribution.filter(x=>x.group===index);
 if(!group.length)return 1;
 const total=sum(group.map(x=>x.weight)),mean=sum(group.map(x=>x.income*x.weight))/Math.max(total,1e-12);
 // Concave income response and liquidity constraints inside reporting groups.
 return sum(group.map(x=>x.weight*Math.pow(Math.max(0,x.income)/Math.max(mean,1e-9),s.economy.macro.incomeElasticity)))/Math.max(total,1e-12);
}

import {ownerEquityByGroup,ownerWealthPoints} from './wealth-owners.js';
import {corporateDebt,householdCorporateBonds} from './corporate-bonds.js';
import {enterpriseBusinesses,industryCompanies} from './enterprise-market.js';
import {socialActive} from './social-protection.js';
import {foundationActive,educationTransition,populationDistribution,revalueBankClaims} from './economic-foundation.js';
import {localGovernmentActive} from './local-government.js';
import {householdBonds} from './bond-market.js';
import {humanCapital,OPEN_INPUTS} from './open-economy.js';
// Statistical definitions are established; synthetic strata/PPP/education
// behaviour are conditional calibration and must not be reported as observations.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((s,x)=>s+x,0);
export function weightedGini(values,weights) {
  const total=sum(weights),mean=sum(values.map((v,i)=>Math.max(0,v)*weights[i]))/total;
  if(mean<=0)return 0;
  let distance=0;
  for(let i=0;i<values.length;i++)for(let j=0;j<values.length;j++)distance+=weights[i]*weights[j]*Math.abs(Math.max(0,values[i])-Math.max(0,values[j]));
  return distance/(2*total*total*mean);
}
export function weightedQuantile(values,weights,q=.5) {
  const a=values.map((v,i)=>[v,weights[i]]).sort((a,b)=>a[0]-b[0]);
  let cumulative=0;const target=sum(weights)*q;
  for(const [v,w] of a){cumulative+=w;if(cumulative>=target-1e-12)return v;}
  return a.at(-1)?.[0]??0;
}
export function humanDevelopmentIndex(life,meanYears,expectedYears,gniPPP) {
  const health=clamp((life-20)/65,0,1);
  const education=(clamp(meanYears/15,0,1)+clamp(expectedYears/18,0,1))/2;
  const income=clamp((Math.log(Math.max(100,gniPPP))-Math.log(100))/(Math.log(75000)-Math.log(100)),0,1);
  return {hdi:Math.cbrt(health*education*income),hdiHealth:health,hdiEducation:education,hdiIncome:income};
}
export function advanceEducation(s,previousEducationSpending=0) {
  const e=s.education,cpi=s.consumerPriceIndex/100;
  if(foundationActive(s)){educationTransition(s);s.skills=humanCapital(e.meanYears)/humanCapital(8)*(.75+.25*e.learningQuality);return;}
  const pupils=(s.ageCohorts[0]/s.population)/.28;
  const effectiveSpending=previousEducationSpending*(localGovernmentActive(s)?s.localGovernment.lastAllocation?.education.deliveryFactor??1:1);
  const perPupil=effectiveSpending/cpi/Math.max(s.population*pupils,.01);
  const privateAccess=Math.max(0,(s.services?.educationCoverage??1)-(s.services?.publicEducationDelivered??1));
  e.access+=1/36*(clamp(perPupil/(s.economy?.revision>=4?s.base.educationPerPupil/Math.max(.01,s.economy.initial.expectedSchooling/12):7.5)+privateAccess,.15,4)-e.access);
  const target=clamp(12*Math.pow(e.access,s.parameters.educationElasticity),5,18);
  e.expectedYears+=1/60*(target-e.expectedYears);
  // Stock of adult attainment adjusts only as new educated generations enter.
  e.meanYears+=1/360*(clamp(e.expectedYears*.75,0,15)-e.meanYears);
  s.skills=s.economy?humanCapital(e.meanYears)/humanCapital(8):Math.exp(.06*(e.meanYears-8));
}
export function socialIndicators(s,{wages=2500,netPrimaryIncome=0,sectorValueAdded=null}={}) {
  const m=s.metrics,cpi=s.consumerPriceIndex/100;
  const weights=s.households.map(h=>h.population);
  const perPerson=s.households.map((h,i)=>sum(s.incomeHistory.map(r=>Math.max(0,r.net[i])/(r.population*(r.groupPopulation?.[i]??h.population))/(r.cpi/100)))/s.incomeHistory.length*cpi);
  const market=s.households.map((h,i)=>sum(s.incomeHistory.map(r=>Math.max(0,r.market[i])/(r.population*(r.groupPopulation?.[i]??h.population))/(r.cpi/100)))/s.incomeHistory.length*cpi);
  const distribution=foundationActive(s)&&s.foundation?populationDistribution(s,perPerson,market):null;
  const equivalent=perPerson.map((v,i)=>v*Math.sqrt(s.households[i].householdSize));
  const marketEquivalent=market.map((v,i)=>v*Math.sqrt(s.households[i].householdSize));
  const median=distribution?weightedQuantile(distribution.map(x=>x.equivalent),distribution.map(x=>x.weight)):weightedQuantile(equivalent,weights),threshold=median*.5;
  if(foundationActive(s)&&s.foundation)revalueBankClaims(s);
  const businessActors=enterpriseBusinesses(s);
  const businessClaim=actor=>s.foundation?.businessBankClaims?.[businessActors.indexOf(actor)]??0;
  const equity=s.firms.map(f=>Math.max(0,(f.capital+(f.knowledgeCapital??0)+(foundationActive(s)?0:(f.infrastructureCapital??0)))*(m.investmentPrice??cpi)+f.cash+(s.firms.indexOf(f)===2&&industryCompanies(s).length?sum(industryCompanies(s).map(businessClaim)):businessClaim(f))+f.inventory*f.price-f.loanLC-f.loanFX*s.exchangeRate-(s.firms.indexOf(f)===2?corporateDebt(s):0)));
  const operatorClaims=foundationActive(s)&&s.foundation?s.households.map((h,i)=>sum(s.networks.map(n=>Math.max(0,(n.private+n.concession)*(m.investmentPrice??cpi)+n.operator.cash+businessClaim(n.operator)-n.operator.loanLC-n.operator.loanFX*s.exchangeRate)*n.operator.owners[i]/Math.max(sum(n.operator.owners),1e-9)))):s.households.map(()=>0);
  const privateBank=Math.max(0,s.bank.equity)*(1-s.bank.stateOwnership);
  const detailedEquity=ownerEquityByGroup(s);
 const wealth=s.households.map((h,i)=>(socialActive(s)&&s.social?s.social.privateAccounts[i]+(s.social.investmentAccounts?.[i]??0)+(s.social.insuranceFund.cash+s.social.insuranceFund.bankClaim)*h.dividendShare:0)+operatorClaims[i]+h.cash+householdBonds(s,i)+householdCorporateBonds(s,i)+h.foreignSavingsUSD*s.exchangeRate-h.loanLC-h.loanFX*s.exchangeRate+(detailedEquity?.[i]??sum(equity.map((v,j)=>v*(s.firms[j].domesticOwners[i]+s.firms[j].workerOwners[i]))))+(s.foundation?s.foundation.bankClaims[i]:privateBank*h.dividendShare));
  const wealthPerPerson=wealth.map((v,i)=>v/(s.population*weights[i]));
  const detailedWealth=ownerWealthPoints(s,wealth);
  const richest=(detailedWealth?detailedWealth.map(r=>({v:r.amount,per:r.value,weight:r.weight})):wealth.map((v,i)=>({v,per:wealthPerPerson[i],weight:weights[i]}))).sort((a,b)=>b.per-a.per);
  let left=.1,topWealth=0;for(const h of richest){const take=Math.min(left,h.weight);topWealth+=h.v*take/h.weight;left-=take;if(left<=0)break;}
  const richestIncome=(distribution&&(s.economy?.revision??0)>=11?distribution.map(x=>({v:x.income,weight:x.weight})):perPerson.map((v,i)=>({v,weight:weights[i]}))).sort((a,b)=>b.v-a.v);
  left=.1;let topIncome=0;for(const h of richestIncome){const take=Math.min(left,h.weight);topIncome+=h.v*take;left-=take;if(left<=0)break;}
  const historicalPrimary=sum(s.history.filter(r=>r.month>=s.month-11&&r.month<s.month).map(r=>r.primaryIncomeReal??0));
  const gniRealPerCapita=Math.max(0,(m.realGDPRolling+historicalPrimary+netPrimaryIncome/cpi)/s.population);
  const gniPPP=gniRealPerCapita*s.parameters.pppConversionFactor;
  const sectorVA=s.economy?(sectorValueAdded??s.firms.map((f,i)=>f.production*(f.price-sum(OPEN_INPUTS.map((row,j)=>row[i]*s.firms[j].price))-f.importCoefficient*s.exchangeRate*s.worldPriceIndex/100))).map(v=>Math.max(0,v)):s.firms.map((f,i)=>Math.max(0,f.production*(1-[.20,.20,.33,.32,.165][i]-f.importCoefficient)));
  const totalVA=sum(sectorVA);
  const stateOutput=sum(sectorVA.map((v,i)=>v*(s.firms[i].ownership.state+s.firms[i].ownership.municipal)))/Math.max(totalVA,1);
  const incomeTotal=sum(perPerson.map((v,i)=>v*weights[i]));
  return {...humanDevelopmentIndex(m.lifeExpectancy,s.education.meanYears,s.education.expectedYears,gniPPP),
    giniMarket:(distribution?weightedGini(distribution.map(x=>x.market*Math.sqrt(s.households[x.group].householdSize)),distribution.map(x=>x.weight)):weightedGini(marketEquivalent,weights))*100,giniDisposable:(distribution?weightedGini(distribution.map(x=>x.equivalent),distribution.map(x=>x.weight)):weightedGini(equivalent,weights))*100,
    wealthGiniNonnegative:weightedGini(detailedWealth?detailedWealth.map(r=>r.value):wealthPerPerson,detailedWealth?detailedWealth.map(r=>r.weight):weights)*100,
    top10IncomeShare:topIncome/Math.max(incomeTotal,1e-9)*100,top10WealthShare:topWealth/Math.max(sum(wealth),1e-9)*100,
    ...(detailedWealth?{top01WealthShare:topShare(detailedWealth,.001),top1WealthShare:topShare(detailedWealth,.01),maxModeledWealthUSD:Math.max(...detailedWealth.map(r=>r.value))/s.exchangeRate}:{}),
    negativeWealthShare:(detailedWealth?sum(detailedWealth.map(r=>r.amount<0?r.weight:0)):sum(wealth.map((v,i)=>v<0?weights[i]:0)))*100,
    relativePoverty:(distribution?sum(distribution.map(x=>x.equivalent<threshold?x.weight:0)):sum(equivalent.map((v,i)=>v<threshold?weights[i]:0)))*100,
    absolutePoverty:(distribution?sum(distribution.map(x=>x.income/cpi<s.parameters.absolutePovertyRealMonthly?x.weight:0)):sum(perPerson.map((v,i)=>v/cpi<s.parameters.absolutePovertyRealMonthly?weights[i]:0)))*100,
    medianEquivalentIncomeReal:median/cpi,meanDisposableIncomeReal:incomeTotal/cpi,
    meanWageNominal:wages/Math.max(m.employment,.01),meanWageUSD:wages/Math.max(m.employment,.01)/s.exchangeRate,
    meanWageReal:wages/Math.max(m.employment,.01)/cpi,
    meanSchooling:s.education.meanYears,expectedSchooling:s.education.expectedYears,gniPPP,
    stateAssetShare:sum(equity.map((v,i)=>v*(s.firms[i].ownership.state+s.firms[i].ownership.municipal)))/Math.max(sum(equity),1)*100,
    foreignAssetShare:sum(equity.map((v,i)=>v*s.firms[i].ownership.foreign))/Math.max(sum(equity),1)*100,
    stateOutputShare:stateOutput*100,householdNetWealth:sum(wealth)};
}

function topShare(points,fraction){let left=fraction,value=0;for(const r of [...points].sort((a,b)=>b.value-a.value)){const take=Math.min(left,r.weight);value+=r.amount*take/r.weight;left-=take;if(left<=0)break;}return value/Math.max(sum(points.map(r=>r.amount)),1e-9)*100;}

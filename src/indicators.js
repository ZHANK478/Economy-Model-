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
  const pupils=(s.ageCohorts[0]/s.population)/.28;
  const perPupil=previousEducationSpending/cpi/Math.max(s.population*pupils,.01);
  e.access+=1/36*(clamp(perPupil/7.5,.15,4)-e.access);
  const target=clamp(12*Math.pow(e.access,s.parameters.educationElasticity),5,18);
  e.expectedYears+=1/60*(target-e.expectedYears);
  // Stock of adult attainment adjusts only as new educated generations enter.
  e.meanYears+=1/360*(clamp(e.expectedYears*.75,0,15)-e.meanYears);
  s.skills=Math.exp(.06*(e.meanYears-8));
}
export function socialIndicators(s,{wages=2500,netPrimaryIncome=0}={}) {
  const m=s.metrics,cpi=s.consumerPriceIndex/100;
  const weights=s.households.map(h=>h.population);
  const perPerson=s.households.map((h,i)=>sum(s.incomeHistory.map(r=>Math.max(0,r.net[i])/(r.population*h.population)/(r.cpi/100)))/s.incomeHistory.length*cpi);
  const market=s.households.map((h,i)=>sum(s.incomeHistory.map(r=>Math.max(0,r.market[i])/(r.population*h.population)/(r.cpi/100)))/s.incomeHistory.length*cpi);
  const equivalent=perPerson.map((v,i)=>v*Math.sqrt(s.households[i].householdSize));
  const marketEquivalent=market.map((v,i)=>v*Math.sqrt(s.households[i].householdSize));
  const median=weightedQuantile(equivalent,weights),threshold=median*.5;
  const equity=s.firms.map(f=>Math.max(0,f.capital*(m.investmentPrice??cpi)+f.cash+f.inventory*f.price-f.loanLC-f.loanFX*s.exchangeRate));
  const privateBank=Math.max(0,s.bank.equity)*(1-s.bank.stateOwnership);
  const wealth=s.households.map((h,i)=>h.cash+h.foreignSavingsUSD*s.exchangeRate-h.loanLC-h.loanFX*s.exchangeRate+sum(equity.map((v,j)=>v*s.firms[j].domesticOwners[i]))+privateBank*h.dividendShare);
  const wealthPerPerson=wealth.map((v,i)=>v/(s.population*weights[i]));
  const richest=wealth.map((v,i)=>({v,per:wealthPerPerson[i],weight:weights[i]})).sort((a,b)=>b.per-a.per);
  let left=.1,topWealth=0;for(const h of richest){const take=Math.min(left,h.weight);topWealth+=h.v*take/h.weight;left-=take;if(left<=0)break;}
  const richestIncome=perPerson.map((v,i)=>({v,weight:weights[i]})).sort((a,b)=>b.v-a.v);
  left=.1;let topIncome=0;for(const h of richestIncome){const take=Math.min(left,h.weight);topIncome+=h.v*take;left-=take;if(left<=0)break;}
  const historicalPrimary=sum(s.history.filter(r=>r.month>=s.month-11&&r.month<s.month).map(r=>r.primaryIncomeReal??0));
  const gniRealPerCapita=Math.max(0,(m.realGDPRolling+historicalPrimary+netPrimaryIncome/cpi)/s.population);
  const gniPPP=gniRealPerCapita*s.parameters.pppConversionFactor;
  const sectorVA=s.firms.map((f,i)=>Math.max(0,f.production*(1-[.20,.20,.33,.32,.165][i]-f.importCoefficient)));
  const totalVA=sum(sectorVA);
  const stateOutput=sum(sectorVA.map((v,i)=>v*s.firms[i].ownership.state))/Math.max(totalVA,1);
  const incomeTotal=sum(perPerson.map((v,i)=>v*weights[i]));
  return {...humanDevelopmentIndex(m.lifeExpectancy,s.education.meanYears,s.education.expectedYears,gniPPP),
    giniMarket:weightedGini(marketEquivalent,weights)*100,giniDisposable:weightedGini(equivalent,weights)*100,
    wealthGiniNonnegative:weightedGini(wealthPerPerson,weights)*100,
    top10IncomeShare:topIncome/Math.max(incomeTotal,1e-9)*100,top10WealthShare:topWealth/Math.max(sum(wealth),1e-9)*100,
    negativeWealthShare:sum(wealth.map((v,i)=>v<0?weights[i]:0))*100,
    relativePoverty:sum(equivalent.map((v,i)=>v<threshold?weights[i]:0))*100,
    absolutePoverty:sum(perPerson.map((v,i)=>v/cpi<s.parameters.absolutePovertyRealMonthly?weights[i]:0))*100,
    medianEquivalentIncomeReal:median/cpi,meanDisposableIncomeReal:incomeTotal/cpi,
    meanWageNominal:wages/Math.max(m.employment,.01),meanWageUSD:wages/Math.max(m.employment,.01)/s.exchangeRate,
    meanWageReal:wages/Math.max(m.employment,.01)/cpi,
    meanSchooling:s.education.meanYears,expectedSchooling:s.education.expectedYears,gniPPP,
    stateAssetShare:sum(equity.map((v,i)=>v*s.firms[i].ownership.state))/Math.max(sum(equity),1)*100,
    foreignAssetShare:sum(equity.map((v,i)=>v*s.firms[i].ownership.foreign))/Math.max(sum(equity),1)*100,
    stateOutputShare:stateOutput*100,householdNetWealth:sum(wealth)};
}

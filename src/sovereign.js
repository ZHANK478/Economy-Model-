import {nonbankDebt} from './bond-market.js';
const sum=a=>a.reduce((s,x)=>s+x,0);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function refinancingRisk(s) {
  const g=s.government,e=s.exchangeRate;
  const debt=sum(g.domesticBonds.map(b=>b.principal))+sum(g.externalBonds.map(b=>b.principal))*e;
  const annualGDP=Math.max(s.metrics.nominalGDPAnnual,1);
  const service=sum(g.domesticBonds.map(b=>b.principal*b.rate/12+(b.maturity<=s.month+12?b.principal/12:0)))
    +sum(g.externalBonds.map(b=>b.principal*b.rate/12+(b.maturity<=s.month+12?b.principal/12:0)))*e;
  const revenue=Math.max(s.metrics.taxRevenue??0,annualGDP*.15/12);
  const z=s.parameters.refinancingRiskIntercept+s.parameters.refinancingDebtCoefficient*debt/annualGDP
    +s.parameters.refinancingServiceCoefficient*service/revenue+.8*(debt>0?sum(g.externalBonds.map(b=>b.principal))*e/debt:0)
    -.08*Math.min(s.metrics.reserveMonths??6,12)-.04*(s.metrics.gdpGrowthYoY??0);
  const annualProbability=1/(1+Math.exp(-clamp(z,-20,20)));
  return {annualProbability,monthlyProbability:1-Math.pow(1-annualProbability,1/12),serviceRevenueRatio:service/revenue};
}
export function openDefaultEpisode(s,type,events) {
  const g=s.government;
  if(!g.defaultActive){
    g.defaultActive=true;g.defaultStart=s.month;
    // Renewed arrears within the market-exclusion window are the same unresolved
    // crisis episode, not dozens of statistically separate defaults.
    if(g.defaultEpisodes.length&&s.month<g.excludedUntil)g.defaultEpisodes.at(-1).end=null;
    else {g.defaults++;g.defaultEpisodes.push({start:s.month,type,end:null,faceLossLC:0,npvLossLC:0,restructurings:0});}
    events.push('Суверенный дефолт: пропущен платёж по долгу или проведён вынужденный обмен.');
  }
}
export function debtInDefault(s) {
  return sum(s.government.domesticBonds.filter(b=>b.inDefault).map(b=>b.principal))+sum(s.government.externalBonds.filter(b=>b.inDefault).map(b=>b.principal))*s.exchangeRate;
}
export function restructureDebt(s,flow,events,{haircut=.30,extension=60,voluntary=false}={}) {
  haircut=clamp(haircut,0,.70);extension=Math.max(12,Math.min(120,Math.round(extension)));
  if(!s.government.domesticBonds.length&&!s.government.externalBonds.length)return null;
  const g=s.government,oldDomestic=sum(g.domesticBonds.map(b=>b.principal)),oldForeign=sum(g.externalBonds.map(b=>b.principal));
  const nonbank=nonbankDebt(s);
  const alreadyInDefault=g.defaultActive;
  let oldPV=0,newPV=0;
  for(const [bonds,fx] of [[g.domesticBonds,1],[g.externalBonds,s.exchangeRate]])for(const b of bonds){
    const months=Math.max(1,b.maturity-s.month),discount=Math.max(.01,b.rate+(flow.sovereignSpread??.025));
    const pv=(principal,coupon,n)=>{const r=Math.pow(1+discount,1/12)-1;return principal*coupon/12*(1-Math.pow(1+r,-n))/r+principal*Math.pow(1+r,-n);};
    oldPV+=pv(b.principal,b.rate,months)*fx;
    if(b.householdHoldings)b.householdHoldings=b.householdHoldings.map(v=>v*(1-haircut));
    b.principal*=1-haircut;b.maturity=s.month+extension;b.inDefault=false;b.overdue=0;
    newPV+=pv(b.principal,b.rate,extension)*fx;
  }
  flow.domesticHaircut+=oldDomestic*haircut;flow.externalHaircut+=oldForeign*haircut;
  s.bank.equity-=(oldDomestic-nonbank)*haircut;
  if(voluntary&&!alreadyInDefault&&oldPV-newPV<=1e-6){events.push('Обмен долга без ухудшения приведённой стоимости: не считается дефолтом.');return {kind:'refinance',haircut,extension,faceLossLC:0,npvLossLC:0,effectiveMonth:s.month};}
  openDefaultEpisode(s,voluntary?'distressed-exchange':'payment-default',events);
  g.arrears=0;g.defaultActive=false;g.excludedUntil=s.month+s.parameters.marketExclusionMonths;
  const episode=g.defaultEpisodes.at(-1);episode.end=s.month;episode.restructurings++;episode.faceLossLC+=oldDomestic*haircut+oldForeign*haircut*s.exchangeRate;episode.npvLossLC+=Math.max(0,oldPV-newPV);
  events.push(`Реструктуризация: списано ${(haircut*100).toFixed(0)}% номинала, новые сроки ${extension} месяцев. Потери банков отражены в капитале.`);
  return {kind:'restructure',haircut,extension,faceLossLC:oldDomestic*haircut+oldForeign*haircut*s.exchangeRate,npvLossLC:Math.max(0,oldPV-newPV),effectiveMonth:s.month};
}

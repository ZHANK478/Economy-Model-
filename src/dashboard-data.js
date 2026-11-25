import {GROUPS} from './config.js';
import {laborWageShares} from './labor.js';
// Fiscal balance is revenue minus expenditure, including interest; borrowing is financing.
export const budgetBalance=m=>Number.isFinite(m?.deficitRatio)&&Number.isFinite(m?.nominalGDPAnnual)?-m.deficitRatio*Math.max(m.nominalGDPAnnual,100)/1200:null;
// Read-only reporting: completed months use settled payroll and actual wage tax.
// Month zero has no settlement yet, so apply the opening payroll tax schedule.
export function wageBreakdown(s){
 let gross=s.lastReport?.income?.wages,tax=Number.isFinite(s.lastReport?.fiscal?.incomeTax)?s.lastReport.fiscal.incomeTax+(s.lastReport.fiscal.socialContributions??0):undefined;
 const estimated=s.month===0;
 if(estimated){
  gross=0;tax=0;
  for(const f of s.firms){
   const payroll=f.workers*f.wage;gross+=payroll;
   const shares=laborWageShares(s,f,GROUPS);
   tax+=shares.reduce((total,share,i)=>total+payroll*share*Math.max(0,Math.min(.60,s.policy.incomeTax/100+s.policy.incomeTaxProgressivity*.15*Math.log(Math.max(.01,share/GROUPS[i].population))))*s.institutions.taxCompliance,0);
   if((s.economy?.revision??0)>=9)tax+=payroll*s.policy.pensionContribution/100*s.institutions.taxCompliance;
  }
 }
 if(s.economy?.revision>=24&&s.month>0){gross=s.lastReport.income.employeeWages;tax=gross-s.lastReport.income.employeeNetWages;}
 const employed=s.metrics.wageEmployment??s.metrics.employment;
 if(!Number.isFinite(gross)||!Number.isFinite(tax)||!(employed>0)||!(gross>0))return {gross:null,net:null,taxRate:null,estimated};
 return {gross:gross/employed,net:(gross-tax)/employed,taxRate:tax/gross*100,estimated};
}
export const METRIC_INFO={
 gdpGrowthYoY:{label:'Рост экономики',unit:'% за 12 месяцев',digits:1},
 gdpPerCapitaRolling:{label:'ВВП на человека',unit:'$ в ценах начала игры / год',digits:0},
 budgetBalance:{label:'Чистый баланс бюджета',unit:'млн нац. валюты / месяц',digits:0},
 gdpPerCapitaReal:{label:'Реальный ВВП на человека',unit:'$ базы / годовой темп',digits:0},
 realGDPAnnualized:{label:'Общий реальный ВВП',unit:'млн $ базы / годовой темп',digits:0},
 realGDPRolling:{label:'Общий ВВП',unit:'млн $ в ценах начала игры / последние 12 месяцев',digits:0},
 gdpUSDRolling:{label:'Номинальный ВВП за 12 месяцев',unit:'млн $',digits:0},
 inflationYoY:{label:'Инфляция за 12 месяцев',unit:'%',digits:1},unemployment:{label:'Безработица',unit:'%',digits:1},
 population:{label:'Население',unit:'млн человек',digits:3},realIncomeIndex:{label:'Реальные доходы',unit:'индекс, начало = 100',digits:1},
 executiveApproval:{label:'Одобрение исполнительной власти',unit:'%',digits:1},presidentApproval:{label:'Одобрение президента',unit:'%',digits:1},
 cabinetApproval:{label:'Одобрение правительства',unit:'%',digits:1},governmentPartyRating:{label:'Ваша партия в опросах',unit:'%',digits:1},
 presidentialCandidateRating:{label:'Рейтинг президента',unit:'% голосов',digits:1},presidentialVoteShare:{label:'Рейтинг президента',unit:'% голосов',digits:1},debtRatio:{label:'Государственный долг',unit:'% ВВП',digits:1},
 giniDisposable:{label:'Джини после перераспределения',unit:'0–100',digits:1},giniMarket:{label:'Джини до перераспределения',unit:'0–100',digits:1},
 hdi:{label:'ИЧР',unit:'0–1',digits:3},meanWageReal:{label:'Средняя реальная зарплата',unit:'$ базы / месяц',digits:0},
 meanWageNominal:{label:'Средняя зарплата до налогов',unit:'нац. валюта / месяц',digits:0},lifeExpectancy:{label:'Продолжительность жизни',unit:'лет',digits:1},
 totalFertilityRate:{label:'Рождаемость',unit:'детей / женщину',digits:2},reservesUSD:{label:'Валютные резервы',unit:'млн $',digits:0},
 exchangeRate:{label:'Курс валюты',unit:'нац. валюта / $',digits:3}
};
// Both visible GDP figures use the same rolling year and constant-price basis.
export function comparableGDP(s,metric=s.metrics,window=null){
 const year=window??s.history.filter(h=>h.month>metric.month-12&&h.month<=metric.month&&Number.isFinite(h.population));
 const population=year.length?year.reduce((a,h)=>a+h.population,0)/year.length:s.population;
 return {total:metric.realGDPRolling,perCapita:metric.realGDPRolling/Math.max(population,1e-9)};
}
// Index chronological windows once per graph; retain the original summation order.
// Non-chronological imported histories use the original general filter path.
function populationWindows(history){
 if(!history.every((h,i)=>i===0||h.month>=history[i-1].month))return null;
 const upperBound=month=>{let lo=0,hi=history.length;while(lo<hi){const mid=(lo+hi)>>>1;if(history[mid].month<=month)lo=mid+1;else hi=mid;}return lo;};
 return month=>history.slice(upperBound(month-12),upperBound(month)).filter(h=>Number.isFinite(h.population));
}
export function metricSeries(s,key){const window=key==='gdpPerCapitaRolling'?populationWindows(s.history):null;return s.history.filter(m=>m.month>=0&&(key!=='budgetBalance'||m.month>0)).map(m=>({...m,budgetBalance:budgetBalance(m),...(key==='gdpPerCapitaRolling'?{gdpPerCapitaRolling:comparableGDP(s,m,window?.(m.month)).perCapita}:{}),...(s.politics?.accountabilityRevision===1&&m.month===s.month&&['presidentialVoteShare','governmentPartyRating','presidentialCandidateRating'].includes(key)?{[key]:s.metrics[key]}:{})})).filter(m=>Number.isFinite(m[key]));}
export function currentMetric(s,key){if(key==='budgetBalance')return s.month>0?-s.government.lastDeficit:null;if(key==='gdpPerCapitaRolling')return comparableGDP(s).perCapita;return s.metrics[key];}
export const GROUP_DIMENSIONS={age:'Возраст',income:'Доход',region:'Регион',origin:'Происхождение',occupation:'Занятие'};
export function electorateSeries(s,dimension,measure,partyId){
 const rows=s.politics.poll?.groups?.filter(g=>g.dimension===dimension)??[];
 return rows.map(g=>({id:g.id,name:g.label,points:s.politics.partyHistory.flatMap(h=>{const row=h.groups?.find(x=>x.dimension===dimension&&x.id===g.id);const value=measure==='party'?row?.parties[partyId]:measure==='candidate'?row?.candidates[partyId]:measure==='presidentApproval'?row?.presidentApproval:row?.approval;return Number.isFinite(value)?[{month:h.month,value}]:[];})}));
}

// Exact previous completed month; absent observations are never replaced by zero.
export function monthlyMetricChange(s,key){
 if(s.month===0)return null;
 const previous=s.history.find(m=>m.month===s.month-1);
 if(!previous||(key==='budgetBalance'&&previous.month===0))return null;
 const before=key==='budgetBalance'?budgetBalance(previous):key==='gdpPerCapitaRolling'?comparableGDP(s,previous).perCapita:previous[key];
 const now=currentMetric(s,key);
 return Number.isFinite(before)&&Number.isFinite(now)?now-before:null;
}

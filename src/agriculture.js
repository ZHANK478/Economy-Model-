import {priceAt,basketPrice} from './goods-prices.js';
// Reduced-form adaptation, not a crop/water simulator. Assumptions: docs/AGRICULTURE.md.
import {hash} from './political-config.js';
import {worldEvent} from './world-events.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const agricultureActive=s=>(s.economy?.revision??0)>=12;
export function agricultureForecast(s){
 if(!s.politics?.livingWorld||s.month>=s.politics.historicalWorldStart)return null;
 const anchor=s.politics.livingWorldStart??0,block=Math.floor((s.month-anchor)/30);
 for(const b of [block,block+1]){
  const start=anchor+b*30+5+Math.floor(hash(s.seed,'world-start',b)*12);
  if(start-s.month<1||start-s.month>3||start>=s.politics.historicalWorldStart)continue;
  const event=worldEvent({...s,month:start});
  const bad=event?.key==='weather'&&event.multiplier<1;
  // Imperfect signal: occasional missed seasons and false alarms, stable per episode.
  if(bad?hash(s.seed,'weather-detection',b)<.85:hash(s.seed,'weather-false-alarm',b)<.10)
   return {id:`harvest-risk:${s.seed}:${anchor}:${b}`,start,until:start+3};
 }
 return null;
}
export function prepareAgriculture(s,w){
 if(!agricultureActive(s))return null;
 const a=s.agriculture??={version:1,publicStock:0,privateStock:0,expectedLoss:.04,importReplacement:0,stockTarget:.15};
 const f=s.firms[0];
 a.publicStock*=Math.pow(.94,1/12);a.privateStock*=Math.pow(.92,1/12);
 a.forecast=agricultureForecast(s);
 const loss=clamp(1-w.weather/100,0,1);
 a.expectedLoss+=.025*(loss-a.expectedLoss);
 const scale=Math.max(1e-9,s.base.output[0]*12);
 // Finite water availability + residual non-water risks: no complete immunity.
 a.protection=.65*(1-Math.exp(-(a.publicStock+a.privateStock)/(.20*scale)));
 a.weather= w.weather>=100?w.weather/100:1-loss*(1-a.protection);
 const desired=Math.min(.70,Math.max(loss,a.forecast?.start>s.month ? .15 : 0))*clamp(w.importAvailability/100,0,1);
 a.importReplacement+= (desired-a.importReplacement)*(1-Math.exp(-1/(desired>a.importReplacement?2:4)));
 // Stocks have spoilage and a financing opportunity cost. Never created for free.
 a.stockTarget=clamp((.15+2*(a.forecast?.start>s.month ? .15 : a.expectedLoss))/(1+Math.max(0,s.bank.lendingRate)),.08,.55);
 a.spoilage=f.inventory*.01;f.inventory-=a.spoilage;
 return a;
}
export function foodReplacementUnit(weights,share,prices,importPrice,tariff,replacement){
 if(!Array.isArray(importPrice))return (1-share)*weights.reduce((v,w,i)=>v+w*(i===0?(1-replacement)*prices[i]+replacement*importPrice*(1+tariff/100):prices[i]),0)+share*importPrice*(1+tariff/100);
 return (1-share)*weights.reduce((v,w,i)=>v+w*(i===0?(1-replacement)*prices[i]+replacement*priceAt(importPrice,0)*(1+tariff/100):prices[i]),0)+share*basketPrice(weights,importPrice)*(1+tariff/100);
}
export function finishAgriculture(s,{paid,unit,investmentPrice,privateInvestment,regional=[]}){
 const a=s.agriculture;if(!agricultureActive(s)||!a)return;
 // Public maintenance first; only delivered purchases build protection next year.
 const maintenance=a.publicStock*.04/12*unit;
 a.publicMaintenance=Math.min(paid,maintenance);a.publicInvestment=Math.max(0,paid-maintenance)/unit;
 if(paid<maintenance)a.publicStock*=Math.max(0,1-.02*(1-paid/Math.max(maintenance,1e-9)));
 if(a.publicInvestment>0){
  const project={type:'agriculture',efficiency:s.institutions.investmentEfficiency,due:s.month+12};
  let ordinary=a.publicInvestment;
  for(const row of regional){
   const amount=a.publicInvestment*row.paid/paid;
   ordinary-=amount;
   s.projects.push({...project,amount,territory:{id:row.territoryId,regionId:row.regionId}});
  }
  if(ordinary>0)s.projects.push({...project,amount:ordinary});
 }
 // Earmark part of funded farm investment; no extra loan, spending or capital.
 const f=s.firms[0],profit=Math.max(0,f.lastProfit),capital=Math.max(1e-9,f.capital+a.privateStock);
 const avoidedLoss=a.expectedLoss*Math.max(0,f.lastRevenue)*12;
 const required=Math.max(.02,s.bank.lendingRate)+.08;
 const share=clamp((avoidedLoss/(capital*.20)-required)*.5,0,.30)*clamp(profit/Math.max(1e-9,privateInvestment*investmentPrice),0,1);
 a.privateInvestmentShare=share;
 for(const project of s.projects)if(project.type==='private'&&project.sector===0&&project.createdMonth===s.month&&project.agricultureShare===undefined)project.agricultureShare=share;
}
export function validateAgriculture(s){
 const a=s.agriculture;if(!a)return;
 if(!agricultureActive(s)||a.version!==1||['publicStock','privateStock','expectedLoss','importReplacement','stockTarget'].some(k=>!Number.isFinite(a[k])||a[k]<0)||a.importReplacement>.70||a.expectedLoss>1||a.stockTarget>.55)throw new Error('Повреждена модель сельского хозяйства');
}

// Revision 20. Sub-ledger partitions existing group deposits and company claims.
// Strata are representative families/cohorts, not a census or market-price forecast.
import {sectorCompanies,enterpriseBusinesses} from './enterprise-market.js';
import {corporateDebt} from './corporate-bonds.js';
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const ownersActive=s=>(s.economy?.revision??0)>=20;
export const OWNER_ASSUMPTIONS=Object.freeze({ownerPopulation:.001,ownerEquity:.30,ownerCash:.25,inheritanceSplit:.4,founderShare:.5,ownerMPC:.35});
export const ownerBusinesses=s=>s.firms.flatMap((firm,i)=>{
 const companies=sectorCompanies(s,i);
 return companies.length?companies:firm;
});
const rows=(s,i)=>s.wealthOwners.families.filter(f=>f.group===i);
const weights=(s,kind)=>{const a=s.wealthOwners?.assumptions??OWNER_ASSUMPTIONS,tail=kind==='population'?a.ownerPopulation:kind==='equity'?a.ownerEquity:a.ownerCash;
 const base=kind==='population'?[1,1,1,1]:kind==='equity'?[.1,.15,.2,.25]:[.1,.15,.2,.3],total=sum(base);return [...base.map(x=>x/total*(1-tail)),tail];};
export function ownerBookValue(s,f){
 if(f.active===false)return 0;
 const bankClaim=s.foundation?.businessBankClaims?.[enterpriseBusinesses(s).indexOf(f)]??0;
 return Math.max(0,(f.capital+(f.knowledgeCapital??0)+((f.id==='agriculture'||f.agricultureProtectionClaim)?(s.agriculture?.privateStock??0):0))*(s.metrics.investmentPrice??s.consumerPriceIndex/100)+f.inventory*f.price+f.cash+bankClaim-f.loanLC-f.loanFX*s.exchangeRate-corporateDebt(s,f));
}
export function initializeOwners(s){
 if(!ownersActive(s)||s.wealthOwners)return;
 s.wealthOwners={version:1,startedMonth:s.month,assumptions:{...OWNER_ASSUMPTIONS},families:s.households.flatMap((h,i)=>weights(s,'population').map((population,j)=>({id:`family-${i}-${j}`,group:i,stratum:j,kind:j===4?'owner':'household',population,otherWeight:weights(s,'cash')[j],cash:h.cash*weights(s,'cash')[j],stakes:{},founderCompanies:[],age:40+j*5,generation:1,income:0,capitalIncome:0,incomeHistory:[]}))),last:{dividends:[],inheritances:[],subscriptions:[]},history:[]};
 synchronizeOwnerClaims(s);
}
export function synchronizeOwnerClaims(s){
 if(!ownersActive(s)||!s.wealthOwners)return;
 reconcileOwnerClaims(s);
}
function reconcileOwnerClaims(s){
 const groups=s.households.map(()=>[]),equityWeights=weights(s,'equity');
 for(const family of s.wealthOwners.families)groups[family.group]?.push(family);
 for(const firm of ownerBusinesses(s))for(let i=0;i<10;i++){
  const list=groups[i],id=firm.id,actual=Math.max(0,firm.domesticOwners[i]??0);
  let old=0;
  for(let j=0;j<list.length;j++)old+=list[j].stakes[id]??0;
  if(old>actual){
   for(let j=0;j<list.length;j++){
    const stakes=list[j].stakes;
    stakes[id]=(stakes[id]??0)*actual/old;
   }
  }else if(actual>old){
   const delta=actual-old;
   for(let j=0;j<list.length;j++){
    const stakes=list[j].stakes;
    stakes[id]=(stakes[id]??0)+delta*equityWeights[j];
   }
  }
 }
 return groups;
}
function cashReconcile(s,i,targetOverride){
 const list=rows(s,i),target=Math.max(0,targetOverride??s.households[i].cash),current=sum(list.map(r=>r.cash)),delta=target-current;
 if(delta>=0){const w=list.map(r=>r.population*(r.stratum===4?1:[.5,.8,1.1,1.6][r.stratum])),total=sum(w);for(const [j,r] of list.entries())r.cash+=delta*w[j]/total;}
 else {let left=-delta;for(let k=0;k<6&&left>1e-10;k++){const w=list.map(r=>r.cash*(r.kind==='owner'?s.wealthOwners.assumptions.ownerMPC:.9)),total=sum(w);if(total<=0)break;const take=left;for(const [j,r] of list.entries()){const debit=Math.min(r.cash,take*w[j]/total);r.cash-=debit;left-=debit;}}}
 // Roundoff only, never a new group deposit.
 const residual=target-sum(list.map(r=>r.cash));list.reduce((a,b)=>a.cash>b.cash?a:b).cash+=residual;
}
export function prepareOwners(s){
 if(!ownersActive(s))return;initializeOwners(s);synchronizeOwnerClaims(s);
 for(let i=0;i<10;i++)cashReconcile(s,i);
 for(const r of s.wealthOwners.families){r.capitalIncome=0;if(s.economy?.revision>=24)r.mixedIncome=0;if(s.economy?.revision>=22)r.illicitIncome=0;}
 s.wealthOwners.last={dividends:[],inheritances:[],subscriptions:[]};
}
export function registerOwnerInvestment(s,c,contributions){
 if(!ownersActive(s))return;initializeOwners(s);
 // Called before the existing household->company payment. Each subscribed
 // claim is financed by a particular existing sub-account, never a free founder stake.
 for(let i=0;i<10;i++){
  const paid=contributions[i];if(!(paid>0))continue;cashReconcile(s,i);const list=rows(s,i),founder=list.at(-1),preferred=Math.min(paid*s.wealthOwners.assumptions.founderShare,founder.cash);
  const allocation=list.map(()=>0);allocation[4]=preferred;
  let left=paid-preferred;const available=list.map((r,j)=>Math.max(0,r.cash-allocation[j])),total=sum(available);
  for(let j=0;j<5;j++)allocation[j]+=left*available[j]/Math.max(total,1e-12);
  for(const [j,r] of list.entries()){r.cash=Math.max(0,r.cash-allocation[j]);r.stakes[c.id]=paid>0?c.domesticOwners[i]*allocation[j]/paid:0;}
  if(preferred>0&&!founder.founderCompanies.includes(c.id))founder.founderCompanies.push(c.id);
  s.wealthOwners.last.subscriptions.push({company:c.id,group:i,paid,founderPaid:preferred});
 }
}
export function recordOwnerDividend(s,f,group,value){
 if(!ownersActive(s)||!(value>0))return;
 const list=reconcileOwnerClaims(s)[group],domestic=f.domesticOwners[group]??0,cooperative=f.workerOwners[group]??0,total=domestic+cooperative;
 for(const r of list){const share=total>0?((r.stakes[f.id]??0)+cooperative*r.population)/total:r.population,paid=value*share;r.cash+=paid;if(s.economy?.revision>=24&&f.familyGroup!==undefined)r.mixedIncome=(r.mixedIncome??0)+paid;else r.capitalIncome+=paid;}
 s.wealthOwners.last.dividends.push({company:f.id,group,paid:value});
}
const draw=(seed,month,i)=>{let x=(seed^Math.imul(month+1,2654435761)^Math.imul(i+137,2246822519))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return (x>>>0)/4294967296;};
export function inheritOwner(s,id){
 const d=s.wealthOwners,from=d.families.find(r=>r.id===id);if(!from)return;
 const heir=rows(s,from.group)[(from.generation-1)%4],fraction=d.assumptions.inheritanceSplit,cash=from.cash*fraction;
 from.cash-=cash;heir.cash+=cash;const otherWeight=from.otherWeight*fraction;from.otherWeight-=otherWeight;heir.otherWeight+=otherWeight;
 const stakes={};for(const [company,share] of Object.entries(from.stakes)){const v=share*fraction;from.stakes[company]-=v;heir.stakes[company]=(heir.stakes[company]??0)+v;stakes[company]=v;}
 from.generation++;from.age=30;d.last.inheritances.push({month:s.month,from:from.id,to:heir.id,cash,stakes,otherWeight,generation:from.generation});
}
export function finishOwners(s,sources){
 if(!ownersActive(s))return;synchronizeOwnerClaims(s);const d=s.wealthOwners;
 for(let i=0;i<10;i++){
  const list=rows(s,i),capital=sum(list.map(r=>r.capitalIncome)),otherCapital=Math.max(0,sources[i].capital-capital),otherMixed=Math.max(0,(sources[i].mixed??0)-sum(list.map(r=>r.mixedIncome??0))),cashTotal=sum(list.map(r=>r.cash));
  const laborWeights=list.map(r=>r.population*(r.stratum===4?1:[.5,.8,1.1,1.6][r.stratum])),laborTotal=sum(laborWeights);
  for(const [j,r] of list.entries()){
   r.laborIncome=(sources[i].labor??0)*laborWeights[j]/laborTotal;
   r.income=r.laborIncome+(r.mixedIncome??0)+otherMixed*laborWeights[j]/laborTotal+(sources[i].transfers+sources[i].remittances)*r.population+r.capitalIncome+otherCapital*(cashTotal>0?r.cash/cashTotal:r.population)+(r.illicitIncome??0);
   r.netIncome=Math.max(0,r.income-(s.households[i].interestPaid??0)*r.otherWeight);
   r.incomeHistory.push({month:s.month,income:r.netIncome});r.incomeHistory=r.incomeHistory.slice(-12);r.age+=1/12;
  }
  cashReconcile(s,i);
 }
 for(const [i,r] of d.families.entries())if(r.kind==='owner'){
  // Existing national mortality drives expected generational turnover; no
  // arbitrary regime or wealth death penalty. Cohort turnover is an approximation.
  const hazard=clamp((s.demography.deaths??0)/Math.max(s.population,1e-9)*Math.exp((r.age-45)/20),0,.1);
  if(draw(s.seed,s.month,i)<hazard)inheritOwner(s,r.id);
 }
 d.history.push({month:s.month,inheritances:d.last.inheritances.length,subscriptions:sum(d.last.subscriptions.map(x=>x.paid)),ownerCash:sum(d.families.filter(r=>r.kind==='owner').map(r=>r.cash))});d.history=d.history.slice(-120);
}
export function ownerEquityByGroup(s){
 if(!ownersActive(s)||!s.wealthOwners)return null;synchronizeOwnerClaims(s);
 const firms=ownerBusinesses(s),values=firms.map(f=>ownerBookValue(s,f));
 return s.households.map((h,i)=>sum(firms.map((f,j)=>values[j]*((f.domesticOwners[i]??0)+(f.workerOwners[i]??0)))));
}
export function ownerWealthPoints(s,groupWealth){
 if(!ownersActive(s)||!s.wealthOwners)return null;
 // Valuations are constant during this observation, not across turns.
 const firms=ownerBusinesses(s),values=firms.map(f=>ownerBookValue(s,f)),groupEquities=s.households.map((_,i)=>sum(firms.map((f,j)=>values[j]*((f.domesticOwners[i]??0)+(f.workerOwners[i]??0)))));
 return s.wealthOwners.families.map(r=>{
  const i=r.group,h=s.households[i],equity=sum(firms.map((f,j)=>values[j]*((r.stakes[f.id]??0)+(f.workerOwners[i]??0)*r.population))),groupEquity=groupEquities[i],other=groupWealth[i]-h.cash-groupEquity;
  const amount=r.cash+equity+other*r.otherWeight,weight=h.population*r.population;
  return {id:r.id,group:i,weight,amount,value:amount/Math.max(s.population*weight,1e-12),kind:r.kind};
 });
}
export function ownerIncomeDistribution(s,perPerson,market){
 const points=[];for(let i=0;i<10;i++){
  const list=rows(s,i),means=list.map(r=>sum(r.incomeHistory.map(x=>x.income))/Math.max(1,r.incomeHistory.length)),total=sum(means);
  for(const [j,r] of list.entries()){
   const share=total>0?means[j]/total:r.population,factor=share/Math.max(r.population,1e-12),income=perPerson[i]*factor;
   const u=clamp((s.metrics.unemployment??0)/100*(1.4-i*.08),0,.95),replacement=clamp(.15+s.policy.transfers/20,0,.8),laborShare=clamp(r.income>0?(r.laborIncome??0)/r.income:.7);
   for(const unemployed of [false,true]){
    const laborFactor=(unemployed?replacement:1)/Math.max(1-u+u*replacement,1e-12),spread=(1-laborShare)+laborShare*laborFactor;
    points.push({group:i,subtype:j,owner:r.kind==='owner',unemployed,weight:s.households[i].population*r.population*(unemployed?u:1-u),income:income*spread,market:market[i]*factor*spread,equivalent:income*spread*Math.sqrt(s.households[i].householdSize),wealth:r.cash/Math.max(s.population*s.households[i].population*r.population,1e-12)});
   }
  }
 }return points;
}
export function validateOwners(s){
 if(!ownersActive(s))return;const d=s.wealthOwners,valid=x=>Number.isFinite(x)&&x>=-1e-7;
 if(!d||d.version!==1||!Number.isInteger(d.startedMonth)||d.startedMonth>s.month||!Array.isArray(d.families)||d.families.length!==50||new Set(d.families.map(r=>r.id)).size!==50||!Array.isArray(d.history)||d.history.length>120)throw new Error('Повреждены собственники');
 for(const k of Object.keys(OWNER_ASSUMPTIONS))if(!valid(d.assumptions?.[k])||d.assumptions[k]>1)throw new Error('Повреждены допущения собственности');
 for(let i=0;i<10;i++){const list=rows(s,i);if(list.length!==5||Math.abs(sum(list.map(r=>r.population))-1)>1e-8||Math.abs(sum(list.map(r=>r.otherWeight))-1)>1e-8||Math.abs(sum(list.map(r=>r.cash))-s.households[i].cash)>1e-6*Math.max(1,s.households[i].cash))throw new Error('Нарушен баланс семейных счетов');}
 for(const r of d.families)if(!valid(r.otherWeight)||r.otherWeight>1||!valid(r.cash)||!valid(r.population)||r.population===0||!Number.isInteger(r.generation)||r.generation<1||!valid(r.age)||Object.values(r.stakes).some(x=>!valid(x)||x>1)||!Array.isArray(r.incomeHistory)||r.incomeHistory.length>12)throw new Error('Повреждено семейное состояние');
 for(const f of ownerBusinesses(s))for(let i=0;i<10;i++)if(Math.abs(sum(rows(s,i).map(r=>r.stakes[f.id]??0))-(f.domesticOwners[i]??0))>1e-8)throw new Error('Нарушен реестр долей собственников');
}

export function recordOwnerTrade(s,f,before,kind,valuation,compensation=1){
 if(!ownersActive(s)||!s.wealthOwners)return;
 for(let i=0;i<10;i++){
  const list=rows(s,i),old=before[i]??0,now=f.domesticOwners[i]??0,delta=now-old;
  if(delta>1e-12&&kind==='privatize'){
   const paid=delta*valuation;cashReconcile(s,i,s.households[i].cash+paid);const total=sum(list.map(r=>r.cash));
   for(const r of list){const cost=paid*r.cash/Math.max(total,1e-12);r.cash-=cost;r.stakes[f.id]=(r.stakes[f.id]??0)+delta*cost/paid;}
   s.wealthOwners.last.subscriptions.push({company:f.id,group:i,paid,founderPaid:0,kind});
  }else if(delta< -1e-12){
   const removed=-delta,pay=['purchase','nationalize','secondary-sale'].includes(kind)?removed*valuation*compensation:0;
   const known=sum(list.map(r=>r.stakes[f.id]??0));
   for(const r of list){const share=known>0?(r.stakes[f.id]??0)/known:r.population;r.stakes[f.id]=Math.max(0,(r.stakes[f.id]??0)-removed*share);r.cash+=pay*share;}
  }
 }
}

export function ownerRentCash(s,group){return s.wealthOwners?.families.find(r=>r.group===group&&r.kind==='owner')?.cash??0;}
export function recordOwnerRent(s,group,value){
 if(!ownersActive(s))return;const r=s.wealthOwners.families.find(r=>r.group===group&&r.kind==='owner');r.cash+=value;if(value>0)r.illicitIncome=(r.illicitIncome??0)+value;
}

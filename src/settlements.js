import {familyOwnFoodBudget} from './livelihoods.js';
// Economic residence pools, revision 20. Magnitudes are explicit assumptions.
// No urban productivity bonus: jobs, actual wages, housing and paid moves matter.
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const settlementsActive=s=>(s.economy?.revision??0)>=20;
export const URBAN_OBSERVATIONS={BGD:.233145114975244,MEX:.749203113970256,FRA:.765143983146093};
export const SETTLEMENT_ASSUMPTIONS=Object.freeze({sorting:1.3,movingCostMonths:2.5,mobilityMonthly:.005,planningMonths:24,ruralRent:.65,urbanRent:1.25,ownFoodWageShare:.12});
const averageSize=s=>1/sum(s.households.map(h=>h.population/h.householdSize));
const homes=s=>s.social?s.social.housing.privateStock+s.social.housing.publicStock:s.population/averageSize(s)*1.03;
export function initializeSettlements(s){
 if(!settlementsActive(s)||s.settlements)return;
 const observed=URBAN_OBSERVATIONS[s.initialAccounts?.referenceCountry],urban=observed??.65;
 // Joint income/residence distribution is synthetic, with measured aggregate.
 let lo=-4,hi=4,shares;
 for(let k=0;k<50;k++){const shift=(lo+hi)/2;shares=s.households.map((h,i)=>clamp(urban+shift+(i-4.5)*.025,.02,.98));if(sum(shares.map((x,i)=>x*s.households[i].population))<urban)lo=shift;else hi=shift;}
 const urbanNeed=sum(shares.map((x,i)=>s.population*s.households[i].population*x/s.households[i].householdSize)),totalNeed=s.population/averageSize(s),fraction=urbanNeed/totalNeed;
 s.settlements={version:1,startedMonth:s.month,reference:{country:s.initialAccounts?.referenceCountry??null,year:2000,urbanShare:urban,observed:observed!==undefined,rentAverage:urban*1.25+(1-urban)*.65},assumptions:{...SETTLEMENT_ASSUMPTIONS},groups:shares.map((urbanShare,group)=>({group,urbanShare})),housing:{urban:homes(s)*fraction,rural:homes(s)*(1-fraction)},last:{records:[],moves:[],ownFood:[]},history:[]};
}
export function residenceRents(s){
 if(!settlementsActive(s)||!s.settlements)return {urban:1,rural:1};
 const d=s.settlements,a=d.assumptions;
 const need=sum(d.groups.map((r,i)=>s.population*s.households[i].population*r.urbanShare/s.households[i].householdSize)),total=s.population/averageSize(s);
 return {urban:a.urbanRent*clamp(need/Math.max(d.housing.urban/1.03,1e-9),.5,2)/d.reference.rentAverage,rural:a.ruralRent*clamp((total-need)/Math.max(d.housing.rural/1.03,1e-9),.5,2)/d.reference.rentAverage};
}
export function groupRentFactor(s,i){if(!settlementsActive(s)||!s.settlements)return 1;const r=residenceRents(s),u=s.settlements.groups[i].urbanShare;return u*r.urban+(1-u)*r.rural;}
export function nationalRentFactor(s){return settlementsActive(s)&&s.settlements?sum(s.households.map((h,i)=>h.population*groupRentFactor(s,i))):1;}
export function prepareSettlements(s){
 if(!settlementsActive(s))return;initializeSettlements(s);const d=s.settlements,a=d.assumptions;
 const total=homes(s),old=d.housing.urban+d.housing.rural,added=total-old;
 const urban=sum(d.groups.map((r,i)=>r.urbanShare*s.households[i].population));
 if(added>=0){d.housing.urban+=added*urban;d.housing.rural+=added*(1-urban);}else{d.housing.urban*=total/old;d.housing.rural*=total/old;}
 if(s.localGovernment){
  const urbanShare=sum(d.groups.map((g,i)=>g.urbanShare*s.households[i].population));
  const urbanAreas=s.localGovernment.areas.filter(a=>['urban','industrial'].includes(a.id)),ruralAreas=s.localGovernment.areas.filter(a=>!['urban','industrial'].includes(a.id));
  for(const [list,target] of [[urbanAreas,urbanShare],[ruralAreas,1-urbanShare]]){const total=sum(list.map(a=>a.population));for(const area of list)area.population=target*area.population/Math.max(total,1e-12);}
 }
 d.last={records:[],moves:[],ownFood:[],requestedMoves:[]};
 const previous=d.history.at(-1)?.records??[],rent=residenceRents(s),capacity={urban:d.housing.urban,rural:d.housing.rural};
 for(const [i,h] of s.households.entries()){
  const count=s.population*h.population,u=d.groups[i].urbanShare;
  capacity.urban-=count*u/h.householdSize;capacity.rural-=count*(1-u)/h.householdSize;
 }
 const labor=s.laborDistribution,jobUrban=sum(s.firms.map((f,i)=>f.workers*[.12,.7,.8,.7,.85][i])),urbanWorkers=sum((labor?.residence??[]).filter(r=>r.urban).map(r=>r.employed));
 let jobSpace=Math.max(0,jobUrban*1.06-urbanWorkers)/Math.max(.1,s.workingAgeShare*s.participation);
 for(const [i,h] of s.households.entries()){
  const oldRecord=previous.find(r=>r.group===i);if(!oldRecord)continue;
  const benefits=oldRecord.urban.netLivingIncome-oldRecord.rural.netLivingIncome,dir=benefits>0?'urban':'rural',u=d.groups[i].urbanShare,count=s.population*h.population;
  const monthlyIncome=Math.max(.01,(h.income-(h.interestPaid??0))/Math.max(count,1e-9)),cost=monthlyIncome*a.movingCostMonths;
  const gain=Math.abs(benefits)*a.planningMonths-cost;
  if(gain<=0)continue;
  const origin=count*(dir==='urban'?1-u:u),requested=origin*a.mobilityMonthly*clamp(gain/Math.max(cost,1e-9));
  const moved=Math.max(0,Math.min(requested,Math.max(0,capacity[dir])*h.householdSize,dir==='urban'?jobSpace:Infinity,Math.max(0,h.cash)*.01/cost));
  capacity[dir]-=moved/h.householdSize;if(dir==='urban')jobSpace-=moved;
  d.last.requestedMoves.push({group:i,to:dir,requestedPeople:requested,people:moved,costPerPerson:cost,budget:moved*cost,expectedMonthlyGain:Math.abs(benefits),rents:{...rent}});
 }
}
export function residenceSorting(s,group,sector,urban){
 const intensity=[-.9,.3,.65,.35,.7,-.3][sector];return Math.exp(s.settlements.assumptions.sorting*(urban?1:-1)*intensity);
}
export function residencePreference(s,i,j){
 if(!settlementsActive(s)||!s.settlements)return 1;const u=s.settlements.groups[i].urbanShare;
 // Longer journeys/rural fuels and city paid services are preference weights,
 // not productivity differences or guaranteed spending increases.
 return j===1?1+.10*(1-u):j===4?1+.08*u:1;
}
export function ownFoodBudget(s,i){
 const family=familyOwnFoodBudget(s,i);if(family!==null)return family;
 if(!settlementsActive(s)||!s.laborDistribution?.residence)return 0;
 const f=s.firms[0],r=s.laborDistribution.residence.find(r=>r.group===i&&!r.urban);
 return Math.max(0,(r?.sectorWageShares?.[0]??0)*f.workers*f.wage*s.policy.normalWorkweek/40*(1-f.labor.strikeShare)*s.settlements.assumptions.ownFoodWageShare);
}
export function reserveRelocation(s,budgets,plans,price){
 if(!settlementsActive(s))return;
 for(const m of s.settlements.last.requestedMoves){const paid=Math.min(m.budget,Math.max(0,budgets[m.group])*.1);m.people*=m.budget>0?paid/m.budget:0;m.budget=paid;plans[m.group].total+=paid/price;plans[m.group].relocation=paid/price;}
}
export function finishSettlements(s,{alpha,ownFood,records}){
 if(!settlementsActive(s))return;const d=s.settlements,rents=residenceRents(s),labor=s.laborDistribution.residence??[];
 for(const m of d.last.requestedMoves){const people=m.people*alpha,g=d.groups[m.group],count=s.population*s.households[m.group].population;g.urbanShare=clamp(g.urbanShare+(m.to==='urban'?1:-1)*people/count,.001,.999);d.last.moves.push({...m,people,paid:m.budget*alpha});}
 const housingTotal=homes(s),oldHousing=d.housing.urban+d.housing.rural,newHousing=housingTotal-oldHousing,urbanNow=sum(d.groups.map((g,i)=>g.urbanShare*s.households[i].population));
 if(newHousing>=0){d.housing.urban+=newHousing*urbanNow;d.housing.rural+=newHousing*(1-urbanNow);}else{d.housing.urban*=housingTotal/Math.max(oldHousing,1e-12);d.housing.rural*=housingTotal/Math.max(oldHousing,1e-12);}
 d.last.ownFood=ownFood;
 d.last.records=s.households.map((h,i)=>{
  const row=records[i],pool=labor.filter(x=>x.group===i),count=s.population*h.population,u=pool.find(x=>x.urban)?.populationShare??d.groups[i].urbanShare;
  const wages=sum(pool.map(x=>x.grossPayroll)),other=Math.max(0,h.income-(row.sources.labor??0)),rentAverage=u*rents.urban+(1-u)*rents.rural,transportAverage=u*.9+(1-u)*1.15;
  const profile=urban=>{const share=urban?u:1-u,jobs=pool.find(x=>x.urban===urban),people=count*share,wageFraction=wages>0?(jobs?.grossPayroll??0)/wages:share;
   const income=((row.sources.labor??0)*wageFraction+other*share)/Math.max(people,1e-12),housing=row.categories.housing/Math.max(count,1e-12)*(urban?rents.urban:rents.rural)/Math.max(rentAverage,1e-9),transport=(row.categories.energy+row.categories.services*.15)/Math.max(count,1e-12)*(urban?.9:1.15)/Math.max(transportAverage,1e-9);
   return {people,income,housing,transport,netLivingIncome:income-housing-transport,employed:jobs?.employed??0,unemployed:jobs?.unemployed??0};};
  return {group:i,urban:profile(true),rural:profile(false)};
 });
 d.history.push({month:s.month,urbanShare:sum(d.groups.map((g,i)=>g.urbanShare*s.households[i].population)),records:structuredClone(d.last.records),moves:sum(d.last.moves.map(m=>m.people)),relocationPaid:sum(d.last.moves.map(m=>m.paid)),ownFood:sum(ownFood)});d.history=d.history.slice(-120);
}
export function validateSettlements(s){
 if(!settlementsActive(s))return;const d=s.settlements,valid=x=>Number.isFinite(x)&&x>=0;
 if(!d||d.version!==1||!Number.isInteger(d.startedMonth)||d.startedMonth>s.month||!Array.isArray(d.groups)||d.groups.length!==10||d.groups.some((g,i)=>g.group!==i||!valid(g.urbanShare)||g.urbanShare>1)||!valid(d.housing?.urban)||!valid(d.housing?.rural)||Math.abs(d.housing.urban+d.housing.rural-homes(s))>1e-6*Math.max(1,homes(s))||!Array.isArray(d.history)||d.history.length>120)throw new Error('Повреждено расселение');
 for(const k of Object.keys(SETTLEMENT_ASSUMPTIONS))if(!valid(d.assumptions?.[k])||d.assumptions[k]>36)throw new Error('Повреждены допущения расселения');
 for(const m of d.last.moves)if(!valid(m.people)||!valid(m.paid)||m.people>m.requestedPeople+1e-7)throw new Error('Повреждена внутренняя миграция');
}

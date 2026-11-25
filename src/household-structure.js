import {residencePreference} from './settlements.js';
// Revision 19: consumer purposes are distinct from producer value added.
// Synthetic starting baskets, not fitted national expenditure surveys.
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const detailedHouseholds=s=>(s.economy?.revision??0)>=19;
export const HOUSEHOLD_STRUCTURE_ASSUMPTIONS=Object.freeze({processingShare:.65,foodEngelElasticity:-.30,energyEngelElasticity:-.10,substitution:.25,foodMinimumShare:.55});
export function producerBasket(purpose,chain){
 const out=[...purpose];out[0]=purpose[0]*chain[0];out[2]+=purpose[0]*chain[1];out[4]+=purpose[0]*chain[2];return out;
}
export function initializeHouseholdStructure(s){
 if(!detailedHouseholds(s)||s.householdStructure)return;
 const purpose=[...(s.economy.initial.consumptionWeights??[.28,.08,.23,.07,.34])];
 const opening=s.base.consumerBasket,chain=s.base.foodChain??[.25,.4875,.2625];
 s.householdStructure={version:1,startedMonth:s.month,assumptions:{...HOUSEHOLD_STRUCTURE_ASSUMPTIONS},purpose:opening?[...opening]:purpose,foodChain:[...chain],referenceRealBudget:s.base.consumption/s.base.initialPopulation,migration:!opening};
 // Existing stocks and fixed CPI/reference baskets are never rebased on upgrade.
}
export function purposeBasket(s,i,prices,foreignShare,foreign,price){
 const h=s.householdStructure,a=h.assumptions,r=s.households[i],count=s.population*r.population;
 const net=Math.max(0,r.income-(r.interestPaid??0))/Math.max(count,1e-12);
 const actualPrices=prices.map((p,j)=>price(s,j,p,foreignShare,foreign));
 const foodPrice=sum(h.foodChain.map((w,k)=>w*actualPrices[[0,2,4][k]]));
 const purposePrices=[foodPrice,...actualPrices.slice(1)];
 const basePrice=sum(h.purpose.map((w,j)=>w*purposePrices[j]));
 const realBudget=Math.max(.01,net/Math.max(basePrice,1e-9)),relative=realBudget/Math.max(h.referenceRealBudget,1e-9);
 // Engel shifts with absolute purchasing power, not merely rank in the country.
 const elasticities=[a.foodEngelElasticity,a.energyEngelElasticity,.03,.03,.15];
 const scores=h.purpose.map((w,j)=>w*residencePreference(s,i,j)*Math.pow(clamp(relative,.03,100),elasticities[j])*Math.pow(Math.max(.05,purposePrices[j]/Math.max(basePrice,1e-9)),1-a.substitution));
 const norm=sum(scores),spending=scores.map(v=>v/norm);
 // Baskets are physical producer quantities: convert expenditure shares using
 // purchaser prices before normalization. Tariffs and FX change affordability.
 const quantities=spending.map((v,j)=>v/Math.max(purposePrices[j],1e-9)),total=sum(quantities),q=quantities.map(v=>v/total);
 const weights=producerBasket(q,h.foodChain),food=[q[0]*h.foodChain[0],0,q[0]*h.foodChain[1],0,q[0]*h.foodChain[2]];
 return {weights,foodFractions:weights.map((w,j)=>w>0?food[j]/w:0)};
}
export function householdNeeds(s,size){
 const h=s.householdStructure,a=h.assumptions,reference=h.referenceRealBudget;
 const basic=h.purpose.map(w=>reference*w*.45);
 // Food requirement is a fixed physical reference; neither current income nor
 // realized cutbacks can lower it. Other needs retain the shared-service scale.
 basic[0]=reference*h.purpose[0]*a.foodMinimumShare;
 basic[4]*=.8+.2/Math.sqrt(Math.max(1,size));
 return {quantities:producerBasket(basic,h.foodChain),food:basic[0],housing:basic[4]*s.householdEconomy.assumptions.housingServiceShare};
}
export function validateHouseholdStructure(s){
 const h=s.householdStructure;if(!detailedHouseholds(s)){if(h)throw new Error('Повреждена ревизия бюджетов');return;}
 if(!h||h.version!==1||!Number.isInteger(h.startedMonth)||h.startedMonth<0||h.startedMonth>s.month||!Number.isFinite(h.referenceRealBudget)||h.referenceRealBudget<=0)throw new Error('Повреждена структура бюджетов');
 for(const [key,n] of [['purpose',5],['foodChain',3]])if(!Array.isArray(h[key])||h[key].length!==n||h[key].some(v=>!Number.isFinite(v)||v<0)||Math.abs(sum(h[key])-1)>1e-8)throw new Error('Повреждена продовольственная корзина');
 for(const k of Object.keys(HOUSEHOLD_STRUCTURE_ASSUMPTIONS))if(!Number.isFinite(h.assumptions?.[k])||Math.abs(h.assumptions[k])>2)throw new Error('Повреждены параметры бюджетов');
}

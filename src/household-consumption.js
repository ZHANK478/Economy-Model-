import {detailedHouseholds,purposeBasket,householdNeeds,validateHouseholdStructure} from './household-structure.js';
import {priceAt} from './goods-prices.js';
import {socialActive,socialHousingPrices} from './social-protection.js';
// Household-consumption revision 8. Directional evidence, not fitted national
// coefficients: BLS income-specific CPI (2024), ILO needs methodology (2025).
// All records are payments already settled by the economy, not additional GDP.
const sum=a=>a.reduce((x,y)=>x+y,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const normalize=a=>{const total=sum(a);return a.map(x=>x/Math.max(total,1e-12));};
export const consumptionActive=s=>(s.economy?.revision??0)>=8;
const compositePrice=(s,j,price,share,foreign)=>{const r=j===0&&(s.economy?.revision??0)>=12?(s.agriculture?.importReplacement??0):0;return (1-share)*((1-r)*price+r*priceAt(foreign,j)*(1+s.policy.tariff/100))+share*priceAt(foreign,j)*(1+s.policy.tariff/100);};
export const CONSUMPTION_ASSUMPTIONS=Object.freeze({
 foodIncomeElasticity:-.32,energyIncomeElasticity:-.12,servicesIncomeElasticity:.17,
 substitution:.25,needsPriority:.7,liquidDrawRate:.1,basicRealShare:.45,housingServiceShare:.58,housingIncomeElasticity:-.16,
 privateHealthIncomeElasticity:.08,privateSchoolIncomeElasticity:.22
});
export const EXPENSE_CATEGORIES=[['food','Питание','#9f8150'],['housing','Жильё','#697f90'],['energy','Энергия','#b49a54'],['goods','Вещи и быт','#83917a'],['services','Услуги','#9289a0'],['healthEducation','Здоровье и учёба','#bd7964'],['interest','Проценты по кредитам','#ae5f50'],['insurance','Страховые взносы','#76868c']];
const people=(s,i)=>s.population*s.households[i].population;
const relativeIncome=(s,i)=>clamp(Math.max(0,s.households[i].income-(s.households[i].interestPaid??0))/Math.max(people(s,i),1e-12)/Math.max(1e-8,sum(s.households.map(h=>Math.max(0,h.income-(h.interestPaid??0))))/s.population),.1,20);
export function initializeConsumption(s){
 if(!consumptionActive(s)||s.householdEconomy)return;
 const reference=s.households.map((h,i)=>{
  const volume=h.consumption/Math.max(people(s,i),1e-12);
  return {goods:s.base.consumptionWeights.map(w=>w*volume),privateServices:0,importShare:s.base.consumptionImport};
 });
 s.householdEconomy={version:1,startedMonth:s.month,assumptions:{...CONSUMPTION_ASSUMPTIONS},reference,referenceCost:[],records:[],history:[]};
 const prices=s.firms.map(f=>f.price),importPrice=s.exchangeRate*s.worldPriceIndex/100;
 s.householdEconomy.referencePrices=[...prices];s.householdEconomy.referenceImportPrice=importPrice;s.householdEconomy.referenceTaxes={vat:s.policy.vat,tariff:s.policy.tariff};
 s.householdEconomy.referenceCost=reference.map(r=>referenceValue(s,r,prices,importPrice));
}
export function groupBasket(s,i,anchor,prices,foreignShare,importPrice){
 if(detailedHouseholds(s)){
  const result=purposeBasket(s,i,prices,foreignShare,importPrice,compositePrice);
  result.weights.foodFractions=result.foodFractions;return result.weights;
 }
 const a=s.householdEconomy.assumptions,relative=relativeIncome(s,i);
 const elasticities=[a.foodIncomeElasticity,a.energyIncomeElasticity,.02,.02,a.servicesIncomeElasticity];
 // Modest substitution within the coarse five-sector basket. Physical needs
 // are measured independently and cannot shrink when purchasing power falls.
 const mean=sum(anchor.map((w,j)=>w*(compositePrice(s,j,prices[j],foreignShare,importPrice))));
 const discretionary=normalize(anchor.map((w,j)=>w*Math.pow(relative,elasticities[j])*Math.pow(Math.max(.05,(compositePrice(s,j,prices[j],foreignShare,importPrice))/Math.max(mean,1e-8)),-a.substitution)));
 const needs=basicNeeds(s,i,prices,importPrice,foreignShare),basic=normalize(needs.quantities);
 const perPersonIncome=Math.max(0,s.households[i].income-(s.households[i].interestPaid??0))/Math.max(people(s,i),1e-12);
 const priority=clamp(1.5-perPersonIncome/Math.max(needs.cost,1e-9),0,1)*a.needsPriority;
 return normalize(discretionary.map((w,j)=>w*(1-priority)+basic[j]*priority));
}
export function privateServiceShares(s,i){
 const a=s.services,p=s.policy,k=s.parameters,relative=relativeIncome(s,i),assumptions=s.householdEconomy.assumptions;
 const healthGap=clamp(1-(a.publicHealthDelivered??a.publicHealthCapacity),0,1),schoolGap=clamp(1-(a.publicEducationDelivered??a.publicEducationCapacity),0,1);
 const health=p.privateHealthEntry?clamp(k.privateHealthDemand*Math.pow(relative,assumptions.privateHealthIncomeElasticity)+.11*healthGap,0,.20):0;
 const education=p.privateEducationEntry?clamp(k.privateEducationDemand*Math.pow(relative,assumptions.privateSchoolIncomeElasticity)+.08*schoolGap,0,.15):0;
 const care=p.privateEducationEntry?.006*(1-a.childcareAccess):0;
 const fee=Math.min(.15,.024*s.metrics.corporateInfrastructureShare/20*s.networks.reduce((v,n)=>v+n.fee*n.weight,0));
 return {health,education,care,fee,total:health+education+care+fee};
}
export function referenceValue(s,r,prices,importPrice){
 return sum(r.goods.map((q,j)=>q*(compositePrice(s,j,prices[j],r.importShare,importPrice))*(1+s.policy.vat/100)))+r.privateServices*prices[4];
}
export function basicNeeds(s,i,prices,importPrice,foreignShare){
 const f=s.householdEconomy,base=s.base.consumption/Math.max(s.base.initialPopulation,1e-9)*f.assumptions.basicRealShare;
 const weights=normalize(s.base.consumptionWeights.map((w,j)=>j===0?Math.max(w,.2):w));
 const size=s.households[i].householdSize??2.5,sharing=.8+.2/Math.sqrt(Math.max(1,size));
 const detail=detailedHouseholds(s)?householdNeeds(s,size):null;
 const quantities=detail?.quantities??weights.map((w,j)=>base*w*(j===4?sharing:1));
 const foodServiceShare=detail&&quantities[4]>0?detail.food*s.householdStructure.foodChain[2]/quantities[4]:0;
 const basicPrices=socialActive(s)?socialHousingPrices(s,i,prices,foodServiceShare):prices;
 const buyerPrices=basicPrices.map((p,j)=>(compositePrice(s,j,p,foreignShare,importPrice))*(1+s.policy.vat/100));
 const publicHealth=clamp(s.services.publicHealthDelivered??0,0,1),publicSchool=clamp(s.services.publicEducationDelivered??0,0,1);
 const health=Math.max(0,s.foundation?.providers?.health?.referenceCost??s.base.serviceReference?.health??0)*(1-publicHealth);
 const school=Math.max(0,s.foundation?.providers?.school?.referenceCost??s.base.serviceReference?.school??0)*(s.ageCohorts[0]/s.population)/.28*(1-publicSchool);
 return {quantities,food:detail?.food??quantities[0],housing:detail?.housing??quantities[4]*f.assumptions.housingServiceShare,health,school,cost:sum(quantities.map((q,j)=>q*buyerPrices[j]))+(health+school)*prices[4]};
}
export function settleConsumption(s,prev,{baskets,importShare,importPrice,prices,plans,services,paid,alpha,sources,buyerPrices,housingPaid,foodReplacement=0,foodFractions}){
 const f=s.householdEconomy;
 const records=s.households.map((h,i)=>{
  const count=people(s,i),goodsQuantity=plans[i]*alpha;
  const groupPrices=buyerPrices?.[i]??prices;
  const amounts=baskets[i].map((w,j)=>goodsQuantity*w*((1-importShare)*(j===0?(1-foodReplacement)*groupPrices[j]+foodReplacement*priceAt(importPrice,j)*(1+s.policy.tariff/100):groupPrices[j])+importShare*priceAt(importPrice,j)*(1+s.policy.tariff/100))*(1+s.policy.vat/100));
  const serviceCost=services[i].total*alpha*prices[4],healthSchool=(services[i].health+services[i].education)*alpha*prices[4];
  // Housing and transport/general services are resource subaccounts of the
  // existing service producer. No extra rent, dividends or housing assets are created.
  const housingShare=clamp(f.assumptions.housingServiceShare*Math.pow(relativeIncome(s,i),f.assumptions.housingIncomeElasticity),.25,.8);
  const physicalFoodParts=foodFractions?.[i]??[1,0,0,0,0];
  const foodParts=physicalFoodParts.map((v,j)=>j===4?v*((1-importShare)*prices[j]+importShare*priceAt(importPrice,j)*(1+s.policy.tariff/100))/Math.max((1-importShare)*groupPrices[j]+importShare*priceAt(importPrice,j)*(1+s.policy.tariff/100),1e-9):v),food=sum(amounts.map((v,j)=>v*foodParts[j]));
  const housing=housingPaid?.[i]??goodsQuantity*baskets[i][4]*(1-physicalFoodParts[4])*(1-importShare)*prices[4]*(1+s.policy.vat/100)*housingShare,housingVolume=goodsQuantity*baskets[i][4]*(1-physicalFoodParts[4])*(1-importShare)*housingShare/count;
  const healthPremium=s.social?.last?.healthPremium?.[i]??0,healthReimbursement=s.social?.last?.healthReimbursement?.[i]??0;
  const categories={food,housing,energy:amounts[1],goods:amounts[2]*(1-foodParts[2])+amounts[3],services:amounts[4]*(1-foodParts[4])-housing+serviceCost-healthSchool,healthEducation:healthSchool-healthReimbursement,interest:h.interestPaid,...(socialActive(s)?{insurance:s.social.last.premiums[i]+healthPremium}:{})};
  const consumption=paid[i].goods+paid[i].services,income=h.income,expenses=consumption-healthReimbursement+h.interestPaid+healthPremium+(socialActive(s)?s.social.last.premiums[i]:0);
  // Capture the first actually delivered basket once, in physical units per
  // person. Its later price does not track subsequent cutbacks in purchases.
  if(f.history.length===0){
   f.reference[i]={goods:baskets[i].map(w=>goodsQuantity*w/count),privateServices:services[i].total*alpha/count,importShare};
   f.referenceCost[i]=referenceValue({...s,policy:{...s.policy,...f.referenceTaxes}},f.reference[i],f.referencePrices,f.referenceImportPrice);
  }
  const needs=basicNeeds(s,i,prices,importPrice,importShare),referenceCost=referenceValue(s,f.reference[i],groupPrices,importPrice);
  return {group:i,people:count,income,consumption,interest:h.interestPaid,expenses,balance:income-expenses,cashChange:h.cash-prev.households[i].cash,
   otherCashFlows:h.cash-prev.households[i].cash-(income-expenses),categories,sources:sources[i],
   perPerson:{income:income/count,consumption:consumption/count,interest:h.interestPaid/count,expenses:expenses/count,balance:(income-expenses)/count},
   basicCost:needs.cost,referenceCost,priceIndex:f.referenceCost[i]>1e-12?referenceCost/f.referenceCost[i]*100:100,
   housingAdequacy:clamp(housingVolume/Math.max(needs.housing,1e-9),0,1),foodAdequacy:clamp(goodsQuantity*sum(baskets[i].map((w,j)=>w*physicalFoodParts[j]))/count/Math.max(needs.food,1e-9),0,1),
   housingNeedShare:needs.housing*prices[4]*(socialActive(s)?s.social.housing.rentIndex:1)*(1+s.policy.vat/100)/Math.max(income/count,1e-9),healthAccess:s.services.healthByGroup[i],schoolAccess:s.services.educationByGroup[i]};
 });
 const consumed=sum(records.map(r=>r.consumption)),reported=s.lastReport.gdp.consumption;
 if(Math.abs(consumed-reported)>Math.max(1e-6,Math.abs(reported)*1e-9))throw new Error('Расходы населения не совпали с потреблением ВВП');
 for(const r of records)if(Math.abs(sum(Object.values(r.categories))-r.expenses)>Math.max(1e-6,r.expenses*1e-9)||Math.abs(sum(Object.values(r.sources))-r.income)>Math.max(1e-6,r.income*1e-9))throw new Error('Не совпали статьи бюджета населения');
 f.records=records;f.history.push({month:s.month,records:records.map(r=>({group:r.group,people:r.people,...r.perPerson,basicCost:r.basicCost,referenceCost:r.referenceCost,priceIndex:r.priceIndex}))});f.history=f.history.slice(-240);
 s.services.housingBurden=clamp(sum(records.map((r,i)=>r.housingNeedShare*s.households[i].population)),.01,2);s.metrics.housingBurden=s.services.housingBurden*100;
}
function legacyRecords(s){
 const trace=s.lastReport.calculationTrace;if(!trace?.households?.length)return [];
 const alpha=s.lastReport.market?.fulfillment??1,servicePrice=trace.before.firms[4].price;
 return s.households.map((h,i)=>{const t=trace.households[i],count=people(s,i),consumption=t.ordinaryPlannedVolume*alpha*t.consumerUnitPrice*(1+t.vat)+t.privateServicePlannedVolume*alpha*servicePrice;
  return {group:i,people:count,income:h.income,consumption,interest:h.interestPaid,expenses:consumption+h.interestPaid,balance:h.income-consumption-h.interestPaid,categories:null,sources:null,basicCost:null,referenceCost:null,priceIndex:null};});
}
export const INCOME_GROUPS=['Низкие доходы','Доходы ниже среднего','Средние доходы','Обеспеченные','Высокие доходы'];
export function consumptionGroups(s){
 const rows=s.householdEconomy?.records?.length?s.householdEconomy.records:legacyRecords(s);
 const sorted=(rows.length?rows:s.households.map((h,i)=>({group:i,people:people(s,i),income:h.income,expenses:null}))).slice().sort((a,b)=>a.income/a.people-b.income/b.people);
 return Array.from({length:5},(_,i)=>{
  const pair=sorted.slice(i*2,i*2+2),population=sum(pair.map(r=>r.people)),valid=pair.every(r=>Number.isFinite(r.expenses));
  const aggregate=key=>pair.every(r=>Number.isFinite(r[key]))?sum(pair.map(r=>r[key]))/population:null;
  const weighted=key=>pair.every(r=>Number.isFinite(r[key]))?sum(pair.map(r=>r[key]*r.people))/population:null;
  const detailed=pair.every(r=>r.categories);
  return {id:i,label:INCOME_GROUPS[i],population,groups:pair.map(r=>r.group),income:aggregate('income'),interest:aggregate('interest'),expenses:valid?aggregate('expenses'):null,balance:valid?aggregate('balance'):null,
   categories:detailed?Object.fromEntries(EXPENSE_CATEGORIES.map(([key])=>[key,sum(pair.map(r=>(r.categories[key]??0)))/population])):null,
   sources:pair.every(r=>r.sources)?Object.fromEntries(['labor','transfers','capital','remittances',...(s.economy?.revision>=22?['rents']:[]),...(s.economy?.revision>=24?['mixed']:[])].map(key=>[key,sum(pair.map(r=>r.sources[key]??0))/population])):null,
   basicCost:weighted('basicCost'),referenceCost:weighted('referenceCost'),priceIndex:weighted('priceIndex'),foodAdequacy:weighted('foodAdequacy'),housingAdequacy:weighted('housingAdequacy'),...(socialActive(s)?{social:Object.fromEntries(['pensions','unemployment','housingAid','privateBenefits','privatePensionDraw','pensionSaving','healthPremium','healthReimbursement','investmentSaving','investmentWithdrawal'].map(key=>[key,sum(pair.map(r=>s.social.last[key]?.[r.group]??0))/population]))}:{})};
 });
}
export function validateConsumption(s){
 validateHouseholdStructure(s);
 const f=s.householdEconomy;if(!f)return;
 const nonnegative=x=>Number.isFinite(x)&&x>=0;
 if(!consumptionActive(s)||f.version!==1||!Number.isInteger(f.startedMonth)||!Array.isArray(f.reference)||f.reference.length!==10||!Array.isArray(f.referenceCost)||f.referenceCost.length!==10||f.referenceCost.some(x=>!nonnegative(x))||!Array.isArray(f.records)||![0,10].includes(f.records.length)||!Array.isArray(f.history)||f.history.length>240)throw new Error('Повреждена модель потребления');
 for(const [key,value] of Object.entries(CONSUMPTION_ASSUMPTIONS))if(!Number.isFinite(f.assumptions?.[key])||Math.abs(f.assumptions[key])>5)throw new Error('Повреждены допущения потребления');
 for(const r of f.reference)if(!Array.isArray(r.goods)||r.goods.length!==5||r.goods.some(x=>!nonnegative(x))||!nonnegative(r.privateServices)||!nonnegative(r.importShare)||r.importShare>1)throw new Error('Повреждена привычная корзина');
 if(f.records.length&&new Set(f.records.map(r=>r.group)).size!==10)throw new Error('Повторяются группы населения');
 for(const r of f.records)if(!Number.isInteger(r.group)||r.group<0||r.group>9||!nonnegative(r.people)||r.people===0||['income','consumption','expenses','interest','basicCost','referenceCost'].some(key=>!nonnegative(r[key]))||!Number.isFinite(r.balance)||!r.categories||Object.values(r.categories).some(x=>!nonnegative(x)))throw new Error('Повреждены бюджеты населения');
}

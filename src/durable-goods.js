// Revision 22. Consumer assets use paid industry goods and repair services.
// Physical quantities are model-equivalent units, not counts of branded devices.
import {priceAt} from './goods-prices.js';
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const durablesActive=s=>(s.economy?.revision??0)>=22;
export const DURABLE_TYPES=[{id:'electronics',name:'Электроника',life:60,share:.35},{id:'appliances',name:'Бытовая техника',life:144,share:.40},{id:'furnishings',name:'Мебель и домашние вещи',life:180,share:.25}];
const people=(s,i)=>s.population*s.households[i].population;
const qualityCost=q=>q**1.2;
const units=(g,type)=>sum(g.cohorts.filter(c=>c.type===type).map(c=>c.quantity*c.quality));
const stock=g=>sum(g.cohorts.map(c=>c.quantity*c.quality));
const loanDebt=(s,h)=>h.loanLC+h.loanFX*s.exchangeRate;
export function initializeDurables(s){
 if(!durablesActive(s)||s.durableGoods)return;
 const d=s.durableGoods={version:1,startedMonth:s.month,assumptions:{durableIndustryShare:.65,adjustmentMonths:18,repairPartsShare:.16,repairLaborShare:.12,repairLifeLimit:1.1,usedSaleShare:.02,usedBrokerShare:.03,qualityIncomeElasticity:.12,stockIncomeElasticity:.7,creditMonths:36,debtServiceShare:.25,savingsDrawShare:.01},nextCohort:1,nextLoan:1,groups:[],credit:s.households.map(()=>({loans:[],last:{paid:0,writeOff:0,originated:0}})),last:{},history:[],initialStockImputed:true};
 for(const [i,h] of s.households.entries()){
  const count=people(s,i),income=Math.max(1e-6,h.income-(h.interestPaid??0)),relative=income/count/Math.max(1e-6,s.households.reduce((v,x)=>v+x.income,0)/s.population),quality=clamp(relative**d.assumptions.qualityIncomeElasticity,.65,1.6);
  const monthly=Math.max(1e-8,h.consumption*Math.max(.01,s.base.consumptionWeights[2]-(s.householdStructure?.purpose[0]??0)*(s.householdStructure?.foodChain[1]??0)))*d.assumptions.durableIndustryShare;
  const g={group:i,referencePeople:count,referenceRealIncome:income/Math.max(.01,s.consumerPriceIndex/100),referenceQuality:quality,referenceAnchored:s.month>0,macroConsumptionVolume:h.consumption,referenceServices:[],cohorts:[],last:{}};
  for(const type of DURABLE_TYPES){const quantity=monthly*type.share*type.life/qualityCost(quality);for(let k=0;k<6;k++)g.cohorts.push({id:d.nextCohort++,type:type.id,quantity:quantity/6,broken:0,age:type.life*(k+.5)/6,quality,life:type.life*Math.sqrt(quality),repairCount:0});g.referenceServices.push(units(g,type.id));}
  d.groups.push(g);
 }
}
export function prepareDurables(s){
 if(!durablesActive(s))return;initializeDurables(s);const d=s.durableGoods;d.last={groups:[],trades:[],newSpending:0,repairSpending:0,usedPayments:0,brokerFees:0,services:0,openingServices:sum(d.groups.map(stock)),failed:0,scrapped:0};
 for(const [i,g] of d.groups.entries()){
  g.last={failed:0,scrapped:0,newSpending:0,repairSpending:0,usedPaid:0,usedReceived:0,newLoan:0,creditCashBefore:0};d.credit[i].last={paid:0,writeOff:0,originated:0};
  for(const c of g.cohorts){const lambda=c.life/.886226925452758,hazard=1-Math.exp(-((c.age+1)**2-c.age**2)/lambda**2),failed=c.quantity*clamp(hazard);c.quantity-=failed;c.broken+=failed;c.age++;g.last.failed+=failed*c.quality;
   if(c.age>c.life*d.assumptions.repairLifeLimit){g.last.scrapped+=c.broken*c.quality;c.broken=0;}}
  g.cohorts=g.cohorts.filter(c=>c.quantity+c.broken>1e-10);d.last.failed+=g.last.failed;d.last.scrapped+=g.last.scrapped;
 }
}
export function consumerCreditLimit(s,i,legacyLimit){
 if(!durablesActive(s))return legacyLimit;const h=s.households[i],a=s.durableGoods.assumptions,scheduled=sum(s.durableGoods.credit[i].loans.map(l=>Math.min(l.principal,l.installment)));
 return Math.min(legacyLimit,Math.max(0,h.income*a.debtServiceShare-(h.interestPaid??0)-scheduled)*a.creditMonths);
}
export function recordConsumerLoan(s,i,loan,cashBefore){if(durablesActive(s)){const r=s.durableGoods.groups[i].last;r.newLoan=loan;r.creditCashBefore=cashBefore;}}
export function retireConsumerCredit(s,h,amount,kind='repayment'){
 if(!durablesActive(s))return;const i=s.households.indexOf(h);if(i<0)return;const ledger=s.durableGoods.credit[i],principal=sum(ledger.loans.map(l=>l.principal));let remaining=Math.min(amount,principal);
 if(kind==='writeOff'){remaining=Math.min(principal,amount*principal/Math.max(loanDebt(s,h)+amount,1e-12));const ratio=principal>0?remaining/principal:0;for(const l of ledger.loans){l.principal*=1-ratio;l.arrears*=1-ratio;}ledger.last.writeOff+=remaining;}
 else {for(const l of ledger.loans){const n=Math.min(l.principal,remaining);l.principal-=n;l.arrears=Math.max(0,l.arrears-n);remaining-=n;}ledger.last.paid+=Math.min(amount,principal);}
 ledger.loans=ledger.loans.filter(l=>l.principal>1e-8);
}
export function serviceConsumerCredit(s,repay){
 if(!durablesActive(s))return;const a=s.durableGoods.assumptions;
 for(const [i,h] of s.households.entries()){
  const ledger=s.durableGoods.credit[i],due=sum(ledger.loans.map(l=>Math.min(l.principal,l.installment))),room=Math.min(Math.max(0,h.cash-Math.max(0,h.income)*.5),Math.max(0,h.income*a.debtServiceShare-(h.interestPaid??0))),paid=repay(s,h,Math.min(due,room));
  let unpaid=Math.max(0,due-paid);for(const l of ledger.loans){const n=Math.min(unpaid,l.installment);l.arrears=Math.min(l.principal,l.arrears+n);unpaid-=n;}
 }
}
function target(s,i){
 const d=s.durableGoods,g=d.groups[i],h=s.households[i],realIncome=Math.max(1e-6,h.income-(h.interestPaid??0))/Math.max(.01,s.consumerPriceIndex/100),ratio=clamp(realIncome/Math.max(1e-8,g.referenceRealIncome)*g.referencePeople/people(s,i),.05,20);
 return {quality:Math.round(clamp(g.referenceQuality*ratio**d.assumptions.qualityIncomeElasticity,.65,1.6)*20)/20,services:g.referenceServices.map(v=>v*people(s,i)/g.referencePeople*ratio**d.assumptions.stockIncomeElasticity)};
}
export function planDurableConsumption(s,budgets,baskets,foodFractions,groupUnits,services,prices,foreign,importShare,essential){
 if(!durablesActive(s))return;const d=s.durableGoods,a=d.assumptions,vat=1+s.policy.vat/100,goodsPrice=((1-importShare)*prices[2]+importShare*priceAt(foreign,2)*(1+s.policy.tariff/100))*vat;
 const plans=d.groups.map((g,i)=>{
  const volume=Math.max(0,budgets[i]-services[i].total*prices[4])/(groupUnits[i]*vat),quantities=baskets[i].map(w=>w*volume),food2=quantities[2]*foodFractions[i][2],baseline=Math.max(0,quantities[2]-food2)*a.durableIndustryShare,original=baseline*goodsPrice;
  const t=target(s,i),needs=DURABLE_TYPES.map((type,k)=>Math.max(0,t.services[k]-units(g,type.id))/a.adjustmentMonths),newNeed=sum(needs)/t.quality*qualityCost(t.quality)*goodsPrice;
  const extra=Math.min(Math.max(0,newNeed-original),Math.max(0,s.households[i].cash-budgets[i]-2*s.households[i].income)*a.savingsDrawShare),spendable=Math.min(original+extra,Math.max(0,budgets[i]-essential[i])+extra);
  return {group:i,originalBudget:budgets[i],quantities,food2,baseline,original,extra,target:t,needs,room:spendable,repairs:[],newPurchases:[],usedReserved:0,repairLabor:0,partsVolume:0,newVolume:0,goodsPrice};
 });
 // Repair only when cost per restored service unit beats a replacement and age
 // still permits use; both parts and labour must be bought from existing sectors.
 for(const p of plans){const g=d.groups[p.group];for(const c of g.cohorts){if(c.broken<=0||c.age>c.life*a.repairLifeLimit)continue;const parts=qualityCost(c.quality)*a.repairPartsShare,labour=qualityCost(c.quality)*a.repairLaborShare,cost=parts*goodsPrice+labour*prices[4],replacement=qualityCost(p.target.quality)*goodsPrice/p.target.quality*c.quality,remaining=clamp(1-c.age/(c.life*1.5),.05,1);
   if(cost/remaining>=replacement)continue;const k=DURABLE_TYPES.findIndex(t=>t.id===c.type),quantity=Math.min(c.broken,p.room/Math.max(cost,1e-9),p.needs[k]*a.adjustmentMonths/c.quality);if(quantity<=0)continue;p.repairs.push({cohort:c.id,quantity,partsVolume:parts*quantity,labourVolume:labour*quantity,cost:cost*quantity});p.room=Math.max(0,p.room-cost*quantity);p.partsVolume+=parts*quantity;p.repairLabor+=labour*quantity;p.needs[k]=Math.max(0,p.needs[k]-quantity*c.quality/a.adjustmentMonths);}}
 // Private second-hand transfers: seller retains every unsold/rationed unit.
 const offered=new Map(),offeredServices=new Map();for(const buyer of [...plans].sort((x,y)=>x.group-y.group))for(const [k,type] of DURABLE_TYPES.entries()){
  let wanted=buyer.needs[k]*a.adjustmentMonths;if(wanted<=0)continue;
  for(const seller of [...plans].sort((x,y)=>y.group-x.group)){
   if(seller.group<=buyer.group||buyer.room<=0)continue;const g=d.groups[seller.group],surplus=Math.max(0,units(g,type.id)-seller.target.services[k]*.9);
   for(const c of g.cohorts.filter(c=>c.type===type.id&&c.quantity>0&&c.age>c.life*.35)){
    const stockKey=seller.group+':'+type.id,available=Math.min(Math.max(0,c.quantity*a.usedSaleShare-(offered.get(c.id)??0)),Math.max(0,surplus-(offeredServices.get(stockKey)??0))/c.quality);if(available<=0)continue;
    const price=qualityCost(c.quality)*goodsPrice/vat*clamp(1-c.age/(c.life*1.3),.15,.75),fee=price*a.usedBrokerShare,quantity=Math.min(available,wanted/c.quality,buyer.room/Math.max(price+fee,1e-9));if(quantity<=0)continue;
    const paid=price*quantity,broker=fee*quantity;d.last.trades.push({seller:seller.group,buyer:buyer.group,cohort:c.id,type:type.id,quantity,price,paid,broker});offered.set(c.id,(offered.get(c.id)??0)+quantity);offeredServices.set(stockKey,(offeredServices.get(stockKey)??0)+quantity*c.quality);buyer.room=Math.max(0,buyer.room-paid-broker);buyer.usedReserved+=paid;services[buyer.group].total+=broker/prices[4];services[buyer.group].durableBroker=(services[buyer.group].durableBroker??0)+broker/prices[4];wanted-=quantity*c.quality;buyer.needs[k]=Math.max(0,buyer.needs[k]-quantity*c.quality/a.adjustmentMonths);
   }
  }
 }
 for(const p of plans){
  const needed=sum(p.needs.map(n=>n/p.target.quality*qualityCost(p.target.quality)*goodsPrice)),scale=needed>0?clamp(p.room/needed):0;
  for(const [k,type] of DURABLE_TYPES.entries()){const volume=p.needs[k]/p.target.quality*qualityCost(p.target.quality)*scale;p.newVolume+=volume;p.newPurchases.push({type:type.id,volume,quantity:volume/qualityCost(p.target.quality),quality:p.target.quality});}
  const q=p.quantities;q[2]=Math.max(0,q[2]-p.baseline)+p.partsVolume+p.newVolume;services[p.group].total+=p.repairLabor;services[p.group].durableRepair=p.repairLabor;
  const total=sum(q);baskets[p.group]=q.map(v=>total>0?v/total:0);foodFractions[p.group][2]=q[2]>0?p.food2/q[2]:0;
  // Other food-chain fractions are unchanged because their physical units did not change.
  // Reconstruct by subtracting/adding the industry invoice from the pre-change budget.
  const oldBudget=budgets[p.group],oldService=(services[p.group].total-p.repairLabor-(services[p.group].durableBroker??0))*prices[4];
  const newGoodsCost=Math.max(0,oldBudget-oldService-p.original+(p.partsVolume+p.newVolume)*goodsPrice);
  groupUnits[p.group]=total>0?newGoodsCost/(total*vat):groupUnits[p.group];budgets[p.group]=newGoodsCost+services[p.group].total*prices[4];p.plannedNewSpend=p.newVolume*goodsPrice;p.plannedRepairSpend=p.partsVolume*goodsPrice+p.repairLabor*prices[4];
 }
 d.plans=plans;
}
function mergeCohorts(d,g){
 const map=new Map();for(const c of g.cohorts){const key=[c.type,c.quality,Math.floor(c.age/12)].join(':');const old=map.get(key);if(!old){map.set(key,{...c});continue;}const n=old.quantity+old.broken,m=c.quantity+c.broken;old.age=(old.age*n+c.age*m)/Math.max(n+m,1e-12);old.repairCount=(old.repairCount*n+c.repairCount*m)/Math.max(n+m,1e-12);old.quantity+=c.quantity;old.broken+=c.broken;}
 g.cohorts=[...map.values()].filter(c=>c.quantity+c.broken>1e-10);
}
export function settleDurables(s,alpha){
 if(!durablesActive(s))return;const d=s.durableGoods;
 for(const p of d.plans??[]){const g=d.groups[p.group];for(const r of p.repairs){const c=g.cohorts.find(c=>c.id===r.cohort),quantity=Math.min(c.broken,r.quantity*alpha);c.broken-=quantity;c.quantity+=quantity;if(quantity>0)c.repairCount++;}
  for(const n of p.newPurchases)if(n.quantity*alpha>1e-10){const type=DURABLE_TYPES.find(t=>t.id===n.type);g.cohorts.push({id:d.nextCohort++,type:n.type,quantity:n.quantity*alpha,broken:0,age:0,quality:n.quality,life:type.life*Math.sqrt(n.quality),repairCount:0});}
  g.last.newSpending=p.plannedNewSpend*alpha;g.last.repairSpending=p.plannedRepairSpend*alpha;g.last.targetServices=sum(p.target.services);
 }
 for(const t of d.last.trades){const seller=d.groups[t.seller],buyer=d.groups[t.buyer],c=seller.cohorts.find(c=>c.id===t.cohort),quantity=Math.min(c.quantity,t.quantity*alpha),paid=quantity*t.price,broker=quantity*t.price*d.assumptions.usedBrokerShare;
  c.quantity-=quantity;s.households[t.buyer].cash-=paid;s.households[t.seller].cash+=paid;buyer.cohorts.push({...c,id:d.nextCohort++,quantity,broken:0});buyer.last.usedPaid+=paid;seller.last.usedReceived+=paid;t.delivered=quantity;t.actualPaid=paid;t.actualBroker=broker;d.last.usedPayments+=paid;d.last.brokerFees+=broker;
 }
 for(const [i,g] of d.groups.entries()){
  const eligible=g.last.newSpending+g.last.repairSpending+g.last.usedPaid,financed=Math.min(g.last.newLoan,eligible),ledger=d.credit[i];if(financed>1e-9){ledger.loans.push({id:d.nextLoan++,principal:financed,installment:financed/d.assumptions.creditMonths,issuedMonth:s.month,maturity:s.month+d.assumptions.creditMonths,arrears:0});ledger.last.originated=financed;}
  mergeCohorts(d,g);const p=d.plans[i],brokerVolume=(s.durableGoods.last.trades.filter(t=>t.buyer===i).reduce((v,t)=>v+t.actualBroker,0))/s.firms[4].price,annuity=sum(g.cohorts.map(c=>c.quantity*qualityCost(c.quality)/c.life));g.macroConsumptionVolume=Math.max(0,s.households[i].consumption-(p.newVolume+p.partsVolume+p.repairLabor)*alpha-brokerVolume)+annuity;g.last.serviceFlowBudgetAnchor=annuity;g.last.services=stock(g);g.last.adequacy=clamp(g.last.services/Math.max(1e-9,g.last.targetServices));d.last.newSpending+=g.last.newSpending;d.last.repairSpending+=g.last.repairSpending;d.last.services+=g.last.services;d.last.groups.push({group:i,...g.last,consumerCredit:sum(ledger.loans.map(l=>l.principal)),principalPaid:ledger.last.paid});
 }
 delete d.plans;d.history.push({month:s.month,services:d.last.services,newSpending:d.last.newSpending,repairSpending:d.last.repairSpending,usedPayments:d.last.usedPayments,failed:d.last.failed,scrapped:d.last.scrapped});d.history=d.history.slice(-120);
}
export function validateDurables(s){
 if(!durablesActive(s))return;const d=s.durableGoods;if(!d||d.version!==1||d.startedMonth>s.month||d.groups?.length!==10||d.credit?.length!==10||d.history?.length>120)throw new Error('Повреждены долговечные товары');
 const valid=x=>Number.isFinite(x)&&x>=0;if(Object.values(d.assumptions).some(x=>!valid(x))||d.assumptions.adjustmentMonths<=0||d.assumptions.creditMonths<=0||d.assumptions.debtServiceShare>1||d.assumptions.durableIndustryShare>1)throw new Error('Повреждены допущения долговечности');for(const [i,g] of d.groups.entries()){if(g.group!==i||!Array.isArray(g.cohorts)||!valid(g.macroConsumptionVolume)||!valid(g.referencePeople)||g.referencePeople===0||!valid(g.referenceRealIncome)||g.referenceRealIncome===0)throw new Error('Повреждён владелец техники');for(const c of g.cohorts)if(!DURABLE_TYPES.some(t=>t.id===c.type)||['quantity','broken','age','quality','life'].some(k=>!valid(c[k]))||c.quality===0||c.life===0)throw new Error('Повреждён запас техники');const loans=d.credit[i].loans;for(const l of loans)if(['principal','installment','arrears'].some(k=>!valid(l[k]))||l.arrears>l.principal+1e-8)throw new Error('Повреждён потребительский кредит');if(sum(loans.map(l=>l.principal))>loanDebt(s,s.households[i])+1e-6)throw new Error('Потребительский долг посчитан дважды');}
}

export function finishDurables(s){if(!durablesActive(s))return;for(const [i,g] of s.durableGoods.groups.entries()){if(!g.referenceAnchored){g.referenceRealIncome=Math.max(1e-6,s.households[i].income-(s.households[i].interestPaid??0))/Math.max(.01,s.consumerPriceIndex/100);g.referencePeople=people(s,i);g.referenceAnchored=true;}const r=s.durableGoods.last.groups[i];if(r){r.consumerCredit=sum(s.durableGoods.credit[i].loans.map(l=>l.principal));r.principalPaid=s.durableGoods.credit[i].last.paid;}}s.lastReport.durables=structuredClone(s.durableGoods.last);}

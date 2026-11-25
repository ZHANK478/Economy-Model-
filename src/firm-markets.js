import {transferCompanySites} from './company-geography.js';
import {carveNewspapers,pressEnabled,pressTitle} from './press-market.js';
import {livelihoodsActive,assignFamilyWorkers,assignLivelihoodProduction} from './livelihoods.js';
import {annotateFounderOrigin} from './talent-migration.js';
// Revision 21: independent construction and service companies. Sector accounts
// are consolidation accessors; no extra deposits, capital or opening output.
import {sectorCompanies,enterpriseBusinesses,quoteMarketWeights,normalizeMarketQuotes} from './enterprise-market.js';
import {corporateDebt,issueCorporateBond,resolveCorporateBonds} from './corporate-bonds.js';
import {businessDraw} from './business-dynamics.js';
import {registerOwnerInvestment} from './wealth-owners.js';
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const normalize=a=>{const t=sum(a);return a.map(v=>t>0?v/t:1/a.length);};
const companies=(s,sector)=>sectorCompanies(s,sector);
const market=(s,sector)=>s.firmMarkets.markets.find(m=>m.sector===sector);
const total=(s,key,sector)=>sum(companies(s,sector).map(c=>c[key]??0));
const weights=(s,key,sector)=>normalize(companies(s,sector).map(c=>Math.max(0,c[key]??0)));
export const firmMarketsActive=s=>(s.economy?.revision??0)>=21;
export function initializeFirmMarkets(s){
 if(!firmMarketsActive(s))return;
 if(!s.firmMarkets){
  const oldActors=enterpriseBusinesses(s),bankClaims=new Map(oldActors.map((a,i)=>[a.id,s.foundation.businessBankClaims[i]]));
  s.firmMarkets={version:1,startedMonth:s.month,assumptions:{entryIntensity:.04,maxCompanies:12,entryCapitalShare:.002,registrationReserve:.35,reopeningMargin:.15},markets:[],last:{entries:[],completions:[]}};
  for(const sector of [3,4]){
   const f=s.firms[sector],shares=[.4,.35,.25],raw=[1.05,.97,1],mean=sum(shares.map((v,i)=>v*raw[i]));
   const rows=shares.map((share,i)=>({id:f.id+'-company-'+(i+1),sector,name:f.name+' · '+(i+1),active:true,
    ...Object.fromEntries(['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD','lastRevenue','lastProfit','lastInvestment'].map(k=>[k,(f[k]??0)*share])),
    averageRate:f.averageRate,depositIncome:0,interestPaid:0,price:f.price,relativeProductivity:raw[i]/mean,ownership:{...f.ownership},domesticOwners:[...f.domesticOwners],workerOwners:[...f.workerOwners],fundedInvestment:0,receiptWeight:share,volumeWeight:share,bankruptcies:0,last:null,foundedMonth:s.month-120,equityReturn:s.parameters.neutralRealRate,expectedRevenue:Math.max(0,f.lastRevenue*share),fixedDebtShare:.5,debtMonthsRemaining:36,debtMaturityMonths:36}));
   s.firmMarkets.markets.push({sector,mode:'operations',nextId:4,companies:rows});
   for(const [i,c] of rows.entries())bankClaims.set(c.id,(bankClaims.get(f.id)??0)*shares[i]);
   if(s.wealthOwners)for(const r of s.wealthOwners.families){for(const c of rows)r.stakes[c.id]=r.stakes[f.id]??0;delete r.stakes[f.id];}
  }
  s.foundation.businessBankClaims=enterpriseBusinesses(s).map(a=>bankClaims.get(a.id)??0);
 }
 if(livelihoodsActive(s)&&!s.firmMarkets.markets.some(m=>m.sector===0)){
  const f=s.firms[0],oldActors=enterpriseBusinesses(s),claims=new Map(oldActors.map((c,j)=>[c.id,s.foundation.businessBankClaims[j]]));
  const c={...f,id:'agriculture-company-1',agricultureProtectionClaim:true,sector:0,name:'Агрофирмы',active:true,ownership:{...f.ownership},domesticOwners:[...f.domesticOwners],workerOwners:[...f.workerOwners],relativeProductivity:1,receiptWeight:1,volumeWeight:1,fundedInvestment:0,bankruptcies:0,last:null,foundedMonth:s.month-120,expectedRevenue:f.lastRevenue,fixedDebtShare:.5,debtMonthsRemaining:36,debtMaturityMonths:36};
  s.firmMarkets.markets.push({sector:0,mode:'operations',nextId:2,companies:[c]});
  s.foundation.businessBankClaims=enterpriseBusinesses(s).map(actor=>actor.id===c.id?(claims.get(f.id)??0):(claims.get(actor.id)??0));
  if(s.wealthOwners)for(const r of s.wealthOwners.families){r.stakes[c.id]=r.stakes[f.id]??0;delete r.stakes[f.id];}
 }
 const services=market(s,4);
 if(pressEnabled(s)&&services&&!services.companies.some(c=>pressTitle(c.id))){
  const claims=new Map(enterpriseBusinesses(s).map((actor,i)=>[actor.id,s.foundation.businessBankClaims[i]]));
  carveNewspapers(s,services,claims);
  s.foundation.businessBankClaims=enterpriseBusinesses(s).map(actor=>claims.get(actor.id)??0);
  syncFirmOwnership(s,4);
 }
 for(const m of s.firmMarkets.markets){const f=s.firms[m.sector],sector=m.sector;
  for(const key of ['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD','interestPaid','depositIncome'])Object.defineProperty(f,key,{enumerable:true,configurable:true,get:()=>total(s,key,sector),set:value=>{
   const rows=companies(s,sector),old=total(s,key,sector),delta=value-old;
   let shares=key==='cash'?weights(s,m.mode==='investment'?'fundedInvestment':m.mode==='payroll'?(livelihoodsActive(s)?'drawPlanned':'workers'):delta>=0?'receiptWeight':'volumeWeight',sector):key==='workers'||key==='production'?normalize(rows.map(c=>c.active?Math.max(1e-12,c.volumeWeight):0)):weights(s,key,sector);
   if(key==='inventory'&&delta<0){const active=rows.filter(c=>c.active),dead=sum(rows.filter(c=>!c.active).map(c=>c.inventory)),oldActive=sum(active.map(c=>c.inventory)),target=Math.max(0,value-dead);let assigned=0;active.forEach((c,i)=>{c.inventory=i===active.length-1?Math.max(0,target-assigned):target*c.inventory/Math.max(oldActive,1e-30);assigned+=c.inventory;});return;}
   if(key==='production'&&livelihoodsActive(s)){assignLivelihoodProduction(s,sector,value);return;}
   if(key==='workers'&&livelihoodsActive(s)){assignFamilyWorkers(s,sector,value,shares);return;}
   if(key==='workers'||key==='production'){let used=0;rows.forEach((c,i)=>{c[key]=i===rows.length-1?Math.max(0,value-used):value*shares[i];used+=c[key];});return;}
   if(key!=='cash'&&delta<0&&old>0){for(const c of rows)c[key]*=Math.max(0,value)/old;return;}
   let used=0;rows.forEach((c,i)=>{const v=i===rows.length-1?delta-used:delta*shares[i];c[key]+=v;used+=v;});
  }});
 }
}
export function syncFirmOwnership(s,sector){
 if(!firmMarketsActive(s))return;const rows=companies(s,sector),f=s.firms[sector],shares=normalize(rows.map(c=>Math.max(1,c.capital*(s.metrics.investmentPrice??1)+c.inventory*c.price+c.cash-c.loanLC-c.loanFX*s.exchangeRate-corporateDebt(s,c))));
 for(const k of Object.keys(f.ownership))f.ownership[k]=clamp(sum(rows.map((c,i)=>c.ownership[k]*shares[i])),0,1);
 for(const k of ['domesticOwners','workerOwners'])f[k]=f[k].map((_,j)=>sum(rows.map((c,i)=>c[k][j]*shares[i])));
}
export function prepareFirmMarkets(s){
 if(!firmMarketsActive(s))return;s.firmMarkets.last={entries:[],completions:[]};
 for(const m of s.firmMarkets.markets){const rows=m.companies,shares=s.economy.revision>=23?quoteMarketWeights(rows,s.firms[m.sector].price):normalize(rows.map(c=>c.active&&c.capital>0?c.capital*c.relativeProductivity/Math.max(.05,c.price)**3:0)),price=sum(rows.map((c,i)=>c.price*shares[i]));
  rows.forEach((c,i)=>{if(!c.active)c.workers=0;c.receiptWeight=shares[i]*c.price/Math.max(price,1e-9);c.volumeWeight=shares[i];c.fundedInvestment=0;c.openingInventory=c.inventory;c.debtMonthsRemaining=Math.max(0,c.debtMonthsRemaining-1);if(c.debtMonthsRemaining===0){c.fixedDebtRate=s.bank.lendingRate;c.debtMonthsRemaining=36;}});s.firms[m.sector].price=Math.max(.000001,price);m.mode='operations';
 }
}
export function financeFirmInvestment(s,sector,desired,unit,grantLoan){
 const rows=companies(s,sector),active=rows.filter(c=>c.active),K=sum(active.map(c=>c.capital)),sectorPlan=s.economy.last.investmentPlans?.[sector];let credit=0;
 const scores=rows.map(c=>{const margin=clamp(c.lastProfit/Math.max(1,c.lastRevenue),-.5,.5),growth=clamp(c.expectedRevenue/Math.max(1,c.lastRevenue)-1,-.2,.2),cost=Math.max(.01,s.bank.lendingRate-s.expectedInflation+.04),yieldProfit=Math.max(.01,c.lastProfit*12/Math.max(1,c.capital*unit));return c.active?c.capital/Math.max(K,1e-9)*Math.exp(margin+growth)*clamp(yieldProfit/cost,.4,2):0;}),scoreTotal=sum(scores);
 for(const c of rows){
  const margin=clamp(c.lastProfit/Math.max(1,c.lastRevenue),-.5,.5),growth=clamp(c.expectedRevenue/Math.max(1,c.lastRevenue)-1,-.2,.2),cost=Math.max(.01,(s.bank.lendingRate-s.expectedInflation)+.04),profitYield=Math.max(.01,c.lastProfit*12/Math.max(1,c.capital*unit));
  const share=scoreTotal>0?scores[rows.indexOf(c)]/scoreTotal:0;
  const startup=c.active&&s.month-c.foundedMonth<6&&c.capital<1e-6?Math.max(0,c.cash/unit*.65):0;
  const plan=c.active?Math.max(startup,desired*share):0,buffer=Math.max(0,c.lastRevenue)*.2,need=Math.max(0,plan*unit+buffer-c.cash),capacity=Math.max(0,Math.min(c.lastRevenue*9,c.capital*unit*.75)-c.loanLC-c.loanFX*s.exchangeRate-corporateDebt(s,c))*.04*s.bank.creditSupply;
  c.bondIssued=c.active?issueCorporateBond(s,c,need):0;const loan=c.active?Math.min(Math.max(0,need-c.bondIssued),capacity):0;if(loan>0)grantLoan(s,c,loan,.08);credit+=loan;
  c.fundedInvestment=c.active?Math.max(0,Math.min(plan,(c.cash-buffer)/Math.max(unit,1e-9))):0;c.investmentDecision={month:s.month,kind:startup>0?'startup':'expansion-or-replacement',desired:plan,funded:c.fundedInvestment,profitYield,requiredReturn:cost,margin,expectedGrowth:growth,sectorRequiredReturn:sectorPlan?.required??null};
 }
 return {funded:sum(rows.map(c=>c.fundedInvestment)),loan:credit,desired:sum(rows.map(c=>c.investmentDecision.desired))};
}
export function firmProjectAllocation(s,sector){const rows=companies(s,sector),total=sum(rows.map(c=>c.fundedInvestment));return {firmIds:rows.map(c=>c.id),firmShares:rows.map(c=>total>0?c.fundedInvestment/total:0)};}
export function completeFirmCapital(s,sector,amount,project){const rows=companies(s,sector),shares=project.firmIds?rows.map(c=>project.firmShares[project.firmIds.indexOf(c.id)]??0):weights(s,'capital',sector);rows.forEach((c,i)=>c.capital+=amount*shares[i]);s.firmMarkets.last.completions.push({sector,amount,firmIds:project.firmIds??rows.map(c=>c.id)});}

export function additionalCapacityFactor(s,sector){
 const rows=companies(s,sector);if(!rows.length)return 1;
 const a=s.economy.parameters.capitalShare,K=total(s,'capital',sector),L=total(s,'workers',sector);
 return K>0?sum(rows.map(c=>c.active?c.relativeProductivity*Math.pow(Math.max(0,c.capital),a)*Math.pow(Math.max(0,L>0?c.workers/L:c.volumeWeight),1-a):0))/Math.pow(K,a):0;
}

export function firmProfitPlan(s,sector,{revenue,inputs,payroll,depreciation}){
 const rows=companies(s,sector),out=[];
 const sold=rows.map(c=>Math.max(0,c.production+(c.openingInventory??c.inventory)-c.inventory));
 const receipts=normalize(rows.map((c,i)=>sold[i]*c.price));
 let moved=0;for(const [i,c] of rows.entries()){const delta=i===rows.length-1?-moved:revenue*(receipts[i]-c.receiptWeight);c.cash+=delta;moved+=delta;c.receiptWeight=receipts[i];}
 for(const [i,c] of rows.entries()){
  const sales=revenue*c.receiptWeight,cost=inputs*(livelihoodsActive(s)?(c.productionWeight??c.volumeWeight):c.volumeWeight),pay=payroll*weights(s,livelihoodsActive(s)?'drawPlanned':'workers',sector)[i],wear=depreciation*weights(s,'capital',sector)[i];
  const profit=sales-cost-pay-wear-c.interestPaid-(c.bondInterestPaid??0)-(c.lastLandRent??0)+(c.landRentReceived??0);
  const tax=Math.max(0,profit)*s.policy.corporateTax/100*s.institutions.taxCompliance;
  c.lastRevenue=sales;c.lastProfit=profit-tax;c.last={month:s.month,revenue:sales,inputCost:cost,payroll:pay,depreciation:wear,interest:c.interestPaid+(c.bondInterestPaid??0),bondIssued:c.bondIssued??0,corporateDebt:corporateDebt(s,c),investmentDecision:c.investmentDecision??null,profit,tax,investment:c.lastInvestment,investmentPlan:c.fundedInvestment,unitsSold:sold[i],transactionPrice:sold[i]>0?sales/sold[i]:null};out.push({company:c,profit,tax});
 }
 return out;
}

export function resolveFirm(s,sector,c,flow,events,{grantLoan,repayLoan,writeOff,transfer}){
 c.last??={};
 const netAssets=c.capital*(s.metrics.investmentPrice??1)+c.inventory*c.price+c.cash-c.loanLC-c.loanFX*s.exchangeRate-corporateDebt(s,c);
 if(c.cash>=0&&!(c.active&&netAssets<0&&(c.unpaidInterest??0)>1e-8)&&!((c.bondArrears??0)>1e-8))return {credit:0,loss:0};
 // Payments already settled require an explicit bridge overdraft, not a cash reset.
 const short=Math.max(0,-c.cash);if(short>0)grantLoan(s,c,short);let loss=0;
 const equity=c.capital*(s.metrics.investmentPrice??1)+c.inventory*c.price-c.loanLC-c.loanFX*s.exchangeRate-corporateDebt(s,c);
 if(equity>0&&!((c.bondArrears??0)>1e-8)){c.last.overdraft=short;c.last.solventLiquidityBridge=short>0;return {credit:short,loss:0};}
 c.active=false;c.bankruptcies++;c.last.bankruptMonth=s.month;
 // Paid liquidation: another firm buys existing equipment, no new capital/GDP.
 const buyer=companies(s,sector).filter(x=>x!==c&&x.active).sort((a,b)=>b.cash-b.lastRevenue*.3-(a.cash-a.lastRevenue*.3))[0];
 if(buyer){const offered=Math.max(0,buyer.cash-buyer.lastRevenue*.3),value=(c.capital*(s.metrics.investmentPrice??1)+c.inventory*c.price)*.5,paid=Math.min(offered,value);
  if(paid>0){transfer(buyer,c,paid);transferCompanySites(c,buyer);buyer.capital+=c.capital;buyer.inventory+=c.inventory;c.capital=0;c.inventory=0;repayLoan(s,c,c.cash);c.last.liquidationProceeds=paid;
   if(firmMarketsActive(s))for(const project of s.projects.filter(p=>p.type==='private'&&p.sector===sector&&p.firmShares)){
    project.firmIds??=project.firmShares.map((_,i)=>s.firms[sector].id+'-company-'+(i+1));
    const from=project.firmIds.indexOf(c.id);if(from<0||!project.firmShares[from])continue;
    let to=project.firmIds.indexOf(buyer.id);if(to<0){to=project.firmIds.length;project.firmIds.push(buyer.id);project.firmShares.push(0);}
    project.firmShares[to]+=project.firmShares[from];project.firmShares[from]=0;
   }
  }
 }
 loss=writeOff(s,c,1);
 c.last.bondResolution=resolveCorporateBonds(s,c);
 // Old owners lose their claim. The liquidation estate has no dividends; future
 // recoveries belong to bank shareholders through the bank's recovery account.
 flow.externalEquityRevaluation+=c.foreignEquityUSD;c.foreignEquityUSD=0;
 c.ownership={state:0,municipal:0,foreign:0,cooperative:0,domestic:1};c.domesticOwners=s.households.map(h=>h.dividendShare);c.workerOwners=s.households.map(()=>0);
 events.push(`${c.name}: банкротство; имущество продано за реальные средства, потери кредитора ${loss.toFixed(1)} млн.`);
 return {credit:short,loss};
}

export function finishFirmMarket(s,sector,basePrice){
 const rows=companies(s,sector);if(!rows.length)return;
 const f=s.firms[sector];
 for(const c of rows){const margin=c.lastProfit/Math.max(1,c.lastRevenue);c.price=basePrice*Math.exp(clamp(-.12*Math.log(c.relativeProductivity)-.04*margin,-.12,.12));}
 if(s.economy.revision>=23)normalizeMarketQuotes(rows,basePrice);else {const index=sum(rows.map(c=>c.price*c.volumeWeight));if(index>0)for(const c of rows)c.price*=basePrice/index;}
 f.price=basePrice;
 f.lastProfit=sum(rows.map(c=>c.lastProfit));syncFirmOwnership(s,sector);
 for(const c of rows)c.expectedRevenue+=.15*(Math.max(0,c.lastRevenue)-c.expectedRevenue);
}

export function enterFirm(s,sector,unit,foreignBudget,foreignPayment){
 if(!firmMarketsActive(s))return {foreignUSD:0};const m=market(s,sector),rows=m.companies,a=s.firmMarkets.assumptions,f=s.firms[sector],plan=s.economy.last.investmentPlans?.[sector];
 const reopening=rows.every(c=>!c.active)&&Math.max(0,f.unfilledOrders??0)>0;
 const recoveryBudget=Math.max(1,f.capital*a.entryCapitalShare*unit),potentialSales=Math.min(Math.max(0,f.unfilledOrders??0),s.base.output[sector]*Math.pow(Math.min(1,recoveryBudget/Math.max(1,f.capital*unit)),s.economy.parameters.capitalShare))*f.price,expectedRecoveryReturn=potentialSales*a.reopeningMargin*12/recoveryBudget;
 const viableRecovery=reopening&&expectedRecoveryReturn>Math.max(.02,s.bank.lendingRate-s.expectedInflation)+.04;
 const score=Math.max(plan?.foreignScore??0,reopening?.1:0),domesticScore=s.economy.revision>=24?Math.max((plan?.operatingYield??0)-(plan?.required??0),viableRecovery?.1:0):score,barrier=Math.min(1,30/Math.max(30,s.institutions.registrationDays))*s.institutions.contractReliability,probability=a.entryIntensity*barrier*Math.min(1,Math.max(0,score/.1));
 if(rows.filter(c=>c.active&&!pressTitle(c.id)).length>=a.maxCompanies)return {foreignUSD:0};
 const domesticProbability=a.entryIntensity*barrier*Math.min(1,Math.max(0,domesticScore/.1));
 const foreign=s.policy.foreignBusinessEntry&&foreignBudget*s.exchangeRate>=recoveryBudget&&businessDraw(s.seed,s.month,200+sector)<probability;
 if(!foreign&&(!s.policy.privateBusinessEntry||!viableRecovery&&businessDraw(s.seed,s.month,220+sector)>=domesticProbability))return {foreignUSD:0};
 const budget=Math.max(1,f.capital*a.entryCapitalShare*unit);if(foreign&&foreignBudget*s.exchangeRate<budget)return {foreignUSD:0};
 const room=s.households.map((h,i)=>Math.max(0,h.cash-Math.max(0,h.income)*(.35+.10*(9-i)))),total=sum(room);if(!foreign&&total<budget)return {foreignUSD:0};
 const c={id:f.id+'-company-'+m.nextId++,sector,name:f.name+' · новая компания',active:true,cash:0,loanLC:0,loanFX:0,capital:0,inventory:0,workers:0,production:0,foreignEquityUSD:0,lastRevenue:0,lastProfit:0,lastInvestment:0,averageRate:s.bank.lendingRate,depositIncome:0,interestPaid:0,price:f.price,relativeProductivity:.9+.2*businessDraw(s.seed,s.month,300+m.nextId+sector*100),ownership:{state:0,foreign:foreign?1:0,domestic:foreign?0:1,municipal:0,cooperative:0},domesticOwners:room.map(v=>foreign?0:v/total),workerOwners:room.map(()=>0),fundedInvestment:0,receiptWeight:0,volumeWeight:0,bankruptcies:0,last:null,foundedMonth:s.month,equityReturn:s.parameters.neutralRealRate,expectedRevenue:0,fixedDebtShare:.5,debtMonthsRemaining:36,debtMaturityMonths:36};
 const oldActors=enterpriseBusinesses(s),claims=new Map(oldActors.map((actor,i)=>[actor.id,s.foundation.businessBankClaims[i]]));
 if(foreign){foreignPayment(s,c,budget/s.exchangeRate);c.foreignEquityUSD=budget/s.exchangeRate;c.externalEquityCashLC=budget;}else{const paid=room.map(v=>budget*v/total);registerOwnerInvestment(s,c,paid);paid.forEach((v,i)=>{s.households[i].cash-=v;c.cash+=v;});}
 annotateFounderOrigin(s,c,foreign);
 let acquiredExistingCapital=0,assetPurchasePaid=0;
 const estate=rows.filter(x=>!x.active&&x.capital>0).sort((a,b)=>b.capital-a.capital)[0];
 if(estate){const quote=(estate.capital*unit+estate.inventory*estate.price)*.5,paid=Math.min(Math.max(0,c.cash)*.5,quote),fraction=quote>0?paid/quote:0;
  if(paid>0){const capital=estate.capital*fraction,inventory=estate.inventory*fraction;c.cash-=paid;transferCompanySites(estate,c,capital);estate.capital-=capital;estate.inventory-=inventory;c.capital+=capital;c.inventory+=inventory;acquiredExistingCapital=capital;assetPurchasePaid=paid;
   // The liquidation estate belongs to the creditor recovery account. Actual
   // payment extinguishes deposits and restores bank equity, never new output.
   s.bank.equity+=paid;
  }
 }
 rows.push(c);s.foundation.businessBankClaims=enterpriseBusinesses(s).map(a=>claims.get(a.id)??0);syncFirmOwnership(s,sector);s.firmMarkets.last.entries.push({id:c.id,sector,month:s.month,foreign,paid:budget,capitalAtEntry:0,acquiredExistingCapital,assetPurchasePaid,expectedRecoveryReturn:viableRecovery?expectedRecoveryReturn:null});return {foreignUSD:foreign?budget/s.exchangeRate:0};
}
export function validateFirmMarkets(s){
 if(!firmMarketsActive(s))return;const m=s.firmMarkets,near=(a,b)=>Math.abs(a-b)<Math.max(1e-6,Math.abs(b)*1e-8);
 if(!m||m.version!==1||m.markets?.length!==(livelihoodsActive(s)?3:2)||!Number.isInteger(m.startedMonth)||m.startedMonth>s.month)throw new Error('Повреждены рынки фирм');
 for(const market of m.markets){const rows=market.companies,sector=market.sector;if(!(livelihoodsActive(s)?[0,3,4]:[3,4]).includes(sector)||!Array.isArray(rows)||rows.length<(sector===0?1:3)||rows.filter(c=>c.active&&!pressTitle(c.id)).length>m.assumptions.maxCompanies||new Set(rows.map(c=>c.id)).size!==rows.length)throw new Error('Повреждён состав фирм');
  for(const c of rows)if(c.sector!==sector||typeof c.active!=='boolean'||['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD','price'].some(k=>!Number.isFinite(c[k])||c[k]<-1e-8)||!near(sum(Object.values(c.ownership)),1)||!near(sum(c.domesticOwners),c.ownership.domestic)||!near(sum(c.workerOwners),c.ownership.cooperative))throw new Error('Повреждены счета фирмы '+c.id);
  for(const k of ['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD'])if(!near(s.firms[sector][k],sum(rows.map(c=>c[k]))))throw new Error('Нарушена консолидация фирм '+k);
 }
 for(const p of s.projects.filter(p=>p.firmIds))if(!(livelihoodsActive(s)?[0,3,4]:[3,4]).includes(p.sector)||p.firmShares?.length!==p.firmIds.length||!near(sum(p.firmShares),1)||p.firmIds.some(id=>!companies(s,p.sector).some(c=>c.id===id)))throw new Error('Повреждены получатели проектов фирм');
}

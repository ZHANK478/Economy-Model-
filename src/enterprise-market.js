import {OPENING_INDUSTRY_SHARES} from './company-specialization.js';
import {transferCompanySites} from './company-geography.js';
import {payTerritorialDividends} from './territorial-assets.js';
import {issueCorporateBond,corporateDebt,resolveCorporateBonds} from './corporate-bonds.js';
import {businessDynamicsActive,independentEnterprisePlans} from './business-dynamics.js';
// Four producers of the same industrial basket. The sector is a consolidation,
// never an extra bank account. Technology, entry barriers and elasticities are
// scenario assumptions, not empirically estimated firm behaviour.
const sum=a=>a.reduce((x,y)=>x+y,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const normalize=a=>{const t=sum(a);return t>0?a.map(x=>x/t):a.map(()=>1/a.length);};
export const enterpriseMarketActive=s=>(s.economy?.revision??0)>=16;
export const industryCompanies=s=>enterpriseMarketActive(s)?s.enterpriseMarket?.companies??[]:[];
const total=(s,key)=>sum(industryCompanies(s).map(c=>c[key]??0));
const weights=(s,key)=>normalize(industryCompanies(s).map(c=>Math.max(0,c[key]??0)));
const distribute=(s,key,value,shares)=>{const rows=industryCompanies(s),old=total(s,key),delta=value-old;if((s.economy?.revision??0)>=17&&key!=='cash'&&delta<0&&old>0){rows.forEach(c=>{c[key]*=Math.max(0,value)/old;});return;}let used=0;rows.forEach((c,i)=>{const amount=i===rows.length-1?delta-used:delta*shares[i];c[key]+=amount;if(key!=='cash'&&c[key]<0&&c[key]>-1e-8)c[key]=0;used+=amount;});};
export function initializeEnterpriseMarket(s){
 if(!enterpriseMarketActive(s))return;
 const f=s.firms[2],created=!s.enterpriseMarket;
 if(!s.enterpriseMarket){
  const shares=OPENING_INDUSTRY_SHARES,raw=[1.04,.96,1.10,.90],normal=sum(shares.map((q,i)=>q*raw[i]));
  s.enterpriseMarket={version:1,startedMonth:s.month,mode:'operations',companies:shares.map((share,i)=>({
   id:'industry-'+(i+1),name:['Завод «Север»','Завод «Вектор»','Завод «Меридиан»','Завод «Союз»'][i],active:true,
   ...Object.fromEntries(['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD','lastRevenue','lastProfit','lastInvestment'].map(k=>[k,(f[k]??0)*share])),
   averageRate:f.averageRate,depositIncome:0,interestPaid:0,price:f.price,relativeProductivity:raw[i]/normal,
   ownership:{...f.ownership},domesticOwners:f.domesticOwners.map(x=>x),workerOwners:f.workerOwners.map(x=>x),
   fundedInvestment:0,receiptWeight:share,volumeWeight:share,bankruptcies:0,last:null
  })),history:[]};
 }
 // Reattach after JSON copy/load. Accessors are enumerable for existing exports.
 for(const key of ['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD','interestPaid','depositIncome'])Object.defineProperty(f,key,{enumerable:true,configurable:true,get:()=>total(s,key),set:value=>{
  let shares;
  if(key==='cash')shares=s.enterpriseMarket.mode==='investment'?weights(s,'fundedInvestment'):value>=total(s,key)?weights(s,'receiptWeight'):s.enterpriseMarket.mode==='payroll'?weights(s,'workers'):weights(s,'volumeWeight');
  else if(key==='workers')shares=normalize(industryCompanies(s).map(c=>c.active?Math.max(1e-9,c.volumeWeight):0));
  else if(key==='inventory')shares=normalize(industryCompanies(s).map(c=>c.active?Math.max(0,value>=total(s,key)?c.volumeWeight:c.inventory):0));
  else if(key==='production')shares=weights(s,'volumeWeight');
  else shares=weights(s,key);
  if(key==='inventory'&&value<total(s,key)){const rows=industryCompanies(s),inactive=sum(rows.filter(c=>!c.active).map(c=>c.inventory)),active=rows.filter(c=>c.active),target=Math.max(0,value-inactive),old=sum(active.map(c=>c.inventory));let assigned=0;active.forEach((c,i)=>{c.inventory=i===active.length-1?Math.max(0,target-assigned):target*c.inventory/Math.max(old,1e-30);assigned+=c.inventory;});}
  else if(key==='workers'||key==='production'){let assigned=0;industryCompanies(s).forEach((c,i,rows)=>{c[key]=i===rows.length-1?Math.max(0,value-assigned):Math.max(0,value*shares[i]);assigned+=c[key];});}else distribute(s,key,value,shares);
 }});
 if(s.foundation&&!s.enterpriseMarket.bankClaimsExpanded){const old=s.foundation.businessBankClaims;if(old?.length===8)s.foundation.businessBankClaims=[...old.slice(0,2),...OPENING_INDUSTRY_SHARES.map(q=>q*old[2]),...old.slice(3)];s.enterpriseMarket.bankClaimsExpanded=true;}
 if(created)syncEnterpriseOwnership(s);
}
export function syncEnterpriseOwnership(s){
 const rows=industryCompanies(s);if(!rows.length)return;
 const f=s.firms[2],p=s.metrics.investmentPrice??1;
 const shares=normalize(rows.map(c=>Math.max(1,c.capital*p+c.inventory*c.price+c.cash-c.loanLC-c.loanFX*s.exchangeRate)));
 for(const k of Object.keys(f.ownership))f.ownership[k]=sum(rows.map((c,i)=>c.ownership[k]*shares[i]));
 f.domesticOwners=f.domesticOwners.map((_,j)=>sum(rows.map((c,i)=>c.domesticOwners[j]*shares[i])));
 f.workerOwners=f.workerOwners.map((_,j)=>sum(rows.map((c,i)=>c.workerOwners[j]*shares[i])));
}
// Revision 23 uses the same price-sensitive quantity weights when quoting and
// allocating the next month. The numerical floor is relative to the common
// sector quote, so a currency-unit change cannot alter market shares.
export function quoteMarketWeights(rows,referencePrice){
 return normalize(rows.map(c=>c.active&&!c.familyDormant&&c.capital>0?c.capital*c.relativeProductivity/Math.max(.05,c.price/Math.max(referencePrice,1e-12))**3:0));
}
export function normalizeMarketQuotes(rows,basePrice){
 const shares=quoteMarketWeights(rows,basePrice),index=sum(rows.map((c,i)=>c.price*shares[i]));
 if(index>0)for(const c of rows)c.price*=basePrice/index;
}
export function prepareEnterpriseMarket(s){
 const rows=industryCompanies(s);if(!rows.length)return;
 for(const c of rows)if(!c.active)c.workers=0;
 const shares=s.economy.revision>=23?quoteMarketWeights(rows,s.firms[2].price):normalize(rows.map(c=>c.active?Math.max(1e-9,c.capital)*c.relativeProductivity/Math.max(.05,c.price)**3:0));
 const price=sum(rows.map((c,i)=>c.price*shares[i]));
 for(const [i,c] of rows.entries()){c.receiptWeight=shares[i]*c.price/Math.max(price,1e-9);c.volumeWeight=shares[i];c.fundedInvestment=0;c.openingInventory=c.inventory;}
 const f=s.firms[2];f.price=Math.max(.000001,price);
 s.enterpriseMarket.mode='operations';
}
export function enterpriseCapacityFactor(s){
 const rows=industryCompanies(s);if(!rows.length)return 1;
 const a=s.economy.parameters.capitalShare,K=total(s,'capital'),L=total(s,'workers');
 return K>0&&L>0?sum(rows.map(c=>c.active?c.relativeProductivity*Math.pow(Math.max(0,c.capital),a)*Math.pow(Math.max(0,c.workers),1-a):0))/(Math.pow(K,a)*Math.pow(L,1-a)):0;
}
export function financeEnterpriseInvestment(s,desired,unit,grantLoan){
 const rows=industryCompanies(s);if(businessDynamicsActive(s)&&s.economy.last.investmentPlans?.[2])desired=independentEnterprisePlans(s,s.economy.last.investmentPlans[2],unit);
 const share=normalize(rows.map(c=>c.active?(businessDynamicsActive(s)?c.desiredInvestment:Math.max(1e-9,c.capital)*Math.exp(clamp(c.lastProfit/Math.max(1,c.lastRevenue),-.5,.5))):0));let credit=0;
 for(const [i,c] of rows.entries()){
  const plan=desired*share[i],buffer=Math.max(0,c.lastRevenue)*.2,need=Math.max(0,plan*unit+buffer-c.cash);
  const capacity=Math.max(0,Math.min(c.lastRevenue*9,c.capital*unit*.75)-c.loanLC-c.loanFX*s.exchangeRate-corporateDebt(s,c))*.04*s.bank.creditSupply;
  const bond=c.active?issueCorporateBond(s,c,need):0;
  c.bondIssued=bond;const loan=c.active?Math.min(Math.max(0,need-bond),capacity):0;if(loan>0)grantLoan(s,c,loan,.08);credit+=loan;
  c.fundedInvestment=c.active?Math.max(0,Math.min(plan,(c.cash-buffer)/Math.max(unit,1e-9))):0;
 }
 return {funded:sum(rows.map(c=>c.fundedInvestment)),loan:credit,desired};
}
export function completeEnterpriseCapital(s,amount,allocations,ids){
 const rows=industryCompanies(s);if(!rows.length)return false;
 const shares=ids?rows.map(c=>allocations[ids.indexOf(c.id)]??0):allocations?rows.map((_,i)=>allocations[i]??0):weights(s,'capital');rows.forEach((c,i)=>{c.capital+=amount*(shares[i]??0);});return true;
}
export function enterpriseProfitPlan(s,{revenue,inputs,payroll,depreciation}){
 const rows=industryCompanies(s),out=[];
 const sold=rows.map(c=>Math.max(0,c.production+(c.openingInventory??c.inventory)-c.inventory));
 const receipts=normalize(rows.map((c,i)=>sold[i]*c.price));
 let moved=0;for(const [i,c] of rows.entries()){const delta=i===rows.length-1?-moved:revenue*(receipts[i]-c.receiptWeight);c.cash+=delta;moved+=delta;c.receiptWeight=receipts[i];}
 for(const [i,c] of rows.entries()){
  const sales=revenue*c.receiptWeight,cost=inputs*c.volumeWeight,pay=payroll*weights(s,'workers')[i],wear=depreciation*weights(s,'capital')[i];
  const profit=sales-cost-pay-wear-c.interestPaid-(c.bondInterestPaid??0);
  const tax=Math.max(0,profit)*s.policy.corporateTax/100*s.institutions.taxCompliance;
  c.lastRevenue=sales;c.lastProfit=profit-tax;c.last={month:s.month,revenue:sales,inputCost:cost,payroll:pay,depreciation:wear,interest:c.interestPaid+(c.bondInterestPaid??0),bondIssued:c.bondIssued??0,corporateDebt:corporateDebt(s,c),investmentDecision:c.investmentDecision??null,profit,tax,investment:c.lastInvestment,investmentPlan:c.fundedInvestment,unitsSold:sold[i],transactionPrice:sold[i]>0?sales/sold[i]:null};out.push({company:c,profit,tax});
 }
 return out;
}
export function settleEnterpriseDividends(s,plans,flow,{transfer,foreignPayment,availableFX,onIncome}){
 let foreignDividendsUSD=0,reinvestedFDIUSD=0;
 for(const {company:c,profit,tax} of plans){
  transfer(c,s.government,tax);flow.corporateTax+=tax;
  const dividend=c.active?Math.min(Math.max(0,profit-tax)*s.parameters.dividendPayout,Math.max(0,c.cash)*.30):0;
  const external=Math.min(dividend*c.ownership.foreign,availableFX()*s.exchangeRate);foreignPayment(s,c,-external/s.exchangeRate);foreignDividendsUSD+=external/s.exchangeRate;
  const retained=Math.max(-c.foreignEquityUSD,((profit-tax)*c.ownership.foreign-external)/s.exchangeRate);c.foreignEquityUSD+=retained;reinvestedFDIUSD+=retained;
  payTerritorialDividends(s,c,dividend,flow,transfer);
  s.households.forEach((h,j)=>{const value=dividend*(c.domesticOwners[j]+c.workerOwners[j]);transfer(c,h,value);onIncome(j,value,c);});
 }
 return {foreignDividendsUSD,reinvestedFDIUSD};
}
export function resolveEnterprise(s,c,flow,events,{grantLoan,repayLoan,writeOff,transfer}){
 c.last??={};
 const netAssets=c.capital*(s.metrics.investmentPrice??1)+c.inventory*c.price+c.cash-c.loanLC-c.loanFX*s.exchangeRate-corporateDebt(s,c);
 if(c.cash>=0&&!(c.active&&netAssets<0&&(c.unpaidInterest??0)>1e-8)&&!((c.bondArrears??0)>1e-8))return {credit:0,loss:0};
 // Payments already settled require an explicit bridge overdraft, not a cash reset.
 const short=Math.max(0,-c.cash);if(short>0)grantLoan(s,c,short);let loss=0;
 const equity=c.capital*(s.metrics.investmentPrice??1)+c.inventory*c.price-c.loanLC-c.loanFX*s.exchangeRate;
 if(equity>0&&short<=Math.max(1,c.lastRevenue*.2)&&!((c.bondArrears??0)>1e-8)){c.last.overdraft=short;return {credit:short,loss:0};}
 c.active=false;c.bankruptcies++;c.last.bankruptMonth=s.month;
 // Paid liquidation: another firm buys existing equipment, no new capital/GDP.
 const buyer=industryCompanies(s).filter(x=>x!==c&&x.active).sort((a,b)=>b.cash-b.lastRevenue*.3-(a.cash-a.lastRevenue*.3))[0];
 if(buyer){const offered=Math.max(0,buyer.cash-buyer.lastRevenue*.3),value=(c.capital*(s.metrics.investmentPrice??1)+c.inventory*c.price)*.5,paid=Math.min(offered,value);
  if(paid>0){transfer(buyer,c,paid);transferCompanySites(c,buyer);buyer.capital+=c.capital;buyer.inventory+=c.inventory;c.capital=0;c.inventory=0;repayLoan(s,c,c.cash);c.last.liquidationProceeds=paid;
   if(businessDynamicsActive(s))for(const project of s.projects.filter(p=>p.type==='private'&&p.sector===2&&p.enterpriseShares)){
    project.enterpriseIds??=project.enterpriseShares.map((_,i)=>'industry-'+(i+1));
    const from=project.enterpriseIds.indexOf(c.id);if(from<0||!project.enterpriseShares[from])continue;
    let to=project.enterpriseIds.indexOf(buyer.id);if(to<0){to=project.enterpriseIds.length;project.enterpriseIds.push(buyer.id);project.enterpriseShares.push(0);}
    project.enterpriseShares[to]+=project.enterpriseShares[from];project.enterpriseShares[from]=0;
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
export function finishEnterpriseMarket(s,basePrice){
 const rows=industryCompanies(s);if(!rows.length)return;
 const f=s.firms[2];
 for(const c of rows){const margin=c.lastProfit/Math.max(1,c.lastRevenue);c.price=basePrice*Math.exp(clamp(-.12*Math.log(c.relativeProductivity)-.04*margin,-.12,.12));}
 if((s.economy?.revision??0)>=23){normalizeMarketQuotes(rows,basePrice);f.price=basePrice;}else if((s.economy?.revision??0)>=21){const index=sum(rows.map(c=>c.price*c.volumeWeight));if(index>0)for(const c of rows)c.price*=basePrice/index;f.price=basePrice;}else f.price=sum(rows.map(c=>c.price*c.volumeWeight));
 f.lastProfit=sum(rows.map(c=>c.lastProfit));syncEnterpriseOwnership(s);
 s.enterpriseMarket.history.push({month:s.month,companies:rows.map(c=>({id:c.id,cash:c.cash,loan:c.loanLC+c.loanFX*s.exchangeRate,price:c.price,profit:c.lastProfit,active:c.active}))});s.enterpriseMarket.history=s.enterpriseMarket.history.slice(-120);
}
export function validateEnterpriseMarket(s){
 if(!enterpriseMarketActive(s)){if(s.enterpriseMarket)throw new Error('Предприятия вне поддерживаемой ревизии');return;}
 const m=s.enterpriseMarket;if(!m||m.version!==1||!Number.isInteger(m.startedMonth)||m.startedMonth<0||m.startedMonth>s.month||!['operations','investment','payroll'].includes(m.mode)||!Array.isArray(m.companies)||m.companies.length<4||(!(s.economy.revision>=17)&&m.companies.length!==4)||new Set(m.companies.map(c=>c.id)).size!==m.companies.length||m.companies.some(c=>!/^industry-[1-9][0-9]*$/.test(c.id)))throw new Error('Повреждён рынок предприятий');
 for(const c of m.companies){if(typeof c.active!=='boolean'||['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD','price'].some(k=>!Number.isFinite(c[k])||c[k]<0)||c.price<=0)throw new Error('Повреждены счета предприятия '+c.id+': '+JSON.stringify(Object.fromEntries(['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD','price'].filter(k=>!Number.isFinite(c[k])||c[k]<0).map(k=>[k,c[k]]))));if(Math.abs(sum(Object.values(c.ownership))-1)>1e-8||Object.values(c.ownership).some(x=>!Number.isFinite(x)||x<0)||!Array.isArray(c.domesticOwners)||!Array.isArray(c.workerOwners)||c.domesticOwners.length!==10||c.workerOwners.length!==10||[...c.domesticOwners,...c.workerOwners].some(x=>!Number.isFinite(x)||x<0)||Math.abs(sum(c.domesticOwners)-c.ownership.domestic)>1e-8||Math.abs(sum(c.workerOwners)-c.ownership.cooperative)>1e-8)throw new Error('Повреждены собственники предприятия');}
 for(const a of s.pendingActions??[])if(a.enterpriseId!==undefined&&(!sectorCompanies(s,a.sector).some(c=>c.id===a.enterpriseId)))throw new Error('Неизвестное предприятие в операции');
 for(const key of ['cash','loanLC','loanFX','capital','inventory','workers','production','foreignEquityUSD'])if(Math.abs(s.firms[2][key]-total(s,key))>Math.max(1e-6,Math.abs(s.firms[2][key])*1e-9))throw new Error('Двойной учёт счетов предприятий: '+key);
}
export function enterpriseAvailableInventory(s,f){return sectorCompanies(s,s.firms.indexOf(f)).length?sum(sectorCompanies(s,s.firms.indexOf(f)).filter(c=>c.active).map(c=>c.inventory)):f.inventory;}
export function enterpriseEndingInventory(s,f,value){return value+(sectorCompanies(s,s.firms.indexOf(f)).length?sum(sectorCompanies(s,s.firms.indexOf(f)).filter(c=>!c.active).map(c=>c.inventory)):0);}

export function sectorCompanies(s,sector){return sector===2?industryCompanies(s):(s.economy?.revision??0)>=21?s.firmMarkets?.markets.find(m=>m.sector===sector)?.companies??[]:[];}
export function enterpriseBusinesses(s){return [...s.firms.flatMap((f,i)=>sectorCompanies(s,i).length?sectorCompanies(s,i):[f]),...s.networks.map(n=>n.operator)];}
export function enterpriseTransferMessage(s,a,n){
 const name=sectorCompanies(s,a.sector??2).find(c=>c.id===a.enterpriseId)?.name??'Предприятие';
 if(a.rejected)return `${name}: передача не исполнена${a.reason==='insolvency-estate'?' — предприятие находится в ликвидации':''}.`;
 return `${name}: передано ${n(a.actualPoints??0,1)} п.п.${(a.actualPoints??0)+1e-8<a.points?' (частично)':''}; оплачено ${n(a.cost??0,1)} млн.`;
}

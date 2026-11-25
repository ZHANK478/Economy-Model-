import {sectorCompanies} from './enterprise-market.js';
// Primary fixed-coupon corporate debt, held by domestic households. Claims are
// separate from bank loans/deposits; coupon/principal payments are transfers.
const sum=a=>a.reduce((a,b)=>a+b,0);
export const corporateIssuers=s=>(s.economy?.revision??0)>=17?s.firms.flatMap((_,i)=>sectorCompanies(s,i)):[];
export const corporateDebt=(s,c)=>sum((c?(s.firms.includes(c)&&sectorCompanies(s,s.firms.indexOf(c)).length?sectorCompanies(s,s.firms.indexOf(c)):[c]):corporateIssuers(s)).flatMap(c=>(c.bonds??[]).map(b=>b.principal)));
export const householdCorporateBonds=(s,i)=>sum(corporateIssuers(s).flatMap(c=>(c.bonds??[]).map(b=>b.holdings[i])));
export function issueCorporateBond(s,c,requested,{refinancePrincipal=0}={}){
 if((s.economy?.revision??0)<17||s.policy.corporateBondMarket===false||requested<=0||!c.active||s.month-c.foundedMonth<36||c.capital<s.firms[c.sector??2].capital*.10)return 0;
 const rate=Math.max(.01,s.bank.lendingRate+.015),premium=rate-s.bank.depositRate;
 const room=s.households.map((h,i)=>Math.max(0,Math.min(h.cash*.05,h.cash-Math.max(0,h.income)*(.35+.1*(9-i))))*Math.min(1,Math.max(0,premium/.05)));
 const total=sum(room),issued=Math.min(requested,total,Math.max(0,c.capital*(s.metrics.investmentPrice??1)*.35-Math.max(0,corporateDebt(s,c)-refinancePrincipal)));
 if(issued<=0)return 0;
 const holdings=room.map(v=>issued*v/total);holdings.forEach((v,i)=>{s.households[i].cash-=v;c.cash+=v;});
 c.bonds??=[];c.bonds.push({id:c.id+'-bond-'+s.month+'-'+c.bonds.length,principal:issued,holdings,rate,issuedMonth:s.month,maturity:s.month+60});
 return issued;
}
export function serviceCorporateBonds(s,{grantLoan}={}){
 if((s.economy?.revision??0)<17)return [];
 for(const h of s.households)h.corporateBondIncome=0;
 const report=[];
 for(const c of corporateIssuers(s)){
  if((s.economy?.revision??0)>=21){
   const due=sum((c.bonds??[]).filter(b=>b.maturity<=s.month).map(b=>b.principal)),shortfall=Math.max(0,due-Math.max(0,c.cash)),solvent=c.capital*(s.metrics.investmentPrice??1)+c.inventory*c.price+c.cash-c.loanLC-c.loanFX*s.exchangeRate-corporateDebt(s,c)>0;
   const refinanced=solvent&&shortfall>0?issueCorporateBond(s,c,shortfall,{refinancePrincipal:due}):0;
   if(refinanced>0)report.push({issuer:c.id,kind:'paid-refinancing',principalDue:due,refinanced});
  }
  if((s.economy?.revision??0)>=21&&grantLoan&&c.active){
   const due=sum((c.bonds??[]).map(b=>(b.issuedMonth>=s.month?0:b.principal*Math.expm1(Math.log1p(b.rate)/12))+(b.maturity<=s.month?b.principal:0))),short=Math.max(0,due-Math.max(0,c.cash));
   const collateral=Math.max(0,c.capital*(s.metrics.investmentPrice??1)*.75-c.loanLC-c.loanFX*s.exchangeRate-corporateDebt(s,c)),creditLimit=Math.min(collateral,Math.max(0,c.lastRevenue)*9)*.04*s.bank.creditSupply;
   if(short>0&&short<=creditLimit){grantLoan(s,c,short);report.push({issuer:c.id,kind:'secured-liquidity-loan',loan:short});}
  }
  c.bondInterestPaid=0;c.bondArrears=0;
  for(const b of c.bonds??[]){
   const coupon=(s.economy?.revision>=21&&b.issuedMonth>=s.month)?0:b.principal*Math.expm1(Math.log1p(b.rate)/12),principalDue=b.maturity<=s.month?b.principal:0,due=coupon+principalDue,paid=Math.min(Math.max(0,c.cash),due),interest=Math.min(coupon,paid),principal=Math.max(0,paid-interest);
   const old=b.principal;c.cash-=paid;c.bondInterestPaid+=interest;c.bondArrears+=due-paid;
   b.holdings.forEach((v,i)=>{s.households[i].cash+=paid*v/old;s.households[i].corporateBondIncome+=interest*v/old;});
   b.principal-=principal;b.holdings=b.holdings.map(v=>v*(b.principal/old));
   report.push({issuer:c.id,id:b.id,due,paid,couponPaid:interest,principalPaid:principal,arrears:due-paid,remaining:b.principal,rate:b.rate,maturity:b.maturity});
  }
  c.bonds=(c.bonds??[]).filter(b=>b.principal>1e-9);
 }
 return report;
}
export function resolveCorporateBonds(s,c){
 const debt=corporateDebt(s,c),paid=Math.min(debt,Math.max(0,c.cash));if(!(debt>0))return {paid:0,loss:0};
 for(const b of c.bonds??[])for(const [i,v] of b.holdings.entries())s.households[i].cash+=paid*v/debt;
 c.cash-=paid;c.bonds=[];c.bondArrears=0;return {paid,loss:debt-paid};
}
export function validateCorporateBonds(s){
 for(const c of corporateIssuers(s))for(const b of c.bonds??[]){if(!Number.isFinite(b.principal)||b.principal<0||!Number.isFinite(b.rate)||b.rate<0||!Number.isInteger(b.maturity)||b.maturity<0||!Array.isArray(b.holdings)||b.holdings.length!==10||b.holdings.some(v=>!Number.isFinite(v)||v<0)||Math.abs(sum(b.holdings)-b.principal)>Math.max(1e-7,b.principal*1e-9))throw new Error('Повреждены корпоративные облигации');}
}

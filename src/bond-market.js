// An explicit non-bank holder of domestic sovereign debt. Portfolio share and
// cash buffer are scenario assumptions; claims, payments and losses are accounts.
const sum=a=>a.reduce((x,y)=>x+y,0);
export const householdBonds=(s,index)=>sum(s.government.domesticBonds.map(b=>b.householdHoldings?.[index]??0));
export const nonbankDebt=s=>sum(s.government.domesticBonds.map(b=>sum(b.householdHoldings??[])));
export const bankBondPrincipal=b=>b.principal-sum(b.householdHoldings??[]);
export function subscribeHouseholds(s,requested,flow){
 if(!(s.economy?.revision>=4)||s.government.defaultActive||s.month<s.government.excludedUntil||flow.marketClosed||requested<=0)return 0;
 const rate=(s.monetary?.effectiveRate??s.policy.rate)/100+flow.sovereignSpread;
 const premium=rate-s.bank.depositRate-(flow.defaultProbability??0)*s.economy.parameters.sovereignLossGivenDefault;
 const room=s.households.map((h,i)=>{
  const held=householdBonds(s,i),wealth=Math.max(0,h.cash+held-h.loanLC-h.loanFX*s.exchangeRate);
  const ref=s.economy.macro?.households[i].bondPortfolioShare??.25;
  const change=(premium-(s.economy.macro?.initialBondPremium??0))/.03;
  const targetShare=ref<=0?0:1/(1+Math.exp(-Math.max(-30,Math.min(30,Math.log(ref/Math.max(1e-9,1-ref))+change))));
  const target=wealth*targetShare;
  return Math.max(0,Math.min(h.cash-Math.max(0,h.income)*3,target-held));
 });
 const total=sum(room),issued=Math.min(requested,total);if(issued<=0)return 0;
 const holdings=room.map(v=>issued*v/total);
 holdings.forEach((v,i)=>{s.households[i].cash-=v;});s.government.cash+=issued;
 s.government.domesticBonds.push({principal:issued,rate,maturity:s.month+60,householdHoldings:holdings});
 flow.domesticIssued+=issued;flow.nonbankIssued=(flow.nonbankIssued??0)+issued;
 return issued;
}
export function domesticCouponShares(s){
 const due=s.government.domesticBonds.map(b=>b.principal*b.rate/12),total=sum(due);
 return {total,households:s.households.map((_,i)=>sum(s.government.domesticBonds.map((b,j)=>due[j]*(b.householdHoldings?.[i]??0)/Math.max(b.principal,1e-9))))};
}
export function distributeCoupon(s,paid,shares){
 const fraction=shares.total>0?paid/shares.total:0,amounts=shares.households.map(v=>v*fraction);
 amounts.forEach((v,i)=>{s.households[i].cash+=v;s.households[i].bondIncome=(s.households[i].bondIncome??0)+v;});
 s.bank.equity+=paid-sum(amounts);
}
export function redeemDomestic(s,bond,paid){
 const fraction=paid/Math.max(bond.principal,1e-9);
 bond.householdHoldings?.forEach((v,i)=>{const cash=v*fraction;s.households[i].cash+=cash;bond.householdHoldings[i]-=cash;});
 bond.principal-=paid;
}
export function initializeNonbankHolders(s,fraction=.7){
 for(const b of s.government.domesticBonds)b.householdHoldings=s.households.map(h=>b.principal*fraction*h.dividendShare);
}
export function settleBankForeignInterest(s,due,availableUSD,flow){
 const paid=Math.min(due,Math.max(0,availableUSD)),unpaid=due-paid;
 s.bank.foreignAssetsUSD-=paid;s.bank.foreignArrearsUSD=(s.bank.foreignArrearsUSD??0)+unpaid;
 s.bank.equity-=due*s.exchangeRate;
 flow.bankForeignInterestDueUSD=due;flow.bankForeignInterestPaidUSD=paid;flow.bankForeignArrearsCreatedUSD=unpaid;
 return {paid,unpaid};
}

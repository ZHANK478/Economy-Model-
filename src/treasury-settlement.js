import {bankBondPrincipal} from './bond-market.js';
import {hasDiscretionaryCB} from './monetary.js';
const sum=a=>a.reduce((v,x)=>v+x,0);
export const settlementActive=s=>(s.economy?.revision??0)>=14;
// Monthly secured refinancing, not unlimited emergency aid or an intraday model.
// Haircut is an explicit scenario assumption, NOT a transplanted ECB estimate.
export function settlementCreditCapacity(s){
 const eligible=sum(s.government.domesticBonds.filter(b=>!b.inDefault&&!(b.overdue>0)).map(bankBondPrincipal));
 const collateralValue=eligible*.8;
 const headroom=settlementActive(s)&&hasDiscretionaryCB(s)&&s.bank.equity>0?Math.max(0,collateralValue-s.bank.centralBorrowing):0;
 return {eligible,collateralValue,haircut:.2,headroom};
}
export function supplySettlementCredit(s,neededLC,flow){
 const collateral=settlementCreditCapacity(s),draw=Math.min(Math.max(0,neededLC),collateral.headroom);
 if(draw>0){s.bank.reserves+=draw;s.bank.centralBorrowing+=draw;flow.settlementCredit=(flow.settlementCredit??0)+draw;}
 return {...collateral,draw};
}
export function treasuryPaymentOutlook(s){
 if(!settlementActive(s))return null;
 const g=s.government,rate=s.exchangeRate,credit=settlementCreditCapacity(s);
 const bonds=g.externalBonds.filter(b=>!b.inDefault),domestic=g.domesticBonds.filter(b=>!b.inDefault);
 const due=(rows,months)=>sum(rows.map(b=>b.principal*b.rate/12*months+(b.maturity<=s.month+months?b.principal:0)));
 const externalUSD=due(bonds,3),domesticLC=due(domestic,3);
 const privateUSD=Math.max(0,(s.bank.foreignAssetsUSD??0)+(s.metrics.foreignCreditLimitUSD??0));
 const officialUSD=Math.min(g.reservesUSD,(Math.max(0,s.bank.reserves)+credit.headroom)/Math.max(rate,1e-9));
 // No hypothetical bond sale, tax increase or new foreign loan is counted as cash.
 const revenue=(s.metrics.taxRevenue??0)+(s.lastReport?.fiscal?.centralIncome??0)+(s.lastReport?.fiscal?.stateDividends??0);
 const primarySpending=Math.max(0,(s.metrics.governmentSpending??0)-(s.metrics.interestExpense??0));
 const fundUSD=s.economy?.revision>=23?Math.max(0,g.fundUSD):0;
 const cashLC=Math.max(0,g.cash+fundUSD*rate+3*(revenue-primarySpending));
 const fxGap=Math.max(0,externalUSD-privateUSD-officialUSD-fundUSD),cashGap=Math.max(0,domesticLC+externalUSD*rate-cashLC);
 return {months:3,externalUSD,domesticLC,privateUSD,officialUSD,...(s.economy?.revision>=23?{fundUSD}:{}),settlementHeadroom:credit.headroom,cashLC,fxGap,cashGap};
}

// Revision 13: independently owned private operators. Price/funding assumptions
// are scenario rules, not an estimated infrastructure transaction model.
export const operatorTransfersActive=s=>(s.economy?.revision??0)>=13;
const sum=a=>a.reduce((x,y)=>x+y,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function networkTransferQuote(s,{network,kind,points}){
 const n=s.networks.find(n=>n.id===network);if(!n)return null;
 const total=n.public+n.municipal+n.private+n.concession,price=s.metrics.investmentPrice??s.consumerPriceIndex/100;
 const required=Math.max(.01,s.parameters.infrastructureRequiredReturn,(1+s.bank.lendingRate)/(1+s.expectedInflation)-1)+.06*s.institutions.ownershipRisk;
 const unitPrice=price*clamp(Math.max(0,n.expectedReturn)/required,0,1);
 const localProtected=s.territorialGovernment?.localProperty===true;
 const offered=kind==='networkSale'?n.public+(localProtected?0:n.municipal):kind==='networkPurchase'?n.private:
  s.territorialGovernment?.localProperty===false?0:n.public;
 const wanted=Math.min(offered,total*points/100);
 let amount=wanted,reason=null,cash=0,equity=0,credit=0;
 if(wanted<=1e-9)reason='no-stock';
 else if(kind==='networkSale'){
  if(!s.policy.privateInfrastructureEntry)reason='infrastructure-entry';
  else if(unitPrice<=1e-9)reason='investor-return';
  else {
   const o=n.operator;
   cash=Math.max(0,o.cash-(n.private+n.concession)*s.parameters.infrastructureMaintenanceRate/4*price);
   equity=sum(s.households.map(h=>Math.max(0,h.cash-h.income*6)))*.003;
   const debt=o.loanLC+o.loanFX*s.exchangeRate;
   credit=Math.max(0,o.equity*s.foundation.assumptions.projectLeverage-debt)*clamp(s.bank.creditSupply,0,1);
   amount=Math.min(wanted,(cash+equity+credit)/unitPrice);
   if(amount<=1e-9)reason='buyer-funding';
  }
 }else if(kind==='networkPurchase'){
  // Treasury can attempt ordinary funding at settlement, so this is a cash estimate.
  amount=unitPrice>0?Math.min(wanted,Math.max(0,s.government.cash)/unitPrice):wanted;
 }
 if(reason)amount=0;
 return {wanted,amount,cost:amount*unitPrice,unitPrice,bookPrice:price,reason,cash,equity,credit,requiredReturn:required};
}
export const NETWORK_REASONS={
 'no-stock':'Нет объектов для этой передачи.',
 'infrastructure-entry':'Вход частных операторов закрыт.',
 'investor-return':'Ожидаемая выручка не покрывает расходы.',
 'buyer-funding':'У покупателя нет доступного финансирования.',
 'budget-funding':'У государства недостаточно средств.'
};
export function settleOperatorTransfer(s,action,flow,{transfer,fundGovernment,grantLoan}){
 const n=s.networks.find(n=>n.id===action.network),q=networkTransferQuote(s,action),o=n.operator;
 const total=n.public+n.municipal+n.private+n.concession,before={public:n.public,municipal:n.municipal,private:n.private,concession:n.concession};
 let {amount,cost,reason}=q;
 if(action.kind==='networkMunicipalize'){n.public-=amount;n.municipal+=amount;cost=0;}
 else if(action.kind==='networkSale'&&!reason){
  const needed=Math.max(0,cost-q.cash),equity=Math.min(q.equity,needed);
  const pool=sum(s.households.map(h=>Math.max(0,h.cash-h.income*6)));
  if(equity>0)for(const [i,h] of s.households.entries()){
   const paid=equity*Math.max(0,h.cash-h.income*6)/Math.max(pool,1e-9);transfer(h,o,paid);o.owners[i]+=paid;
  }
  o.equity+=equity;flow.networkAcquisitionEquity=(flow.networkAcquisitionEquity??0)+equity;
  const loan=Math.max(0,needed-equity);if(loan>0)grantLoan(s,o,loan);
  flow.networkAcquisitionCredit=(flow.networkAcquisitionCredit??0)+loan;
  const offered=n.public+(s.territorialGovernment?.localProperty===true?0:n.municipal),central=n.public/Math.max(offered,1e-9);
  n.public-=amount*central;n.municipal-=amount*(1-central);n.private+=amount;
  transfer(o,s.government,cost);flow.networkSales+=cost;
 }else if(action.kind==='networkPurchase'&&!reason){
  fundGovernment(s,q.wanted*q.unitPrice,flow);
  amount=q.unitPrice>0?Math.min(q.wanted,Math.max(0,s.government.cash)/q.unitPrice):q.wanted;cost=amount*q.unitPrice;
  if(amount<=1e-9)reason='budget-funding';
  n.private-=amount;n.public+=amount;transfer(s.government,o,cost);flow.networkPurchases+=cost;
 }
 return {...action,before,after:{public:n.public,municipal:n.municipal,private:n.private,concession:n.concession},amount,cost,unitPrice:q.unitPrice,wanted:q.wanted,actualPoints:amount/Math.max(total,1e-9)*100,partial:amount>0&&amount<q.wanted-1e-8,rejected:!!reason,reason};
}
export function networkTransferMessage(result){
 const name=({roads:'Дороги',rail:'Железные дороги',grid:'Электросети'})[result.network]??'Инфраструктура';
 if(result.rejected)return `${name}: ${NETWORK_REASONS[result.reason]??'Передача не состоялась.'}`;
 return `${name}: ${result.partial?'передано частично — ': 'передано '}${result.actualPoints.toFixed(1)}% фонда; ${result.cost.toFixed(1)} млн.`;
}

export function networkQuoteMessage(quote,kind,format){
 if(!quote)return '';if(quote.reason)return NETWORK_REASONS[quote.reason];
 return kind==='networkMunicipalize'?'Без оплаты':`Цена: ${format(quote.unitPrice*100,0)}% стоимости фонда · ${format(quote.cost,1)} млн`;
}

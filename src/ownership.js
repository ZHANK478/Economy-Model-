const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sum=a=>a.reduce((v,x)=>v+x,0);
export function enterpriseValue(s,f) {
  const price=s.metrics.investmentPrice??s.consumerPriceIndex/100;
  // Transparent net-asset valuation, not a claimed observed stock-market price.
  return Math.max(1,f.capital*price+f.inventory*f.price+f.cash-f.loanLC-f.loanFX*s.exchangeRate);
}
export function scheduleOwnership(s,{sector,kind,points,compensation=1}) {
  if(!Number.isInteger(sector)||sector<0||sector>=s.firms.length||!['purchase','privatize','nationalize','recapitalize'].includes(kind)||!Number.isFinite(points)||points<=0||points>100||!Number.isFinite(compensation)||compensation<0||compensation>1)throw new Error('Некорректная операция собственности');
  const action={id:s.nextActionId++,sector,kind,points,compensation,decisionMonth:s.month,effectiveMonth:s.month+1};
  s.pendingActions.push(action);return action;
}
export function executeOwnership(s,flow,events,{fundGovernment,transfer,foreignPayment}) {
  const results=[];
  for(const action of s.pendingActions.filter(a=>a.kind!=='restructure')){
    const f=s.firms[action.sector],o=f.ownership,before={...o},value=enterpriseValue(s,f),wanted=action.points/100;
    let fraction=0,cost=0;
    if(action.kind==='recapitalize'){
      const requested=value*wanted/Math.max(1-wanted,.01);
      fundGovernment(s,requested,flow);cost=Math.min(requested,Math.max(0,s.government.cash));
      transfer(s.government,f,cost);fraction=cost/(value+cost);
      o.state=o.state+(1-o.state)*fraction;o.domestic*=1-fraction;o.foreign*=1-fraction;
      f.domesticOwners=f.domesticOwners.map(v=>v*(1-fraction));
      flow.equityPurchases+=cost;
    }else if(action.kind==='privatize'){
      const offered=Math.min(wanted,o.state);
      const domesticCash=sum(s.households.map(h=>Math.max(0,h.cash)));
      fraction=Math.min(offered,domesticCash*.20/value);
      cost=fraction*value;
      // Buyers pay from existing deposits. No free equity or output creation.
      for(const h of s.households)transfer(h,s.government,cost*Math.max(0,h.cash)/Math.max(domesticCash,1));
      // Equity ownership is tracked per group, so buyers receive the shares paid for.
      for(let i=0;i<s.households.length;i++)f.domesticOwners[i]=(f.domesticOwners[i]??0)+fraction*Math.max(0,s.households[i].cash)/(Math.max(domesticCash-cost,1));
      o.state-=fraction;o.domestic+=fraction;flow.equitySales+=cost;
    }else{
      const available=o.domestic+o.foreign,offered=Math.min(wanted,available);
      const compensation=action.kind==='purchase'?1:action.compensation;
      fundGovernment(s,value*offered*compensation,flow);
      fraction=compensation>0?Math.min(offered,Math.max(0,s.government.cash)/(value*compensation)):offered;
      cost=value*fraction*compensation;
      const foreignFraction=available>0?fraction*o.foreign/available:0;
      const domesticFraction=fraction-foreignFraction;
      const foreignPaid=value*foreignFraction*compensation/s.exchangeRate;
      const removedForeignClaim=f.foreignEquityUSD*(o.foreign>0?foreignFraction/o.foreign:0);
      foreignPayment(s,s.government,-foreignPaid);f.foreignEquityUSD-=removedForeignClaim;
      flow.externalEquityRevaluation+=removedForeignClaim-foreignPaid;
      const owners=sum(f.domesticOwners);
      for(let i=0;i<s.households.length;i++)transfer(s.government,s.households[i],value*domesticFraction*compensation*(f.domesticOwners[i]??0)/Math.max(owners,1e-9));
      for(let i=0;i<f.domesticOwners.length;i++)f.domesticOwners[i]*=o.domestic>0?1-domesticFraction/o.domestic:1;
      o.state+=fraction;o.domestic-=domesticFraction;o.foreign-=foreignFraction;flow.equityPurchases+=cost;
      if(compensation<1){s.institutions.ownershipRisk=clamp(s.institutions.ownershipRisk+fraction*(1-compensation),0,1);events.push(`${f.name}: изъятие с неполной компенсацией повысило риск прав собственности.`);}
    }
    for(const key of ['state','domestic','foreign'])o[key]=Math.max(0,o[key]);
    f.reorganization=clamp(f.reorganization+Math.abs(o.state-before.state)*s.parameters.ownershipDisruption,0,.15);
    const actual={...action,before,after:{...o},actualPoints:fraction*100,cost,valuation:value};results.push(actual);
    events.push(`${f.name}: ${action.kind}, передано ${actual.actualPoints.toFixed(1)} п.п.; стоимость ${cost.toFixed(0)} млн.`);
  }
  return results;
}

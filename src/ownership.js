const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sum=a=>a.reduce((v,x)=>v+x,0);
export function enterpriseValue(s,f) {
  const price=s.metrics.investmentPrice??s.consumerPriceIndex/100;
  // Transparent net-asset valuation, not a claimed observed stock-market price.
  return Math.max(1,(f.capital+(f.knowledgeCapital??0)+(f.infrastructureCapital??0))*price+f.inventory*f.price+f.cash-f.loanLC-f.loanFX*s.exchangeRate);
}
export function scheduleOwnership(s,{sector,kind,points,compensation=1}) {
  if(!Number.isInteger(sector)||sector<0||sector>=s.firms.length||!['purchase','privatize','foreignSale','cooperatize','municipalize','nationalize','recapitalize'].includes(kind)||!Number.isFinite(points)||points<=0||points>100||!Number.isFinite(compensation)||compensation<0||compensation>1)throw new Error('Некорректная операция собственности');
  const action={id:s.nextActionId++,sector,kind,points,compensation,decisionMonth:s.month,effectiveMonth:s.month+1};
  s.pendingActions.push(action);return action;
}
export function executeOwnership(s,flow,events,{fundGovernment,transfer,foreignPayment}) {
  const results=[];
  for(const action of s.pendingActions.filter(a=>a.kind!=='restructure'&&!a.network)){
    const f=s.firms[action.sector],o=f.ownership,before={...o},value=enterpriseValue(s,f),wanted=action.points/100;
    let fraction=0,cost=0;
    const courtBlocks=action.kind==='nationalize'&&action.compensation<1&&s.policy.judicialReview&&s.politics.judicialIndependence>.5;
    const coopBlocks=action.kind==='cooperatize'&&!s.policy.cooperativeEntry;
    if(courtBlocks||coopBlocks){results.push({...action,before,after:{...o},actualPoints:0,cost:0,valuation:value,rejected:true,reason:courtBlocks?'judicial-review':'cooperative-entry'});events.push(courtBlocks?`${f.name}: суд остановил изъятие без полной компенсации.`:`${f.name}: передача кооперативу невозможна при запрете этой формы.`);continue;}
    if(action.kind==='municipalize'){
      fraction=Math.min(wanted,o.state);o.state-=fraction;o.municipal+=fraction;
    }else if(action.kind==='foreignSale'){
      fraction=Math.min(wanted,o.state,s.institutions.confidence*.25);cost=fraction*value;
      foreignPayment(s,s.government,cost/s.exchangeRate);f.foreignEquityUSD+=cost/s.exchangeRate;
      o.state-=fraction;o.foreign+=fraction;flow.equitySales+=cost;
    }else
    if(action.kind==='recapitalize'){
      const requested=value*wanted/Math.max(1-wanted,.01);
      fundGovernment(s,requested,flow);cost=Math.min(requested,Math.max(0,s.government.cash));
      transfer(s.government,f,cost);fraction=cost/(value+cost);
      o.state=o.state+(1-o.state)*fraction;for(const key of ['domestic','foreign','municipal','cooperative'])o[key]*=1-fraction;
      f.domesticOwners=f.domesticOwners.map(v=>v*(1-fraction));
      f.workerOwners=f.workerOwners.map(v=>v*(1-fraction));
      flow.equityPurchases+=cost;
    }else if(action.kind==='privatize'||action.kind==='cooperatize'){
      const offered=Math.min(wanted,o.state);
      const domesticCash=sum(s.households.map(h=>Math.max(0,h.cash)));
      const cooperative=action.kind==='cooperatize';
      const weights=cooperative?s.households.map(h=>h.wageShare):s.households.map(h=>Math.max(0,h.cash)/Math.max(domesticCash,1));
      const available=cooperative?Math.min(...s.households.map((h,i)=>Math.max(0,h.cash)/Math.max(weights[i],1e-9))):domesticCash;
      fraction=Math.min(offered,available*.20/value);
      cost=fraction*value;
      // Buyers pay from existing deposits. No free equity or output creation.
      s.households.forEach((h,i)=>transfer(h,s.government,cost*weights[i]));
      // Equity ownership is tracked per group, so buyers receive the shares paid for.
      const owners=cooperative?f.workerOwners:f.domesticOwners;
      for(let i=0;i<s.households.length;i++)owners[i]+=fraction*weights[i];
      o.state-=fraction;o[cooperative?'cooperative':'domestic']+=fraction;flow.equitySales+=cost;
    }else{
      const available=o.domestic+o.foreign+o.cooperative,offered=Math.min(wanted,available);
      const compensation=action.kind==='purchase'?1:action.compensation;
      fundGovernment(s,value*offered*compensation,flow);
      fraction=compensation>0?Math.min(offered,Math.max(0,s.government.cash)/(value*compensation)):offered;
      cost=value*fraction*compensation;
      const foreignFraction=available>0?fraction*o.foreign/available:0;
      const domesticFraction=available>0?fraction*o.domestic/available:0;
      const workerFraction=available>0?fraction*o.cooperative/available:0;
      const foreignPaid=value*foreignFraction*compensation/s.exchangeRate;
      const removedForeignClaim=f.foreignEquityUSD*(o.foreign>0?foreignFraction/o.foreign:0);
      foreignPayment(s,s.government,-foreignPaid);f.foreignEquityUSD-=removedForeignClaim;
      flow.externalEquityRevaluation+=removedForeignClaim-foreignPaid;
      const owners=sum(f.domesticOwners);
      for(let i=0;i<s.households.length;i++)transfer(s.government,s.households[i],value*domesticFraction*compensation*(f.domesticOwners[i]??0)/Math.max(owners,1e-9));
      for(let i=0;i<s.households.length;i++)transfer(s.government,s.households[i],value*workerFraction*compensation*(f.workerOwners[i]??0)/Math.max(o.cooperative,1e-9));
      for(let i=0;i<f.domesticOwners.length;i++)f.domesticOwners[i]*=o.domestic>0?1-domesticFraction/o.domestic:1;
      for(let i=0;i<f.workerOwners.length;i++)f.workerOwners[i]*=o.cooperative>0?1-workerFraction/o.cooperative:1;
      o.state+=fraction;o.domestic-=domesticFraction;o.foreign-=foreignFraction;o.cooperative-=workerFraction;flow.equityPurchases+=cost;
      if(compensation<1){s.institutions.ownershipRisk=clamp(s.institutions.ownershipRisk+fraction*(1-compensation),0,1);events.push(`${f.name}: изъятие с неполной компенсацией повысило риск прав собственности.`);}
    }
    for(const key of ['state','domestic','foreign','municipal','cooperative'])o[key]=Math.max(0,o[key]);
    f.reorganization=clamp(f.reorganization+Math.abs(o.state-before.state)*s.parameters.ownershipDisruption,0,.15);
    const actual={...action,before,after:{...o},actualPoints:fraction*100,cost,valuation:value};results.push(actual);
    events.push(`${f.name}: ${action.kind}, передано ${actual.actualPoints.toFixed(1)} п.п.; стоимость ${cost.toFixed(0)} млн.`);
  }
  return results;
}

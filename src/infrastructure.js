// Physical stocks and commercial project appraisal, with a consolidated operator per sector.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((x,v)=>x+v,0);
export const NETWORKS=[{id:'roads',name:'Дороги',sector:4,weight:.5},{id:'rail',name:'Железные дороги',sector:4,weight:.3},{id:'grid',name:'Энергосети',sector:4,weight:.2}];
export function initializeInfrastructure(s){
  s.networks=NETWORKS.map(n=>({...n,public:s.infrastructure*n.weight*.7,municipal:s.infrastructure*n.weight*.1,
    private:s.infrastructure*n.weight*.2,concession:0,fee:1,maintenanceCoverage:1,privateMaintenanceCoverage:1,
    investment:0,expectedReturn:.12-s.parameters.infrastructureMaintenanceRate-s.parameters.annualInfrastructureDepreciation*.25,guaranteeClaim:0,contracts:[]}));
  for(const n of s.networks){const f=s.firms[n.sector];f.capital-=n.private;f.initialCapital-=n.private;f.infrastructureDepreciation=0;f.concessionSupport=0;}
  synchronizeInfrastructure(s);
}
export function synchronizeInfrastructure(s){
  s.infrastructure=sum(s.networks.map(n=>n.public+n.municipal+n.private+n.concession));
  s.firms.forEach((f,i)=>{f.infrastructureCapital=sum(s.networks.filter(n=>n.sector===i).map(n=>n.private+n.concession));});
}
export function scheduleNetwork(s,{network,kind,points}){
  if(!NETWORKS.some(n=>n.id===network)||!['networkSale','networkPurchase','networkMunicipalize'].includes(kind)||!Number.isFinite(points)||points<=0||points>100)throw new Error('Некорректная операция с инфраструктурой');
  const action={id:s.nextActionId++,network,kind,points,decisionMonth:s.month,effectiveMonth:s.month+1};s.pendingActions.push(action);return action;
}
export function executeNetworkTransfers(s,flow,events,{transfer,fundGovernment}){
  const results=[],price=s.metrics.investmentPrice??s.consumerPriceIndex/100;
  for(const action of s.pendingActions.filter(a=>a.network)){
    const n=s.networks.find(n=>n.id===action.network),f=s.firms[n.sector],total=n.public+n.municipal+n.private+n.concession;
    const before={public:n.public,municipal:n.municipal,private:n.private,concession:n.concession};
    let amount=0,cost=0,reason=null;
    if(action.kind==='networkMunicipalize'){amount=Math.min(n.public,total*action.points/100);n.public-=amount;n.municipal+=amount;}
    else if(action.kind==='networkSale'){
      const realRate=(1+s.bank.lendingRate)/(1+s.expectedInflation)-1;
      if(!s.policy.privateInfrastructureEntry)reason='infrastructure-entry';
      else if(n.expectedReturn<Math.max(s.parameters.infrastructureRequiredReturn,realRate)+.06*s.institutions.ownershipRisk)reason='investor-return';
      else{
        const offered=n.public+n.municipal;
        amount=Math.min(offered,total*action.points/100,Math.max(0,f.cash)*.35/price);cost=amount*price;
        const centralShare=n.public/Math.max(offered,1);n.public-=amount*centralShare;n.municipal-=amount*(1-centralShare);n.private+=amount;
        transfer(f,s.government,cost);flow.networkSales+=cost;
      }
    }else{
      const wanted=Math.min(n.private,total*action.points/100);fundGovernment(s,wanted*price,flow);
      amount=Math.min(wanted,Math.max(0,s.government.cash)/price);cost=amount*price;
      n.private-=amount;n.public+=amount;transfer(s.government,f,cost);flow.networkPurchases+=cost;
    }
    results.push({...action,before,after:{public:n.public,municipal:n.municipal,private:n.private,concession:n.concession},amount,cost,actualPoints:amount/Math.max(total,1)*100,rejected:Boolean(reason),reason});
    events.push(reason?`${n.name}: передача оператору не состоялась (${reason==='investor-return'?'доходность ниже требуемой':'вход операторов закрыт'}).`:`${n.name}: передано ${amount.toFixed(0)} млн фонда; расчёт ${cost.toFixed(0)} млн. Смена владельца не является новым выпуском.`);
  }
  synchronizeInfrastructure(s);return results;
}
export function prepareInfrastructure(s,prev,events){
  const k=s.parameters;
  for(const f of s.firms){f.infrastructureDepreciation=0;f.concessionSupport=0;}
  for(const n of s.networks){
    const publicCoverage=clamp(n.maintenanceCoverage,0,1),privateCoverage=clamp(n.privateMaintenanceCoverage,0,1);
    const publicRate=k.annualInfrastructureDepreciation*(1-.75*publicCoverage);
    const privateRate=k.annualInfrastructureDepreciation*(1-.75*privateCoverage);
    for(const owner of ['public','municipal'])n[owner]*=Math.pow(1-publicRate,1/12);
    for(const owner of ['private','concession']){const old=n[owner];n[owner]*=Math.pow(1-privateRate,1/12);s.firms[n.sector].infrastructureDepreciation+=old-n[owner];}
    const congestion=clamp(prev.metrics.realGDPMonthly/s.base.monthlyGDP/Math.max(.1,prev.metrics.infrastructure/100),.5,3);
    const commercialFee=clamp(.65+.35*congestion+k.infrastructureCompetitionEffect*Math.max(0,1-s.institutions.competition),.4,2.5);
    const feeTarget=s.policy.infrastructurePricing==='capped'?Math.min(commercialFee,s.policy.infrastructureFeeCap/100):commercialFee;
    n.fee+=.08*(feeTarget-n.fee);
    n.expectedReturn=.12*n.fee*clamp(congestion,.5,1.5)-k.infrastructureMaintenanceRate-k.annualInfrastructureDepreciation*.25;
    n.investment=0;n.guaranteeClaim=0;
    for(const c of n.contracts)c.remaining*=Math.pow(1-privateRate,1/12);
    const matured=n.contracts.filter(c=>s.month>=c.end);
    for(const c of matured){const amount=Math.min(n.concession,c.remaining);n.concession-=amount;n.public+=amount;events.push(`${n.name}: окончание концессии, объект передан государству.`);}
    n.contracts=n.contracts.filter(c=>s.month<c.end);
  }
  synchronizeInfrastructure(s);
}
export function infrastructurePlans(s,investmentPlans){
  const allocations=s.firms.map(()=>[]);
  for(const n of s.networks){
    if(!s.policy.privateInfrastructureEntry&&!s.policy.concessionEntry)continue;
    const realRate=(1+s.bank.lendingRate)/(1+s.expectedInflation)-1;
    const hurdle=Math.max(s.parameters.infrastructureRequiredReturn,realRate)+.06*s.institutions.ownershipRisk;
    const grossReturn=n.expectedReturn+s.parameters.infrastructureMaintenanceRate+s.parameters.annualInfrastructureDepreciation*.25;
    const appraisal=(owner)=>{
      const cashReturn=Math.max(grossReturn,owner==='concession'?.13*s.policy.concessionGuarantee/100:0)-s.parameters.infrastructureMaintenanceRate;
      let value=-1;
      for(let year=1;year<=30;year++)value+=cashReturn*Math.pow(1-s.parameters.annualInfrastructureDepreciation*.25,year-1)/Math.pow(1+hurdle,year);
      if(owner==='private')value+=Math.pow(1-s.parameters.annualInfrastructureDepreciation*.25,30)/Math.pow(1+hurdle,30);
      return value;
    };
    n.privateNPV=appraisal('private');n.concessionNPV=appraisal('concession');
    const owner=s.policy.privateInfrastructureEntry&&(!s.policy.concessionEntry||n.privateNPV>=n.concessionNPV)?'private':'concession';
    const npv=owner==='private'?n.privateNPV:n.concessionNPV;
    n.npvPerUnit=npv;n.requiredReturn=hurdle;
    const share=clamp(npv*s.parameters.privateInfrastructureAdjustment,0,.65)*n.weight;
    const amount=investmentPlans[n.sector]*share;
    if(amount<=0)continue;
    allocations[n.sector].push({network:n.id,owner,amount,guarantee:s.policy.concessionGuarantee/100});
  }
  return allocations;
}
export function completeInfrastructure(s,project){
  const n=s.networks.find(n=>n.id===project.network);
  if(!n)return;
  n[project.owner]+=project.amount*project.efficiency;n.investment+=project.amount*project.efficiency;
  if(project.owner==='concession')n.contracts.push({end:s.month+360,remaining:project.amount*project.efficiency,
    promisedAnnual:.13,guarantee:project.guarantee??0});
}
export function settleInfrastructure(s,flow,{transfer,fundGovernment},events,price=s.metrics.investmentPrice??s.consumerPriceIndex/100){
  const totalPublic=Math.max(sum(s.networks.map(n=>n.public+n.municipal)),1);
  for(const n of s.networks){
    const publicNeed=(n.public+n.municipal)*s.parameters.infrastructureMaintenanceRate/12;
    const realPaid=(flow.infrastructureMaintenance??0)/price*(n.public+n.municipal)/totalPublic;
    n.maintenanceCoverage=publicNeed>0?clamp(realPaid/publicNeed,0,1):1;
    const f=s.firms[n.sector],privateNeed=(n.private+n.concession)*s.parameters.infrastructureMaintenanceRate/12*price;
    // Maintenance purchases are an identified part of already settled domestic inputs.
    const privatePaid=Math.min(privateNeed,Math.max(0,f.maintenanceInputs??0)*n.weight);
    n.privateMaintenanceCoverage=privateNeed>0?clamp(privatePaid/privateNeed,0,1):1;
    for(const c of n.contracts){
      const contracted=c.remaining*c.promisedAnnual/12*price;
      const earned=(flow.infrastructureFees??0)*n.weight*c.remaining/Math.max(n.private+n.concession,1);
      const claim=Math.max(0,contracted*c.guarantee-earned);
      if(claim>0){fundGovernment(s,claim,flow);const paid=Math.min(claim,Math.max(0,s.government.cash));transfer(s.government,f,paid);f.concessionSupport+=paid;flow.concessionGuarantees+=paid;n.guaranteeClaim+=claim;}
    }
    if(n.maintenanceCoverage<.4&&s.month%12===0)events.push(`${n.name}: недостаточное обслуживание государственного фонда.`);
  }
  synchronizeInfrastructure(s);
}
export function infrastructureMetrics(s){
  const total=Math.max(s.infrastructure,1),directPublic=sum(s.networks.map(n=>n.public+n.municipal));
  const commercial=sum(s.networks.map(n=>n.private+n.concession));
  const privateStock=sum(s.networks.map(n=>(n.private+n.concession)*(1-s.firms[n.sector].ownership.state-s.firms[n.sector].ownership.municipal)));
  return {privateInfrastructureShare:privateStock/total*100,corporateInfrastructureShare:commercial/total*100,
    publicInfrastructureStock:total-privateStock,privateInfrastructureStock:privateStock,
    infrastructureMaintenanceCoverage:sum(s.networks.map(n=>n.maintenanceCoverage*(n.public+n.municipal)))/Math.max(directPublic,1)*100,
    concessionExposure:sum(s.networks.flatMap(n=>n.contracts.map(c=>c.remaining*c.guarantee))),
    infrastructureFeeIndex:sum(s.networks.map(n=>n.fee*n.weight))*100};
}

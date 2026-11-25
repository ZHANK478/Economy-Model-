import {territorialActive,territorialFiscalReformed,territorialGeography,territorialOfficeId,territorialRules} from './territorial-government.js';
import {agricultureActive} from './agriculture.js';
import {socialActive} from './social-protection.js';

export const TERRITORIAL_PROGRAMS={
  education:'Школы',
  healthcare:'Медицина',
  infrastructureMaintenance:'Ремонт инфраструктуры',
  publicInvestment:'Инвестиции в инфраструктуру',
  socialHousing:'Социальное жильё',
  retraining:'Переобучение',
  localBudget:'Пополнить местный бюджет',
  businessSupport:'Поддержка предприятий',
  agricultureProtection:'Поддержка сельского хозяйства',
};
export const territorialPrograms=(s,city=false)=>Object.entries(TERRITORIAL_PROGRAMS).filter(([key])=>{
  if(key==='localBudget')return territorialFiscalReformed(s)&&territorialRules(s).spending==='local';
  if(key==='businessSupport')return !city;
  if(key==='agricultureProtection')return !city&&agricultureActive(s);
  return socialActive(s)||!['socialHousing','retraining'].includes(key);
});

// The mayor's citywide office has the regional programme remit.
export function territorialOfficePrograms(s,office){
  const london=office.territoryId==='TLI'&&s.territorialGovernment.londonMayorRevision===1;
  return territorialPrograms(s,office.city&&!london);
}

const sum=values=>values.reduce((a,b)=>a+b,0);
export function territorialProgrammeGDP(s,id,city){
  const regions=s.regional?.regions??[];
  const accounts=city?regions.flatMap(region=>region.cities??[region.city]):regions;
  const account=accounts.find(row=>row.id===id);
  const monthly=account?.nominalGDPMonthly??territorialGeography(s).find(area=>area.id===id)?.output??0;
  return monthly*(s.metrics.nominalGDPAnnual/12)/Math.max(1e-9,s.metrics.nominalGDPMonthly);
}
export const availableTerritorialProgrammeCash=s=>Math.max(0,s.government.cash-sum((s.territorialGovernment?.programs??[]).map(row=>row.amount)));

export const nationalProgrammeGDP=s=>s.metrics.nominalGDPAnnual/12;

export function territorialProgrammeOrders(s,budgetBase){
  const world=s.territorialGovernment;
  const standing=Object.values(world?.standingPrograms??{})
    .filter(row=>row.programme!=='localBudget'||territorialRules(s).spending==='local');
  return [...(world?.programs??[]),...standing.map(row=>({...row,recurring:true,base:budgetBase,amount:budgetBase*row.share/100}))];
}

export function queueTerritorialProgram(s,{officeId,programme,amount,share,id,recurring=false}){
  const world=s.territorialGovernment;
  officeId=territorialOfficeId(s,officeId);
  const office=territorialActive(s)&&Object.hasOwn(world.offices,officeId)?world.offices[officeId]:null;
  if(!office||!territorialOfficePrograms(s,office).some(([key])=>key===programme))throw new Error('Эта программа недоступна для выбранной территории.');
  const regionId=territorialGeography(s).find(area=>area.id===office.territoryId)?.region;
  if(!regionId)throw new Error('Территория не найдена.');
  if(recurring){
    if(!Number.isFinite(share)||share<0||share>100)throw new Error('Укажите долю ВВП страны от 0 до 100%.');
    const orders=world.standingPrograms??={};
    const key=officeId+'|'+programme;
    if((orders[key]?.share??0)===share)throw new Error('Такая доля уже установлена.');
    if(share===0)delete orders[key];
    else orders[key]={id,officeId,territoryId:office.territoryId,regionId,programme,share};
    return;
  }
  const base=territorialProgrammeGDP(s,office.territoryId,office.city);
  if(share!==undefined)amount=Number(share)*base/100;
  if(!Number.isFinite(amount)||amount<=0)throw new Error('Укажите положительную сумму.');
  if(amount>availableTerritorialProgrammeCash(s))throw new Error('В казначействе недостаточно свободных средств.');
  (world.programs??=[]).push({id,officeId,territoryId:office.territoryId,regionId,programme,amount,...(share===undefined?{}:{base,share:Number(share)})});
}

export function generalTerritorialGrants(s,prev){
  if(!territorialFiscalReformed(s)||territorialRules(s).spending!=='local'||
    !(s.policy.regionalBudgetTransfers>0||s.policy.cityBudgetTransfers>0))return [];
  const {offices}=s.territorialGovernment;
  const areas=territorialGeography(s,prev.regional?.regions);
  const base=nationalProgrammeGDP(prev);
  return [['regionalBudgetTransfers',false],['cityBudgetTransfers',true]].flatMap(([source,city])=>{
    if(s.policy[source]<=0)return [];
    // A shared city/region account such as London belongs to the city pool.
    const recipients=areas.filter(area=>area.population>0&&Boolean(offices[area.id+':city'])===city);
    const population=sum(recipients.map(area=>area.population));
    const total=base*s.policy[source]/100;
    if(!(population>0&&total>0))return [];
    return recipients.map(area=>({territoryId:area.id,regionId:area.region,programme:'localBudget',source,
      amount:total*area.population/population}));
  });
}

export function payTerritorialBudgetGrants(s,flow,grants){
  const world=s.territorialGovernment;
  if(!grants.length)return 0;
  const total=sum(grants.map(row=>row.amount));
  const paid=territorialRules(s).spending==='local'?Math.min(total,Math.max(0,s.government.cash)):0;
  flow.territorialGrants=grants.map(row=>{
    const received=paid*row.amount/total;
    world.accounts[row.territoryId].cash+=received;
    return {...row,paid:received};
  });
  s.government.cash-=paid;
  return paid;
}

export function payTerritorialBusinessSupport(s,orders){
  if(!orders.length)return [];
  const gov=s.government,total=sum(orders.map(row=>row.amount));
  const funding=Math.min(1,Math.max(0,gov.cash)/total);
  return orders.map(row=>{
    const region=s.regional?.regions.find(r=>r.id===row.regionId);
    const weights=s.firms.map((firm,i)=>i===0?0:Math.max(0,region?.sectors?.[i]?.nominalValueAdded??s.base.output[i]));
    const size=sum(weights),paid=size>0?row.amount*funding:0;
    if(paid>0){
      for(const [i,firm] of s.firms.entries())firm.cash+=paid*weights[i]/size;
      gov.cash-=paid;
    }
    return {...row,paid,bySector:weights.map(weight=>size>0?paid*weight/size:0)};
  });
}

export function settleTerritorialPrograms(s,flow,paid,orders,business){
  const world=s.territorialGovernment;
  if(!orders.length&&!business.length&&!flow.territorialGrants?.length&&!world?.programs?.length)return;
  const requested=sum(orders.map(row=>row.amount));
  flow.territorialPrograms=[...orders.map(row=>({...row,paid:paid*row.amount/requested})),...business];
  const addressedGrants=(flow.territorialGrants??[]).filter(row=>row.officeId);
  if(world.programs?.length||business.length||addressedGrants.length||orders.some(row=>row.officeId)){
    world.lastPrograms={month:s.month,orders:[...addressedGrants,...flow.territorialPrograms.filter(row=>row.officeId)]};
    world.programs=[];
  }
}

export function territorialProgramSpending(flow,programme){
  return sum((flow.territorialPrograms??[]).filter(row=>row.programme===programme).map(row=>row.paid));
}

export function validateTerritorialPrograms(s){
  const world=s.territorialGovernment;
  if(!world)return;
  const validate=(orders,settled)=>Array.isArray(orders)&&orders.every(row=>{
    const office=Object.hasOwn(world.offices,row.officeId)?world.offices[row.officeId]:null;
    return office?.territoryId===row.territoryId&&Object.hasOwn(world.accounts,row.regionId)&&
      Object.hasOwn(TERRITORIAL_PROGRAMS,row.programme)&&Number.isSafeInteger(row.id)&&row.id>0&&
      Number.isFinite(row.amount)&&row.amount>0&&(!settled||Number.isFinite(row.paid)&&row.paid>=0);
  })&&new Set(orders.map(row=>row.id)).size===orders.length;
  for(const [id,asset] of Object.entries(world.programmeAssets??{})){
    if(!Object.hasOwn(world.accounts,id)||!Object.hasOwn(world.accounts,asset.regionId)||
      !Number.isFinite(asset.housing)||asset.housing<0||
      (asset.agriculture!==undefined&&(!Number.isFinite(asset.agriculture)||asset.agriculture<0))||
      !asset.networks||Object.entries(asset.networks).some(([key,value])=>
        !s.networks.some(network=>network.id===key)||!Number.isFinite(value)||value<0))throw new Error('Повреждены территориальные активы.');
  }
  for(const project of s.projects.filter(item=>item.territory!==undefined)){
    if((project.territorialOwner!==undefined&&
      (project.type!=='public'||project.territorialOwner!==project.territory.id||!Array.isArray(project.localPlan)))||
      !['public','housing','agriculture'].includes(project.type)||!Object.hasOwn(world.accounts,project.territory?.id)||
      !Object.hasOwn(world.accounts,project.territory?.regionId)||project.type==='housing'&&!project.public)
      throw new Error('Повреждён адрес территориального проекта.');
  }
  const standing=world.standingPrograms;
  if(standing!==undefined&&(typeof standing!=='object'||!standing||Array.isArray(standing)||
    !Object.entries(standing).every(([key,row])=>row&&key===row.officeId+'|'+row.programme&&
      Number.isFinite(row.share)&&row.share>0&&row.share<=100)||
    !validate(Object.values(standing).map(row=>({...row,amount:row.share})),false)))throw new Error('Повреждены постоянные территориальные программы.');
  if((world.programs!==undefined&&!validate(world.programs,false))||
    (world.lastPrograms!==undefined&&(!Number.isInteger(world.lastPrograms?.month)||world.lastPrograms.month<1||
      world.lastPrograms.month>s.month||!validate(world.lastPrograms.orders,true))))throw new Error('Повреждены территориальные программы.');
}

export function depreciateTerritorialProgrammeAssets(s,prev){
  const assets=s.territorialGovernment?.programmeAssets;
  if(!assets)return;
  const fraction=(current,last)=>last>0?Math.min(1,Math.max(0,current/last)):0;
  const housing=fraction(s.social?.housing.publicStock??0,prev.social?.housing.publicStock??0);
  const networks=Object.fromEntries(s.networks.map(network=>[network.id,
    fraction(network.public,prev.networks.find(old=>old.id===network.id)?.public??0)]));
  for(const asset of Object.values(assets)){
    asset.housing*=housing;
    if(asset.agriculture!==undefined)asset.agriculture*=fraction(s.agriculture?.publicStock??0,prev.agriculture?.publicStock??0);
    for(const key of Object.keys(asset.networks))asset.networks[key]*=networks[key]??0;
  }
}

export function recordTerritorialProgrammeAsset(s,project){
  if(!project.territory||project.territorialOwner)return;
  const {id,regionId}=project.territory;
  const assets=s.territorialGovernment.programmeAssets??={};
  const asset=assets[id]??={regionId,housing:0,networks:{}};
  if(project.type==='agriculture'){
    asset.agriculture=(asset.agriculture??0)+project.amount*project.efficiency;
  }else if(project.type==='housing'){
    asset.housing+=project.amount*project.efficiency/s.social.housing.constructionPerHome;
  }else for(const network of s.networks){
    const installed=project.localPlan?.find(row=>row.network===network.id)?.public??project.amount*network.weight;
    asset.networks[network.id]=(asset.networks[network.id]??0)+installed*project.efficiency;
  }
}

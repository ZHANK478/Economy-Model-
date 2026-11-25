import {territorialGeography,territorialOffice,territorialRules} from './territorial-government.js';

const sum=values=>values.reduce((a,b)=>a+b,0);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const moneyTolerance=1e-8;

function leaderPlatform(s,area){
  const person=territorialOffice(s,area.id,area.city)?.person;
  return person?s.politics.parties.find(p=>p.id===person.partyId)?.platform:null;
}

function ownersFor(s,areas,sector){
  const regions=s.regional?.regions??[];
  const weights=areas.map(area=>{
    const region=regions.find(r=>r.id===area.region);
    if(!region)return area.output;
    const cities=(region.cities??[region.city]).filter(city=>city.id!==region.id);
    const capital=entity=>entity?.sectors?.[sector]?.capitalStock??0;
    return area.city?capital(cities.find(city=>city.id===area.id)):
      Math.max(0,capital(region)-sum(cities.map(capital)));
  });
  const total=sum(weights),population=sum(areas.map(area=>area.population));
  return Object.fromEntries(areas.map((area,i)=>[area.id,total>0?weights[i]/total:area.population/Math.max(1e-9,population)]));
}

export function prepareTerritorialAssets(s,entities,flow,events){
  const world=s.territorialGovernment;
  if(!world)return;
  const rules=territorialRules(s);
  if(rules.property==='local'){
    world.localProperty=true;
  }else if(world.localProperty){
    for(const {firm} of entities){
      firm.ownership.state+=firm.ownership.municipal;
      firm.ownership.municipal=0;
      delete firm.localOwners;
    }
    const regionsByArea=new Map(territorialGeography(s).map(area=>[area.id,area.region]));
    for(const network of s.networks){
      const assets=world.programmeAssets??={};
      for(const [id,fraction] of Object.entries(network.localOwners??{})){
        const regionId=regionsByArea.get(id);
        if(!regionId)continue;
        const asset=assets[id]??={regionId,housing:0,networks:{}};
        asset.networks[network.id]=(asset.networks[network.id]??0)+network.municipal*fraction;
      }
      network.public+=network.municipal;
      network.municipal=0;
      delete network.localOwners;
    }
    for(const project of s.projects){
      delete project.territorialOwner;
      for(const plan of project.localPlan??[]){
        plan.public+=plan.municipal;
        plan.municipal=0;
      }
    }
    world.localProperty=false;
    events.push('Муниципальные сети и доли предприятий перешли в государственную собственность.');
  }
  if(rules.borrowing==='local'){
    world.localBorrowing=true;
    world.bonds??=[];
  }else if(world.localBorrowing){
    flow.localCashAssumed=sum(Object.values(world.accounts).map(account=>account.cash));
    for(const owner of [...entities,...s.networks]){
    const shares=owner.localOwners;
    if(shares!==undefined&&(!shares||typeof shares!=='object'||Array.isArray(shares)||
      Object.entries(shares).some(([id,value])=>!Object.hasOwn(world.accounts,id)||!Number.isFinite(value)||value<0)||
      Math.abs(sum(Object.values(shares))-1)>moneyTolerance))
      throw new Error('Повреждены доли муниципальных собственников.');
  }
  for(const account of Object.values(world.accounts)){account.cash=0;delete account.capitalCash;}
    s.government.cash+=flow.localCashAssumed;
    flow.localDebtAssumed=sum(world.bonds.map(bond=>bond.principal));
    for(const {territoryId,arrears,...bond} of world.bonds){
      s.government.domesticBonds.push(bond);
      if(arrears>0){
        s.government.domesticBonds.push({...bond,principal:arrears,rate:0,maturity:s.month,
          householdHoldings:bond.householdHoldings.map(value=>value/bond.principal*arrears),interestArrears:true,originalContractRate:bond.rate});
        flow.localDebtAssumed+=arrears;
      }
    }
    world.bonds=[];
    world.localBorrowing=false;
    events.push('Остатки местных бюджетов и обязательства по местным облигациям переданы государству.');
  }
}

export function assignTerritorialAssets(s,entities){
  if(!s.territorialGovernment?.localProperty)return;
  const areas=territorialGeography(s);
  const ownerWeights=s.firms.map((_,sector)=>ownersFor(s,areas,sector));
  for(const {firm,sector} of entities){
    if(firm.ownership.municipal>0)firm.localOwners??={...ownerWeights[sector]};
    else delete firm.localOwners;
  }
  for(const network of s.networks){
    if(network.municipal>0)network.localOwners??={...ownerWeights[network.sector]};
    else delete network.localOwners;
  }
}

export function creditTerritorialNetwork(network,id,amount){
  if(amount<=0)return;
  const total=network.municipal+amount;
  const owners=network.localOwners??={};
  for(const key of Object.keys(owners))owners[key]*=network.municipal/total;
  owners[id]=(owners[id]??0)+amount/total;
}

export function territorialNetworkPlan(s,area,amount){
  const platform=leaderPlatform(s,area);
  const green=clamp(platform?.environment??0,-1,1);
  const weights=s.networks.map(network=>{
    const owned=network.municipal*(network.localOwners?.[area.id]??0);
    const priority=network.id==='rail'?1+.3*green:network.id==='roads'?1-.3*green:1;
    return (owned+network.weight)*priority;
  });
  const total=sum(weights);
  return s.networks.map((network,i)=>({network:network.id,public:0,municipal:amount*weights[i]/total}));
}

export function sellTerritorialEquity(s,entities,flow,events,valueOf){
  if(!s.territorialGovernment?.localProperty||!s.territorialGovernment.fiscal?.spendingRates)return;
  const areas=territorialGeography(s);
  const firms=entities.map(({firm})=>firm);
  let paid=0;
  for(const [index,area] of areas.entries()){
    if((s.month+index)%12!==0)continue;
    const platform=leaderPlatform(s,area);
    const market=platform?.economy??0;
    const account=s.territorialGovernment.accounts[area.id];
    if(market<=.35||account.cash>=area.output*.01)continue;
    const firm=firms.filter(row=>row.active!==false&&row.lastProfit<0&&row.ownership.municipal>0&&row.localOwners?.[area.id]>0)
      .sort((a,b)=>a.lastProfit-b.lastProfit)[0];
    if(!firm)continue;
    const stake=firm.ownership.municipal,price=valueOf(s,firm);
    const room=s.households.map(h=>Math.max(0,h.cash-h.income*3)*.01);
    const buyers=sum(room);
    const sold=Math.min(stake*firm.localOwners[area.id]*.15*market,buyers/price);
    if(sold<=moneyTolerance)continue;
    const proceeds=sold*price;
    for(const [i,cash] of room.entries()){
      const share=cash/buyers;
      s.households[i].cash-=proceeds*share;
      firm.domesticOwners[i]+=sold*share;
    }
    firm.ownership.municipal-=sold;
    firm.ownership.domestic+=sold;
    for(const [id,weight] of Object.entries(firm.localOwners)){
      firm.localOwners[id]=Math.max(0,(weight*stake-(id===area.id?sold:0))/(stake-sold));
    }
    account.cash+=proceeds;
    paid+=proceeds;
    events.push(`${area.name}: продана часть муниципальной доли «${firm.name}».`);
  }
  if(paid>0)flow.localAssetSales=paid;
}

export function payTerritorialDividends(s,firm,dividend,flow,transfer){
  const owners=firm.localOwners;
  const local=owners&&s.territorialGovernment?.localProperty?s.territorialGovernment.accounts:null;
  const municipal=dividend*firm.ownership.municipal;
  if(local&&municipal>0){
    for(const [id,weight] of Object.entries(owners))transfer(firm,local[id],municipal*weight);
    flow.localDividends=(flow.localDividends??0)+municipal;
  }
  const central=local?dividend*firm.ownership.state:dividend*(firm.ownership.state+firm.ownership.municipal);
  transfer(firm,s.government,central);
  flow.stateDividends+=central;
}

export function territorialDebt(s,id){
  return sum((s.territorialGovernment?.bonds??[]).filter(bond=>id===undefined||bond.territoryId===id)
    .map(bond=>bond.principal+(bond.arrears??0)));
}

export function financeTerritorialInvestment(s,prev,flow,budgetBase){
  const world=s.territorialGovernment;
  if(!world?.localBorrowing)return;
  const before=territorialDebt(s);
  let interest=0,redeemed=0,issued=0,arrearsAdded=0,arrearsPaid=0;
  for(const bond of world.bonds){
    if(bond.issuedMonth===s.month)continue;
    const account=world.accounts[bond.territoryId];
    const liquid=()=>Math.max(0,account.cash-(account.capitalCash??0));
    const coupon=bond.principal*bond.rate/12;
    const past=bond.arrears;
    const couponPaid=Math.min(liquid(),coupon+past);
    arrearsPaid+=Math.min(past,couponPaid);
    arrearsAdded+=coupon-Math.max(0,couponPaid-past);
    const principalPaid=bond.maturity<=s.month?Math.min(Math.max(0,liquid()-couponPaid),bond.principal):0;
    const fraction=principalPaid/bond.principal;
    for(const [i,holding] of bond.householdHoldings.entries()){
      const couponShare=couponPaid*holding/bond.principal;
      s.households[i].cash+=couponShare+holding*fraction;
      s.households[i].bondIncome+=couponShare;
      bond.householdHoldings[i]-=holding*fraction;
    }
    account.cash-=couponPaid+principalPaid;
    bond.arrears=coupon+past-couponPaid;
    bond.principal-=principalPaid;
    redeemed+=principalPaid;
    interest+=couponPaid;
  }
  world.bonds=world.bonds.filter(bond=>bond.principal>moneyTolerance);
  const areas=territorialGeography(s,prev.regional?.regions);
  const output=sum(areas.map(area=>area.output));
  const receipts=prev.lastReport.fiscal?.territorialGrants??[];
  const last=prev.territorialGovernment?.last?.rows??[];
  for(const area of areas){
    const platform=leaderPlatform(s,area);
    const capitalRate=world.fiscal?.spendingRates?.[area.id]?.publicInvestment??0;
    if(!platform||capitalRate<=0)continue;
    const account=world.accounts[area.id];
    if(world.bonds.some(bond=>bond.territoryId===area.id&&(bond.arrears>moneyTolerance||bond.maturity<=s.month)))continue;
    const revenue=(last.find(row=>row.id===area.id)?.retained??0)+sum(receipts.filter(row=>row.territoryId===area.id).map(row=>row.paid));
    const desired=budgetBase*area.output/Math.max(1e-9,output)*capitalRate/100;
    const willingness=clamp(.5-.25*(platform.economy??0)+.15*(platform.environment??0),.1,.9);
    const headroom=Math.max(0,revenue*12*willingness-territorialDebt(s,area.id));
    const demand=Math.min(headroom,Math.max(0,desired-account.cash)*willingness);
    if(demand<=moneyTolerance)continue;
    const room=s.households.map(h=>Math.max(0,h.cash-h.income*3)*.004);
    const available=sum(room);
    const principal=Math.min(available,demand);
    if(principal<=moneyTolerance)continue;
    const householdHoldings=room.map(value=>principal*value/available);
    householdHoldings.forEach((value,i)=>{s.households[i].cash-=value;});
    world.bonds.push({territoryId:area.id,principal,householdHoldings,issuedMonth:s.month,maturity:s.month+24,
      rate:Math.max(0,(s.monetary.effectiveRate??s.policy.rate)/100+flow.sovereignSpread+.02),arrears:0});
    account.cash+=principal;
    account.capitalCash=(account.capitalCash??0)+principal;
    issued+=principal;
  }
  flow.localBonds={issued,interest,redeemed,
    residual:territorialDebt(s)-before-issued+redeemed-arrearsAdded+arrearsPaid};
}

export function validateTerritorialAssets(s,entities){
  const world=s.territorialGovernment;
  if(!world)return;
  for(const owner of [...entities,...s.networks]){
    const shares=owner.localOwners;
    if(shares!==undefined&&(!shares||typeof shares!=='object'||Array.isArray(shares)||
      Object.entries(shares).some(([id,value])=>!Object.hasOwn(world.accounts,id)||!Number.isFinite(value)||value<0)||
      Math.abs(sum(Object.values(shares))-1)>moneyTolerance))
      throw new Error('Повреждены доли муниципальных собственников.');
  }
  for(const account of Object.values(world.accounts)){
    if(account.capitalCash!==undefined&&(!Number.isFinite(account.capitalCash)||account.capitalCash< -moneyTolerance||account.capitalCash>account.cash+moneyTolerance))
      throw new Error('Повреждены средства местных капитальных программ.');
  }
  if(world.bonds!==undefined&&(!Array.isArray(world.bonds)||world.bonds.some(bond=>
    !Object.hasOwn(world.accounts,bond.territoryId)||!Number.isFinite(bond.principal)||bond.principal<=0||
    !Number.isFinite(bond.rate)||bond.rate<0||!Number.isFinite(bond.arrears)||bond.arrears<0||
    !Number.isInteger(bond.issuedMonth)||!Number.isInteger(bond.maturity)||bond.maturity<=bond.issuedMonth||
    !Array.isArray(bond.householdHoldings)||bond.householdHoldings.length!==s.households.length||
    bond.householdHoldings.some(value=>!Number.isFinite(value)||value< -moneyTolerance)||
    Math.abs(sum(bond.householdHoldings)-bond.principal)>moneyTolerance*Math.max(1,bond.principal))))
    throw new Error('Повреждены местные облигации.');
}

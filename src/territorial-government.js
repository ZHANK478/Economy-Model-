import {clamp,hash} from './political-config.js';
import {britishName} from './leader-names.js';
import {UK_REGIONS_2000,EDINBURGH_2000} from './uk-regional-calibration.js';

const sum=rows=>rows.reduce((a,b)=>a+b,0);
const TERM_MONTHS=48;
const LONDON_MAYOR='TLI:city',LEGACY_LONDON_GOVERNOR='TLI:region';
const scotland=UK_REGIONS_2000.find(region=>region.id===EDINBURGH_2000.regionId);
export const LOCAL_TAX_SHARE=.20;
export const territorialActive=s=>s.territorialGovernment?.version===1;
export const territorialCash=s=>sum(Object.values(s.territorialGovernment?.accounts??{}).map(a=>a.cash));
export function territorialRules(s){
  const c=s.politics.constitution;
  return {tax:c.territorialTax??'central',
    spending:c.territorialSpending??(s.scenario?.id==='uk-2000'?'local':'central'),property:c.territorialProperty??'central',borrowing:c.territorialBorrowing??'central'};
}

// The regional authority and its municipalities receive distinct shares. For
// Greater London has one territory and one tax base.
export function territorialGeography(s,accounts=s.regional?.regions){
  if(s.scenario?.id==='uk-2000'&&!accounts){
    return territorialGeography(s,UK_REGIONS_2000.map(r=>({
      id:r.id,name:r.name,population:r.population,nominalGDPMonthly:r.gvaMillionGBP,
      cities:[r.city,...(r.id===EDINBURGH_2000.regionId?[EDINBURGH_2000]:[])].map(city=>({
        ...city,nominalGDPMonthly:city.gvaMillionGBP,
      })),
    })));
  }
  return (accounts??[]).flatMap(region=>{
    const cities=region.cities??[region.city];
    const knownCities=region.id===EDINBURGH_2000.regionId&&!cities.some(city=>city.id===EDINBURGH_2000.id)
      ? [...cities,{...EDINBURGH_2000,
        population:region.population*EDINBURGH_2000.population/scotland.population,
        nominalGDPMonthly:region.nominalGDPMonthly*EDINBURGH_2000.gvaMillionGBP/scotland.gvaMillionGBP}]
      : cities;
    const municipalities=knownCities.filter(city=>city.id!==region.id);
    const population=Math.max(0,region.population-sum(municipalities.map(city=>city.population)));
    const output=Math.max(0,region.nominalGDPMonthly-sum(municipalities.map(city=>city.nominalGDPMonthly)));
    return [{id:region.id,region:region.id,city:false,name:region.name,population,output,
      unemployment:region.labor?.unemploymentRate??.06,urban:region.geography?.urbanShare??.5},
    ...municipalities.map(city=>({id:city.id,region:region.id,city:true,name:city.name,population:city.population,
      output:city.nominalGDPMonthly,unemployment:region.labor?.unemploymentRate??.06,urban:.9}))];
  });
}

const roleKey=(id,city)=>id+(city?':city':':region');
const traits={
  economy:['Муниципальные услуги','Бюджетная сдержанность'],
  environment:['Поддержка строительства','Экологические проекты'],
};
function makeOfficeholder(s,office,party){
  const world=s.territorialGovernment;
  const id='territory-person-'+world.nextPerson++;
  const seed=s.characters?.seed??s.politics.characterSeed??s.seed;
  const roll=key=>hash(seed,id,key);
  const profile=Number(roll('profile')<.5);
  const used=new Set([...Object.values(world.people).map(p=>p.name),...Object.values(s.characters?.people??{}).map(p=>p.name)]);
  const name=britishName(seed,id,profile,used);
  const traitKeys=Object.keys(traits);
  const axis=traitKeys[Math.floor(roll('priority')*traitKeys.length)];
  const policy=(party.platform?.[axis]??0)+(roll('position')-.5)*.65;
  const age=33+Math.floor(roll('age')*29);
  const years=-Math.log1p(-roll('survival'));
  const deathAge=55+8/Math.LN2*Math.log(Math.exp(Math.LN2/8*(age-55))+years*Math.LN2/(8*.005));
  const person={id,name,profile,partyId:party.id,birthMonth:s.month-age*12,
    deathMonth:s.month+Math.max(1,Math.ceil((Math.min(106,deathAge)-age)*12)),
    trait:traits[axis][Number(policy>=0)],axis,position:policy,from:s.month,to:null,
    city:office.city,territoryId:office.territoryId};
  world.people[id]=person;
  office.personId=id;
  office.until=s.month+TERM_MONTHS;
}

export function initializeTerritorialGovernment(s,ballots,{londonMayor=false}={}){
  if(territorialActive(s)||!s.politics.enabled)return;
  const territories=territorialGeography(s);
  if(!territories.length)throw new Error('Сначала создайте учёт территории.');
  const offices={};
  for(const area of territories){
    const roles=area.id==='TLI'?(londonMayor?[true]:[false,true]):[area.city];
    for(const city of roles){
      const id=roleKey(area.id,city);
      offices[id]={id,territoryId:area.id,city,personId:null,until:null,election:null};
    }
  }
  s.territorialGovernment={version:1,started:s.month,nextPerson:1,people:{},offices,last:null,
    accounts:Object.fromEntries(territories.map(area=>[area.id,{cash:0}]))};
  if(londonMayor&&offices[LONDON_MAYOR])s.territorialGovernment.londonMayorRevision=1;
  updateTerritorialOffices(s,ballots,true);
}

export function territorialOfficeId(s,id){
  return id===LEGACY_LONDON_GOVERNOR&&s.territorialGovernment?.londonMayorRevision===1?LONDON_MAYOR:id;
}

export function unifyLondonMayor(s){
  const world=s.territorialGovernment;
  const former=world?.offices[LEGACY_LONDON_GOVERNOR];
  if(!former||!world.offices[LONDON_MAYOR])return;
  const formerLeader=world.people[former.personId];
  if(formerLeader)formerLeader.to=s.month;
  delete world.offices[LEGACY_LONDON_GOVERNOR];
  world.londonMayorRevision=1;
  const retarget=order=>{order.officeId=territorialOfficeId(s,order.officeId);};
  for(const order of world.programs??[])retarget(order);
  for(const order of world.lastPrograms?.orders??[])retarget(order);
  if(world.standingPrograms){
    const standing={};
    for(const order of Object.values(world.standingPrograms)){
      retarget(order);
      const key=order.officeId+'|'+order.programme;
      if(!standing[key]||order.id>standing[key].id)standing[key]=order;
    }
    world.standingPrograms=standing;
  }
}

export function updateTerritorialOffices(s,ballots,initial=false){
  if(!territorialActive(s))return;
  const world=s.territorialGovernment;
  const elected=s.policy.localElections;
  const parties=s.politics.parties.filter(p=>p.active&&!p.independent);
  const due=Object.values(world.offices).filter(office=>{
    const incumbent=world.people[office.personId];
    return incumbent?incumbent.deathMonth<=s.month||office.until<=s.month:elected||initial;
  });
  if(!due.length)return;
  const votes=elected?ballots(s,parties):{};
  for(const office of due){
    const incumbent=world.people[office.personId];
    if(incumbent)incumbent.to=s.month;
    office.personId=null;office.until=null;
    const areaKey=office.city?office.territoryId:'region:'+office.territoryId;
    const results=votes[areaKey]??{};
    const winner=elected?parties.reduce((best,p)=>!best||(results[p.id]??0)>(results[best.id]??0)?p:best,null):
      initial?parties.find(p=>p.id===s.politics.executive.playerParty):null;
    if(!winner)continue;
    if(elected){
      const turnout=sum(Object.values(results));
      office.election={month:s.month,partyId:winner.id,share:turnout>0?(results[winner.id]??0)/turnout:0};
    }
    makeOfficeholder(s,office,winner);
    if(initial)office.until=s.month+12+Math.floor(hash(s.seed,office.id,'term')*37);
  }
}

export function appointTerritorialLeader(s,officeId){
  officeId=territorialOfficeId(s,officeId);
  const office=Object.hasOwn(s.territorialGovernment?.offices??{},officeId)?s.territorialGovernment.offices[officeId]:null;
  if(s.policy.localElections||!office||office.personId)throw new Error('Назначение возможно при свободной должности без местных выборов.');
  const party=s.politics.parties.find(p=>p.id===s.politics.executive.playerParty&&p.active&&!p.independent);
  if(!party)throw new Error('Для назначения нужна действующая партия.');
  makeOfficeholder(s,office,party);
}

export const territorialFiscalReformed=s=>s.territorialGovernment?.fiscalRevision===2;
const taxKeys=['vat','incomeTax','corporateTax'];
const zeroTax=()=>Object.fromEntries(taxKeys.map(key=>[key,0]));

function localTaxRates(rules,leader,left){
  return rules.tax==='local'&&leader?{vat:.5+2*left,incomeTax:.5+2.5*left,corporateTax:2*left}:zeroTax();
}

export function territorialTaxRates(s,id,city){
  const leader=territorialOffice(s,id,city)?.person;
  const economy=s.politics.parties.find(p=>p.id===leader?.partyId)?.platform?.economy??0;
  return localTaxRates(territorialRules(s),leader,(1-clamp(economy,-1,1))/2);
}

export function prepareTerritorialFiscal(s,prev){
  if(!territorialFiscalReformed(s))return null;
  const world=s.territorialGovernment,rules=territorialRules(s),previous=prev.territorialGovernment.fiscal;
  const areas=territorialGeography(s,prev.regional?.regions);
  const taxRates={},spendingRates={};
  const totals={population:sum(areas.map(a=>a.population)),output:sum(areas.map(a=>a.output))};
  const rates=zeroTax();
  const weights={};
  for(const area of areas){
    const leader=territorialOffice(s,area.id,area.city)?.person;
    const platform=s.politics.parties.find(p=>p.id===leader?.partyId)?.platform;
    const economy=clamp(platform?.economy??0,-1,1),environment=clamp(platform?.environment??0,-1,1);
    const left=(1-economy)/2;
    // Territorial rates are percentage points on the underlying tax bases.
    const local=localTaxRates(rules,leader,left);
    taxRates[area.id]=local;
    const population=area.population/Math.max(1e-9,totals.population);
    const output=area.output/Math.max(1e-9,totals.output);
    weights[area.id]={vat:population,incomeTax:(population+output)/2,corporateTax:output};
    for(const key of taxKeys)rates[key]+=local[key]*weights[area.id][key];
    spendingRates[area.id]=rules.spending==='local'?{
      education:.5+1.2*left,healthcare:.35+.9*left,
      publicInvestment:.45+.35*left+.2*environment,
      infrastructureMaintenance:.35+.25*left,
    }:{};
  }
  const centralRates=rules.tax==='central'?(previous?.tax==='local'?previous.rates:previous?.centralRates??zeroTax()):zeroTax();
  world.fiscal={...rules,taxRates,spendingRates,rates,centralRates,weights,
    commitments:previous?.commitments??{}};
  return {add:rules.tax==='local'?rates:centralRates,local:rates};
}

const budgetKeys=['education','healthcare','publicInvestment','infrastructureMaintenance'];
export function territorialBudgetPlan(s,prev,budgetBase,requested){
  if(!territorialActive(s))return null;
  const rules=territorialRules(s),world=s.territorialGovernment,p=s.policy;
  const services=s.localGovernment?.servicesShare??p.municipalServicesShare/100;
  const investment=s.localGovernment?.infrastructureShare??p.municipalInvestmentShare/100;
  const split={education:.85*services,healthcare:.55*services,publicInvestment:investment,infrastructureMaintenance:investment};
  const planned=Object.fromEntries(budgetKeys.map(k=>[k,rules.spending==='local'?budgetBase*p[k]/100*split[k]:0]));
  const areas=territorialGeography(s,prev.regional?.regions);
  if(territorialFiscalReformed(s)){
    const fiscal=world.fiscal,output=sum(areas.map(area=>area.output));
    const rows=areas.map(area=>{
      const base=budgetBase*area.output/Math.max(1e-9,output);
      const appropriations=fiscal.spendingRates[area.id]??{};
      const plannedByKey=Object.fromEntries(budgetKeys.map(key=>[key,base*(appropriations[key]??0)/100]));
      const account=world.accounts[area.id];
      const capital=Math.min(account.capitalCash??0,plannedByKey.publicInvestment);
      const total=sum(Object.values(plannedByKey))-capital;
      const own=Math.min(Math.max(0,account.cash-(account.capitalCash??0)),total)+capital;
      plannedByKey.publicInvestment-=capital;
      return {id:area.id,regionId:area.region,output:area.output,base,plannedByKey,total,own,capital,grant:0};
    });
    const takeover=rules.spending==='central'?rows.flatMap(row=>Object.entries(fiscal.commitments[row.id]??{})
      .filter(([,share])=>share>0).map(([programme,share])=>({territoryId:row.id,regionId:row.regionId,programme,amount:row.base*share/100}))):[];
    return {rules,rows,own:sum(rows.map(row=>row.own)),grant:0,planned:{},central:requested,requested,takeover};
  }
  const recipients=areas.map(area=>{
    const leader=territorialOffice(s,area.id,area.city)?.person;
    const party=s.politics.parties.find(p=>p.id===leader?.partyId);
    const platform=party?.platform??{};
    const servicePriority=1-.17*(platform.economy??0)-.07*(leader?.axis==='economy'?leader.position:0);
    const buildingPriority=1+.17*(platform.environment??0)+.07*(leader?.axis==='environment'?leader.position:0);
    return {...area,weights:{education:area.population*servicePriority,
      healthcare:area.population*servicePriority,publicInvestment:area.output*buildingPriority,
      infrastructureMaintenance:area.output*buildingPriority}};
  });
  const denominators=Object.fromEntries(budgetKeys.map(k=>[k,sum(recipients.map(a=>a.weights[k]))]));
  const rows=recipients.map(area=>{
    const plannedByKey=Object.fromEntries(budgetKeys.map(k=>[k,planned[k]*area.weights[k]/Math.max(denominators[k],1e-12)]));
    const total=sum(Object.values(plannedByKey)),cash=world.accounts[area.id].cash;
    const own=rules.spending==='local'?Math.min(cash,total):0;
    const grant=rules.spending==='local'&&rules.tax==='central'?total-own:0;
    return {id:area.id,regionId:area.region,output:area.output,plannedByKey,total,own,grant};
  });
  const own=sum(rows.map(a=>a.own)),grant=sum(rows.map(a=>a.grant));
  return {rules,rows,own,grant,planned,central:Math.max(0,requested-sum(Object.values(planned)))+grant,requested};
}

export function settleTerritorialPurchases(s,plan,actual,budget,centralBudget){
  if(!plan)return null;
  const world=s.territorialGovernment;
  const factor=budget>0?clamp(actual/budget):0;
  const centralScale=plan.central>0?centralBudget/plan.central:0;
  const rows=plan.rows.map(row=>{
    const own=row.own*factor,grant=row.grant*centralScale;
    const grantReserve=grant*(1-factor);
    const spending=own+grant-grantReserve;
    const capital=(row.capital??0)*factor;
    const byKey=Object.fromEntries(budgetKeys.map(k=>[k,row.total>0?(spending-capital)*row.plannedByKey[k]/row.total:0]));
    const account=world.accounts[row.id];
    if(capital>0){byKey.publicInvestment+=capital;account.capitalCash=Math.max(0,account.capitalCash-capital);}
    account.cash+=grantReserve-own;
    return {id:row.id,regionId:row.regionId,own,grant,grantReserve,spending,byKey,collected:0,remitted:0,retained:0};
  });
  const own=sum(rows.map(row=>row.own));
  if(territorialFiscalReformed(s)&&plan.rules.spending==='local'){
    world.fiscal.commitments=Object.fromEntries(rows.map((row,i)=>[row.id,Object.fromEntries(
      budgetKeys.map(key=>[key,100*row.byKey[key]/Math.max(1e-9,plan.rows[i].base)]))]));
  }
  world.last={month:s.month,rules:plan.rules,rows,own,grant:sum(rows.map(row=>row.grant)),
    retained:0,grantReserve:sum(rows.map(row=>row.grantReserve)),spending:sum(rows.map(row=>row.spending))};
  return world.last;
}

export function settleTerritorialTaxes(s,plan,flow){
  if(!plan)return;
  const world=s.territorialGovernment,{last}=world;
  if(territorialFiscalReformed(s)){
    const fiscal=world.fiscal,local=flow.localTax??zeroTax();
    const total=sum(Object.values(local));
    const retainFraction=plan.rules.spending==='local'&&total>0?Math.min(1,Math.max(0,s.government.cash)/total):0;
    for(const row of last.rows){
      const receipts=Object.fromEntries(taxKeys.map(key=>[key,fiscal.rates[key]>0?
        local[key]*fiscal.weights[row.id][key]*fiscal.taxRates[row.id][key]/fiscal.rates[key]:0]));
      row.collected=sum(Object.values(receipts));
      row.retained=row.collected*retainFraction;
      row.remitted=row.collected-row.retained;
      world.accounts[row.id].cash+=row.retained;
      row.cash=world.accounts[row.id].cash;
    }
    last.retained=sum(last.rows.map(row=>row.retained));
    s.government.cash-=last.retained;
    last.centralTax=flow.tax-last.retained;
    last.centralPurchases=flow.purchases-last.spending;
    flow.territorial=last;
    return;
  }
  const taxBase=Math.max(0,flow.vat+flow.incomeTax+flow.corporateTax);
  const gross=plan.rules.tax==='local'?taxBase*LOCAL_TAX_SHARE:0;
  const transferable=Math.min(gross,Math.max(0,s.government.cash));
  const weight=sum(plan.rows.map(row=>row.output));
  for(const [i,row] of last.rows.entries()){
    const account=world.accounts[row.id];
    const share=weight>0?plan.rows[i].output/weight:1/last.rows.length;
    row.collected=gross*share;
    if(plan.rules.spending==='local')row.retained=transferable*share;
    row.remitted=row.collected-row.retained;
    account.cash+=row.retained;
    row.cash=account.cash;
  }
  last.retained=sum(last.rows.map(r=>r.retained));
  s.government.cash-=last.retained;
  last.centralTax=flow.tax-last.retained;
  last.centralPurchases=flow.purchases-last.spending;
  flow.territorial=last;
}

export function territorialOffice(s,id,city){
  const world=s.territorialGovernment;
  const office=world?.offices[territorialOfficeId(s,roleKey(id,city))];
  return office?{office,person:world.people[office.personId]}:null;
}

export function validateTerritorialGovernment(s){
  if(s.territorialGovernment===undefined)return;
  const w=s.territorialGovernment;
  if(!territorialActive(s)||!s.politics.enabled||!Number.isInteger(w.started)||w.started<0||w.started>s.month||!Number.isSafeInteger(w.nextPerson)||w.nextPerson<1||
    !w.accounts||!w.offices||!w.people||!Object.keys(w.accounts).length||
    w.londonMayorRevision!==undefined&&(w.londonMayorRevision!==1||!w.offices[LONDON_MAYOR]||Boolean(w.offices[LEGACY_LONDON_GOVERNOR]))||
    Object.values(w.accounts).some(a=>!Number.isFinite(a.cash)||a.cash< -1e-8)||
    Object.values(w.offices).some(o=>!Object.hasOwn(w.accounts,o.territoryId)||Boolean(o.personId)!==Number.isInteger(o.until)||o.personId&&!w.people[o.personId])||
    Object.values(w.people).some(p=>!p.name||!Number.isInteger(p.deathMonth)||p.to!==null&&!Number.isInteger(p.to)))throw new Error('Повреждено территориальное управление');
}

// Shared structural equations. This module never reads poor/middle/rich.
// SFC cash/asset postings are made by the engine, not by the real-side functions.
import {INPUTS} from './config.js';
import {enterpriseValue} from './ownership.js';
import {validateStructure} from './economic-structure.js';
// Coarse common technical recipe for the new five-sector aggregation. The
// agriculture row excludes food processing, which belongs to industry.
// All countries share this matrix; it is a modelling assumption, not an IO survey.
export const OPEN_INPUTS=INPUTS.map((row,i)=>i===0?[.03,0,.01,0,.001]:[...row]);
const sum=a=>a.reduce((a,b)=>a+b,0);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const logistic=x=>1/(1+Math.exp(-clamp(x,-40,40)));
const logit=x=>Math.log(x/(1-x));
const monthly=g=>Math.expm1(Math.log1p(g)/12);
const colsum=j=>sum(OPEN_INPUTS.map(r=>r[j]));

// Common behavioural assumptions, versioned and exported, never UI sliders.
export const OPEN_PARAMETERS=Object.freeze({
 capitalShare:.35,normalUtilization:.90,tradeSigma:3,tradeAdjustment:1-Math.exp(-1/12),
 capitalAdjustment:1-Math.exp(-1/36),portfolioAdjustment:1-Math.exp(-1/24),
 inflationInertia:0,priceAdjustment:1-Math.exp(-1/12),
 migrationIncomeResponse:.0015,migrationEmploymentResponse:.005,migrationMaximum:.005,
 networkRequirement:1500,networkElasticity:.12,
 worldFrontierGrowth:.009,adoptionEfficiency:.30,innovationEfficiency:.035,
 researchShare:.05,knowledgeDepreciation:.15,riskPrice:.04,globalCrossBorderShare:.025,sovereignLossGivenDefault:.45,
 depreciationStructures:.031,depreciationEquipment:.126,equipmentShare:.40
});
// Approximate year-2000 scale, not a reconstruction of 2000-2030 history.
const WORLD_REGIONS=[
 {id:'advanced',gdp:25000000,population:950,saving:.22,capitalOutput:3.2,laborGrowth:.004,technologyGrowth:.012,imports:[.014,.025,.070,0,.045]},
 {id:'industrializing',gdp:6500000,population:3400,saving:.27,capitalOutput:2.7,laborGrowth:.012,technologyGrowth:.016,imports:[.022,.032,.075,0,.025]},
 {id:'other',gdp:2300000,population:1750,saving:.20,capitalOutput:2.3,laborGrowth:.022,technologyGrowth:.012,imports:[.028,.028,.055,0,.025]}
];
// Same technology frontier for every initial country. Units follow K and L below.
// Chosen reference levels, NOT estimates of a universal frontier.
const FRONTIER=[130,220,170,140,150];
export function humanCapital(years){
 const s=clamp(years,0,18);
 return Math.exp(.134*Math.min(s,4)+.101*clamp(s-4,0,4)+.068*Math.max(0,s-8));
}
export function networkFactor(s){
 const k=s.economy.parameters;
 const provision=s.infrastructure/Math.max(s.population*k.networkRequirement,1e-9);
 return Math.pow(.20+.80*(-Math.expm1(-provision)),k.networkElasticity);
}
export function sectorCapacity(s,f,workers=f.workers){
 const k=s.economy.parameters,h=humanCapital(s.education.meanYears);
 const labor=Math.max(0,workers)*h*s.policy.normalWorkweek/40*(1-f.labor.strikeShare);
 return f.technology*f.productivity*Math.pow(Math.max(0,f.capital),k.capitalShare)
  *Math.pow(labor,1-k.capitalShare)*networkFactor(s)*f.managementEfficiency;
}
export function structuralLaborDemand(s,f){
 const k=s.economy.parameters,a=k.capitalShare;
 const scale=f.technology*f.productivity*Math.pow(Math.max(f.capital,1e-9),a)*networkFactor(s)*f.managementEfficiency;
 const effective=Math.pow(Math.max(0,f.salesExpected)/Math.max(scale*k.normalUtilization,1e-9),1/(1-a));
 return effective/Math.max(humanCapital(s.education.meanYears)*s.policy.normalWorkweek/40*(1-f.labor.strikeShare),.01);
}
export function structuralDepreciation(s){
 const p=s.economy.parameters;
 return 1-Math.pow(1-p.depreciationStructures,1-p.equipmentShare)*Math.pow(1-p.depreciationEquipment,p.equipmentShare);
}
export function validateOpenParameters(p){
 const number=(v,min=0,max=Infinity)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!p||Object.keys(p).length!==Object.keys(OPEN_PARAMETERS).length||Object.entries(p).some(([k,v])=>!(k in OPEN_PARAMETERS)||!number(v,0,k==='networkRequirement'?100000:10))||!number(p.capitalShare,.05,.9)||!number(p.normalUtilization,.1,1)||!number(p.tradeSigma,1.01,10)||!number(p.networkRequirement,1e-9))throw new Error('Повреждены структурные параметры');
 for(const k of ['tradeAdjustment','capitalAdjustment','portfolioAdjustment','researchShare','equipmentShare','inflationInertia','priceAdjustment','migrationMaximum'])if(!number(p[k],0,1))throw new Error('Структурная доля вне диапазона');
 for(const k of ['depreciationStructures','depreciationEquipment','knowledgeDepreciation','sovereignLossGivenDefault'])if(!number(p[k],0,.99))throw new Error('Некорректный износ или потеря');
 return p;
}
export function initializeOpenEconomy(s,structure,overrides={},revision=2){
 const c=validateStructure(structure);
 if(![1,2].includes(revision))throw new Error('Неизвестная ревизия механизмов');
 s.economy={version:1,revision,parameters:validateOpenParameters({...OPEN_PARAMETERS,...overrides}),initial:structuredClone(c),
  regions:WORLD_REGIONS.map(r=>({...r,imports:[...r.imports],capital:r.gdp*r.capitalOutput,initialCapital:r.gdp*r.capitalOutput,initialGDP:r.gdp,initialPopulation:r.population,technology:1})),
  frontier:[...FRONTIER],tradeWeights:[],initialTradeCost:c.tradeCost,
  foreignCreditRatio:c.foreignCreditRatio,previousWorldGDP:sum(WORLD_REGIONS.map(r=>r.gdp)),worldGDPHistory:[],
  last:{greenfieldUSD:0,portfolioEquityUSD:0,portfolioOutflowUSD:0}};
 const e=s.economy;
 s.education={access:c.expectedSchooling/12,meanYears:c.schooling,expectedYears:c.expectedSchooling};
 s.skills=humanCapital(c.schooling)/humanCapital(8);
 s.participation=c.participation;
 s.institutions.informality=c.informality;
 s.institutions.taxCompliance=1-c.informality*(1.15-.35*s.policy.taxEnforcement/100);
 s.institutions.courtCapacity=c.courtCapacity;s.institutions.antitrustCapacity=c.administrativeCapacity;
 s.institutions.soeAuditCapacity=c.administrativeCapacity;s.institutions.contractReliability=c.courtCapacity;
 s.institutions.registrationDays=s.policy.registrationProcedures*(2+.65/c.administrativeCapacity);
 s.institutions.contractDelayDays=180*.65/c.courtCapacity;
 const employment=s.population*(1-s.parameters.initialChildShare-s.parameters.initialElderlyShare)*s.participation*.91;
 const totalCredit=s.base.monthlyGDP*12*c.creditRatio,corporateCredit=totalCredit*(1-c.householdCreditShare);
 const grossVA=s.firms.map((f,i)=>f.production*(1-colsum(i)-f.importCoefficient)),totalVA=sum(grossVA);
 s.firms.forEach((f,i)=>{
  f.workers=employment*c.workerShares[i];
  // Private network stocks were already separated by initializeInfrastructure.
  f.capital=Math.max(grossVA[i]*12*c.capitalOutput[i]-(f.infrastructureCapital??0),grossVA[i]*12);
  f.initialCapital=f.capital;
  f.wage=grossVA[i]*.58/Math.max(f.workers,1e-9);f.referenceWage=f.wage;
  f.laborProductivity=f.production/Math.max(f.workers,1e-9);
  f.loanLC=corporateCredit*grossVA[i]/totalVA*.85;
  f.loanFX=corporateCredit*grossVA[i]/totalVA*.15;
  const a=e.parameters.capitalShare,h=humanCapital(c.schooling);
  f.technology=f.capacity/(Math.pow(f.capital,a)*Math.pow(f.workers*h,1-a)*networkFactor(s));
  f.initialTechnology=f.technology;f.knowledgeCapital=0;
  f.lastProfit=grossVA[i]*.32;f.expectedOperatingSurplus=grossVA[i]*.42;f.expectedValueAdded=grossVA[i];
  f.expectedSales=f.production;f.referenceWage=f.wage;
  f.foreignEquityUSD=enterpriseValue(s,f)*f.ownership.foreign;
  // Opening plans must sum to the investment used to calibrate opening GDP.
  // Replacing that flow by depreciation silently started every country with an
  // investment shock before any decision was made.
  f.lastInvestment=revision>=2?s.base.investment*grossVA[i]/totalVA:f.capital*structuralDepreciation(s)/12;
 });
 s.households.forEach(h=>{const share=h.wageShare*.8+h.dividendShare*.2;h.loanLC=totalCredit*c.householdCreditShare*share*.8;h.loanFX=totalCredit*c.householdCreditShare*h.dividendShare*.2;});
 const estimateImports=s.base.imports;
 s.government.reservesUSD=estimateImports*c.reserveMonths;
 s.services.publicHealthCapacity=c.healthAccess;s.services.publicHealthDelivered=c.healthAccess;
 s.services.publicEducationCapacity=Math.min(1,c.expectedSchooling/12);s.services.publicEducationDelivered=s.services.publicEducationCapacity;
 s.services.healthCoverage=c.healthAccess;s.services.educationCoverage=s.services.publicEducationCapacity;
 s.services.healthByGroup.fill(c.healthAccess);s.services.educationByGroup.fill(s.services.publicEducationCapacity);
 s.base.initialPublicCapital=sum(s.firms.map(f=>f.capital*f.ownership.state));
 e.tradeWeights=s.firms.map((f,i)=>{
  const market=sum(e.regions.map(r=>r.gdp/12*r.imports[i]));
  const initial=s.base.exports*s.base.exportWeights[i];
  return market>0?clamp(initial/market,0,.95):0;
 });
 s.firms.forEach((f,i)=>{
  // Price/cost margins are calibrated from the initial observed price, not a
  // universal markup imposed on countries with different initial factor costs.
  const output=f.production;
  const cost=colsum(i)+f.importCoefficient+f.workers*f.wage/(1-e.parameters.capitalShare)/output;
  f.costMarkup=1/cost;
 });
 e.worldGDPHistory=Array.from({length:13},(_,i)=>({month:i-12,gdp:sum(e.regions.map(r=>r.gdp))/Math.pow(1.03,(12-i)/12)}));
}
export function advanceWorldEconomy(s){
 const e=s.economy,p=e.parameters;
 for(const r of e.regions){
  r.capital=r.capital*Math.pow(.95,1/12)+r.gdp*r.saving/12;
  r.population*=1+monthly(r.laborGrowth);r.technology*=1+monthly(r.technologyGrowth);
  r.gdp=r.initialGDP*r.technology*Math.pow(r.capital/r.initialCapital,p.capitalShare)*Math.pow(r.population/r.initialPopulation,1-p.capitalShare);
 }
 const gdp=sum(e.regions.map(r=>r.gdp));
 const old=e.worldGDPHistory.find(r=>r.month===s.month-12)?.gdp??e.worldGDPHistory[0].gdp;
 e.worldGrowth=(gdp/old-1)*100;e.previousWorldGDP=gdp;
 e.worldGDPHistory.push({month:s.month,gdp});e.worldGDPHistory=e.worldGDPHistory.slice(-13);
 e.frontier=e.frontier.map(a=>a*(1+monthly(p.worldFrontierGrowth)));
 e.globalCapitalBudgetUSD=gdp/12*p.globalCrossBorderShare;
}
export function importUnitPrice(s,w){
 return s.exchangeRate*s.worldPriceIndex/100*(.70+.18*w.energyPrice/100+.12*w.commodityPrice/100);
}
export function exportDemand(s,prev,w){
 const e=s.economy,p=e.parameters,transport=(1+e.initialTradeCost/networkFactor(s));
 const initialTransport=(1+e.initialTradeCost/networkFactor({...s,infrastructure:s.initialInfrastructure,population:s.base.initialPopulation}));
 const byRegion=[];
 const volumes=s.firms.map((f,i)=>{
  const anchor=e.tradeWeights[i];if(!anchor)return 0;
  const worldSectorPrice=s.worldPriceIndex/100*(i===1?w.commodityPrice/100:i===0?Math.pow(w.weather/100,-.2):1);
  const relative=f.price/s.exchangeRate/worldSectorPrice*transport/initialTransport;
  const share=logistic(logit(anchor)+(1-p.tradeSigma)*Math.log(Math.max(relative,1e-9)));
  const region=e.regions.map(r=>r.gdp/12*r.imports[i]*s.worldPriceIndex/100*w.foreignDemand/100*share);
  byRegion[i]=region;
  const desired=sum(region)/(f.price/s.exchangeRate);
  const old=prev.lastReport.market?.exports?.[i]??s.base.exports*s.base.exportWeights[i];
  return Math.max(0,old+p.tradeAdjustment*(desired-old));
 });
 e.last.exportDemandUSD=byRegion;e.last.exportVolumes=volumes;return volumes;
}
export function domesticImportShare(s,base,domesticPrice,foreignPrice){
 const sigma=s.economy.parameters.tradeSigma,anchor=clamp(base,.0001,.9999);
 return logistic(logit(anchor)+(1-sigma)*Math.log(Math.max(foreignPrice,1e-9)/Math.max(domesticPrice,1e-9)));
}
export function consumptionWeights(s){
 // Engel response around the observed initial basket, without a discontinuous
 // change of preferences on the first month. Elasticity is an assumption.
 const initial=s.base.consumption/s.base.initialPopulation;
 const current=Math.max(s.metrics.consumption/s.population,.01);
 const old=s.base.consumptionWeights,food=clamp(old[0]*Math.pow(current/initial,-.35),.03,.85);
 return old.map((v,i)=>i===0?food:v*(1-food)/(1-old[0]));
}
export function investmentOpportunities(s,prev,investmentPrice){
 const e=s.economy,p=e.parameters,delta=structuralDepreciation(s);
 const risk=p.riskPrice*(1-s.institutions.contractReliability)+s.institutions.ownershipRisk*.08;
 const realBorrow=(1+s.bank.lendingRate)/(1+s.expectedInflation)-1;
 return s.firms.map((f,i)=>{
  // Expected operating return excludes financing expenses; debt cost is charged once.
  const marginalRent=p.capitalShare*Math.max(0,f.expectedValueAdded);
  const tax=s.policy.corporateTax/100*s.institutions.taxCompliance;
  const operatingYield=marginalRent*12/Math.max(f.capital*investmentPrice,1e-9)*(1-tax)+delta*tax;
  const debtShare=clamp((f.loanLC+f.loanFX*s.exchangeRate)/Math.max(f.capital*investmentPrice,1e-9),0,1);
  // Retained earnings have an opportunity cost; debt and equity are not both
  // charged the full bank lending rate. Profit tax includes depreciation relief.
  const required=Math.max(.005,debtShare*realBorrow+(1-debtShare)*s.parameters.neutralRealRate)+delta+risk;
  const salesRatio=f.salesExpected/Math.max(f.production,1e-9);
  const demandLimit=clamp(Math.pow(Math.max(.05,salesRatio),1/(1-p.capitalShare)),.50,1.75);
  const q=operatingYield/Math.max(required,.01);
  const targetRatio=Math.min(Math.pow(clamp(q,.10,4),1/(1-p.capitalShare)),demandLimit);
  const target=Math.max(0,f.capital*(delta/12+p.capitalAdjustment*(targetRatio-1)));
  // Installation/planning inertia uses the existing disclosed adjustment
  // assumption. It delays responses; it does not force profitable investment.
  const desired=e.revision>=2?Math.max(0,f.lastInvestment+s.parameters.investmentAdjustment*(target-f.lastInvestment)):target;
  const value=enterpriseValue(s,f),yieldEquity=Math.max(0,f.lastProfit)*12/Math.max(value,1);
  return {sector:i,desired,operatingYield,required,npvPerUnit:operatingYield/required-1,
   foreignScore:(1+yieldEquity)*1.02-1-(s.world.globalRate/100+.025+risk),expectedSalesRatio:salesRatio};
 });
}
export function foreignCreditLimitUSD(s){
 const access=clamp(s.institutions.contractReliability*(1-s.institutions.ownershipRisk)*(s.government.defaultActive?.35:1),0,1);
 const globalRisk=Math.max(0,(s.lastReport.world?.globalRate??s.world.globalRate)-4)/100;
 return s.metrics.nominalGDPAnnual/s.exchangeRate*s.economy.foreignCreditRatio*access/(1+globalRisk*10);
}
export function actuarialSpread(probability,loss,foreignRate){
 const expectedLoss=clamp(probability,0,1)*clamp(loss,0,.99);
 return (1+foreignRate)*expectedLoss/(1-expectedLoss);
}
export function expectedDepositUSDYield(s){
 const depreciationLog=Math.log1p(s.expectedInflation)-Math.log1p(.02);
 return (1+s.bank.depositRate)*Math.exp(-depreciationLog)-1;
}
export function foreignFinancing(s,prev,flow,{foreignPayment},investmentPrice){
 const e=s.economy,p=e.parameters,plans=investmentOpportunities(s,prev,investmentPrice);
 // A finite world saving pool; country exposure is sized by assets, not income label.
 const worldGDP=e.previousWorldGDP,exposure=Math.pow(Math.max(1,s.metrics.nominalGDPAnnual/s.exchangeRate)/worldGDP,.85);
 const supply=Math.min(e.globalCapitalBudgetUSD*exposure,sum(s.firms.map(f=>enterpriseValue(s,f)))/s.exchangeRate*.004);
 const openness=1-s.policy.capitalControls/100;
 const appetites=plans.map(x=>logistic(x.foreignScore/.035)*Math.max(0,x.desired*investmentPrice-s.firms[x.sector].cash*.35));
 const need=sum(appetites);let greenfieldUSD=0;
 plans.forEach((x,i)=>{
  const f=s.firms[i],usd=Math.min(appetites[i]/s.exchangeRate,supply*(need?appetites[i]/need:0));
  if(usd<=0)return;
  const old=enterpriseValue(s,f),fraction=usd*s.exchangeRate/(old+usd*s.exchangeRate);
  foreignPayment(s,f,usd);f.foreignEquityUSD+=usd;greenfieldUSD+=usd;
  for(const key of ['state','domestic','municipal','cooperative'])f.ownership[key]*=1-fraction;
  f.ownership.foreign+=fraction*(1-f.ownership.foreign);
  f.domesticOwners=f.domesticOwners.map(v=>v*(1-fraction));f.workerOwners=f.workerOwners.map(v=>v*(1-fraction));
 });
 // Secondary equity: foreign buyers pay domestic owners; no capital or GDP entry.
 let portfolioEquityUSD=0;
 plans.forEach((x,i)=>{
  const f=s.firms[i],value=enterpriseValue(s,f),owners=sum(f.domesticOwners);
  if(owners<=0)return;
  const cost=Math.min(value*owners*.001,Math.max(0,supply-greenfieldUSD)*s.exchangeRate*.10/5)*logistic(x.foreignScore/.035);
  const share=cost/value;
  s.households.forEach((h,j)=>foreignPayment(s,h,cost/s.exchangeRate*f.domesticOwners[j]/owners));
  f.domesticOwners=f.domesticOwners.map(v=>v*(1-share/owners));
  f.ownership.domestic-=share;f.ownership.foreign+=share;f.foreignEquityUSD+=cost/s.exchangeRate;
  portfolioEquityUSD+=cost/s.exchangeRate;
 });
 const foreignYield=s.world.globalRate/100,domesticUSDYield=expectedDepositUSDYield(s);
 const targetShare=logistic(logit(.12)+(foreignYield-domesticUSDYield+(.65-s.institutions.contractReliability)*.04)/.08);
 let flightUSD=0;
 for(const h of s.households){
  const wealth=Math.max(0,h.cash/s.exchangeRate)+h.foreignSavingsUSD;
  const requested=(wealth*targetShare-h.foreignSavingsUSD)*p.portfolioAdjustment;
  const usd=requested>0?Math.min(requested,Math.max(0,h.cash)/s.exchangeRate*.03,Math.max(0,s.bank.foreignAssetsUSD+foreignCreditLimitUSD(s)))*openness:Math.max(requested,-h.foreignSavingsUSD);
  foreignPayment(s,h,-usd);h.foreignSavingsUSD+=usd;flightUSD+=usd;
 }
 e.last={...e.last,investmentPlans:plans,greenfieldUSD,portfolioEquityUSD,portfolioOutflowUSD:flightUSD};
 return {inflowUSD:greenfieldUSD+portfolioEquityUSD,flightUSD,plans};
}
export function completeTechnology(s,project){
 const f=s.firms[project.sector],e=s.economy,p=e.parameters;
 const installed=project.amount*project.efficiency,ratio=installed/Math.max(f.capital,1e-9);
 const frontier=e.frontier[project.sector],current=f.technology*f.productivity;
 const gap=Math.max(0,Math.log(frontier/Math.max(current,1e-9)));
 const skills=humanCapital(s.education.meanYears)/humanCapital(12);
 const imported=project.importShare??s.base.investmentImport;
 const adoption=p.adoptionEfficiency*ratio*imported*skills*gap;
 const innovation=p.innovationEfficiency*ratio*p.researchShare*skills;
 f.productivity*=Math.exp(adoption+innovation);
 f.knowledgeCapital+=installed*p.researchShare;
 return installed*(1-p.researchShare);
}
export function observeOperatingSurplus(s,f,revenue,inputCost,payroll,tax){
 const realized=revenue-inputCost-payroll-tax;
 f.expectedOperatingSurplus+=1/12*(realized-f.expectedOperatingSurplus);
  f.expectedValueAdded+=1/12*(revenue-inputCost-tax-f.expectedValueAdded);
}
export function openEconomyMetrics(s){
 const e=s.economy;
 return {worldGDPReal:e.previousWorldGDP,worldGrowth:e.worldGrowth??3,
  capitalPerWorker:sum(s.firms.map(f=>f.capital))/Math.max(sum(s.firms.map(f=>f.workers)),1e-9),
  greenfieldUSD:e.last.greenfieldUSD??0,portfolioEquityUSD:e.last.portfolioEquityUSD??0,
  portfolioOutflowUSD:e.last.portfolioOutflowUSD??0,foreignCreditLimitUSD:foreignCreditLimitUSD(s)};
}
export function validateOpenEconomy(s){
 if(!s.economy){if(s.provenance?.economicStructure)throw new Error('Отсутствует структурная экономика');return;}
 const e=s.economy,finite=(x,min=0,max=Infinity)=>Number.isFinite(x)&&x>=min&&x<=max;
 validateStructure(e.initial);validateStructure(s.provenance.economicStructure);
 if(![1,2].includes(s.provenance.initialEconomicRevision??1)||(e.revision??1)<(s.provenance.initialEconomicRevision??1))throw new Error('Повреждена ревизия механизмов');
 if(e.version!==1||![1,2].includes(e.revision??1))throw new Error('Неизвестная структурная модель');
 validateOpenParameters(e.parameters);validateOpenParameters(s.provenance.initialEconomicParameters);
 let historicalRevision=s.provenance.initialEconomicRevision??1;
 for(const entry of s.journal??[]){const revision=entry.economicRevision??historicalRevision;if(![1,2].includes(revision)||revision<historicalRevision)throw new Error('Повреждена история ревизий');historicalRevision=revision;}
 if((e.revision??1)<historicalRevision)throw new Error('Состояние не соответствует истории ревизий');
 if(!Array.isArray(e.regions)||e.regions.length!==3||e.regions.some((r,i)=>r.id!==WORLD_REGIONS[i].id||!['gdp','population','capital','initialCapital','initialGDP','initialPopulation','technology'].every(k=>finite(r[k],1e-12))||!finite(r.saving,0,1)||!finite(r.laborGrowth,-.05,.1)||!finite(r.technologyGrowth,-.05,.1)||!Array.isArray(r.imports)||r.imports.length!==5||r.imports.some(v=>!finite(v,0,1))))throw new Error('Повреждён мировой рынок');
 if(!Array.isArray(e.frontier)||e.frontier.length!==5||e.frontier.some(v=>!finite(v,1e-12))||!Array.isArray(e.tradeWeights)||e.tradeWeights.length!==5||e.tradeWeights.some(v=>!finite(v,0,1)))throw new Error('Повреждены торговые связи');
 if(!finite(e.previousWorldGDP,1e-9)||!finite(e.foreignCreditRatio,0,4)||!finite(e.initialTradeCost,0,3)||!Array.isArray(e.worldGDPHistory)||e.worldGDPHistory.length!==13||e.worldGDPHistory.some((r,i)=>r.month!==s.month-12+i||!finite(r.gdp,1e-9))||!finite(s.demography.initialMortalityFactor,.01,10))throw new Error('Повреждена история мировой экономики');
 for(const f of s.firms)if(!['technology','initialTechnology','costMarkup'].every(k=>finite(f[k],1e-12))||!finite(f.knowledgeCapital)||!finite(f.expectedOperatingSurplus,-Infinity)||!finite(f.expectedValueAdded,-Infinity))throw new Error('Повреждены производственные характеристики');
}

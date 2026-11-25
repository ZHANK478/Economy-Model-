import {annotateFounderOrigin} from './talent-migration.js';
import {registerOwnerInvestment} from './wealth-owners.js';
import {corporateDebt} from './corporate-bonds.js';
// Behavioural implementation informed by Graham (2022), BoE WP1162 (2025),
// Fed IFDP1402 (2024), McKenzie (2017), BLS BED and WB GIC (2020).
// Numerical coefficients are disclosed scenario assumptions, not estimates.
import {sectorCompanies,industryCompanies,syncEnterpriseOwnership} from './enterprise-market.js';
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const businessDynamicsActive=s=>(s.economy?.revision??0)>=17;
export function businessDraw(seed,month,salt){let x=(seed^Math.imul(month+1,2654435761)^Math.imul(salt+1,2246822519))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return (x>>>0)/4294967296;}
export function initializeBusinessDynamics(s){
 if(!businessDynamicsActive(s))return;
 if(!s.businessDynamics)s.businessDynamics={version:1,startedMonth:s.month,nextEnterprise:5,nextProject:1,assumptions:{entryIntensity:.08,maxCompanies:24,equityRepricing:1/24,projectFailure:.03,startupMonths:6,liquidMonths:.5},entries:[],projectOutcomes:[],evidence:{sources:['Graham 2022 doi:10.1111/jofi.13161','BoE WP1162 2025','Fed IFDP1402 2024','McKenzie 2017 doi:10.1257/aer.20151404','BLS BED establishment survival','World Bank GIC 2019-2020'],status:'Mechanisms informed by evidence; numerical coefficients are scenario assumptions, not country estimates.'},last:{entries:[],projects:[],projectOutcomes:[]}};
 for(const [i,c] of industryCompanies(s).entries()){
  c.foundedMonth??=s.month-120;c.expectedRevenue??=Math.max(0,c.lastRevenue);c.expectedMargin??=.12;
  c.equityReturn??=s.parameters.neutralRealRate;c.hurdleBuffer??=.015+.005*(i%3);c.fixedDebtShare??=.5;c.debtMaturityMonths??=36;c.debtMonthsRemaining??=c.debtMaturityMonths;c.projectHistory??=[];
 }
}
export function prepareBusinessDynamics(s){
 if(!businessDynamicsActive(s))return;
 const d=s.businessDynamics;d.last={entries:[],projects:[],projectOutcomes:[]};
 const marketReal=(1+(s.monetary?.effectiveRate??s.policy.rate)/100)/(1+s.expectedInflation)-1;
 for(const c of industryCompanies(s)){
  const target=Math.max(.005,.5*s.parameters.neutralRealRate+.5*marketReal);
  c.equityReturn+=(target-c.equityReturn)*d.assumptions.equityRepricing;
  c.debtMonthsRemaining=Math.max(0,c.debtMonthsRemaining-1);
  if(c.debtMonthsRemaining===0){c.fixedDebtRate=s.bank.lendingRate;c.debtMonthsRemaining=c.debtMaturityMonths;}
 }
}
export function independentEnterprisePlans(s,sectorPlan,unit){
 const rows=industryCompanies(s),active=rows.filter(c=>c.active),totalCapital=sum(active.map(c=>c.capital));
 const averageYield=Math.max(.01,sectorPlan.operatingYield),growth=sectorPlan.expectedTrendGrowth??.03;
 const marketDemand=s.lastReport.market?.requestedInvestment??s.base.investment;
 for(const c of rows){
  if(!c.active){c.desiredInvestment=0;continue;}
  const age=s.month-c.foundedMonth,young=age<60;
  const debt=c.loanLC+c.loanFX*s.exchangeRate+corporateDebt(s,c),prospectiveDebt=clamp((Math.max(0,c.capital*unit*.02-c.cash)+debt)/Math.max(1,c.capital*unit),0,.75);
  const finance=prospectiveDebt*Math.max(-.05,sectorPlan.realBorrow)+(1-prospectiveDebt)*c.equityReturn;
  const cost=Math.max(.01,sectorPlan.depreciation+sectorPlan.risk+finance+c.hurdleBuffer);
  const va=c.last?Math.max(0,c.expectedRevenue-(c.last.inputCost??0)):sectorPlan.expectedValueAdded*c.capital/Math.max(totalCapital,1);
  const afterTaxYield=s.economy.parameters.capitalShare*va*12/Math.max(1,c.capital*unit)*(1-sectorPlan.tax)+sectorPlan.depreciation*sectorPlan.tax;
  const ownReturn=clamp(afterTaxYield/averageYield,.3,2.5),costRatio=clamp(sectorPlan.required/cost,.4,2);
  const expectedGrowth=c.lastRevenue>0?clamp(c.expectedRevenue/c.lastRevenue-1,-.2,.2):0;
  const ongoing=sectorPlan.unsmoothedTarget*c.capital/Math.max(1,totalCapital)*ownReturn*costRatio*Math.exp(expectedGrowth);
  const startup=age<s.businessDynamics.assumptions.startupMonths&&c.capital<1e-6?Math.max(0,c.cash/unit*.65):0;
  const target=Math.max(startup,ongoing),previous=Math.max(1e-9,c.lastInvestment??0),speed=young?.12:sectorPlan.investmentAdjustment;
  const desired=startup>0?startup:previous*Math.exp(speed*Math.log(Math.max(1e-9,target)/previous));
  c.desiredInvestment=Math.max(0,Math.min(desired,Math.max(startup,c.capital*.04)));
  c.investmentDecision={month:s.month,age,kind:startup>0?'startup':ownReturn>1?'expansion':'replacement',expectedRevenue:c.expectedRevenue,expectedGrowth,operatingYield:afterTaxYield,requiredReturn:cost,equityReturn:c.equityReturn,prospectiveDebtShare:prospectiveDebt,target,desired:c.desiredInvestment,growthPrior:growth,marketInvestmentDemand:marketDemand};
 }
 return sum(rows.map(c=>c.desiredInvestment));
}
function entrant(s,{foreign,capitalBudget,unit,foreignPayment}){
 const rows=industryCompanies(s),id='industry-'+s.businessDynamics.nextEnterprise++,index=s.businessDynamics.nextEnterprise;
 const c={id,name:(foreign?'Иностранная':'Новая местная')+' компания №'+(index-1),active:true,cash:0,loanLC:0,loanFX:0,capital:0,inventory:0,workers:0,production:0,foreignEquityUSD:0,lastRevenue:0,lastProfit:0,lastInvestment:0,averageRate:s.bank.lendingRate,depositIncome:0,interestPaid:0,price:s.firms[2].price,relativeProductivity:.90+.20*businessDraw(s.seed,s.month,index),ownership:{state:0,foreign:foreign?1:0,domestic:foreign?0:1,municipal:0,cooperative:0},domesticOwners:s.households.map(()=>0),workerOwners:s.households.map(()=>0),fundedInvestment:0,receiptWeight:0,volumeWeight:0,bankruptcies:0,last:null,foundedMonth:s.month,entryBudget:capitalBudget,entrySource:foreign?'foreign-equity':'domestic-equity'};
 if(foreign){foreignPayment(s,c,capitalBudget/s.exchangeRate);c.foreignEquityUSD=capitalBudget/s.exchangeRate;if(s.economy.revision>=21)c.externalEquityCashLC=capitalBudget;}
 else{
  const available=s.households.map((h,i)=>Math.max(0,h.cash-Math.max(0,h.income)*(.35+.10*(9-i))));
  const total=sum(available);if(total<capitalBudget)return null;
  c.domesticOwners=available.map(v=>v/total);
  registerOwnerInvestment(s,c,available.map(v=>capitalBudget*v/total));
  available.forEach((v,i)=>{const paid=capitalBudget*v/total;s.households[i].cash-=paid;c.cash+=paid;});
 }
 annotateFounderOrigin(s,c,foreign);
 const oldCount=rows.length;rows.push(c);
 s.foundation.businessBankClaims.splice(2+oldCount,0,0);
 initializeBusinessDynamics(s);syncEnterpriseOwnership(s);
 const entry={id,month:s.month,source:c.entrySource,paid:capitalBudget,paidUSD:foreign?capitalBudget/s.exchangeRate:0,capitalAtEntry:0,expectedEquipment:capitalBudget/unit,registrationMonths:Math.max(1,Math.ceil(s.institutions.registrationDays/30))};
 s.businessDynamics.entries.push(entry);s.businessDynamics.last.entries.push(entry);return c;
}
export function financeNewEnterprises(s,plans,unit,foreignSupply,foreignPayment){
 if(!businessDynamicsActive(s))return 0;
 const d=s.businessDynamics,rows=industryCompanies(s),p=plans[2];
 if(rows.length>=d.assumptions.maxCompanies||s.government.defaultActive)return 0;
 const attractiveness=clamp(p.foreignScore/.10,0,1),barrier=clamp(30/Math.max(30,s.institutions.registrationDays),.1,1)*s.institutions.contractReliability;
 const probability=d.assumptions.entryIntensity*barrier*attractiveness;
 const unitBudget=Math.max(1,s.firms[2].capital*.003*unit),foreign=s.policy.foreignBusinessEntry&&businessDraw(s.seed,s.month,82)<probability;
 if(foreign&&foreignSupply*s.exchangeRate>=unitBudget){const c=entrant(s,{foreign:true,capitalBudget:unitBudget,unit,foreignPayment});if(c)return unitBudget/s.exchangeRate;}
 if(s.policy.privateBusinessEntry&&businessDraw(s.seed,s.month,83)<probability)entrant(s,{foreign:false,capitalBudget:unitBudget,unit,foreignPayment});
 return 0;
}
export function tagInvestmentProject(s,project){
 if(!businessDynamicsActive(s)||project.legacy||project.type!=='private')return project;
 const d=s.businessDynamics,id=d.nextProject++,young=(project.enterpriseIds??project.firmIds??[]).some(id=>s.month-(s.firms.flatMap((_,i)=>sectorCompanies(s,i)).find(c=>c.id===id)?.foundedMonth??-120)<60);
 const risk=d.assumptions.projectFailure*(young?1.5:1)*(1.5-s.institutions.contractReliability);
 const trouble=businessDraw(s.seed,s.month,id+1000)<risk;
 const startup=(project.enterpriseIds??project.firmIds??[]).some((id,i)=>(project.enterpriseShares?.[i]??project.firmShares?.[i]??0)>0&&s.month-(s.firms.flatMap((_,i)=>sectorCompanies(s,i)).find(c=>c.id===id)?.foundedMonth??-120)<d.assumptions.startupMonths);
 const registration=startup?Math.max(1,Math.ceil(s.institutions.registrationDays/30)):0;
 const delay=(trouble?3:0)+registration;project.due+=delay;
 project.businessProject={id:'project-'+id,createdMonth:s.month,kind:young?'startup-or-expansion':'replacement-or-expansion',paidReal:project.amount,delayMonths:delay,impairment:trouble?.15:0,status:'building',riskAssumption:risk};
 if(trouble)project.efficiency*=.85;
 d.last.projects.push({...project.businessProject,sector:project.sector,due:project.due,enterpriseIds:project.enterpriseIds??[]});
 return project;
}
export function recordProjectCompletion(s,project){
 if(!project.businessProject)return;
 const outcome={...project.businessProject,completedMonth:s.month,status:project.businessProject.impairment>0?'completed-with-loss':'completed',deliveredCapital:project.amount*project.efficiency,sector:project.sector,enterpriseIds:project.enterpriseIds??[]};
 s.businessDynamics.projectOutcomes.push(outcome);s.businessDynamics.projectOutcomes=s.businessDynamics.projectOutcomes.slice(-360);
 s.businessDynamics.last.projectOutcomes.push(outcome);
}
export function finishBusinessDynamics(s){
 if(!businessDynamicsActive(s))return;
 for(const c of industryCompanies(s)){
  c.expectedRevenue+=.15*(Math.max(0,c.lastRevenue)-c.expectedRevenue);
  if(c.last)c.expectedMargin+=.1*(c.lastProfit/Math.max(1,c.lastRevenue)-c.expectedMargin);
 }
 s.lastReport.businessDynamics=structuredClone(s.businessDynamics.last);
}
export function validateBusinessDynamics(s){
 if(!businessDynamicsActive(s))return;
 const d=s.businessDynamics;if(!d||d.version!==1||!Number.isInteger(d.nextEnterprise)||d.nextEnterprise<5||!Number.isInteger(d.nextProject)||d.nextProject<1||!Array.isArray(d.entries)||!Array.isArray(d.projectOutcomes))throw new Error('Повреждена динамика предприятий');
 if(industryCompanies(s).length>d.assumptions.maxCompanies)throw new Error('Слишком много предприятий');
 for(const c of industryCompanies(s))if(!Number.isInteger(c.foundedMonth)||c.foundedMonth>s.month||!Number.isFinite(c.equityReturn)||!Number.isFinite(c.hurdleBuffer)||c.hurdleBuffer<0||!Number.isFinite(c.expectedRevenue)||c.expectedRevenue<0||!Number.isFinite(c.fixedDebtShare)||c.fixedDebtShare<0||c.fixedDebtShare>1)throw new Error('Повреждены ожидания предприятия');
 for(const p of s.projects)if(p.businessProject&&(!Number.isFinite(p.businessProject.paidReal)||p.businessProject.paidReal<0||p.businessProject.paidReal!==p.amount||!Number.isInteger(p.businessProject.createdMonth)||p.businessProject.createdMonth>s.month||!['building'].includes(p.businessProject.status)))throw new Error('Повреждён инвестиционный проект');
}

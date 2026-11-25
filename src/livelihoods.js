import {specializedCompanyShares} from './company-specialization.js';
// Revision 24. Family producers are real company accounts, not additional GDP
// or household deposits. Land is a finite synthetic access stock, not cadastral
// hectares. All new behavioural magnitudes are disclosed scenario assumptions.
import {sectorCompanies,enterpriseBusinesses} from './enterprise-market.js';
import {registerOwnerInvestment} from './wealth-owners.js';
const sum=xs=>xs.reduce((a,b)=>a+b,0),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const livelihoodsActive=s=>(s.economy?.revision??0)>=24;
export const LIVELIHOOD_ASSUMPTIONS=Object.freeze({workingCapitalMonths:2,relativeProductivity:.85,foodPrudence:.30,drawPrudence:.95,lowEarningRatio:.8,capitalPerOwner:.5,entryCashShare:.015,entryCapitalShare:.002,minimumCapitalShare:.00001,landPerOwner:1,landReserve:.15,landRentYield:.03,ownFoodDrawShare:.75,exitLossMonths:6});
export const familyCompanies=s=>s.firms.flatMap((_,i)=>sectorCompanies(s,i)).filter(c=>c.familyGroup!==undefined);
export function initializeLivelihoods(s){
 if(!livelihoodsActive(s)||s.livelihoods)return;
 const f=s.firms[0];
 s.livelihoods={version:1,startedMonth:s.month,assumptions:{...LIVELIHOOD_ASSUMPTIONS},landTotal:Math.max(1e-9,f.workers)*(1+LIVELIHOOD_ASSUMPTIONS.landReserve),landAllocated:0,reference:s.firms.map(f=>({capitalPerWorker:f.capital/Math.max(f.workers,1e-9),workers:f.workers})),last:{entries:[],blocked:[],landRent:0,groups:[]},history:[]};
}
export function prepareLivelihoods(s,prev){
 if(!livelihoodsActive(s))return;initializeLivelihoods(s);const d=s.livelihoods,a=d.assumptions;
 d.last={entries:[],blocked:[],landRent:0,groups:[]};
 for(const c of familyCompanies(s)){
  if(!c.active){c.land=0;c.ownerTarget=0;continue;}
  const g=prev.laborDistribution?.groups[c.familyGroup],pool=Math.max(0,(g?.unemployed??0)+(c.ownerWorkers??0));
  const toolLimit=c.capital/Math.max(1e-9,d.reference[c.sector].capitalPerWorker*a.capitalPerOwner);
  const residence=c.sector===0?1-(s.settlements?.groups[c.familyGroup]?.urbanShare??.5):(s.settlements?.groups[c.familyGroup]?.urbanShare??.5);
  c.ownerTarget=Math.min(toolLimit,pool*residence,c.sector===0?(c.land??0)/a.landPerOwner:Infinity);
  c.lossMonths=(c.lastProfit??0)<0?(c.lossMonths??0)+1:0;
  // Exit releases labour and land, but unsold equipment remains an estate until
  // another producer pays for it. No disappearance of creditor claims.
  if(c.lossMonths>=a.exitLossMonths){c.ownerTarget=0;c.land=0;c.familyDormant=true;}else c.familyDormant=false;
 }
 d.landAllocated=sum(familyCompanies(s).filter(c=>c.active).map(c=>c.land??0));
}
export function enterFamilyBusinesses(s,prev){
 if(!livelihoodsActive(s)||!s.policy.privateBusinessEntry)return;
 const d=s.livelihoods,a=d.assumptions,unit=Math.max(1e-9,s.metrics.investmentPrice??s.consumerPriceIndex/100);
 for(const sector of [0,4]){
  const m=s.firmMarkets.markets.find(m=>m.sector===sector),f=s.firms[sector];if(!m)continue;
  const sellers=m.companies.filter(c=>c.active&&c.familyGroup===undefined&&c.capital>0).sort((a,b)=>b.capital-a.capital),seller=sellers[0];
  if(!seller||m.companies.filter(c=>c.active).length>=s.firmMarkets.assumptions.maxCompanies)continue;
  const candidates=s.households.map((h,i)=>({h,i,jobless:Math.max(0,prev.laborDistribution?.groups[i]?.unemployed??0)})).filter(x=>x.jobless>1e-8&&!m.companies.some(c=>c.active&&c.familyGroup===x.i)).sort((a,b)=>b.jobless-a.jobless);
  const choice=candidates[0];if(!choice)continue;const {h,i,jobless}=choice;
  const rural=1-(s.settlements?.groups[i]?.urbanShare??.5),availableWorkers=jobless*(sector===0?rural:1-rural);
  const landFree=Math.max(0,d.landTotal-d.reference[0].workers-d.landAllocated);
  const cashRoom=Math.max(0,h.cash-Math.max(0,h.income-h.interestPaid));
  const capital=Math.min(seller.capital*a.entryCapitalShare,cashRoom*a.entryCashShare/unit,availableWorkers*d.reference[sector].capitalPerWorker*a.capitalPerOwner,sector===0?landFree/a.landPerOwner*d.reference[sector].capitalPerWorker*a.capitalPerOwner:Infinity);
  const minimum=d.reference[sector].capitalPerWorker*d.reference[sector].workers*a.minimumCapitalShare;
  // Entry needs existing customer spending or an unmet household food need.
  const ownUse=sector===0&&(h.income-h.interestPaid)/Math.max(s.population*h.population,1e-9)<s.householdStructure.referenceRealBudget;
  const expectedSales=Math.max(0,f.lastRevenue)*capital/Math.max(f.capital,1e-9);
  const margin=f.lastRevenue>0?Math.max(0,(f.lastProfit+f.workers*f.wage)/f.lastRevenue):0;
  if(!(capital>=minimum&&expectedSales*margin>0)){
   d.last.blocked.push({sector,group:i,cashAvailable:cashRoom,equipmentAvailable:seller.capital,landAvailable:landFree,unemployedFounders:availableWorkers,expectedSales,minimumCapital:minimum,reason:sector===0&&landFree<=1e-9?'land':cashRoom<=0?'cash':'demand-or-tools'});continue;
  }
  const land=sector===0?capital/(d.reference[sector].capitalPerWorker*a.capitalPerOwner)*a.landPerOwner:0;
  const rent=sector===0?capital*unit*a.landRentYield/12:0,payment=capital*unit;
  const workingCapital=rent+expectedSales*(1-clamp(margin,.05,.95))*a.workingCapitalMonths;
  if(payment+workingCapital>cashRoom)continue;
  const c={id:`family-${sector}-${m.nextId++}`,sector,name:sector===0?(ownUse?'Семейное хозяйство для себя':'Семейная ферма'):'Самостоятельные услуги',familyGroup:i,intendedUse:ownUse?'own-use':'market',active:true,cash:0,loanLC:0,loanFX:0,capital:0,inventory:0,workers:0,ownerWorkers:0,ownerTarget:0,land,landRent:rent,production:0,foreignEquityUSD:0,lastRevenue:0,lastProfit:0,lastInvestment:0,averageRate:s.bank.lendingRate,depositIncome:0,interestPaid:0,price:f.price,relativeProductivity:a.relativeProductivity,ownership:{state:0,municipal:0,foreign:0,cooperative:0,domestic:1},domesticOwners:s.households.map((_,j)=>Number(i===j)),workerOwners:s.households.map(()=>0),fundedInvestment:0,receiptWeight:0,volumeWeight:0,bankruptcies:0,last:null,foundedMonth:s.month,expectedRevenue:expectedSales,equityReturn:s.parameters.neutralRealRate,fixedDebtShare:0,debtMonthsRemaining:36,debtMaturityMonths:36};
  const contributions=s.households.map((_,j)=>i===j?payment+workingCapital:0);registerOwnerInvestment(s,c,contributions);h.cash-=payment+workingCapital;c.cash+=payment+workingCapital;
  c.cash-=payment;seller.cash+=payment;seller.capital-=capital;c.capital=capital;
  const old=enterpriseBusinesses(s),claims=new Map(old.map((c,j)=>[c.id,s.foundation.businessBankClaims[j]]));m.companies.push(c);s.foundation.businessBankClaims=enterpriseBusinesses(s).map(c=>claims.get(c.id)??0);
  c.ownerTarget=Math.min(availableWorkers,capital/(d.reference[sector].capitalPerWorker*a.capitalPerOwner));d.landAllocated+=land;
  d.last.entries.push({id:c.id,sector,group:i,capital,paid:payment,workingCash:workingCapital,land,intendedUse:c.intendedUse,source:'paid-existing-equipment'});
 }
}
export function familyLaborTargets(s){
 const targets=s.firms.map(()=>0);if(!livelihoodsActive(s))return targets;
 for(const c of familyCompanies(s))if(c.active&&!c.familyDormant)targets[c.sector]+=c.ownerTarget??0;return targets;
}
export function assignFamilyWorkers(s,sector,total,ordinaryShares){
 const rows=sectorCompanies(s,sector),targets=rows.map(c=>c.familyGroup!==undefined&&c.active&&!c.familyDormant?Math.max(0,c.ownerTarget??0):0),wanted=sum(targets),scale=Math.min(1,total/Math.max(wanted,1e-12));
 const reserved=wanted*scale,other=rows.map((c,i)=>c.familyGroup===undefined&&c.active?ordinaryShares[i]:0),norm=sum(other);
 let used=0;rows.forEach((c,i)=>{const workers=targets[i]*scale+(norm>0?(total-reserved)*other[i]/norm:0);c.workers=workers;c.ownerWorkers=c.familyGroup!==undefined?workers:0;used+=workers;});
 // If only family firms remain, their actual tool/land/time limits bind. Never
 // assign all aggregate residual workers to the last (possibly closed) firm.
 return used;
}
export function familyWageShares(s,sector,ordinary){
 if(!livelihoodsActive(s))return ordinary;
 const rows=sectorCompanies(s,sector),total=sum(rows.map(c=>c.drawPlanned??c.workers)),family=sum(rows.filter(c=>c.familyGroup!==undefined).map(c=>c.drawPlanned??c.workers));
 if(total<=0)return ordinary;const weights=ordinary.map(v=>v*(1-family/total));for(const c of rows)if(c.familyGroup!==undefined)weights[c.familyGroup]+=(c.drawPlanned??c.workers)/total;return weights;
}
export function familyOwnFoodBudget(s,group){
 if(!livelihoodsActive(s))return null;const f=s.firms[0],a=s.livelihoods.assumptions;
 // A noncash draw from this household's own producer, bounded by its imputed
 // labour return. It must still pass the goods allocator and cannot be spent twice.
 return sum(familyCompanies(s).filter(c=>c.familyGroup===group&&c.sector===0&&c.active&&c.intendedUse==='own-use').map(c=>c.workers*f.wage*s.policy.normalWorkweek/40*(1-f.labor.strikeShare)*a.ownFoodDrawShare));
}
export function settleFamilyRent(s,inputCost,revenue){
 if(!livelihoodsActive(s))return;
 for(const c of sectorCompanies(s,0)){c.lastLandRent=0;c.landRentReceived=0;}
 const landlord=sectorCompanies(s,0).find(c=>c.familyGroup===undefined&&c.active);if(!landlord)return;
 for(const c of familyCompanies(s).filter(c=>c.sector===0&&c.active&&(c.land??0)>0)){
  const due=c.landRent??0,paid=Math.min(Math.max(0,c.cash),due);c.cash-=paid;landlord.cash+=paid;landlord.landRentReceived+=paid;c.lastLandRent=paid;s.livelihoods.last.landRent+=paid;
  // Internal agriculture rent is not an additional purchase or GDP. It is
  // allocated in producer profit accounts below, not sector aggregate input costs.
 }
}
export function finishLivelihoods(s,{military=0,ownFood=[],sources=[],wages=0}={}){
 if(!livelihoodsActive(s))return;const d=s.livelihoods,rows=familyCompanies(s);for(const c of rows){c.ownerWorkers=c.workers;if(!c.active)c.land=0;}d.landAllocated=sum(rows.filter(c=>c.active).map(c=>c.land??0));const own=sum(rows.filter(c=>c.intendedUse==='own-use').map(c=>c.ownerWorkers??0)),self=sum(rows.filter(c=>c.intendedUse==='market').map(c=>c.ownerWorkers??0)),productive=sum(s.firms.map(f=>f.workers)),workingAge=s.population*s.workingAgeShare,baseForce=workingAge*s.participation;
 // Own-use workers remain eligible to seek paid work. This first revision does
 // not invent discouraged workers: existing nonparticipation stays separate.
 const employment=productive-own+military,unemployed=Math.max(0,baseForce-employment),wageEmployed=Math.max(0,employment-self);
 d.last.groups=s.households.map((h,i)=>{const families=rows.filter(c=>c.familyGroup===i&&c.workers>0),marketWorkers=sum(families.filter(c=>c.intendedUse==='market').map(c=>c.ownerWorkers??0)),ownWorkers=sum(families.filter(c=>c.intendedUse==='own-use').map(c=>c.ownerWorkers??0));return {group:i,selfEmployed:marketWorkers,ownUseWorkers:ownWorkers,mixedIncome:sources[i]?.mixed??sum(families.map(c=>(c.last?.payroll??0)+(c.familyDividendPaid??0))),ownFood:ownFood[i]??0};});
 const underemployed=sum(rows.filter(c=>c.active&&c.intendedUse==='market'&&(c.last?.payroll??0)+(c.familyDividendPaid??0)<c.workers*s.firms[c.sector].wage*d.assumptions.lowEarningRatio).map(c=>c.ownerWorkers??0));
 const familyDraws=sum(rows.filter(c=>c.active).map(c=>c.last?.payroll??0));
 const partTime=sum(rows.filter(c=>c.active&&c.intendedUse==='market').map(c=>{const hours=s.policy.normalWorkweek*clamp(s.firms[c.sector].utilization/s.economy.parameters.normalUtilization);c.hoursPerWeek=hours;return hours<s.policy.normalWorkweek-1e-6?(c.ownerWorkers??0):0;}));
 Object.assign(s.metrics,{productiveWorkers:productive+military,wageEmployment:wageEmployed,selfEmployment:self,ownUseWorkers:own,unemployedPeople:unemployed,outsideLaborForce:Math.max(0,workingAge-baseForce),underemployedSelf:underemployed,timeUnderemployedSelf:partTime,employment,laborForce:baseForce,unemployment:100*unemployed/Math.max(baseForce,1e-9),ownUseFoodValue:sum(ownFood),mixedIncome:sum(d.last.groups.map(g=>g.mixedIncome)),familyLandUsed:d.landAllocated});
 if(wageEmployed>0){s.metrics.meanWageNominal=(wages-familyDraws)/wageEmployed;s.metrics.meanWageUSD=s.metrics.meanWageNominal/s.exchangeRate;s.metrics.meanWageReal=s.metrics.meanWageNominal/(s.consumerPriceIndex/100);}
 d.last.statistics={hires:s.foundation.labor.hires,vacancies:s.foundation.labor.vacancies,wageEmployed,selfEmployed:self,ownUseWorkers:own,unemployed,outsideLaborForce:s.metrics.outsideLaborForce,lowEarningSelf:underemployed,timeUnderemployedSelf:partTime,peopleUnit:'millions',ownUseAlsoSeekingWork:true};
 d.last.producers=rows.map(c=>({id:c.id,group:c.familyGroup,sector:c.sector,intendedUse:c.intendedUse,active:c.active,workers:c.ownerWorkers??0,capital:c.capital,land:c.land??0,production:c.production,revenue:c.lastRevenue,inputCost:c.last?.inputCost??0,draw:c.last?.payroll??0,profit:c.lastProfit,cash:c.cash,landRent:c.lastLandRent??0}));
 d.history.push({month:s.month,...d.last.statistics,ownFood:sum(ownFood)});d.history=d.history.slice(-120);s.lastReport.livelihoods=structuredClone(d.last);
}
export function validateLivelihoods(s){
 if(!livelihoodsActive(s))return;const d=s.livelihoods;if(!d||d.version!==1||!Number.isFinite(d.landTotal)||d.landTotal<=0)throw Error('Повреждены семейные хозяйства');
 if(!Array.isArray(d.reference)||d.reference.length!==s.firms.length||d.reference.some(r=>!r||![r.capitalPerWorker,r.workers].every(x=>Number.isFinite(x)&&x>=0))||!Array.isArray(d.history)||d.history.length>120||!Number.isFinite(d.landAllocated)||d.landAllocated<0||!d.assumptions)throw Error('Повреждена база самостоятельного труда');
 const rows=familyCompanies(s);for(const c of rows)if(![0,4].includes(c.sector)||!Number.isInteger(c.familyGroup)||c.familyGroup<0||c.familyGroup>9||!['market','own-use'].includes(c.intendedUse)||[c.land??0,c.ownerWorkers??0,c.ownerTarget??0].some(x=>!Number.isFinite(x)||x<0))throw Error('Повреждены ресурсы семейного производителя');
 const land=sum(rows.filter(c=>c.active).map(c=>c.land??0));if(land>d.landTotal-d.reference[0].workers+1e-8||Math.abs(land-d.landAllocated)>1e-8)throw Error('Превышен доступный земельный фонд');
 for(const k of Object.keys(LIVELIHOOD_ASSUMPTIONS))if(!Number.isFinite(d.assumptions[k])||d.assumptions[k]<0)throw Error('Повреждены допущения самостоятельного труда');
}

export function familyLaborReservations(s){
 const out=s.households.map(()=>s.firms.map(()=>0));if(livelihoodsActive(s))for(const c of familyCompanies(s))if(c.active)out[c.familyGroup][c.sector]+=c.ownerWorkers??0;return out;
}
export function livelihoodView(s,{n,pct}){
 if(!livelihoodsActive(s)||!s.lastReport.livelihoods)return '';const m=s.metrics;
 return `<details class="country-subdetail"><summary>Работа и самостоятельный заработок</summary><div class="small">Число людей, тыс. Производство для себя показано отдельно от занятости за оплату. Его участники могут продолжать искать работу.</div><table><tbody>${[['Наёмная занятость',m.wageEmployment],['Самостоятельная занятость на рынке',m.selfEmployment],['Производство для себя · ищут оплачиваемую работу',m.ownUseWorkers],['Безработные · включая ищущих работу производителей для себя',m.unemployedPeople],['Вне рабочей силы',m.outsideLaborForce],['Самозанятые с низким заработком',m.underemployedSelf],['Самозанятые с недостатком заказов и рабочих часов',m.timeUnderemployedSelf]].map(([label,value])=>`<tr><td>${label}</td><td>${n((value??0)*1000,1)}</td></tr>`).join('')}</tbody></table><div class="small">Низкий заработок: доход собственного труда ниже 80% отраслевого ориентира. Это не обследованная неполная занятость по времени. Земля — ограниченные условные единицы, не кадастровые гектары.</div></details>`;
}

export function capFamilyFood(s,group,proposed,production,sectorPrice,inputCost,investmentPrice){
 if(!livelihoodsActive(s))return proposed;
 const rows=sectorCompanies(s,0),shares=livelihoodProductionShares(s,0),own=rows.filter(c=>c.active&&c.familyGroup===group&&c.intendedUse==='own-use');
 const available=sum(own.map(c=>Math.max(0,production*shares[rows.indexOf(c)]*sectorPrice-inputCost*shares[rows.indexOf(c)]-c.capital*.1/12*investmentPrice-c.interestPaid-(c.landRent??0))));
 // Do not promise the household a noncash draw against another farm's output.
 return Math.min(proposed,available*s.livelihoods.assumptions.foodPrudence);
}
export function prepareFamilyPayroll(s,sector,{revenue,inputs,depreciation,ownFood}){
 if(!livelihoodsActive(s)||!sectorCompanies(s,sector).length)return null;
 const rows=sectorCompanies(s,sector),f=s.firms[sector],sold=rows.map(c=>Math.max(0,c.production+(c.openingInventory??c.inventory)-c.inventory)),value=sold.map((v,i)=>v*rows[i].price),soldValue=sum(value),capital=sum(rows.map(c=>c.capital));
 const productionTotal=sum(rows.map(c=>c.production));
 const oldShares=rows.map(c=>c.receiptWeight),receipts=value.map((v,i)=>soldValue>0?v/soldValue:oldShares[i]);
 for(const [i,c] of rows.entries()){c.productionWeight=productionTotal>0?c.production/productionTotal:c.volumeWeight;c.cash+=revenue*(receipts[i]-oldShares[i])+inputs*(c.volumeWeight-c.productionWeight);c.receiptWeight=receipts[i];c.foodDraw=0;}
 if(sector===0)for(let group=0;group<10;group++){
  const growers=rows.filter(c=>c.familyGroup===group&&c.active&&c.intendedUse==='own-use'),workers=sum(growers.map(c=>c.workers));
  for(const c of growers)c.foodDraw=(ownFood[group]??0)*c.workers/Math.max(workers,1e-12);
 }
 const kind=sum(rows.map(c=>c.foodDraw));
 for(const [i,c] of rows.entries()){
  c.cash+=kind*oldShares[i]-c.foodDraw;
  const benchmark=c.workers*f.wage*s.policy.normalWorkweek/40*(1-f.labor.strikeShare);
  const available=Math.max(0,revenue*receipts[i]-inputs*c.productionWeight-depreciation*c.capital/Math.max(capital,1e-12)-c.interestPaid-(c.bondInterestPaid??0)-(c.lastLandRent??0)+(c.landRentReceived??0));
  c.drawPlanned=c.familyGroup===undefined?benchmark:Math.min(benchmark,available*s.livelihoods.assumptions.drawPrudence);
 }
 return sum(rows.map(c=>c.drawPlanned));
}
export function finishFamilyPayroll(s,sector){
 if(!livelihoodsActive(s))return;const rows=sectorCompanies(s,sector),total=sum(rows.map(c=>c.drawPlanned??0)),kind=sum(rows.map(c=>c.foodDraw??0));
 for(const c of rows)c.cash+=(c.foodDraw??0)-kind*(c.drawPlanned??0)/Math.max(total,1e-12);
}

export function familyNetDraw(s,sector,group,netAmount,grossAmount){
 if(!livelihoodsActive(s)||grossAmount<=0)return 0;
 const draws=sum(sectorCompanies(s,sector).filter(c=>c.familyGroup===group&&c.active).map(c=>c.drawPlanned??0));return netAmount*clamp(draws/grossAmount);
}
export function livelihoodProductionShares(s,sector){
 const rows=sectorCompanies(s,sector),a=s.economy.parameters.capitalShare;
 const weights=rows.map(c=>c.active&&!c.familyDormant?c.relativeProductivity*Math.max(0,c.capital)**a*Math.max(0,c.workers)**(1-a):0),total=sum(weights);
 return specializedCompanyShares(s,sector,rows,weights.map(w=>total>0?w/total:0));
}
export function assignLivelihoodProduction(s,sector,total){
 const rows=sectorCompanies(s,sector),shares=livelihoodProductionShares(s,sector);
 rows.forEach((c,i)=>{c.productionWeight=shares[i];c.production=total*shares[i];});
}

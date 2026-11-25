import {scenarioDefenseReliability} from './scenario-diplomacy.js';
import {initializeDefenseEconomy} from './defense-economy.js';
import {hash,clone} from './political-config.js';
import {purchaseShare} from './macro-core.js';
// Aggregate strategic defense model, not a predictor of a real war.
// Evidence establishes categories/dependencies, NOT these numerical coefficients:
// https://www.sipri.org/databases/milex/sources-and-methods (inputs != capabilities)
// https://www.sipri.org/databases/milex/definitions (expenditure coverage)
// https://www.nato.int/en/what-we-do/deterrence-and-defence/natos-role-in-logistics
// All quantities: million people, million equipment sets, million LC, months.
// An equipment set is a replacement-cost equivalent, NOT a tank or rifle count.
// Revisions through 9 classify personnel within services. Revision 10 pays
// military personnel directly and counts them separately from civilian workers.
// Opening stocks and neighbors describe a fictional scenario, not MEX/BGD/FRA
// observations. They are saved and replayed; no country-class bonuses exist.
export const DEFENSE_ASSUMPTIONS=Object.freeze({
 version:1,status:'scenario assumptions; not empirically estimated battle probabilities',
 payMultiplier:1.2,kitReplacementUSD:15000,openingStockBudgetYears:4,
 basicTrainingMonths:6,procurementMonths:9,annualPersonnelExit:.08,annualEquipmentWear:.06,
 maintenanceAnnualShare:.03,trainingCostMonthsPay:3,operatingUSDPerPersonMonth:65,
 normalSupplyMonths:4,crisisWarningMonths:4,annualCrisisFrequency:.12,
 negotiationMonths:3,negotiationBudgetShare:.08,allianceBudgetShare:.06,
 allianceAccessionMonths:9,allianceMinimumGDP:.006,initialMobilizationReserve:1.3,
 defenseCampaignMonths:18,occupationDefeatThreshold:.85,occupationDefeatMonths:3,
 monthlyCapitalDamageCeiling:.004,
 maxServiceWorkforceShare:.25,maxAdultForceShare:.04
});
const A=DEFENSE_ASSUMPTIONS,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const sum=a=>a.reduce((v,x)=>v+x,0),monthly=annual=>1-Math.pow(1-annual,1/12);
const priority={balanced:{personnel:.42,operations:.28,training:.12,equipment:.18},readiness:{personnel:.42,operations:.36,training:.16,equipment:.06},equipment:{personnel:.38,operations:.24,training:.08,equipment:.30}};
function militaryBasket(s){
 const q=priority[s.policy.defensePriority]??priority.balanced,d=s.defense;
 const talks=(d?.war??d?.crisis)?.negotiation;
 const diplomacy=(d?.alliance?.requested||d?.alliance?.active?A.allianceBudgetShare:0)+(talks&&!talks.completed?A.negotiationBudgetShare:0);
 const ops=Math.max(0,q.operations-diplomacy);
 return [ops/28,ops*10/28,q.equipment+ops*12/28,ops*5/28,q.personnel+q.training+diplomacy];
}
function wage(s){const A=s.defense?.assumptions??DEFENSE_ASSUMPTIONS;return Math.max(1,(s.metrics.meanWageNominal??s.metrics.meanWageReal??s.base.monthlyGDP/s.population*.5)*A.payMultiplier);}
function kitPrice(s){const A=s.defense?.assumptions??DEFENSE_ASSUMPTIONS;return A.kitReplacementUSD*s.exchangeRate*s.worldPriceIndex/100;}
function baseline(s){
 const budget=s.base.monthlyGDP*Math.max(s.policy.militaryBudget??0,Math.min(1.5,s.policy.governmentConsumption*.25))/100;
 const staff=clamp(budget*.42/wage(s),0,s.population*.006);
 const kits=Math.min(staff,budget*12*A.openingStockBudgetYears*.25/kitPrice(s));
 return {budget,staff,kits};
}
function tell(s,type,title,text,events){
 const d=s.defense,id=`defense:${s.month}:${type}`;if(d.notices.some(n=>n.id===id))return;
 d.notices.push({id,month:s.month,type,title,text});d.notices=d.notices.slice(-40);
 events?.push(title+': '+text);
}
export function initializeDefense(s,parameters=null){
 if(s.defense?.enabled)return;
 const assumptions=parameters?clone(parameters):clone(A);
 const b=baseline(s),fraction=(s.policy.militaryBudget??0)/Math.max(purchaseShare(s.policy),1e-9),mix=militaryBasket(s),base=s.base.governmentWeights;
 // Reclassification leaves the initial total government basket unchanged.
 const civil=base.map((v,i)=>Math.max(0,(v-fraction*mix[i])/Math.max(1-fraction,.01))),norm=sum(civil);
 const civilians=civil.map(v=>v/norm),baseImport=s.base.governmentImport??.2;
 const civilImport=clamp((baseImport-fraction*.25)/Math.max(1-fraction,.01),0,.8);
 s.defense={enabled:true,version:1,startedMonth:s.month,assumptions,
  active:b.staff,reserve:b.staff*A.initialMobilizationReserve,trained:b.staff*.8,
  equipment:b.kits,serviceable:b.kits*.8,training:[],deliveries:[],supply:b.staff*A.normalSupplyMonths,
  funding:1,payCoverage:1,trainingLevel:.7,logistics:.75,supplyCoverage:1,readiness:0,
  personnelCost:0,operationsCost:0,trainingCost:0,procurementCost:0,diplomacyCost:0,
  civilianWeights:civilians,civilianImport:civilImport,referenceBudget:b.budget,
  baselineForce:b.staff,baselineKits:b.kits,baselinePopulation:s.population,
  occupation:0,defeatMonths:0,sovereigntyLost:false,war:null,crisis:null,cooldownUntil:s.month+24,
  alliance:{requested:false,progress:0,active:false,reliability:0,paid:0},
  pendingDeaths:0,pendingRefugees:0,pendingCapitalLoss:0,totalKilled:0,totalDisplaced:0,totalEquipmentLost:0,
  notices:[],seenNotices:[],last:null,history:[],
  neighbors:Array.from({length:3},(_,i)=>{const scale=.75+hash(s.seed,'neighbor-size',i)*.85;return {
   id:'n'+i,name:['Северный сосед','Восточный сосед','Южный сосед'][i],
   active:b.staff*scale,equipment:b.kits*scale,readiness:.62+hash(s.seed,'neighbor-readiness',i)*.16,
   intent:.30+hash(s.seed,'neighbor-intent',i)*.22,scale,growth:1};})};
 refreshDefense(s);
 initializeDefenseEconomy(s);
}
export function defenseGovernmentMix(s){
 const d=s.defense;if(!d?.enabled)return {weights:s.base.governmentWeights,imports:s.base.governmentImport??.2};
 const fraction=clamp((s.policy.militaryBudget??0)/Math.max(purchaseShare(s.policy),1e-9));
 const mix=militaryBasket(s),weights=d.civilianWeights.map((v,i)=>(1-fraction)*v+fraction*mix[i]);
 return {weights,imports:clamp((1-fraction)*d.civilianImport+fraction*.25,0,.8)};
}
export function prepareDefenseMonth(s,prev){
 const d=s.defense;if(!d?.enabled)return;
 const damage=clamp(prev.defense?.pendingCapitalLoss??0,0,.05);
 if(damage)for(const f of s.firms)f.capital*=1-damage;
 d.appliedCapitalLoss=damage;d.pendingDeaths=0;d.pendingRefugees=0;d.pendingCapitalLoss=0;
}
export function defenseCapacityFactor(s){return s.defense?.enabled?clamp(1-s.defense.occupation*.7,.25,1):1;}
function refreshDefense(s){
 const d=s.defense,A=d.assumptions;
 const equipment=clamp(d.serviceable/Math.max(d.active,1e-9));
 const training=clamp(d.trained/Math.max(d.active,1e-9))*d.trainingLevel;
 const supplies=clamp(d.supplyCoverage??1);
 // Bottleneck dependency; exponents and aggregation are explicit scenario choices.
 d.readiness=d.active>1e-8?clamp(Math.min(equipment,training,d.payCoverage)*Math.sqrt(Math.max(0,Math.min(supplies,d.logistics)))):0;
 d.capability=d.active*d.readiness;
}
export function defenseMetrics(s){
 const d=s.defense;if(!d?.enabled)return {};
 // Fiscal history is model state; optional diagnostic traces must never drive metrics.
 const annualSpending=sum(d.history.filter(e=>e.month>s.month-12&&e.month<=s.month).map(e=>e.paid));
 return {militaryExpenditureGDP:annualSpending/Math.max(1,s.metrics.nominalGDPAnnual)*100,militaryPersonnel:d.active*1e6,militaryReserve:d.reserve*1e6,militaryReadiness:d.readiness*100,
  militaryEquipmentReady:d.equipment?d.serviceable/d.equipment*100:0,militarySpending:s.lastReport?.fiscal?.militaryPurchases??0,
  occupiedTerritory:d.occupation*100,warDeaths:(s.demography.warDeaths??0)*1e6,militaryDeathsReported:d.pendingDeaths*1e6,militaryWar:Number(Boolean(d.war)),sovereigntyLost:Number(d.sovereigntyLost)};
}
export function defenseStatus(s){const d=s.defense;return !d?.enabled?'Армия':d.sovereigntyLost?'Утрата независимости':d.war?'Война':d.crisis?'Внешняя угроза':d.occupation>.01?'Перемирие':(d.alliance.active||scenarioDefenseReliability(s)>0)?'Оборонный союз':'Мир';}
export function defenseResponse(s,action){
 const d=s.defense;if(!d?.enabled)throw new Error('Военная модель не включена');
 if(d.sovereigntyLost)throw new Error('Правление завершено');
 if(action==='negotiate'){
  const target=d.war??d.crisis;if(!target)throw new Error('Нет открытого конфликта');
  if(target.negotiation)throw new Error('Переговоры уже начаты');
  target.negotiation={started:s.month,paid:0,months:0};return 'Переговоры начаты';
 }
 if(action==='alliance'){
  if(d.alliance.requested||d.alliance.active)throw new Error('Заявка на союз уже действует');
  if(d.war)throw new Error('Партнёр не принимает обязательства в уже начавшейся войне');
  d.alliance.requested=true;return 'Запрошен оборонный союз';
 }
 if(action==='leaveAlliance'){d.alliance={requested:false,progress:0,active:false,reliability:0,paid:0};return 'Выход из оборонного союза';}
 throw new Error('Неизвестное военное решение');
}
function effectiveDefense(s){const d=s.defense;return d.capability+d.baselineForce*.22*Math.max(d.alliance.active?d.alliance.reliability:0,scenarioDefenseReliability(s));}
function enemyPower(s,n){return n.active*Math.min(n.readiness,n.equipment/Math.max(n.active,1e-9));}
export function advanceDefense(s,prev,flow,events,w,militaryPlan=null){
 const d=s.defense;if(!d?.enabled)return;const A=d.assumptions;
 const paid=flow.militaryPurchases??0,shares=priority[s.policy.defensePriority]??priority.balanced;
 const salary=militaryPlan?militaryPlan.contractWage:wage(s),price=kitPrice(s),posture=s.policy.defensePosture??'routine';
 const postureNeed=posture==='mobilization'?1.65:posture==='alert'?1.25:1;
 const negotiation=(d.war??d.crisis)?.negotiation,negotiating=negotiation&&!negotiation.completed;
 const diplomaticShare=(d.alliance.requested||d.alliance.active?A.allianceBudgetShare:0)+(negotiating?A.negotiationBudgetShare:0);
 const goods=Math.max(0,paid-(militaryPlan?.paid??paid*shares.personnel));
 const goodsWeights=Math.max(.01,1-shares.personnel),goodsFactor=militaryPlan?goods/goodsWeights:paid;
 const operations=goodsFactor*Math.max(0,shares.operations-diplomaticShare);
 d.personnelCost=militaryPlan?militaryPlan.paid:paid*shares.personnel;d.operationsCost=operations;d.trainingCost=goodsFactor*shares.training;
 d.procurementCost=goodsFactor*shares.equipment;d.diplomacyCost=goodsFactor*diplomaticShare;
 d.funding=paid>0?clamp(paid/Math.max(paid,flow.militaryRequested??paid)):0;
 const workforce=militaryPlan?Math.min(s.population*A.maxAdultForceShare,s.population*s.workingAgeShare):Math.min(s.population*A.maxAdultForceShare,(s.firms[4].workers??0)*A.maxServiceWorkforceShare);
 const weightedSalary=militaryPlan?militaryPlan.contractWage*(d.economy.contractShare+(1-d.economy.contractShare)*d.economy.assumptions.conscriptPay*militaryPlan.baseWage/Math.max(militaryPlan.contractWage,1e-9)):salary;
 const personnelBudget=militaryPlan?paid*shares.personnel:d.personnelCost;
 const affordable=personnelBudget/Math.max(weightedSalary,1e-9);
 const exits=militaryPlan?d.active*(d.economy.contractShare*monthly(A.annualPersonnelExit+(paid===0?.5:0))+(1-d.economy.contractShare)/d.economy.assumptions.conscriptMonths):d.active*monthly(A.annualPersonnelExit+(paid===0?.5:0));
 d.active=Math.max(0,d.active-exits);d.trained=Math.min(d.active,Math.max(0,d.trained-exits));
 d.reserve+=exits*.65;
 for(const t of d.training.filter(t=>t.due<=s.month)){d.trained+=t.people;}
 d.training=d.training.filter(t=>t.due>s.month);
 const callup=posture==='mobilization'?Math.min(d.reserve*.25,Math.max(0,affordable*1.4-d.active)):0;
 d.active+=callup;d.trained+=callup;d.reserve-=callup;
 const target=militaryPlan?Math.min(workforce,s.population*s.policy.defensePersonnelTarget/1000):workforce;
 const availability=militaryPlan?clamp(1+d.economy.assumptions.recruitmentSensitivity*(s.policy.defenseSalary/100-1),.25,1.5)*d.economy.contractShare+(1-d.economy.contractShare):1;
 const recruitment=Math.min(Math.max(0,Math.min(affordable,target)-d.active)*.10*availability,Math.max(0,workforce-d.active),d.trainingCost/Math.max(1,salary*A.trainingCostMonthsPay));
 d.active+=recruitment;d.training.push(...(recruitment>1e-10?[{people:recruitment,due:s.month+A.basicTrainingMonths}]:[]));
 const excess=Math.max(0,d.active-Math.min(workforce,militaryPlan&&posture!=='mobilization'?Math.min(affordable,target):affordable*(posture==='mobilization'?1.4:1)))*.1;
 d.active-=excess;d.trained=Math.min(d.trained,d.active);d.reserve+=excess;
 d.payCoverage=militaryPlan?(militaryPlan.desired?clamp(militaryPlan.paid/militaryPlan.desired):1):(d.active?clamp(affordable/d.active):1);
 const trainingNeed=Math.max(1,d.active*salary*.25),trainingPaid=clamp(d.trainingCost/trainingNeed);
 d.trainingLevel=clamp(d.trainingLevel+.04*(trainingPaid-d.trainingLevel));
 for(const order of d.deliveries.filter(o=>o.due<=s.month)){d.equipment+=order.quantity;d.serviceable+=order.quantity;}
 d.deliveries=d.deliveries.filter(o=>o.due>s.month);
 const quantity=d.procurementCost/Math.max(1,price);
 if(quantity>1e-12)d.deliveries.push({quantity,cost:d.procurementCost,ordered:s.month,due:s.month+A.procurementMonths});
 const worn=d.equipment*monthly(A.annualEquipmentWear),maintenanceNeed=d.equipment*price*A.maintenanceAnnualShare/12;
 const maintenance=Math.min(operations,maintenanceNeed),maintenanceCoverage=maintenanceNeed?maintenance/maintenanceNeed:1;
 d.equipment=Math.max(0,d.equipment-worn);d.serviceable=clamp(d.serviceable-worn*(1.5-maintenanceCoverage),0,d.equipment);
 const repairs=Math.min(Math.max(0,d.equipment-d.serviceable),maintenance/Math.max(1,price)*2);
 d.serviceable+=repairs;
 const supplyPrice=A.operatingUSDPerPersonMonth*s.exchangeRate*s.worldPriceIndex/100*(w.energyPrice/100);
 const bought=Math.max(0,operations-maintenance)/Math.max(1,supplyPrice);
 const consumed=d.active*postureNeed*(d.war?2:1);
 d.supplyCoverage=consumed>0?clamp((d.supply+bought)/consumed):1;
 d.supply=clamp(d.supply+bought-consumed,0,Math.max(1e-6,d.active*A.normalSupplyMonths*2));
 const supplyCoverage=consumed?clamp(bought/consumed):0;
 d.logistics=clamp(d.logistics+.1*(Math.min(1,maintenanceCoverage,supplyCoverage)-d.logistics));
 if(d.alliance.requested||d.alliance.active){
  const contribution=paid*A.allianceBudgetShare;d.alliance.paid+=contribution;
  const adequate=(s.policy.militaryBudget??0)/100>=A.allianceMinimumGDP&&d.funding>.8;
  d.alliance.progress=adequate?Math.min(A.allianceAccessionMonths,d.alliance.progress+1):Math.max(0,d.alliance.progress-1);
  d.alliance.reliability=clamp(d.alliance.reliability+.08*((adequate?1:0)-d.alliance.reliability));
  if(!d.alliance.active&&d.alliance.progress>=A.allianceAccessionMonths){d.alliance.active=true;tell(s,'alliance','Оборонный союз','Партнёр подтвердил обязательства взаимной помощи.',events);}
  if(d.alliance.active&&d.alliance.reliability<.15){d.alliance.active=false;d.alliance.requested=false;tell(s,'alliance-lapse','Союз приостановлен','Военные обязательства не обеспечены финансированием.',events);}
 }
 refreshDefense(s);
 // Independent external actors: reducing own expenditure never spawns a war.
 for(const n of d.neighbors){const growth=Math.max(.98,Math.pow(1+(s.metrics.worldGrowth??2)/100,1/12));n.active*=growth;n.equipment*=growth;}
 const year=Math.floor((s.month-d.startedMonth)/12),episodeMonth=d.startedMonth+year*12+5;
 if(s.month===episodeMonth&&s.month>=d.cooldownUntil&&!d.war&&!d.crisis&&hash(s.seed,'defense-crisis',year)<A.annualCrisisFrequency){
  const neighbor=d.neighbors[Math.floor(hash(s.seed,'defense-neighbor',year)*d.neighbors.length)];
  d.crisis={id:`crisis:${year}`,neighbor:neighbor.id,started:s.month,deadline:s.month+A.crisisWarningMonths,intent:clamp(neighbor.intent+.3),negotiation:null};
  tell(s,'crisis','Пограничный кризис',neighbor.name+' усиливает давление. Решение — в разделе армии.',events);
 }
 const conflict=d.war??d.crisis;
 if(conflict?.negotiation&&!conflict.negotiation.completed){
  const talks=conflict.negotiation;talks.months++;talks.paid+=paid*A.negotiationBudgetShare;
  if(talks.months>=A.negotiationMonths){
   // One draw per conflict, never rerolled by repeated clicks or slider changes.
   const adequate=talks.paid>=Math.max(1,d.referenceBudget*A.negotiationBudgetShare*1.5);
   const success=adequate&&hash(s.seed,'defense-talks',conflict.id)<clamp(.72-conflict.intent*.4,.2,.7);
   if(success){d.war=null;d.crisis=null;d.cooldownUntil=s.month+36;tell(s,'settlement','Заключено перемирие','Военные действия предотвращены или прекращены.',events);}
   else if(!talks.completed){talks.completed=true;tell(s,'talks-failed','Переговоры не дали соглашения','Стороны сохранили прежние требования.',events);}
  }
 }
 if(d.crisis&&!d.war&&s.month>=d.crisis.deadline){
  const c=d.crisis,n=d.neighbors.find(n=>n.id===c.neighbor),ratio=enemyPower(s,n)/Math.max(effectiveDefense(s),1e-8);
  const propensity=clamp(c.intent*Math.max(0,Math.log(Math.max(1,ratio)))*.32,0,.8);
  const attack=hash(s.seed,'defense-attack',c.id)<propensity;
  if(attack){d.war={...c,started:s.month,enemyRemaining:1,months:0,negotiation:null};d.crisis=null;tell(s,'war','Началось вторжение',n.name+' начал военные действия.',events);}
  else{d.crisis=null;d.cooldownUntil=s.month+30;tell(s,'deescalation','Кризис завершён','Противник отказался от применения силы.',events);}
 }
 if(d.war){
  const war=d.war,n=d.neighbors.find(n=>n.id===war.neighbor);war.months++;
  const own=effectiveDefense(s),enemy=enemyPower(s,n)*war.enemyRemaining;
  const ratio=enemy/Math.max(own,1e-8),advantage=(enemy-own)/Math.max(enemy+own,1e-8);
  const movement=.07*advantage;d.occupation=clamp(d.occupation+movement,0,1);
  const losses=Math.min(d.active*.035,d.active*.003*(1+Math.min(4,ratio)));
  const killed=losses*.18;d.active-=losses;d.trained=Math.min(d.active,Math.max(0,d.trained-losses));
  d.pendingDeaths+=killed;d.totalKilled+=killed;d.reserve+=losses*.25;
  if(militaryPlan)d.economy.veterans.disabled+=Math.max(0,losses-killed-losses*.25)*.2;
  const equipmentLoss=Math.min(d.serviceable,d.serviceable*.006*(1+Math.min(4,ratio)));
  d.serviceable-=equipmentLoss;d.equipment=Math.max(d.serviceable,d.equipment-equipmentLoss);d.totalEquipmentLost+=equipmentLoss;
  // Remaining personnel losses are non-deployable survivors, not extra deaths.
  d.pendingCapitalLoss=A.monthlyCapitalDamageCeiling*clamp(.2+d.occupation+Math.max(0,advantage));
  d.pendingRefugees=s.population*.0003*d.occupation;d.totalDisplaced+=d.pendingRefugees;
  war.enemyRemaining=clamp(war.enemyRemaining-.012-.025*clamp(own/Math.max(enemy,1e-8)),0,1);
  if(war.enemyRemaining<.4||war.months>=A.defenseCampaignMonths&&d.occupation<.15){d.war=null;d.cooldownUntil=s.month+48;tell(s,'withdrawal','Вторжение остановлено','Противник прекратил наступление.',events);}
  d.defeatMonths=d.occupation>=A.occupationDefeatThreshold?d.defeatMonths+1:0;
  if(d.defeatMonths>=A.occupationDefeatMonths){d.sovereigntyLost=true;d.war=null;tell(s,'defeat','Утрата независимости','Оккупация привела к прекращению самостоятельного правления.',events);}
 }
 if(!d.war&&d.occupation>0)d.occupation=Math.max(0,d.occupation-.002);
 refreshDefense(s);
 d.last={month:s.month,paid,shares:clone(shares),salary,kitPrice:price,workforceCap:workforce,
  ...(militaryPlan?{peoplePaid:militaryPlan.active,grossWages:militaryPlan.paid,netWages:militaryPlan.paid-militaryPlan.tax-militaryPlan.contributions,contractShare:d.economy.contractShare,privateOrders:flow.defensePrivateOrders??0,domesticOrders:flow.defenseDomesticOrders??0,importedOrders:flow.defenseImportedOrders??0}:{}),
  recruitment,callup,exits,maintenanceNeed,maintenance,maintenanceCoverage,supplyPurchased:bought,supplyConsumed:consumed,
  personnel:d.active,readiness:d.readiness,capability:d.capability,status:defenseStatus(s),occupation:d.occupation,
  killed:d.pendingDeaths,refugees:d.pendingRefugees,capitalDamage:d.pendingCapitalLoss,capitalDamageApplied:d.appliedCapitalLoss??0};
 if(militaryPlan){d.economy.activePaid=militaryPlan.active;d.economy.reserves.contract=d.reserve*d.economy.contractShare;d.economy.reserves.conscript=d.reserve*(1-d.economy.contractShare);d.economy.last={month:s.month,fromLabor:militaryPlan.fromLabor,goodsSpend:Math.max(0,paid-militaryPlan.paid),importPreference:s.policy.defenseProcurement};}
 d.history.push(clone(d.last));
 if(d.sovereigntyLost&&s.politics.enabled&&s.politics.executive.inOffice){
  const e=s.politics.executive;e.inOffice=false;e.reason='Утрата независимости страны';e.endedMonth=s.month;
  e.report={month:s.month,monthsServed:s.month-e.startedMonth,reason:e.reason,gdpPerCapita:s.metrics.gdpPerCapitaReal,debt:s.metrics.debtRatio};
 }
}
export function pendingDefenseNotice(s){const d=s.defense;return d?.enabled?d.notices.find(n=>!d.seenNotices.includes(n.id))??null:null;}
export function acknowledgeDefenseNotice(s,id){if(s.defense?.notices.some(n=>n.id===id))s.defense.seenNotices=[...new Set([...s.defense.seenNotices,id])].slice(-80);}
export function validateDefense(s){
 const d=s.defense;if(!d)return;
 if(d.enabled!==true||d.version!==1||!Number.isInteger(d.startedMonth)||d.startedMonth<0||d.startedMonth>s.month)throw new Error('Повреждено состояние армии');
 for(const key of ['active','reserve','trained','equipment','serviceable','supply','occupation','readiness','pendingDeaths','pendingRefugees','pendingCapitalLoss'])if(!Number.isFinite(d[key])||d[key]<0)throw new Error('Повреждены военные запасы: '+key);
 if(d.readiness>1||d.occupation>1||d.trained>d.active+1e-8||d.serviceable>d.equipment+1e-8)throw new Error('Нарушены ограничения военных запасов');
 if(!d.assumptions||d.assumptions.version!==1||Object.entries(d.assumptions).some(([key,value])=>typeof value==='number'&&(!Number.isFinite(value)||value<0)))throw new Error('Повреждены военные допущения');
 if(!Array.isArray(d.history)||!Array.isArray(d.training)||!Array.isArray(d.deliveries)||!Array.isArray(d.neighbors)||!Array.isArray(d.notices)||!Array.isArray(d.seenNotices))throw new Error('Повреждён военный журнал');
 for(const a of d.training)if(!Number.isFinite(a.people)||a.people<0||!Number.isInteger(a.due))throw new Error('Повреждено обучение');
 for(const a of d.deliveries)if(!Number.isFinite(a.quantity)||a.quantity<0||!Number.isInteger(a.due))throw new Error('Повреждены военные поставки');
}

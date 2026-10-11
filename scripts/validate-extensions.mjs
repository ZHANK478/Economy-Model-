import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,scheduleOwnership,scheduleNetwork,scheduleShock,exportSimulation,importSimulation,replayJournal,accountBalances} from '../src/engine.js';
import {VERSION} from '../src/config.js';
import {validateExtendedState} from '../src/state-validation.js';

const scenarios=[
  {id:'baseline-rule',name:'Стабилизация по правилу',patch:{monetaryRegime:'rule'}},
  {id:'public-networks',name:'Бюджетная инфраструктура',patch:{monetaryRegime:'rule',publicInvestment:6,infrastructureMaintenance:1.2,privateInfrastructureEntry:false,concessionEntry:false}},
  {id:'private-services',name:'Частные сети, медицина и школы',patch:{monetaryRegime:'rule',publicInvestment:0,infrastructureMaintenance:0,healthcare:0,education:0,childcareBudget:0,transfers:1},network:'networkSale'},
  {id:'liberal-package',name:'Либеральный пакет с частными услугами',patch:{monetaryRegime:'freeBanking',vat:8,incomeTax:8,corporateTax:12,governmentConsumption:4,publicInvestment:0,infrastructureMaintenance:0,healthcare:0,education:0,transfers:1,familyBenefits:0,bankRescue:false,registrationProcedures:1,energyPricing:'market'},network:'networkSale',ownership:{kind:'privatize',points:100}},
  {id:'concessions',name:'Концессии с гарантиями',patch:{monetaryRegime:'rule',publicInvestment:0,privateInfrastructureEntry:false,concessionEntry:true,concessionGuarantee:100,infrastructurePricing:'capped',infrastructureFeeCap:40}},
  {id:'cooperative',name:'Доли работникам и представительство',patch:{monetaryRegime:'rule',workerRepresentation:true,bargainingSystem:'coordinated'},ownership:{kind:'cooperatize',points:10}},
  {id:'municipal',name:'Муниципальное строительство',patch:{monetaryRegime:'rule',publicInvestment:5,municipalInvestmentShare:100},ownership:{kind:'municipalize',points:10}},
  {id:'currency-board',name:'Валютное управление',patch:{monetaryRegime:'currencyBoard'}},
  {id:'dollarized',name:'Долларизация',patch:{monetaryRegime:'dollarized'}},
  {id:'collective-labor',name:'Коллективные договоры и 36 часов',patch:{monetaryRegime:'rule',bargainingSystem:'sector',workerRepresentation:true,normalWorkweek:36,employmentProtection:4,parentalLeaveMonths:12,childcareBudget:.8}},
  {id:'unchecked-executive',name:'Слабые ограничения власти',patch:{monetaryRegime:'rule',protectedJudges:false,judicialReview:false,freeMedia:false,competitiveElections:false,parliamentOversight:false,publicDisclosure:false,meritCivilService:false,independentSoeAudit:false}},
  {id:'fiscal-crisis',name:'Кризис необеспеченных расходов',patch:{rate:2,vat:5,incomeTax:5,corporateTax:5,governmentConsumption:35,publicInvestment:12,transfers:15}}
];
const fields=['population','gdpPerCapitaReal','realGDPAnnualized','inflationYoY','unemployment','debtRatio','giniDisposable','hdi','infrastructure','privateInfrastructureShare','corporateInfrastructureShare','totalHealthAccess','healthAccessBottom','healthAccessTop','totalEducationAccess','bargainingCoverage','unionDensity','strikeHours','judicialIndependence','mediaFreedom','electoralIntegrity','corruptionRisk','parliamentSupport','totalFertilityRate','elderlyShare'];
let monthsChecked=0,replayChecks=0,importChecks=0,maxRelativeAudit=0;
const games=[],csv=['scenario;resource;seed;age;month;'+fields.join(';')];
function verify(s){
  monthsChecked++;validateExtendedState(s);
  const scale=Math.max(1,Math.abs(accountBalances(s).bankAssets),s.metrics.nominalGDPAnnual);
  for(const v of Object.values(s.lastReport.audit)){maxRelativeAudit=Math.max(maxRelativeAudit,Math.abs(v)/scale);assert.ok(Math.abs(v)<Math.max(1e-4,scale*1e-10));}
  assert.ok(Object.values(s.metrics).every(Number.isFinite));assert.ok(s.government.cash>=0&&s.government.reservesUSD>=0);
  assert.ok(s.firms.every(f=>f.cash>=0&&f.capital>0));assert.ok(s.households.every(h=>h.cash>=0));
  for(const f of s.firms){assert.ok(Math.abs(Object.values(f.ownership).reduce((v,x)=>v+x)-1)<1e-8);assert.ok(Math.abs(f.workerOwners.reduce((v,x)=>v+x)-f.ownership.cooperative)<1e-8);}
}
function play(scenario,{resourceMode=false,seed=11,age='young',parameters={},months=360,stochastic=true,replay=false,record=false}={}){
  let s=createSimulation({resourceMode,seed,stochastic,parameters});
  scheduleShock(s,{key:'energyPrice',multiplier:1.7,start:121,duration:12});
  scheduleShock(s,{key:'foreignDemand',multiplier:.8,start:241,duration:18});
  let peakInflation=-Infinity,minPopulation=s.population,guaranteePaid=0,rejections=0,peakStrikes=0;
  for(let month=1;month<=months;month++){
    if(scenario.ownership&&[25,73,121,169,217].includes(month))for(let sector=0;sector<5;sector++)scheduleOwnership(s,{sector,...scenario.ownership});
    if(scenario.network&&[25,73,121,169,217].includes(month))for(const network of ['roads','rail','grid'])scheduleNetwork(s,{network,kind:scenario.network,points:10});
    s=advanceMonth(s,{...s.policy,...scenario.patch});verify(s);
    peakInflation=Math.max(peakInflation,s.metrics.inflationYoY);peakStrikes=Math.max(peakStrikes,s.metrics.strikeHours);minPopulation=Math.min(minPopulation,s.population);
    guaranteePaid+=s.lastReport.fiscal.concessionGuarantees;rejections+=s.politics.lastReview.length+s.journal.at(-1).actions.filter(a=>a.rejected).length;
    if(record)csv.push([scenario.id,resourceMode,seed,age,month,...fields.map(k=>s.metrics[k])].join(';'));
  }
  if(replay){assert.deepEqual(replayJournal(s).metrics,s.metrics);replayChecks++;}
  assert.deepEqual(importSimulation(exportSimulation(s)).metrics,s.metrics);importChecks++;
  const result={scenario:scenario.id,name:scenario.name,resourceMode,seed,age,months,parameters,
    ...Object.fromEntries(fields.map(k=>[k,s.metrics[k]])),peakInflation,minPopulation,guaranteePaid,rejections,peakStrikes,
    defaults:s.government.defaults,concessions:s.networks.reduce((v,n)=>v+n.contracts.length,0),cooperativeShare:s.firms.map(f=>f.ownership.cooperative),municipalShare:s.firms.map(f=>f.ownership.municipal)};
  games.push(result);return result;
}
for(const scenario of scenarios){
  for(const resourceMode of [false,true])for(const seed of [11,23,37])play(scenario,{resourceMode,seed,replay:seed===11,record:seed===11});
  console.log('Extended 30-year scenario: '+scenario.id);
}
for(const [age,parameters] of [['transition',{initialFertility:1.8,initialChildShare:.22,initialElderlyShare:.14}],['aging',{initialFertility:1.3,initialChildShare:.17,initialElderlyShare:.23}],['very-low-fertility',{initialFertility:.7,initialChildShare:.13,initialElderlyShare:.28}]]){
  for(const scenario of [scenarios[0],scenarios[2],scenarios[9]])play({...scenario,patch:{...scenario.patch,migrationOpenness:0}},{age,parameters,months:600,replay:true,record:true});
}
const defaults=createSimulation().parameters;
for(const key of ['laborDemandWageElasticity','unionWageCompression','unionConflictSensitivity','politicalRiskSensitivity','privateInfrastructureAdjustment','infrastructureMaintenanceRate','fertilityChildcareElasticity','fertilityHousingElasticity']){
  for(const multiplier of [0,2])play(scenarios[0],{age:'sensitivity',parameters:{[key]:defaults[key]*multiplier},stochastic:false});
}
assert.ok(games.some(g=>g.age==='aging'&&g.population<10));
assert.ok(games.some(g=>g.scenario==='concessions'&&g.guaranteePaid>0));
assert.ok(games.some(g=>g.scenario==='cooperative'&&g.cooperativeShare.some(x=>x>0)));
assert.ok(games.some(g=>g.scenario==='fiscal-crisis'&&g.defaults>0));
const report={version:VERSION,mode:"laboratory",date:'2026-10-11',totalGames:games.length,monthsChecked,replayChecks,importChecks,maxRelativeAudit,scenarios,games};
await mkdir('docs',{recursive:true});await writeFile('docs/extended-validation-results.json',JSON.stringify(report,null,2)+'\n');
await writeFile('docs/extended-strategies-monthly.csv',csv.join('\n')+'\n');
await writeFile('src/extended-validation-results.js','// Generated by npm run validate:extensions.\nexport const extendedValidation='+JSON.stringify(report)+';\n');
const n=(x,d=1)=>x.toFixed(d);
const selected=games.filter(g=>g.seed===11&&g.age==='young');
const table='| Пакет | Структура | ВВП / человек | Инфляция, % | Долг / ВВП | Джини | Доступ к медицине, % | Частная инфраструктура, % | Дефолты |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n'+selected.map(g=>`| ${g.name} | ${g.resourceMode?'сырьевая':'диверсифицированная'} | ${n(g.gdpPerCapitaReal,0)} | ${n(g.inflationYoY)} | ${n(g.debtRatio)} | ${n(g.giniDisposable)} | ${n(g.totalHealthAccess)} | ${n(g.privateInfrastructureShare)} | ${g.defaults} |`).join('\n');
// Political and population properties are simulated, not estimated national indexes.
const md=`# Новые механизмы: проверка ${VERSION}\n\n${games.length} дополнительных игр, ${monthsChecked} месячных переходов, ${replayChecks} точных воспроизведений и ${importChecks} проверок экспорта/импорта. Максимальная относительная погрешность ${maxRelativeAudit.toExponential(3)}.\n\n72 игры по 30 лет: 12 пакетов × 2 структуры × 3 общих seed. Шоки: энергия +70% на месяцах 121–132; внешний спрос −20% на месяцах 241–258. Ещё 9 игр по 50 лет с тремя возрастными профилями, и 16 игр с нулевой / удвоенной величиной восьми новых коэффициентов.\n\n${table}\n\n## Демография\n\n`+
    '| Профиль | Пакет | Население через 50 лет, млн | Рождаемость |\n|---|---|---:|---:|\n'+games.filter(g=>['transition','aging','very-low-fertility'].includes(g.age)).map(g=>`| ${g.age} | ${g.name} | ${n(g.population,2)} | ${n(g.totalFertilityRate,2)} |`).join('\n')+
    '\n\n## Что проверялось и исправлено\n\n- Корпоративная инфраструктура учитывает владельцев оператора; госпредприятие не становится «частным» из-за коммерческого строительства.\n- Концессии оцениваются без остаточной частной стоимости после передачи; гарантии влияют на NPV и требуют реального бюджетного платежа при недостаточной оплаченной выручке.\n- Износ ремонтируемого фонда остаётся положительным; государственный и частный фонд имеют одинаковую физическую формулу.\n- Услуги оплачиваются один раз и входят в ВВП через потребление или закупки. В отдельных сценариях бедные группы недополучают частные услуги; в других доходов хватает всем.\n- Неиспользуемые ставка и цель инфляции не влияют на результаты при отсутствии этих инструментов. Долларизация отличается от валютного управления доходом на расчётные долларовые активы и отсутствием валютного риска по долларовым договорам.\n- Рабочее время меняет и выпуск, и оплаченные часы. Инфляционные сюрпризы и просрочки могут приводить к трудовым конфликтам.\n- Отклонённые операции и пакеты сохраняются вместе с предложением и причиной.\n- Импорт проверяет новые физические, договорные и институциональные запасы.\n\n## Интерпретация\n\nЭто проверка вычислений, ограничений и устойчивости сценариев. Она не оценивает причинный эффект реальной политики и не доказывает преимущество владельца или политической системы. Пакеты меняют несколько инструментов одновременно; сравнивать их как чистый эффект приватизации нельзя. Условные коэффициенты можно менять, в том числе обнулять. Шоки и seed общие между пакетами. Проверка DOM-шаблонов и обработчиков не заменяет реальную проверку браузерной вёрстки.\n\n[Формулы и научные источники](EXTENSIONS.md) · [Полный JSON](extended-validation-results.json) · [Помесячные CSV](extended-strategies-monthly.csv) · [Основные 165 игр](VALIDATION.md)\n';
await writeFile('docs/EXTENDED-VALIDATION.md',md);
console.log(JSON.stringify({version:VERSION,totalGames:games.length,monthsChecked,replayChecks,maxRelativeAudit},null,2));

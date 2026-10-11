import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,executePolitical,scheduleOwnership,scheduleShock,replayJournal,exportSimulation,importSimulation,accountBalances} from '../src/engine.js';
import {validatePoliticalSystem,coalitionSeats} from '../src/political-system.js';
import {VERSION} from '../src/config.js';
import {governedPlatform} from '../src/electorate.js';
import {distance} from '../src/political-config.js';
const scenarios=[
  {id:'pres-pr',name:'Президент · пропорциональная · умеренная политика',constitution:{form:'presidential',electoralSystem:'pr'},family:'liberal',patch:{incomeTax:16,publicInvestment:4}},
  {id:'pres-district',name:'Президент · округа · снижение налогов',constitution:{form:'presidential',electoralSystem:'plurality'},family:'conservative',patch:{incomeTax:12,corporateTax:18,governmentConsumption:5}},
  {id:'parl-social',name:'Парламент · пропорциональная · социальные услуги',constitution:{form:'parliamentary',electoralSystem:'pr'},family:'socialDemocrat',patch:{incomeTax:22,healthcare:3,education:2,transfers:4}},
  {id:'parl-mmp',name:'Парламент · компенсирующая · сбалансированный бюджет',constitution:{form:'parliamentary',electoralSystem:'mmp'},family:'socialDemocrat',patch:{governmentConsumption:6,incomeTax:21}},
  {id:'semi-pm',name:'Смешанная · премьер · параллельная · частные услуги',constitution:{form:'semiPresidential',playerRole:'primeMinister',electoralSystem:'parallel'},family:'liberal',patch:{privateHealthEntry:true,privateEducationEntry:true,registrationProcedures:2,incomeTax:14}},
  {id:'semi-president',name:'Смешанная · президент · два тура в округах',constitution:{form:'semiPresidential',playerRole:'president',electoralSystem:'twoRound'},family:'regional',patch:{municipalInvestmentShare:60,publicInvestment:5}},
  {id:'hybrid',name:'Ограниченная конкуренция · инфраструктура',constitution:{regime:'hybrid',form:'presidential'},family:'conservative',patch:{publicInvestment:5,infrastructureMaintenance:1}},
  {id:'party',name:'Партийная автократия · государственные услуги',constitution:{regime:'party',termLimit:0},family:'socialist',patch:{publicInvestment:5,healthcare:3,patronageBudget:.6}},
  {id:'personalist',name:'Персоналистская автократия · необеспеченные расходы',constitution:{regime:'personalist',termLimit:0,independentCB:false},family:'national',patch:{rate:2,incomeTax:8,governmentConsumption:25,transfers:10,patronageBudget:.8}},
  {id:'military',name:'Военное правление · силовые расходы',constitution:{regime:'military',termLimit:0},family:'conservative',patch:{securityBudget:2,healthcare:1,governmentConsumption:6}}
];
let monthsChecked=0,replayChecks=0,maxRelativeAudit=0,importChecks=0;
const games=[],rows=['scenario;resource;seed;month;gdpPerCapita;inflation;unemployment;population;approval;partyRating;coalitionSeats;inOffice'];
const verify=s=>{
  monthsChecked++;assert.equal(s.journal.length,s.month);assert.ok(Object.values(s.metrics).every(Number.isFinite));validatePoliticalSystem(s);
  const scale=Math.max(1,Math.abs(accountBalances(s).bankAssets),s.metrics.nominalGDPAnnual);
  for(const [key,value] of Object.entries(s.lastReport.audit)){maxRelativeAudit=Math.max(maxRelativeAudit,Math.abs(value)/scale);assert.ok(Math.abs(value)<(key==='population'?1e-8:Math.max(1e-4,scale*1e-10)),key);}
  assert.ok(s.government.cash>=0&&s.government.reservesUSD>=0);assert.equal(new Set(s.politics.parties.flatMap(x=>x.deputies.map(d=>d.id))).size,s.politics.totalSeats);
  assert.ok(s.metrics.eligibleVoters<=s.population);for(const r of s.politics.rollCalls.filter(r=>r.month===s.month)){assert.equal(r.yes+r.no+r.abstain,r.total);assert.equal(r.deputies.length,r.total);}
};
function decideBusiness(s){const p=s.politics;
  const player=p.parties.find(x=>x.id===p.executive.playerParty);
  for(const b of p.bills.filter(b=>['draft','articles'].includes(b.status))){
    const next=governedPlatform({...s,policy:{...s.policy,...b.patch}}),old=governedPlatform(s);
    const acceptable=b.sponsor===player.id||distance(player.platform,next)<=distance(player.platform,old)+.015;
    executePolitical(s,{kind:'decideBill',billId:b.id,decision:acceptable?'accept':'reject'});
  }
  if(p.executive.formationDeadline!==null&&coalitionSeats(s)<=p.totalSeats/2){const candidate=p.parties.filter(x=>x.seats>0&&x.active&&!p.coalition.includes(x.id)).sort((a,b)=>b.seats-a.seats)[0];if(candidate)executePolitical(s,{kind:'coalitionOffer',partyId:candidate.id,posts:1});}
  if(p.budgetExpires-s.month<=1&&!p.bills.some(b=>b.renewBudget&&b.status==='passed'))executePolitical(s,{kind:'chooseLaw',renewBudget:true,title:'Бюджет на следующий год'});
}
function play(scenario,{seed=11,resourceMode=false,parameters={},age=false,record=true,replay=false}={}){
  let s=createSimulation({politicalMode:true,politicalOptions:{constitution:scenario.constitution,playerFamily:scenario.family,parameters},parameters:age?{initialFertility:1.3,initialChildShare:.17,initialElderlyShare:.23}:{},resourceMode,seed,stochastic:true});
  scheduleShock(s,{key:'energyPrice',multiplier:1.5,start:121,duration:12});scheduleShock(s,{key:'foreignDemand',multiplier:.8,start:241,duration:18});
  executePolitical(s,{kind:'policyDecision',patch:scenario.patch,title:'Исходный пакет стратегии'});
  for(let month=1;month<=360&&s.politics.executive.inOffice;month++){
    decideBusiness(s);if(month===3)executePolitical(s,{kind:'promise',key:'incomeTax',value:scenario.patch.incomeTax??s.policy.incomeTax,months:12});
    if(month===13&&scenario.family==='liberal'){scheduleOwnership(s,{kind:'privatize',sector:1,points:10});executePolitical(s,{kind:'chooseLaw',actions:[s.pendingActions.at(-1)],title:'Приватизация отраслевой доли'});}
    s=advanceMonth(s,s.policy);verify(s);
    if(record)rows.push([scenario.id,resourceMode,seed,s.month,s.metrics.gdpPerCapitaReal,s.metrics.inflationYoY,s.metrics.unemployment,s.population,s.metrics.executiveApproval,s.metrics.governmentPartyRating,coalitionSeats(s),s.politics.executive.inOffice].join(';'));
  }
  const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.metrics,s.metrics);importChecks++;
  if(replay){const repeated=replayJournal(s);assert.deepEqual(repeated.metrics,s.metrics);assert.deepEqual(repeated.politics.elections,s.politics.elections);assert.deepEqual(repeated.politics.rollCalls,s.politics.rollCalls);replayChecks++;}
  const r={scenario:scenario.id,name:scenario.name,seed,resourceMode,age,parameters,months:s.month,completed30Years:s.month===360,inOffice:s.politics.executive.inOffice,endedReason:s.politics.executive.reason,gdpPerCapita:s.metrics.gdpPerCapitaReal,inflation:s.metrics.inflationYoY,unemployment:s.metrics.unemployment,debt:s.metrics.debtRatio,population:s.population,approval:s.metrics.executiveApproval,partyRating:s.metrics.governmentPartyRating,coalitionSeats:coalitionSeats(s),totalSeats:s.politics.totalSeats,laws:s.politics.bills.filter(x=>x.status==='enacted').length,rollCalls:s.politics.rollCalls.length,elections:s.politics.elections.length,defaults:s.government.defaults,saveBytes:Buffer.byteLength(exportSimulation(s))};games.push(r);return r;
}
for(const scenario of scenarios){for(const resourceMode of [false,true])for(const seed of [11,23,37])play(scenario,{resourceMode,seed,replay:seed===11,record:seed===11});console.log('Political scenarios checked: '+scenario.id);}
for(const parameters of [{economicWeight:0},{economicWeight:2.2},{identityWeight:0},{identityWeight:1.3},{ideologyWeight:0},{ideologyWeight:3.6},{polarization:0},{polarization:.7},{eliteHazard:0},{eliteHazard:.008},{naturalizationUptake:0},{naturalizationUptake:.024}])play(scenarios[7],{parameters,replay:true,record:false});
for(const scenario of [scenarios[2],scenarios[7]])play(scenario,{age:true,replay:true});
assert.ok(games.some(x=>x.completed30Years));assert.ok(games.some(x=>!x.inOffice));
const report={version:VERSION,date:'2026-10-12',interaction:'instantVotesMonthlyAgenda',mode:'political',horizonMonths:360,totalGames:games.length,monthsChecked,replayChecks,importChecks,maxRelativeAudit,completed30Years:games.filter(x=>x.completed30Years).length,endedEarly:games.filter(x=>!x.completed30Years).length,scenarios,games};
await writeFile('docs/political-validation-results.json',JSON.stringify(report,null,2)+'\n');await writeFile('docs/political-monthly.csv',rows.join('\n')+'\n');
await writeFile('src/political-validation-results.js','// Generated by npm run validate:politics.\nexport const politicalValidation='+JSON.stringify(report)+';\n');
const selected=games.filter(x=>x.seed===11&&!x.age&&!Object.keys(x.parameters).length),n=(x,d=1)=>x.toFixed(d);
const table='| Стратегия | Экономика | Месяцев | Причина завершения | ВВП / человек | Инфляция, % | Одобрение, % | Места коалиции | Принятые законы |\n|---|---|---:|---|---:|---:|---:|---:|---:|\n'+selected.map(x=>`| ${x.name} | ${x.resourceMode?'сырьевая':'диверсифицированная'} | ${x.months} | ${x.endedReason??'Достигнут горизонт 30 лет'} | ${n(x.gdpPerCapita,0)} | ${n(x.inflation)} | ${n(x.approval)} | ${x.coalitionSeats}/${x.totalSeats} | ${x.laws} |`).join('\n');
await writeFile('docs/POLITICAL-VALIDATION.md',`# Политическая модель ${VERSION}: сценарная проверка\n\n${report.totalGames} партий с горизонтом 360 месяцев, ${monthsChecked} выполненных месячных ходов, ${replayChecks} точных воспроизведений и ${importChecks} проверок импорта. ${report.completed30Years} партий достигли 30 лет; ${report.endedEarly} закончились раньше из-за утраты исполнительного мандата. Игрок после поражения не подменялся новой властью.\n\nМаксимальная относительная ошибка балансов: ${maxRelativeAudit.toExponential(3)}. На каждом ходе проверены конечные числа, взрослые избиратели, места, уникальные депутатские идентификаторы, финансовые тождества и журнал. Выборы используют целые голоса и отдельные календари.\n\n## Результаты\n\n${table}\n\n## Протокол\n\nДесять комбинаций институтов и стратегий; две структуры экономики; общие seed 11, 23, 37 и заранее заданные внешние шоки на месяцах 121 и 241. Исполнительная власть один раз выбирает исходный пакет и сразу проводит его голосование. Каждый месяц рассматривает три партийные инициативы: принимает близкие собственной программе (допуск по квадратичной дистанции 0,015), отказывает более далёким, автоматически голосует статьи и пакет и подписывает при наличии полномочия. Частота инициатив распределяется по местам. Алгоритм пытается сформировать большинство после выборов и ежегодно продлевает бюджет. Ответы и изменение лояльности записываются в текущем ходу. Это открытый простой алгоритм, не оптимальный политик. В кабинете меньшинства продление бюджета может не пройти; временное продолжение зависит от конституции. Ранняя законная отставка является результатом игры, не ошибкой программы.\n\nДополнительно проверены нулевые и удвоенные поведенческие эффекты: экономика, идентичность, идеологическая дистанция, поляризация, внутреннее отстранение и натурализация. Два сценария используют стареющую структуру. Изменения коэффициентов не представляют доверительные интервалы.\n\n## Научные ограничения\n\nЭто вычислительная и сценарная проверка. Она не является оценкой причинного превосходства демократии или автократии: пакеты меняют расходы, налоговые решения и исходные институты одновременно, а досрочно завершённые игры имеют разные горизонты. Для причинного сравнения нужны одинаковые институты, срок, шоки и отдельное изменение инструмента. Экономическая лаборатория позволяет такой контроль; в политической игре принятие закона и сохранение мандата входят в механизм.\n\n[Формулы и источники](POLITICS.md) · [Полный JSON](political-validation-results.json) · [Помесячные ряды](political-monthly.csv)\n`);
console.log(JSON.stringify({version:VERSION,totalGames:games.length,monthsChecked,replayChecks,completed30Years:report.completed30Years,endedEarly:report.endedEarly,maxRelativeAudit}));

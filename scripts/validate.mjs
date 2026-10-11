import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,scheduleShock,scheduleOwnership,accountBalances,replayJournal} from '../src/engine.js';
import {VERSION,MODEL_PROFILES} from '../src/config.js';
import {STRATEGIES,strategyPolicy} from '../src/strategies.js';

const horizon=360;
const fields=['gdpPerCapitaReal','realGDPAnnualized','inflationYoY','unemployment','debtRatio','deficitRatio','population','totalFertilityRate','lifeExpectancy','giniDisposable','giniMarket','hdi','meanWageReal','relativePoverty','stateAssetShare','capitalRatio','leverageRatio','liquidityCoverage','marketContestability','bankContestability','contractReliability','registrationDays','contractDelayDays','antitrustCapacity','courtCapacity','soeAuditCapacity'];
const pick=m=>Object.fromEntries(fields.map(k=>[k,m[k]]));
let monthsChecked=0,maxRelativeFinancialAudit=0,maxAbsoluteAudit=0,replayChecks=0;
function verify(s) {
  monthsChecked++;
  for(const [k,v] of Object.entries(s.metrics))assert.ok(Number.isFinite(v),'non-finite '+k);
  const b=accountBalances(s),scale=Math.max(1,Math.abs(b.bankAssets),Math.abs(b.totalGovernmentDebt),Math.abs(s.metrics.nominalGDPMonthly));
  for(const [k,v] of Object.entries(s.lastReport.audit)){
    maxAbsoluteAudit=Math.max(maxAbsoluteAudit,Math.abs(v));
    if(k==='population')assert.ok(Math.abs(v)<1e-8);
    else {maxRelativeFinancialAudit=Math.max(maxRelativeFinancialAudit,Math.abs(v)/scale);assert.ok(Math.abs(v)<Math.max(1e-4,scale*1e-10),k+' identity');}
  }
  assert.ok(s.government.cash>=-1e-6&&s.government.reservesUSD>=-1e-6&&s.government.fundUSD>=-1e-6);
  assert.ok(s.firms.every(f=>f.capital>0&&f.workers>=0&&f.inventory>=0&&f.price>0));
  assert.ok([...s.households,...s.firms].every(a=>a.cash>=-1e-6&&a.loanLC>=0&&a.loanFX>=0));
  for(const f of s.firms){
    assert.ok(Math.abs(Object.values(f.ownership).reduce((a,b)=>a+b)-1)<1e-8);
    assert.ok(Math.abs(f.domesticOwners.reduce((a,b)=>a+b)-f.ownership.domestic)<1e-8);
    assert.ok(Object.values(f.ownership).every(v=>v>=-1e-10&&v<=1+1e-10));
  }
  assert.equal(s.journal.length,s.month);
  assert.ok(s.metrics.giniDisposable>=0&&s.metrics.giniDisposable<=100&&s.metrics.hdi>=0&&s.metrics.hdi<=1);
  for(const key of ['antitrustCapacity','courtCapacity','soeAuditCapacity','competition','bankContestability','contractReliability'])assert.ok(s.institutions[key]>=0&&s.institutions[key]<=1);
}
const csv=['structure;strategy;month;'+fields.join(';')];
function play(strategy,{resourceMode=false,seed=42,stochastic=false,shocks=false,parameters={},months=horizon,modelProfile='balanced',ownership=null,record=false,replay=false}={}) {
  let s=createSimulation({resourceMode,seed,stochastic,parameters,modelProfile}),peakInflation=-Infinity,peakDebt=0,minCapital=Infinity;
  if(shocks){scheduleShock(s,{key:'commodityPrice',multiplier:.7,start:121,duration:18});scheduleShock(s,{key:'energyPrice',multiplier:1.3,start:241,duration:12});}
  const checkpoints=[];
  for(let month=1;month<=months;month++){
    if(ownership&&month===61)for(let sector=0;sector<5;sector++)scheduleOwnership(s,{sector,...ownership});
    s=advanceMonth(s,strategyPolicy(strategy,s));verify(s);
    peakInflation=Math.max(peakInflation,s.metrics.inflationYoY);peakDebt=Math.max(peakDebt,s.metrics.debtRatio);minCapital=Math.min(minCapital,s.metrics.capitalRatio);
    if(record)csv.push((resourceMode?'resource':'diversified')+';'+strategy.id+';'+month+';'+fields.map(k=>s.metrics[k]).join(';'));
    if([12,60,120,240,360,600].includes(month))checkpoints.push({month,...pick(s.metrics)});
  }
  if(replay){assert.deepEqual(replayJournal(s).metrics,s.metrics);replayChecks++;}
  return {id:strategy.id,name:strategy.name,description:strategy.description,resourceMode,seed,modelProfile,...pick(s.metrics),peakInflation,peakDebt,minCapital,defaults:s.government.defaults,
    restructurings:s.government.defaultEpisodes.reduce((v,e)=>v+e.restructurings,0),defaultActive:s.government.defaultActive,
    defaultEpisodes:s.government.defaultEpisodes,checkpoints};
}
const main=[],resource=[],robustness=[],sensitivity=[],longHorizon=[],ownershipGames=[],crises=[];
for(const strategy of STRATEGIES){
  main.push(play(strategy,{record:true,replay:true}));resource.push(play(strategy,{resourceMode:true,record:true}));
  const samples=[];
  for(const resourceMode of [false,true])for(let seed=1;seed<=4;seed++)samples.push(play(strategy,{resourceMode,seed,stochastic:true,shocks:true}));
  const ranges=Object.fromEntries([false,true].map(mode=>[mode?'resource':'diversified',Object.fromEntries(fields.map(k=>{
    const a=samples.filter(s=>s.resourceMode===mode).map(s=>s[k]);return [k,{min:Math.min(...a),max:Math.max(...a),mean:a.reduce((v,x)=>v+x)/a.length}];
  }))]));
  robustness.push({id:strategy.id,ranges,defaults:samples.filter(s=>s.defaults>0).length});
  console.log('Checked 30-year strategy '+main.length+'/10: '+strategy.id);
}
for(const key of ['interestInvestmentElasticity','importPassThrough','pricePersistence','fertilityBenefitElasticity','healthMortalityElasticity']){
  const reference=createSimulation().parameters[key];
  for(const multiplier of [.8,1.2])sensitivity.push({parameter:key,multiplier,...play(STRATEGIES[0],{parameters:{[key]:reference*multiplier}})});
}
for(const resourceMode of [false,true])for(const strategy of [STRATEGIES[0],STRATEGIES[1]])longHorizon.push(play(strategy,{resourceMode,months:600}));
for(const modelProfile of Object.keys(MODEL_PROFILES))for(const scenario of [
  {id:'control',policy:{},ownership:null},
  {id:'public-professional',policy:{soeAuditBudget:.05,courtBudget:.16,independentSoeAudit:true,meritAppointments:true,boardAutonomy:true},ownership:{kind:'purchase',points:30}},
  {id:'private-competitive',policy:{registrationProcedures:2,antitrustBudget:.10,courtBudget:.16,openProcurement:true},ownership:{kind:'privatize',points:30}},
  {id:'seizure-weak-governance',policy:{soeAuditBudget:0,courtBudget:0,independentSoeAudit:false,meritAppointments:false,boardAutonomy:false,judicialReview:false},ownership:{kind:'nationalize',points:50,compensation:0}}
]){
  ownershipGames.push({scenario:scenario.id,...play({...STRATEGIES[0],patch:scenario.policy},{modelProfile,ownership:scenario.ownership,replay:modelProfile==='balanced'})});
}
for(const scenario of [
  {id:'fiscal-crisis',name:'Необеспеченные расходы',patch:{governmentConsumption:30,publicInvestment:12,transfers:15,vat:5,incomeTax:5,corporateTax:5}},
  {id:'high-rate-low-taxes',name:'Высокая ставка, низкие налоги',patch:{rate:27.5,inflationTarget:13,vat:7,incomeTax:7.5,corporateTax:9.5,governmentConsumption:5,publicInvestment:2.75}},
  {id:'no-bank-backstop',name:'Жёсткие нормативы без поддержки банков',patch:{bankCapitalRequirement:25,reserveRequirement:25,bankRescue:false,liquiditySupport:false}}
])crises.push(play({...scenario,description:'Крайний сценарий для проверки балансов и дефолтов.'},{resourceMode:true,stochastic:true,seed:23}));
const institutionGames=[];
const assumptions=[
  {id:'calibrated',parameters:{}},
  {id:'zero-program-productivity',parameters:{institutionServiceProductivity:0}},
  {id:'zero-institutional-returns',parameters:{governanceEfficiencyElasticity:0,competitionEfficiencyElasticity:0,softBudgetEfficiencyPenalty:0,competitionPriceResponse:0,contractRiskSensitivity:0,bankContestabilitySpread:0,laborMarkdown:0,infrastructureCompetitionEffect:0,politicalRiskSensitivity:0}}
];
for(const resourceMode of [false,true])for(const assumption of assumptions)for(const scenario of [
  {id:'baseline',patch:{}},
  {id:'entry-rules-only',patch:{registrationProcedures:1,openProcurement:true,depositPortability:true}},
  {id:'spending-only',patch:{antitrustBudget:.5,courtBudget:1,soeAuditBudget:.5}},
  {id:'combined',patch:{registrationProcedures:2,openProcurement:true,depositPortability:true,antitrustBudget:.10,courtBudget:.16,soeAuditBudget:.05}},
  {id:'no-independent-accountability',patch:{independentSoeAudit:false,meritAppointments:false,boardAutonomy:false}},
  {id:'no-service-funding',patch:{antitrustBudget:0,courtBudget:0,soeAuditBudget:0}}
])institutionGames.push({assumption:assumption.id,...play({...scenario,name:scenario.id,description:'Условное сравнение инструментов и отдачи, не оценка реальной страны.'},{resourceMode,parameters:assumption.parameters,replay:scenario.id==='combined'})});
console.log('Checked '+institutionGames.length+' institutional scenarios, including zero-return hypotheses.');
const report={version:VERSION,horizonMonths:horizon,mainGames:10,structuralGames:10,stochasticGames:80,sensitivityGames:10,longHorizonGames:4,ownershipGameCount:12,crisisGameCount:3,institutionGameCount:institutionGames.length,totalGames:129+institutionGames.length,
  monthsChecked,maxAbsoluteAudit,maxRelativeFinancialAudit,replayChecks,main,resource,robustness,sensitivity,longHorizon,ownershipGames,crises,institutionGames};
await mkdir('docs',{recursive:true});
await writeFile('docs/validation-results.json',JSON.stringify(report,null,2)+'\n');
await writeFile('docs/strategies-monthly.csv',csv.join('\n')+'\n');
const browser={...report};delete browser.sensitivity;delete browser.longHorizon;delete browser.ownershipGames;delete browser.crises;delete browser.institutionGames;
await writeFile('src/validation-results.js','// Generated by npm run validate from the current engine.\nexport const validation='+JSON.stringify(browser)+';\n');
const f=(x,d=1)=>x.toFixed(d);
const table=games=>'| Стратегия | Структура | ВВП / человек, база | Инфляция, % | Безработица, % | Долг / ВВП, % | Джини | ИЧР модели | Эпизоды дефолта |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n'+games.map(s=>'| '+s.name+' | '+(s.resourceMode?'сырьевая':'диверсифицированная')+' | '+f(s.gdpPerCapitaReal,0)+' | '+f(s.inflationYoY)+' | '+f(s.unemployment)+' | '+f(s.debtRatio)+' | '+f(s.giniDisposable)+' | '+f(s.hdi,3)+' | '+s.defaults+' |').join('\n');
const md=[
'# Проверка модели '+VERSION,
'Воспроизводимый отчёт: npm test, затем npm run validate. Основной горизонт — **360 месяцев (30 лет)**. Сценарии условные, не прогноз реальной страны.',
'## Десять стратегий',STRATEGIES.map((s,i)=>(i+1)+'. **'+s.name+':** '+s.description).join('\n'),
'## Основные результаты через 30 лет',table(main),
'## Те же стратегии в сырьевой структуре',table(resource),
'## Проверки','- '+report.totalGames+' игр; '+monthsChecked+' месячных переходов.\n- 80 игр с общими seed и шоками: 4 seed × 10 стратегий × 2 структуры. Сырьё −30% на месяцах 121–138; энергия +30% на месяцах 241–252.\n- 10 проверок чувствительности пяти коэффициентов на ±20%.\n- 4 игры по 50 лет.\n- 12 сравнений собственности: 3 профиля допущений × 4 пакета решений.\n- 3 крайних кризисных сценария.\n- '+replayChecks+' полных воспроизведений журнала совпали с конечными показателями.\n- Максимальная относительная погрешность балансов '+maxRelativeFinancialAudit.toExponential(3)+'.',
'## Проверка собственности','Пакеты меняют также управление/конкуренцию: **это не изолированная причинная оценка государственной против частной собственности**. Операции происходят в месяце 61. Покупка зависит от доступного финансирования, приватизация — от средств покупателей.',
'| Профиль | Пакет | ВВП / человек | Инфляция | Джини | Государственная доля активов |\n|---|---|---:|---:|---:|---:|\n'+ownershipGames.map(s=>'| '+s.modelProfile+' | '+s.scenario+' | '+f(s.gdpPerCapitaReal,0)+' | '+f(s.inflationYoY)+' | '+f(s.giniDisposable)+' | '+f(s.stateAssetShare)+' |').join('\n'),
'## Кризисы',table(crises),
'Дефолт считается по пропущенным платежам или экономическим потерям при вынужденном обмене. Новый неплатёж во время ограничения доступа относится к продолжающемуся кризису, а не автоматически к новому эпизоду. Число обменов хранится отдельно.',
'## Пятьдесят лет',table(longHorizon),
'## Институты: проверка альтернативных допущений','36 дополнительных игр: 6 пакетов × 3 гипотезы отдачи × 2 структуры, каждый по 30 лет. «Нулевая продуктивность программ» выключает накопление способности от расходов; «нулевая институциональная отдача» выключает эффекты управления/доступа на эффективность, наценки, договорный риск и банковскую маржу. При этом закупки продолжают создавать спрос и требовать финансирования. Это не модель Мизеса или Хайека и не эмпирическое доказательство преимуществ пакета.',
'| Гипотеза | Пакет | ВВП / человек | Инфляция | Долг / ВВП | Доступ к рынку, proxy | Исполнение договоров, proxy |\n|---|---|---:|---:|---:|---:|---:|\n'+institutionGames.filter(s=>!s.resourceMode).map(s=>'| '+s.assumption+' | '+s.id+' | '+f(s.gdpPerCapitaReal,0)+' | '+f(s.inflationYoY)+' | '+f(s.debtRatio)+' | '+f(s.marketContestability)+' | '+f(s.contractReliability)+' |').join('\n'),
'## Исправления, выявленные проверкой','1. Разделены банковские валютные риски, достаточность капитала и ликвидность; конверсия валютных активов в резервы не создаёт доход или ВВП.\n2. Ставка по депозитам зависит от доходности активов, стоимости фондирования и конкуренции. Сбережения реагируют на реальную доходность даже при малом кредитовании.\n3. Баланс ЦБ отделён от казначейства. Накопленный убыток уменьшает будущие перечисления, не списывается автоматически с кассы государства.\n4. Устранён независимый временной множитель частных инвестиций; планы реагируют на ожидаемые продажи и стоимость капитала.\n5. Перенос владения и размывание долей при новом капитале согласованы с платежами и дивидендами. Исправлена первоначальная ошибка размывания отечественных владельцев при рекапитализации.\n6. Проверка единиц обнаружила ошибку исходной нормы школьных расходов: 75 млн / 10 млн жителей = 7.5, а не 75 единиц на человека.\n7. Исправлены критерии дефолта: не любой высокий долг и не каждый месяц долгового кризиса — новый дефолт.\n8. Журнал воспроизводит решения, операции, допущения и одинаковые внешние события.',
'## Пределы интерпретации','Балансовое совпадение и тесты проверяют расчёты, не эмпирическую точность. Фиксированная политика не гарантирует рост или достижение цели инфляции. Джини не видит различий внутри 10 групп; ИЧР и ППС — модельные оценки. Логистический риск потери финансирования не оценён по наблюдаемой базе. Институциональные proxy не являются измерением концентрации: пять отраслевых агрегатов и один сводный банк не позволяют вычислять HHI. Прошлые сохранения остаются для анализа и не продолжаются по новым формулам 4.0. Проверка шаблонов и обработчиков UI не заменяет реальную браузерную проверку.',
'[Новые режимы, услуги и институты: длинные сценарии](EXTENDED-VALIDATION.md) · [Формулы](MODEL.md) · [Научный статус коэффициентов](PARAMETERS.md) · [Полный JSON](validation-results.json) · [Месячные ряды CSV](strategies-monthly.csv)'
].join('\n\n')+'\n';
await writeFile('docs/VALIDATION.md',md);
console.log(JSON.stringify({version:VERSION,totalGames:report.totalGames,monthsChecked,replayChecks,maxRelativeFinancialAudit,main:main.map(s=>({id:s.id,gdp:s.gdpPerCapitaReal,pi:s.inflationYoY,debt:s.debtRatio,gini:s.giniDisposable,hdi:s.hdi,defaults:s.defaults}))},null,2));

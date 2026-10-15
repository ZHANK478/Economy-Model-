import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createSimulation,advanceMonth,scheduleOwnership,scheduleShock,exportSimulation,importSimulation,replayJournal,executePolitical,accountBalances} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
import {validateOpenEconomy} from '../src/open-economy.js';
import {validateExtendedState} from '../src/state-validation.js';

const strategies=[
 {id:'baseline',policy:{monetaryRegime:'rule'}},
 {id:'tax-cut',policy:{monetaryRegime:'rule',vat:10,incomeTax:10,corporateTax:15,governmentConsumption:6}},
 {id:'public-investment',policy:{monetaryRegime:'rule',publicInvestment:6,infrastructureMaintenance:1.2,education:3,healthcare:3}},
 {id:'low-inflation',policy:{monetaryRegime:'rule',inflationTarget:3}},
 {id:'tariffs',policy:{monetaryRegime:'rule',tariff:20}},
 {id:'capital-controls',policy:{monetaryRegime:'rule',capitalControls:80}},
 {id:'private-services',policy:{monetaryRegime:'freeBanking',governmentConsumption:4,publicInvestment:0,healthcare:0,education:0,transfers:1,vat:10,corporateTax:15,registrationProcedures:1},ownership:'privatize'},
 {id:'public-ownership',policy:{monetaryRegime:'rule',publicInvestment:4,soeAuditBudget:.10,openProcurement:true},ownership:'recapitalize'},
 {id:'austerity',policy:{monetaryRegime:'rule',governmentConsumption:4,publicInvestment:1,transfers:1,education:1,healthcare:1}},
 {id:'fiscal-expansion',policy:{monetaryRegime:'rule',governmentConsumption:20,publicInvestment:8,transfers:12}}
];
const games=[],politicalGames=[];let monthsChecked=0,maxRelativeAudit=0,imports=0,replays=0;
const collect=s=>Object.fromEntries(['gdpPerCapitaReal','gdpGrowthYoY','inflationYoY','unemployment','debtRatio','population','totalFertilityRate','lifeExpectancy','giniDisposable','worldGrowth','greenfieldUSD','portfolioEquityUSD','capitalPerWorker'].map(k=>[k,s.metrics[k]]));
const check=s=>{
 monthsChecked++;const scale=Math.max(1,Math.abs(s.metrics.nominalGDPAnnual),Math.abs(accountBalances(s).bankAssets));
 for(const [key,v] of Object.entries(s.lastReport.audit)){assert.ok(Number.isFinite(v),key);maxRelativeAudit=Math.max(maxRelativeAudit,Math.abs(v)/scale);assert.ok(Math.abs(v)<Math.max(1e-4,scale*1e-9),key+': '+v);}
 assert.ok(s.population>0&&s.metrics.realGDPMonthly>0);
 assert.ok(Object.values(s.metrics).every(v=>typeof v!=='number'||Number.isFinite(v)));
 assert.ok([...s.firms,...s.households].every(a=>a.cash>=0&&a.loanLC>=0&&a.loanFX>=0));
 validateExtendedState(s);validateOpenEconomy(s);
};
function verifySave(s,replay=false){
 const saved=importSimulation(exportSimulation(s));imports++;assert.deepEqual(saved.metrics,s.metrics);
 if(replay){const result=replayJournal(saved);replays++;assert.deepEqual(result.metrics,s.metrics);assert.deepEqual(result.firms,s.firms);assert.deepEqual(result.economy,s.economy);}
}
function laboratory(country,resource,strategy,economicParameters={}){
 const options=newGameOptions({country,resource});
 let s=createSimulation({...options,politicalMode:false,policy:strategy.policy,economicParameters});
 if(strategy.ownership)for(let sector=0;sector<5;sector++)scheduleOwnership(s,{sector,kind:strategy.ownership,points:25});
 scheduleShock(s,{key:'energyPrice',multiplier:1.5,start:97,duration:12});
 scheduleShock(s,{key:'foreignDemand',multiplier:.8,start:193,duration:12});
 const start=collect(s),annual=[];let minGDP=s.metrics.realGDPMonthly,maxInflation=-Infinity,greenfield=0;
 for(let i=0;i<360;i++){
  try{s=advanceMonth(s);check(s);}catch(error){throw new Error(`${country}/${resource}/${strategy.id}/${JSON.stringify(economicParameters)}/month ${s.month+1}: ${error.message}`,{cause:error});}minGDP=Math.min(minGDP,s.metrics.realGDPMonthly);maxInflation=Math.max(maxInflation,s.metrics.inflationYoY);greenfield+=s.metrics.greenfieldUSD;
  if(s.month%60===0)annual.push({month:s.month,...collect(s)});
 }
 verifySave(s,strategy.id==='baseline'||Object.keys(economicParameters).length>0);
 return {country,resource,strategy:strategy.id,economicParameters,start,end:collect(s),minGDP,maxInflation,greenfieldCumulativeUSD:greenfield,defaults:s.government.defaults,annual};
}
for(const country of ['poor','middle','rich'])for(const resource of [false,true]){
 for(const strategy of strategies)games.push(laboratory(country,resource,strategy));
 console.log(JSON.stringify({completed:games.length,country,resource,monthsChecked}));
}
const sensitivities=[];
for(const country of ['poor','middle','rich'])for(const [key,values] of Object.entries({capitalShare:[.25,.45],tradeSigma:[2,5],adoptionEfficiency:[0,.60],inflationInertia:[0,.5],priceAdjustment:[.04,.16],migrationIncomeResponse:[.00075,.003]}))for(const value of values){
 sensitivities.push(laboratory(country,false,strategies[0],{[key]:value}));
}
for(const country of ['poor','middle','rich'])for(const government of ['presidential','parliamentary','mixedPresident']){
 let s=createSimulation(newGameOptions({country,government,resource:false}));
 for(let i=0;i<360&&s.politics.executive.inOffice;i++){
  for(const bill of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:bill.id,decision:'accept'});
  s=advanceMonth(s);check(s);
 }
 verifySave(s,true);politicalGames.push({country,government,months:s.month,inOffice:s.politics.executive.inOffice,end:collect(s)});
}
const report={model:'open-economy-1',date:'2026-10-15',monthsPerLaboratoryGame:360,games:games.length,sensitivities:sensitivities.length,politicalGames:politicalGames.length,monthsChecked,maxRelativeAudit,importChecks:imports,replayChecks:replays,strategies,results:games,sensitivityResults:sensitivities,politicalResults:politicalGames};
await writeFile('docs/open-economy-validation.json',JSON.stringify(report,null,2)+'\n');
const number=x=>x.toFixed(1),table=games.filter(g=>g.strategy==='baseline').map(g=>`| ${g.country} | ${g.resource?'сырьё':'диверсификация'} | ${number(g.end.gdpPerCapitaReal)} | ${number(g.end.population)} | ${number(g.end.inflationYoY)} | ${number(g.end.unemployment)} | ${g.defaults} |`).join('\n');
await writeFile('docs/OPEN-ECONOMY-VALIDATION.md',`# Проверка открытой экономики, 15.10.2026\n\n60 лабораторных партий: 3 исходных профиля × 2 структуры экспорта × 10 стратегий, каждая по 360 месяцев. Ещё ${sensitivities.length} партий по30лет с отдельными изменениями доли капитала, торговой эластичности, освоения технологий, ценообразования и миграции. Дополнительно 9 политических партий до 30 лет или действительного окончания правления. Во всех лабораторных партиях одинаковые шоки: энергия +50% на 97–108 месяцах, внешний спрос −20% на 193–204 месяцах.\n\nПроверено ${monthsChecked} переходов, ${imports} импортов сохранений, ${replays} полных воспроизведений. Максимальная относительная погрешность учёта ${maxRelativeAudit.toExponential(3)}. Проверены банк, центральный банк, казначейство, государственный долг, внешний баланс, товары, ВВП и население; доли собственности и физические/институциональные запасы.\n\n| Старт | Экспорт | ВВП/человек через 30 лет | Население, млн | Инфляция, % | Безработица, % | Эпизоды дефолта |\n|---|---|---:|---:|---:|---:|---:|\n${table}\n\nЭта таблица показывает результаты выбранных условий, а не прогноз стран-прототипов. Уровень ВВП масштабирован, часть исходных запасов синтетическая, внешние регионы упрощены. Сравнение многокомпонентных пакетов не идентифицирует причинный эффект отдельного решения. Проверки учёта и сценариев не являются эмпирической проверкой модели на независимой исторической выборке.\n\nПри исправлениях устранены смешение текущей занятости с потенциальной мощностью, применение кредитной ставки ко всему капиталу, принудительное включение всего простаивающего капитала в текущие цены вместо предельных переменных издержек и дублирование денежных поступлений при учёте реинвестированной иностранной прибыли. Исправлены ставки на просроченные купоны: сохраняются договорные условия, риск-премия новых займов не переносится на старый долг. Модель отбрасывает недопустимые числа до записи месяца. Старые сохранения остаются на прежней ветви уравнений.\n\n[Полный воспроизводимый результат](open-economy-validation.json) · [Формулы, данные и ограничения](OPEN-ECONOMY.md).\n`);
console.log(JSON.stringify({games:games.length,sensitivities:sensitivities.length,politicalGames:politicalGames.length,monthsChecked,maxRelativeAudit,imports,replays}));

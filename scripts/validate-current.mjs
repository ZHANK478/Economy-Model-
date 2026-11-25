// Current-release checks. Historical reports remain snapshots of their own runs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createSimulation,advanceMonth,simulationEnvelope,importSimulationData,replayJournal,scheduleShock} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {validateExtendedState} from '../src/state-validation.js';
import {validateOpenEconomy} from '../src/open-economy.js';
import {executePolitical} from '../src/political-system.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
import {saveFile,readSaveFile,autosaveText} from '../src/save-files.js';
const hash=createHash('sha256');for(const f of (await readdir('src')).filter(f=>f.endsWith('.js')&&f!=='calculation-build.js').sort()){hash.update(f+'\0');hash.update(await readFile('src/'+f));hash.update('\0');}
const sourceSHA256=hash.digest('hex'),results=[];let monthsChecked=0,roundTrips=0,replays=0,continuations=0,maxRelativeAudit=0,benchmark;
const metrics=s=>Object.fromEntries(['gdpPerCapitaReal','unemployment','inflationYoY','debtRatio','defaultEpisodes'].map(k=>[k,s.metrics[k]??0]));
const check=s=>{monthsChecked++;validateExtendedState(s);validateOpenEconomy(s);for(const [key,value] of Object.entries(s.lastReport.audit)){assert.ok(Number.isFinite(value));const error=Math.abs(value)/Math.max(1,s.metrics.nominalGDPAnnual);maxRelativeAudit=Math.max(maxRelativeAudit,error);assert.ok(error<1e-8,`${s.month} ${key}: ${value}; relative ${error}`);}assert.ok(s.metrics.realGDPMonthly>0,`${s.month}: zero GDP`);};
async function verify(s){
 const payload=simulationEnvelope(s);
 for(const compressed of [false,true]){
  const packed=await saveFile(payload,{compressed}),loaded=importSimulationData(await readSaveFile(packed.blob));roundTrips++;assert.equal(JSON.stringify(loaded),JSON.stringify(s));
  assert.equal(JSON.stringify(advanceMonth(loaded)),JSON.stringify(advanceMonth(s)));continuations++;
 }
 const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.firms,s.firms);replays++;
}
for(const country of ['poor','middle','rich'])for(const resource of [false,true]){
 const o=newGameOptions({country,resource});o.politicalOptions.nameSeed=42;
 let s=createSimulation({...o,politicalMode:false,defenseMode:false});const annual=[];
 // Explicit adverse episodes, identical across starts; initial policy stays fixed.
 scheduleShock(s,{key:'energyPrice',multiplier:1.5,start:97,duration:12});
 scheduleShock(s,{key:'foreignDemand',multiplier:.8,start:193,duration:12});
 for(let i=0;i<360;i++){s=advanceMonth(s);check(s);if(s.month%60===0)annual.push({month:s.month,...metrics(s)});if(country==='middle'&&!resource&&s.month===180){
  const payload=simulationEnvelope(s),pretty=JSON.stringify(payload,null,2),compact=await saveFile(payload),gzip=await saveFile(payload,{compressed:true});
  const oldAuto=JSON.stringify({simulation:JSON.stringify({format:'economy-model',version:s.version,state:s}),draft:s.policy,newspaper:{}});
  benchmark={month:180,prettyJSONBytes:Buffer.byteLength(pretty),compactJSONBytes:compact.blob.size,gzipBytes:gzip.blob.size,oldAutosaveBytes:Buffer.byteLength(oldAuto),newAutosaveBytes:Buffer.byteLength(autosaveText(s,s.policy,{},s.version)),note:'File sizes, not phone speed measurements; no records removed.'};
 }}
 await verify(s);results.push({scope:'laboratory',country,resource,revision:s.economy.revision,months:s.month,annual,end:metrics(s)});console.log(`Checked ${country}/${resource?'resource':'diversified'}: ${s.month} months`);
}
for(const government of ['presidential','parliamentary','personalist']){
 const o=newGameOptions({government});o.politicalOptions.nameSeed=42;let s=createSimulation(o);
 for(let i=0;i<60&&s.politics.executive.inOffice&&!s.defense.sovereigntyLost;i++){
  for(const bill of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:bill.id,decision:'accept'});
  s=advanceMonth(s);check(s);
 }
 await verify(s);results.push({scope:'political-with-defense',government,revision:s.economy.revision,months:s.month,inOffice:s.politics.executive.inOffice,end:metrics(s)});
}
const report={schema:1,date:new Date().toISOString(),sourceSHA256,node:process.version,economicRevision:newGameOptions().economicRevision,monthsChecked,roundTrips,continuations,replays,maxRelativeAudit,benchmark,results,limitations:['Accounting, persistence and replay checks do not establish empirical realism.','Six 30-year laboratory runs use fixed initial policy, no political or defense systems, and two scheduled shocks.','Three political runs accept party initiatives and include defense; they stop on loss of office or after 60 months.','Historical reports have different equations, scenarios and monetary policy; do not compare them as identical experiments.']};
await writeFile('docs/current-validation.json',JSON.stringify(report,null,2)+'\n');
const n=x=>x.toLocaleString('ru-RU',{maximumFractionDigits:1});
const rows=results.map(r=>`| ${r.country??r.government} | ${r.scope==='laboratory'?(r.resource?'сырьё':'диверсификация'):'политика + армия'} | ${r.months} | ${n(r.end.gdpPerCapitaReal)} | ${n(r.end.unemployment)} | ${n(r.end.inflationYoY)} | ${r.end.defaultEpisodes} |`).join('\n');
await writeFile('docs/CURRENT-VALIDATION.md',`# Проверка текущей версии\n\nДата: ${report.date}. Экономическая ревизия **${report.economicRevision}**.\nОтпечаток исходников: \`${sourceSHA256}\`.\n\nПроверено ${monthsChecked} месячных состояний, ${roundTrips} загрузок JSON/gzip без потери данных, ${continuations} точных продолжений и ${replays} воспроизведений истории. Максимальная относительная невязка учёта: ${maxRelativeAudit.toExponential(3)}.\n\n| Старт | Условия | Месяцев | Реальный ВВП / человек | Безработица, % | Инфляция, % | Дефолты |\n|---|---|---:|---:|---:|---:|---:|\n${rows}\n\n## Что проверено\n\nШесть лабораторных партий по 30 лет: исходная политика постоянна, политика и армия отключены. Энергия +50% на месяцах 97–108; внешний спрос −20% на 193–204. Три политические партии: инициативы принимаются, армия включена; горизонт — 60 месяцев или утрата власти. Проверяются финансовые тождества, физические состояния, сохранение всей партии, следующий месяц после загрузки и воспроизведение.\n\nНеблагоприятные экономические результаты сохраняются в отчёте и не считаются автоматически ошибкой вычислений. Эти проверки **не подтверждают реалистичность поведения экономики**. Старые отчёты относятся к своим уравнениям и условиям; они не описывают текущую версию.\n\n## Размер сохранения\n\nПример: средняя диверсифицированная страна, 180 месяцев, полный файл движка. Обычный JSON с отступами: ${n(benchmark.prettyJSONBytes/1048576)} МиБ; компактный JSON: ${n(benchmark.compactJSONBytes/1048576)} МиБ; gzip: ${n(benchmark.gzipBytes/1048576)} МиБ. Полная история и диагностика сохранены. Контрольные точки и наблюдения интерфейса в пользовательском файле могут увеличить размер. Размер файла не является измерением скорости на телефоне.\n\nАвтосохранение использует один проход JSON вместо вложенного строкового сохранения; старые записи читаются.\n\nВоспроизведение проверки: \`npm run validate:current\`. Машиночитаемый результат: [current-validation.json](current-validation.json).\n`);
console.log(JSON.stringify({monthsChecked,roundTrips,continuations,replays,maxRelativeAudit,benchmark}));

// Reproducibility and accounting checks, NOT a fit to real regime durations.
import assert from 'node:assert/strict';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSimulation,advanceMonth,replayJournal,simulationEnvelope,importSimulationData} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {validateRegimeDynamics,regimeAction} from '../src/regime-dynamics.js';
import {validateExtendedState} from '../src/state-validation.js';
import {validateOpenEconomy} from '../src/open-economy.js';
import {saveFile,readSaveFile} from '../src/save-files.js';
const hash=createHash('sha256');for(const f of (await readdir('src')).filter(f=>f.endsWith('.js')&&f!=='calculation-build.js').sort()){hash.update(f+'\0');hash.update(await readFile('src/'+f));hash.update('\0');}
const sourceSHA256=hash.digest('hex');
const results=[];let months=0,maxRelativeAudit=0,roundTrips=0,replays=0;
for(const type of ['personalist','party','military','hybrid'])for(const seed of [7,42,219]){
 const o=newGameOptions({government:type,resource:false});o.seed=seed;o.politicalOptions.nameSeed=seed;o.politicalOptions.livingWorld=false;
 let s=createSimulation({...o,defenseMode:false});
 const first=s.metrics.gdpPerCapitaReal,annual=[];
 for(let i=0;i<180&&s.politics.executive.inOffice;i++){
  // Hold enacted policy fixed. Ignored party proposals remain in the record.
  s=advanceMonth(s);months++;validateRegimeDynamics(s);validateExtendedState(s);validateOpenEconomy(s);
  for(const value of Object.values(s.lastReport.audit)){const relative=Math.abs(value)/Math.max(1,s.metrics.nominalGDPAnnual);maxRelativeAudit=Math.max(maxRelativeAudit,relative);assert.ok(relative<1e-8);}
  if(s.month%12===0)annual.push({month:s.month,gdpPerCapita:s.metrics.gdpPerCapitaReal,investment:s.metrics.privateInvestment,personalControl:s.metrics.personalControl,eliteCohesion:s.metrics.eliteCohesion,successionReadiness:s.metrics.successionReadiness,nationalMobilization:s.metrics.nationalMobilization,leaderChanges:s.politics.regimeDynamics.leader.generation});
 }
 for(const compressed of [false,true]){const f=await saveFile(simulationEnvelope(s),{compressed});const loaded=importSimulationData(await readSaveFile(f.blob));assert.equal(JSON.stringify(loaded),JSON.stringify(s));assert.equal(JSON.stringify(advanceMonth(loaded)),JSON.stringify(advanceMonth(s)));roundTrips++;}
 const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.politics.regimeDynamics,s.politics.regimeDynamics);replays++;
 const r=s.politics.regimeDynamics;
 results.push({type,seed,months:s.month,initialGDPPerCapita:first,finalGDPPerCapita:s.metrics.gdpPerCapitaReal,growthPercent:(s.metrics.gdpPerCapitaReal/first-1)*100,inOffice:s.politics.executive.inOffice,reason:s.politics.executive.reason,leaderChanges:r.leader.generation,regimeEnded:r.regimeEnded,finalType:r.effectiveType,annual});
 console.log(`Checked ${type}/${seed}: ${s.month} months, office=${s.politics.executive.inOffice}`);
}
const report={schema:1,date:new Date().toISOString(),sourceSHA256,months,roundTrips,replays,maxRelativeAudit,results,limitations:['Fictional scenarios and model assumptions, not observed-country counterfactuals.','Three seeds do not identify empirical death, coup, protest or democratization rates.','Same diversified middle-income reference; fixed enacted policy, external shocks/defense disabled. Political support and endogenous events are retained.','Runs stop on loss of office. Censored runs must not be read as regime-duration estimates.','GDP differences are endogenous model outcomes, not empirical causal estimates or evidence that one preset is superior.']};
await writeFile('docs/regime-validation.json',JSON.stringify(report,null,2)+'\n');
const rows=results.map(x=>`| ${x.type} | ${x.seed} | ${x.months} | ${x.growthPercent.toFixed(1)} | ${x.leaderChanges} | ${x.inOffice?'продолжает':x.reason} |`).join('\n');
await writeFile('docs/REGIME-VALIDATION.md',`# Проверка институтов власти\n\n${report.date}. Отпечаток исходников: \`${sourceSHA256}\`.\n\nПроверено ${months} месячных состояний, ${roundTrips} сохранений JSON/gzip и ${replays} точных воспроизведений. Максимальная относительная невязка финансового учёта: ${maxRelativeAudit.toExponential(3)}.\n\nОдинаковая диверсифицированная экономика среднего достатка. Законно действующая политика сохраняется, инициативы остаются без ответа. Армия и внешний событийный мир отключены; политическая обратная связь работает. Горизонт — 180 месяцев либо потеря должности.\n\n| Старт | Seed | Месяцев | Изменение реального ВВП/чел., % | Смен руководства | Исход игрока |\n|---|---:|---:|---:|---:|---|\n${rows}\n\nЭто проверка вычислений и различимости механизмов. Различия результата нельзя считать установленными наукой эффектами типа режима. Три seed не калибруют частоту исторических событий; прерванные партии не являются оценками средней жизни режимов. Полная траектория: [regime-validation.json](regime-validation.json).\n`);
console.log(JSON.stringify({months,roundTrips,replays,maxRelativeAudit}));

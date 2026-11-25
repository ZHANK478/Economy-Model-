// A/B against an untouched checkout: node scripts/verify-optimization.mjs BASELINE_PATH
// No numeric tolerance: full serialized states must match byte for byte.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import * as current from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
const baselinePath=resolve(process.argv[2]);
const baseline=await import(pathToFileURL(resolve(baselinePath,'src/engine.js')));
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const sourceHash=async root=>{const hash=createHash('sha256');for(const f of (await readdir(resolve(root,'src'))).filter(f=>f.endsWith('.js')&&f!=='calculation-build.js').sort()){hash.update(f+'\0');hash.update(await readFile(resolve(root,'src',f)));hash.update('\0');}return hash.digest('hex');};
const results=[];let transitions=0,roundTrips=0,continuations=0,replays=0;
const cases=[];
for(const country of ['poor','middle','rich'])for(const resource of [false,true])cases.push({country,resource,political:false,months:180});
for(const government of ['presidential','parliamentary','personalist','party','military','hybrid'])cases.push({country:'middle',government,political:true,months:60});
for(const revision of [1,9,17,20,21])cases.push({country:'middle',political:false,revision,months:24});
for(const scenario of cases){
 const o=newGameOptions(scenario);o.politicalOptions.nameSeed=42;
 const options={...o,politicalMode:scenario.political,defenseMode:scenario.political,...(scenario.revision?{economicRevision:scenario.revision}:{})};
 let a=baseline.createSimulation(options),b=current.createSimulation(options);
 for(const engineState of [a,b]){current.scheduleShock(engineState,{key:'weather',multiplier:.8,start:10,duration:6});current.scheduleShock(engineState,{key:'importAvailability',multiplier:.7,start:20,duration:8});}
 assert.equal(digest(a),digest(b),'initial state');
 const checks=[];
 for(let i=0;i<scenario.months;i++){
  if(a.defense?.sovereigntyLost||a.politics.enabled&&!a.politics.executive.inOffice)break;
  if(scenario.political)for(const engineState of [a,b])for(const bill of unresolvedInitiatives(engineState))current.executePolitical(engineState,{kind:'decideBill',billId:bill.id,decision:'accept'});
  const patch=i===12?{...a.policy,rate:12,monetaryRegime:'discretion'}:a.policy;
  a=baseline.advanceMonth(a,patch,{preserveEconomicRevision:!!scenario.revision});b=current.advanceMonth(b,patch,{preserveEconomicRevision:!!scenario.revision});
  transitions++;assert.equal(digest(a.metrics),digest(b.metrics),`metrics at ${b.month}`);checks.push(digest(b.metrics));
  if(i%30===0||i===scenario.months-1)assert.equal(digest(a),digest(b),`full state at ${b.month}`);
 }
 const stateHash=digest(b);assert.equal(digest(a),stateHash);
 const oldJSON=baseline.exportSimulation(a),newJSON=current.exportSimulation(b);assert.equal(oldJSON,newJSON,'complete exported diagnostics');
 const restored=current.importSimulation(oldJSON);assert.equal(digest(restored),stateHash);roundTrips++;
 assert.equal(digest(baseline.advanceMonth(a)),digest(current.advanceMonth(restored)));continuations++;
 const replay=current.replayJournal(b);assert.deepEqual(replay.metrics,b.metrics);assert.deepEqual(replay.firms,b.firms);assert.deepEqual(replay.bank,b.bank);assert.deepEqual(replay.households,b.households);replays++;
 results.push({...scenario,actualMonths:b.month,stateHash,exportBytes:Buffer.byteLength(newJSON),monthlyMetricHashes:checks});
 console.log(`Exact: ${scenario.government??scenario.country}/${scenario.revision??scenario.resource}: ${b.month} months`);
}
const report={baselineSourceSHA256:await sourceHash(baselinePath),sourceSHA256:await sourceHash('.'),transitions,roundTrips,continuations,replays,comparison:'Exact JSON state/export equality; no numeric tolerances. Economic revision unchanged.',results};
await writeFile('docs/optimization-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({transitions,roundTrips,continuations,replays}));

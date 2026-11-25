// Run after other checks finish: node scripts/benchmark-optimization.mjs BASELINE_PATH
// Fresh processes alternate baseline/current; no profiling or validation runs concurrently.
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
if(process.argv[2]==='--worker'){
 const root=resolve(process.argv[3]);
 const engine=await import(pathToFileURL(resolve(root,'src/engine.js')));
 const {newGameOptions}=await import(pathToFileURL(resolve(root,'src/start-presets.js')));
 const rows=[];
 for(const country of ['poor','middle','rich']){
  const o=newGameOptions({country,resource:false});o.politicalOptions.nameSeed=42;
  let s=engine.createSimulation({...o,politicalMode:false,defenseMode:false});
  engine.scheduleShock(s,{key:'weather',multiplier:.8,start:30,duration:12});
  engine.scheduleShock(s,{key:'importAvailability',multiplier:.8,start:70,duration:10});
  const times=[];for(let i=0;i<180;i++){const start=performance.now();s=engine.advanceMonth(s);times.push(performance.now()-start);}
  const hash=createHash('sha256').update(JSON.stringify(s)).digest('hex'),start=performance.now(),exported=engine.exportSimulation(s),exportMs=performance.now()-start;
  const t1=performance.now();engine.importSimulation(exported);const importMs=performance.now()-t1;
  const sorted=[...times].sort((a,b)=>a-b);
  rows.push({country,months:s.month,totalMs:times.reduce((a,b)=>a+b,0),medianTurnMs:sorted[90],p95TurnMs:sorted[171],maxTurnMs:sorted.at(-1),exportMs,importMs,exportBytes:Buffer.byteLength(exported),stateHash:hash});
 }
 console.log(JSON.stringify(rows));
}else{
 const baseline=resolve(process.argv[2]),script=fileURLToPath(import.meta.url),runs=[];
 for(const [trial,order] of [[1,['baseline','current']],[2,['current','baseline']]])for(const kind of order){
  const child=spawnSync(process.execPath,[script,'--worker',kind==='baseline'?baseline:resolve('.')],{encoding:'utf8',maxBuffer:1024*1024});
  assert.equal(child.status,0,child.stderr);runs.push({trial,kind,rows:JSON.parse(child.stdout)});console.log(`Finished ${kind}, trial ${trial}`);
 }
 const summary=['poor','middle','rich'].map(country=>{
  const values=kind=>runs.filter(r=>r.kind===kind).map(r=>r.rows.find(x=>x.country===country));
  const before=values('baseline'),after=values('current');
  for(const row of [...before,...after]){assert.equal(row.stateHash,before[0].stateHash);assert.equal(row.exportBytes,before[0].exportBytes);assert.equal(row.months,180);}
  const mean=rows=>rows.reduce((v,r)=>v+r.totalMs,0)/rows.length,beforeMs=mean(before),afterMs=mean(after);
  return {country,beforeMs,afterMs,reductionPercent:100*(1-afterMs/beforeMs),speedup:beforeMs/afterMs,stateHash:before[0].stateHash,exportBytes:before[0].exportBytes};
 });
 const report={environment:{node:process.version,platform:process.platform,arch:process.arch},method:'Two isolated runs per version, alternating order; 180 monthly turns per country, identical seed/shocks, politics/defense off. Hashing/export/import outside the turn timer. Server Node measurements, not phone/browser latency or memory measurements.',summary,runs};
 writeFileSync('docs/optimization-benchmark.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
}

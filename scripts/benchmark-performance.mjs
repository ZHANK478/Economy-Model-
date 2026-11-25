// Usage: node scripts/benchmark-performance.mjs OUTPUT.json [SOURCE_DIRECTORY]
// Retains all monthly metric hashes and a full-state hash for exact A/B checks.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const source=resolve(process.argv[3]??'.');
const {createSimulation,advanceMonth,scheduleShock,exportSimulation,importSimulation}=await import(pathToFileURL(resolve(source,'src/engine.js')));
const {newGameOptions}=await import(pathToFileURL(resolve(source,'src/start-presets.js')));
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const results=[];
for(const country of ['poor','middle','rich']){
 let s=createSimulation({...newGameOptions({country,resource:false}),politicalMode:false,seed:42});
 scheduleShock(s,{key:'weather',multiplier:.8,start:30,duration:12});scheduleShock(s,{key:'importAvailability',multiplier:.8,start:70,duration:10});
 const begin=performance.now(),checks=[];for(let i=0;i<180;i++){s=advanceMonth(s);checks.push(digest(s.metrics));}
 const runtime=performance.now()-begin,t0=performance.now(),exported=exportSimulation(s),exportMs=performance.now()-t0,t1=performance.now();importSimulation(exported);const importMs=performance.now()-t1;
 results.push({country,months:s.month,ms:runtime,exportMs,importMs,bytes:Buffer.byteLength(exported),stateHash:digest(s),checks});
}
console.log(JSON.stringify(results.map(({checks,...r})=>r)));writeFileSync(process.argv[2],JSON.stringify(results));

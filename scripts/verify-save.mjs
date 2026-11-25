import {readFile} from 'node:fs/promises';
import {importSimulationData,replayJournal} from '../src/engine.js';
import {readSaveFile} from '../src/save-files.js';
if(!process.argv[2])throw new Error('Usage: node scripts/verify-save.mjs SAVE.json[.gz]');
const file=await readSaveFile(new Blob([await readFile(process.argv[2])])),state=importSimulationData(file);
const replay=replayJournal(state),differences=[];
for(let i=0;i<state.journal.length;i++)for(const [key,value]of Object.entries(state.journal[i].outcome))if(typeof value==='number'){
 const actual=replay.journal[i]?.outcome[key],relative=Math.abs(actual-value)/Math.max(1,Math.abs(value));
 if(!Number.isFinite(actual)||relative>1e-8)differences.push({month:i+1,key,saved:value,replayed:actual,relative});
}
for(const [key,value] of Object.entries(state.metrics))if(typeof value==='number'){const actual=replay.metrics[key],relative=Math.abs(actual-value)/Math.max(1,Math.abs(value));if(!Number.isFinite(actual)||relative>1e-8)differences.push({month:state.month,key,saved:value,replayed:actual,relative,scope:'final-metrics'});}
const warnings=state.journal.flatMap(e=>(e.calculationTrace?.warnings??[]).map(w=>({month:e.month,...w})));
console.log(JSON.stringify({schema:2,month:state.month,economicRevision:state.economy?.revision??null,replay:{passed:differences.length===0,firstDifference:differences[0]??null,totalDifferences:differences.length},coverage:file.calculationDiagnostics?.coverage??null,economicAlerts:warnings,scientificCertification:false},null,2));
if(differences.length)process.exitCode=1;

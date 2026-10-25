import {readFile} from 'node:fs/promises';
import {importSimulation,replayJournal} from '../src/engine.js';
if(!process.argv[2])throw new Error('Usage: node scripts/verify-save.mjs SAVE.json');
const file=JSON.parse(await readFile(process.argv[2],'utf8')),state=importSimulation(JSON.stringify(file));
const replay=replayJournal(state),differences=[];
for(let i=0;i<state.journal.length;i++)for(const [key,value]of Object.entries(state.journal[i].outcome))if(typeof value==='number'){
 const actual=replay.journal[i]?.outcome[key],relative=Math.abs(actual-value)/Math.max(1,Math.abs(value));
 if(!Number.isFinite(actual)||relative>1e-8)differences.push({month:i+1,key,saved:value,replayed:actual,relative});
}
const warnings=state.journal.flatMap(e=>(e.calculationTrace?.warnings??[]).map(w=>({month:e.month,...w})));
console.log(JSON.stringify({schema:1,month:state.month,replay:{passed:differences.length===0,firstDifference:differences[0]??null,totalDifferences:differences.length},coverage:file.calculationDiagnostics?.coverage??null,economicAlerts:warnings,scientificCertification:false},null,2));
if(differences.length)process.exitCode=1;

import test from 'node:test';
import assert from 'node:assert/strict';
import {autosaveText,autosaveEnvelope,saveFile,readSaveFile} from '../src/save-files.js';
import {createSimulation,advanceMonth,importSimulationData,simulationEnvelope,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
const game=()=>{const o=newGameOptions();o.politicalOptions.nameSeed=42;return createSimulation({...o,politicalMode:false,defenseMode:false});};
test('legacy and single-pass autosaves preserve state, draft and news',()=>{
 const s=game(),draft={...s.policy,rate:7},news={version:1,pending:true};
 const current=JSON.parse(autosaveText(s,draft,news,s.version));
 const legacy={...current,simulation:JSON.stringify(current.simulation)};
 assert.deepEqual(importSimulationData(autosaveEnvelope(current)),importSimulationData(autosaveEnvelope(legacy)));
 assert.deepEqual(current.draft,draft);assert.deepEqual(current.newspaper,news);
});
test('JSON and gzip preserve all records, continuation and exact replay',async()=>{
 let s=game();for(let i=0;i<24;i++)s=advanceMonth(s);
 const payload={...simulationEnvelope(s),draftPolicy:{...s.policy,rate:7},newspaper:{version:1},checkpoint:simulationEnvelope(game()),uiObservation:{events:[{kind:'export'}]}};
 const json=await saveFile(payload),gzip=await saveFile(payload,{compressed:true});
 assert.ok(gzip.blob.size<json.blob.size/3);
 for(const file of [json,gzip]){
  const data=await readSaveFile(file.blob);assert.deepEqual(data,JSON.parse(JSON.stringify(payload)));
  const loaded=importSimulationData(data);assert.equal(JSON.stringify(loaded),JSON.stringify(s));
  assert.equal(JSON.stringify(advanceMonth(loaded)),JSON.stringify(advanceMonth(s)));assert.deepEqual(replayJournal(loaded).metrics,s.metrics);
 }
});
test('invalid, truncated and oversized expanded files are rejected; economic validation remains mandatory',async()=>{
 await assert.rejects(readSaveFile(new Blob(['broken'])),SyntaxError);
 const packed=await saveFile({message:'x'.repeat(30000)},{compressed:true});
 await assert.rejects(readSaveFile(packed.blob,{maxBytes:1024}),/распаковки/);
 await assert.rejects(readSaveFile(packed.blob.slice(0,20)));
 const data=simulationEnvelope(game());data.state.government.cash=-1;
 const file=await saveFile(data,{compressed:true});
 const decoded=await readSaveFile(file.blob);assert.throws(()=>importSimulationData(decoded));
});

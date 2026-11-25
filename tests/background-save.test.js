import test from 'node:test';import assert from 'node:assert/strict';
import {createAutosaveQueue} from '../src/autosave-queue.js';
import {createJournalStorage} from '../src/journal-storage.js';
import {autosaveSnapshot,autosaveText,autosaveEnvelope} from '../src/save-files.js';
import {createSimulation,advanceMonth,runMonths,importSimulationData,replayJournal} from '../src/engine.js';import {newGameOptions} from '../src/start-presets.js';
const start=()=>createSimulation({...newGameOptions({country:'poor',resource:false}),politicalMode:false,defenseMode:false});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function disk(){const records=new Map(),writes=[];let fail=null;const options={read:async key=>records.get(key)??null,put:async(key,value)=>{if(fail?.(key,value))throw Error('disk full');records.set(key,value);writes.push(key);},remove:async key=>records.delete(key),available:async()=>true,pause:async()=>{}};return {records,writes,options,store:createJournalStorage(options),fail:fn=>fail=fn};}
const capture=s=>autosaveSnapshot(s,s.policy,{version:1},s.version);
test('live capture excludes journal serialization and detaches mutable decisions',()=>{
 const s=advanceMonth(start()),snapshot=capture(s),before=JSON.parse(snapshot.liveText);s.policy.incomeTax=33;s.pendingNote='later';s.journal.push({month:99});assert.equal(snapshot.journal.length,1);assert.deepEqual(JSON.parse(snapshot.liveText),before);assert.deepEqual(before.simulation.state.journal,[]);
});
test('journal saves append one new month instead of rewriting the previous archive',async()=>{
 const d=disk();let s=start();for(let i=0;i<4;i++)s=advanceMonth(s);await d.store.setSnapshot('save',capture(s));const initial=d.writes.length;
 s=advanceMonth(s);await d.store.setSnapshot('save',capture(s));assert.equal(d.writes.length-initial,2);const wrapper=await d.store.getSnapshot('save'),loaded=importSimulationData(autosaveEnvelope(wrapper));assert.deepEqual(loaded.journal,s.journal);assert.deepEqual(loaded.metrics,s.metrics);assert.deepEqual(advanceMonth(loaded).metrics,advanceMonth(s).metrics);assert.deepEqual(replayJournal(loaded).metrics,s.metrics);
});
test('after reload, adopting the validated journal preserves incremental writes',async()=>{
 const d=disk();let s=runMonths(start(),3);await d.store.setSnapshot('save',capture(s));const reloaded=createJournalStorage(d.options),wrapper=await reloaded.getSnapshot('save');s=importSimulationData(autosaveEnvelope(wrapper));reloaded.adoptJournal('save',s.journal);const count=d.writes.length;s=advanceMonth(s);await reloaded.setSnapshot('save',capture(s));assert.equal(d.writes.length-count,2);
});
test('an interrupted staged write cannot publish an incomplete journal or destroy the old save',async()=>{
 const d=disk();let s=runMonths(start(),2);await d.store.setSnapshot('save',capture(s));const old=structuredClone(d.records.get('save'));s=runMonths(s,2);d.fail((key,value)=>key==='save');await assert.rejects(d.store.setSnapshot('save',capture(s)),/disk full/);assert.deepEqual(d.records.get('save'),old);assert.equal((await d.store.getSnapshot('save')).simulation.state.month,2);d.fail(null);await d.store.setSnapshot('save',capture(s));assert.equal((await d.store.getSnapshot('save')).simulation.state.month,4);
});
test('imported or restored shorter histories get an independent complete generation',async()=>{
 const d=disk(),s=runMonths(start(),4);await d.store.setSnapshot('save',capture(s));const generation=d.records.get('save').generation,other=runMonths(start(),1);await d.store.setSnapshot('save',capture(other));assert.notEqual(d.records.get('save').generation,generation);assert.deepEqual((await d.store.getSnapshot('save')).simulation.state.journal,other.journal);assert.equal([...d.records.keys()].filter(k=>k.includes(':journal:')).length,1);
});
test('legacy string saves load losslessly and no IndexedDB falls back to the full format',async()=>{
 const d=disk(),s=advanceMonth(start()),old=autosaveText(s,s.policy,{version:1},s.version);d.records.set('save',old);assert.deepEqual((await d.store.getSnapshot('save')).simulation.state,JSON.parse(JSON.stringify(s)));const fallback=createJournalStorage({...d.options,available:async()=>false});await fallback.setSnapshot('save',capture(s));assert.equal(typeof d.records.get('save'),'string');assert.deepEqual(JSON.parse(d.records.get('save')).simulation.state,JSON.parse(JSON.stringify(s)));
});
test('a head with missing journal records fails explicitly instead of loading a truncated history',async()=>{
 const d=disk(),s=advanceMonth(start());await d.store.setSnapshot('save',capture(s));const head=d.records.get('save');d.records.delete(`save:journal:${head.generation}:0`);await assert.rejects(d.store.getSnapshot('save'),/Не найдена запись/);
});
test('rapid requests coalesce before capture and a slow older write never overtakes a newer write',async()=>{
 const tasks=[],gate=deferred(),writes=[],statuses=[];let state=1,active=0,maxActive=0;
 const q=createAutosaveQueue({capture:()=>state,schedule:fn=>tasks.push(fn),write:async value=>{active++;maxActive=Math.max(maxActive,active);if(value===2)await gate.promise;writes.push(value);active--;},onStatus:status=>statuses.push(status)});
 q.request();state=2;q.request();assert.deepEqual(writes,[]);assert.equal(tasks.length,1);tasks.shift()();await Promise.resolve();await Promise.resolve();state=3;q.request();state=4;q.request();assert.equal(q.isPending(),true);gate.resolve();await q.flush();assert.deepEqual(writes,[2,4]);assert.equal(maxActive,1);assert.equal(q.isPending(),false);assert.equal(statuses.at(-1),'saved');
});
test('failed saves stay dirty, report errors and can retry without a false saved status',async()=>{
 const statuses=[],errors=[];let fail=true;const q=createAutosaveQueue({capture:()=>1,schedule:()=>{},write:async()=>{if(fail)throw Error('quota');},onStatus:x=>statuses.push(x),onError:e=>errors.push(e.message)});q.request();await q.flush();assert.equal(q.isPending(),true);assert.equal(statuses.at(-1),'error');assert.deepEqual(errors,['quota']);fail=false;q.request();await q.flush();assert.equal(q.isPending(),false);assert.equal(statuses.at(-1),'saved');
});
test('runMonths preserves its input, matches individual steps and retains independent live state',()=>{
 const s=runMonths(start(),3),before=JSON.stringify(s),one=runMonths(s,1);assert.equal(JSON.stringify(s),before);assert.deepEqual(one.metrics,advanceMonth(s).metrics);one.policy.incomeTax=33;assert.notEqual(one.policy.incomeTax,s.policy.incomeTax);const zero=runMonths(s,0);assert.notEqual(zero,s);assert.equal(JSON.stringify(zero),JSON.stringify(s));s.defense={...s.defense,sovereigntyLost:true};const stopped=runMonths(s,1);assert.notEqual(stopped,s);assert.equal(JSON.stringify(stopped),JSON.stringify(s));
});

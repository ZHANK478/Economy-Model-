import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,runMonths,simulationEnvelope,exportSimulation,importSimulation,importSimulationData,scheduleShock} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {formatNumber} from '../src/number-format.js';
import {metricSeries,comparableGDP} from '../src/dashboard-data.js';
import {calculateTurn} from '../src/turn-calculation.js';

test('worker turns preserve exact results and the existing save journal', async t=>{
 const originalSelf=globalThis.self,originalWorker=globalThis.Worker;
 let submittedJournalLength;
 globalThis.self={};
 globalThis.Worker=class {
  constructor(){globalThis.self.postMessage=data=>this.onmessage({data:structuredClone(data)});}
  postMessage(data){
   submittedJournalLength=data.state.journal.length;
   queueMicrotask(()=>globalThis.self.onmessage({data:structuredClone(data)}));
  }
 };
 t.after(()=>{globalThis.self=originalSelf;globalThis.Worker=originalWorker;});
 await import('../src/turn-worker.js');
 const state=runMonths(createSimulation({...newGameOptions(),politicalMode:false}),4);
 const policy={...state.policy,vat:state.policy.vat+1};
 const next=await calculateTurn(state,3,policy);
 assert.equal(submittedJournalLength,1);
 assert.deepEqual(next,runMonths(state,3,policy));
 assert.equal(next.journal[0],state.journal[0]);
 await assert.rejects(calculateTurn(next,-1,policy),/Горизонт/);
});
test('cached number formatting preserves Russian output and missing-value semantics',()=>{
 for(const d of [0,1,2,3,4])for(const x of [0,-0,1.005,-1.2345,1e15,'34.5',null,undefined,NaN,Infinity]){
  const expected=Number.isFinite(Number(x))?Number(x).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';assert.equal(formatNumber(x,d),expected);
 }
});
test('one-pass save import and direct export envelope retain full validation and content',()=>{
 const s=advanceMonth(createSimulation({...newGameOptions(),politicalMode:false})),text=exportSimulation(s);
 assert.equal(JSON.stringify(simulationEnvelope(s),null,2),text);
 assert.deepEqual(importSimulationData(JSON.parse(text)),importSimulation(text));
 const broken=JSON.parse(text);broken.state.households[0].cash=NaN;assert.throws(()=>importSimulationData(broken));
 assert.throws(()=>importSimulationData({format:'other'}));
});
test('trial FX solves and live history updates never mutate the previous state',()=>{
 let s=createSimulation({...newGameOptions({country:'rich'}),politicalMode:false});scheduleShock(s,{key:'importAvailability',multiplier:.6,start:3,duration:6});
 for(let i=0;i<10;i++){
  const before=JSON.stringify(s),next=advanceMonth(s);assert.equal(JSON.stringify(s),before);
  assert.notEqual(next.householdEconomy.history,s.householdEconomy.history);
  assert.notEqual(next.defense.history,s.defense.history);assert.notEqual(next.social.history,s.social.history);
  assert.deepEqual(next.lastReport.calculationTrace,next.journal.at(-1).calculationTrace);s=next;
 }
});
test('indexed GDP graph windows equal general reporting for gaps, duplicate dates and unsorted input',()=>{
 const history=Array.from({length:2400},(_,i)=>({month:i-12,population:i%7?10+i/100:NaN,realGDPRolling:50+i}));
 for(const rows of [history,history.filter((_,i)=>i%5),[...history.slice(0,20),history[19],...history.slice(20)],[...history].reverse()]){
  const s={history:rows,metrics:{},politics:{},population:10};
  const actual=metricSeries(s,'gdpPerCapitaRolling');
  const expected=rows.filter(m=>m.month>=0).map(m=>comparableGDP(s,m).perCapita);
  assert.deepEqual(actual.map(m=>m.gdpPerCapitaRolling),expected);
 }
});

test('funded agriculture protection projects survive saving and loading',()=>{
 const s=createSimulation({...newGameOptions(),politicalMode:false});s.policy.agricultureProtection=.5;
 const next=advanceMonth(s);assert.ok(next.projects.some(p=>p.type==='agriculture'));
 assert.deepEqual(importSimulation(exportSimulation(next)).projects,next.projects);
 const data=JSON.parse(exportSimulation(next));data.state.projects.find(p=>p.type==='agriculture').due=next.month;assert.throws(()=>importSimulationData(data));
});

test('revision 22 append-only histories retain records without mutating the previous turn',()=>{
 let s=createSimulation({...newGameOptions(),politicalMode:false,defenseMode:false});
 const keys=['householdEconomy','social','defense','settlements','enterpriseMarket','wealthOwners','rentSeeking','durableGoods','talentMigration','internationalCapital'];
 const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}};
 for(let i=0;i<122;i++){
  const before=i===121?JSON.stringify(s):null;
  for(const key of keys)if(s[key]?.history)freeze(s[key].history);
  const next=advanceMonth(s);
  for(const key of keys)if(s[key]?.history){assert.notEqual(next[key].history,s[key].history,key);assert.ok(next[key].history.length>=s[key].history.length,key);}
  if(before)assert.equal(JSON.stringify(s),before);
  s=next;
 }
});

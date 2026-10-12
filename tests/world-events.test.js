import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,executePolitical} from '../src/engine.js';
import {worldEvent} from '../src/world-events.js';
const options={seed:42,stochastic:false,politicalMode:true,politicalOptions:{livingWorld:true,constitution:{presidentTerm:84,parliamentTerm:84,parliamentOffset:84}}};
test('seeded world episodes are rare, bounded and include good and bad news',()=>{
 const titles=new Set(),signs=new Set();
 for(let seed=0;seed<40;seed++){
  const starts=[];for(let month=1;month<=120;month++){
   const e=worldEvent({seed,month,politics:{livingWorld:true}});if(!e)continue;
   titles.add(e.title);signs.add(e.multiplier>1?'up':'down');assert.ok(e.duration>=6&&e.duration<=14);if(e.start===month)starts.push(month);
  }
  assert.equal(starts.length,4);for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=19);
 }
 assert.ok(titles.size>=8);assert.equal(signs.size,2);assert.equal(worldEvent({seed:42,month:12,politics:{}}),null);
});
test('world shocks affect actual conditions; value added and balances reconcile; save replay is exact',()=>{
 let s=createSimulation(options),news=0;
 for(let i=0;i<60;i++){
  s=advanceMonth(s,s.policy);const e=worldEvent(s);assert.equal(s.lastReport.worldNews?.id,e?.id);
  if(e?.start===s.month){news++;assert.ok(s.lastReport.events.some(x=>x.startsWith(e.title)));}
  const sum=s.lastReport.gdp.sectorValueAdded.reduce((a,b)=>a+b,0),tax=s.lastReport.fiscal.vat+s.lastReport.fiscal.tariff;
  assert.ok(Math.abs(sum+tax-s.metrics.nominalGDPMonthly)<1e-7);
  for(const v of Object.values(s.lastReport.audit))assert.ok(Math.abs(v)<.001);
 }
 assert.equal(news,2);const r=replayJournal(importSimulation(exportSimulation(s)));
 for(const [k,v] of Object.entries(s.metrics))if(typeof v==='number')assert.ok(Math.abs(v-r.metrics[k])/Math.max(1,Math.abs(v))<1e-10,k);
});
test('activation of the living world on an old game preserves prior history and replays',()=>{
 let s=createSimulation({politicalMode:true});const initialStochastic=s.provenance.initialStochastic;
 executePolitical(s,{kind:'setLivingWorld'});assert.equal(s.stochastic,false);assert.equal(s.provenance.initialStochastic,initialStochastic);
 for(let i=0;i<18;i++)s=advanceMonth(s,s.policy);const r=replayJournal(s);assert.equal(r.stochastic,false);assert.equal(r.politics.livingWorld,true);assert.deepEqual(r.metrics,s.metrics);
});

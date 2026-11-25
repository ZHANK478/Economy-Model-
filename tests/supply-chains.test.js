import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,scheduleShock,exportSimulation,importSimulation,replayJournal,inputMatrix} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {prepareSupplyChains,supplySalesSignal} from '../src/supply-chains.js';
const initial=(country='middle',extra={})=>createSimulation({...newGameOptions({country,resource:false}),politicalMode:false,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('critical imported inputs transmit a heterogeneous shock, with no exposure at zero imports',()=>{
 const s=initial(),matrix=inputMatrix(s);let q;
 for(let i=0;i<4;i++)q=prepareSupplyChains(s,80,matrix);
 assert.ok(q.sectors[2].capacityFactor<q.sectors[0].capacityFactor);
 assert.ok(q.sectors[0].capacityFactor<q.sectors[4].capacityFactor);
 assert.ok(q.sectors[2].exposure>q.sectors[2].importedInputShare); // cost share alone misses critical parts
 s.firms.forEach(f=>f.importCoefficient=0);q=prepareSupplyChains(s,80,matrix);
 assert.ok(q.sectors.every(x=>x.capacityFactor===1));
});
test('supplier replacement is partial, slow, and recovery does not create physical capacity',()=>{
 const s=initial(),matrix=inputMatrix(s),first=prepareSupplyChains(s,80,matrix);let q;
 for(let i=0;i<35;i++)q=prepareSupplyChains(s,80,matrix);
 assert.ok(q.replacement>first.replacement&&q.replacement<.1);
 assert.ok(q.effectiveShortfall>.09); // a permanent interruption remains a real constraint
 for(let i=0;i<6;i++)q=prepareSupplyChains(s,115,matrix);
 assert.ok(q.effectiveShortfall<1e-6);assert.ok(q.sectors.every(x=>x.capacityFactor<=1));
});
test('unserved orders preserve demand only while physically rationed, without limitless hiring',()=>{
 const f={orders:90,production:75,physicalCapacity:100,normalUtilization:.9,temporarySupply:true};
 near(supplySalesSignal(f),90);near(supplySalesSignal({...f,orders:200}),90);
 near(supplySalesSignal({...f,orders:60,production:60}),60);
 near(supplySalesSignal({...f,temporarySupply:false}),75);
});
test('old monthly equations replay unchanged across a recorded live migration',()=>{
 let s=initial('middle',{economicRevision:4});
 scheduleShock(s,{key:'importAvailability',multiplier:.8,duration:6});
 for(let i=0;i<3;i++)s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});
 const old=JSON.stringify(s.journal);s=advanceMonth(s);
 assert.equal(s.economy.revision,5);assert.equal(JSON.stringify(s.journal.slice(0,3)),old);
 const restored=importSimulation(exportSimulation(s));assert.deepEqual(replayJournal(restored).metrics,s.metrics);
 assert.deepEqual(replayJournal(restored).economy.supplyChains,s.economy.supplyChains);
 restored.economy.supplyChains.pressure=NaN;assert.throws(()=>importSimulation(exportSimulation(restored)));
});
test('a temporary 20 percent supply shock avoids the old employment spiral and restores feasible output',()=>{
 for(const country of ['poor','middle','rich']){
  let control=initial(country),shock=initial(country);
  scheduleShock(shock,{key:'importAvailability',multiplier:.8,start:5,duration:14});
  let trough=0,peakUnemploymentGap=0;
  for(let i=0;i<42;i++){
   control=advanceMonth(control);shock=advanceMonth(shock);
   trough=Math.min(trough,shock.metrics.realGDPMonthly/control.metrics.realGDPMonthly-1);
   peakUnemploymentGap=Math.max(peakUnemploymentGap,shock.metrics.unemployment-control.metrics.unemployment);
   assert.ok(Math.max(...Object.values(shock.lastReport.audit).map(Math.abs))<1e-5);
  }
  // Regression boundaries, NOT empirical confidence intervals or GDP floors.
  assert.ok(trough>-.15,`${country}: ${trough}`);assert.ok(peakUnemploymentGap<10,`${country}: ${peakUnemploymentGap}`);
  assert.ok(shock.metrics.realGDPMonthly/control.metrics.realGDPMonthly>.9);
  assert.ok(shock.economy.supplyChains.effectiveShortfall<1e-6);
 }
});

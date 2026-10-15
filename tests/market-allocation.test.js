import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateMarket} from '../src/market-allocation.js';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {governanceTarget} from '../src/institutions.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('export receipts finance imported inputs even with no unused foreign credit',()=>{
 const input={matrix:[[0,0],[0,0]],inventory:[0,0],capacity:[100,100],domestic:[100,100],exports:[50,0],prices:[1,1],external:{availableUSD:0,intermediateUnitUSD:[.1,.1],finalImportsUSD:50,exportsUSD:50}};
 const m=allocateMarket(input);near(m.alpha,.5625);near(m.exportAlpha,.875);
 near(m.production[0],100);near(m.production[1],56.25);
 assert.ok(m.externalNeed<=1e-7);assert.ok(m.ending.every(v=>v>=-1e-7));
});
test('allocation respects goods, capacities and currency across scales without fabricated output floors',()=>{
 for(const scale of [.001,1,1e6])for(let t=0;t<20;t++){
  const input={matrix:[[.1,.2],[.05,.1]],inventory:[t,2*t].map(v=>v*scale),capacity:[30+t,70-t].map(v=>v*scale),domestic:[45,65].map(v=>v*scale),exports:[20,8].map(v=>v*scale),prices:[1.2,.8],external:{availableUSD:t*scale,intermediateUnitUSD:[.08,.12],finalImportsUSD:30*scale,exportsUSD:31*scale}};
  const m=allocateMarket(input);assert.ok(m.alpha>=0&&m.alpha<=1&&m.exportAlpha>=0&&m.exportAlpha<=1);
  for(let i=0;i<2;i++){assert.ok(m.production[i]<=input.capacity[i]+1e-7*scale);assert.ok(m.ending[i]>=-1e-7*scale);near((input.inventory[i]+m.production[i]-m.intermediate[i]-m.delivered[i]-m.ending[i])/scale,0);}
  assert.ok(m.externalNeed<=input.external.availableUSD+1e-7*scale);
 }
 const zero=allocateMarket({matrix:[[0]],inventory:[0],capacity:[0],domestic:[10],exports:[0],prices:[1],external:null});near(zero.alpha,0);near(zero.production[0],0);
});
test('revision keeps historical equations replayable while new investment plans match opening GDP',()=>{
 for(const country of ['poor','middle','rich']){
  const options={...newGameOptions({country,resource:false}),politicalMode:false};
  const s=createSimulation(options);assert.equal(s.economy.revision,2);
  near(s.firms.reduce((v,f)=>v+f.lastInvestment,0),s.base.investment);
  let old=createSimulation({...options,economicRevision:1});for(let i=0;i<8;i++)old=advanceMonth(old,old.policy,{preserveEconomicRevision:true});
  assert.deepEqual(replayJournal(importSimulation(exportSimulation(old))).metrics,old.metrics);
  const past=JSON.stringify(old.journal);const upgraded=advanceMonth(old);assert.equal(upgraded.economy.revision,2);
  assert.equal(JSON.stringify(upgraded.journal.slice(0,old.month)),past);
  assert.equal(upgraded.journal.at(-1).economicRevision,2);
  assert.deepEqual(replayJournal(importSimulation(exportSimulation(upgraded))).metrics,upgraded.metrics);
 }
 const invalid=createSimulation({...newGameOptions(),politicalMode:false});invalid.economy.revision=3;assert.throws(()=>importSimulation(exportSimulation(invalid)));
 const brokenHistory=advanceMonth(createSimulation({...newGameOptions(),politicalMode:false}));brokenHistory.journal[0].economicRevision=3;assert.throws(()=>importSimulation(exportSimulation(brokenHistory)));
});
test('employee participation has the same governance effect under private and cooperative ownership',()=>{
 const s=createSimulation({...newGameOptions(),politicalMode:false}),f=s.firms[4];
 const effect=cooperative=>{f.ownership={state:0,municipal:0,foreign:0,domestic:1-cooperative,cooperative};s.policy.workerRepresentation=false;const a=governanceTarget(s,f);s.policy.workerRepresentation=true;return governanceTarget(s,f)-a;};
 near(effect(0),effect(1));
});

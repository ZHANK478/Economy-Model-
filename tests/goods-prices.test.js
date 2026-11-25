import test from 'node:test';import assert from 'node:assert/strict';
import {importGoodsPrices,basketPrice,goodsPriceView} from '../src/goods-prices.js';
import {createSimulation,advanceMonth,scheduleShock,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {foodReplacementUnit} from '../src/agriculture.js';
const start=()=>createSimulation({...newGameOptions(),politicalMode:false,defenseMode:false});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('category prices distinguish energy shocks, currency and raw materials without artificial food shocks',()=>{
 const s=createSimulation({...newGameOptions(),economicRevision:16,politicalMode:false,defenseMode:false}),world={energyPrice:100,commodityPrice:100},base=importGoodsPrices(s,world),shock=importGoodsPrices(s,{...world,energyPrice:200});
 near(shock[0],base[0]);near(shock[1],2*base[1]);near(shock[2],1.1*base[2]);near(shock[3],1.15*base[3]);near(shock[4],base[4]);
 s.exchangeRate*=2;importGoodsPrices(s,world).forEach((p,i)=>near(p,2*base[i]));
});
test('mixed basket payments include differentiated imported goods, duties and replacement food exactly once',()=>{
 const w=[.2,.1,.4,.1,.2],local=[1,1,1,1,1],foreign=[2,3,4,5,6],share=.3,r=.4,tax=.2;
 const domestic=w.reduce((v,x,i)=>v+(1-share)*x*(i===0?(1-r)*local[i]+r*foreign[i]*(1+tax):local[i]),0);
 near(foodReplacementUnit(w,share,local,foreign,20,r),domestic+share*basketPrice(w,foreign)*(1+tax));
});
test('differentiated import payments reconcile across consumers, GDP and FX and survive save/replay',()=>{
 let s=start();scheduleShock(s,{key:'energyPrice',multiplier:1.5,start:3,duration:12});scheduleShock(s,{key:'commodityPrice',multiplier:1.3,start:8,duration:8});
 for(let i=0;i<36;i++){s=advanceMonth(s);assert.ok(s.metrics.auditError<1e-5);const rows=s.lastReport.goodsPrices;assert.equal(rows.length,5);assert.ok(rows.every(r=>r.domestic>0&&r.imported>0));}
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.metrics,s.metrics);assert.deepEqual(replayJournal(loaded).metrics,s.metrics);assert.deepEqual(advanceMonth(loaded).metrics,advanceMonth(s).metrics);
 assert.match(goodsPriceView(s,{n:x=>String(x)}),/Цены товаров/);
});
test('revision 14 history remains unchanged when live games migrate to goods pricing',()=>{
 let s=createSimulation({...newGameOptions(),economicRevision:14,politicalMode:false,defenseMode:false});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});const previous=JSON.stringify(s.journal);
 s=advanceMonth(s);assert.equal(s.economy.revision,24);assert.equal(JSON.stringify(s.journal.slice(0,1)),previous);assert.deepEqual(replayJournal(s).metrics,s.metrics);
});

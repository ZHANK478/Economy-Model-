import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COUNTRY_PRESETS,GOVERNMENT_PRESETS,newGameOptions} from '../src/start-presets.js';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';

test('four setup choices with coherent executive roles and regime rules',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.deepEqual([...html.matchAll(/<select name="([^"]+)"/g)].map(m=>m[1]),['government','party','country','resource']);
 assert.ok(!/name="(?:demography|stochastic|parliamentTerm|termLimit|confidence)"/.test(html));
 for(const [government,p] of Object.entries(GOVERNMENT_PRESETS)){
  const s=createSimulation(newGameOptions({government}));
  for(const [k,v] of Object.entries(p.constitution))assert.equal(s.politics.constitution[k],v,government+':'+k);
  assert.equal(s.politics.enabled,true);assert.equal(s.politics.decisionLimit,3);
 }
 assert.throws(()=>newGameOptions({country:'missing'}));
});
for(const [country,p] of Object.entries(COUNTRY_PRESETS))for(const resource of [true,false])test(`${country}, resource=${resource}: real scaling, population accounting and reproducible history`,()=>{
 let s=createSimulation({...newGameOptions({country,resource}),politicalMode:false});
 assert.equal(s.metrics.gdpPerCapitaReal,p.gdp);assert.equal(s.base.monthlyGDP,p.gdp*10/12);
 assert.equal(s.demography.fertility,p.fertility);assert.ok(Math.abs(s.metrics.debtRatio-50)<1e-10);
 assert.ok(Math.abs(s.metrics.capitalRatio-12)<1e-10);assert.ok(s.households.every(h=>h.cash>0&&h.income>0));
 for(let month=0;month<36;month++){
  s=advanceMonth(s,s.policy);
  assert.ok(s.population>0&&s.metrics.realGDPMonthly>0);
  assert.ok(Math.abs(s.demography.populationResidual)<1e-9);
  for(const [key,v] of Object.entries(s.lastReport.audit))assert.ok(Number.isFinite(v)&&Math.abs(v)<.001,`${key}: ${v}`);
  assert.ok(Object.values(s.metrics).every(v=>typeof v!=='number'||Number.isFinite(v)));
 }
 const restored=importSimulation(exportSimulation(s));const replay=replayJournal(restored);
 for(const [k,v] of Object.entries(s.metrics))if(typeof v==='number')assert.ok(Math.abs(v-replay.metrics[k])/Math.max(1,Math.abs(v))<1e-10,k);
 assert.equal(restored.provenance.initialGDPPerCapita,p.gdp);
});
test('default $6000 initialization remains compatible with explicit scale and invalid GDP is rejected',()=>{
 const old=createSimulation(),scaled=createSimulation({initialGDPPerCapita:6000});
 assert.deepEqual(old.metrics,scaled.metrics);assert.deepEqual(old.households,scaled.households);
 for(const value of [0,-1,NaN,Infinity,100001])assert.throws(()=>createSimulation({initialGDPPerCapita:value}));
});

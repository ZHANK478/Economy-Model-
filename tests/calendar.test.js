import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
test('new calendar starts in 2000 and old saved calendars survive replay',()=>{
 for(const year of [2000,2026]){
  let s=createSimulation({startYear:year,stochastic:false});
  s=advanceMonth(s,s.policy);
  const loaded=importSimulation(exportSimulation(s));
  assert.equal(loaded.startYear,year);assert.equal(replayJournal(loaded).startYear,year);
 }
 assert.equal(createSimulation().startYear,2000);
});

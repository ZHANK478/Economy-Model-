import test from 'node:test';
import assert from 'node:assert/strict';
import {createUIObservation} from '../src/ui-observation.js';
test('local report separates unopened targets, counts openings and excludes hidden time',()=>{
 let time=1000;const records=new Map(),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};
 const t=createUIObservation({clock:()=>time,storage});t.context({seed:42,month:3});t.session();
 t.register('view:banks','Банки');t.open('view:country','Паспорт страны');time+=500;t.close('view:country');
 t.open('window:result','Результат','window');time+=200;t.visibility(false);time+=10000;t.visibility(true);
 t.open('window:result','Результат','window','return');time+=300;t.close('window:result');
 const report=t.report();assert.equal(report.summary.targets.find(x=>x.id==='view:country').visibleMs,500);
 assert.equal(report.summary.targets.find(x=>x.id==='window:result').visibleMs,500);
 assert.equal(report.summary.targets.find(x=>x.id==='window:result').opens,1);
 assert.deepEqual(report.summary.neverOpened.map(x=>x.id),['view:banks']);assert.equal(report.context.month,3);
 assert.ok(t.flush());const reload=createUIObservation({clock:()=>time,storage});assert.equal(reload.report().events.length,report.events.length);
});
test('event retention is bounded and unavailable storage never affects the game',()=>{
 const t=createUIObservation({storage:{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}},maxEvents:3});
 for(let i=0;i<8;i++)t.event('click','view:'+i);assert.equal(t.report().events.length,3);assert.equal(t.report().droppedEvents,5);assert.equal(t.flush(),false);
});

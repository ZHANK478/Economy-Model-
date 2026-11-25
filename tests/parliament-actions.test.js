import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,executePolitical,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {constitutionBoard} from '../src/constitution-ui.js';
const country=(constitution={})=>createSimulation({politicalMode:true,seed:3,politicalOptions:{constitution}});
test('constitutional permission enables presidential early elections, with a real cooldown and recorded replay',()=>{
 let s=country({form:'presidential',dissolution:true});
 executePolitical(s,{kind:'dissolve'});
 assert.equal(s.politics.scheduledParliament,2);
 assert.throws(()=>executePolitical(s,{kind:'dissolve'}),/годовым/);
 s=advanceMonth(advanceMonth(s));
 assert.ok(s.politics.elections.some(e=>e.kind==='parliament'&&e.month===2));
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).politics,s.politics);
 assert.throws(()=>executePolitical(country({dissolution:false}),{kind:'dissolve'}),/Конституция/);
});
test('a manual constitutional referendum waits for the player and only then resolves the amendment',()=>{
 let s=country({constitutionalReferendum:true});const original=s.politics.constitution.threshold;
 const b=executePolitical(s,{kind:'chooseLaw',patch:{},constitutionPatch:{threshold:4},deferReferendum:true});
 assert.equal(b.status,'referendum');assert.equal(b.referendum,undefined);assert.equal(s.politics.constitution.threshold,original);
 const html=constitutionBoard(s,{section:null,patch:{}},{esc:String,n:String,date:String});
 assert.match(html,/data-political-action="referendum"/);
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).politics,s.politics);
 executePolitical(s,{kind:'referendum',billId:b.id});
 assert.ok(['passed','rejected'].includes(b.status));assert.ok(b.referendum);
 assert.equal(b.referendum.yesVotes+b.referendum.noVotes,b.referendum.voters);
 assert.throws(()=>executePolitical(s,{kind:'referendum',billId:b.id}),/не назначен/);
 s=advanceMonth(s);assert.equal(s.politics.constitution.threshold,b.referendum.passed?4:original);
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).politics,s.politics);
});
test('recorded legacy decisions retain their automatic referendum behavior',()=>{
 const s=country({constitutionalReferendum:true});
 const b=executePolitical(s,{kind:'chooseLaw',patch:{},constitutionPatch:{threshold:4}});
 assert.ok(b.referendum);assert.notEqual(b.status,'referendum');
 assert.deepEqual(replayJournal(s).politics,s.politics);
});
test('ratified emergency spending is temporary, bounded, and does not suspend constitutional votes',()=>{
 const s=country(),p=s.politics;
 p.emergency={start:0,expires:3,ratifyBy:1,ratified:true};
 const old=p.lawPolicy.militaryBudget,count=p.bills.length;
 executePolitical(s,{kind:'policyDecision',patch:{militaryBudget:old+.25}});
 assert.equal(p.bills.length,count);assert.equal(p.emergency.temporaryPolicy.militaryBudget,old+.25);
 executePolitical(s,{kind:'policyDecision',patch:{militaryBudget:old+3}});
 assert.equal(p.bills.length,count+1);
 executePolitical(s,{kind:'policyDecision',patch:{protectedJudges:false}});
 assert.equal(p.bills.at(-1).kind,'constitutional');
});

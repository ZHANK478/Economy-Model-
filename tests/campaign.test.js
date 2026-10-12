import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {executePolitical,decisionBudget} from '../src/political-system.js';
import {campaignEvent,campaignUtility} from '../src/campaign-events.js';
function start(){return createSimulation({politicalMode:true,politicalOptions:{decisionLimit:3,dashboardMode:true,partyContinuity:true,constitution:{parliamentOffset:12,presidentTerm:48}}});}
test('campaign choices are optional, limited to one response per event and recorded for exact replay',()=>{
 let s=start();const e=campaignEvent(s);assert.equal(e.phase,0);assert.equal(e.kind,'parliament');
 const budget=decisionBudget(s).used;executePolitical(s,{kind:'campaignResponse',eventId:e.id,choice:0});
 assert.equal(decisionBudget(s).used,budget);assert.equal(s.politics.campaignResponses.length,1);assert.equal(campaignEvent(s),null);
 const before=JSON.stringify(s.politics);assert.throws(()=>executePolitical(s,{kind:'campaignResponse',eventId:e.id,choice:1}));assert.equal(JSON.stringify(s.politics),before);
 for(let i=0;i<4;i++)s=advanceMonth(s,s.policy);
 assert.equal(campaignEvent(s).phase,1);executePolitical(s,{kind:'campaignResponse',eventId:campaignEvent(s).id,choice:1});
 const restored=importSimulation(exportSimulation(s)),replayed=replayJournal(restored);
 assert.deepEqual(replayed.politics.campaignResponses,s.politics.campaignResponses);assert.deepEqual(replayed.politics.publicEvents,s.politics.publicEvents);
 for(const [k,v] of Object.entries(s.metrics))if(typeof v==='number')assert.ok(Math.abs(v-replayed.metrics[k])/Math.max(1,Math.abs(v))<1e-10,k);
});
test('campaign signals target party, election, preferences and region, and fade rather than add fixed votes',()=>{
 const s=start();s.month=4;const e=campaignEvent(s);executePolitical(s,{kind:'campaignResponse',eventId:e.id,choice:0});
 const own=s.politics.parties.find(p=>p.id===s.politics.executive.playerParty),g={region:0,ideal:{economy:1}};
 assert.ok(campaignUtility(s,g,own,'parliament')>0);assert.ok(campaignUtility(s,{...g,ideal:{economy:-1}},own,'parliament')<0);
 assert.equal(campaignUtility(s,g,own,'president'),0);assert.equal(campaignUtility(s,g,{id:'opposition'},'parliament'),0);
 const value=campaignUtility(s,g,own,'parliament');s.month+=6;assert.ok(campaignUtility(s,g,own,'parliament')<value);
 s.policy.competitiveElections=false;assert.equal(campaignEvent(s),null);
});
test('no election campaign outside the final year and skipping is allowed',()=>{
 const s=createSimulation({politicalMode:true});assert.equal(campaignEvent(s),null);
 const pending=start();assert.ok(campaignEvent(pending));assert.doesNotThrow(()=>advanceMonth(pending,pending.policy));
 assert.throws(()=>executePolitical(start(),{kind:'campaignResponse',eventId:'wrong',choice:0}));
});

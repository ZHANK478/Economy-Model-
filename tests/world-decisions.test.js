import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,executePolitical,replayJournal} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {pendingWorldDecisions,worldDecisionEffects,worldDecisionNews} from '../src/world-decisions.js';
import {updatePress} from '../src/press-ui.js';
import {productImportPrices} from '../src/product-markets.js';

function cabinet(year,month){
  const opts=scenarioOptions();
  let s=createSimulation({...opts,startYear:year,politicalOptions:{...opts.politicalOptions,historicalWorld:1}});
  executePolitical(s,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(s,{kind:'formCabinet'});
  while(s.month<month-1)s=advanceMonth(s);
  return s;
}
const answer=(s,eventId,choice,vote)=>executePolitical(s,{kind:'answerWorldDecision',eventId,choice,vote});

test('Iraq uses a recorded Commons vote and the cabinet parties obey the player',()=>{
  let s=cabinet(2003,3);
  assert.equal(pendingWorldDecisions(s)[0].id,'iraq');
  const before=s.politics.poll.parties.map(row=>row.share);
  answer(s,'iraq','join','accept');
  assert.notDeepEqual(s.politics.poll.parties.map(row=>row.share),before);
  const vote=s.politics.rollCalls.at(-1);
  assert.equal(vote.passed,true);
  for(const id of s.politics.coalition){
    assert.equal(vote.parties.find(row=>row.id===id).yes,s.politics.parties.find(p=>p.id===id).seats);
  }
  assert.equal(vote.yes+vote.no+vote.abstain,s.politics.totalSeats);
  assert.match(worldDecisionNews(s)[0].title,/вступает/);
  assert.throws(()=>answer(s,'iraq','decline'),/завершилось/);
  s=advanceMonth(s);
  assert.ok(s.lastReport.fiscal.worldCommitments>0);
  assert.ok(Math.abs(s.lastReport.audit.governmentCash)<1e-6);
  assert.deepEqual(replayJournal(s).politics.worldDecisions,s.politics.worldDecisions);
});

test('an opposition party controls its own vote and cannot approve executive decisions',()=>{
  const s=cabinet(2003,3);
  const rival=s.politics.parties.find(p=>p.seats>0&&!s.politics.coalition.includes(p.id));
  s.politics.executive.playerParty=rival.id;
  assert.throws(()=>answer(s,'iraq','un'),/кабинет/);
  answer(s,'iraq','motion','abstain');
  assert.equal(s.politics.rollCalls.at(-1).parties.find(p=>p.id===rival.id).abstain,rival.seats);
});

test('the Syria and July 2020 executive choices affect flows and appear in the press',()=>{
  let syria=cabinet(2015,9);
  answer(syria,'syria','both');
  syria=advanceMonth(syria);
  assert.ok(worldDecisionEffects(syria).arrivals>0&&syria.lastReport.fiscal.worldCommitments>0);
  const options=cabinet(2020,7);
  assert.deepEqual(pendingWorldDecisions(options).map(event=>event.id),['huawei','hong-kong']);
  const before=productImportPrices(options,options.world)[6];
  answer(options,'huawei','phase');
  answer(options,'hong-kong','route');
  const press={};
  updatePress(options,press);
  assert.ok(Object.values(press.editions).flat().some(e=>e.id==='decision:hong-kong'));
  const next={...options,month:options.month+1};
  assert.ok(productImportPrices(next,options.world)[6]>before);
  assert.equal(worldDecisionEffects(next).arrivals,0);
  assert.ok(worldDecisionEffects({...options,month:options.month+7}).arrivals>0);
});

test('ignoring an available answer records one result without retroactive participation',()=>{
  const s=cabinet(2003,3);
  const next=advanceMonth(s);
  assert.equal(next.politics.worldDecisions.iraq.choice,'decline');
  assert.equal(next.politics.worldDecisions.iraq.expired,true);
  assert.equal(worldDecisionEffects(next).spending,0);
});

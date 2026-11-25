import assert from 'node:assert/strict';
import test from 'node:test';
import {createSimulation,advanceMonth,executePolitical,replayJournal} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {ministerialBriefings} from '../src/ministerial-briefings.js';
import {britishOfficeHolder,characterRoster,personBriefing} from '../src/character-roster.js';
import {updatePress} from '../src/press-ui.js';

function government(enabled=false){
  const options=scenarioOptions();
  const state=createSimulation({...options,politicalOptions:{...options.politicalOptions,ministerialBriefings:enabled?1:undefined}});
  executePolitical(state,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(state,{kind:'formCabinet'});
  return state;
}

test('the expanded cabinet and independent officials have stable identities and replay from an old campaign',()=>{
  let state=government();
  assert.equal(state.characters.cabinet.labour,undefined);
  const existing=state.characters.cabinet.treasury;
  executePolitical(state,{kind:'enableMinisterialBriefings'});
  assert.equal(state.characters.cabinet.treasury,existing);
  assert.ok(state.characters.cabinet.labour&&state.characters.cabinet.industry);
  state=advanceMonth(state);
  assert.deepEqual(replayJournal(state).characters.cabinet,state.characters.cabinet);
  const roster=characterRoster(state,null,{includeOrganizations:true});
  for(const id of ['uk-bank-governor','uk-auditor','uk-speaker']){
    const official=britishOfficeHolder(state,id);
    assert.equal(roster.people.get(id).name,official.name);
    assert.match(personBriefing(official),/Беспартийная должность/);
  }
});

test('a real deterioration generates a repeatable proposal and respects its cooldown',()=>{
  const state=government(true);
  assert.deepEqual(ministerialBriefings(state,{}),[]);
  state.month=3;
  state.history=[{...state.metrics,month:0,synthetic:false},{...state.metrics,month:2,synthetic:false},{...state.metrics,month:3,synthetic:false}];
  state.metrics={...state.metrics,unemployment:state.metrics.unemployment+2,employment:state.metrics.employment*.96};
  const jobs=ministerialBriefings(state,{}).find(item=>item.id==='jobs');
  assert.ok(jobs);
  assert.ok(['retrainingBudget','unemploymentReplacement'].includes(jobs.proposal.key));
  assert.deepEqual(ministerialBriefings(state,{}).find(item=>item.id==='jobs'),jobs);
  assert.ok(!ministerialBriefings(state,{ministerialContact:{jobs:3}}).find(item=>item.id==='jobs'));
  const press={ministerialResults:[{id:'briefing:jobs:3',month:3,title:jobs.title,en:jobs.en,person:'A. Smith',outcome:'approved'}]};
  updatePress(state,press);
  updatePress(state,press);
  const issues=Object.values(press.editions).flat().filter(issue=>issue.id==='briefing:jobs:3');
  assert.equal(issues.length,1);
  assert.equal(issues[0].english.enTitle,'Measure approved');
});

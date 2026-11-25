import test from 'node:test';
import assert from 'node:assert/strict';
import {AXES} from '../src/political-config.js';
import {applyElectoralPacts, answerElectoralPact, forecastElectoralPacts, pendingElectoralPact, prepareElectoralPacts} from '../src/electoral-pacts.js';
import {createSimulation,advanceMonth,executePolitical,exportSimulation,importSimulationData,replayJournal} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {conductElection, pollElectorate} from '../src/electorate.js';

const parties = [['a',.45],['b',-.1],['c',-.2]].map(([id,value]) => ({
  id, platform:Object.fromEntries(AXES.map(axis => [axis,value]))
}));
const forecast = () => [[42,35,23],[42,23,35],[65,18,17],[29,47,24]].map((votes,id) => ({id,votes}));
const poll = [{id:'a',share:61},{id:'b',share:20},{id:'c',share:19}];
function fixture(){
  return {month:9,policy:{competitiveElections:true},politics:{
    electoralPactRevision:1,constitution:{electoralSystem:'plurality'},nextParliamentElection:10,
    electoralIntegrity:.8,executive:{playerParty:'b',inOffice:true},parties,poll:{parties:poll},
  }};
}
const prepare = state => prepareElectoralPacts(state,()=>({results:parties,districts:forecast()}));

test('two minor parties retain winnable districts and stand aside in a reciprocal pact',()=>{
  const pacts=forecastElectoralPacts(parties,forecast(),poll);
  assert.deepEqual(pacts,[{parties:['b','c'],terms:[
    {district:'1',donor:'b',endorsed:'c'},{district:'0',donor:'c',endorsed:'b'}
  ]}]);
  assert.deepEqual(forecastElectoralPacts(parties,
    [{id:0,votes:[65,18,17]},{id:1,votes:[66,15,19]}],poll),[]);
  const incompatible = parties.map(p => p.id==='c' ? {...p,platform:Object.fromEntries(AXES.map(axis=>[axis,.9]))} : p);
  assert.deepEqual(forecastElectoralPacts(incompatible,forecast(),poll),[]);
});
test('player consent is required and applied terms preserve ballot accounting and safe districts',()=>{
  const s=fixture();
  prepare(s);
  assert.ok(pendingElectoralPact(s));
  answerElectoralPact(s,'accepted');
  assert.equal(pendingElectoralPact(s),null);
  assert.throws(()=>answerElectoralPact(s,'rejected'),/недоступно/);
  s.month=10;
  const ballots=forecast();
  assert.deepEqual(applyElectoralPacts(s,parties,ballots),[{parties:['b','c'],districts:2}]);
  assert.equal(ballots[0].votes[2],0);
  assert.equal(ballots[1].votes[1],0);
  assert.ok(ballots[0].votes[1]>ballots[0].votes[0]);
  assert.ok(ballots[1].votes[2]>ballots[1].votes[0]);
  assert.ok(ballots[0].votes[0]>42);
  assert.ok(ballots[0].votes.reduce((a,b)=>a+b,0)<100);
  assert.deepEqual(ballots.slice(2),forecast().slice(2));
  const declined=fixture();
  prepare(declined);
  answerElectoralPact(declined,'rejected');
  declined.month=10;
  const unchanged=forecast();
  assert.deepEqual(applyElectoralPacts(declined,parties,unchanged),[]);
  assert.deepEqual(unchanged,forecast());
});
test('real constituency forecast leaves the election sequence alone and the updated campaign replays',()=>{
  const options=scenarioOptions('uk-2000',{party:'liberal',nameSeed:3});
  let state=createSimulation({...options,politicalOptions:{...options.politicalOptions,
    constitution:{...options.politicalOptions.constitution,parliamentOffset:2}}});
  const before=state.politics.nextElectionId;
  assert.equal(conductElection(state,'parliament',{preview:true}).id,before);
  assert.equal(state.politics.nextElectionId,before);
  const opening = state.politics.elections[0];
  executePolitical(state,{kind:'enableConstituencyProfiles'});
  assert.deepEqual(state.politics.elections[0], opening);
  executePolitical(state,{kind:'enableElectoralPacts'});
  state=advanceMonth(state);
  assert.equal(state.politics.electoralPact.due,2);
  state=advanceMonth(importSimulationData(JSON.parse(exportSimulation(state))));
  assert.equal(state.politics.electoralPact,undefined);
  const e=state.politics.elections.at(-1);
  assert.equal(e.id,before);
  assert.equal(e.results.reduce((sum,row)=>sum+row.votes,0),e.voters);
  assert.equal(e.results.reduce((sum,row)=>sum+row.seats,0),e.totalSeats);
  assert.deepEqual(replayJournal(state).politics.elections,state.politics.elections);
});

test('the election count applies accepted withdrawals before declaring mandates and turnout',()=>{
  const options=scenarioOptions('uk-2000',{party:'liberal',nameSeed:3});
  let state=createSimulation({...options,politicalOptions:{...options.politicalOptions,
    constitution:{...options.politicalOptions.constitution,parliamentOffset:2}}});
  executePolitical(state,{kind:'enableElectoralPacts'});
  state=advanceMonth(state);
  const preview=conductElection(state,'parliament',{preview:true});
  const own=state.politics.executive.playerParty,partner=preview.results.find(result=>result.id!==own).id;
  const district=preview.districts[0],other=preview.districts[1];
  const keyFor=d=>{
    if(!d.territoryId)return String(d.id);
    const sameTerritory=preview.districts.filter(row=>row.territoryId===d.territoryId);
    return d.territoryId+':'+sameTerritory.indexOf(d);
  };
  state.politics.electoralPact.agreements=[{parties:[own,partner],status:'pending',terms:[
    {district:keyFor(district),donor:own,endorsed:partner},{district:keyFor(other),donor:partner,endorsed:own}
  ]}];
  const rejected=importSimulationData(JSON.parse(exportSimulation(state)));
  executePolitical(rejected,{kind:'answerElectoralPact',choice:'rejected'});
  executePolitical(state,{kind:'answerElectoralPact',choice:'accepted'});
  const without=advanceMonth(rejected).politics.elections.at(-1),withPact=advanceMonth(state).politics.elections.at(-1);
  assert.deepEqual(withPact.pacts,[{parties:[own,partner],districts:2}]);
  assert.equal(without.pacts,undefined);
  assert.ok(withPact.voters<without.voters);
  assert.equal(withPact.results.reduce((sum,row)=>sum+row.votes,0),withPact.voters);
  assert.equal(withPact.results.reduce((sum,row)=>sum+row.seats,0),withPact.totalSeats);
  assert.equal(withPact.districts[0].votes[withPact.results.findIndex(row=>row.id===own)],0);
  assert.equal(withPact.districts[1].votes[withPact.results.findIndex(row=>row.id===partner)],0);
});

test('British constituencies retain opposition strongholds as national support rises',()=>{
  const options = scenarioOptions('uk-2000');
  const state = createSimulation({...options,territorialGovernment:true,politicalOptions:{
    ...options.politicalOptions,guidedOpening:1,openingPollRevision:1,constituencyProfileRevision:1
  }});
  const {politics} = state;
  const own = politics.executive.playerParty;
  const opening = politics.elections[0];
  const ownOpening = opening.results.find(row => row.id === own);
  assert.ok(ownOpening.seats >= opening.totalSeats * .4 && ownOpening.seats <= opening.totalSeats * .5);
  executePolitical(state,{kind:'negotiateCoalition',partyId:politics.openingPartner,mode:'accept'});
  executePolitical(state,{kind:'formCabinet'});

  function electionAt(target){
    let low = -10, high = 10;
    for (let pass = 0; pass < 22; pass++){
      const preference = (low + high) / 2;
      politics.startingPreferences.parliament[own] = preference;
      const {poll} = pollElectorate(state,{commitMemory:false,assignPoll:false,trackGroups:false});
      if (poll.parties.find(row => row.id === own).share < target) low = preference;
      else high = preference;
    }
    return conductElection(state,'parliament',{preview:true});
  }

  const elections = [40,47,60].map(electionAt);
  const seats = elections.map(election => election.results.find(row => row.id === own).seats);
  assert.ok(seats[0] < seats[1] && seats[1] < seats[2]);
  const election = elections[1];
  assert.ok(seats[1] < election.totalSeats * .8);
  const initialWinners = new Map(opening.districts.map(row => [row.id,row.winner]));
  assert.ok(election.districts.some(row => row.winner !== own && row.winner === initialWinners.get(row.id)));
  assert.ok(election.districts.some(row => row.winner === own && row.winner !== initialWinners.get(row.id)));
  assert.equal(election.results.reduce((total,row) => total + row.seats,0),election.totalSeats);
  assert.equal(election.results.reduce((total,row) => total + row.votes,0),election.voters);

  delete politics.constituencyProfileRevision;
  const oldAt47 = electionAt(47);
  politics.constituencyProfileRevision = 1;
  assert.equal(oldAt47.results.find(row => row.id === own).seats,election.totalSeats);
  assert.ok(Math.abs(oldAt47.results.find(row => row.id === own).share -
    election.results.find(row => row.id === own).share) < .15);
});

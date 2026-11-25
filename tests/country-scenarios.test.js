import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';import {scenarioOptions} from '../src/country-scenarios.js';
import {validateScenarioDefinition,aggregateTerritoryObservations} from '../src/scenario-state.js';import {countryMapView} from '../src/country-map.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('population is a scenario input with consistent opening GDP, jobs and stocks; legacy default stays exact',()=>{
 const options={...newGameOptions(),politicalMode:false,defenseMode:false},a=createSimulation(options),b=createSimulation({...options,initialPopulation:60});
 near(b.base.monthlyGDP,6*a.base.monthlyGDP);near(b.metrics.gdpPerCapitaReal,a.metrics.gdpPerCapitaReal);near(b.firms[0].workers,6*a.firms[0].workers);near(b.households[0].cash,6*a.households[0].cash);near(b.government.domesticBonds[0].principal,6*a.government.domesticBonds[0].principal);
 assert.deepEqual(createSimulation({...options,initialPopulation:10}).metrics,a.metrics);assert.throws(()=>createSimulation({...options,initialPopulation:0}));
});
test('UK scenario loads observed national data and maps four constituent countries without inventing regional indicators',()=>{
 const s=createSimulation(scenarioOptions());near(s.population,58.892514);near(s.metrics.gdpPerCapitaReal,28383.8761094996);assert.equal(s.politics.totalSeats,659);assert.equal(s.politics.constitution.electoralSystem,'plurality');assert.equal(s.scenario.geography.territories.length,5);assert.deepEqual(s.scenario.geography.observations,[]);
 const html=countryMapView(s,{selected:'S92000003',n:(x)=>String(x)});assert.match(html,/Шотландия/);assert.match(html,/Региональные показатели пока не загружены/);assert.equal((html.match(/<path /g)||[]).length,4);assert.equal(countryMapView(createSimulation(newGameOptions())), '');
});
test('scenario, source snapshots and population survive export, continuation and journal replay',()=>{
 let s=createSimulation({...scenarioOptions(),politicalMode:false,defenseMode:false});for(let i=0;i<6;i++)s=advanceMonth(s);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded).metrics,advanceMonth(s).metrics);const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.scenario,s.scenario);assert.equal(replay.population,s.population);
 const bad=JSON.parse(exportSimulation(s));bad.state.scenario.geography.territories[1].parent='missing';assert.throws(()=>importSimulation(JSON.stringify(bad)));
});
test('geography allows independent administrative and electoral layers and rejects cycles and duplicate IDs',()=>{
 const d=scenarioOptions().scenario;d.geography.layers.push({id:'constituencies-2000',kind:'electoral',validFrom:2000,validTo:2005});d.geography.territories.push({id:'test-seat',name:'Test',parent:'S92000003',layer:'constituencies-2000'});validateScenarioDefinition(d);d.geography.territories[0].parent='test-seat';assert.throws(()=>validateScenarioDefinition(d),/Цикл/);
 assert.equal(aggregateTerritoryObservations([],['a','b'],'population'),null);assert.equal(aggregateTerritoryObservations([{territoryId:'a',key:'population',date:2000,value:2},{territoryId:'b',key:'population',date:2000,value:3}],['a','b'],'population'),5);
});
test('opening financial stocks and service composition are reusable inputs and replay without extra accounts',()=>{
 const options={...newGameOptions(),politicalMode:false,defenseMode:false,initialFinancialStocks:{domesticDebtGDP:30,externalDebtGDP:5,governmentCashGDP:2,reservesGDP:4,domesticCoupon:.04,externalCoupon:.03},initialServiceShares:[.1,.2,.1,.2,.1,.1,.1,.1]};let s=createSimulation(options);
 near(s.government.domesticBonds.reduce((v,b)=>v+b.principal,0),s.base.monthlyGDP*12*.3);near(s.government.externalBonds.reduce((v,b)=>v+b.principal,0),s.base.monthlyGDP*12*.05);near(s.productMarkets.products.find(p=>p.id==='transport').referenceShare,.1);
 s=advanceMonth(s);assert.deepEqual(replayJournal(s).metrics,s.metrics);assert.deepEqual(importSimulation(exportSimulation(s)).initialServiceShares,s.initialServiceShares);
});

test('Britain supports choosing a party and replayable opening parliaments',()=>{
  const start=(party,nameSeed)=>createSimulation(scenarioOptions('uk-2000',{party,nameSeed}));
  const first=start('green',1), second=start('green',2), chosen=start('libertarian',1);
  const own=s=>s.politics.parties.find(p=>p.id===s.politics.executive.playerParty);
  const seats=s=>s.politics.parties.map(p=>p.seats);
  assert.equal(own(first).family,'green');
  assert.equal(own(chosen).family,'libertarian');
  assert.equal(seats(first).reduce((a,b)=>a+b),659);
  assert.notDeepEqual(seats(first),seats(second));
  assert.deepEqual(seats(first),seats(start('green',1)));
  assert.deepEqual(seats(first),seats(replayJournal(first)));
  assert.equal(replayJournal(first).politics.nameSeed,1);
  assert.equal(own(importSimulation(exportSimulation(chosen))).family,'libertarian');
});

test('guided British openings give the player a plurality and a usable coalition',async()=>{
 const {PARLIAMENTARY_CATALOG,openingCoalitionPartner}=await import('../src/parliamentary.js');
 const {executePolitical}=await import('../src/political-system.js');
 for(const [i,{id}] of PARLIAMENTARY_CATALOG.entries()){
  const options=scenarioOptions('uk-2000',{party:id,nameSeed:i*7919+52});
  const s=createSimulation({...options,politicalOptions:{...options.politicalOptions,
   guidedOpening:1,openingPollRevision:1,politicalDynamicsRevision:1,governmentGoalsRevision:1}});
  const p=s.politics,own=p.parties.find(x=>x.id===p.executive.playerParty),partner=openingCoalitionPartner(s);
  assert.ok(own.seats>=264&&own.seats<=329);
  for(const row of p.poll.parties)near(row.share,100*p.parties.find(party=>party.id===row.id).seats/p.totalSeats);
  near(s.metrics.governmentPartyRating,100*own.seats/p.totalSeats);
  const frame=p.partyHistory[0].parties.find(row=>row.id===own.id);
  near(frame.share,100*own.seats/p.totalSeats);
  assert.ok(p.parties.every(x=>x===own||x.seats<own.seats));
  assert.ok(partner);
  const election=p.elections[0],districts=election.districts;
  assert.equal(districts.filter(x=>x.winner===own.id).length,own.seats);
  assert.equal(districts.flatMap(x=>x.votes).reduce((a,b)=>a+b),election.voters);
  if(i===0){
   const replay=replayJournal(s);
   assert.deepEqual(replay.politics.elections,p.elections);
   assert.deepEqual(replay.politics.poll,p.poll);
  }
  executePolitical(s,{kind:'negotiateCoalition',partyId:partner.id,mode:'accept'});
  executePolitical(s,{kind:'formCabinet'});
  assert.equal(p.executive.primeMinisterParty,own.id);
  assert.equal(p.parliamentary.phase,'government');
 }
});

test('a liberal opening from an older save can align the poll without changing its election',async()=>{
 const {executePolitical}=await import('../src/political-system.js');
 const options=scenarioOptions('uk-2000',{party:'liberal',nameSeed:37});
 const legacy=createSimulation({...options,politicalOptions:{...options.politicalOptions,guidedOpening:1,politicalDynamicsRevision:1}});
 const state=importSimulation(exportSimulation(legacy));
 const own=state.politics.parties.find(p=>p.id===state.politics.executive.playerParty);
 const seatShare=100*own.seats/state.politics.totalSeats;
 assert.ok(seatShare-state.metrics.governmentPartyRating>15);
 executePolitical(state,{kind:'alignOpeningPoll'});
 near(state.metrics.governmentPartyRating,seatShare);
 near(state.history.find(row=>row.month===0).governmentPartyRating,seatShare);
 assert.deepEqual(state.politics.elections,legacy.politics.elections);
 assert.deepEqual(replayJournal(state).politics.poll,state.politics.poll);
 const next=advanceMonth(state),rating=next.metrics.governmentPartyRating;
 assert.ok(Math.abs(rating-seatShare)>1e-5);
 assert.ok(Math.abs(rating-seatShare)<2);
 assert.throws(()=>executePolitical(next,{kind:'alignOpeningPoll'}),/Стартовый опрос/);
 assert.equal(next.metrics.governmentPartyRating,rating);
 assert.deepEqual(replayJournal(next).politics.poll,next.politics.poll);
});

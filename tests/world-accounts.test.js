import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMonth,createSimulation,exportSimulation,importSimulation,replayJournal,scheduleShock} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {CODEX_COUNTRIES} from '../src/codex-locations.js';
import {europeanUnionDossier,foreignCountryDossier} from '../src/foreign-country-dossier.js';
import {countryWorldFigure,europeanUnionFigure,externalWorldAccounts} from '../src/world-accounts.js';
import {WDI_GDP_2000,WDI_POPULATION_2000_2024} from '../src/world-observations.js';

import {atlasEntries} from '../src/desk-atlas.js';
import {deskAtlas} from '../src/strategy-map.js';
import {detailedTradeMarkets} from '../src/trade-partners.js';

const start = (options={}) => createSimulation({...scenarioOptions(),politicalMode:false,defenseMode:false,...options});
const sum = values => values.reduce((total,n)=>total+n,0);
const near = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-7*Math.max(1,Math.abs(expected)), `${actual} != ${expected}`);
const usa = CODEX_COUNTRIES.find(country=>country.id==='usa');

function reconcile(s){
  const external = externalWorldAccounts(s);
  const eu = Object.values(external.countries).filter(country=>country.market==='eu');
  assert.equal(eu.length,14);
  assert.equal(external.countries.GBR,undefined);
  near(external.markets.eu.realGDP,sum(eu.map(country=>country.realGDP)));
  near(external.markets.eu.population,sum(eu.map(country=>country.population)));
  near(s.metrics.worldGDPReal,s.metrics.realGDPAnnualized+sum(s.economy.regions.map(market=>market.gdp)));
  const externalNominal=sum(s.economy.regions.map(market=>market.gdp))*s.worldPriceIndex/100;
  near(s.metrics.worldGDPNominal,s.metrics.gdpUSDAnnualized+externalNominal);
  near(s.metrics.worldPopulation,s.population+sum(s.economy.regions.map(market=>market.population)));
}

test('British world accounts close at opening, advance, and drive foreign dossiers',()=>{
  const opening=start();
  reconcile(opening);
  near(opening.metrics.worldGDPNominal,WDI_GDP_2000.WLD);
  near(opening.metrics.worldPopulation,WDI_POPULATION_2000_2024.WLD[0]/1e6);
  const current=advanceMonth(opening);
  reconcile(current);
  for(const code of ['USA','FRA','IRN','IND']){
    const initial=countryWorldFigure(opening,code);
    const advanced=countryWorldFigure(current,code);
    assert.notEqual(advanced.population,initial.population);
    assert.notEqual(advanced.gdp,initial.gdp);
    near(countryWorldFigure({...current,month:24*12},code).population,WDI_POPULATION_2000_2024[code][24]/1e6);
  }
  assert.notEqual(foreignCountryDossier(opening,usa),foreignCountryDossier(current,usa));
  assert.ok(countryWorldFigure({...current,month:40*12},'USA').population>0);
});

test('a foreign-demand shock can lower real world GDP without altering historical foreign population',()=>{
  const opening=start();
  const baseline=advanceMonth(opening);
  scheduleShock(opening,{key:'foreignDemand',multiplier:.8});
  const recession=advanceMonth(opening);
  reconcile(recession);
  assert.ok(recession.metrics.worldGDPReal<opening.metrics.worldGDPReal);
  assert.ok(recession.metrics.worldGDPReal<baseline.metrics.worldGDPReal);
  assert.equal(countryWorldFigure(recession,'FRA').population,countryWorldFigure(baseline,'FRA').population);
});

test('past British turns replay with their original market equations after upgrading',()=>{
  const legacy=advanceMonth(start({economicRevision:24}),undefined,{preserveEconomicRevision:true});
  const originalEntry=JSON.stringify(legacy.journal[0]);
  const loaded=importSimulation(exportSimulation(legacy));
  const upgraded=advanceMonth(loaded);
  reconcile(upgraded);
  assert.equal(JSON.stringify(upgraded.journal[0]),originalEntry);
  const restored=importSimulation(exportSimulation(upgraded));
  assert.deepEqual(replayJournal(restored).metrics,upgraded.metrics);
  assert.deepEqual(replayJournal(restored).economy.regions,upgraded.economy.regions);
});

test('EU enlargements transfer distinct national accounts without counting them twice',()=>{
  const opening=start();
  for(const [month,count] of [[51,14],[52,24],[84,26],[162,27]]){
    const world=externalWorldAccounts(opening,month);
    const members=Object.values(world.countries).filter(country=>country.market==='eu');
    assert.equal(members.length,count);
    near(world.markets.eu.realGDP,sum(members.map(country=>country.realGDP)));
    near(world.markets.eu.population,sum(members.map(country=>country.population)));
    const legacy=externalWorldAccounts({...opening,economy:{...opening.economy,revision:27}},month);
    near(world.population,legacy.population);
    for(const key of ['importShare','exportShare'])near(sum(detailedTradeMarkets(world).map(market=>market[key])),1);
    assert.equal(world.countries.POL.market,month<52?'rest':'eu');
    assert.equal(world.countries.BGR.market,month<84?'rest':'eu');
    assert.equal(world.countries.HRV.market,month<162?'rest':'eu');
  }
  const before=externalWorldAccounts(opening,51);
  const after=externalWorldAccounts(opening,52);
  assert.ok(after.markets.rest.realGDP<before.markets.rest.realGDP);
  assert.ok(after.markets.eu.realGDP>before.markets.eu.realGDP);
  assert.ok(Math.abs(after.realGDP/before.realGDP-1)<.01);
});

test('Brussels opens the EU dossier and UK exit only removes the UK from the sum',()=>{
  const opening=start();
  const member=europeanUnionFigure(opening);
  const outsider=europeanUnionFigure({...opening,politics:{scenarioDiplomacy:{euTrade:{exitMonth:0}}}});
  assert.equal(member.members.length,15);
  assert.equal(outsider.members.length,14);
  assert.ok(member.members.includes('GBR'));
  assert.ok(!outsider.members.includes('GBR'));
  near(member.population-outsider.population,opening.population);
  near(member.gdp-outsider.gdp,opening.metrics.gdpUSDAnnualized);
  const pin=atlasEntries('world',false,true).find(entry=>entry.countryId==='eu');
  assert.equal(pin.name,'Брюссель');
  assert.equal(pin.code,'BEL');
  assert.ok(!atlasEntries('world',false,false).some(entry=>entry.countryId==='eu'));
  assert.match(deskAtlas(opening,true),/data-atlas-foreign="eu"/);
  assert.doesNotMatch(deskAtlas(opening,false),/data-atlas-foreign="eu"/);
  assert.match(europeanUnionDossier(opening),/codex-flags\/eu.svg/);
  assert.match(europeanUnionDossier(opening),/data-atlas-foreign="france"/);
  assert.match(europeanUnionDossier(advanceMonth(opening)),/Импорт Британии/);
});

test('rev 27 saves upgrade to the current EU model and replay across the 2004 enlargement',()=>{
  const old=advanceMonth(start({economicRevision:27,startYear:2004}),undefined,{preserveEconomicRevision:true});
  const loaded=importSimulation(exportSimulation(old));
  const upgraded=advanceMonth(loaded);
  assert.equal(upgraded.economy.revision,28);
  const enlarged=advanceMonth(advanceMonth(upgraded));
  assert.equal(europeanUnionFigure(enlarged).members.length,25);
  assert.ok(Math.abs(enlarged.lastReport.external.partners[0].growth)<5);
  assert.deepEqual(replayJournal(importSimulation(exportSimulation(enlarged))).economy.regions,enlarged.economy.regions);
});

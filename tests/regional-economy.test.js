import {sectorCompanies} from '../src/enterprise-market.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMonth, createSimulation, exportSimulation, importSimulationData, replayJournal} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {UK_REGIONS_2000} from '../src/uk-regional-calibration.js';
import {CODEX_REGIONS,regionArticle} from '../src/codex-locations.js';
import {atlasEntries} from '../src/desk-atlas.js';
import {DESK_ATLASES} from '../src/desk-atlas-data.js';
import {atlasFrame, atlasProjection, defaultAtlasCamera} from '../src/atlas-camera.js';
import {layoutAtlasAnnotations} from '../src/atlas-map-layout.js';
import {territorialRequests,updateTerritorialEvents} from '../src/territorial-requests.js';
import {updatePress} from '../src/press-ui.js';
import {strategyMap} from '../src/strategy-map.js';

const sum = values => values.reduce((a,b) => a+b,0);
const close = (actual, expected) => {
  assert.ok(Math.abs(actual-expected) <= 1e-10*Math.max(1,Math.abs(expected)), `${actual} != ${expected}`);
};

function reconcile(state, count) {
  const {month,regions} = state.regional;
  assert.equal(month,state.month);
  assert.equal(regions.length,count);
  assert.equal(new Set(regions.map(region => region.id)).size,count);
  assert.equal(new Set(regions.map(region => region.city.id)).size,count);
  close(sum(regions.map(region => region.population)),state.population);
  for (const key of ['employment','nominalGDPMonthly','realGDPMonthly']) {
    close(sum(regions.map(region => region[key])),state.metrics[key]);
  }
  close(sum(regions.map(region => region.householdIncomeMonthly)),sum(state.incomeHistory.at(-1).net));
  for (const [i, firm] of state.firms.entries()) {
    close(sum(regions.map(region => region.sectors[i].workers)),firm.workers);
    close(sum(regions.map(region => region.sectors[i].output)),firm.production);
    if (state.lastReport.gdp) {
      close(sum(regions.map(region => region.sectors[i].nominalValueAdded)),state.lastReport.gdp.sectorValueAdded[i]);
    }
  }
  for (const region of regions) {
    assert.ok(region.city.population > 0 && region.city.population <= region.population);
    assert.ok(region.city.employment > 0 && region.city.employment <= region.employment);
    assert.ok(region.city.nominalGDPMonthly > 0 && region.city.nominalGDPMonthly <= region.nominalGDPMonthly);
  }
}

test('abstract and UK regional accounts reconcile at opening and under new policies', () => {
  for (const [options,count] of [[{},10],[scenarioOptions(),12]]) {
    let state = createSimulation(options);
    reconcile(state,count);
    state = advanceMonth(state,{...state.policy,vat:24});
    reconcile(state,count);
    state = advanceMonth(state);
    reconcile(state,count);
  }
});

test('ONS population, sector and city concentrations remain distinct in the UK allocation', () => {
  const state = createSimulation(scenarioOptions());
  const {regions} = state.regional;
  const get = id => regions.find(region => region.id === id);
  const london = get('TLI');
  const westMidlands = get('TLG');
  assert.equal(london.city.sameTerritory,true);
  assert.equal(london.city.population,london.population);
  assert.equal(london.city.employment,london.employment);
  assert.deepEqual(london.city.sectors,london.sectors);
  assert.ok(london.sectors[4].workers > westMidlands.sectors[4].workers);
  assert.ok(london.sectors[2].workers < westMidlands.sectors[2].workers);
  assert.ok(london.householdIncomeMonthly/london.population > get('TLC').householdIncomeMonthly/get('TLC').population);
  const northeast = get('TLC');
  const observed = UK_REGIONS_2000.find(region => region.id === northeast.id);
  close(northeast.city.population/northeast.population,observed.city.population/observed.population);
  const industry=northeast.sectors.find(sector=>sector.id==='industry');
  const cityIndustry=northeast.city.sectors.find(sector=>sector.id==='industry');
  close(cityIndustry.nominalValueAdded/industry.nominalValueAdded,561/observed.sectorGvaMillionGBP[2]);
});

test('older saves regenerate regional accounts and the journal replays the same allocation', () => {
  const state = advanceMonth(createSimulation(scenarioOptions()));
  const olderSave = JSON.parse(exportSimulation(state));
  delete olderSave.state.regional;
  const restored = importSimulationData(olderSave);
  assert.deepEqual(restored.regional,state.regional);
  assert.deepEqual(replayJournal(restored).regional,state.regional);
  assert.deepEqual(advanceMonth(restored).regional,advanceMonth(state).regional);
});

test('the national atlas anchors regional cities and Edinburgh at their city coordinates', () => {
  const atlas = DESK_ATLASES.national;
  const entries = atlasEntries('national',false);
  assert.equal(entries.filter(entry => entry.mark === 'regional-city').length,12);
  assert.equal(entries.filter(entry => entry.mark === 'capital').length,1);
  assert.ok(atlasEntries('national',true).every(entry => entry.mark === undefined));
  assert.ok(!atlasEntries('world',false).some(entry => entry.mark === 'regional-city'));
  const projection = atlasProjection(atlas,'national',1366,650);
  const options = {obstacles:[],measure:() => 80,hasEvent:true,world:false};
  const overview = atlasFrame(defaultAtlasCamera(projection),projection);
  const {markers} = layoutAtlasAnnotations(entries,atlas,overview,options);
  assert.equal(markers.filter(marker => marker.mark === 'regional-city').length,12);
  for (const region of UK_REGIONS_2000) {
    const city = entries.find(entry => entry.name === region.city.name);
    const mark = region.id === 'TLI' ? 'capital' : 'regional-city';
    const frame = atlasFrame({x:city.x,y:city.y,zoom:projection.defaultZoom*2},projection);
    const layout = layoutAtlasAnnotations(entries,atlas,frame,options);
    const marker = layout.markers.find(item => item.entry === city);
    assert.equal(marker.mark,mark);
    assert.deepEqual([marker.x,marker.y],frame.project(city.x,city.y));
  }
});

test('regional people, services, physical assets and financial flows reconcile', () => {
  for (const options of [{}, scenarioOptions()]) {
    const opening = createSimulation(options);
    const state = advanceMonth(opening);
    for (const snapshot of [opening,state]) {
      const {regions} = snapshot.regional;
      const by = read => sum(regions.map(read));
      for (const [i,key] of ['children','workingAge','elderly'].entries()) {
        close(by(r => r.demography[key]),snapshot.ageCohorts[i]);
      }
      close(by(r => r.demography.births),snapshot.demography.births);
      close(by(r => r.demography.deaths),snapshot.demography.deaths);
      close(by(r => r.demography.childrenUnderFive),sum(snapshot.demography.female.slice(0,60))+sum(snapshot.demography.male.slice(0,60)));
      close(by(r => r.labor.laborForce),snapshot.metrics.laborForce);
      close(by(r => r.labor.unemployed),Math.max(0,snapshot.metrics.laborForce-snapshot.metrics.employment));
      close(by(r => r.infrastructure.capitalStock),snapshot.infrastructure);
      close(by(r => r.households.consumptionVolume),snapshot.metrics.consumption);
      close(by(r => r.investment.volume),snapshot.metrics.investment);
      close(by(r => r.households.costOfLivingIndex*r.householdIncomeMonthly)/
        by(r => r.householdIncomeMonthly),snapshot.consumerPriceIndex);
      close(by(r => r.finance.householdDeposits),sum(snapshot.households.map(h => h.cash)));
      close(by(r => r.finance.householdCredit),sum(snapshot.households.map(h => h.loanLC+h.loanFX*snapshot.exchangeRate)));
      for (const [service,coverage,capacity,privateSpending] of [
        ['health','healthCoverage','publicHealthCapacity','privateHealth'],
        ['education','educationCoverage','publicEducationCapacity','privateEducation'],
      ]) {
        const need = by(r => r.publicServices[service].need);
        close(by(r => r.publicServices[service].coveredNeed),need*snapshot.services[coverage]);
        close(by(r => r.publicServices[service].publicCapacity),need*snapshot.services[capacity]);
        close(by(r => r.publicServices[service].privateSpending),snapshot.services[privateSpending]);
        close(by(r => r.publicServices[service].coveredElsewhere),by(r => r.publicServices[service].providedToOtherRegions));
        for (const region of regions) {
          const item = region.publicServices[service];
          const used = item.coveredNeed-item.coveredElsewhere+item.providedToOtherRegions;
          assert.ok(used <= item.publicCapacity+item.estimatedPrivateCapacity+1e-10);
        }
      }
      if (snapshot.settlements) {
        close(by(r => r.geography.urbanResidents),snapshot.population*sum(snapshot.settlements.groups.map(
          (group,i) => group.urbanShare*snapshot.households[i].population)));
      }
      if (snapshot.social) {
        close(by(r => r.housing.publicHomes),snapshot.social.housing.publicStock);
        close(by(r => r.housing.privateHomes),snapshot.social.housing.privateStock);
      }
      for (const region of regions) {
        close(region.demography.children,region.demography.childrenUnderFive+region.demography.schoolAge);
        close(region.population,region.geography.urbanResidents+region.geography.ruralResidents);
        close(region.labor.laborForce,region.labor.employedResidents+region.labor.unemployed);
        assert.ok(region.labor.unemploymentRate >= 0 && region.labor.unemploymentRate <= 1);
        assert.ok(region.agriculture.farmlandKm2 > 0 && region.agriculture.farmlandKm2 <= region.geography.landKm2);
        if (snapshot.social) close(region.housing.homes,region.housing.publicHomes+region.housing.privateHomes);
        if (snapshot.settlements) close(region.housing.homes,region.housing.urbanHomes+region.housing.ruralHomes);
        for (const service of Object.values(region.publicServices)) assert.ok(service.coverage >= 0 && service.coverage <= 1+1e-10);
        if (!snapshot.month) {
          assert.equal(region.fiscal.healthcare,null);
          assert.equal(region.demography.netMigration,null);
        }
      }
      if (snapshot.month) {
        for (const key of ['tax','transfers','healthcare','education','childcare','infrastructureMaintenance']) {
          close(by(r => r.fiscal[key]),snapshot.lastReport.fiscal[key]);
        }
        close(by(r => r.demography.netMigration),snapshot.demography.netMigration);
        close(by(r => r.trade.estimatedImportUseMonthly),snapshot.lastReport.gdp.imports);
        for (const [i,region] of regions.entries()) {
          const {births,deaths,netMigration} = region.demography;
          close(region.population,opening.regional.regions[i].population+births-deaths+netMigration);
        }
      }
    }
  }
});

test('UK regional starting conditions vary with observed geography and service needs', () => {
  const state = createSimulation(scenarioOptions());
  const {regions} = state.regional;
  const get = id => regions.find(r => r.id===id);
  const london = get('TLI'), northeast = get('TLC'), southeast = get('TLJ');
  assert.ok(northeast.labor.unemploymentRate > southeast.labor.unemploymentRate);
  assert.notEqual(london.labor.employedResidents,london.employment);
  assert.ok(london.geography.densityPerKm2 > southeast.geography.densityPerKm2);
  assert.equal(london.geography.referenceUrbanShare,1);
  assert.ok(get('TLN').demography.children/get('TLN').population > london.demography.children/london.population);
  assert.notEqual(london.publicServices.health.capacityPerNeed,northeast.publicServices.health.capacityPerNeed);
  assert.notEqual(london.publicServices.education.capacityPerNeed,southeast.publicServices.education.capacityPerNeed);
  close(sum(regions.map(r => r.agriculture.farmlandKm2)),169640);
  assert.ok(regions.every(r => r.infrastructure.roadsKm > 0));
});

test('Scottish city and residual accounts reconcile, with different sector mixes over time',()=>{
  const start=createSimulation({...scenarioOptions(),politicalMode:false,defenseMode:false});
  let state=start;
  for(let i=0;i<12;i++)state=advanceMonth(state);
  const scotland=s=>s.regional.regions.find(region=>region.id==='TLM');
  const sc=scotland(state);
  const parts=[...sc.cities,sc.remainder];
  assert.deepEqual(parts.map(area=>area.id),['S12000049','S12000036','TLM-rest']);
  const article=regionArticle(CODEX_REGIONS.find(region=>region.id==='TLM'),sc);
  assert.match(article,/Расчётный ВВП за месяц/);
  assert.match(article,/Глазго.*Эдинбург.*Остальная территория/);
  for(const key of ['population','employment','nominalGDPMonthly','realGDPMonthly','householdIncomeMonthly'])
    close(sum(parts.map(area=>area[key])),sc[key]);
  for(const [j,sector] of sc.sectors.entries()){
    for(const key of ['capitalStock','capacity','output','workers','realValueAdded','nominalValueAdded','exports'])
      close(sum(parts.map(area=>area.sectors[j][key])),sector[key]);
    close(sum(state.regional.regions.map(region=>region.sectors[j].capitalStock)),state.firms[j].capital);
  }
  const cityRatio=s=>scotland(s).cities[1].realGDPMonthly/scotland(s).cities[0].realGDPMonthly;
  assert.ok(Math.abs(cityRatio(state)-cityRatio(start))>1e-5);
  assert.ok(state.regionalProduction.some((sector,i)=>
    sector.capital.some((weight,j)=>Math.abs(weight-start.regionalProduction[i].capital[j])>1e-5)));
});

test('UK saves from before regional production migrate at the next calculated turn',()=>{
  const legacy=advanceMonth(createSimulation({...scenarioOptions(),economicRevision:25,politicalMode:false,defenseMode:false}),undefined,{preserveEconomicRevision:true});
  assert.equal(legacy.regionalProduction,undefined);
  const next=advanceMonth(importSimulationData(JSON.parse(exportSimulation(legacy))));
  assert.equal(next.economy.revision,27);
  assert.deepEqual(next.journal[0],legacy.journal[0]);
  assert.deepEqual(replayJournal(next).regionalProduction,next.regionalProduction);
});

test('individual British companies have stable modelled locations across turns, old saves and journal replay',()=>{
  const state=createSimulation(scenarioOptions());
  const locations=s=>Object.fromEntries(s.firms.flatMap((_,sector)=>sectorCompanies(s,sector))
    .filter(company=>company.familyGroup===undefined&&!company.agricultureProtectionClaim)
    .map(company=>[company.id,company.location]));
  const opening=locations(state);
  assert.ok(Object.keys(opening).length>1);
  for(const location of Object.values(opening)){
    assert.ok(location);
    const region=state.regional.regions.find(row=>row.id===location.regionId);
    assert.ok(region.cities.some(city=>city.id===location.cityId));
  }
  const next=advanceMonth(state);
  for(const [id,location] of Object.entries(opening))assert.deepEqual(locations(next)[id],location);
  assert.deepEqual(locations(replayJournal(next)),locations(next));

  const save=JSON.parse(exportSimulation(next));
  for(const company of save.state.enterpriseMarket.companies)delete company.location;
  for(const market of save.state.firmMarkets.markets)for(const company of market.companies)delete company.location;
  assert.deepEqual(locations(importSimulationData(save)),locations(next));
});

test('specialized capacity and employment fall at the closed factory’s production sites',()=>{
  const opening=()=>createSimulation({...scenarioOptions(),politicalMode:false,defenseMode:false});
  const firm=state=>sectorCompanies(state,2)[0];
  const scotland=state=>state.regional.regions.find(region=>region.id==='TLM');
  const site={regionId:'TLM',cityId:'S12000049',share:.15};
  const officeElsewhere={regionId:'TLG',cityId:'E08000025'};
  const located=opening();
  firm(located).sites=[site,{regionId:'TLL',cityId:'W06000015',share:.10}];
  firm(located).location=officeElsewhere;
  const running=advanceMonth(located);
  const moved=opening();
  firm(moved).sites=[{...site,...officeElsewhere},located.enterpriseMarket.companies[0].sites[1]];
  const movedMonth=advanceMonth(moved);
  close(running.metrics.nominalGDPMonthly,movedMonth.metrics.nominalGDPMonthly);
  const glasgow=state=>scotland(state).cities.find(city=>city.id===site.cityId).sectors[2];
  close(glasgow(running).workers-glasgow(movedMonth).workers,firm(running).workers*site.share);
  assert.ok(glasgow(running).nominalValueAdded>glasgow(movedMonth).nominalValueAdded);

  firm(located).active=false;
  const closed=advanceMonth(located);
  assert.equal(firm(closed).production,0);
  assert.equal(firm(closed).workers,0);
  assert.ok(glasgow(closed).workers<glasgow(running).workers);
  assert.ok(glasgow(closed).nominalValueAdded<glasgow(running).nominalValueAdded);
  const product=state=>state.productMarkets.products.find(row=>row.id==='materials');
  assert.deepEqual(firm(running).products,['materials']);
  assert.ok(product(closed).installedShare<product(running).installedShare);
  reconcile(running,12);
  reconcile(closed,12);
});

test('a closure produces one local request, a newspaper issue and a map pin',()=>{
  const opening=createSimulation({...scenarioOptions(),territorialGovernment:true});
  const company=state=>sectorCompanies(state,2)[0];
  company(opening).sites=[{regionId:'TLM',cityId:'S12000049',share:.15},{regionId:'TLI',cityId:'TLI',share:.04}];
  const next=advanceMonth(opening);
  company(next).active=false;
  company(next).workers=0;
  delete company(next).operatingSites;
  updateTerritorialEvents(next,opening);
  const requests=territorialRequests(next,{});
  const request=requests.find(row=>row.id.startsWith('territorial:closure:'));
  assert.ok(request);
  assert.equal(request.appeal.territoryId,'S12000049');
  assert.equal(request.appeal.programme,'retraining');
  assert.match(request.detail,/Глазго.*Лондон/);
  assert.match(strategyMap(next,{requests}),/data-request-place="Глазго" data-request-kind="city"/);
  const press={};
  updatePress(next,press);
  assert.ok(Object.values(press.editions).flat().some(row=>row.id===request.id));
  const restored=importSimulationData(JSON.parse(exportSimulation(next)));
  assert.ok(territorialRequests(restored,{}).some(row=>row.id===request.id));
  const later=advanceMonth(next);
  assert.ok(territorialRequests(later,{}).some(row=>row.id===request.id));
  assert.ok(!later.territorialEvents.news.some(row=>row.id===request.id));
  assert.ok(!territorialRequests(later,{resolvedTerritorialRequests:[request.id]}).some(row=>row.id===request.id));
});

test('a shortage in a region appears after three months and resolves independently of the press',()=>{
  const before=createSimulation({...scenarioOptions(),territorialGovernment:true});
  const state=advanceMonth(before);
  state.month=3;
  state.regionalStatus.history=[90,62,58,52].map((health,month)=>({month,regions:{TLM:{health}}}));
  state.territorialGovernment.last={rows:[{id:'TLM',regionId:'TLM',spending:10}]};
  state.territorialGovernment.accounts.TLM.cash=0;
  updateTerritorialEvents(state,before);
  const request=territorialRequests(state,{}).find(row=>row.appeal.programme==='healthcare');
  assert.equal(request.appeal.territoryId,'TLM');
  assert.equal(request.appeal.city,false);
  const atlas=DESK_ATLASES.national;
  const projection=atlasProjection(atlas,'national',1440,900);
  const frame=atlasFrame(defaultAtlasCamera(projection),projection);
  const layout=layoutAtlasAnnotations(atlasEntries('national',false),atlas,frame,{
    obstacles:[],measure:()=>50,hasEvent:true,requests:[{id:request.id,kind:'region',name:'Шотландия'}],world:false,
  });
  assert.ok(layout.requestPositions.get(request.id));
  const next={...state,month:4,regionalStatus:{history:[...state.regionalStatus.history,{month:4,regions:{TLM:{health:80}}}]}};
  updateTerritorialEvents(next,state);
  assert.ok(!territorialRequests(next,{}).some(row=>row.id===request.id));
});

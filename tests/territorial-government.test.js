import {territorialDebt} from '../src/territorial-assets.js';
import {industryCompanies} from '../src/enterprise-market.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceMonth,createSimulation,executePolitical,exportSimulation,importSimulationData,replayJournal} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {conductElection,territorialVotes} from '../src/electorate.js';
import {territorialCash,territorialGeography,territorialOffice,updateTerritorialOffices} from '../src/territorial-government.js';
import {territorialProgrammeGDP} from '../src/territorial-programs.js';
import {diplomacyAmounts,diplomacyGDPBase,scenarioOrganizations} from '../src/scenario-diplomacy.js';
import {scenarioDiplomacyPanel} from '../src/scenario-diplomacy-ui.js';
import {regionDossier,cityDossier,BRITISH_CITIES} from '../src/city-dossier.js';
import {constitutionBoard,constitutionPatch,stageConstitution} from '../src/constitution-ui.js';

const sum=values=>values.reduce((a,b)=>a+b,0);
function campaign(tax='central',spending='local',elections=true){
  const options=scenarioOptions();
  return createSimulation({...options,territorialGovernment:true,policy:{...options.policy,localElections:elections,municipalServicesShare:40},
    politicalOptions:{...options.politicalOptions,constitution:{...options.politicalOptions.constitution,territorialTax:tax,territorialSpending:spending}}});
}

test('territorial collections, spending and deposits reconcile in all four legal combinations',()=>{
  for(const tax of ['central','local'])for(const spending of ['central','local']){
    let state=campaign(tax,spending);
    assert.ok(Math.abs(sum(territorialGeography(state).map(a=>a.population))-state.population)<1e-8);
    state=advanceMonth(advanceMonth(state));
    const report=state.lastReport.fiscal.territorial;
    assert.equal(report.retained>0,tax==='local'&&spending==='local');
    assert.equal(report.grant>0,tax==='central'&&spending==='local');
    assert.equal(report.spending>0,spending==='local');
    assert.equal(sum(report.rows.map(row=>row.collected))>0,tax==='local');
    for(const row of report.rows)assert.ok(Math.abs(row.retained+row.remitted-row.collected)<1e-8);
    assert.ok(Math.abs(state.lastReport.audit.territorialCash)<1e-7);
    assert.ok(Math.abs(state.lastReport.audit.governmentCash)<1e-7);
    assert.ok(Math.abs(state.lastReport.audit.bankBalance)<1e-7);
    assert.equal(territorialCash(state)>1e-7,tax==='local'&&spending==='local'||report.grantReserve>1e-7);
    assert.deepEqual(importSimulationData(JSON.parse(exportSimulation(state))).territorialGovernment,state.territorialGovernment);
    assert.deepEqual(replayJournal(state).territorialGovernment,state.territorialGovernment);
  }
});

test('a term ends in an election or a vacancy, and appointments use the player party',()=>{
  const state=campaign();
  const office=state.territorialGovernment.offices['TLE:region'];
  const old=state.territorialGovernment.people[office.personId];
  state.month=office.until;
  updateTerritorialOffices(state,territorialVotes);
  const replacement=state.territorialGovernment.people[office.personId];
  assert.notEqual(replacement.id,old.id);
  assert.equal(replacement.partyId,office.election.partyId);
  assert.equal(office.until,state.month+48);
  assert.equal(old.to,state.month);
  state.policy.localElections=false;
  state.month=office.until;
  updateTerritorialOffices(state,territorialVotes);
  assert.equal(office.personId,null);
  state.politics.executive.primeMinisterParty=state.politics.executive.playerParty;
  state.politics.parliamentary.phase='government';
  executePolitical(state,{kind:'appointTerritorialLeader',officeId:office.id});
  assert.equal(state.territorialGovernment.people[office.personId].partyId,state.politics.executive.playerParty);
  assert.throws(()=>executePolitical(state,{kind:'appointTerritorialLeader',officeId:office.id}),/свободной/);
});

test('national results allocate exactly across territories and laws stage independent settings',()=>{
  const state=campaign();
  const election=conductElection(state,'parliament');
  assert.ok(election.districts.every(d=>d.territoryId));
  assert.ok(election.territories.every(area=>election.districts.some(d=>d.territoryId===area.id)));
  for(const result of election.results){
    assert.equal(sum(election.territories.map(area=>area.results.find(row=>row.id===result.id).votes)),result.votes);
  }
  const ui={section:'territories',patch:{}};
  stageConstitution(state,ui,'territorialSpending','central');
  stageConstitution(state,ui,'localElections',false);
  assert.deepEqual(constitutionPatch(state,ui),{territorialSpending:'central'});
  assert.equal(ui.patch.localElections,false);
  const html=constitutionBoard(state,ui,{esc:String,n:String,date:String});
  assert.match(html,/<h2>Законы страны<\/h2>/);
  assert.match(html,/Назначение центром/);
});

test('the cabinet pays one-off city and region programmes through the central budget and replays them',()=>{
  const options=scenarioOptions();
  let state=createSimulation({...options,territorialGovernment:true,parameters:{...options.parameters,publicInvestmentDelay:3},
    politicalOptions:{...options.politicalOptions,decisionLimit:undefined}});
  executePolitical(state,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(state,{kind:'formCabinet'});
  executePolitical(state,{kind:'territorialProgramme',officeId:'E08000035:city',programme:'education',amount:15});
  executePolitical(state,{kind:'territorialProgramme',officeId:'TLE:region',programme:'publicInvestment',amount:25});
  assert.throws(()=>executePolitical(state,{kind:'territorialProgramme',officeId:'TLE:region',programme:'healthcare',amount:state.government.cash}),/недостаточно/);
  assert.deepEqual(importSimulationData(JSON.parse(exportSimulation(state))).territorialGovernment.programs,state.territorialGovernment.programs);

  state=advanceMonth(state);
  const report=state.lastReport.fiscal;
  const [education,investment]=report.territorialPrograms;
  assert.ok(education.paid>0&&education.paid<=15+1e-8);
  assert.equal(education.territoryId,'E08000035');
  assert.equal(education.regionId,'TLE');
  assert.ok(investment.paid>0&&investment.paid<=25+1e-8);
  assert.equal(state.territorialGovernment.programs.length,0);
  assert.ok(Math.abs(report.territorial.centralPurchases+report.territorial.spending-report.purchases)<1e-8);
  assert.ok(Math.abs(sum(state.regional.regions.map(region=>region.publicServices.education.publicSpending))-report.education)<1e-8);
  assert.ok(Math.abs(state.lastReport.audit.governmentCash)<1e-7);
  assert.ok(Math.abs(state.lastReport.audit.territorialCash)<1e-7);
  const project=state.projects.find(row=>row.territory?.id==='TLE');
  assert.ok(project);
  while(state.month<project.due)state=advanceMonth(state);
  assert.ok(state.territorialGovernment.programmeAssets.TLE.networks.roads>0);
  assert.deepEqual(replayJournal(state).territorialGovernment,state.territorialGovernment);
});

test('independent local rates, GDP-indexed programmes and takeover reconcile across a fiscal reform',()=>{
  const options=scenarioOptions();
  const constitution={...options.politicalOptions.constitution,territorialTax:'local',territorialSpending:'local'};
  let state=createSimulation({...options,territorialGovernment:true,
    policy:{...options.policy,vat:0},politicalOptions:{...options.politicalOptions,constitution,decisionLimit:undefined}});
  executePolitical(state,{kind:'reformTerritorialFiscal'});
  executePolitical(state,{kind:'activateScenarioDiplomacy'});
  executePolitical(state,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(state,{kind:'formCabinet'});
  const territory='E08000035';
  const base=territorialProgrammeGDP(state,territory,true);
  executePolitical(state,{kind:'territorialProgramme',officeId:territory+':city',programme:'localBudget',share:.25});
  assert.ok(Math.abs(state.territorialGovernment.programs[0].amount-base*.0025)<1e-9);
  const un=scenarioOrganizations(state).find(org=>org.id==='un');
  executePolitical(state,{kind:'setDiplomacyShare',organization:un.id,share:.000045});
  assert.ok(Math.abs(diplomacyAmounts(state,un,0).program-diplomacyGDPBase(state)*.000045)<1e-9);
  assert.match(scenarioDiplomacyPanel(state,'un',''),/type="range"/);
  assert.match(scenarioDiplomacyPanel(state,'un',''),/% ВВП/);

  state=advanceMonth(state);
  let report=state.lastReport.fiscal;
  assert.equal(state.policy.vat,0);
  assert.ok(report.localTax.vat>0);
  assert.ok(Math.abs(report.localTax.vat-report.vat)<1e-8);
  assert.ok(report.territorialGrants[0].paid>0);
  assert.ok(Math.abs(report.territorial.retained-sum(Object.values(report.localTax)))<1e-7);
  assert.equal(report.territorial.grant,0);
  assert.ok(Object.values(state.territorialGovernment.fiscal.taxRates).some(r=>r.vat>0));
  const localFiscal=state.territorialGovernment.fiscal;
  state=advanceMonth(state);
  report=state.lastReport.fiscal;
  assert.ok(report.territorial.spending>0);
  assert.deepEqual(replayJournal(state).territorialGovernment,state.territorialGovernment);
  assert.deepEqual(importSimulationData(JSON.parse(exportSimulation(state))).territorialGovernment,state.territorialGovernment);

  const previousRates=state.territorialGovernment.fiscal.rates;
  state.politics.constitution.territorialTax='central';
  state.politics.constitution.territorialSpending='central';
  state=advanceMonth(state);
  report=state.lastReport.fiscal;
  const fiscal=state.territorialGovernment.fiscal;
  assert.deepEqual(fiscal.centralRates,previousRates);
  assert.ok(localFiscal.rates.vat>0);
  assert.ok(Object.values(fiscal.taxRates).every(r=>r.vat===0));
  assert.equal(report.territorial.retained,0);
  assert.equal(report.territorial.spending,0);
  assert.ok(report.territorialPrograms.some(row=>row.territoryId===territory&&row.paid>0));
  assert.ok(Math.abs(state.lastReport.audit.territorialCash)<1e-7);
  assert.ok(Math.abs(state.lastReport.audit.governmentCash)<1e-7);
});

test('standing territorial and international decisions renew at the chosen share of national GDP',()=>{
  const options=scenarioOptions();
  const constitution={...options.politicalOptions.constitution,territorialTax:'local',territorialSpending:'local'};
  let state=createSimulation({...options,territorialGovernment:true,
    politicalOptions:{...options.politicalOptions,constitution,decisionLimit:undefined}});
  executePolitical(state,{kind:'reformTerritorialFiscal'});
  executePolitical(state,{kind:'activateScenarioDiplomacy'});
  executePolitical(state,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(state,{kind:'formCabinet'});
  const set=(officeId,programme,share)=>executePolitical(state,{kind:'territorialProgramme',officeId,programme,share,recurring:true});
  set('E08000035:city','education',.1);
  for(const programme of ['businessSupport','agricultureProtection','localBudget'])set('TLE:region',programme,.05);
  executePolitical(state,{kind:'setDiplomacyShare',organization:'un',share:.002,budgeted:true});
  const region={id:'TLE',name:'Йоркшир и Хамбер'};
  const city=BRITISH_CITIES.find(item=>item.id==='E08000035');
  assert.match(cityDossier(state,city),/Местные налоги.*Местные расходы/s);
  assert.match(regionDossier(state,region),/Поддержка предприятий.*Поддержка сельского хозяйства/s);
  for(let turn=0;turn<2;turn++){
    const base=state.metrics.nominalGDPAnnual/12;
    const foreignBase=diplomacyGDPBase(state);
    state=advanceMonth(state);
    const {fiscal,audit}=state.lastReport;
    const school=fiscal.territorialPrograms.find(row=>row.programme==='education');
    const business=fiscal.territorialPrograms.find(row=>row.programme==='businessSupport');
    assert.ok(Math.abs(school.amount-base*.001)<1e-8);
    assert.ok(business.paid>0);
    assert.ok(Math.abs(sum(business.bySector)-business.paid)<1e-8);
    assert.ok(state.projects.some(row=>row.type==='agriculture'&&row.territory?.id==='TLE'));
    assert.ok(fiscal.territorialGrants[0].paid>0);
    assert.ok(Math.abs(fiscal.scenarioDiplomacy.un.program-foreignBase*.002)<1e-8);
    assert.ok(fiscal.scenarioDiplomacy.un.programPaid>0);
    for(const key of ['governmentCash','territorialCash','bankBalance','nominalGDP'])
      assert.ok(Math.abs(audit[key])<1e-6,`${key} · ${audit[key]}`);
  }
  assert.deepEqual(replayJournal(state).territorialGovernment,state.territorialGovernment);
  assert.deepEqual(importSimulationData(JSON.parse(exportSimulation(state))).territorialGovernment,state.territorialGovernment);
  set('E08000035:city','education',0);
  executePolitical(state,{kind:'setDiplomacyShare',organization:'un',share:.2,budgeted:true});
  assert.match(scenarioDiplomacyPanel(state,'un',''),/20,00% ВВП/);
  assert.match(scenarioDiplomacyPanel(state,'un',''),/Обязательный взнос/);
  state=advanceMonth(state);
  assert.ok(!state.lastReport.fiscal.territorialPrograms.some(row=>row.programme==='education'));
  state.politics.constitution.territorialTax='central';
  state.politics.constitution.territorialSpending='central';
  assert.doesNotMatch(regionDossier(state,region),/Местные налоги|Местные расходы/);
});

test('national transfer budgets pay each resident equally within their pool without overlapping London',()=>{
  const options=scenarioOptions();
  const policy=options.policy;
  let state=createSimulation({...options,territorialGovernment:true,policy,
    politicalOptions:{...options.politicalOptions,decisionLimit:undefined}});
  executePolitical(state,{kind:'reformTerritorialFiscal'});
  executePolitical(state,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(state,{kind:'formCabinet'});
  const setRegional=regionalBudgetTransfers=>executePolitical(state,{kind:'policyDecision',patch:{regionalBudgetTransfers}});
  const first=setRegional(.4);
  assert.equal(first.status,'passed');
  assert.equal(setRegional(.3).status,'passed');
  assert.notEqual(setRegional(.4).id,first.id);
  assert.equal(executePolitical(state,{kind:'policyDecision',patch:{cityBudgetTransfers:.2}}).status,'passed');
  executePolitical(state,{kind:'territorialProgramme',officeId:'TLE:region',programme:'localBudget',share:.05,recurring:true});

  for(let month=0;month<2;month++){
    const population=new Map(territorialGeography(state).map(area=>[area.id,area.population]));
    const base=state.metrics.nominalGDPAnnual/12;
    state=advanceMonth(state);
    const {fiscal,audit}=state.lastReport;
    const grants=fiscal.territorialGrants;
    const cities=grants.filter(row=>row.source==='cityBudgetTransfers');
    const regions=grants.filter(row=>row.source==='regionalBudgetTransfers');
    assert.ok(cities.some(row=>row.territoryId==='TLI'));
    assert.ok(regions.every(row=>!cities.some(city=>city.territoryId===row.territoryId)));
    for(const [rows,share] of [[cities,.002],[regions,.004]]){
      assert.ok(Math.abs(sum(rows.map(row=>row.paid))-base*share)<1e-7);
      const perResident=rows[0].paid/population.get(rows[0].territoryId);
      assert.ok(rows.every(row=>Math.abs(row.paid/population.get(row.territoryId)-perResident)<1e-8));
    }
    assert.ok(grants.some(row=>row.territoryId==='TLE'&&!row.source&&row.paid>0));
    assert.equal(state.policy.healthcare,policy.healthcare);
    assert.equal(state.policy.education,policy.education);
    assert.ok(Math.abs(audit.governmentCash)<1e-7);
    assert.ok(Math.abs(audit.territorialCash)<1e-7);
  }
  assert.ok(state.lastReport.fiscal.territorial.spending>0);
  assert.deepEqual(replayJournal(state).territorialGovernment,state.territorialGovernment);
  assert.deepEqual(importSimulationData(JSON.parse(exportSimulation(state))).territorialGovernment,state.territorialGovernment);
  state.politics.constitution.territorialSpending='central';
  state=advanceMonth(state);
  assert.ok((state.lastReport.fiscal.territorialGrants??[]).every(row=>!row.source&&row.paid===0));
});

test('revoking either autonomy transfers the appropriate balance-sheet items to the state',()=>{
  const options=scenarioOptions();
  let state=createSimulation({...options,territorialGovernment:true,
    policy:{...options.policy,regionalBudgetTransfers:.0002,cityBudgetTransfers:.0002},
    parameters:{...options.parameters,publicInvestmentDelay:2},
    politicalOptions:{...options.politicalOptions,decisionLimit:undefined}});
  for(const kind of ['reformTerritorialFiscal','negotiateCoalition','formCabinet'])
    executePolitical(state,{kind,partyId:'p11',mode:'accept'});
  const rail={id:1,network:'rail',kind:'networkMunicipalize',points:2};
  const equity={id:2,sector:2,kind:'municipalize',points:5,compensation:1};
  for(const action of [rail,equity])
    assert.equal(executePolitical(state,{kind:'chooseLaw',patch:{},actions:[action]}).status,'passed');
  for(let i=0;i<4;i++)state=advanceMonth(state);
  const railBefore=state.networks.find(network=>network.id==='rail');
  assert.ok(railBefore.municipal>0);
  assert.ok(Math.abs(sum(Object.values(railBefore.localOwners))-1)<1e-9);
  const holdings=industryCompanies(state).map(firm=>firm.ownership.state+firm.ownership.municipal);
  assert.ok(industryCompanies(state).some(firm=>firm.ownership.municipal>0&&Object.keys(firm.localOwners).length>1));
  assert.ok(state.lastReport.fiscal.localDividends>0);
  assert.ok(territorialDebt(state)>0);
  assert.ok(state.projects.some(project=>project.territorialOwner));
  assert.ok(state.regional.regions.reduce((total,row)=>total+row.infrastructure.networks.find(network=>network.id==='rail').municipal,0)>0);
  assert.deepEqual(importSimulationData(JSON.parse(exportSimulation(state))).territorialGovernment,state.territorialGovernment);

  assert.equal(executePolitical(state,{kind:'chooseLaw',patch:{},constitutionPatch:{territorialProperty:'central'}}).status,'passed');
  state=advanceMonth(state);
  assert.ok(territorialDebt(state)>0);
  assert.equal(state.networks.find(network=>network.id==='rail').municipal,0);
  assert.ok(industryCompanies(state).every((firm,i)=>firm.ownership.municipal===0&&Math.abs(firm.ownership.state-holdings[i])<1e-9));
  assert.ok(!state.projects.some(project=>project.territorialOwner));
  const debt=territorialDebt(state),cash=territorialCash(state);
  assert.equal(executePolitical(state,{kind:'chooseLaw',patch:{},constitutionPatch:{territorialBorrowing:'central'}}).status,'passed');
  state=advanceMonth(state);
  assert.equal(territorialDebt(state),0);
  assert.ok(Math.abs(state.lastReport.fiscal.localDebtAssumed-debt)<1e-9);
  assert.ok(Math.abs(state.lastReport.fiscal.localCashAssumed-cash)<1e-9);
  assert.ok(state.lastReport.fiscal.territorialGrants.some(row=>row.paid>0));
  for(const key of ['governmentDebt','governmentCash','territorialCash','bankBalance','nominalGDP'])
    assert.ok(Math.abs(state.lastReport.audit[key])<1e-6,`${key} · ${state.lastReport.audit[key]}`);
  assert.deepEqual(replayJournal(state).territorialGovernment,state.territorialGovernment);
});

test('new British games give both London cards the same mayor and one fiscal territory',()=>{
  const state=createSimulation({...scenarioOptions(),territorialGovernment:true,londonMayorRevision:1});
  const mayor=territorialOffice(state,'TLI',true),region=territorialOffice(state,'TLI',false);
  assert.equal(region.office,mayor.office);
  assert.equal(region.person,mayor.person);
  assert.deepEqual(Object.keys(state.territorialGovernment.offices).filter(id=>id.startsWith('TLI:')),['TLI:city']);
  assert.equal(territorialGeography(state).filter(area=>area.id==='TLI').length,1);
  const london=BRITISH_CITIES.find(city=>city.id==='TLI');
  const card=regionDossier(state,{id:'TLI',name:'Большой Лондон'});
  const city=cityDossier(state,london);
  for(const html of [city,card]){
    assert.match(html,/<small>Мэр<\/small>/);
    assert.ok(html.includes('data-character-card="'+mayor.person.id+'"'));
    assert.ok(html.includes('data-territorial-programme="TLI:city"'));
  }
  assert.deepEqual(replayJournal(state).territorialGovernment,state.territorialGovernment);
});

test('unifying offices preserves the mayor and replays old orders and budgets',()=>{
  const options=scenarioOptions();
  let state=createSimulation({...options,territorialGovernment:true,
    politicalOptions:{...options.politicalOptions,decisionLimit:undefined}});
  executePolitical(state,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(state,{kind:'formCabinet'});
  const programme=(officeId,programme,request)=>executePolitical(state,{kind:'territorialProgramme',officeId,programme,...request});
  programme('TLI:city','education',{share:.02,recurring:true});
  programme('TLI:region','education',{share:.03,recurring:true});
  programme('TLI:region','businessSupport',{amount:10});
  state=advanceMonth(state);
  programme('TLI:region','healthcare',{amount:5});
  const mayor=territorialOffice(state,'TLI',true).person.id;
  const retired=territorialOffice(state,'TLI',false).person.id;
  const cash=state.territorialGovernment.accounts.TLI.cash;
  state=importSimulationData(JSON.parse(exportSimulation(state)));
  executePolitical(state,{kind:'unifyLondonMayor'});
  const world=state.territorialGovernment;
  assert.equal(territorialOffice(state,'TLI',false).person.id,mayor);
  assert.equal(world.people[retired].to,state.month);
  assert.equal(world.accounts.TLI.cash,cash);
  assert.equal(world.standingPrograms['TLI:city|education'].share,.03);
  assert.equal(world.standingPrograms['TLI:region|education'],undefined);
  assert.equal(world.programs[0].officeId,'TLI:city');
  assert.ok(world.lastPrograms.orders.every(row=>row.officeId==='TLI:city'));
  programme('TLI:region','businessSupport',{amount:5});
  assert.equal(world.programs.at(-1).officeId,'TLI:city');
  state=advanceMonth(state);
  const restored=importSimulationData(JSON.parse(exportSimulation(state)));
  const replay=replayJournal(restored);
  assert.deepEqual(replay.territorialGovernment,restored.territorialGovernment);
  assert.deepEqual(replay.metrics,restored.metrics);
});

test('regional requests use exact standing shares and one-off grants without reopening dismissed notices',async()=>{
  const {nextTerritorialRequest,territorialRequestFunding,territorialRequests}=await import('../src/territorial-requests.js');
  const {gdpSlider,gdpSliderShare}=await import('../src/gdp-slider.js');
  const options=scenarioOptions();
  let state=createSimulation({...options,territorialGovernment:true,
    politicalOptions:{...options.politicalOptions,decisionLimit:undefined}});
  executePolitical(state,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(state,{kind:'formCabinet'});
  const service={id:'schools',appeal:{territoryId:'TLE',city:false,programme:'education'}};
  const closure={id:'closure',appeal:{territoryId:'E08000035',city:true,programme:'retraining'}};
  state.territorialEvents={active:{service,closure},news:[service,closure]};
  const press={};
  assert.equal(nextTerritorialRequest(territorialRequests(state,press),press),service);
  press.seenTerritorialRequests=[service.id];
  assert.equal(nextTerritorialRequest(territorialRequests(state,press),press),closure);
  assert.equal(territorialRequests(state,press).length,2);
  const standing=territorialRequestFunding(state,service);
  const oneOff=territorialRequestFunding(state,closure);
  assert.ok(standing.person?.name);
  assert.ok(standing.recurring&&standing.share>0);
  assert.ok(!oneOff.recurring&&oneOff.amount>0);
  const position=gdpSlider({value:standing.share,precision:'fine'}).match(/value="(\d+)" data-gdp-slider/)[1];
  assert.equal(gdpSliderShare({value:position,dataset:{gdpSlider:'fine'}}),standing.share);
  executePolitical(state,{kind:'territorialProgramme',officeId:standing.officeId,programme:standing.programme,share:standing.share,recurring:true});
  executePolitical(state,{kind:'territorialProgramme',officeId:oneOff.officeId,programme:oneOff.programme,amount:oneOff.amount});
  assert.equal(territorialRequestFunding(state,service).alreadyFunded,true);
  assert.equal(state.territorialGovernment.programs[0].amount,oneOff.amount);
  press.resolvedTerritorialRequests=[closure.id];
  assert.equal(nextTerritorialRequest(territorialRequests(state,press),press),null);
  state=advanceMonth(state);
  assert.equal(state.territorialGovernment.programs.length,0);
  assert.ok(state.territorialGovernment.lastPrograms.orders.some(order=>order.programme==='retraining'&&order.paid>0));
  assert.ok(state.territorialGovernment.standingPrograms[standing.officeId+'|education']);
});

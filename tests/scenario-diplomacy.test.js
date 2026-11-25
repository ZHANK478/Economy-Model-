import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {newGameOptions} from '../src/start-presets.js';
import {executePolitical,decisionBudget} from '../src/political-system.js';
import {diplomacyActive,exportCostProgram,scenarioDefenseReliability,settleScenarioDiplomacy} from '../src/scenario-diplomacy.js';
import {overviewEntries,overviewPanel} from '../src/overview-panel.js';

const activate = s => executePolitical(s,{kind:'activateScenarioDiplomacy'});
const choose = (s,organization,level) => executePolitical(s,{kind:'setDiplomacyLevel',organization,level});
const start = () => createSimulation(scenarioOptions());
function cabinet(s){
  executePolitical(s,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
  executePolitical(s,{kind:'formCabinet'});
}
function audits(s) {
  for (const key of ['governmentCash','bankBalance','centralBank','externalNFA','nominalGDP'])
    assert.ok(Math.abs(s.lastReport.audit[key])<1e-6,`${key}: ${s.lastReport.audit[key]}`);
}

test('scenario decisions require a government and consume one slot only on success',()=>{
  let s=start();
  activate(s);
  assert.throws(()=>choose(s,'nato',1),/правительство/);
  cabinet(s);
  s=advanceMonth(s);
  const before=decisionBudget(s).used;
  assert.throws(()=>executePolitical(s,{kind:'policyDecision',patch:{tariff:10}}),/торговой политикой ЕС/);
  assert.throws(()=>executePolitical(s,{kind:'chooseLaw',patch:{tariff:10}}),/торговой политикой ЕС/);
  assert.throws(()=>choose(s,'wto',1),/недоступна/);
  choose(s,'nato',1);
  assert.throws(()=>choose(s,'nato',1),/уже выбран/);
  assert.throws(()=>choose(s,'un',3),/недоступна/);
  assert.equal(decisionBudget(s).used,before+1);
  assert.equal(scenarioDefenseReliability(s),.70);
  s=advanceMonth(s,{...s.policy,tariff:10});
  assert.equal(s.policy.tariff,0);
  assert.ok(scenarioDefenseReliability(s)>.70);
  audits(s);
});

test('funded trade programs, accounts and decisions survive serialization and replay',()=>{
  let s=start();
  cabinet(s);
  s=advanceMonth(s);
  activate(s);
  const baseline=advanceMonth(s);
  assert.ok(baseline.lastReport.fiscal.scenarioDiplomacy.eu.receipts>0);
  assert.ok(baseline.lastReport.fiscal.scenarioDiplomacy.eu.paid>baseline.lastReport.fiscal.scenarioDiplomacy.eu.receipts);
  choose(s,'eu',2);
  s=advanceMonth(s);
  assert.deepEqual(s.lastReport.market.exports,baseline.lastReport.market.exports);
  assert.ok(s.lastReport.fiscal.scenarioDiplomacy.eu.programPaid>0);
  assert.deepEqual(exportCostProgram(s),{exposure:.543,relief:.01});
  assert.ok(s.government.lastDeficit>baseline.government.lastDeficit);
  assert.ok(s.metrics.currentAccountUSD<baseline.metrics.currentAccountUSD);
  audits(s);
  s=advanceMonth(s);
  audits(s);
  assert.deepEqual(replayJournal(s).metrics,s.metrics);
  assert.deepEqual(advanceMonth(importSimulation(exportSimulation(s))).metrics,advanceMonth(s).metrics);
});

test('arrears are carried and optional programs wait for mandatory payments',()=>{
  const s=start();
  activate(s);
  cabinet(s);
  s.politics.scenarioDiplomacy.levels.un=2;
  const missed=settleScenarioDiplomacy(s,()=>{},()=>0);
  assert.ok(missed.eu.arrears>0);
  assert.equal(missed.un.programPaid,0);
  const funded=settleScenarioDiplomacy(s,()=>{},amount=>amount);
  assert.equal(funded.eu.due,2*missed.eu.due);
  assert.equal(funded.eu.arrears,0);
  assert.ok(funded.un.programTotal>0);
});

test('other scenarios remain outside the British organization package',()=>{
  const s=createSimulation(newGameOptions());
  activate(s);
  assert.equal(diplomacyActive(s),false);
  assert.equal(overviewEntries(s,'diplomacy','policy').some(item=>item.id==='multilateral-aid'),false);
  const uk=start();
  activate(uk);
  executePolitical(uk,{kind:'enablePartnerTrade'});
  const rules=overviewEntries(uk,'diplomacy','policy');
  assert.equal(rules[0].label,'Участие в едином рынке ЕС');
  assert.ok(rules.some(item=>item.label==='Коллективная оборона в НАТО'));
  assert.doesNotMatch(overviewPanel('diplomacy','situations',0,uk),/Торговля по рынкам|Европейский союз/);
  assert.match(overviewPanel('diplomacy','policy',0,uk),/Торговля по рынкам.*54,3%.*Канада/s);
});

test('British markets allocate all settled trade and exit changes treaty and budget after the transition',()=>{
  let s=start();
  activate(s);
  executePolitical(s,{kind:'enablePartnerTrade'});
  assert.throws(()=>executePolitical(s,{kind:'notifyEUWithdrawal'}),/большинством/);
  cabinet(s);
  s=advanceMonth(s);
  const report=s.lastReport.external;
  assert.deepEqual(report.partners.map(p=>p.id),['eu','us','cn','ru','jp','ca','in','au','za','ir','rest']);
  for(const key of ['exportsUSD','importsUSD'])
    assert.ok(Math.abs(report.partners.reduce((sum,p)=>sum+p[key],0)-report[key])<1e-7,key);
  assert.ok(Math.abs(report.partners[0].exportsUSD/report.exportsUSD-.543)<.003);
  assert.ok(Math.abs(report.partners[0].importsUSD/report.importsUSD-.538)<1e-10);
  const before=decisionBudget(s).used;
  executePolitical(s,{kind:'notifyEUWithdrawal'});
  assert.equal(decisionBudget(s).used,before+1);
  assert.throws(()=>executePolitical(s,{kind:'notifyEUWithdrawal'}),/уже запущен/);
  assert.deepEqual(replayJournal(s).politics.scenarioDiplomacy,s.politics.scenarioDiplomacy);
  const exitMonth=s.politics.scenarioDiplomacy.euTrade.exitDue;
  assert.equal(exitMonth,s.month+24);
  // Compare branches over the implementation month, starting with identical
  // balance sheets and markets at the end of the waiting period.
  s.month=exitMonth-1;
  const stillMember=structuredClone(s);
  stillMember.politics.scenarioDiplomacy.euTrade={};
  const member=advanceMonth(stillMember),exited=advanceMonth(s);
  assert.equal(exited.politics.scenarioDiplomacy.euTrade.exitMonth,exitMonth);
  assert.equal(exited.lastReport.fiscal.scenarioDiplomacy.eu.receipts,0);
  assert.equal(exited.lastReport.fiscal.scenarioDiplomacy.eu.paid,0);
  assert.ok(member.lastReport.fiscal.scenarioDiplomacy.eu.receipts>0);
  const euShare=(state,key)=>state.lastReport.external.partners[0][key]/state.lastReport.external[key];
  assert.ok(euShare(exited,'exportsUSD')<euShare(member,'exportsUSD'));
  assert.ok(euShare(exited,'importsUSD')<euShare(member,'importsUSD'));
  audits(exited);
});

test('exit clears the budgeted EU programme and older post-exit saves can be restored',()=>{
  let s=start();
  activate(s);
  executePolitical(s,{kind:'enablePartnerTrade'});
  cabinet(s);
  s=advanceMonth(s);
  const setShare=(organization,share)=>executePolitical(s,{kind:'setDiplomacyShare',organization,share,budgeted:true});
  setShare('eu',.00003);
  setShare('un',.00004);
  s=advanceMonth(s);
  executePolitical(s,{kind:'notifyEUWithdrawal'});
  const exitMonth=s.politics.scenarioDiplomacy.euTrade.exitDue;
  while(s.month<exitMonth-1)s=advanceMonth(s);
  s=importSimulation(exportSimulation(s));
  assert.equal(s.politics.scenarioDiplomacy.budgeted.eu,true);
  s=advanceMonth(s);
  const diplomacy=s.politics.scenarioDiplomacy;
  assert.equal(s.month,exitMonth);
  assert.ok(!Object.hasOwn(diplomacy.shares,'eu'));
  assert.ok(!Object.hasOwn(diplomacy.budgeted,'eu'));
  assert.equal(diplomacy.budgeted.un,true);
  assert.equal(diplomacy.ledger.eu.programPaid,0);
  assert.ok(diplomacy.ledger.eu.programTotal>0);
  assert.deepEqual(importSimulation(exportSimulation(s)).politics.scenarioDiplomacy,diplomacy);
  const legacy=structuredClone(s);
  legacy.politics.scenarioDiplomacy.budgeted.eu=true;
  const restored=importSimulation(exportSimulation(legacy));
  assert.deepEqual(restored.politics.scenarioDiplomacy,diplomacy);
  assert.deepEqual(restored.journal,s.journal);
  assert.deepEqual(advanceMonth(restored).metrics,advanceMonth(s).metrics);
});

test('the optional trade course tracks funded work and actual exports, then allows continued play',()=>{
  let s=start();
  activate(s);
  executePolitical(s,{kind:'enablePartnerTrade'});
  const free=advanceMonth(s);
  assert.equal(free.politics.scenarioDiplomacy.tradeCourse,undefined);
  const used=decisionBudget(s).used;
  executePolitical(s,{kind:'startTradeCourse'});
  assert.equal(decisionBudget(s).used,used);
  cabinet(s);
  for(let i=0;i<4;i++)s=advanceMonth(s);
  assert.equal(s.politics.scenarioDiplomacy.tradeCourse.stage,0);
  choose(s,'eu',2);
  for(let i=0;i<60&&s.politics.scenarioDiplomacy.tradeCourse.stage===0;i++)s=advanceMonth(s);
  assert.equal(s.politics.scenarioDiplomacy.tradeCourse.stage,1);
  assert.equal(exportCostProgram(s).relief,.01);
  choose(s,'eu',0);
  s=advanceMonth(s);
  assert.equal(exportCostProgram(s),null);
  assert.equal(s.politics.scenarioDiplomacy.tradeCourse.months,0);
  choose(s,'eu',1);
  for(let i=0;i<3;i++)s=advanceMonth(s);
  assert.equal(s.politics.scenarioDiplomacy.tradeCourse.stage,2);
  assert.equal(exportCostProgram(s).relief,.0075);
  s=advanceMonth(s);
  assert.equal(s.politics.scenarioDiplomacy.tradeCourse.months,0);
  choose(s,'eu',2);
  for(let i=0;i<6;i++)s=advanceMonth(s);
  assert.equal(s.politics.scenarioDiplomacy.tradeCourse.stage,3);
  assert.equal(exportCostProgram(s).relief,.015);
  const restored=importSimulation(exportSimulation(s));
  assert.deepEqual(replayJournal(restored).politics.scenarioDiplomacy.tradeCourse,s.politics.scenarioDiplomacy.tradeCourse);
  const continued=advanceMonth(restored);
  assert.equal(continued.month,s.month+1);
  audits(continued);
  choose(continued,'eu',0);
  assert.equal(exportCostProgram(advanceMonth(continued)),null);
});

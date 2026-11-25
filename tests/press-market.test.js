import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,importSimulation,exportSimulation,scheduleOwnership} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {executePolitical} from '../src/political-system.js';
import {pressCompanies,pressControl,publisher} from '../src/press-market.js';
import {pressDialog,updatePress,unreadPressCount,readPressPaper,latestPressIssue} from '../src/press-ui.js';
import {codexOrganizations} from '../src/codex-organizations.js';
import {overviewPanel} from '../src/overview-panel.js';

test('press trading, ownership and sale proceeds use the existing enterprise and treasury accounts',()=>{
  let s=createSimulation(scenarioOptions());
  for(const action of [{kind:'enablePressMarket'},{kind:'activateScenarioDiplomacy'},{kind:'negotiateCoalition',partyId:'p11',mode:'accept'},{kind:'formCabinet'}])
    executePolitical(s,action);
  assert.doesNotMatch(overviewPanel('diplomacy','policy',0,s),/Открыть решения сценария/);
  assert.match(overviewPanel('diplomacy','situations',0,s),/Стабильная внешняя обстановка.*Сильный оборонный союз/s);
  s=advanceMonth(s);
  const companies=pressCompanies(s);
  assert.equal(companies.length,4);
  assert.ok(companies.every(c=>c.lastRevenue>0 && c.last.unitsSold>0));
  assert.ok(publisher(s,companies[1]).name);
  assert.equal(codexOrganizations(s).filter(o=>o.sector==='press').length,4);
  const article=pressDialog(s,companies[1].id,{},{esc:String,date:String});
  assert.match(article,/Экономика и финансы.*Пока без выпусков/s);
  assert.doesNotMatch(article,/<table|Об издателе|Выручка|государственный долг/);
  const action=scheduleOwnership(s,{sector:4,enterpriseId:companies[0].id,kind:'privatize',points:60});
  executePolitical(s,{kind:'chooseLaw',actions:[action],patch:{}});
  s=advanceMonth(s);
  assert.equal(pressControl(pressCompanies(s)[0]),'domestic');
  assert.ok(s.lastReport.fiscal.equitySales>0);
  for(const key of ['governmentCash','bankBalance','nominalGDP','externalNFA'])
    assert.ok(Math.abs(s.lastReport.audit[key])<1e-6,key);
  assert.deepEqual(pressCompanies(importSimulation(exportSimulation(s))),pressCompanies(s));
  assert.deepEqual(pressCompanies(replayJournal(s)),pressCompanies(s));
});


test('the press publishes rare events once and leaves the previous issue on quiet turns',()=>{
 const s=createSimulation(scenarioOptions());
 executePolitical(s,{kind:'enablePressMarket'});
 const press={};
 assert.equal(updatePress(s,press),true);
 assert.equal(latestPressIssue(press,'press-chronicle').id,'election:parliament:0');
 assert.ok(press.editions['press-chronicle'].some(edition=>edition.id==='millennium:0'));
 assert.equal(updatePress(s,press),false);
 assert.equal(unreadPressCount(s,press),1);
 assert.equal(readPressPaper(press,'press-chronicle'),true);
 s.month=10;
 s.politics.scenarioDiplomacy={euTrade:{exitDue:34}};
 assert.equal(updatePress(s,press),true);
 assert.equal(unreadPressCount(s,press),1);
 const id=latestPressIssue(press,'press-dispatch').id;
 assert.match(pressDialog(s,'press-dispatch',press,{esc:String,date:String}),/Лондон объявил о выходе из ЕС/);
 assert.equal(updatePress(s,press),false);
 assert.equal(readPressPaper(press,'press-dispatch'),true);
 s.month++;
 assert.equal(updatePress(s,press),false);
 assert.equal(latestPressIssue(press,'press-dispatch').id,id);
 assert.equal(unreadPressCount(s,press),0);
});

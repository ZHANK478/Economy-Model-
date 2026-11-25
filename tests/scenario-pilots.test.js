import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {executePolitical} from '../src/political-system.js';
import {pilotExportFactor,pilotRecord} from '../src/scenario-pilots.js';
import {scenarioDiplomacyPanel} from '../src/scenario-diplomacy-ui.js';
import {gdpSliderShare} from '../src/gdp-slider.js';

function opening(){
 const s=createSimulation(scenarioOptions());
 executePolitical(s,{kind:'activateScenarioDiplomacy'});
 executePolitical(s,{kind:'enablePartnerTrade'});
 executePolitical(s,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
 executePolitical(s,{kind:'formCabinet'});
 return s;
}
function run(s,count){for(let i=0;i<count;i++)s=advanceMonth(s);return s;}
const choose=(s,pilot,choice)=>executePolitical(s,{kind:'startScenarioPilot',pilot,choice});
const fund=(s,organization,share)=>executePolitical(s,{kind:'setDiplomacyShare',organization,share,budgeted:true});

test('EU membership payments and the small capped voluntary slider are independently visible',()=>{
 const s=opening();
 const html=scenarioDiplomacyPanel(s,'eu','');
 assert.match(html,/Обязательный взнос[\s\S]*Поступления в бюджет/);
 assert.match(html,/Добровольная программа <output>0,00% ВВП/);
 assert.match(html,/Акты и программы[\s\S]*Европейский инвестиционный банк/);
 const max=html.match(/max="(\d+)" step="1"/)[1];
 assert.equal(gdpSliderShare({value:max,dataset:{gdpSlider:'fine'}}),.003);
 const next=advanceMonth(s);
 assert.ok(next.lastReport.fiscal.scenarioDiplomacy.eu.paid>0);
 assert.equal(next.lastReport.fiscal.scenarioDiplomacy.eu.programPaid,0);
});

test('European outcomes depend on which proposal the same allocation funds',()=>{
 const outcome=choice=>{
   let s=opening();choose(s,'eu',choice);
   s=advanceMonth(s);fund(s,'eu',.000015);return run(s,5);
 };
 const basic=outcome('forms');
 const extended=outcome('smallFirms');
 assert.equal(pilotRecord(basic,'eu').completed,true);
 assert.equal(pilotRecord(extended,'eu').completed,false);
 assert.ok(basic.lastReport.fiscal.scenarioDiplomacy.eu.programPaid>0);
 assert.ok(basic.lastReport.events.every(event=>typeof event==='string'));
});

test('the overseas pilot spends public funds and changes only the chosen export market',()=>{
 let s=opening();choose(s,'global','canada');
 s=advanceMonth(s);fund(s,'trade-promotion',.000015);
 s=run(s,3);
 assert.equal(pilotRecord(s,'global').completed,true);
 assert.ok(s.lastReport.fiscal.scenarioDiplomacy['trade-promotion'].programPaid>0);
 assert.ok(pilotExportFactor(s,'ca')<1);
 assert.equal(pilotExportFactor(s,'au'),1);
 assert.match(scenarioDiplomacyPanel(s,'pilot-global',''),/экспортёры получили поддержку/);
 const replay=replayJournal(importSimulation(exportSimulation(s)));
 assert.deepEqual(replay.politics.scenarioDiplomacy,s.politics.scenarioDiplomacy);
 fund(s,'trade-promotion',0);s=advanceMonth(s);
 assert.equal(pilotExportFactor(s,'ca'),1);
});

test('an overseas programme that misses its opening window stops drawing its standing allocation',()=>{
 let s=opening();choose(s,'global','australia');
 s=run(s,4);
 fund(s,'trade-promotion',.000015);
 s=run(s,2);
 assert.equal(pilotRecord(s,'global').completed,false);
 assert.ok(s.lastReport.fiscal.scenarioDiplomacy['trade-promotion'].programPaid>0);
 s=advanceMonth(s);
 assert.equal(s.lastReport.fiscal.scenarioDiplomacy['trade-promotion'].programPaid,0);
 assert.equal(pilotExportFactor(s,'au'),1);
});

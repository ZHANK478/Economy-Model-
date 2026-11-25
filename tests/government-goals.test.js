import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {executePolitical} from '../src/political-system.js';
import {advanceGovernmentGoals} from '../src/government-goals.js';
import {beginFormation,installCabinet} from '../src/parliamentary.js';
import {parliamentBoard} from '../src/parliamentary-ui.js';

function start(options=scenarioOptions()){
 return createSimulation({...options,politicalOptions:{...options.politicalOptions,governmentGoalsRevision:1}});
}
const form=(s,goalId='production',milestoneId='productivity')=>executePolitical(s,{kind:'formCabinet',goalId,milestoneId});
const negotiate=s=>executePolitical(s,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
const choose=(s,milestoneId)=>executePolitical(s,{kind:'chooseGovernmentMilestone',milestoneId});
const program=s=>s.politics.governmentGoals;
const board=s=>parliamentBoard(s,{n:String,pct:String,esc:String,date:String,chart:()=>''});

test('a programme is adopted with the cabinet and the long-term choice is permanent',()=>{
 let s=start();
 assert.throws(()=>form(s),/половины/);
 assert.deepEqual(program(s),{});
 assert.doesNotMatch(board(s),/data-government-goal/);
 negotiate(s);
 assert.doesNotMatch(board(s),/data-government-goal|Цели правительства/);
 assert.throws(()=>form(s,'production','exports'),/подцель/);
 assert.deepEqual(program(s),{});
 form(s);
 assert.equal(program(s).id,'production');
 assert.equal(program(s).milestone.deadline,s.politics.nextParliamentElection);
 assert.throws(()=>form(s,'households','income'),/формировании|половины/);
 assert.throws(()=>choose(s,'gdp'),/после выполнения/);
 assert.doesNotMatch(board(s),/data-government-goal/);
 s=advanceMonth(s);
 assert.deepEqual(program(replayJournal(s)),program(s));
 assert.deepEqual(program(importSimulation(exportSimulation(s))),program(s));
});

test('a completed milestone opens the next choice and early elections close the new one',()=>{
 const s=start();
 negotiate(s);form(s);
 s.month++;
 s.metrics.productivity=program(s).milestone.target;
 advanceGovernmentGoals(s,[]);
 assert.equal(program(s).milestone.status,'completed');
 assert.doesNotMatch(board(s),/Следующая подцель/);
 choose(s,'gdp');
 assert.equal(program(s).milestone.status,'active');
 assert.doesNotMatch(board(s),/Следующая подцель/);
 s.politics.scheduledParliament=s.month+1;
 s.month++;
 advanceGovernmentGoals(s,[]);
 assert.equal(program(s).milestone.status,'expired');
 assert.equal(program(s).milestone.deadline,s.month);
 assert.throws(()=>choose(s,'productivity'),/после выполнения/);
 s.politics.scheduledParliament=null;
 s.politics.nextParliamentElection+=s.politics.constitution.parliamentTerm;
 s.politics.turnCommands=[];
 beginFormation(s);
 negotiate(s);
 assert.throws(()=>form(s,'europe','exports'),/формировании/);
 form(s,'production','gdp');
 assert.equal(program(s).milestone.deadline,s.politics.nextParliamentElection);
});

test('a long-term goal can be achieved after a lost cabinet, even past its old deadline',()=>{
 const s=start();
 negotiate(s);form(s);
 const deadline=program(s).milestone.deadline,rival=s.politics.parties.find(x=>x.seats&&x.id!==s.politics.executive.playerParty);
 installCabinet(s,rival.id,[rival.id]);
 assert.equal(program(s).milestone.status,'expired');
 s.month=deadline+12;
 s.metrics.gdpPerCapitaReal=program(s).target;
 advanceGovernmentGoals(s,[]);
 assert.equal(program(s).completedMonth,s.month);
 assert.throws(()=>choose(s,'gdp'),/после выполнения/);
});

test('an old trading course is retired without invalidating its recorded turns',()=>{
 let s=createSimulation(scenarioOptions());
 executePolitical(s,{kind:'activateScenarioDiplomacy'});
 executePolitical(s,{kind:'enablePartnerTrade'});
 executePolitical(s,{kind:'startTradeCourse'});
 s=advanceMonth(s);
 executePolitical(s,{kind:'enableGovernmentGoals'});
 assert.equal(s.politics.scenarioDiplomacy.tradeCourse,undefined);
 assert.throws(()=>executePolitical(s,{kind:'startTradeCourse'}),/завершён/);
 assert.deepEqual(program(replayJournal(s)),{});
 assert.equal(replayJournal(s).politics.scenarioDiplomacy.tradeCourse,undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,copy} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {conductElection} from '../src/electorate.js';
import {presidentialStanding} from '../src/political-reporting.js';
import {enableElectionExperience,decisionBudget,executePolitical,validatePoliticalSystem} from '../src/political-system.js';
import {FIRST_NAMES,SURNAMES,leaderName} from '../src/leader-names.js';
import {pendingElectionNotice,acknowledgeElection,electionResults,politicalNews,electionDialog} from '../src/election-ui.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
const start=(country='middle',government='presidential')=>createSimulation(newGameOptions({country,government}));
function finishMonth(s){for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});return advanceMonth(s,s.policy);}
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test('presidential ballot, live rating and final count use the same two candidates and one round',()=>{
 const s=start(),p=s.politics;
 assert.equal(p.constitution.presidentSystem,'plurality');
 assert.equal(p.parties.filter(x=>x.active&&!x.independent).length,2);
 assert.equal(p.parties.filter(x=>x.active&&x.independent).length,1);
 close(p.poll.parties.reduce((v,x)=>v+x.share,0),100);
 close(p.poll.parties.reduce((v,x)=>v+x.candidateShare,0),100);
 assert.equal(p.poll.parties.find(x=>x.id===p.independentPartyId).candidateShare,0);
 const before=copy(p.poll),e=conductElection(s,'president');
 assert.equal(e.results.length,2);assert.equal(e.rounds.length,1);
 assert.equal(e.rounds[0].results.reduce((v,r)=>v+r.votes,0),e.voters);
 assert.equal(e.winner,e.results.slice().sort((a,b)=>b.votes-a.votes)[0].id);
 for(const row of e.results)close(row.share,before.parties.find(x=>x.id===row.id).candidateShare,.0001);
 close(presidentialStanding(s).share,e.results.find(x=>x.id===p.executive.playerParty).share,.0001);
 validatePoliticalSystem(s);
});

test('mixed and parliamentary countries retain their multiparty parliament',()=>{
 for(const government of ['parliamentary','mixedPresident']){
  const s=start('middle',government);assert.equal(s.politics.parties.filter(x=>x.active).length,8);
  assert.equal(s.politics.constitution.presidentSystem,'plurality');
 }
});

test('British names have 50 independent choices on each side and survive export and replay',()=>{
 assert.equal(new Set(FIRST_NAMES).size,50);assert.equal(new Set(SURNAMES).size,50);
 assert.equal(leaderName(15,'president'),leaderName(15,'president'));
 assert.notEqual(leaderName(15,'president'),leaderName(16,'president'));
 let s=start();const names=s.politics.parties.flatMap(x=>[x.leader,x.candidateName]);
 assert.equal(new Set(names).size,names.length);
 for(const name of names){const [first,last]=name.split(' ');assert.ok(FIRST_NAMES.includes(first));assert.ok(SURNAMES.includes(last));}
 s=finishMonth(s);const imported=importSimulation(exportSimulation(s)),replay=replayJournal(imported);
 assert.equal(imported.politics.executive.presidentName,s.politics.executive.presidentName);
 assert.equal(replay.politics.executive.presidentName,s.politics.executive.presidentName);
 assert.deepEqual(replay.metrics,s.metrics);
});

test('budget rolls over for four years without renewal bills, decisions, or shutdown',()=>{
 const options=newGameOptions();options.politicalOptions.constitution.presidentTerm=84;options.politicalOptions.constitution.parliamentOffset=84;
 let s=createSimulation(options);s.politics.constitution.budgetContinuity=false;
 for(let i=0;i<48;i++){
  s=finishMonth(s);assert.equal(s.politics.provisionalBudget,false);
  assert.ok(s.politics.budgetExpires>s.month);
  assert.ok(!s.politics.bills.some(b=>b.renewBudget));
  assert.ok(s.policy.governmentConsumption>0);
 }
});

test('upgrading a legacy save keeps economic stocks, seats and recorded history; transition replays',()=>{
 let s=createSimulation({politicalMode:true,politicalOptions:{instantRules:true,partyContinuity:true,decisionLimit:3,dashboardMode:true}});
 s=finishMonth(s);s=finishMonth(s);
 const oldHistory=copy(s.history.filter(h=>h.month<s.month)),firms=copy(s.firms),bank=copy(s.bank),seats=s.politics.totalSeats,used=decisionBudget(s).used;
 enableElectionExperience(s);enableElectionExperience(s);
 assert.equal(decisionBudget(s).used,used);assert.deepEqual(s.firms,firms);assert.deepEqual(s.bank,bank);
 assert.deepEqual(s.history.filter(h=>h.month<s.month),oldHistory);
 assert.equal(s.politics.parties.reduce((v,x)=>v+x.seats,0),seats);
 assert.equal(s.politics.parties.filter(x=>x.active).length,3);
 assert.equal(s.politics.turnCommands.filter(c=>c.kind==='upgradeElections').length,1);
 validatePoliticalSystem(s);
 s=finishMonth(s);const restored=importSimulation(exportSimulation(s)),replay=replayJournal(restored);
 assert.deepEqual(replay.metrics,s.metrics);assert.equal(replay.politics.executive.presidentName,s.politics.executive.presidentName);
 assert.deepEqual(replay.politics.parties,s.politics.parties);
});

test('election notices exclude setup, persist acknowledgement and retain simultaneous mandates',()=>{
 const s=start();assert.equal(pendingElectionNotice(s),null);
 const parliament=conductElection(s,'parliament'),president=conductElection(s,'president');
 s.politics.elections.push(parliament,president);
 assert.equal(pendingElectionNotice(s).id,parliament.id);
 acknowledgeElection(s,parliament.id);assert.equal(pendingElectionNotice(s).id,president.id);
 acknowledgeElection(s,president.id);assert.equal(pendingElectionNotice(importSimulation(exportSimulation(s))),null);
 assert.equal(s.politics.elections.length,3);
 const legacy={...president,rounds:[{results:[{id:'p1',votes:100},{id:'p2',votes:200}]},{results:[{id:'p1',votes:180},{id:'p2',votes:120}]}]};
 assert.equal(electionResults(legacy)[0].share,60);
 const html=electionDialog(s,president,{n:(v,d=0)=>Number(v).toFixed(d),esc:String,date:m=>String(m)});
 assert.ok(html.includes('election-dialog'));assert.ok(!html.includes('Первый тур'));
 s.journal.push({month:0,events:['трудовой конфликт','Выпуск вырос','Парламент сменил кабинет.']});
 const news=politicalNews(s,{n:String,date:String});assert.ok(news.some(x=>x.text.includes('выборы')));assert.ok(!news.some(x=>x.text.includes('трудовой')||x.text.includes('Выпуск')));
});

for(const country of ['poor','middle','rich'])test(`${country}: election cycle stops on defeat or continues with reconciled accounts`,()=>{
 let s=start(country);
 while(s.month<60&&s.politics.executive.inOffice){
  s=finishMonth(s);validatePoliticalSystem(s);
  for(const [key,value] of Object.entries(s.lastReport.audit))assert.ok(Number.isFinite(value)&&Math.abs(value)<.001,`${country} ${s.month} ${key}`);
 }
 assert.ok(s.politics.elections.some(e=>e.kind==='parliament'&&!e.initial));
 assert.ok(s.politics.elections.some(e=>e.kind==='president'));
 const e=s.politics.elections.find(e=>e.kind==='president');assert.equal(e.rounds.length,1);assert.equal(e.results.length,2);
 if(!s.politics.executive.inOffice)assert.equal(advanceMonth(s,s.policy).month,s.month);
 const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);
});

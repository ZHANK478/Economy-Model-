import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,copy} from '../src/engine.js';
import {electionOutcome,presidentialStanding,partyDisplayName} from '../src/political-reporting.js';

test('election reports distinguish missing the runoff, losing the final, and term expiry',()=>{
 const s=createSimulation({politicalMode:true}),p=s.politics,player=p.executive.playerParty;
 const e={kind:'president',initial:false,system:'twoRound',month:48,winner:'p1',results:[{id:'p1',votes:400,share:40},{id:'p2',votes:350,share:35},{id:player,votes:250,share:25}],rounds:[{results:[{id:'p1',votes:400},{id:'p2',votes:350},{id:player,votes:250}]},{results:[{id:'p1',votes:600},{id:'p2',votes:400}]}]};p.elections.push(e);
 let report=electionOutcome(s);assert.equal(report.rank,3);assert.equal(report.inFinal,false);assert.equal(report.winnerShare,60);assert.match(report.reason,/не участвовал во втором/);
 e.rounds[1].results=[{id:'p1',votes:550},{id:player,votes:450}];report=electionOutcome(s);assert.equal(report.playerVotes,450);assert.equal(report.playerShare,45);assert.match(report.reason,/больше голосов/);
 p.executive.inOffice=false;p.executive.reason='Истёк конституционный предел президентских сроков';report=electionOutcome(s);assert.equal(report.election,undefined);assert.match(report.reason,/предел/);
});
test('candidate support is independent of approval and party labels preserve stored identities',()=>{
 const s=createSimulation({politicalMode:true}),p=s.politics,player=p.parties.find(x=>x.id===p.executive.playerParty),before=copy(player);
 p.presidentApproval=.95;p.poll.parties.forEach((x,i)=>x.candidateShare=i===0?60:x.id===player.id?10:5);
 const standing=presidentialStanding(s);assert.equal(standing.share,10);assert.equal(standing.rank,2);assert.equal(p.presidentApproval,.95);
 assert.equal(partyDisplayName(player),'Либеральная партия');assert.deepEqual(player,before);assert.notEqual(partyDisplayName({...player,id:'p9'}),partyDisplayName({...player,id:'p10'}));
});

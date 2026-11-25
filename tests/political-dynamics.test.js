import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {pollElectorate} from '../src/electorate.js';
import {campaignEvent} from '../src/campaign-events.js';
import {enablePoliticalDynamics,executePolitical} from '../src/political-system.js';
import {parliamentBoard} from '../src/parliamentary-ui.js';
import {compatibleCoalition,negotiateCoalition,formPlayerCabinet,rivalCabinet} from '../src/parliamentary.js';

function scenario(government='parliamentary',revision=1){
 const options=newGameOptions({government,party:'liberal'});
 Object.assign(options.politicalOptions,{nameSeed:42,politicalDynamicsRevision:revision,decisionLimit:undefined});
 return createSimulation(options);
}
function chamber(s,counts){
 const p=s.politics;
 p.totalSeats=Object.values(counts).reduce((a,b)=>a+b,0);
 for(const x of p.parties){
  x.seats=counts[x.family]??0;
  x.active=x.seats>0;
  x.deputies=Array.from({length:x.seats},(_,i)=>({id:x.id+'-'+i,district:null}));
 }
 p.parliamentary.negotiations=[p.executive.playerParty];
 p.parliamentary.draftAgreements=[];
 return family=>p.parties.find(x=>x.family===family);
}
test('300-seat partner retains claim to the premiership against a 150-seat player',()=>{
 const s=scenario(),party=chamber(s,{liberal:150,libertarian:300,socialDemocrat:150});
 negotiateCoalition(s,party('libertarian').id,'accept');
 assert.throws(()=>formPlayerCabinet(s),/претендует на пост премьера/);
});
test('smaller party can lead a compatible majority when larger parties lack a route of their own',()=>{
 const s=scenario(),party=chamber(s,{liberal:70,libertarian:100,centerRight:90,authoritarianLeft:180});
 negotiateCoalition(s,party('libertarian').id,'accept');
 negotiateCoalition(s,party('centerRight').id,'accept');
 formPlayerCabinet(s);
 assert.equal(s.politics.executive.primeMinisterParty,party('liberal').id);
});
test('an alternative majority blocks a small player even with a viable draft',()=>{
 const s=scenario(),party=chamber(s,{liberal:70,libertarian:100,centerRight:95,regional:85});
 negotiateCoalition(s,party('libertarian').id,'accept');
 negotiateCoalition(s,party('centerRight').id,'accept');
 const helpers={n:String,pct:String,esc:String,date:String,chart:()=>''};
 const draft=parliamentBoard(s,helpers);
 assert.match(draft,/Сформировать кабинет/);
 assert.match(draft,/data-parliament="form"[^>]*disabled/);
 assert.match(draft,/Соперники могут собрать большинство без вас/);
 assert.doesNotMatch(draft,/id="coalition-guidance"[^>]*>[^<]*Региональная партия/);
 assert.throws(()=>formPlayerCabinet(s),/большинство без вас/);
 assert.ok(rivalCabinet(s));
 assert.match(parliamentBoard(s,helpers),/Кабинет — Правоцентристская партия \+ Региональная партия.*180 \/ 350 мест/);
});
test('ideology favors coherent left and right blocs while allowing a centrist bridge',()=>{
 const s=scenario(),party=chamber(s,{liberal:60,libertarian:100,centerRight:85,socialist:95,socialDemocrat:70,centerLeft:55});
 assert.ok(compatibleCoalition(s,party('socialist'),party('socialDemocrat')));
 assert.ok(compatibleCoalition(s,party('centerRight'),party('centerLeft')));
 assert.ok(compatibleCoalition(s,party('libertarian'),party('centerRight')));
 assert.ok(!compatibleCoalition(s,party('libertarian'),party('socialist')));
 assert.ok(rivalCabinet(s));
 const members=s.politics.coalition.map(id=>s.politics.parties.find(x=>x.id===id));
 assert.ok(members.every(a=>members.every(b=>compatibleCoalition(s,a,b))));
 chamber(s,{liberal:60,libertarian:110,socialist:100});
 assert.ok(!rivalCabinet(s));
});
test('jobs and prices move the ruling party more strongly in both directions',()=>{
 const share=s=>pollElectorate(s,{commitMemory:true,trackGroups:false}).poll.parties
  .find(x=>x.id===s.politics.executive.playerParty).share;
 for(const sign of [-1,1]){
  const response=revision=>{
   const s=scenario('presidential',revision),before=share(s);
   s.metrics.unemployment-=sign*4;
   s.metrics.inflationYoY-=sign*12;
   s.metrics.realIncomeIndex*=1+sign*.06;
   for(const h of s.households)h.realIncomeIndex*=1+sign*.06;
   for(let i=0;i<3;i++){s.month++;share(s);}
   return sign*(share(s)-before);
  };
  assert.ok(response(1)>Math.max(1,response(0)*2));
 }
});
test('campaign uses the current issue, keeps responses ephemeral and replays across the upgrade',()=>{
 let s=scenario('presidential',0);
 s=advanceMonth(s);
 enablePoliticalDynamics(s);
 for(let i=0;i<3;i++)s=advanceMonth(s);
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).metrics,s.metrics);
 s.politics.nextPresidentElection=s.month+12;
 const event=campaignEvent(s);
 assert.equal(event.title,'Вопрос журналиста');
 assert.doesNotMatch(JSON.stringify(event.choices),/столице|сельских|сторонников рынка/);
 executePolitical(s,{kind:'campaignResponse',eventId:event.id,choice:0});
 assert.ok(Math.abs(s.politics.publicEvents.at(-1).effect)<=.085);
 assert.equal(campaignEvent(s),null);
});

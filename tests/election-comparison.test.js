import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignReadout,electionComparison,electionDialog} from '../src/election-ui.js';
const p=(id,share,seats=0)=>({id,share,seats,votes:share*100,candidateName:id});
const s=()=>({politics:{enabled:true,executive:{playerParty:'a',role:'president'},parties:[{id:'a',family:'liberal'},{id:'b',family:'conservative'}],elections:[]}});
test('the map readout folds all but the player’s rating under a disclosure',()=>{
 const state={...s(),month:13,startYear:2000};
 state.politics.parties.push({id:'c',family:'social'},{id:'d',family:'green'},{id:'e',family:'national'});
 state.politics.parties.slice(0,4).forEach(party=>{party.active=true;});
 state.politics.poll={parties:[{id:'a',share:5,candidateShare:60},{id:'b',share:38},{id:'c',share:34},{id:'d',share:23},{id:'e',share:0}]};
 const format={n:(v,d)=>v.toFixed(d),esc:String,date:()=> 'февраль 2001'};
 const html=campaignReadout(state,format);
 assert.match(html,/<time datetime="2001-02">февраль 2001<\/time>/);
 assert.match(html,/class="player-party".*5\.0%.*<details>/s);
 assert.doesNotMatch(html.split('<details>')[0],/38\.0%|34\.0%|23\.0%/);
 assert.match(html,/<summary aria-label="Опрос партий".*38\.0%.*34\.0%.*23\.0%.*5\.0%/s);
 assert.doesNotMatch(html,/60\.0%|>0\.0%/);
 assert.doesNotMatch(campaignReadout({...state,politics:{enabled:false}},format),/Опрос партий/);
});
test('parliamentary readout follows the current poll independently of mandates',()=>{
 const state={...s(),month:0,startYear:2000};
 const politics=state.politics;
 politics.constitution={form:'parliamentary'};
 politics.totalSeats=659;
 Object.assign(politics.parties[0],{active:true,seats:290});
 Object.assign(politics.parties[1],{active:true,seats:369});
 politics.poll={parties:[{id:'a',share:11},{id:'b',share:89}]};
 const format={n:(v,d)=>v.toFixed(d),esc:String,date:()=> 'январь 2000'};
 const [summary,details]=campaignReadout(state,format).split('<details>');
 assert.match(summary,/11\.0%/);
 assert.doesNotMatch(summary,/44\.0%|мест/);
 assert.match(details,/Опрос партий.*11\.0%/s);
 politics.parties[0].seats=225;
 assert.equal(campaignReadout(state,format).split('<details>')[0],summary);
});
test('parliament deltas compare ballots with startup clearly identified and preserve seat and share units',()=>{
 const state=s(),before={id:1,month:0,kind:'parliament',initial:true,results:[p('a',40,48),p('b',60,72)],rounds:[],totalSeats:120},now={id:2,month:24,kind:'parliament',turnout:75,results:[p('a',45,54),p('b',55,66)],rounds:[],totalSeats:120};
 state.politics.elections=[before,now];const c=electionComparison(state,now);
 assert.equal(c.previous.id,1);const own=c.rows.find(r=>r.id==='a');assert.equal(own.shareChange,5);assert.equal(own.seatChange,6);
 const html=electionDialog(state,now,{n:(v,d=0)=>v.toFixed(d),esc:String,date:m=>String(m)});
 assert.ok(html.includes('К стартовому составу'));assert.ok(html.includes('gain'));assert.ok(html.includes('loss'));assert.ok(html.includes('+6 мест'));assert.ok(html.includes('Было 40.00% · 48 мест'));
});
test('first presidential ballot cannot be compared with a parliament or poll; later ballots use the previous final round',()=>{
 const state=s(),parl={id:1,month:0,kind:'parliament',initial:true,results:[p('a',80,96),p('b',20,24)],rounds:[]};
 const first={id:2,month:48,kind:'president',winner:'a',results:[p('a',20),p('b',80)],rounds:[{results:[{id:'a',votes:5100},{id:'b',votes:4900}]}]};
 state.politics.elections=[parl,first];assert.equal(electionComparison(state,first).previous,null);
 const next={id:3,month:96,kind:'president',winner:'b',results:[p('a',49),p('b',51)],rounds:[]};state.politics.elections.push(next);
 assert.equal(electionComparison(state,next).rows.find(r=>r.id==='a').shareChange,-2);
});

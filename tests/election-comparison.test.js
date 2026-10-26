import test from 'node:test';
import assert from 'node:assert/strict';
import {electionComparison,electionDialog} from '../src/election-ui.js';
const p=(id,share,seats=0)=>({id,share,seats,votes:share*100,candidateName:id});
const s=()=>({politics:{enabled:true,executive:{playerParty:'a',role:'president'},parties:[{id:'a',family:'liberal'},{id:'b',family:'conservative'}],elections:[]}});
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {hemicycleSeats,parliamentChart,pieSegments,productionPie} from '../src/game-charts.js';
for(const total of [30,120,360,367])test(`${total} seats: exact party allocation and non-overlapping coordinates`,()=>{
 const parties=[{id:'a',family:'socialist',seats:Math.floor(total*.4),platform:{economy:-1}},{id:'b',family:'liberal',seats:total-Math.floor(total*.4),platform:{economy:1}}],before=JSON.stringify(parties),points=hemicycleSeats(parties);
 assert.equal(points.length,total);assert.equal(points.filter(s=>s.party.id==='a').length,parties[0].seats);assert.equal(JSON.stringify(parties),before);
 for(let i=0;i<points.length;i++){
  const a=points[i];assert.ok(a.cx-a.r>=0&&a.cx+a.r<=360&&a.cy-a.r>=0&&a.cy+a.r<=218);
  for(let j=0;j<i;j++){const b=points[j];assert.ok(Math.hypot(a.cx-b.cx,a.cy-b.cy)>=a.r+b.r,`${i},${j}`);}
 }
 const svg=parliamentChart(parties,{name:p=>p.id,playerParty:'a',coalition:['a']});assert.equal((svg.match(/class="parliament-seat"/g)??[]).length,total);assert.ok(svg.includes('Большинство — '+(Math.floor(total/2)+1)));
});
test('pie areas represent actual proportions, including empty and single-sector cases',()=>{
 const segments=pieSegments([1,2,0,7]);assert.ok(Math.abs(segments.reduce((v,s)=>v+s.share,0)-1)<1e-12);assert.equal(segments[1].share,.2);assert.ok(Math.abs(segments.at(-1).end-segments[0].start-2*Math.PI)<1e-12);
 const pie=productionPie([{label:'A',value:1},{label:'B',value:3}]);assert.equal((pie.match(/<path /g)??[]).length,2);assert.ok(pie.includes('25.0%'));assert.ok(pie.includes('75.0%'));
 assert.ok(productionPie([{label:'A',value:1}]).includes('<circle '));assert.deepEqual(pieSegments([0,0]),[]);assert.equal(pieSegments([-1,2]),null);assert.ok(!productionPie([{label:'A',value:-1},{label:'B',value:2}]).includes('class="production-pie"'));
});

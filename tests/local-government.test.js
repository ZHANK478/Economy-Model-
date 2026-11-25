import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,copy,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {initializeLocalGovernment,prepareLocalGovernment,serviceDeliveryFactor,infrastructureDeliveryFactor,localPublicInvestmentPlan,recordLocalServices} from '../src/local-government.js';
import {enableLocalGovernment,decisionBudget,executePolitical} from '../src/political-system.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
const start=(political=false,enabled=true)=>{const o=newGameOptions({resource:false});o.politicalMode=political;o.politicalOptions.nameSeed=7;if(!enabled)delete o.localGovernmentRevision;return createSimulation(o);};
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const reject=s=>{for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject',deferReferendum:true});};
test('local service allocations conserve paid funds and retain national services at maximum delegation',()=>{
 const s=start();s.localGovernment.servicesShare=1;
 const flow={healthcare:100,education:80,localAdministration:2};recordLocalServices(s,flow);
 for(const key of ['healthcare','education']){const a=flow.localGovernment[key];near(a.central+a.local,flow[key]);near(a.areas.reduce((v,a)=>v+a.amount,0),a.local);assert.ok(a.central>0);}
 near(flow.localGovernment.healthcare.local,55);near(flow.localGovernment.education.local,68);
 near(serviceDeliveryFactor(start(),'school'),1);near(serviceDeliveryFactor(start(),'health'),1);
});
test('local delivery can outperform or underperform central delivery depending on capacities, not regime labels',()=>{
 const s=start();s.localGovernment.servicesShare=1;s.localGovernment.centralCapacity=.25;for(const a of s.localGovernment.areas)a.capacity=.95;
 const local=serviceDeliveryFactor(s,'school');s.localGovernment.servicesShare=0;const central=serviceDeliveryFactor(s,'school');assert.ok(local>central);
 s.localGovernment.centralCapacity=.95;for(const a of s.localGovernment.areas)a.capacity=.2;s.localGovernment.servicesShare=1;
 const weak=serviceDeliveryFactor(s,'school');s.localGovernment.servicesShare=0;assert.ok(weak<serviceDeliveryFactor(s,'school'));
 const b=copy(s);b.politics.constitution={regime:'military'};near(serviceDeliveryFactor(s,'school'),serviceDeliveryFactor(b,'school'));
 const rail=infrastructureDeliveryFactor(s,'rail','municipal'),road=infrastructureDeliveryFactor(s,'roads','municipal');assert.ok(rail<road,'cross-territory networks need coordination');
});
test('delegation and staffing change gradually and only actual past administration spending sustains local capacity',()=>{
 const s=start(),prev=copy(s);s.policy.municipalServicesShare=100;const original=s.localGovernment.areas[0].capacity;
 prev.lastReport.fiscal.localAdministration=0;prepareLocalGovernment(s,prev);
 near(s.localGovernment.servicesShare,1/24);assert.ok(Math.abs(s.localGovernment.areas[0].capacity-original)<.02);
 const funded=copy(s),unfunded=copy(s),paid=copy(prev);paid.lastReport.fiscal.localAdministration=100;
 for(let i=0;i<48;i++){prepareLocalGovernment(funded,paid);prepareLocalGovernment(unfunded,prev);}
 assert.ok(funded.localGovernment.areas[0].capacity>unfunded.localGovernment.areas[0].capacity);
});
test('funding is part of consolidated purchases; delegation affects physical projects and services without breaking balances',()=>{
 let a=start(),b=copy(a);b.policy.municipalInvestmentShare=100;b.policy.municipalServicesShare=100;
 for(let i=0;i<24;i++){a=advanceMonth(a);b=advanceMonth(b);for(const v of Object.values(b.lastReport.audit))assert.ok(Math.abs(v)<.001);}
 assert.notEqual(a.infrastructure,b.infrastructure);assert.notEqual(a.education.access,b.education.access);
 assert.notEqual(a.services.publicHealthDelivered,b.services.publicHealthDelivered);
 assert.ok(b.lastReport.fiscal.localAdministration>0);assert.ok(b.lastReport.fiscal.localAdministration<=b.lastReport.fiscal.institutionCost);
 const count=b.projects.filter(p=>p.localPlan).length;assert.ok(count>0);
 const restored=importSimulation(exportSimulation(b));assert.deepEqual(replayJournal(restored).metrics,b.metrics);
 assert.deepEqual(replayJournal(restored).localGovernment,b.localGovernment);
});
test('zero delivery coefficients remove delegation effects and changing an investment share cannot rewrite funded projects',()=>{
 let a=start(),b=copy(a);for(const s of [a,b])s.localGovernment.assumptions.effectStrength=0;
 b.policy.municipalInvestmentShare=100;b.policy.municipalServicesShare=100;
 for(let i=0;i<20;i++){a=advanceMonth(a);b=advanceMonth(b);}
 // Relative tolerance permits floating-point settlement/reallocation noise.
 near(a.infrastructure,b.infrastructure,1e-8*Math.max(1,a.infrastructure));near(a.metrics.realGDPMonthly,b.metrics.realGDPMonthly,1e-8*Math.max(1,a.metrics.realGDPMonthly));near(a.services.publicHealthDelivered,b.services.publicHealthDelivered,1e-8);
 const s=start(),plan=localPublicInvestmentPlan(s,100);s.policy.municipalInvestmentShare=100;assert.deepEqual(plan,localPublicInvestmentPlan(s,100));
});
test('activation preserves old history and pending projects, costs no decision and replays the boundary',()=>{
 let s=start(true,false);reject(s);s=advanceMonth(s);const before=copy(s),used=decisionBudget(s).used;
 enableLocalGovernment(s);assert.equal(decisionBudget(s).used,used);assert.deepEqual(s.history,before.history);assert.deepEqual(s.projects,before.projects);assert.deepEqual(s.journal,before.journal);
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).localGovernment,s.localGovernment);
 reject(s);s=advanceMonth(s);const r=replayJournal(importSimulation(exportSimulation(s)));assert.deepEqual(r.metrics,s.metrics);assert.deepEqual(r.localGovernment,s.localGovernment);
});
test('local state validates and legacy saves without the new policy fields still import and replay',()=>{
 const s=start();const data=JSON.parse(exportSimulation(s));data.state.localGovernment.areas[0].capacity=2;assert.throws(()=>importSimulation(JSON.stringify(data)));
 const old=start(true,false),raw=JSON.parse(exportSimulation(old));for(const key of ['localElections','municipalServicesShare','localAdministrationBudget']){delete raw.state.policy[key];delete raw.state.politics.lawPolicy[key];delete raw.state.provenance.initialPolicy[key];}
 const loaded=importSimulation(JSON.stringify(raw));assert.equal(loaded.localGovernment,undefined);assert.deepEqual(replayJournal(loaded).metrics,loaded.metrics);
});

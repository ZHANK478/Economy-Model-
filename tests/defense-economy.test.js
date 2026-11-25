import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {enableDefense} from '../src/political-system.js';
const start=(revision=10)=>{const o=newGameOptions({country:'middle'});o.politicalMode=false;o.economicRevision=revision;return createSimulation(o);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('military wages are funded once and soldiers join employment',()=>{
 let s=start();s=advanceMonth(s,s.policy);const a=s.defense.economy.accounts,f=s.lastReport.fiscal;
 assert.ok(a.gross>0);near(a.gross,a.net+a.tax+a.contributions);near(f.militaryWages,a.gross);
 near(s.metrics.employment,s.firms.reduce((v,x)=>v+x.workers,0)+a.people);
 near(f.defenseDomesticOrders+f.defenseImportedOrders,f.militaryPurchases-f.militaryWages);
 for(const v of Object.values(s.lastReport.audit))assert.ok(Math.abs(v)<.001);
 assert.deepEqual(replayJournal(s).metrics,s.metrics);
});
test('service composition changes gradually and changes actual payroll',()=>{
 let a=start(),b=start();a.policy.defenseService='contract';b.policy.defenseService='conscription';
 for(let i=0;i<18;i++){a=advanceMonth(a,a.policy);b=advanceMonth(b,b.policy);}
 assert.ok(b.defense.economy.contractShare<a.defense.economy.contractShare);
 assert.ok(b.defense.economy.accounts.conscripts>0);
 assert.ok(b.defense.economy.accounts.gross/b.defense.economy.accounts.people<a.defense.economy.accounts.gross/a.defense.economy.accounts.people);
});
test('import preference changes the import content of funded military orders',()=>{
 let a=start(),b=start();a.policy.defenseProcurement='domestic';b.policy.defenseProcurement='imported';
 a=advanceMonth(a,a.policy);b=advanceMonth(b,b.policy);
 const x=a.lastReport.fiscal,y=b.lastReport.fiscal;
 assert.ok(y.defenseImportedOrders/(y.defenseDomesticOrders+y.defenseImportedOrders)>x.defenseImportedOrders/(x.defenseDomesticOrders+x.defenseImportedOrders));
});
test('activation can be saved immediately and revision 9 upgrades without rewriting history',()=>{
 const o=newGameOptions();o.defenseMode=false;let s=createSimulation(o);enableDefense(s);assert.ok(importSimulation(exportSimulation(s)).defense.economy);
 let old=start(9);old=advanceMonth(old,old.policy,{preserveEconomicRevision:true});const journal=JSON.stringify(old.journal);
 const next=advanceMonth(old,old.policy);assert.equal(next.economy.revision,24);assert.equal(JSON.stringify(next.journal.slice(0,1)),JSON.stringify(JSON.parse(journal).slice(0,1)));assert.deepEqual(replayJournal(next).metrics,next.metrics);
});

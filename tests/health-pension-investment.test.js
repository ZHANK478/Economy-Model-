import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
const sum=a=>a.reduce((x,y)=>x+y,0);
const start=()=>createSimulation({...newGameOptions({country:'middle'}),politicalMode:false});
const run=(s,n)=>{for(let i=0;i<n;i++)s=advanceMonth(s,s.policy);return s;};
test('health premiums and reimbursement are funded transfers, not extra output',()=>{
 let s=run(start(),12),z=s.social;assert.ok(sum(z.last.healthPremium)>0);assert.ok(sum(z.last.healthReimbursement)>0);
 assert.ok(sum(z.last.healthReimbursement)<=sum(z.last.healthPremium)+z.healthFund.cash+1e-5);
 for(const r of s.householdEconomy.records){assert.ok(Math.abs(sum(Object.values(r.categories))-r.expenses)<1e-6);assert.ok(r.categories.healthEducation>=0);}
 for(const v of Object.values(s.lastReport.audit))assert.ok(Math.abs(v)<.001);
 s.policy.privateHealthInsurance=false;s=advanceMonth(s,s.policy);assert.equal(sum(s.social.last.healthPremium),0);assert.equal(sum(s.social.last.healthReimbursement),0);
});
test('pension purchases transfer existing bank ownership and assets reconcile through replay',()=>{
 let s=run(start(),24),f=s.social.pensionFund;assert.ok(f.bankClaim>0);
 assert.ok(Math.abs(sum(s.social.privateAccounts)-f.cash-f.bankClaim)<1e-5);
 const old=importSimulation(exportSimulation(s));assert.deepEqual(replayJournal(old).metrics,s.metrics);
 for(const v of Object.values(s.lastReport.audit))assert.ok(Math.abs(v)<.001);
});
test('investment fund units remain backed by deposits and existing bank shares',()=>{
 const s=run(start(),24),f=s.social.investmentFund;assert.ok(f.bankClaim>0);assert.ok(sum(s.social.investmentAccounts)>0);
 assert.ok(Math.abs(sum(s.social.investmentAccounts)-f.cash-f.bankClaim)<1e-6);
 assert.ok(Math.abs(s.lastReport.audit.investmentFund)<1e-6);
});
test('business cohorts partition sector capital and react differently to credit costs',async()=>{
 const {prepareBusinessGroups}=await import('../src/economic-foundation.js');
 let a=start(),b=start();a.bank.lendingRate=.02;b.bank.lendingRate=.4;
 for(let i=0;i<24;i++){prepareBusinessGroups(a);prepareBusinessGroups(b);}
 for(const groups of a.foundation.businessGroups)assert.ok(Math.abs(sum(groups.map(x=>x.capitalShare))-1)<1e-10);
 assert.ok(a.foundation.businessGroups[1][0].capitalShare>b.foundation.businessGroups[1][0].capitalShare);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,scheduleNetwork,importSimulation,exportSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {networkTransferQuote,settleOperatorTransfer,networkTransferMessage} from '../src/network-transfers.js';
const start=(country='middle',revision=13)=>createSimulation({...newGameOptions({country,resource:false}),economicRevision:revision,politicalMode:false});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('normal countries can sell to a separately funded operator and load/replay the result',()=>{
 for(const country of ['poor','middle','rich']){
  let s=start(country);scheduleNetwork(s,{network:'roads',kind:'networkSale',points:10});s=advanceMonth(s);
  const r=s.journal.at(-1).actions.find(a=>a.network);assert.ok(r.amount>0,JSON.stringify(r));assert.ok(r.cost>0);
  assert.ok(s.lastReport.fiscal.networkAcquisitionCredit>0);assert.ok(s.networks[0].operator.loanLC>0);
  assert.ok(s.metrics.auditError<1e-5);assert.equal(s.firms[4].infrastructureCapital,0);
  assert.deepEqual(importSimulation(exportSimulation(s)).metrics,s.metrics);assert.deepEqual(replayJournal(s).metrics,s.metrics);
 }
});
test('sales use operator funds, conserve physical assets and pay the treasury once',()=>{
 const s=start(),n=s.networks[0],beforeTotal=s.infrastructure,beforeGov=s.government.cash,beforeFirm=s.firms[4].cash;
 n.operator.cash=10000;s.bank.creditSupply=0;s.households.forEach(h=>h.cash=0);
 const initialCash=n.operator.cash,flow={networkSales:0,networkPurchases:0};
 const r=settleOperatorTransfer(s,{network:'roads',kind:'networkSale',points:10},flow,{transfer:(a,b,v)=>{a.cash-=v;b.cash+=v;},grantLoan:()=>assert.fail('cash-funded purchase borrowed'),fundGovernment:()=>{}});
 near(n.public+n.municipal+n.private+n.concession,beforeTotal*n.weight);near(s.government.cash-beforeGov,r.cost);near(initialCash-n.operator.cash,r.cost);near(s.firms[4].cash,beforeFirm);assert.equal(flow.networkSales,r.cost);
 const reverse=settleOperatorTransfer(s,{network:'roads',kind:'networkPurchase',points:10},flow,{transfer:(a,b,v)=>{a.cash-=v;b.cash+=v;},fundGovernment:()=>{}});
 near(reverse.cost,r.cost);near(n.operator.cash,initialCash);near(s.government.cash,beforeGov);
});
test('low returns reduce price rather than rejecting all positive-return assets',()=>{
 const s=start();s.networks[0].expectedReturn=.01;const q=networkTransferQuote(s,{network:'roads',kind:'networkSale',points:10});
 assert.ok(q.unitPrice>0&&q.unitPrice<q.bookPrice);assert.ok(q.amount>0);
});
test('unfunded, closed and empty sales explain rejection and partial deals stay visible',()=>{
 const s=start(),n=s.networks[0],action={network:'roads',kind:'networkSale',points:100};
 s.policy.privateInfrastructureEntry=false;assert.equal(networkTransferQuote(s,action).reason,'infrastructure-entry');s.policy.privateInfrastructureEntry=true;
 s.bank.creditSupply=0;s.households.forEach(h=>h.cash=0);n.operator.cash=0;assert.equal(networkTransferQuote(s,action).reason,'buyer-funding');
 n.operator.cash=500;const q=networkTransferQuote(s,action);assert.ok(q.amount>0&&q.amount<q.wanted);
 const r=settleOperatorTransfer(s,action,{networkSales:0},{transfer:(a,b,v)=>{a.cash-=v;b.cash+=v;},grantLoan:()=>assert.fail(),fundGovernment:()=>{}});assert.equal(r.partial,true);assert.match(networkTransferMessage(r),/частично/);
 n.public=n.municipal=0;assert.equal(networkTransferQuote(s,action).reason,'no-stock');
});
test('old revision 12 journals replay and migrate only on the next calculated month',()=>{
 let s=start('middle',12);s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});const old=JSON.stringify(s.journal);s=advanceMonth(s);
 assert.equal(s.economy.revision,24);assert.equal(JSON.stringify(s.journal.slice(0,1)),old);assert.deepEqual(replayJournal(s).metrics,s.metrics);
});

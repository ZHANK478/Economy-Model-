import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,treasuryForeignLiquidity,exportSimulation,importSimulation,replayJournal,accountBalances} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {settlementCreditCapacity,treasuryPaymentOutlook} from '../src/treasury-settlement.js';
import {newspaperCandidates,updateNewspaper} from '../src/newspaper.js';
const start=revision=>createSimulation({...newGameOptions(),economicRevision:revision??14,politicalMode:false});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function reconcile(s){const a=accountBalances(s);s.bank.equity=a.bankAssets-a.deposits-s.bank.centralBorrowing-(s.bank.foreignArrearsUSD??0)*s.exchangeRate;s.centralBank.equity=s.government.reservesUSD*s.exchangeRate+s.bank.centralBorrowing-s.bank.reserves;}
test('ordinary secured settlement works with zero reserve requirement and emergency support off',()=>{
 const s=start();s.policy.reserveRequirement=0;s.policy.liquiditySupport=false;s.bank.reserves=0;s.bank.foreignAssetsUSD=0;s.economy.foreignCreditRatio=0;s.government.cash=100;s.government.reservesUSD=50;reconcile(s);
 const before={bank:s.bank.equity,cb:s.centralBank.equity,cash:s.government.cash},flow={};
 const paid=treasuryForeignLiquidity(s,10,flow);near(paid,10);near(s.bank.centralBorrowing,10*s.exchangeRate);near(s.government.reservesUSD,40);near(s.bank.reserves,0);near(s.government.cash,before.cash);
 s.government.cash-=10*s.exchangeRate;s.bank.foreignAssetsUSD-=10;
 const a=accountBalances(s);near(a.bankAssets-a.deposits-a.centralBorrowing-a.bankEquity,0);near(s.centralBank.equity,before.cb);near(s.bank.equity,before.bank);near(flow.settlementCredit,10*s.exchangeRate);
});
test('collateral excludes household bonds, overdue debt, and previously borrowed capacity',()=>{
 const s=start();s.government.domesticBonds=[{principal:100,rate:.05,maturity:12,householdHoldings:[90,...Array(9).fill(0)]},{principal:200,inDefault:true}];s.bank.centralBorrowing=3;
 near(settlementCreditCapacity(s).headroom,5);
 for(const regime of ['currencyBoard','dollarized','freeBanking']){s.policy.monetaryRegime=regime;near(settlementCreditCapacity(s).headroom,0);}
 s.policy.monetaryRegime='discretion';s.bank.equity=0;near(settlementCreditCapacity(s).headroom,0);
});
test('official FX conversion never manufactures budget cash or foreign reserves',()=>{
 const s=start();s.bank.reserves=0;s.bank.foreignAssetsUSD=0;s.economy.foreignCreditRatio=0;s.government.reservesUSD=100;s.government.cash=0;reconcile(s);const flow={};
 near(treasuryForeignLiquidity(s,10,flow),0);near(s.bank.centralBorrowing,0);near(s.government.reservesUSD,100);
 s.government.cash=5*s.exchangeRate;near(treasuryForeignLiquidity(s,10,flow),5);near(s.government.reservesUSD,95);
});
test('real FX scarcity still defaults, and cash shortage is reported separately',()=>{
 for(const missing of ['fx','cash']){
  let s=start();s.policy.liquiditySupport=false;s.policy.foreignBorrowingShare=0;s.policy.fxIntervention=0;s.government.fundUSD=0;s.economy.foreignCreditRatio=0;
  s.government.externalBonds.push({principal:1000,rate:.05,maturity:1});s.parameters.maximumPublicDebtRatio=.5;
  s.government.cash=missing==='cash'?0:10000;s.government.reservesUSD=missing==='fx'?0:10000;s.bank.foreignAssetsUSD=0;reconcile(s);
  s=advanceMonth(s);assert.equal(s.government.defaultActive,true);
  assert.ok(s.lastReport.fiscal.treasuryPayments.some(p=>p.reason===(missing==='cash'?'budget-cash':'foreign-currency')));
  assert.ok(s.metrics.auditError<1e-5);
 }
});
test('new settlement, actual debt costs, save and journal remain balanced and replayable',()=>{
 let s=start();s.policy.reserveRequirement=0;s.policy.liquiditySupport=false;
 for(let i=0;i<16;i++){s=advanceMonth(s);assert.ok(s.metrics.auditError<1e-5);assert.ok(s.government.reservesUSD>=0&&s.government.cash>=0);}
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).metrics,s.metrics);
 let old=start(13);old=advanceMonth(old,old.policy,{preserveEconomicRevision:true});const past=JSON.stringify(old.journal);const migrated=advanceMonth(old);
 assert.equal(migrated.economy.revision,24);assert.equal(JSON.stringify(migrated.journal.slice(0,1)),past);assert.deepEqual(replayJournal(migrated).metrics,migrated.metrics);
});
test('payment outlook warns before a maturity and observes existing newspaper cooldowns',()=>{
 const s=advanceMonth(advanceMonth(start()));s.government.reservesUSD=0;s.bank.foreignAssetsUSD=0;s.metrics.foreignCreditLimitUSD=0;s.government.defaultActive=false;
 s.government.externalBonds.push({principal:1e6,rate:.05,maturity:s.month+2});s.lastReport.paymentOutlook=treasuryPaymentOutlook(s);
 assert.ok(s.lastReport.paymentOutlook.fxGap>0);const issue=newspaperCandidates(s).find(x=>x.key==='payment-risk');assert.ok(issue);assert.match(issue.lead,/валют/);
 const press={};assert.equal(updateNewspaper(s,press)?.key,'payment-risk');assert.equal(updateNewspaper(s,press),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,withdrawTreasuryFund,treasuryForeignLiquidity,accountBalances,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {treasuryPaymentOutlook} from '../src/treasury-settlement.js';
const start=(extra={})=>createSimulation({...newGameOptions({country:'poor',resource:true}),politicalMode:false,defenseMode:false,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
function reconcile(s){const a=accountBalances(s);s.bank.equity=a.bankAssets-a.deposits-s.bank.centralBorrowing-(s.bank.foreignArrearsUSD??0)*s.exchangeRate;s.centralBank.equity=s.government.reservesUSD*s.exchangeRate+s.bank.centralBorrowing-s.bank.reserves;}
test('fund liquidation is bounded, accumulates across requests, and creates no revenue or central reserves',()=>{
 const s=start();s.exchangeRate=2;s.government.cash=5;s.government.fundUSD=10;reconcile(s);
 const before=accountBalances(s),reserves=s.government.reservesUSD,equity=s.bank.equity,flow={};
 near(withdrawTreasuryFund(s,13,flow),4);near(s.government.cash,13);near(s.government.fundUSD,6);
 near(withdrawTreasuryFund(s,50,flow),6);near(s.government.cash,25);near(flow.fundWithdrawal,20);
 near(withdrawTreasuryFund(s,50,flow),0);near(s.government.fundUSD,0);near(s.government.reservesUSD,reserves);near(s.bank.equity,equity);
 const after=accountBalances(s);near(after.bankAssets-before.bankAssets,20);near(after.deposits-before.deposits,20);assert.equal(flow.centralIncome,undefined);
});
function debtFixture(fund){const s=start();s.parameters.maximumPublicDebtRatio=0;s.policy.foreignBorrowingShare=0;s.policy.fxIntervention=0;s.policy.stabilizationSaving=100;s.government.cash=0;s.government.fundUSD=fund;s.government.externalBonds=[{principal:100,rate:.12,maturity:1}];s.government.domesticBonds=[];s.bank.foreignAssetsUSD=0;s.government.reservesUSD=0;s.economy.foreignCreditRatio=0;reconcile(s);return s;}
test('an available fund pays sovereign maturity before default; insufficient funds still allow default',()=>{
 const funded=advanceMonth(debtFixture(10000));assert.equal(funded.government.defaultActive,false);assert.ok(funded.lastReport.fiscal.externalRedeemed>=100-1e-8);assert.ok(funded.lastReport.fiscal.fundWithdrawal>0);near(funded.lastReport.fiscal.fundDeposit,0);assert.ok(funded.metrics.auditError<1e-5);
 const empty=advanceMonth(debtFixture(0));assert.equal(empty.government.defaultActive,true);assert.ok(empty.lastReport.fiscal.treasuryPayments.some(p=>p.reason));
});
test('liquid fund contributes to payment outlook, CB reserves do not become budget cash',()=>{
 const s=debtFixture(200),a=treasuryPaymentOutlook(s);near(a.fundUSD,200);assert.equal(a.cashGap,0);assert.equal(a.fxGap,0);
 s.government.fundUSD=0;s.government.reservesUSD=100000;const b=treasuryPaymentOutlook(s);assert.ok(b.cashGap>0);near(b.fundUSD,0);
});
test('prices use current orders and deliverable supply; reported channels reconcile to actual quotes',()=>{
 let s=start();for(let m=0;m<24;m++){
  s=advanceMonth(s);
  for(const [i,c] of s.lastReport.channels.entries()){
   near(c.priceSupply,s.lastReport.market.capacity[i]);
   near(c.priceDemandGap,c.priceOrders/Math.max(c.priceSupply,1e-9)-s.economy.parameters.normalUtilization);
   near(c.demand,s.foundation.assumptions.priceDemandSpeed*c.priceDemandGap);
   if(c.priceOrders>=c.priceSupply)assert.ok(c.demand>=0,'unfilled current orders are not negative demand pressure');
   near(c.total,Math.log(c.priceAfter/c.priceBefore));near(c.inertia,0);
   near(c.total,['inertia','expectations','demand','imports','wages','scarcity','commodity','tariff','markup','costAdjustment','adjustmentLimit','productAndFirmAdjustment'].reduce((v,k)=>v+c[k],0));
  }
 }
 assert.deepEqual(replayJournal(importSimulation(exportSimulation(s))).metrics,s.metrics);
});
test('revision 22 replays unchanged and migrates only on next live month',()=>{
 let s=start({economicRevision:22});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});const journal=JSON.stringify(s.journal),history=JSON.stringify(s.history);
 const next=advanceMonth(s);assert.equal(next.economy.revision,24);assert.equal(JSON.stringify(next.journal.slice(0,1)),journal);assert.equal(JSON.stringify(s.history),history);assert.deepEqual(replayJournal(next).metrics,next.metrics);
});

test('Treasury fund FX cannot be swallowed by a breached private bank credit line',()=>{
 const s=start();s.government.cash=0;s.government.fundUSD=50;s.government.reservesUSD=0;s.bank.foreignAssetsUSD=-1000;s.economy.foreignCreditRatio=0;const flow={};
 withdrawTreasuryFund(s,50*s.exchangeRate,flow);near(treasuryForeignLiquidity(s,50,flow),50);near(s.government.reservesUSD,0);
 // A second request is still capped by actual Treasury cash and the fund proceeds.
 near(treasuryForeignLiquidity(s,100,flow),50);near(s.government.fundUSD,0);
});

test('wage diagnostics expose existing indexation and bargaining without changing coefficients',()=>{
 const s=start(),n=advanceMonth(s);
 for(const [i,l] of n.lastReport.calculationTrace.labor.entries()){
  near(l.productivityLogChange,Math.log(Math.max(1e-9,n.firms[i].productivity*n.skills)/Math.max(1e-9,s.firms[i].productivity*s.skills)));
  const raw=l.inflationIndexation+l.productivityLogChange+l.laborMarketPressure+l.minimumEffect+l.bargainingChange;
  near(l.wageLogChange,Math.max(-.02,Math.min(.06,raw)));
 }
});

test('unchanged company dispersion cannot repeatedly deflate the same sector quote',async()=>{
 const {finishEnterpriseMarket,prepareEnterpriseMarket,sectorCompanies}=await import('../src/enterprise-market.js');
 const {finishFirmMarket,prepareFirmMarkets}=await import('../src/firm-markets.js');
 for(const level of [.001,.05,1,1000]){
  const s=start();for(const sector of [2,3,4]){
   for(const c of sectorCompanies(s,sector)){c.lastProfit=0;c.lastRevenue=10;c.active=true;}
   for(let i=0;i<24;i++){
    if(sector===2){finishEnterpriseMarket(s,level);prepareEnterpriseMarket(s);}else {finishFirmMarket(s,sector,level);prepareFirmMarkets(s);}
    near(s.firms[sector].price,level);
   }
  }
 }
});

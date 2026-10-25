import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,accountBalances,treasuryForeignLiquidity} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {annualFlowRate,monthlyDepreciation,adjustmentFromAnnual,errorCorrection,balancedInvestment,equilibriumInvestment} from '../src/macro-core.js';
import {investmentOpportunities,foreignCreditLimitUSD} from '../src/open-economy.js';
import {allocateMarketWithStocks} from '../src/market-allocation.js';
import {settleBankForeignInterest,subscribeHouseholds,householdBonds,nonbankDebt,domesticCouponShares,distributeCoupon,redeemDomestic} from '../src/bond-market.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const start=(country='middle')=>createSimulation({...newGameOptions({country,resource:false}),politicalMode:false});
test('published balanced growth identity survives annual to monthly conversion without fabricated GDP growth',()=>{
 let capital=100;for(let i=0;i<12;i++)capital=capital*(1-monthlyDepreciation(.07))+balancedInvestment(capital,.07,.03);
 near(capital,103);near((1+annualFlowRate(.03))**12,1.03);
 // MFMod eq 8: capital share * annual VA / cost = desired capital (4200).
 near(equilibriumInvestment({valueAdded:100,capitalShare:.35,depreciation:.07,growth:.03,annualUserCost:.1}),balancedInvestment(4200,.07,.03));
});
test('ECM analytic log gap and annual adjustment match the reference equation',()=>{
 let value=200;for(let i=0;i<12;i++)value=errorCorrection({previous:value,target:100,speed:adjustmentFromAnnual(.35)}).value;
 near(Math.log(value/100),.65*Math.log(2));
 assert.throws(()=>errorCorrection({previous:-1,target:1,speed:.1}));
});
test('all reference starts have investment plans consistent with opening expenditure and immutable calibration',()=>{
 for(const c of ['poor','middle','rich']){
  const s=start(c),plans=investmentOpportunities(s,s,1);
  near(plans.reduce((a,p)=>a+p.unsmoothedTarget,0),s.base.investment);
  const a=importSimulation(exportSimulation(s));assert.deepEqual(a.economy.macro,s.economy.macro);
  a.economy.macro.firms[0].userCostResidual+=1;assert.throws(()=>importSimulation(exportSimulation(a)));
 }
});
test('stock tie breaking preserves inventories without sacrificing orders; scarce stocks remain available',()=>{
 const input={matrix:[[0]],inventory:[10],capacity:[100],domestic:[50],exports:[0],prices:[1],external:null};
 let x=allocateMarketWithStocks(input);near(x.alpha,1);near(x.production[0],50);near(x.ending[0],10);
 x=allocateMarketWithStocks({...input,capacity:[40]});near(x.alpha,1);near(x.production[0],40);near(x.ending[0],0);
});
test('Treasury reserves settle its coupons even after the private foreign line is exhausted',()=>{
 const s=start('poor'),delta=-foreignCreditLimitUSD(s)-s.bank.foreignAssetsUSD-50;s.bank.foreignAssetsUSD+=delta;s.bank.equity+=delta*s.exchangeRate;
 const cash=s.government.cash,equity=s.bank.equity,flow={},r=s.government.reservesUSD;
 assert.ok(treasuryForeignLiquidity(s,2,flow)>=2);s.government.cash-=2*s.exchangeRate;s.bank.foreignAssetsUSD-=2;
 near(s.government.reservesUSD,r-2);near(s.government.cash,cash-2*s.exchangeRate);near(s.bank.equity,equity);near(accountBalances(s).bankResidual,0);
});
test('household sovereign claims receive coupons and principal with reconciled bank deposits',()=>{
 const s=start(),flow={sovereignSpread:.04,defaultProbability:0,domesticIssued:0};
 // A liquid investor can subscribe; transfer cash from Treasury (no money creation).
 s.government.cash-=1000;s.households.at(-1).cash+=1000;
 const oldClaims=nonbankDebt(s),cash=s.government.cash,eq=s.bank.equity;
 const issued=subscribeHouseholds(s,100,flow);assert.ok(issued>0);near(nonbankDebt(s),oldClaims+issued);near(s.government.cash,cash+issued);near(accountBalances(s).bankResidual,0);
 const shares=domesticCouponShares(s);s.government.cash-=shares.total;distributeCoupon(s,shares.total,shares);near(accountBalances(s).bankResidual,0);
 const b=s.government.domesticBonds.at(-1),claims=b.principal;s.government.cash-=claims;redeemDomestic(s,b,claims);near(nonbankDebt(s),oldClaims);near(accountBalances(s).bankResidual,0);
 assert.ok(s.bank.equity>=eq);near(s.households.reduce((v,h,i)=>v+householdBonds(s,i),0),oldClaims);
});
test('changing financing cost responds through investment with no direct GDP deduction',()=>{
 const s=start(),before=s.metrics.realGDPMonthly,low=investmentOpportunities(s,s,1);s.bank.lendingRate+=.1;
 const high=investmentOpportunities(s,s,1);assert.ok(high.every((x,i)=>x.desired<low[i].desired));near(s.metrics.realGDPMonthly,before);
});
test('export separates audit checks, economic alerts, evidence and reproducibility',()=>{
 let s=start();for(let i=0;i<8;i++)s=advanceMonth(s);
 const file=JSON.parse(exportSimulation(s)),v=file.calculationDiagnostics.verification;
 assert.equal(v.economicValidation.status,'not empirically certified');assert.ok(v.contract.sources.length>=3);assert.equal(v.replay.status,'not run in browser');assert.equal(v.technical.recordedMonths,8);
 assert.deepEqual(replayJournal(importSimulation(JSON.stringify(file))).metrics,s.metrics);
});

test('unpaid external bank interest becomes arrears, never unlimited new principal',()=>{
 const s=start(),delta=-100-s.bank.foreignAssetsUSD;s.bank.foreignAssetsUSD+=delta;s.bank.equity+=delta*s.exchangeRate;
 const flow={},principal=s.bank.foreignAssetsUSD,equity=s.bank.equity;
 settleBankForeignInterest(s,1,0,flow);near(s.bank.foreignAssetsUSD,principal);near(s.bank.foreignArrearsUSD,1);near(s.bank.equity,equity-s.exchangeRate);near(accountBalances(s).bankResidual,0);
 settleBankForeignInterest(s,1,0,flow);near(s.bank.foreignAssetsUSD,principal);near(s.bank.foreignArrearsUSD,2);near(accountBalances(s).bankResidual,0);
});

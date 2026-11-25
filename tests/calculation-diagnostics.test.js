import {enterpriseBusinesses} from '../src/enterprise-market.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('every new month records actual consumption, investment, labor and budget calculations',()=>{
 for(const country of ['poor','middle','rich']){
  const start=createSimulation({...newGameOptions({country}),politicalMode:false});
  const next=advanceMonth(start),t=next.journal[0].calculationTrace;
  assert.equal(t.before.month,0);assert.equal(t.after.month,1);assert.equal(t.households.length,10);assert.equal(t.investment.length,5);assert.equal(t.labor.length,5);assert.equal(t.debtService.length,10+enterpriseBusinesses(start).length+(next.livelihoods?.last.entries.length??0));
  for(const h of t.households){if(!h.macro)near(h.desiredSpending,Math.max(h.essentialSpending??0,Math.max(0,((h.income-h.interestPaid)*h.mpc+h.cashBefore*h.wealthAnnuity)*h.rateResponse)));near(h.budget+(h.usedAssetReserve??0)+(h.durableUnspent??0),Math.min(h.plannedSpending??h.smoothedSpending,h.cashSpendingLimit+(h.inKindBudget??0))+(h.durableSavingsDraw??0));}
  for(const i of t.investment){if(i.firmPlans)near(i.desired,i.firmPlans.reduce((a,c)=>a+(c.desired??0),0));else if(i.enterprisePlans)near(i.desired,i.enterprisePlans.reduce((a,c)=>a+(c.desired??0),0));else if(i.errorCorrection!==undefined)near(i.desired,i.previousInvestment*Math.exp(i.errorCorrection+i.shortRun));else near(i.desired,Math.max(0,i.previousInvestment+i.investmentAdjustment*(i.unsmoothedTarget-i.previousInvestment)));near(i.deliveredVolume,i.fundedPlan*i.deliveryFactor);}
  near(t.investment.reduce((a,b)=>a+b.deliveredVolume,0)+(t.networkInvestment??[]).reduce((a,b)=>a+b.amount,0)*t.report.diagnostics.domesticOrderFulfillment,next.metrics.investment);
  near(t.labor.reduce((a,b)=>a+b.workersAfter,0)+(next.defense?.economy?.accounts?.people??0),next.metrics.productiveWorkers??next.metrics.employment);
  near(t.budgetPlan.requestedPurchases,t.report.diagnostics.procurementRequested);
  assert.deepEqual(t.report.fiscal,next.lastReport.fiscal);
  const round=importSimulation(exportSimulation(next));assert.deepEqual(round.journal[0].calculationTrace,t);
  assert.deepEqual(replayJournal(round).metrics,next.metrics);
  const before=JSON.stringify(next.journal[0]);advanceMonth(next);assert.equal(JSON.stringify(next.journal[0]),before);
 }
});
test('old saves start observation now without fabricating historical traces',()=>{
 let s=createSimulation({...newGameOptions(),politicalMode:false});s=advanceMonth(s);
 delete s.diagnosticBaseline;delete s.journal[0].calculationTrace;delete s.lastReport.calculationTrace;
 s=importSimulation(exportSimulation(s));const next=advanceMonth(s),d=JSON.parse(exportSimulation(next)).calculationDiagnostics;
 assert.equal(d.baseline.kind,'observation-start');assert.equal(d.baseline.month,1);
 assert.deepEqual(d.coverage.missingMonths,[1]);assert.equal(d.coverage.firstRecordedMonth,2);
 assert.equal(next.journal[0].calculationTrace,undefined);
});
test('recorded observations cannot influence subsequent economic outcomes',()=>{
 let s=createSimulation({...newGameOptions({country:'poor'}),politicalMode:false});
 for(let i=0;i<3;i++)s=advanceMonth(s);
 const stripped=importSimulation(exportSimulation(s));
 delete stripped.diagnosticBaseline;delete stripped.lastReport.calculationTrace;
 for(const e of stripped.journal)delete e.calculationTrace;
 assert.deepEqual(advanceMonth(s).metrics,advanceMonth(stripped).metrics);
});

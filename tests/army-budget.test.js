import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,copy,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {policyAuthority,executePolitical} from '../src/political-system.js';
import {unresolvedInitiatives} from '../src/political-agenda.js';
import {armyBudgetSummary} from '../src/army-ui.js';
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('army allocation is funded as part of purchases once and does not become police spending',()=>{
 const options=newGameOptions();options.politicalMode=false;options.policy.militaryBudget=0;const base=createSimulation(options),more=copy(base);
 const a=advanceMonth(base),b=advanceMonth(more,{...more.policy,militaryBudget:2});
 near(b.lastReport.calculationTrace.budgetPlan.requestedMilitary,b.lastReport.calculationTrace.budgetPlan.budgetBase*.02);
 const f=b.lastReport.fiscal,plan=b.lastReport.calculationTrace.budgetPlan;
 near(f.militaryPurchases,f.purchases*2/plan.purchaseShare);
 assert.ok(f.militaryPurchases>0);assert.ok(f.purchases>a.lastReport.fiscal.purchases);
 const expenditure=f.purchases+f.transfers+f.familyBenefits+f.businessSupport+f.concessionGuarantees+f.interest+f.bankRescue+f.networkPurchases-f.networkSales;
 near(b.metrics.governmentSpending,expenditure);
 for(const v of Object.values(b.lastReport.audit))assert.ok(Math.abs(v)<.001);
 const summary=armyBudgetSummary(b);near(summary.paid,f.militaryPurchases);near(summary.rate,2);
 near(summary.spendingShare,f.militaryPurchases/expenditure*100);
 assert.equal(b.policy.securityBudget,base.policy.securityBudget);
 assert.deepEqual(importSimulation(exportSimulation(b)).metrics,b.metrics);
 assert.deepEqual(replayJournal(b).metrics,b.metrics);
});
test('military budget is a budget law, never a direct unvoted slider change',()=>{
 const s=createSimulation(newGameOptions());assert.equal(policyAuthority(s,'militaryBudget'),'law');
 for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});
 executePolitical(s,{kind:'policyDecision',patch:{militaryBudget:2}});
 const b=s.politics.bills.at(-1);assert.equal(b.kind,'budget');assert.equal(b.patch.militaryBudget,2);
 assert.equal(s.policy.militaryBudget,0);assert.ok(b.finalVote);
});
test('old saves without a separated army allocation import at zero without changing past economic outcomes',()=>{
 let s=createSimulation(newGameOptions());for(const b of unresolvedInitiatives(s))executePolitical(s,{kind:'decideBill',billId:b.id,decision:'reject'});s=advanceMonth(s);
 const data=JSON.parse(exportSimulation(s));delete data.state.policy.militaryBudget;delete data.state.politics.lawPolicy.militaryBudget;
 const before=copy(data.state.history),loaded=importSimulation(JSON.stringify(data));
 assert.equal(loaded.policy.militaryBudget,0);assert.equal(loaded.politics.lawPolicy.militaryBudget,0);
 assert.deepEqual(loaded.history,before);assert.deepEqual(replayJournal(loaded).metrics,loaded.metrics);
});

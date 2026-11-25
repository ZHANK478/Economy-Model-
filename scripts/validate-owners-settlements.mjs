import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createSimulation,advanceMonth,accountBalances,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';import {newGameOptions} from '../src/start-presets.js';
import {inheritOwner,ownerEquityByGroup,ownerWealthPoints} from '../src/wealth-owners.js';
const sum=a=>a.reduce((a,b)=>a+b,0),results=[];
for(const country of ['poor','middle','rich']){
 let s=createSimulation({...newGameOptions({country,resource:false}),politicalMode:false,defenseMode:false});
 const startUrban=s.settlements.reference.urbanShare;
 for(let i=0;i<60;i++)s=advanceMonth(s);
 assert.deepEqual(advanceMonth(importSimulation(exportSimulation(s))),advanceMonth(s));assert.deepEqual(replayJournal(s).metrics,s.metrics);
 const before=accountBalances(s),output=s.metrics.realGDPMonthly;inheritOwner(s,s.wealthOwners.families.find(r=>r.kind==='owner').id);assert.deepEqual(accountBalances(s),before);assert.equal(s.metrics.realGDPMonthly,output);
 // Measurement sensitivity to a different initial within-group equity split.
 // These are diagnostic copies, not policies or journalled counterfactual histories.
 const wealth=s.households.map((h,i)=>h.cash+ownerEquityByGroup(s)[i]);
 const concentration=[];for(const tailShare of [.1,.3,.5]){const c=structuredClone(s);for(let i=0;i<10;i++){
  const cells=c.wealthOwners.families.filter(r=>r.group===i),ids=new Set(cells.flatMap(r=>Object.keys(r.stakes)));
  for(const id of ids){const total=sum(cells.map(r=>r.stakes[id]??0));for(let j=0;j<5;j++)cells[j].stakes[id]=total*(j===4?tailShare:(1-tailShare)/4);}
 }const points=ownerWealthPoints(c,wealth),owners=sum(points.filter(r=>r.kind==='owner').map(r=>r.amount));concentration.push({tailShare,ownerWealth:owners,totalWealth:sum(points.map(r=>r.amount))});}
 results.push({country,months:60,startUrban,endUrban:s.settlements.history.at(-1).urbanShare,totalInternalMoves:sum(s.settlements.history.map(r=>r.moves)),relocationServicesPaid:sum(s.settlements.history.map(r=>r.relocationPaid)),foodCompensation:sum(s.settlements.last.ownFood),incomeGini:s.metrics.giniDisposable,wealthGini:s.metrics.wealthGiniNonnegative,top01WealthShare:s.metrics.top01WealthShare,maxModeledWealthUSD:s.metrics.maxModeledWealthUSD,realGDPPerCapita:s.metrics.gdpPerCapitaReal,unemployment:s.metrics.unemployment,auditError:s.metrics.auditError,measurementSensitivity:concentration});
}
await writeFile('docs/owners-settlements-validation.json',JSON.stringify({schema:1,revision:newGameOptions().economicRevision,date:new Date().toISOString(),results,limitations:['Fixed enacted initial policy, diversified scenarios, no politics or defense.','Family strata are representative cohorts, not observed individual billionaires.','Changing the initial tail allocation changes measured concentration without changing national assets; no observed target Gini is imposed.','Urbanization, income and output need not increase. Migration is not a productivity bonus.','Natural food consumption is an explicitly limited compensation-in-kind channel inside existing agriculture, not a new unmeasured farm sector.']},null,2)+'\n');console.log(JSON.stringify(results,null,2));

// Behavioural diagnostics, not country forecasts or target GDP/Gini tests.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createSimulation,advanceMonth} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {groupBasket} from '../src/household-consumption.js';
import {settleLaborDistribution} from '../src/labor.js';
const sum=a=>a.reduce((a,b)=>a+b,0),results=[];
for(const country of ['poor','middle','rich']){
 const options={...newGameOptions({country,resource:false}),politicalMode:false,defenseMode:false};
 let s=createSimulation(options),old=createSimulation({...options,economicRevision:18});
 for(let i=0;i<24;i++){s=advanceMonth(s);old=advanceMonth(old,old.policy,{preserveEconomicRevision:true});}
 const observation=x=>({foodExpenditureShare:sum(x.householdEconomy.records.map(r=>r.categories.food))/sum(x.householdEconomy.records.map(r=>r.consumption)),incomeGini:x.metrics.giniDisposable,wealthGini:x.metrics.wealthGiniNonnegative,realGDPPerCapita:x.metrics.gdpPerCapitaReal,unemployment:x.metrics.unemployment,auditError:x.metrics.auditError});
 const prices=s.firms.map(f=>f.price),basket=groupBasket(s,0,s.base.consumptionWeights,prices,.2,1),dearPrices=prices.map((p,j)=>j===0?p*2:p),dear=groupBasket(s,0,s.base.consumptionWeights,dearPrices,.2,1);
 const foodVolume=b=>sum(b.map((q,j)=>q*b.foodFractions[j]));
 const before=structuredClone(s.laborDistribution),moreSkills=structuredClone(s);moreSkills.laborDistribution.schooling=moreSkills.laborDistribution.schooling.map(y=>Math.min(18,y+1));settleLaborDistribution(moreSkills);
 assert.ok(moreSkills.laborDistribution.sectors[2].schoolingPremium<before.sectors[2].schoolingPremium);
 const taxCut=advanceMonth(s,{...s.policy,incomeTax:0,incomeTaxProgressivity:0}),control=advanceMonth(s);
 results.push({country,months:24,current:observation(s),legacy18:observation(old),foodCalibration:s.base.foodCalibration,foodPriceResponse:{initialPhysicalShare:foodVolume(basket),dearerRawFoodPhysicalShare:foodVolume(dear)},skillSupplyResponse:{beforePremium:before.sectors[2].schoolingPremium,oneExtraYearAllGroupsPremium:moreSkills.laborDistribution.sectors[2].schoolingPremium},taxSensitivity:{controlGini:control.metrics.giniDisposable,zeroIncomeTaxGini:taxCut.metrics.giniDisposable}});
}
const report={revision:newGameOptions().economicRevision,date:new Date().toISOString(),results,limitations:['Matched initial policy and seed, no political or defense systems; current and legacy calibrations differ because the old food-fitting bug is removed.','No target GDP growth or Gini level; these diagnostics do not certify country realism.','Food price response is an isolated basket calculation; the complete economy also changes incomes, prices and supplies.','Tax experiment changes only income tax and progressivity for one month; it is not a general verdict on liberal policy.']};
await writeFile('docs/household-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

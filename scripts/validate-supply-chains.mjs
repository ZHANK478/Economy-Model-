// Reproducible paired scenarios, no retrospective rewrite of any saved journal.
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,scheduleShock,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
let transitions=0,maxAudit=0;
const step=(s,legacy=false)=>{const n=advanceMonth(s,s.policy,{preserveEconomicRevision:legacy});transitions++;maxAudit=Math.max(maxAudit,...Object.values(n.lastReport.audit).map(Math.abs));return n;};
const scenarios=[];
for(const country of ['poor','middle','rich'])for(const resource of [false,true]){
 let start=createSimulation({...newGameOptions({country,resource}),politicalMode:false,economicRevision:4});
 for(let i=0;i<12;i++)start=step(start,true);
 let control=structuredClone(start),shock=structuredClone(start),legacy=structuredClone(start);
 for(const s of [shock,legacy])scheduleShock(s,{key:'importAvailability',multiplier:.8,duration:14});
 const path=[];
 for(let i=0;i<38;i++){
  control=step(control);shock=step(shock);legacy=step(legacy,true);
  path.push({after:i+1,gdpGapPercent:100*(shock.metrics.realGDPMonthly/control.metrics.realGDPMonthly-1),unemploymentGapPP:shock.metrics.unemployment-control.metrics.unemployment,inflationGapPP:shock.metrics.inflationYoY-control.metrics.inflationYoY,industryGapPercent:100*(shock.firms[2].production/control.firms[2].production-1),legacyGDPGapPercent:100*(legacy.metrics.realGDPMonthly/control.metrics.realGDPMonthly-1)});
 }
 const replay=replayJournal(importSimulation(exportSimulation(shock)));
 assert.deepEqual(replay.metrics,shock.metrics);assert.deepEqual(replay.economy.supplyChains,shock.economy.supplyChains);
 scenarios.push({country,resource,path});
}
const sensitivities=[];
for(const multiplier of [.9,.8,.6])for(const duration of [3,14,36]){
 const options={...newGameOptions({country:'middle',resource:false}),politicalMode:false};
 let control=createSimulation(options),shock=createSimulation(options);
 scheduleShock(shock,{key:'importAvailability',multiplier,start:5,duration});
 let minimumGDPGap=0,maximumUnemploymentGap=0;
 for(let i=0;i<duration+28;i++){
  control=step(control);shock=step(shock);
  minimumGDPGap=Math.min(minimumGDPGap,100*(shock.metrics.realGDPMonthly/control.metrics.realGDPMonthly-1));
  maximumUnemploymentGap=Math.max(maximumUnemploymentGap,shock.metrics.unemployment-control.metrics.unemployment);
 }
 sensitivities.push({multiplier,duration,minimumGDPGapPercent:minimumGDPGap,maximumUnemploymentGapPP:maximumUnemploymentGap,finalGDPGapPercent:100*(shock.metrics.realGDPMonthly/control.metrics.realGDPMonthly-1)});
}
assert.ok(maxAudit<1e-5);
console.log(JSON.stringify({revision:5,transitions,maxAudit,scenarios,sensitivities,empiricalCertification:false,interpretation:'Paired counterfactuals under the same policies, no elections. Magnitudes are scenario results, not estimated treatment effects. The IMF 2021 euro-area results are an external plausibility reference, not a target imposed on GDP.'},null,2));

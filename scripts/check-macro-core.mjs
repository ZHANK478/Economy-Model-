import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
const baselines=[],experiments=[],sensitivities=[];
let transitions=0,maxAudit=0;
function step(s,policy=s.policy){const n=advanceMonth(s,policy);transitions++;const error=Math.max(...Object.values(n.lastReport.audit).map(Math.abs));maxAudit=Math.max(maxAudit,error);assert.ok(error<1e-6*Math.max(1,n.metrics.nominalGDPMonthly));if(!(Number.isFinite(n.metrics.realGDPMonthly)&&n.metrics.realGDPMonthly>0)){console.error(JSON.stringify({failure:'nonpositive-output',country:s.initialAccounts?.referenceCountry,month:n.month,before:metric(s),after:metric(n),prices:n.firms.map(f=>f.price),world:n.lastReport.world,diagnostics:n.lastReport.diagnostics,events:n.lastReport.events}));throw new Error('Nonpositive output');}return n;}
const metric=s=>({gdpPerCapita:s.metrics.gdpPerCapitaReal,unemployment:s.metrics.unemployment,inflation:s.metrics.inflationYoY,investment:s.metrics.investment,debtRatio:s.metrics.debtRatio,defaults:s.government.defaults});
function initial(country,resource=false,extra={}){const o=newGameOptions({country,resource});return createSimulation({...o,...extra,policy:{...o.policy,monetaryRegime:'rule',...extra.policy},politicalMode:false});}
for(const country of ['poor','middle','rich'])for(const resource of [false,true]){
 let s=initial(country,resource),minGDP=Infinity,maxUnemployment=0,alerts=0;
 for(let i=0;i<360;i++){s=step(s);minGDP=Math.min(minGDP,s.metrics.gdpPerCapitaReal);maxUnemployment=Math.max(maxUnemployment,s.metrics.unemployment);alerts+=s.journal.at(-1).calculationTrace.warnings.length;}
 const restored=importSimulation(exportSimulation(s)),r=replayJournal(restored);
 for(const[k,v]of Object.entries(s.metrics))if(typeof v==='number')assert.ok(Math.abs(r.metrics[k]-v)<1e-8*Math.max(1,Math.abs(v)),k);
 baselines.push({country,resource,months:360,...metric(s),minGDP,maxUnemployment,economicAlerts:alerts});
}
const shocks=[['rate-up',{rate:15,monetaryRegime:'discretion'}],['rate-down',{rate:1,monetaryRegime:'discretion'}],['government-purchases-up',{governmentConsumption:12}],['income-tax-up',{incomeTax:30}],['capital-requirement-up',{bankCapitalRequirement:18}],['tariff-up',{tariff:10}]];
for(const country of ['poor','middle','rich'])for(const [name,patch]of shocks){let a=initial(country),b=initial(country);for(let i=0;i<60;i++){a=step(a);b=step(b,i===0?{...b.policy,...patch}:b.policy);}experiments.push({country,name,months:60,baseline:metric(a),experiment:metric(b)});}
for(const country of ['poor','middle','rich'])for(const share of [.28,.35,.42]){let s=initial(country,false,{economicParameters:{capitalShare:share}});for(let i=0;i<120;i++)s=step(s);sensitivities.push({country,capitalShare:share,months:120,...metric(s)});}
const result={revision:4,technicalChecks:'passed',empiricalCertification:false,source:'scripts/check-macro-core.mjs',baselineMonetaryRule:'same rule as an independent central bank; no political elections in baseline',transitions,maxAudit,baselines,experiments,sensitivities,interpretation:'This run detects arithmetic failures and exposes economic paths. It does not establish country forecast accuracy or identify causal policy effects. Long-run scenario alerts remain research tasks.'};
await writeFile('src/model-verification-results.js','// Generated checks, exported only; not a UI report.\nexport const MODEL_VERIFICATION_RUN='+JSON.stringify(result)+';\n');
console.log(JSON.stringify({transitions,maxAudit,baselines,experiments:experiments.length,sensitivities:sensitivities.length}));

import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation,scheduleShock} from '../src/engine.js';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [savePath,baselineEnginePath]=process.argv.slice(2);
if(!savePath||!baselineEnginePath)throw Error('Usage: node scripts/validate-fiscal-prices.mjs SAVE.json BASELINE/src/engine.js');
const {replayJournal:historicalEngineReplay}=await import(pathToFileURL(resolve(baselineEnginePath))); 
import {newGameOptions} from '../src/start-presets.js';
const metrics=s=>({month:s.month,gdpPerCapita:s.metrics.gdpPerCapitaReal,unemployment:s.metrics.unemployment,inflation:s.metrics.inflationYoY,defaults:s.government.defaults,fulfillment:s.lastReport.market?.fulfillment,cpi:s.consumerPriceIndex});
let transitions=0,maxAuditRelative=0;
function step(s,policy=s.policy,options={preserveEconomicRevision:true}){const n=advanceMonth(s,policy,options);transitions++;const e=Math.max(...Object.values(n.lastReport.audit).map(Math.abs))/Math.max(1,n.metrics.nominalGDPMonthly);maxAuditRelative=Math.max(e,maxAuditRelative);assert.ok(e<1e-6);assert.ok(n.firms.every(f=>f.price>0&&Number.isFinite(f.price)));assert.ok(n.government.cash>=0&&n.government.fundUSD>=0);if(n.economy.revision>=23){assert.ok(!(n.lastReport.fiscal.fundDeposit>0&&n.lastReport.fiscal.fundWithdrawal>0));if(n.government.arrears>1e-8)assert.equal(n.lastReport.fiscal.fundDeposit,0);}return n;}
const results=[];
for(const country of ['poor','middle','rich'])for(const resource of [false,true])for(const revision of [22,23]){
 let s=createSimulation({...newGameOptions({country,resource}),economicRevision:revision,politicalMode:false,defenseMode:false});const rows=[metrics(s)];
 for(let i=0;i<210;i++){s=step(s);if(s.month%60===0||s.month===210)rows.push(metrics(s));}
 results.push({country,resource,revision,rows});console.log(JSON.stringify({country,resource,revision,final:rows.at(-1)}));
}
const shocks=[];
for(const name of ['no-change','spending-cut','spending-rise','crop-failure','credit-stress','zero-rate','tariff']){
 let s=createSimulation({...newGameOptions({country:'poor',resource:false}),politicalMode:false,defenseMode:false});
 if(name==='crop-failure')scheduleShock(s,{key:'weather',multiplier:.55,start:6,duration:12});
 if(name==='credit-stress')s.policy.bankCapitalRequirement=25;
 if(name==='zero-rate'){s.policy.rate=0;s.policy.inflationTarget=0;s.policy.monetaryRegime='discretion';}
 if(name==='tariff')s.policy.tariff=30;
 if(name==='spending-cut'){s.policy.governmentConsumption=0;s.policy.publicInvestment=0;s.policy.transfers=0;}
 if(name==='spending-rise')s.policy.governmentConsumption=15;
 for(let i=0;i<60;i++)s=step(s);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.metrics,s.metrics);assert.deepEqual(replayJournal(loaded).metrics,s.metrics);
 shocks.push({name,...metrics(s)});console.log(JSON.stringify(shocks.at(-1)));
}
const save=JSON.parse(await readFile(savePath,'utf8')).state;
const historical=replayJournal(save),priorHistorical=historicalEngineReplay(save);assert.deepEqual(historical.metrics,priorHistorical.metrics);
const savedMetricMaxRelativeError=Math.max(...Object.entries(save.metrics).filter(([,v])=>typeof v==='number').map(([k,v])=>Math.abs(historical.metrics[k]-v)/Math.max(1,Math.abs(v))));assert.ok(savedMetricMaxRelativeError<1e-6);
console.log(JSON.stringify({historicalEngineComparison:'exact',savedMetricMaxRelativeError}));
const cut=save.government.defaultEpisodes[0].start-1,origin=replayJournal({...save,journal:save.journal.slice(0,cut),politics:{...save.politics,turnCommands:[]}});
const entry=save.journal[cut],payment=[];
for(const revision of [22,23]){const s=structuredClone(origin);s.economy.revision=revision;s.policy=structuredClone(entry.requestedPolicy??entry.policy);s.parameters=structuredClone(entry.parameters);s.world=structuredClone(entry.world);s.shocks=structuredClone(entry.shocks);s.stochastic=entry.stochastic;const n=step(s);payment.push({revision,...metrics(n),fundBeforeUSD:s.government.fundUSD,fundAfterUSD:n.government.fundUSD,fiscal:n.lastReport.fiscal,arrears:n.government.arrears});console.log(JSON.stringify({historicalPayment:revision,defaultActive:n.government.defaultActive,arrears:n.government.arrears,withdrawal:n.lastReport.fiscal.fundWithdrawal,deposit:n.lastReport.fiscal.fundDeposit,payments:n.lastReport.fiscal.treasuryPayments}));}
const continuation=step(save,save.policy,{preserveEconomicRevision:false});assert.equal(continuation.economy.revision,23);assert.equal(JSON.stringify(continuation.journal.slice(0,-1)),JSON.stringify(save.journal));const continuationReplay=replayJournal(continuation);const continuationReplayMaxRelativeError=Math.max(...Object.entries(continuation.metrics).filter(([,v])=>typeof v==='number').map(([k,v])=>Math.abs(continuationReplay.metrics[k]-v)/Math.max(1,Math.abs(v))));assert.ok(continuationReplayMaxRelativeError<1e-6);
await writeFile('docs/fiscal-prices-validation.json',JSON.stringify({transitions,maxAuditRelative,results,shocks,historicalReplay:true,savedMetricMaxRelativeError,continuationReplayMaxRelativeError,payment,continuation:metrics(continuation),empiricalCertification:false},null,2)+'\n');
console.log(JSON.stringify({transitions,maxAuditRelative,complete:true}));

import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,scheduleShock} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';import {familyCompanies,validateLivelihoods} from '../src/livelihoods.js';import {validateExtendedState} from '../src/state-validation.js';
const sum=a=>a.reduce((v,x)=>v+x,0),rows=[];let transitions=0,maxAudit=0,maxLand=0;
const metric=s=>({month:s.month,gdp:s.metrics.gdpPerCapitaReal,unemployment:s.metrics.unemployment,selfEmployed:s.metrics.selfEmployment,ownUse:s.metrics.ownUseWorkers,mixedIncome:s.metrics.mixedIncome,ownFood:s.metrics.ownUseFoodValue,inflation:s.metrics.inflationYoY,lowEarningSelf:s.metrics.underemployedSelf});
function step(s){const n=advanceMonth(s);transitions++;validateExtendedState(n);validateLivelihoods(n);const error=Math.max(...Object.values(n.lastReport.audit).map(Math.abs))/Math.max(1,n.metrics.nominalGDPMonthly);maxAudit=Math.max(maxAudit,error);assert.ok(error<1e-6);const land=n.livelihoods.landAllocated/(n.livelihoods.landTotal-n.livelihoods.reference[0].workers);maxLand=Math.max(maxLand,land);assert.ok(land<=1+1e-8);assert.ok(n.firms.every(f=>f.price>0&&Number.isFinite(f.price)));assert.ok(n.households.every(h=>h.cash>=-1e-6));for(const g of n.laborDistribution.groups)assert.ok(Math.abs(g.employed+g.unemployed-g.laborForce)<1e-6);assert.ok(Math.abs(n.metrics.employment+n.metrics.ownUseWorkers-n.metrics.productiveWorkers)<1e-7);return n;}
for(const country of ['poor','middle','rich'])for(const resource of [false,true]){
 let s=createSimulation({...newGameOptions({country,resource}),politicalMode:false,defenseMode:false});for(let i=0;i<128;i++)s=step(s);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.metrics,s.metrics);assert.deepEqual(replayJournal(loaded).metrics,s.metrics);rows.push({country,resource,...metric(s),producerCount:familyCompanies(s).length});console.log(JSON.stringify(rows.at(-1)));
}
const shocks=[];
for(const name of ['crop-failure','spending-cut','credit-stress','closed-entry','no-cash','no-land']){
 let s=createSimulation({...newGameOptions({country:'poor',resource:false}),politicalMode:false,defenseMode:false});
 if(name==='crop-failure')scheduleShock(s,{key:'weather',multiplier:.4,start:6,duration:12});
 if(name==='spending-cut'){s.policy.governmentConsumption=0;s.policy.publicInvestment=0;s.policy.transfers=0;}
 if(name==='credit-stress')s.policy.bankCapitalRequirement=25;
 if(name==='closed-entry')s.policy.privateBusinessEntry=false;
 if(name==='no-cash')for(const h of s.households){const debit=h.cash;h.cash=0;s.bank.equity+=debit;}
 // Changing a synthetic land endowment is a controlled model experiment, not a policy.
 if(name==='no-land')s.livelihoods.landTotal=s.livelihoods.reference[0].workers;
 for(let i=0;i<48;i++){
  if(name==='no-land'){const n=advanceMonth(s);validateLivelihoods(n);assert.equal(n.livelihoods.landAllocated,0);s=n;transitions++;}else s=step(s);
 }
 shocks.push({name,...metric(s)});console.log(JSON.stringify(shocks.at(-1)));
}
const historical=[];const baseline=process.env.LIVELIHOODS_BASELINE;
if(process.argv.length>2&&!baseline)throw Error('Set LIVELIHOODS_BASELINE to the pre-revision-24 checkout');
for(const path of process.argv.slice(2)){
 const saved=JSON.parse(await readFile(path,'utf8')).state;const old=await import(pathToFileURL(resolve(baseline,'src/engine.js')));const a=replayJournal(saved),b=old.replayJournal(saved);assert.deepEqual(a.metrics,b.metrics);
 const n=step(saved);assert.equal(n.economy.revision,24);assert.equal(JSON.stringify(n.journal.slice(0,-1)),JSON.stringify(saved.journal));const loaded=importSimulation(exportSimulation(n));assert.deepEqual(advanceMonth(loaded).metrics,advanceMonth(n).metrics);
 historical.push({file:path.split('/').at(-1),oldMonth:saved.month,oldRevision:saved.economy.revision,oldEngineReplay:'exact',continuation:metric(n)});console.log(JSON.stringify(historical.at(-1)));
}
await writeFile('docs/livelihoods-validation.json',JSON.stringify({revision:24,transitions,maxAudit,maxLand,rows,shocks,historical,empiricalCertification:false},null,2)+'\n');console.log(JSON.stringify({complete:true,transitions,maxAudit,maxLand}));

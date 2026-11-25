import assert from 'node:assert/strict';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {validateExtendedState} from '../src/state-validation.js';
import {sectorCompanies} from '../src/enterprise-market.js';
const hash=createHash('sha256');for(const f of (await readdir('src')).filter(f=>f.endsWith('.js')&&f!=='calculation-build.js').sort()){hash.update(f+'\0');hash.update(await readFile('src/'+f));hash.update('\0');}
const results=[];let months=0,maxRelativeAudit=0;
for(const country of ['poor','middle','rich'])for(const controls of [0,100]){
 const o=newGameOptions({country,resource:false});o.politicalOptions.nameSeed=42;let s=createSimulation({...o,politicalMode:false,defenseMode:false});let primary=0,secondary=0,migration=0,foreignCapital=0,minGDP=Infinity;
 for(let i=0;i<120;i++){s=advanceMonth(s,{...s.policy,capitalControls:controls});validateExtendedState(s);months++;minGDP=Math.min(minGDP,s.metrics.realGDPMonthly);primary+=s.internationalCapital.last.primaryEquityUSD;secondary+=s.internationalCapital.last.secondaryEquityUSD;migration+=s.talentMigration.last.inflow-s.talentMigration.last.outflow;foreignCapital+=s.internationalCapital.last.completedForeignFundedCapital;
  for(const v of Object.values(s.lastReport.audit)){const error=Math.abs(v)/Math.max(1,Math.abs(s.metrics.nominalGDPAnnual));maxRelativeAudit=Math.max(maxRelativeAudit,error);assert.ok(error<1e-8);}
 }
 if(controls===100){assert.equal(primary,0);assert.equal(secondary,0);}
 const restored=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(restored),advanceMonth(s));assert.deepEqual(replayJournal(s).metrics,s.metrics);
 results.push({country,capitalControls:controls,months:s.month,minGDP,finalGDP:s.metrics.realGDPMonthly,primaryEquityUSD:primary,secondaryEquityUSD:secondary,completedForeignFundedCapital:foreignCapital,netMigration:migration,recognizedEmployedHigh:s.talentMigration.last.employedHigh,unrecognizedHigh:s.talentMigration.last.unrecognizedHigh,markets:[2,3,4].map(sector=>({sector,companies:sectorCompanies(s,sector).length,active:sectorCompanies(s,sector).filter(c=>c.active).length,bankruptcies:sectorCompanies(s,sector).reduce((v,c)=>v+c.bankruptcies,0)}))});console.log(`Checked ${country}/controls=${controls}: ${s.month} months`);
}
await writeFile('docs/firms-capital-talent-validation.json',JSON.stringify({schema:1,revision:21,date:new Date().toISOString(),sourceSHA256:hash.digest('hex'),months,maxRelativeAudit,results,limitations:['Technical checks, not causal estimates or national calibration.','Fixed initial policies apart from capital controls; no politics or defense; three fictional starts.','Zero and full controls change several external channels; scenario differences are not identified treatment effects.','Aggregate interindustry complementarity can magnify simultaneous company failures.','Founder origin is a cohort label, not an observed individual registry.']},null,2)+'\n');
console.log(JSON.stringify({months,maxRelativeAudit}));

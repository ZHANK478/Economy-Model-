import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,replayJournal,exportSimulation,importSimulation} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {executePolitical} from '../src/political-system.js';
import {commissionPresident} from '../src/european-commission.js';
import {europeanUnionDossier} from '../src/foreign-country-dossier.js';
import {euroAdopted,euroExchangeRate,foreignStepDone,foreignTradeCost} from '../src/foreign-programme.js';
import {policyAuthority} from '../src/legislation.js';

function cabinet(goalId,milestoneId){
 const o=scenarioOptions();
 const s=createSimulation({...o,politicalOptions:{...o.politicalOptions,governmentGoalsRevision:2}});
 executePolitical(s,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
 executePolitical(s,{kind:'formCabinet',goalId,milestoneId});
 for(const kind of ['activateScenarioDiplomacy','enablePartnerTrade'])executePolitical(s,{kind});
 return s;
}
const until=(initial,month)=>{
 let s=initial;
 while(s.month<month)s=advanceMonth(s);
 return s;
};
const step=(s,id,action)=>executePolitical(s,{kind:'foreignProgrammeStep',step:id,action});

test('Britain can complete the integration programme and transfers monetary policy to the ECB',()=>{
 let s=cabinet('integration','erm');
 assert.equal(commissionPresident(s).name,'Romano Prodi');
 assert.equal(commissionPresident({...s,month:60}).name,'José Manuel Barroso');
 const dossier=europeanUnionDossier(s);
 assert.match(dossier,/data-codex-person="commission-president-1999"/);
 assert.match(dossier,/data-scenario-eu/);
 assert.doesNotMatch(dossier,/Органы и организации ЕС/);
 assert.doesNotMatch(dossier,/data-foreign-programme-open/);
 assert.throws(()=>step(s,'euro','open'),/24 месяцев/);
 step(s,'erm','open');
 s=until(s,1);
 assert.throws(()=>step(s,'erm','ratify'),/пока не готов/);
 step(s,'schengen','open');
 executePolitical(s,{kind:'chooseLaw',title:'Налоговый пакет',patch:{vat:23,incomeTax:25}});
 s=until(s,3);
 assert.equal(step(s,'erm','ratify').passed,true);
 s=until(s,13);
 assert.equal(step(s,'schengen','ratify').passed,true);
 assert.equal(foreignTradeCost(s,'eu',4),.98);
 s=until(s,27);
 step(s,'euro','open');
 s=until(s,30);
 assert.equal(step(s,'euro','ratify').passed,true);
 assert.equal(euroAdopted(s),true);
 assert.equal(policyAuthority(s,'monetaryRegime'),'centralBank');
 assert.throws(()=>executePolitical(s,{kind:'notifyEUWithdrawal'}),/еврозону/);
 s=advanceMonth(s);
 assert.equal(s.politics.governmentGoals.completedMonth,s.month);
 assert.equal(s.monetary.effectiveRate,3.25);
 assert.ok(Math.abs(s.exchangeRate-euroExchangeRate(s))<1e-10);
 executePolitical(s,{kind:'retireGovernmentProgramme'});
 assert.throws(()=>step(s,'euro','open'),/программа завершена/);
 s=advanceMonth(s);
 assert.ok(euroAdopted(s));
 const replayed=replayJournal(importSimulation(exportSimulation(s)));
 assert.deepEqual(replayed.politics.foreignProgramme,s.politics.foreignProgramme);
 assert.equal(replayed.exchangeRate,s.exchangeRate);
 assert.equal(replayed.politics.governmentProgrammeRetired,true);
});

test('the Global Britain route requires withdrawal and ratifies independent bilateral agreements',()=>{
 let s=cabinet('globalBritain','japan');
 assert.throws(()=>step(s,'japan','open'),/завершите выход/);
 s=until(s,1);
 executePolitical(s,{kind:'notifyEUWithdrawal'});
 s=until(s,25);
 for(const id of ['japan','canada','australia'])step(s,id,'open');
 s=until(s,31);
 assert.equal(step(s,'canada','ratify').passed,true);
 s=until(s,34);
 assert.equal(step(s,'japan','ratify').passed,true);
 s=until(s,43);
 assert.equal(step(s,'australia','ratify').passed,true);
 assert.ok(foreignStepDone(s,'australia'));
 assert.ok(foreignTradeCost(s,'jp')<1&&foreignTradeCost(s,'au')<foreignTradeCost(s,'ca'));
 assert.equal(foreignTradeCost(s,'eu'),1);
 s=advanceMonth(s);
 assert.equal(s.politics.governmentGoals.completedMonth,s.month);
 assert.ok(!euroAdopted(s));
});

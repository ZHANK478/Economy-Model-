// Usage: node scripts/verify-treasury-save.mjs SAVE.json
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {copy,replayJournal,advanceMonth,executePolitical} from '../src/engine.js';
const saved=JSON.parse(await readFile(process.argv[2],'utf8')).state;
const month=saved.government.defaultEpisodes[0].start,entry=saved.journal[month-1];
const origin=replayJournal({...saved,journal:saved.journal.slice(0,month-1),politics:{...saved.politics,turnCommands:[]}});
const cases=[];
for(const revision of [entry.economicRevision,23]){
 const s=copy(origin);s.economy.revision=revision;s.parameters=copy(entry.parameters);s.world=copy(entry.world);s.shocks=copy(entry.shocks);s.stochastic=entry.stochastic;
 if(entry.economicParameters)s.economy.parameters=copy(entry.economicParameters);
 for(const c of entry.turnPoliticalCommands??[]){s.politics.nextCommandId=c.id;executePolitical(s,c);}
 s.pendingActions=copy(entry.submittedActions??[]);s.nextActionId=entry.nextActionId??s.nextActionId;s.politics.pendingCommands=copy(entry.politicalCommands??[]);s.politics.nextCommandId=entry.nextCommandId??s.politics.nextCommandId;
 const n=advanceMonth(s,entry.requestedPolicy??entry.policy,{preserveEconomicRevision:true});
 cases.push({revision,month,defaultActive:n.government.defaultActive,arrears:n.government.arrears,fundBeforeUSD:s.government.fundUSD,fundAfterUSD:n.government.fundUSD,centralReservesBeforeUSD:s.government.reservesUSD,fundWithdrawalLC:n.lastReport.fiscal.fundWithdrawal,fundDepositLC:n.lastReport.fiscal.fundDeposit,payments:n.lastReport.fiscal.treasuryPayments,audit:n.lastReport.audit});
}
assert.equal(cases[0].defaultActive,true);assert.equal(cases[1].defaultActive,false);assert.equal(cases[1].arrears,0);assert.ok(cases[1].fundWithdrawalLC>0);assert.equal(cases[1].fundDepositLC,0);assert.ok(cases[1].payments.every(p=>p.reason===null));
await writeFile('docs/fiscal-prices-save-validation.json',JSON.stringify({recordedDefaultMonth:month,cases},null,2)+'\n');console.log(JSON.stringify(cases));

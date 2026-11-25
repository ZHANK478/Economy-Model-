// Read-only historical comparison. Usage: node scripts/recheck-treasury-payment.mjs SAVE.json MONTH
import {readFile} from 'node:fs/promises';
import {copy,replayJournal,advanceMonth,executePolitical} from '../src/engine.js';
const input=process.argv[2],month=Number(process.argv[3]);
if(!input||!Number.isInteger(month)||month<1)throw new Error('Provide SAVE.json and a positive journal month.');
const saved=JSON.parse(await readFile(input,'utf8')).state,entry=saved.journal[month-1];
if(!entry)throw new Error('Month absent from journal.');
const origin=replayJournal({...saved,journal:saved.journal.slice(0,month-1),politics:{...saved.politics,turnCommands:[]}});
for(const revision of [entry.economicRevision,14]){
 const s=copy(origin);s.economy.revision=revision;s.parameters=copy(entry.parameters);s.world=copy(entry.world);s.shocks=copy(entry.shocks);s.stochastic=entry.stochastic;
 for(const c of entry.turnPoliticalCommands??[]){s.politics.nextCommandId=c.id;executePolitical(s,c);}
 s.pendingActions=copy(entry.submittedActions??[]);s.nextActionId=entry.nextActionId??s.nextActionId;s.politics.pendingCommands=copy(entry.politicalCommands??[]);s.politics.nextCommandId=entry.nextCommandId??s.politics.nextCommandId;
 const r=advanceMonth(s,entry.requestedPolicy??entry.policy,{preserveEconomicRevision:true});
 const error=Math.max(0,...Object.entries(entry.outcome).filter(([,v])=>typeof v==='number').map(([k,v])=>Math.abs(v-r.metrics[k])/Math.max(1,Math.abs(v))));
 console.log(JSON.stringify({revision,month:r.month,defaultActive:r.government.defaultActive,cashLC:r.government.cash,reservesUSD:r.government.reservesUSD,arrearsLC:r.government.arrears,settlementCreditLC:r.lastReport.fiscal.settlementCredit??0,centralBorrowingLC:r.bank.centralBorrowing,payments:r.lastReport.fiscal.treasuryPayments??null,auditError:r.metrics.auditError,relativeDifferenceFromRecordedMetrics:error},null,2));
}

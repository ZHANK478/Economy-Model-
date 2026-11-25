import test from 'node:test';
import assert from 'node:assert/strict';
import {newspaperCandidates,updateNewspaper,newspaperDialog} from '../src/newspaper.js';
import {pressDialog,updatePress} from '../src/press-ui.js';
const country=()=>({month:20,policy:{bankCapitalRequirement:10},metrics:{reserveMonths:.1,debtServiceRevenue:110,debtRatio:55,capitalRatio:12,governmentPurchases:50,realGDPMonthly:500,unemployment:8,fulfillment:100},government:{defaultActive:false,defaultEpisodes:[],externalBonds:[{principal:100}],reservesUSD:1.4,arrears:0},history:[{month:19,capitalRatio:12,governmentPurchases:50,realGDPMonthly:500}],lastReport:{fiscal:{tax:60,interest:38,purchases:50},calculationTrace:{budgetPlan:{requestedPurchases:50}}},shocks:[]});
test('paper warns about payment vulnerability rather than treating 55 percent debt as a default',()=>{
 const s=country(),before=JSON.stringify(s),press={};
 const issue=updateNewspaper(s,press);
 assert.equal(issue.key,'warning');assert.equal(issue.stage,2);assert.match(issue.body,/не прогноз неизбежного дефолта/);
 assert.equal(JSON.stringify(s),before);assert.equal(s.government.defaultActive,false);
 assert.equal(updateNewspaper(s,press),null);
 press.pending=false;const restored=JSON.parse(JSON.stringify(press));
 for(let month=21;month<70;month++)assert.equal(updateNewspaper({...s,month},restored),null);
});
test('a first default interrupts the ordinary cooldown once, not every month of the same episode',()=>{
 const s=country(),press={};updateNewspaper(s,press);press.pending=false;
 s.month=21;s.government.defaultActive=true;s.government.defaultEpisodes=[{start:21}];s.government.externalBonds[0]={principal:100,inDefault:true,overdue:5};s.lastReport.fiscal.financingRequests=[{unfunded:0}];
 const issue=updateNewspaper(s,press);assert.equal(issue.key,'default');assert.match(issue.body,/Финансирование в национальной валюте было привлечено/);
 press.pending=false;
 for(let month=22;month<60;month++)assert.equal(updateNewspaper({...s,month},press),null);
});
test('new banking and payment failures have their own issue but repeat restructurings do not',()=>{
 const s=country(),press={};s.government.defaultEpisodes=[{start:15}];s.metrics.capitalRatio=5;s.lastReport.fiscal.domesticHaircut=30;
 assert.equal(updateNewspaper(s,press).key,'banking');press.pending=false;
 s.history.push({month:20,capitalRatio:5,governmentPurchases:50,realGDPMonthly:500});
 s.month++;s.metrics.governmentPurchases=0;s.lastReport.fiscal.purchases=0;s.lastReport.fiscal.militaryRequested=2;s.lastReport.fiscal.militaryPurchases=0;
 assert.equal(updateNewspaper(s,press).key,'budget');press.pending=false;
 s.month+=13;assert.notEqual(updateNewspaper(s,press)?.key,'banking');
});
test('small changes and tranquil opening conditions do not interrupt play',()=>{
 const s=country();s.metrics.reserveMonths=6;s.metrics.debtServiceRevenue=20;s.lastReport.fiscal.interest=5;
 assert.deepEqual(newspaperCandidates(s),[]);
 assert.equal(updateNewspaper({...s,month:0},{}),null);
});
test('newspaper rendering escapes text and separates shock magnitude from GDP losses',()=>{
 const s=country();s.metrics.reserveMonths=6;s.lastReport.fiscal.interest=5;s.metrics.debtServiceRevenue=20;
 s.lastReport.worldNews={id:'world:test',start:20,duration:12,title:'<script>test</script>',text:'Components',key:'importAvailability',multiplier:.8};
 const issue=newspaperCandidates(s)[0],html=newspaperDialog(issue,{date:String,esc:x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;')});
 assert.equal(issue.key,'world');assert.match(issue.watch,/не равен/);assert.ok(!html.includes('<script>'));assert.match(html,/Вестник республики/);assert.match(html,/data-action="world-news-close"/);
});

test('expensive new government borrowing warns with ample reserves and only once per persistent episode',()=>{
 const s=country();s.metrics.reserveMonths=10;s.metrics.sovereignSpread=20;s.metrics.exchangeRate=1;
 s.government.externalBonds=[];s.lastReport.fiscal.domesticIssued=15;
 const before=JSON.stringify(s),press={version:1,checkedMonth:s.month};
 const issue=updateNewspaper(s,press);assert.equal(issue.key,'borrowing');assert.match(issue.title,/займы подорожали/);assert.equal(JSON.stringify(s),before);
 const html=newspaperDialog(issue,{esc:String,date:String});assert.match(html,/Казна платит больше за новые займы/);assert.ok(!html.includes('Валютные резервы на низком уровне'));
 press.pending=false;const restored=JSON.parse(JSON.stringify(press));
 for(let month=21;month<60;month++)assert.equal(updateNewspaper({...s,month},restored),null);
 // Persistent distress does not reappear after reload or an ordinary cooldown.
 assert.equal(restored.borrowingWarned,true);
});
test('credit warning requires actual expensive issuance and a material interest burden, not a high policy rate alone',()=>{
 const s=country();s.metrics.reserveMonths=10;s.metrics.sovereignSpread=3;s.policy.rate=35;s.lastReport.fiscal.domesticIssued=15;
 assert.ok(!newspaperCandidates(s).some(x=>x.key==='borrowing'));
 s.metrics.sovereignSpread=20;s.lastReport.fiscal.domesticIssued=0;assert.ok(!newspaperCandidates(s).some(x=>x.key==='borrowing'));
 s.lastReport.fiscal.domesticIssued=15;s.lastReport.fiscal.interest=1;assert.ok(!newspaperCandidates(s).some(x=>x.key==='borrowing'));
});
test('six consecutive healthy months rearm credit news, while a first default keeps priority',()=>{
 const s=country();s.metrics.reserveMonths=10;s.metrics.sovereignSpread=20;s.lastReport.fiscal.domesticIssued=15;
 const press={};assert.equal(updateNewspaper(s,press).key,'borrowing');press.pending=false;
 for(let month=21;month<=26;month++)updateNewspaper({...s,month,metrics:{...s.metrics,sovereignSpread:4},lastReport:{fiscal:{tax:60,interest:5,purchases:50}}},press);
 assert.equal(press.borrowingWarned,false);
 const issue=updateNewspaper({...s,month:33},press);assert.equal(issue.key,'borrowing');press.pending=false;
 const next={...s,month:34,government:{...s.government,defaultActive:true,defaultEpisodes:[{start:34}]}};
 assert.equal(updateNewspaper(next,press).key,'default');
});

test('simultaneous crises and the discovery of concealed violations each get an edition',()=>{
 const s=country(),press={lastPopupMonth:s.month-1};
 s.government.defaultActive=true;
 s.government.defaultEpisodes=[{start:s.month}];
 s.metrics.capitalRatio=5;
 s.lastReport.fiscal.domesticHaircut=30;
 s.rentSeeking={cases:[{id:1,detectedMonth:null,status:'unobserved'},{id:2,detectedMonth:s.month,status:'investigating'}]};
 assert.equal(updatePress(s,press),true);
 assert.deepEqual(press.editions.republic.map(x=>x.id),['default:20','banking:20','public-audit:20']);
 assert.equal(updatePress(s,JSON.parse(JSON.stringify(press))),false);
});

test('the newspaper reader exposes each edition directly in a horizontal navigation',()=>{
 const state={politics:{pressRevision:1}},press={editions:{'press-ledger':[{id:'ledger',month:1,title:'Budget',text:[]}]}};
 const html=pressDialog(state,'press-ledger',press,{esc:String,date:String});
 assert.equal((html.match(/data-press-paper=/g)??[]).length,4);
 assert.match(html,/data-press-paper="press-ledger" aria-pressed="true"/);
 assert.match(html,/Новый выпуск/);
 assert.doesNotMatch(html,/<select/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,accountBalances,exportSimulation,importSimulation,replayJournal,scheduleOwnership} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {enterpriseBusinesses,sectorCompanies} from '../src/enterprise-market.js';
import {initializeFirmMarkets,prepareFirmMarkets,additionalCapacityFactor,completeFirmCapital,enterFirm,validateFirmMarkets,resolveFirm} from '../src/firm-markets.js';
import {initializeTalent,advanceTalent,skillCapacityFactor,finishTalent,validateTalent} from '../src/talent-migration.js';
import {initializeInternationalCapital,stampForeignFunding,recordForeignCompletion,validateInternationalCapital} from '../src/international-capital.js';
import {corporateDebt,serviceCorporateBonds} from '../src/corporate-bonds.js';
import {synchronizeOwnerClaims,validateOwners} from '../src/wealth-owners.js';
const sum=a=>a.reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=(extra={})=>createSimulation({...newGameOptions({country:'middle',resource:false}),politicalMode:false,defenseMode:false,...extra});
test('revision 21 partitions existing firms and bank claims without an opening productivity or asset bonus',()=>{
 const s=start({economicRevision:20}),money=accountBalances(s),K=s.firms.map(f=>f.capital),claims=sum(s.foundation.businessBankClaims),n=enterpriseBusinesses(s).length;
 s.economy.revision=21;initializeFirmMarkets(s);initializeTalent(s);initializeInternationalCapital(s);synchronizeOwnerClaims(s);prepareFirmMarkets(s);
 for(const [k,v] of Object.entries(money))near(accountBalances(s)[k],v);s.firms.forEach((f,i)=>near(f.capital,K[i]));near(sum(s.foundation.businessBankClaims),claims);assert.equal(enterpriseBusinesses(s).length,n+4);
 for(const sector of [3,4]){near(additionalCapacityFactor(s,sector),1);near(skillCapacityFactor(s,sector),1);assert.equal(sectorCompanies(s,sector).length,3);}
 validateFirmMarkets(s);validateOwners(s);validateTalent(s);validateInternationalCapital(s);
});
test('completed capital belongs to paid recipients, not every firm in a sector',()=>{
 const s=start(),rows=sectorCompanies(s,3),before=rows.map(c=>c.capital),cash=rows.map(c=>c.cash);
 completeFirmCapital(s,3,100,{firmIds:[rows[1].id],firmShares:[1]});near(rows[1].capital,before[1]+100);near(rows[0].capital,before[0]);assert.deepEqual(rows.map(c=>c.cash),cash);
});
test('a paid restart purchases existing estate assets and restores creditor equity without creating capital',()=>{
 const s=start();s.policy.foreignBusinessEntry=false;s.policy.privateBusinessEntry=true;const rows=sectorCompanies(s,3);for(const c of rows)c.active=false;s.firms[3].unfilledOrders=1e8;
 const K=s.firms[3].capital,gdp=s.metrics.realGDPMonthly,bank=s.bank.equity,money=sum(s.households.map(h=>h.cash))+s.firms[3].cash;
 enterFirm(s,3,1,0,()=>assert.fail('domestic restart'));const c=rows.at(-1);assert.equal(rows.length,4);assert.ok(c.active&&c.capital>0&&c.cash>0);near(s.firms[3].capital,K);near(s.metrics.realGDPMonthly,gdp);
 near(money-sum(s.households.map(h=>h.cash))-s.firms[3].cash,s.bank.equity-bank);synchronizeOwnerClaims(s);validateOwners(s);validateFirmMarkets(s);
});
test('liquidity bridge creates debt; corporate creditors count when deciding solvency',()=>{
 const s=start(),rows=sectorCompanies(s,3),c=rows[0];c.cash=-1;c.loanLC=0;c.loanFX=0;c.capital=100;c.inventory=0;c.bonds=[{principal:200,holdings:s.households.map(()=>20),rate:.1,maturity:1}];
 const hooks={grantLoan:(_,x,n)=>{x.cash+=n;x.loanLC+=n;},repayLoan:()=>0,writeOff:()=>0,transfer:(a,b,n)=>{a.cash-=n;b.cash+=n;}};
 resolveFirm(s,3,c,{externalEquityRevaluation:0},[],hooks);assert.equal(c.active,false);assert.equal(c.last.solventLiquidityBridge,undefined);
});
test('rollover raises household money and does not charge a new bond coupon on its issue date',()=>{
 const s=start(),c=sectorCompanies(s,3)[0];s.month=60;c.cash=0;c.loanLC=0;c.loanFX=0;const principal=10;c.bonds=[{id:'due',principal,holdings:s.households.map(()=>1),rate:0,issuedMonth:0,maturity:60}];
 const cash=sum(s.households.map(h=>h.cash));const r=serviceCorporateBonds(s);assert.ok(r.some(x=>x.kind==='paid-refinancing'&&x.refinanced===10));near(corporateDebt(s,c),principal);near(c.cash,0);near(sum(s.households.map(h=>h.cash)),cash);near(c.bondInterestPaid,0);near(c.bondArrears,0);
});
test('foreign funding tags actual invoices and completed capital without posting extra money or output',()=>{
 const s=start(),c=sectorCompanies(s,4)[0],before=accountBalances(s),gdp=s.metrics.realGDPMonthly;c.externalEquityCashLC=8;
 const p={type:'private',sector:4,amount:10,firmIds:[c.id],firmShares:[1]};stampForeignFunding(s,p,2);near(p.foreignFunding.paidLC,8);near(c.externalEquityCashLC,0);recordForeignCompletion(s,p,100);near(s.internationalCapital.completions.at(-1).foreignFundedCapital,40);assert.deepEqual(accountBalances(s),before);near(s.metrics.realGDPMonthly,gdp);
});
test('migration changes composition within actual population, with recognition and employment limits',()=>{
 const s=start(),prev=structuredClone(s),people=.1;s.population+=people;s.ageCohorts[1]+=people;advanceTalent(s,prev,people);near(sum(s.households.map(h=>h.population)),1);near(sum(s.talentMigration.groups.map(g=>g.adults)),people);assert.ok(s.talentMigration.groups[8].unrecognizedHigh>0);
 for(const g of s.laborDistribution.groups)g.employed=0;finishTalent(s);near(s.talentMigration.last.employedHigh,0);validateTalent(s);
 const before=s.population,p=structuredClone(s);s.population-=people/2;s.ageCohorts[1]-=people/2;advanceTalent(s,p,-people/2);near(sum(s.households.map(h=>h.population))*s.population,before-people/2);validateTalent(s);
});
test('construction and service privatization, new ledgers and migration survive JSON and exact replay',()=>{
 let s=start();for(const sector of [3,4]){scheduleOwnership(s,{sector,kind:'privatize',points:1});s=advanceMonth(s);}for(let i=0;i<22;i++)s=advanceMonth(s);
 validateFirmMarkets(s);validateOwners(s);assert.ok(s.lastReport.internationalCapital);assert.ok(s.lastReport.talentMigration);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded),advanceMonth(s));assert.deepEqual(replayJournal(s).metrics,s.metrics);
 for(const mutate of [x=>x.firmMarkets.markets[0].companies[0].cash=-1,x=>x.talentMigration.groups[0].unrecognizedHigh=1e9]){const data=JSON.parse(exportSimulation(s));mutate(data.state);assert.throws(()=>importSimulation(JSON.stringify(data)));}
});
test('revision 20 journals migrate at the next boundary and remain reproducible',()=>{
 let s=start({economicRevision:20});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});assert.equal(s.firmMarkets,undefined);const journal=JSON.stringify(s.journal);s=advanceMonth(s);assert.equal(s.economy.revision,24);assert.equal(JSON.stringify(s.journal.slice(0,1)),journal);assert.deepEqual(replayJournal(s).metrics,s.metrics);
});
test('relative company quotes do not compound into an extra sector price trend',async()=>{
 const {finishFirmMarket,prepareFirmMarkets}=await import('../src/firm-markets.js'),{finishEnterpriseMarket,prepareEnterpriseMarket}=await import('../src/enterprise-market.js');const s=start();
 for(const sector of [2,3,4]){const rows=sectorCompanies(s,sector);for(const c of rows)c.lastProfit=c.lastRevenue*.3;for(let i=0;i<24;i++){if(sector===2){finishEnterpriseMarket(s,1);prepareEnterpriseMarket(s);}else {finishFirmMarket(s,sector,1);prepareFirmMarkets(s);}near(s.firms[sector].price,1);near(sum(rows.map(c=>c.price*c.volumeWeight)),1);}assert.notEqual(rows[0].price,rows[1].price);}
});
test('capitalized unpaid coupons retain eligible contract rates instead of including unaccrued new issues',()=>{
 let s=createSimulation({...newGameOptions({country:'poor',resource:false}),politicalMode:false,defenseMode:false});
 // Deliberately distressed coupon fixture, not a country calibration.
 for(const b of s.government.domesticBonds)b.rate=12;
 s=advanceMonth(s);assert.ok(s.lastReport.fiscal.interestCapitalized>0);assert.ok(s.lastReport.fiscal.domesticIssued>0);
 const overdue=s.government.domesticBonds.filter(b=>b.overdue>0&&b.maturity===s.month);assert.ok(overdue.length>0);for(const b of overdue){if(b.interestArrears){near(b.rate,0);near(b.originalContractRate,12);}else near(b.rate,12);}
});
test('firm allocation cannot amplify the aggregate investment demand envelope',async()=>{
 const {financeFirmInvestment}=await import('../src/firm-markets.js');const s=start();
 for(const sector of [3,4]){for(const c of sectorCompanies(s,sector))c.cash=10000;const r=financeFirmInvestment(s,sector,50,1,()=>assert.fail('no loan needed'));near(r.desired,50);near(r.funded,50);}
});
test('shrinking employment and production cannot leave staff or output at closed firms',()=>{
 const s=start(),rows=sectorCompanies(s,3);rows[0].active=false;prepareFirmMarkets(s);s.firms[3].workers*=.9;s.firms[3].production*=.9;near(rows[0].workers,0);near(rows[0].production,0);
});

test('unfunded education reports no recognition capacity used and cannot recognize backlog',()=>{
 const s=start(),prev=structuredClone(s);prev.lastReport.fiscal.education=0;prev.services.publicEducationCapacity=2;prev.services.publicEducationDelivered=0;const g=s.talentMigration.groups[8];Object.assign(g,{adults:.1,schoolYears:1.6,unrecognizedYears:.8,highSkilled:.1,unrecognizedHigh:.1});advanceTalent(s,prev,0);near(s.talentMigration.last.recognized,0);near(s.talentMigration.last.recognitionCapacityUsed,0);near(g.unrecognizedYears,.8);
});

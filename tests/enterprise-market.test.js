import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,scheduleOwnership,exportSimulation,importSimulation,accountBalances,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {enterpriseBusinesses,industryCompanies,initializeEnterpriseMarket,prepareEnterpriseMarket,financeEnterpriseInvestment,completeEnterpriseCapital,validateEnterpriseMarket,resolveEnterprise} from '../src/enterprise-market.js';
import {executeOwnership} from '../src/ownership.js';
const sum=a=>a.reduce((x,y)=>x+y,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=()=>{const o=newGameOptions();o.politicalOptions.nameSeed=42;return createSimulation({...o,politicalMode:false,defenseMode:false});};
const transfer=(a,b,v)=>{a.cash-=v;b.cash+=v;};
test('four real company accounts consolidate once into sector/bank balances and snapshots remain immutable',()=>{
 const s=start(),f=s.firms[2],companies=industryCompanies(s);assert.equal(companies.length,4);
 for(const k of ['cash','loanLC','loanFX','capital','workers','inventory'])near(f[k],sum(companies.map(c=>c[k])));
 const a=accountBalances(s);near(a.bankAssets-a.deposits-a.centralBorrowing-(s.bank.foreignArrearsUSD??0)*s.exchangeRate-a.bankEquity,0);
 const before=JSON.stringify(s),next=advanceMonth(s);assert.equal(JSON.stringify(s),before);validateEnterpriseMarket(next);
 assert.equal(next.foundation.businessBankClaims.length,enterpriseBusinesses(next).length);
});
test('purchases respond to a producer price and are actual separately paid revenues',()=>{
 const a=start(),b=start();industryCompanies(b)[0].price*=.6;
 const first=advanceMonth(a),cheap=advanceMonth(b);assert.ok(industryCompanies(cheap)[0].last.unitsSold>industryCompanies(first)[0].last.unitsSold);
 for(const s of [first,cheap]){near(sum(industryCompanies(s).map(c=>c.last.revenue)),s.firms[2].lastRevenue);for(const c of industryCompanies(s))if(c.last.unitsSold>0)near(c.last.revenue,c.last.unitsSold*c.last.transactionPrice);assert.ok(s.metrics.auditError<1e-5);}
});
test('privatization of one company pays Treasury from buyers cash without touching other owners or capital',()=>{
 const s=start(),rows=industryCompanies(s),others=JSON.stringify(rows.slice(1).map(c=>c.ownership)),capital=s.firms[2].capital,treasury=s.government.cash,households=sum(s.households.map(h=>h.cash)),state=rows[0].ownership.state;
 scheduleOwnership(s,{sector:2,enterpriseId:rows[0].id,kind:'privatize',points:5});const flow={equitySales:0};const result=executeOwnership(s,flow,[],{transfer});
 assert.equal(result.length,1);near(rows[0].ownership.state,state-result[0].actualPoints/100);near(s.government.cash-treasury,result[0].cost);near(households-sum(s.households.map(h=>h.cash)),result[0].cost);near(s.firms[2].capital,capital);assert.equal(JSON.stringify(rows.slice(1).map(c=>c.ownership)),others);validateEnterpriseMarket(s);
});
test('investment is constrained by each company own cash and credit; paid projects retain the intended owner',()=>{
 const s=start(),rows=industryCompanies(s);transfer(rows[0],rows[1],rows[0].cash);s.bank.creditSupply=0;s.policy.corporateBondMarket=false;prepareEnterpriseMarket(s);
 const before=rows.map(c=>c.cash),plan=financeEnterpriseInvestment(s,100,1,()=>assert.fail('no credit allowed'));
 assert.equal(rows[0].fundedInvestment,0);assert.ok(rows[1].fundedInvestment>0);near(plan.loan,0);assert.deepEqual(rows.map(c=>c.cash),before);
 const capitals=rows.map(c=>c.capital);completeEnterpriseCapital(s,12,[0,1,0,0]);rows.forEach((c,i)=>near(c.capital,capitals[i]+(i===1?12:0)));
});
test('bankruptcy pays for a transfer of existing assets and recognizes remaining bank losses',()=>{
 const s=start(),rows=industryCompanies(s),c=rows[0];c.last={};c.cash=-10;c.loanLC=1e6;c.loanFX=0;c.foreignEquityUSD=0;
 const capital=s.firms[2].capital,inventory=s.firms[2].inventory,equity=s.bank.equity,otherCash=sum(rows.slice(1).map(x=>x.cash)),flow={externalEquityRevaluation:0};
 const grantLoan=(s,c,v)=>{c.loanLC+=v;c.cash+=v;},repayLoan=(s,c,v)=>{const paid=Math.min(v,c.loanLC);c.cash-=paid;c.loanLC-=paid;},writeOff=(s,c)=>{const loss=c.loanLC;c.loanLC=0;s.bank.equity-=loss;return loss;};
 const result=resolveEnterprise(s,c,flow,[],{transfer,grantLoan,repayLoan,writeOff});
 assert.equal(c.active,false);assert.equal(c.loanLC,0);assert.ok(result.loss>0);near(equity-s.bank.equity,result.loss);near(s.firms[2].capital,capital);near(s.firms[2].inventory,inventory);near(otherCash-sum(rows.slice(1).map(x=>x.cash)),c.last.liquidationProceeds);assert.ok(c.cash>=0);
});
test('company state, bills, investment queues and continuation survive save and exact replay',()=>{
 let s=start();scheduleOwnership(s,{sector:2,enterpriseId:'industry-2',kind:'privatize',points:5});for(let i=0;i<48;i++)s=advanceMonth(s);
 const loaded=importSimulation(exportSimulation(s)),replay=replayJournal(loaded);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.enterpriseMarket,s.enterpriseMarket);assert.deepEqual(advanceMonth(loaded).metrics,advanceMonth(s).metrics);
 const corrupt=JSON.parse(exportSimulation(s));corrupt.state.enterpriseMarket.companies[0].cash+=1;assert.throws(()=>importSimulation(JSON.stringify(corrupt)),/учёт/);
});
test('legacy migration keeps completed months and partitions existing assets without free deposits',()=>{
 let s=createSimulation({...newGameOptions(),economicRevision:15,politicalMode:false,defenseMode:false});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});const old=JSON.stringify(s.journal);const upgraded=advanceMonth(s);assert.equal(upgraded.economy.revision,24);assert.equal(JSON.stringify(upgraded.journal.slice(0,1)),old);assert.deepEqual(replayJournal(upgraded).metrics,upgraded.metrics);
});
test('an insolvent company can fail while three competitors keep trading, with valid later saves',()=>{
 let s=start();const c=industryCompanies(s)[0];transfer(c,s.households[9],c.cash);c.loanLC+=1e6;s.bank.equity+=1e6;
 for(let i=0;i<24;i++){s=advanceMonth(s);validateEnterpriseMarket(s);assert.ok(s.metrics.auditError<1e-5);}
 assert.equal(industryCompanies(s)[0].active,false);assert.ok(industryCompanies(s).slice(1).every(c=>c.active));
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded).metrics,advanceMonth(s).metrics);
});
test('bank resolution converts each business deposit once and preserves distinct company cash and equity claims',async()=>{
 const {resolveBanking}=await import('../src/economic-foundation.js');const s=start(),loss=s.bank.equity+1000;
 s.bank.equity-=loss;s.bank.foreignAssetsUSD-=loss/s.exchangeRate;s.foundation.banks.forEach(b=>{b.equity=s.bank.equity*b.share;});s.policy.bankEntry=false;
 resolveBanking(s,5000,[]);assert.equal(s.foundation.businessBankClaims.length,enterpriseBusinesses(s).length);assert.ok(industryCompanies(s).every(c=>c.cash>=0));
 const a=accountBalances(s);near(a.bankAssets-a.deposits-a.centralBorrowing-(s.bank.foreignArrearsUSD??0)*s.exchangeRate-a.bankEquity,0);
});

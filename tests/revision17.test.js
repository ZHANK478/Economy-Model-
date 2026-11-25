import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,exportSimulation,importSimulation,replayJournal,accountBalances,scheduleShock} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {sectorProducts,PRODUCTS,productImportPrices,validateProductMarkets,productCapacityFactor} from '../src/product-markets.js';
import {financeNewEnterprises,independentEnterprisePlans,validateBusinessDynamics,tagInvestmentProject} from '../src/business-dynamics.js';
import {industryCompanies,completeEnterpriseCapital,financeEnterpriseInvestment,prepareEnterpriseMarket} from '../src/enterprise-market.js';
import {issueCorporateBond,serviceCorporateBonds,resolveCorporateBonds,corporateDebt,householdCorporateBonds,validateCorporateBonds} from '../src/corporate-bonds.js';
import {subscribeHouseholds,householdBonds} from '../src/bond-market.js';
const sum=a=>a.reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const start=()=>createSimulation({...newGameOptions(),politicalMode:false,defenseMode:false});
test('twelve submarkets partition existing stocks and capacity without an opening output shock',()=>{
 const s=createSimulation({...newGameOptions(),economicRevision:17,politicalMode:false,defenseMode:false});assert.equal(s.productMarkets.products.length,12);assert.equal(PRODUCTS.length,12);
 for(let i=0;i<5;i++){near(sum(sectorProducts(s,i).map(p=>p.inventory)),s.firms[i].inventory);near(productCapacityFactor(s,i),1);}
 validateProductMarkets(s);
});
test('product supply, stocks, paid revenue and value added consolidate without duplicate GDP',()=>{
 let s=start();for(let i=0;i<18;i++)s=advanceMonth(s);
 for(let i=0;i<5;i++){
  const products=s.lastReport.products.filter(p=>p.sector===i);
  near(sum(products.map(p=>p.production)),s.lastReport.market.production[i]);near(sum(products.map(p=>p.revenue)),s.firms[i].lastRevenue);near(sum(products.map(p=>p.valueAdded)),s.lastReport.gdp.sectorValueAdded[i]);
  for(const p of products){near(p.openingInventory+p.production,p.sold+p.endingInventory);if(p.sold>0)near(p.transactionPrice*p.sold,p.revenue);}
 }
});
test('fuel, power and transport have distinct imported prices; FX changes every imported quote',()=>{
 const s=start(),w={energyPrice:100,commodityPrice:100},a=productImportPrices(s,w),b=productImportPrices(s,{...w,energyPrice:200});
 assert.ok(b[3]/a[3]>b[4]/a[4]);assert.ok(b[9]>a[9]);s.exchangeRate*=2;productImportPrices(s,w).forEach((x,i)=>near(x,2*a[i]));
});
test('a fuel tariff affects fuel separately, with actual market prices feeding inflation',()=>{
 let a=start(),b=start();for(let i=0;i<12;i++){a=advanceMonth(a);b=advanceMonth(b,{...b.policy,fuelPricing:'regulated',fuelTariff:50});}
 const fuel=s=>s.productMarkets.products.find(p=>p.id==='fuel').price;
 assert.ok(fuel(b)<fuel(a));assert.ok(b.consumerPriceIndex<a.consumerPriceIndex);assert.ok(b.metrics.auditError<1e-5);
});
test('company investment responds independently to expected receipts and requires its own financing',()=>{
 let s=advanceMonth(start());const rows=industryCompanies(s),plan=s.economy.last.investmentPlans[2],unit=s.metrics.investmentPrice;
 independentEnterprisePlans(s,plan,unit);const first=rows[0].desiredInvestment,other=rows[1].desiredInvestment;rows[0].expectedRevenue*=1.5;
 independentEnterprisePlans(s,plan,unit);assert.ok(rows[0].desiredInvestment>first);near(rows[1].desiredInvestment,other);
 s.policy.corporateBondMarket=false;s.bank.creditSupply=0;rows[0].cash=0;financeEnterpriseInvestment(s,plan.desired,unit,()=>assert.fail('credit disabled'));near(rows[0].fundedInvestment,0);
});
test('entry is paid, foreign entry does not require a local cash shortage, IDs preserve old project recipients',()=>{
 const s=start(),capital=s.firms[2].capital;for(const c of industryCompanies(s))c.cash+=10000;
 s.businessDynamics.assumptions.entryIntensity=100;s.policy.foreignBusinessEntry=true;
 const before=accountBalances(s),rows=industryCompanies(s),ids=rows.map(c=>c.id),oldCapital=rows.map(c=>c.capital);
 const amount=financeNewEnterprises(s,[{}, {},{foreignScore:.2}],1,100000,(s,c,usd)=>{c.cash+=usd*s.exchangeRate;s.bank.foreignAssetsUSD+=usd;});
 assert.ok(amount>0);assert.equal(rows.length,5);near(rows[4].capital,0);near(rows[4].cash,amount*s.exchangeRate);near(s.firms[2].capital,capital);
 completeEnterpriseCapital(s,10,[1,0,0,0],ids);near(rows[0].capital,oldCapital[0]+10);near(rows[4].capital,0);
 const after=accountBalances(s);near(after.deposits-before.deposits,amount*s.exchangeRate);near(after.bankAssets-before.bankAssets,amount*s.exchangeRate);validateBusinessDynamics(s);
});
test('local entry transfers actual household money and acquires no free equipment',()=>{
 const s=start();s.businessDynamics.assumptions.entryIntensity=100;s.policy.foreignBusinessEntry=false;
 const householdCash=sum(s.households.map(h=>h.cash)),deposits=accountBalances(s).deposits;
 financeNewEnterprises(s,[{}, {},{foreignScore:.2}],1,0,()=>assert.fail('local only'));
 const c=industryCompanies(s).at(-1);assert.equal(industryCompanies(s).length,5);near(householdCash-sum(s.households.map(h=>h.cash)),c.cash);near(accountBalances(s).deposits,deposits);near(c.capital,0);near(sum(c.domesticOwners),1);
});
test('corporate bonds transfer deposits, pay coupons, mature and allocate default losses to bondholders',()=>{
 const s=start(),c=industryCompanies(s)[0];s.bank.depositRate=0;const before=accountBalances(s),cash=c.cash;
 const issued=issueCorporateBond(s,c,10);assert.ok(issued>0);near(c.cash-cash,issued);near(corporateDebt(s,c),issued);near(sum(s.households.map((_,i)=>householdCorporateBonds(s,i))),issued);near(accountBalances(s).deposits,before.deposits);near(accountBalances(s).bankAssets,before.bankAssets);
 const [bond]=c.bonds;s.month=bond.maturity;const reports=serviceCorporateBonds(s);near(reports[0].principalPaid,issued);near(corporateDebt(s,c),0);assert.ok(sum(s.households.map(h=>h.corporateBondIncome))>0);
 issueCorporateBond(s,c,10);const debt=corporateDebt(s,c),equity=s.bank.equity;c.cash=1;const result=resolveCorporateBonds(s,c);near(result.loss,debt-1);near(s.bank.equity,equity);validateCorporateBonds(s);
});
test('households with spare savings can buy sovereign bonds without a universal three-income lock',()=>{
 const s=start(),old=sum(s.households.map((_,i)=>householdBonds(s,i)));s.policy.rate=15;s.monetary.effectiveRate=15;
 const issued=subscribeHouseholds(s,100,{marketClosed:false,defaultProbability:0,sovereignSpread:0});assert.ok(issued>0);near(sum(s.households.map((_,i)=>householdBonds(s,i)))-old,issued);
});
test('old histories remain unchanged at live migration; new goods, projects and entrants replay and save exactly',()=>{
 let s=createSimulation({...newGameOptions(),economicRevision:16,politicalMode:false,defenseMode:false});s=advanceMonth(s,s.policy,{preserveEconomicRevision:true});const old=JSON.stringify(s.journal);
 for(let i=0;i<36;i++)s=advanceMonth(s);assert.equal(JSON.stringify(s.journal.slice(0,1)),old);assert.equal(s.economy.revision,24);
 const loaded=importSimulation(exportSimulation(s));assert.deepEqual(loaded.productMarkets,s.productMarkets);assert.deepEqual(loaded.businessDynamics,s.businessDynamics);assert.deepEqual(advanceMonth(loaded).metrics,advanceMonth(s).metrics);
 const replay=replayJournal(s);assert.deepEqual(replay.metrics,s.metrics);assert.deepEqual(replay.enterpriseMarket,s.enterpriseMarket);assert.deepEqual(replay.productMarkets,s.productMarkets);
 const bad=JSON.parse(exportSimulation(s));bad.state.productMarkets.products[0].inventory+=1;assert.throws(()=>importSimulation(JSON.stringify(bad)),/товар/);
});
test('funded projects record delay, paid amount, impairment and commissioning separately',()=>{
 const s=start();const p=tagInvestmentProject(s,{type:'private',sector:2,amount:10,efficiency:1,due:s.month+6,legacy:false});assert.equal(p.businessProject.paidReal,10);assert.ok(p.due>=6);assert.equal(p.businessProject.status,'building');assert.ok(p.efficiency>0&&p.efficiency<=1);
});

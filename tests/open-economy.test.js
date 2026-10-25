import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSimulation,advanceMonth,runMonths,inputMatrix,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {OBSERVATIONS} from '../src/economic-observations.js';
import {sectorCapacity,investmentOpportunities,foreignFinancing,advanceWorldEconomy,exportDemand,domesticImportShare,humanCapital,validateOpenParameters,OPEN_PARAMETERS,expectedDepositUSDYield,actuarialSpread} from '../src/open-economy.js';

const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const total=a=>a.reduce((a,b)=>a+b,0);
const initial=(country='middle',extra={})=>createSimulation({...newGameOptions({country,resource:false}),politicalMode:false,...extra});
const clone=s=>structuredClone(s);
const payment=(s,a,usd)=>{a.cash+=usd*s.exchangeRate;s.bank.foreignAssetsUSD+=usd;};

test('primary observations retain their year and financial depth is not ranked by GDP',()=>{
 const data=JSON.parse(readFileSync(new URL('../docs/calibration-2000.json',import.meta.url)));
 for(const country of ['BGD','MEX','FRA'])for(const [key,series] of Object.entries(data.observations))near(OBSERVATIONS[country][key],series.observations[country].value);
 assert.equal(OBSERVATIONS.FRA.privateCreditYear,2001);
 assert.ok(OBSERVATIONS.MEX.privateCredit<OBSERVATIONS.BGD.privateCredit);
});
for(const [country,id] of [['poor','BGD'],['middle','MEX'],['rich','FRA']])for(const resource of [false,true])test(`${country}, resource=${resource}: historical moments initialize separate output, work and credit`,()=>{
 const s=initial(country,{resourceMode:resource}),o=OBSERVATIONS[id],a=inputMatrix(s);
 near(s.firms[0].workers/total(s.firms.map(f=>f.workers)),o.agricultureEmployment/(o.agricultureEmployment+o.industryEmployment+o.servicesEmployment));
 const agriculture=s.firms[0].production*(1-total(a.map(r=>r[0]))-s.firms[0].importCoefficient)/s.base.monthlyGDP;
 if(s.economy.revision>=4&&s.base.consumptionWeights[0]<.00011)assert.ok(Math.abs(agriculture-o.agricultureValueAdded/100)<.0001);else near(agriculture,o.agricultureValueAdded/100);
 near(s.base.exports/s.base.monthlyGDP,o.exportsGDP/100);
 near(s.base.imports/s.base.monthlyGDP,o.importsGDP/100);
 near(s.metrics.privateDebtRatio,o.privateCredit);near(s.metrics.lifeExpectancy,o.lifeExpectancy);
 near(s.metrics.meanWageReal,total(s.firms.map(f=>f.workers*f.wage))/total(s.firms.map(f=>f.workers)));
 near(s.education.meanYears,o.schooling);near(s.demography.fertility,o.fertility);
 assert.notEqual(s.firms[0].workers/total(s.firms.map(f=>f.workers)),o.agricultureValueAdded/100);
});
test('same numeric state has same rules regardless of the start button used',()=>{
 const a=newGameOptions({country:'poor',resource:false}),b=newGameOptions({country:'rich',resource:false});
 Object.assign(b,{initialGDPPerCapita:a.initialGDPPerCapita,parameters:clone(a.parameters),economicStructure:clone(a.economicStructure),initialMacro:clone(a.initialMacro),initialAccounts:clone(a.initialAccounts),policy:clone(a.policy)});
 const x=runMonths(createSimulation({...a,politicalMode:false}),24),y=runMonths(createSimulation({...b,politicalMode:false}),24);
 assert.deepEqual(x.metrics,y.metrics);assert.deepEqual(x.firms,y.firms);
});
test('absolute capital has diminishing returns with fixed labour; proportional inputs have constant returns',()=>{
 const s=initial(),f=s.firms[2],base=sectorCapacity(s,f);
 f.capital*=2;const capital=sectorCapacity(s,f);assert.ok(capital>base&&capital<2*base);
 f.workers*=2;near(sectorCapacity(s,f),2*base);
 const poor=initial('poor'),rich=initial('rich');assert.ok(poor.metrics.capitalPerWorker<rich.metrics.capitalPerWorker);
});
test('higher financing cost reduces desired projects rather than imposing a GDP penalty',()=>{
 const s=initial();const low=investmentOpportunities(s,s,1);s.bank.lendingRate+=.30;
 const high=investmentOpportunities(s,s,1);
 assert.ok(high.every((p,i)=>p.desired<=low[i].desired));assert.ok(high.some((p,i)=>p.desired<low[i].desired));
});
test('foreign-currency deposit returns compound correctly even during high inflation',()=>{
 const s=initial();s.bank.depositRate=.10;s.expectedInflation=.10;near(expectedDepositUSDYield(s),.02);
 s.bank.depositRate=.05;s.expectedInflation=1.2;near(expectedDepositUSDYield(s),1.05*1.02/2.2-1);
});
test('arrears retain contractual rates and default risk does not produce an unbounded yield',()=>{
 near(actuarialSpread(0,.45,.04),0);assert.ok(actuarialSpread(.9,.45,.04)>actuarialSpread(.1,.45,.04));
 assert.ok(Number.isFinite(actuarialSpread(1,.45,.04)));assert.ok(actuarialSpread(1,.45,.04)<1);
 const options=newGameOptions({country:'middle',resource:false});let s=initial('middle',{parameters:{...options.parameters,maximumPublicDebtRatio:0},policy:{automaticRestructuring:false}});
 s.households[9].cash+=s.government.cash;s.government.cash=0;s=advanceMonth(s);
 assert.ok(s.lastReport.fiscal.interestCapitalized>0);
 for(const b of s.government.domesticBonds)near(b.rate,.09);
 for(const b of s.government.externalBonds)near(b.rate,.065);
});
test('foreign subscriptions and secondary purchases post ownership and cash but create no output or equipment',()=>{
 const s=initial('poor');s.month=1;advanceWorldEconomy(s);
 for(const f of s.firms){f.cash=0;f.lastProfit=f.capital*.03;}
 const before=s.firms.map(f=>({capital:f.capital,production:f.production,foreign:f.ownership.foreign})),y=s.metrics.realGDPMonthly;
 const result=foreignFinancing(s,s,{}, {foreignPayment:payment},1);
 assert.ok(s.economy.last.greenfieldUSD>0);assert.ok(s.economy.last.portfolioEquityUSD>=0);
 assert.ok(result.inflowUSD<=s.economy.globalCapitalBudgetUSD);
 s.firms.forEach((f,i)=>{near(f.capital,before[i].capital);near(f.production,before[i].production);assert.ok(f.ownership.foreign>=before[i].foreign);near(total(Object.values(f.ownership)),1);near(total(f.domesticOwners),f.ownership.domestic);});near(s.metrics.realGDPMonthly,y);
 const closed=initial('poor');closed.month=1;advanceWorldEconomy(closed);closed.policy.capitalControls=100;
 const blocked=foreignFinancing(closed,closed,{}, {foreignPayment:payment},1);assert.ok(blocked.inflowUSD>=0);assert.ok(blocked.flightUSD<=0);
});
test('finite foreign spending, relative prices and world growth drive export orders',()=>{
 const s=initial(),world={...s.world},beforeCapital=s.firms.map(f=>f.capital),base=exportDemand(s,s,world);
 const dear=clone(s);dear.firms[2].price*=1.5;assert.ok(exportDemand(dear,s,world)[2]<base[2]);
 const larger=clone(s);larger.economy.regions.forEach(r=>r.gdp*=1.5);const orders=exportDemand(larger,s,world);assert.ok(total(orders)>total(base));
 s.month=1;advanceWorldEconomy(s);assert.deepEqual(s.firms.map(f=>f.capital),beforeCapital);
 assert.ok(s.economy.previousWorldGDP>3e7);assert.ok(s.economy.worldGrowth>0&&s.economy.worldGrowth<10);
 for(const regional of s.economy.last.exportDemandUSD.filter(Boolean))assert.ok(regional.every(v=>v>=0&&Number.isFinite(v)));
});
test('cheaper imports change sourcing of consumption and equipment without changing physical capital immediately',()=>{
 const s=initial(),c=domesticImportShare(s,.2,1,1),i=domesticImportShare(s,.4,1,1);
 near(c,.2);near(i,.4);assert.ok(domesticImportShare(s,.4,1,.8)>i);assert.ok(domesticImportShare(s,.4,1,1.5)<i);
 near(humanCapital(0),1);assert.ok(humanCapital(12)>humanCapital(8));
});
test('retained foreign earnings have matching income and investment entries, with full replay',()=>{
 let s=initial();for(let i=0;i<36;i++)s=advanceMonth(s);
 const x=s.lastReport.external,f=s.lastReport.fiscal;
 assert.ok(Number.isFinite(x.reinvestedFDIUSD));
 near(x.bopUSD,x.currentAccountUSD+x.inflowUSD+x.reinvestedFDIUSD-x.flightUSD+f.externalIssued-f.externalRedeemed);
 for(const value of Object.values(s.lastReport.audit))assert.ok(Math.abs(value)<1e-5);
 const restored=importSimulation(exportSimulation(s));assert.deepEqual(restored.metrics,s.metrics);assert.deepEqual(replayJournal(restored).metrics,s.metrics);
 assert.ok(s.firms.every(f=>f.knowledgeCapital===0)); // unestimated automatic TFP channel is disabled in revision 4
});
test('structural sensitivities are initialized consistently and recorded for replay',()=>{
 let s=initial('middle',{economicParameters:{capitalShare:.28,tradeSigma:4,adoptionEfficiency:0}});
 s=runMonths(s,24);assert.deepEqual(replayJournal(s).metrics,s.metrics);
 assert.equal(s.provenance.initialEconomicParameters.capitalShare,.28);
 assert.throws(()=>validateOpenParameters({...OPEN_PARAMETERS,tradeSigma:0}));
 assert.throws(()=>initial('middle',{economicParameters:{unexplainedBonus:1}}));
});
test('old saves retain the original model, while invalid new world stocks are rejected',()=>{
 let old=runMonths(createSimulation(),12);assert.equal(old.economy,undefined);assert.equal(importSimulation(exportSimulation(old)).economy,undefined);assert.deepEqual(replayJournal(old).metrics,old.metrics);
 const s=initial();for(const breakIt of [x=>{x.economy.regions[0].saving='high';},x=>{x.firms[0].technology=0;},x=>{x.economy.worldGDPHistory.pop();},x=>{delete x.demography.initialMortalityFactor;},x=>{delete x.economy;}]){
  const data=JSON.parse(exportSimulation(s));breakIt(data.state);assert.throws(()=>importSimulation(JSON.stringify(data)));
 }
});

test('observed opening inflation, unemployment and deposit rates are not shared fictional constants',()=>{
 for(const [country,pi,u,deposit] of [['poor',2.20825620937535,3.27,8.68666666666666],['middle',9.49156149435402,2.646,8.25666666666666],['rich',1.67061991153283,10.218,2.625]]){
  const s=initial(country);near(s.metrics.inflationYoY,pi);near(s.metrics.unemployment,u);near(s.metrics.depositRate,deposit);
  near(s.metrics.employment/s.metrics.laborForce,1-u/100);
  for(let i=0;i<12;i++)assert.ok(s.history[i].synthetic);
  assert.deepEqual(importSimulation(exportSimulation(s)).initialMacro,s.initialMacro);
 }
 const broken=initial();broken.initialMacro.unemployment=.5;assert.throws(()=>importSimulation(exportSimulation(broken)));
});

import {compactAtlasMoney} from '../src/atlas-statistics.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {countryOutlook,growthOutlook} from '../src/country-outlook.js';
import {atlasControls} from '../src/atlas-interface.js';

function state(){return {month:0,metrics:{unemployment:20,exchangeRate:1,militaryReadiness:80},history:[],defense:{enabled:true,alliance:{}},government:{reservesUSD:0,defaultActive:false},politics:{}};}
function append(s,metrics){s.history.push({...s.metrics,month:s.month});s.month++;Object.assign(s.metrics,metrics);}
const entry=(s,id,category='economy')=>countryOutlook(s,category).find(item=>item.id===id);

test('an improving but still severe unemployment level stays adverse; transitions require persistence',()=>{
 const s=state();assert.equal(entry(s,'employment').tone,'negative');
 append(s,{unemployment:19});assert.equal(entry(s,'employment').tone,'negative');
 append(s,{unemployment:4});assert.equal(entry(s,'employment').tone,'negative');
 append(s,{unemployment:4});assert.equal(entry(s,'employment').tone,'negative');
 append(s,{unemployment:4});assert.equal(entry(s,'employment').tone,'positive');
 append(s,{unemployment:20});assert.equal(entry(s,'employment').tone,'positive');
 append(s,{unemployment:20});append(s,{unemployment:20});assert.equal(entry(s,'employment').tone,'negative');
});
test('army strength and currency stability require sustained actual observations',()=>{
 const s=state();s.history=Array.from({length:12},(_,i)=>({month:i-12,synthetic:true,militaryReadiness:90,exchangeRate:1}));
 assert.equal(entry(s,'army','defense').tone,'neutral');assert.equal(entry(s,'currency').tone,'neutral');
 for(let i=0;i<5;i++)append(s,{});
 assert.equal(entry(s,'army','defense').tone,'positive');assert.equal(entry(s,'currency').tone,'neutral');
 append(s,{});assert.equal(entry(s,'currency').tone,'positive');
 append(s,{exchangeRate:1.3});assert.equal(entry(s,'currency').tone,'negative');
});
test('war, default and actual budget balance are immediate and bad conditions sort first',()=>{
 const s=state();s.defense.war={};assert.equal(entry(s,'war','defense').tone,'negative');
 s.government.defaultActive=true;assert.equal(entry(s,'default').tone,'negative');
 assert.equal(entry(s,'budget'),undefined);
 append(s,{});s.government.lastDeficit=-10;assert.equal(entry(s,'budget').label,'Профицит бюджета');
 s.government.lastDeficit=10;assert.equal(entry(s,'budget').tone,'negative');
 const order={negative:0,neutral:1,positive:2},items=countryOutlook(s,'economy');
 assert.ok(items.every((item,i)=>!i||order[items[i-1].tone]<=order[item.tone]));
});
test('missing values are omitted and the growth outlook retains its qualitative bands',()=>{
 const s=state();s.metrics.unemployment=NaN;assert.equal(entry(s,'employment'),undefined);
 for(const [value,label] of [[-4,'Спад'],[0,'Стагнация'],[4,'Рост']]){
  s.metrics.gdpGrowthYoY=value;assert.equal(growthOutlook(s).label,label);
 }
 s.metrics.gdpGrowthYoYDefined=0;assert.equal(growthOutlook(s).label,'Нет оценки');
});

test('the atlas budget and decision count stay visible while the economic summary is collapsed',()=>{
 const s=state();
 s.scenario={id:'uk-2000'};
 s.government.cash=1515.1;
 s.government.reservesUSD=125000;
 s.month=1;
 s.government.lastDeficit=1515.1;
 s.metrics.realGDPRolling=1515100;
 const collapsed=atlasControls(s,{decisions:3});
 assert.match(collapsed,/БЮДЖЕТ<\/small><strong>−1 млрд £/);
 assert.match(collapsed,/РЕШЕНИЯ<\/small><strong>3/);
 assert.match(collapsed,/aria-expanded="false"/);
 assert.match(collapsed,/aria-label="Статистика страны" hidden/);
 assert.match(collapsed,/Открыть график ВВП/);
 s.government.lastDeficit=-1515.1;
 const expanded=atlasControls(s,{statsExpanded:true});
 assert.match(expanded,/БЮДЖЕТ<\/small><strong>\+1 млрд £/);
 assert.match(expanded,/aria-expanded="true"/);
 assert.match(expanded,/<dt>ВВП<\/dt><dd>1 трлн £/);
 assert.match(expanded,/<dt>Резервы<\/dt><dd>125 млрд \$/);
 assert.equal(compactAtlasMoney(0.005,'£'),'5 тыс. £');
 assert.equal(compactAtlasMoney(999.9,'£'),'1 млрд £');
 assert.equal(compactAtlasMoney(-123456,'£'),'-123 млрд £');
});

test('diplomatic situations report actual events and sustained trade pressure',()=>{
 const s=state();
 s.politics.scenarioDiplomacy={tradeRevision:1,euTrade:{},ledger:{}};
 assert.deepEqual(countryOutlook(s,'diplomacy').map(item=>item.id),['no-alliance','peace']);
 s.defense.alliance={active:true,reliability:.7};
 assert.equal(entry(s,'alliance-strength','diplomacy').tone,'positive');
 s.defense.alliance.reliability=.45;
 assert.equal(entry(s,'alliance-strength','diplomacy').tone,'neutral');
 s.defense.alliance.reliability=.25;
 assert.equal(entry(s,'alliance-strength','diplomacy').tone,'negative');
 s.politics.scenarioDiplomacy.euTrade.exitDue=24;
 assert.equal(entry(s,'eu-transition','diplomacy').tone,'neutral');
 s.politics.scenarioDiplomacy.ledger.un={arrears:1};
 assert.equal(entry(s,'international-arrears','diplomacy').tone,'negative');
 for(let i=0;i<2;i++)append(s,{tradeBalance:-4,nominalGDPMonthly:100});
 assert.equal(entry(s,'external-trade','diplomacy'),undefined);
 append(s,{tradeBalance:-4,nominalGDPMonthly:100});
 assert.equal(entry(s,'external-trade','diplomacy').tone,'negative');
 s.politics.scenarioDiplomacy.euTrade={exitDue:3,exitMonth:3};
 assert.equal(entry(s,'eu-transition','diplomacy'),undefined);
 assert.equal(entry(s,'eu-trade-barriers','diplomacy').tone,'negative');
 s.defense.war={};
 assert.equal(entry(s,'peace','diplomacy'),undefined);
 assert.equal(entry(s,'external-war','diplomacy').tone,'negative');
});

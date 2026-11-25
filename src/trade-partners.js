import {foreignTradeCost} from './foreign-programme.js';
import {historicalWorldFactors} from './historical-world.js';
import {detailedWorldActive,externalWorldAccounts} from './world-accounts.js';

// UK 2000 opening shares. EU and China use trade in goods and services;
// Russia uses goods, and the US, Japan and Canada are rounded estimates
// informed by ONS/Pink Book and WITS merchandise data.
const observed = [
  ['eu','ЕС',7400,318,.543,.538,.22,.003,.015],
  ['us','США',10251,282,.16,.13,.20,.010,.018],
  ['cn','Китай',1224,1263,.008,.019,.35,.007,.041],
  ['ru','Россия',260,146,.004,.007,.23,-.004,.024],
  ['jp','Япония',5042,127,.022,.050,.26,.001,.009],
  ['ca','Канада',745,31,.015,.016,.23,.010,.016]
];
// GDP in billions of 2000 US dollars; EU-14 excludes the player's UK.
// Sizes and populations are rounded benchmarks. Saving, labour and productivity
// trends are scenario assumptions, not a replay of the subsequent history.
const rest = [33869-1672,6080-59];
for(const [, ,gdp,pop] of observed){rest[0]-=gdp;rest[1]-=pop;}
export const UK_MARKETS = [...observed,[
  'rest','Остальной мир',...rest,
  1-observed.reduce((sum,row)=>sum+row[4],0),1-observed.reduce((sum,row)=>sum+row[5],0),.25,.014,.022
]].map(([id,name,gdp,population,exportShare,importShare,saving,laborGrowth,technologyGrowth])=>
  ({id,name,gdp,population,exportShare,importShare,saving,laborGrowth,technologyGrowth}));

export const partnerMarketsActive = s => s.politics?.scenarioDiplomacy?.tradeRevision === 1;
export const usesPartnerMarkets = s => partnerMarketsActive(s) || detailedWorldActive(s);
export const euTradeStatus = s => s.politics?.scenarioDiplomacy?.euTrade;
export const euOutside = s => euTradeStatus(s)?.exitMonth != null;

// TCA-like scenario: qualifying goods retain tariff preferences, but customs
// and regulatory barriers add effective trade costs. Rates are model assumptions.
export function euTradeFriction(s) {
  const exitMonth=euTradeStatus(s)?.exitMonth;
  return exitMonth==null ? 0 : .15*Math.min(1,(s.month-exitMonth+1)/36);
}

export function initializePartnerMarkets(s) {
  if (!partnerMarketsActive(s) || s.economy.regions[0].id==='eu') return;
  const e=s.economy;
  const gdpScale=e.previousWorldGDP/UK_MARKETS.reduce((sum,r)=>sum+r.gdp,0);
  e.regions=UK_MARKETS.map(r=>{
    const gdp=r.gdp*gdpScale, capitalOutput=3;
    return {...r,gdp,initialGDP:gdp,capitalOutput,capital:gdp*capitalOutput,initialCapital:gdp*capitalOutput,
      initialPopulation:r.population,technology:1,imports:[0,0,0,0,0]};
  });
}

// Keep the observed total for the old residual trade group. Its four named
// economies get estimated shares proportional to their opening output.
const openingMarkets=externalWorldAccounts({}).markets;
const detailedMarketDefinitions=(()=>{
  const oldRest=UK_MARKETS.at(-1);
  const residualMarkets=[['in','Индия'],['au','Австралия'],['za','ЮАР'],['ir','Иран'],['rest','Остальные страны']];
  const oldRestGDP=residualMarkets.reduce((total,[id])=>total+openingMarkets[id].realGDP,0);
  return [...UK_MARKETS.slice(0,-1),...residualMarkets.map(([id,name])=>{
    const share=openingMarkets[id].realGDP/oldRestGDP;
    return {id,name,exportShare:oldRest.exportShare*share,importShare:oldRest.importShare*share};
  })];
})();

export function detailedTradeMarkets(accounts) {
  const movedGDP=accounts.accessionOpeningGDP;
  const residual=detailedMarketDefinitions.at(-1);
  const movedShare=movedGDP/openingMarkets.rest.realGDP;
  return detailedMarketDefinitions.map(({id,name,exportShare,importShare})=>{
    const direction=id==='eu'?1:id==='rest'?-1:0;
    return {
      id,name,exportShare:exportShare+direction*residual.exportShare*movedShare,
      importShare:importShare+direction*residual.importShare*movedShare,
      gdp:accounts.markets[id].realGDP,population:accounts.markets[id].population,
      initialGDP:openingMarkets[id].realGDP+direction*movedGDP,
    };
  });
}

export function importPartnerTerms(s) {
  if (!usesPartnerMarkets(s)) return null;
  const friction=euTradeFriction(s);
  const sigma=s.economy.parameters.tradeSigma;
  const {importCosts}=historicalWorldFactors(s);
  const terms=(detailedWorldActive(s)?s.economy.regions:UK_MARKETS).map(r=>{
    const price=(r.id==='eu'?1+friction:1)*(importCosts[r.id]??1)*foreignTradeCost(s,r.id);
    return {id:r.id,price,quantityWeight:r.importShare*price**(-sigma)};
  });
  const index=terms.reduce((sum,r)=>sum+r.quantityWeight*r.price,0)**(1/(1-sigma));
  const valueTotal=terms.reduce((sum,r)=>sum+r.quantityWeight*r.price,0);
  return {index, shares:terms.map(r=>({id:r.id,share:r.quantityWeight*r.price/valueTotal}))};
}

export function partnerTradeReport(s,previous,deliveredUSD,importsUSD) {
  if (!usesPartnerMarkets(s)) return undefined;
  const e=s.economy, imports=importPartnerTerms(s).shares;
  const prior=previous.lastReport.external?.partners;
  // Compare the same members on both sides of an enlargement.
  let transferredGDP=0;
  if(detailedWorldActive(s) && e.revision>=28 && prior && e.regions[0].initialGDP!==previous.economy.regions[0].initialGDP){
    const before=externalWorldAccounts(previous);
    const comparableBefore=previous.economy.revision>=28?before:externalWorldAccounts({
      ...previous,economy:{...previous.economy,revision:28},
    });
    const now=externalWorldAccounts(s);
    for(const [code,country] of Object.entries(comparableBefore.countries)){
      if(before.countries[code]?.market!=='eu'&&now.countries[code].market==='eu')transferredGDP+=country.realGDP;
    }
  }
  return e.regions.map((r,j)=>{
    const exportsUSD=e.last.exportDemandUSD.reduce((sum,row,i)=>{
      const total=row?.reduce((a,b)=>a+b,0)??0;
      return sum+(total?deliveredUSD[i]*row[j]/total:0);
    },0);
    const memberChange=r.id==='eu' ? transferredGDP : r.id==='rest' ? -transferredGDP : 0;
    return {id:r.id,name:r.name,gdp:r.gdp,growth:prior?.[j]?.id===r.id?(r.gdp/(prior[j].gdp+memberChange)-1)*100:null,
      exportsUSD,importsUSD:imports[j].share*importsUSD};
  });
}

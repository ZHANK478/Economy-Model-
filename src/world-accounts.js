import {EU_ACCESSIONS} from './eu-members.js';
import {historicalWorldFactors} from './historical-world.js';
import {WDI_GDP_2000, WDI_POPULATION_2000_2024} from './world-observations.js';

const sum = values => values.reduce((total,value) => total+value,0);
const EU14 = ['AUT','BEL','DNK','FIN','FRA','DEU','GRC','IRL','ITA','LUX','NLD','PRT','ESP','SWE'];
// Annual real output growth per resident, scenario assumptions.
const productivity = {
  USA:.017, CAN:.014, RUS:.026, CHN:.048, JPN:.009, IND:.047, AUS:.017,
  ZAF:.015, IRN:.022, FRA:.015, DEU:.013, ITA:.009, eu:.016, rest:.022,
};
const separateMarkets = {USA:'us',CAN:'ca',RUS:'ru',CHN:'cn',JPN:'jp',IND:'in',AUS:'au',ZAF:'za',IRN:'ir'};
const marketFor = code => separateMarkets[code] ?? 'eu';
const namedCodes = [...Object.keys(separateMarkets), ...EU14];
const restCodes = Object.keys(WDI_GDP_2000).filter(code => !['GBR','WLD'].includes(code) && !namedCodes.includes(code));
const openingRestGDP = WDI_GDP_2000.WLD-WDI_GDP_2000.GBR-sum(namedCodes.map(code => WDI_GDP_2000[code]));
const startYear = 2000;
const accessionEconomies = EU_ACCESSIONS.flatMap(({year,month,countries}) =>
  countries.map(([code,openingPopulation,latestPopulation,trend]) => ({
    code, openingPopulation, latestPopulation, trend, joinMonth:(year-startYear)*12+month-1,
  })));
const accessionBasePopulation = sum(accessionEconomies.map(row=>row.openingPopulation));
const accessionBaseGDP = sum(accessionEconomies.map(row=>WDI_GDP_2000[row.code]));
const populationObservations = WDI_POPULATION_2000_2024;
const restPopulation = populationObservations.WLD.map((world,i) =>
  world-populationObservations.GBR[i]-sum(namedCodes.map(code => populationObservations[code][i])));

export const detailedWorldActive = s => s.scenario?.id==='uk-2000' && s.economy?.revision>=25;

function populationAt(series, years) {
  const last = series.length-1;
  if(years>=last){
    const annual = (series[last]/series[last-5])**(1/5)-1;
    return series[last]*(1+annual)**(years-last)/1e6;
  }
  const i = Math.max(0,Math.floor(years));
  return (series[i]+(series[i+1]-series[i])*(years-i))/1e6;
}

export function externalWorldAccounts(s, month=s.month??0, cycle=s.economy?.worldCycle??1) {
  const historical=historicalWorldFactors(s,month);
  const months = ((s.startYear??s.scenario?.referenceYear??startYear)-startYear)*12+month;
  const years = (s.startYear??s.scenario?.referenceYear??startYear)-startYear+month/12;
  const population = code => populationAt(populationObservations[code],years);
  const realGDP = (openingGDP,people,initialPeople,trend) =>
    openingGDP*(people/initialPeople)*(1+trend)**years*cycle;
  const countries = Object.fromEntries(namedCodes.map(code => {
    const market = marketFor(code);
    const people = population(code);
    return [code,{market,population:people,realGDP:realGDP(WDI_GDP_2000[code],people,populationObservations[code][0]/1e6,productivity[code]??productivity.eu)*(historical.markets[market]??1)}];
  }));
  const restPeople = populationAt(restPopulation,years);
  const expanded = detailedWorldActive(s) && s.economy.revision>=28;
  const restFactor = historical.markets.rest??1;
  let residualPeople = restPeople;
  let accessionOpeningGDP = 0;
  if(expanded){
    for(const {code,openingPopulation,latestPopulation,trend,joinMonth} of accessionEconomies){
      const people = openingPopulation*(latestPopulation/openingPopulation)**(Math.max(0,years)/24);
      const joined = months>=joinMonth;
      const market = joined?'eu':'rest';
      // Smoothly take on regional shocks as a new member integrates into the market.
      const integration = Math.max(0,Math.min(1,(months-joinMonth)/12));
      const shock = restFactor+((historical.markets.eu??1)-restFactor)*integration;
      const openingGDP = WDI_GDP_2000[code];
      countries[code] = {market,population:people,realGDP:realGDP(openingGDP,people,openingPopulation,trend)*shock};
      residualPeople-=people;
      if(joined)accessionOpeningGDP+=openingGDP;
    }
  }
  const residualOpeningPeople = restPopulation[0]/1e6-(expanded?accessionBasePopulation:0);
  const residualOpeningGDP = openingRestGDP-(expanded?accessionBaseGDP:0);
  const restScale = realGDP(1,residualPeople,residualOpeningPeople,productivity.rest)*restFactor;
  const markets = Object.fromEntries([...Object.values(separateMarkets),'eu','rest']
    .map(id => [id,{population:0,realGDP:0}]));
  markets.rest = {population:residualPeople,realGDP:residualOpeningGDP*restScale};
  for(const country of Object.values(countries)){
    const market = markets[country.market];
    market.population+=country.population;
    market.realGDP+=country.realGDP;
  }
  return {countries,markets,restScale,accessionOpeningGDP,
    realGDP:sum(Object.values(markets).map(market=>market.realGDP)),
    population:sum(Object.values(markets).map(market=>market.population))};
}

export function countryWorldFigure(s, code) {
  const foreign = externalWorldAccounts(s);
  const country = foreign.countries[code];
  if(!country)return null;
  const price = (s.worldPriceIndex??100)/100;
  const gdp = country.realGDP*price;
  const otherRankedCountries = Object.values(foreign.countries).filter(row=>row.realGDP>country.realGDP).length
    + restCodes.filter(other=>!foreign.countries[other]&&WDI_GDP_2000[other]*foreign.restScale>country.realGDP).length;
  const homeGDP = s.metrics.gdpUSDAnnualized;
  return {gdp,population:country.population,rank:1+otherRankedCountries+Number(homeGDP>gdp)};
}

export function europeanUnionFigure(s) {
  const foreign = externalWorldAccounts(s);
  const ukMember = s.scenario?.id==='uk-2000' && s.politics?.scenarioDiplomacy?.euTrade?.exitMonth==null;
  const members = Object.keys(foreign.countries).filter(code=>foreign.countries[code].market==='eu');
  if(ukMember)members.push('GBR');
  return {
    members,ukMember,
    gdp:foreign.markets.eu.realGDP*(s.worldPriceIndex??100)/100+(ukMember?s.metrics.gdpUSDAnnualized:0),
    population:foreign.markets.eu.population+(ukMember?s.population:0),
  };
}

export function worldTotals(s) {
  const markets = s.economy.regions;
  const externalRealGDP = sum(markets.map(market=>market.gdp));
  const externalNominalGDP = externalRealGDP*s.worldPriceIndex/100;
  return {
    realGDP:externalRealGDP+s.metrics.realGDPAnnualized,
    nominalGDP:externalNominalGDP+s.metrics.gdpUSDAnnualized,
    population:sum(markets.map(market=>market.population))+s.population,
  };
}

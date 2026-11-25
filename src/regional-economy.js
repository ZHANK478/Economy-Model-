import {companyTerritorialTotals} from './company-geography.js';
import {SECTORS} from './config.js';
import {EDINBURGH_2000, UK_REGIONS_2000} from './uk-regional-calibration.js';
import {UK_REGIONAL_PROFILES} from './uk-regional-profiles.js';
import {projectRegionalIndicators, regionalAgeCounts} from './regional-indicators.js';

import {UK_CITY_INDUSTRIES_2000} from './uk-city-industries.js';
import {advanceRegionalProduction,regionalProductionActive,validateRegionalProduction} from './regional-production.js';

const sum = values => values.reduce((total, value) => total + value, 0);

// Synthetic relative weights. Each column is normalized independently, just as
// the observed UK series is. These regions have no cartographic representation.
const abstractRegions = [
  [16, .52, [3, 4, 11, 15, 31]],
  [13, .43, [6, 5, 23, 14, 12]],
  [12, .37, [9, 7, 16, 12, 10]],
  [11, .35, [12, 7, 12, 12, 10]],
  [10, .31, [9, 10, 10, 11, 9]],
  [9, .30, [18, 5, 8, 9, 7]],
  [8, .28, [11, 25, 7, 9, 6]],
  [8, .26, [8, 23, 6, 8, 6]],
  [7, .24, [14, 8, 4, 6, 5]],
  [6, .22, [10, 6, 3, 4, 4]],
].map(([population, cityShare, sectorWeights], index) => ({
  id:`region-${index+1}`, name:`Регион ${index+1}`, population,
  workforceJobs:sectorWeights, sectorGvaMillionGBP:sectorWeights, disposableIncomeMillionGBP:population,
  city:{id:`city-${index+1}`, name:`Город ${index+1}`},
  cityPopulationShare:cityShare, cityEconomicShare:cityShare, cityIncomeShare:cityShare,
  profile:{
    age:[.23+(index%4)*.025,.65-(index%4)*.035,.12+(index%4)*.01],
    preschoolShare:.27, laborForce:.44+cityShare*.12, unemployed:.03+(index%5)*.012,
    urbanShare:.31+cityShare, landKm2:[2300,6500,7700,9000,11300,13600,15000,10500,21000,27000][index],
    farmLandShare:[.1,.30,.42,.56,.61,.76,.57,.43,.66,.79][index],
  },
}));

function normalize(weights) {
  const total = sum(weights);
  return weights.map(value => value / total);
}

function prepareRegions(id, regions) {
  const population = normalize(regions.map(region => region.population));
  const householdIncome = normalize(regions.map(region => region.disposableIncomeMillionGBP));
  const jobs = SECTORS.map((_, i) => normalize(regions.map(region => region.workforceJobs[i])));
  const gva = SECTORS.map((_, i) => normalize(regions.map(region => region.sectorGvaMillionGBP[i])));
  return {
    id,
    regions:regions.map((region, index) => {
      const sameTerritory = region.id === region.city.id;
      const cityPopulation = region.cityPopulationShare ?? region.city.population / region.population;
      const cityEconomic = region.cityEconomicShare ?? region.city.gvaMillionGBP / region.gvaMillionGBP;
      return {
        id:region.id, name:region.name, city:region.city, sameTerritory, profile:region.profile,
        population:population[index], income:householdIncome[index],
        jobs:jobs.map(column => column[index]), gva:gva.map(column => column[index]),
        cityPopulation, cityEconomic, cityIncome:region.cityIncomeShare ?? cityPopulation,
      };
    }),
  };
}

const abstract = prepareRegions('abstract-regions-v2', abstractRegions);
const uk = prepareRegions('uk-ons-2000-v2', UK_REGIONS_2000.map(region => ({
  ...region, profile:UK_REGIONAL_PROFILES[region.id],
})));

export function updateRegionalProduction(state,previous){
  advanceRegionalProduction(state,previous,uk.regions);
}

export function validateRegionalEconomy(state){
  validateRegionalProduction(state,uk.regions.length);
}

function cityIndustryWeights(city,region){
  const [combined,utilities,...rest]=UK_CITY_INDUSTRIES_2000[city.id];
  const [agriculture,resources]=region.sectorGvaMillionGBP;
  const farm=combined*agriculture/(agriculture+resources);
  return [farm,combined-farm+utilities,...rest].map((value,j)=>value/region.sectorGvaMillionGBP[j]);
}

const ukCities=UK_REGIONS_2000.map(region=>{
  if(region.id===region.city.id)return [];
  return [region.city,...(region.id===EDINBURGH_2000.regionId?[EDINBURGH_2000]:[])].map(city=>({
    ...city,industry:cityIndustryWeights(city,region),populationShare:city.population/region.population,
  }));
});

const sectorKeys=['workers','output','nominalValueAdded','realValueAdded','capitalStock','capacity','exports'];

function splitBritishRegion(region,index,siteAccounts){
  const cities=ukCities[index];
  if(!cities.length){
    const city=cityAccount(region,uk.regions[index]);
    return {city,cities:[city],remainder:null};
  }
  const sectors=region.sectors.map((sector,j)=>cities.map(city=>city.industry[j]));
  const areas=[...cities,{id:region.id+'-rest',name:'Остальная территория',
    populationShare:1-sum(cities.map(city=>city.populationShare))}];
  const accounts=areas.map(({id,name,populationShare},i)=>{
    const local=region.sectors.map((sector,j)=>{
      const share=sectors[j][i]??1-sum(sectors[j]);
      const regionSites=siteAccounts[j].get(region.id);
      const localSites=siteAccounts[j].get(id);
      return {id:sector.id,...Object.fromEntries(sectorKeys.map(key=>[key,sector[key]===null?null:
        (localSites?.[key]??0)+(sector[key]-(regionSites?.[key]??0))*share]))};
    });
    const employmentAdjustment=region.employmentAdjustment*populationShare;
    const gdp=key=>{
      const valueAdded=key==='nominalGDPMonthly'?'nominalValueAdded':'realValueAdded';
      return sum(local.map(sector=>sector[valueAdded]))+
        (region[key]-sum(region.sectors.map(sector=>sector[valueAdded])))*populationShare;
    };
    return {id,name,sameTerritory:false,population:region.population*populationShare,
      employment:sum(local.map(s=>s.workers))+employmentAdjustment,employmentAdjustment,
      nominalGDPMonthly:gdp('nominalGDPMonthly'),realGDPMonthly:gdp('realGDPMonthly'),
      householdIncomeMonthly:region.householdIncomeMonthly*populationShare,sectors:local};
  });
  return {city:accounts[0],cities:accounts.slice(0,-1),remainder:accounts.at(-1)};
}

function cityAccount(region, weights) {
  const sectors = region.sectors.map(sector => ({
    id:sector.id, workers:sector.workers*weights.cityEconomic,
    output:sector.output*weights.cityEconomic,
    nominalValueAdded:sector.nominalValueAdded*weights.cityEconomic,
    realValueAdded:sector.realValueAdded*weights.cityEconomic,
    capitalStock:sector.capitalStock*weights.cityEconomic,
    capacity:sector.capacity*weights.cityEconomic,
    exports:sector.exports===null ? null : sector.exports*weights.cityEconomic,
  }));
  const employmentAdjustment = region.employmentAdjustment*weights.cityPopulation;
  return {
    id:weights.city.id, name:weights.city.name, sameTerritory:weights.sameTerritory,
    population:region.population*weights.cityPopulation,
    employment:sum(sectors.map(sector => sector.workers))+employmentAdjustment,
    employmentAdjustment,
    nominalGDPMonthly:region.nominalGDPMonthly*weights.cityEconomic,
    realGDPMonthly:region.realGDPMonthly*weights.cityEconomic,
    householdIncomeMonthly:region.householdIncomeMonthly*weights.cityIncome,
    sectors,
  };
}

/** Project finalized national accounts onto regions. Values use the engine's units. */
export function projectRegionalEconomy(state, matrix) {
  const calibration = state.scenario?.id === 'uk-2000' ? uk : abstract;
  const {firms, metrics} = state;
  const nominalValueAdded = state.lastReport.gdp?.sectorValueAdded ?? firms.map((firm, i) =>
    firm.production * (firm.price - sum(matrix.map((row, j) => row[i]*firms[j].price)) - firm.importCoefficient)
  );
  const realValueAdded = firms.map((firm, i) =>
    firm.production * (1 - sum(matrix.map(row => row[i])) - firm.importCoefficient)
  );
  // GDP includes taxes and other national adjustments beyond firm value added.
  const nominalGDPAdjustment = metrics.nominalGDPMonthly - sum(nominalValueAdded);
  const realGDPAdjustment = metrics.realGDPMonthly - sum(realValueAdded);
  // Military employment and own-use production adjustments need not be in firm jobs.
  const employmentAdjustment = metrics.employment - sum(firms.map(firm => firm.workers));
  const income = sum(state.incomeHistory.at(-1).net);
  const ages = regionalAgeCounts(state.ageCohorts,calibration.regions);
  const production=regionalProductionActive(state)?state.regionalProduction:null;
  const national=SECTORS.map(({id},i)=>{
    const firm=firms[i];
    return {id,workers:firm.workers,output:firm.production,nominalValueAdded:nominalValueAdded[i],
      realValueAdded:realValueAdded[i],capitalStock:firm.capital,
      capacity:state.lastReport.market?.capacity?.[i]??firm.capacity,exports:state.lastReport.market?.exports?.[i]??null};
  });
  const attributed=SECTORS.map((_,i)=>{
    const {places,total,activeCapital}=companyTerritorialTotals(state,i);
    if(!places.size)return {places,total:{}};
    const sector=national[i];
    const toSector=site=>{
      const outputShare=sector.output>0?site.output/sector.output:0;
      return {...site,nominalValueAdded:(state.lastReport.gdp?.companySectorValueAdded?.[i]??sector.nominalValueAdded)*outputShare,
        realValueAdded:sector.realValueAdded*outputShare,exports:sector.exports*outputShare,
        capacity:activeCapital>0?sector.capacity*site.activeCapital/activeCapital:0};
    };
    return {places:new Map([...places].map(([key,site])=>[key,toSector(site)])),total:toSector(total)};
  });
  const regions = calibration.regions.map((weights,index) => {
    const sectors = national.map((sector,i) => {
      const {places,total}=attributed[i];
      const local=places.get(weights.id);
      return {id:sector.id,...Object.fromEntries(sectorKeys.map(key=>{
        const share=key==='workers'?(production?.[i].jobs[index]??weights.jobs[i]):
          key==='capitalStock'?(production?.[i].capital[index]??weights.gva[i]):
          (production?.[i].capacity[index]??weights.gva[i]);
        const value=sector[key]===null?null:(local?.[key]??0)+(sector[key]-(total[key]??0))*share;
        return [key,value];
      }))};
    });
    const adjustment = employmentAdjustment*weights.population;
    const region = {
      id:weights.id, name:weights.name, population:sum(ages[index]),
      employment:sum(sectors.map(sector => sector.workers))+adjustment, employmentAdjustment:adjustment,
      nominalGDPMonthly:sum(sectors.map(sector => sector.nominalValueAdded))+nominalGDPAdjustment*weights.population,
      realGDPMonthly:sum(sectors.map(sector => sector.realValueAdded))+realGDPAdjustment*weights.population,
      householdIncomeMonthly:income*weights.income,
      sectors,
    };
    return region;
  });
  const siteAccounts=attributed.map(item=>item.places);
  const profiles = projectRegionalIndicators(state,calibration.regions,regions,ages);
  return {month:state.month, calibration:production?'uk-ons-2000-v3':calibration.id,
    regions:profiles.map((region,i) => ({
      ...region,...(production?splitBritishRegion(region,i,siteAccounts):{city:cityAccount(region,calibration.regions[i])}),
    }))};
}

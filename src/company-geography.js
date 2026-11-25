import {sectorCompanies} from './enterprise-market.js';
import {hash} from './political-config.js';
import {EDINBURGH_2000,UK_REGIONS_2000} from './uk-regional-calibration.js';
import {UK_CITY_INDUSTRIES_2000} from './uk-city-industries.js';
import {companyEconomyActive,primaryProducts} from './company-specialization.js';

const sum = values => values.reduce((total,value)=>total+value,0);
const cities=UK_REGIONS_2000.flatMap(region=>
  [region.city,...(region.id===EDINBURGH_2000.regionId?[EDINBURGH_2000]:[])].map(city=>({
    cityId:city.id,regionId:region.id,
    weights:UK_CITY_INDUSTRIES_2000[city.id]??region.sectorGvaMillionGBP,
  })));
const byCity=new Map(cities.map(city=>[city.cityId,city]));
const byRegion=new Map(UK_REGIONS_2000.map(region=>[region.id,region]));

function drawSite(places,weights,seed,id,purpose) {
  let pick=hash(seed,id,purpose)*sum(weights);
  const {cityId,regionId}=places.find((_,index)=>(pick-=weights[index])<0)??places.at(-1);
  return {cityId,regionId};
}

function openingSites(state,company,sector) {
  const primary=primaryProducts(company,sector);
  const concentration=city=>primary.includes('financial')||primary.includes('property')
    ?Math.sqrt(byRegion.get(city.regionId).financeGvaMillionGBP/byRegion.get(city.regionId).sectorGvaMillionGBP[4]):1;
  const weight=city=>city.weights[sector]*concentration(city);
  const main=drawSite(cities,cities.map(weight),state.seed,company.id,'primary-site');
  if(company.id.startsWith('press-')||company.foundedMonth>=0)return [{...main,share:1}];

  // Opening representative firms cover many unobserved businesses. Attribute
  // only a calibrated slice to named locations and distribute the remainder.
  const alternatives=cities.filter(city=>city.regionId!==main.regionId);
  const secondary=drawSite(alternatives,alternatives.map(weight),state.seed,company.id,'secondary-site');
  const sectorTotal=sum(UK_REGIONS_2000.map(region=>region.sectorGvaMillionGBP[sector]));
  const fraction=site=>Math.min(.12,byCity.get(site.cityId).weights[sector]/sectorTotal*.65);
  return [{...main,share:fraction(main)},{...secondary,share:fraction(secondary)}];
}

function validSites(sites) {
  return Array.isArray(sites)&&sites.length>0&&sites.every(site=>
    byCity.get(site?.cityId)?.regionId===site?.regionId&&byCity.has(site?.cityId)&&
    Number.isFinite(site.share)&&site.share>0)&&sum(sites.map(site=>site.share))<=1+1e-12;
}

export function initializeCompanyLocations(state,{operating=false}={}) {
  if(!companyEconomyActive(state))return;
  for(const [sector] of state.firms.entries()){
    if(sector<2)continue;
    for(const company of sectorCompanies(state,sector)){
      // Household groups represent dispersed self-employment.
      if(company.familyGroup!==undefined)continue;
      company.products=primaryProducts(company,sector);
      company.location??=drawSite(cities,cities.map(city=>city.weights[4]),state.seed,company.id,'company-location');
      company.sites??=openingSites(state,company,sector);
      if(!validSites(company.sites)||company.operatingSites!==undefined&&!validSites(company.operatingSites))
        throw new Error('Повреждены производственные площадки компании.');
      if(operating)company.operatingSites=company.sites;
    }
  }
}

// An asset sale transfers the installed capital at its existing sites.
// Portable and unlocated assets stay in the unallocated portion.
export function transferCompanySites(seller,buyer,capital=seller.capital) {
  if(!seller.sites&&!buyer.sites)return;
  const total=capital+buyer.capital;
  if(!(total>0))return;
  const combined=new Map();
  for(const company of [seller,buyer]){
    for(const site of company.sites??[]){
      const share=site.share*(company===seller?capital:buyer.capital)/total;
      if(share>0)combined.set(site.cityId,{...site,share:share+(combined.get(site.cityId)?.share??0)});
    }
  }
  if(combined.size)buyer.sites=[...combined.values()];
}

export function companyTerritorialTotals(state,sector) {
  const places=new Map(),total={workers:0,output:0,capitalStock:0,activeCapital:0};
  if(!companyEconomyActive(state)||state.month===0)return {places,total,activeCapital:0};
  const companies=sectorCompanies(state,sector);
  const activeCapital=sum(companies.map(company=>company.active?company.capital:0));
  for(const company of companies){
    const record=(site,values)=>{
      for(const key of new Set([site.cityId,site.regionId])){
        const existing=places.get(key)??{workers:0,output:0,capitalStock:0,activeCapital:0};
        for(const [field,value] of Object.entries(values))existing[field]+=site.share*value;
        places.set(key,existing);
      }
      for(const [field,value] of Object.entries(values))total[field]+=site.share*value;
    };
    for(const site of company.operatingSites??company.sites??[])
      record(site,{workers:company.workers,output:company.production});
    for(const site of company.sites??[])
      record(site,{capitalStock:company.capital,activeCapital:company.active?company.capital:0});
  }
  return {places,total,activeCapital};
}

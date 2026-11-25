import {territorialGeography} from './territorial-government.js';
// Territorial accounts use the same units and settled national totals as the engine.
const sum = values => values.reduce((a,b) => a+b,0);
const ratio = (value, base) => base > 0 ? value/base : null;
const shares = values => {
  const total = sum(values);
  return values.map(value => total > 0 ? value/total : 1/values.length);
};
const spread = (total, weights) => Number.isFinite(total)
  ? shares(weights).map(share => total*share) : weights.map(() => null);

// Allocate people or covered demand without exceeding the resident/need pool.
function bounded(total, weights, caps) {
  const allocated = weights.map(() => 0);
  let remaining = Math.max(0, Math.min(total, sum(caps)));
  while (remaining > 1e-10) {
    const open = caps.map((cap,i) => cap-allocated[i] > 1e-12 ? i : -1).filter(i => i >= 0);
    if (!open.length) break;
    const weightsOpen = shares(open.map(i => weights[i]));
    let used = 0;
    open.forEach((i,j) => {
      const amount = Math.min(caps[i]-allocated[i], remaining*weightsOpen[j]);
      allocated[i] += amount;
      used += amount;
    });
    if (used < 1e-12) break;
    remaining -= used;
  }
  return allocated;
}

export function regionalAgeCounts(cohorts, reference) {
  const byAge = cohorts.map((total,j) => spread(total,reference.map(r => r.profile.age[j]*r.population)));
  return reference.map((_,i) => byAge.map(values => values[i]));
}

function previousCohorts(state) {
  const previous = state.history.at(-2);
  if (state.month === 0 || previous?.month !== state.month-1) return null;
  const workingAge = previous.population/(1+previous.dependencyRatio/100);
  const elderly = previous.population*previous.elderlyShare/100;
  return [previous.population-workingAge-elderly,workingAge,elderly];
}

function serviceAccounts(needs, publicWeights, privateWeights, service) {
  const totalNeed = sum(needs);
  const supply = spread(service.capacity*totalNeed,publicWeights);
  const privatePaid = spread(service.privateSpending,privateWeights);
  const privateCoverage = Math.max(0,service.coverage-service.delivered);
  const privateSupply = spread(privateCoverage*totalNeed,privateWeights);
  const available = supply.map((value,i) => value+privateSupply[i]);
  const localLimit = needs.map((need,i) => Math.min(need,available[i]));
  const target = service.coverage*totalNeed;
  const localCovered = bounded(target,localLimit,localLimit);
  const unmetLocally = needs.map((need,i) => need-localCovered[i]);
  // National coverage is a resident total. If regions cannot meet it locally,
  // attribute the remaining use to capacity elsewhere and balance both sides.
  const coveredElsewhere = bounded(target-sum(localCovered),unmetLocally,unmetLocally);
  const unused = available.map((value,i) => value-localCovered[i]);
  const providedToOtherRegions = bounded(sum(coveredElsewhere),unused,unused);
  return needs.map((need,i) => {
    const covered = localCovered[i]+coveredElsewhere[i];
    return {
      need, publicCapacity:supply[i], estimatedPrivateCapacity:privateSupply[i], capacityPerNeed:ratio(supply[i],need),
      coverage:ratio(covered,need), localCoverage:ratio(localCovered[i],need), coveredNeed:covered,
      unmetNeed:Math.max(0,need-covered), coveredElsewhere:coveredElsewhere[i],
      providedToOtherRegions:providedToOtherRegions[i], privateSpending:privatePaid[i],
    };
  });
}

export function projectRegionalIndicators(state, reference, regions, ages) {
  const {metrics, demography, services, firms} = state;
  const {fiscal, gdp, income} = state.lastReport;
  const population = regions.map(r => r.population);
  const adults = ages.map(([,working,elderly]) => working+elderly);
  const workers = regions.map(r => Math.max(0,r.employment));
  const openingMix = state.provenance.economicStructure?.workerShares ??
    (state.resourceMode ? [.20,.07,.20,.13,.40] : [.20,.035,.25,.13,.385]);
  const openingJobs = state.history[12]?.employment ?? metrics.employment;
  const openingJobShares = reference.map(r => sum(openingMix.map((share,j) => share*r.jobs[j])));
  const localWorkTrend = openingJobShares.map((share,i) => {
    const opening = openingJobs*share;
    return opening > 0 ? workers[i]/opening : 1;
  });
  const laborForce = bounded(metrics.laborForce,reference.map((r,i) =>
    r.profile.laborForce*ages[i][1]/Math.max(1e-12,r.profile.age[1])
  ),adults);
  const unemployed = bounded(Math.max(0,metrics.laborForce-metrics.employment),
    reference.map((r,i) => r.profile.unemployed*r.population/Math.max(.15,localWorkTrend[i])),laborForce);
  const births = spread(demography.births,ages.map(([children,working]) => children+.15*working));
  const deaths = spread(demography.deaths,ages.map(([children,working,elderly]) => .03*children+.10*working+elderly));
  const old = previousCohorts(state);
  const oldAges = old ? regionalAgeCounts(old,reference) : null;
  const externalMigration = spread(demography.netMigration,population);

  const urbanWeights = reference.map((r,i) => r.profile.urbanShare*population[i]);
  const urbanTotal = state.settlements
    ? state.population*sum(state.settlements.groups.map((r,i) => r.urbanShare*state.households[i].population))
    : sum(urbanWeights);
  const urban = bounded(urbanTotal,urbanWeights,population);
  const payrollWeights = regions.map(r => sum(r.sectors.map((sector,j) => sector.workers*firms[j].wage)));
  const payrollShares = shares(payrollWeights);
  const incomeWeights = reference.map((r,i) => r.income*(state.month === 0
    ? 1 : .50+.50*payrollShares[i]/Math.max(1e-12,openingJobShares[i])));
  const incomeByRegion = spread(sum(regions.map(r => r.householdIncomeMonthly)),incomeWeights);
  const privateWeights = incomeWeights.map((weight,i) => weight*(.5+urban[i]/Math.max(population[i],1e-12)));
  const spending = (key,fallback) => reference.map((r,i) => r.profile.spending?.[key] === undefined ? fallback[i] : r.profile.spending[key]*r.population);
  const healthNeed = ages.map(([children,working,elderly]) => children*1.15+working+elderly*2.2);
  const minors = ages.map(([children]) => children);
  const preschoolTotal = sum(demography.female.slice(0,60))+sum(demography.male.slice(0,60));
  const preschool = bounded(preschoolTotal,reference.map((r,i) => r.profile.preschoolShare*minors[i]),minors);
  const schoolNeed = minors.map((children,i) => children-preschool[i]);
  const territorialDistribution=(key,total,weights)=>{
    const rows=fiscal?.territorial?.rows??[];
    const programmes=fiscal?.territorialPrograms??[];
    if((!rows.length&&!programmes.length)||!Number.isFinite(total))return spread(total,weights);
    const paid=regions.map(region=>sum(rows.filter(row=>row.regionId===region.id).map(row=>row.byKey[key]??0))+
      sum(programmes.filter(row=>row.regionId===region.id&&row.programme===key).map(row=>row.paid)));
    const central=spread(Math.max(0,total-sum(paid)),weights);
    return paid.map((value,i)=>value+central[i]);
  };
  const healthWeights = spending('health',healthNeed), schoolWeights = spending('education',schoolNeed);
  const serviceWeights=(key,weights)=>{
    const distribution=territorialDistribution(key,fiscal[key],weights);
    return sum(distribution)>0?distribution:weights;
  };
  const health = serviceAccounts(healthNeed,serviceWeights('healthcare',healthWeights),privateWeights,{
    capacity:services.publicHealthCapacity, delivered:services.publicHealthDelivered,
    coverage:services.healthCoverage, privateSpending:services.privateHealth,
  });
  const education = serviceAccounts(schoolNeed,serviceWeights('education',schoolWeights),privateWeights,{
    capacity:services.publicEducationCapacity, delivered:services.publicEducationDelivered,
    coverage:services.educationCoverage, privateSpending:services.privateEducation,
  });
  const childcare = bounded(services.childcareAccess*preschoolTotal,preschool,preschool);

  const consumption = spread(gdp?.consumption,incomeWeights);
  const consumptionVolume = spread(metrics.consumption,incomeWeights);
  // Regions face the same national market prices but have different housing
  // exposure. Center the basket proxy so it cannot change the national CPI.
  const rentIndex = Math.max(1e-9,state.social?.housing.rentIndex??1);
  const housingBasket = state.base.consumptionWeights[4]*(state.householdEconomy?.assumptions.housingServiceShare??.35);
  const basketFactor = population.map((people,i) =>
    Math.pow(rentIndex,housingBasket*.8*urban[i]/Math.max(1e-12,people)));
  const consumerShares = shares(incomeWeights);
  const basketAverage = sum(consumerShares.map((share,i) => share*basketFactor[i]));
  const costOfLiving = basketFactor.map(factor => state.consumerPriceIndex*factor/basketAverage);
  const investmentWeights = regions.map(r => Math.max(0,r.realGDPMonthly));
  const productionShares = shares(investmentWeights);
  const importUse = spread(gdp?.imports,consumerShares.map((share,i) => .5*share+.5*productionShares[i]));
  const investment = spread(gdp?.investment,investmentWeights);
  const investmentVolume = spread(metrics.investment,investmentWeights);
  const investmentWeightsPublic=spending('transport',population);
  const publicInvestment=spread(metrics.publicInvestment,serviceWeights('publicInvestment',investmentWeightsPublic));
  const payroll = spread(income?.wages??sum(firms.map(f => f.workers*f.wage)),payrollWeights);
  const povertyWeights = population.map((people,i) =>
    people/Math.max(1e-9,incomeByRegion[i]/Math.max(1e-12,people)));

  const absolutePoverty = bounded(state.population*(metrics.absolutePoverty??0)/100,povertyWeights,population);
  const relativePoverty = bounded(state.population*(metrics.relativePoverty??0)/100,povertyWeights,population);
  const pensions = spread(state.social?.pension.retirees,ages.map(age => age[2]));
  const householdRate = sum(state.households.map(h => h.population/h.householdSize));
  const housingNeed = population.map(people => people*householdRate);
  const municipalRegions=state.territorialGovernment?.localProperty?
    Object.fromEntries(territorialGeography(state).map(area=>[area.id,area.region])):{};
  const targetedAssets=Object.values(state.territorialGovernment?.programmeAssets??{});
  const targeting=(total,get)=>{
    const quantities=regions.map(region=>sum(targetedAssets.filter(asset=>asset.regionId===region.id).map(get)));
    const stock=sum(quantities);
    return stock>total&&stock>0?quantities.map(own=>own*total/stock):quantities;
  };
  let urbanHomes=spread(state.settlements?.housing.urban,urban);
  let ruralHomes=spread(state.settlements?.housing.rural,population.map((n,i)=>n-urban[i]));
  const socialHousing=state.social?.housing;
  let homes=state.settlements
    ? population.map((_,i)=>urbanHomes[i]+ruralHomes[i])
    : spread(socialHousing?socialHousing.publicStock+socialHousing.privateStock:null,housingNeed);
  const targetHomes=socialHousing?targeting(socialHousing.publicStock,asset=>asset.housing):regions.map(()=>0);
  const builtHomes=sum(targetHomes);
  if(builtHomes>0){
    const rest=spread(Math.max(0,sum(homes)-builtHomes),homes);
    homes=rest.map((value,i)=>value+targetHomes[i]);
    if(state.settlements){
      urbanHomes=bounded(sum(urbanHomes),urbanHomes,homes);
      ruralHomes=homes.map((value,i)=>value-urbanHomes[i]);
    }
  }
  const publicHomes=socialHousing
    ? bounded(Math.max(0,socialHousing.publicStock-builtHomes),spending('housing',housingNeed),
      homes.map((home,i)=>Math.max(0,home-targetHomes[i]))).map((value,i)=>value+targetHomes[i])
    : homes.map(()=>null);
  const privateHomes=homes.map((value,i)=>value===null?null:value-publicHomes[i]);

  const roadWeights = reference.map((r,i) => r.profile.roadsKm??Math.sqrt(r.profile.landKm2*population[i]));
  const transportWeights = spending('transport',population);
  const gridWeights = regions.map((r,i) => population[i]+workers[i]);
  const networkWeights = {roads:roadWeights,rail:transportWeights,grid:gridWeights};
  const networks = (state.networks??[]).map(network => {
    const weights = networkWeights[network.id]??population;
    const stock=Object.fromEntries(['public','municipal','private','concession','investment'].map(key=>[key,spread(network[key],weights)]));
    if(network.localOwners){
      const allocated={};
      for(const [id,fraction] of Object.entries(network.localOwners)){
        const region=municipalRegions[id];
        if(region)allocated[region]=(allocated[region]??0)+network.municipal*fraction;
      }
      const rest=Math.max(0,network.municipal-sum(Object.values(allocated)));
      stock.municipal=spread(rest,weights).map((value,i)=>value+(allocated[regions[i].id]??0));
    }
    const built=targeting(network.public,asset=>asset.networks[network.id]??0);
    if(sum(built)>0)stock.public=spread(Math.max(0,network.public-sum(built)),weights).map((value,i)=>value+built[i]);
    return regions.map((_,i) => ({
      id:network.id, public:stock.public[i], municipal:stock.municipal[i],
      private:stock.private[i], concession:stock.concession[i], investment:stock.investment[i],
      maintenanceCoverage:network.maintenanceCoverage,
    }));
  });
  // The UK total is a FAOSTAT 2000 observation. Its regional distribution is an estimate.
  const totalLand = sum(reference.map(r => r.profile.landKm2));
  const farmland = state.scenario?.id === 'uk-2000'
    ? bounded(169640,reference.map(r => .68*r.profile.landKm2/totalLand+.32*r.jobs[0]),
      reference.map(r => r.profile.landKm2*(r.id==='TLI' ? .22 : .92)))
    : reference.map(r => r.profile.landKm2*r.profile.farmLandShare);
  const farmProtection=state.agriculture?.publicStock;
  const targetedFarms=targeting(farmProtection??0,asset=>asset.agriculture??0);
  const farmPublic = spread(farmProtection===undefined?undefined:Math.max(0,farmProtection-sum(targetedFarms)),farmland)
    .map((value,i)=>value===null?null:value+targetedFarms[i]);
  const farmPrivate = spread(state.agriculture?.privateStock,farmland);
  const spendColumns = {
    incomeTax:incomeWeights, vat:incomeWeights, tariff:incomeWeights,
    corporateTax:regions.map(r => Math.max(0,r.nominalGDPMonthly)), royalty:reference.map(r => r.gva[1]),
    healthcare:healthWeights, education:schoolWeights, childcare:preschool,
    otherTransfers:spending('social',population), familyBenefits:minors, pensions:pensions.map(n => n??0),
    unemploymentBenefits:unemployed, retraining:unemployed,socialHousing:spending('housing',housingNeed),
    infrastructureMaintenance:transportWeights, housingAid:spending('housing',housingNeed),
    businessSupport:regions.map(r => Math.max(0,r.realGDPMonthly)),
    otherTax:incomeWeights,
  };
  const taxKeys = ['incomeTax','vat','tariff','corporateTax','royalty'];
  const transferKeys = ['pensions','unemploymentBenefits','housingAid'];
  const nationalFlows = {...fiscal,
    otherTax:Number.isFinite(fiscal?.tax) ? fiscal.tax-sum(taxKeys.map(key => fiscal[key]??0)) : null,
    otherTransfers:Number.isFinite(fiscal?.transfers)
      ? fiscal.transfers-sum(transferKeys.map(key => fiscal[key]??0)) : null,
  };
  const flows = Object.fromEntries(Object.entries(spendColumns).map(([key,weights]) =>
    [key,['healthcare','education','infrastructureMaintenance','socialHousing','retraining','businessSupport'].includes(key)?territorialDistribution(key,nationalFlows[key],weights):spread(nationalFlows[key],weights)]
  ));
  const householdDeposits = spread(sum(state.households.map(h => h.cash)),incomeWeights);
  const householdCredit = spread(sum(state.households.map(h => h.loanLC+h.loanFX*state.exchangeRate)),incomeWeights);
  const businessCredit = regions.map((_,i) => sum(firms.map((firm,j) =>
    (firm.loanLC+firm.loanFX*state.exchangeRate)*reference[i].gva[j]
  )));

  const farmSpending=(fiscal?.territorialPrograms??[]).some(row=>row.programme==='agricultureProtection')
    ?territorialDistribution('agricultureProtection',fiscal.agricultureProtection,farmland):null;
  return regions.map((region,i) => {
    const [children,workingAge,elderly] = ages[i];
    const p = reference[i].profile;
    const residentsEmployed = laborForce[i]-unemployed[i];
    const netMigration = oldAges ? population[i]-sum(oldAges[i])-births[i]+deaths[i] : null;
    const areaNetworks = networks.map(network => network[i]);
    const capitalStock = sum(areaNetworks.flatMap(n => [n.public,n.municipal,n.private,n.concession]));
    const taxes = flows.otherTax[i]===null ? null : sum(taxKeys.map(key => flows[key][i]??0))+flows.otherTax[i];
    const transfers = flows.otherTransfers[i]===null ? null : sum(transferKeys.map(key => flows[key][i]??0))+flows.otherTransfers[i];
    return {
      ...region, householdIncomeMonthly:incomeByRegion[i],
      demography:{children,childrenUnderFive:preschool[i],schoolAge:schoolNeed[i],workingAge,elderly,births:births[i],deaths:deaths[i],
        naturalIncrease:births[i]-deaths[i],netMigration,externalNetMigration:oldAges ? externalMigration[i] : null,
        balancingDomesticNetMigration:oldAges ? netMigration-externalMigration[i] : null,
        dependencyRatio:ratio(children+elderly,workingAge),retirees:pensions[i]},
      labor:{laborForce:laborForce[i],employedResidents:residentsEmployed,unemployed:unemployed[i],
        unemploymentRate:ratio(unemployed[i],laborForce[i]),grossPayrollMonthly:payroll[i],
        participationRate:ratio(laborForce[i],adults[i]),employmentRate:ratio(residentsEmployed,adults[i])},
      households:{consumptionMonthly:consumption[i],consumptionVolume:consumptionVolume[i],
        absolutePoverty:absolutePoverty[i],relativePoverty:relativePoverty[i],
        costOfLivingIndex:costOfLiving[i],
        realIncomePerResident:ratio(incomeByRegion[i]*100/costOfLiving[i],population[i])},
      investment:{grossMonthly:investment[i],volume:investmentVolume[i],publicVolume:publicInvestment[i]},
      trade:{estimatedImportUseMonthly:importUse[i]},
      publicServices:{health:{...health[i],publicSpending:flows.healthcare[i]},
        education:{...education[i],publicSpending:flows.education[i]},
        childcare:{coveredNeed:childcare[i],coverage:ratio(childcare[i],preschool[i]),publicSpending:flows.childcare[i]}},
      geography:{landKm2:p.landKm2,referenceUrbanShare:p.urbanShare,urbanResidents:urban[i],ruralResidents:population[i]-urban[i],
        urbanShare:ratio(urban[i],population[i]),densityPerKm2:p.landKm2>0 ? population[i]*1e6/p.landKm2 : null},
      housing:{homes:homes[i],estimatedHouseholds:housingNeed[i],homesPerHousehold:homes[i]===null ? null : ratio(homes[i],housingNeed[i]),
        publicHomes:publicHomes[i],privateHomes:privateHomes[i],urbanHomes:urbanHomes[i],ruralHomes:ruralHomes[i]},
      infrastructure:{roadsKm:p.roadsKm??null,roadsReferenceYear:p.roadsYear??null,networks:areaNetworks,
        capitalStock,capitalPerResident:ratio(capitalStock,population[i])},
      agriculture:{farmlandKm2:farmland[i],publicProtectionStock:farmPublic[i],privateProtectionStock:farmPrivate[i],
        ...(farmSpending?{publicProtectionSpending:farmSpending[i]}:{})},
      finance:{householdDeposits:householdDeposits[i],householdCredit:householdCredit[i],businessBankCredit:businessCredit[i]},
      fiscal:{tax:taxes,transfers,...Object.fromEntries(Object.entries(flows).map(([key,values]) => [key,values[i]]))},
    };
  });
}

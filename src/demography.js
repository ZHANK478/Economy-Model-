// Cohort-component accounting. Population is in millions; bins are months of age,
// by sex, with an open 100+ tail. Schedules are synthetic, not estimated country data.
const LAST=1200;
const sum=a=>a.reduce((v,x)=>v+x,0);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fertilityWeights=[.07,.22,.28,.24,.14,.045,.005];

export function annualMortalityHazard(age,sex) {
  const h=age<1?.018:age<5?.0009:age<15?.0003:.0008*Math.exp(.10*(age-30));
  return Math.min(.8,h*(sex==='male'?1.12:.88));
}
export function cohortTotals(d) {
  const groups=[0,0,0];
  for(let a=0;a<=LAST;a++) groups[a<216?0:a<780?1:2]+=d.female[a]+d.male[a];
  return groups;
}
export function expectedBirths(d,tfr=d.fertility) {
  let births=0;
  for(let a=180;a<600;a++) births+=d.female[a]*tfr*fertilityWeights[Math.floor((a/12-15)/5)]/5/12;
  return births;
}
export function periodLifeExpectancy(d,parameters,month=0) {
  let result=0;
  for(const sex of ['male','female']) {
    let survival=1,years=0;
    for(let age=0;age<100;age++) {
      const hazard=annualMortalityHazard(age+.5,sex)*d.mortalityFactor*Math.exp(-parameters.mortalityImprovement*month/12);
      const end=survival*Math.exp(-hazard);
      years+=(survival+end)/2;survival=end;
    }
    const tail=annualMortalityHazard(100,sex)*d.mortalityFactor*Math.exp(-parameters.mortalityImprovement*month/12);
    years+=survival/Math.max(tail,.0001);result+=years/2;
  }
  return result;
}
export function createDemography(population,parameters) {
  const d={female:Array(LAST+1).fill(0),male:Array(LAST+1).fill(0),fertility:parameters.initialFertility,
    mortalityFactor:1,healthAccess:1,familySupport:1,migrationRate:0,pregnancies:[],
    births:0,deaths:0,netMigration:0,populationResidual:0};
  const children=parameters.initialChildShare,elderly=parameters.initialElderlyShare;
  const ranges=[[0,216,children,.488],[216,780,1-children-elderly,.50],[780,LAST+1,elderly,.56]];
  for(const [from,to,share,femaleShare] of ranges) {
    const weights=Array.from({length:to-from},(_,i)=>from===780?Math.exp(-i/140):1);
    const total=sum(weights);
    for(let a=from;a<to;a++) {const n=population*share*weights[a-from]/total;d.female[a]=n*femaleShare;d.male[a]=n*(1-femaleShare);}
  }
  d.deaths=['female','male'].reduce((v,sex)=>v+d[sex].reduce((t,n,a)=>t+n*(-Math.expm1(-annualMortalityHazard(a/12,sex)/12)),0),0);
  d.births=expectedBirths(d);d.pregnancies=Array(parameters.pregnancyDelay).fill(d.births);
  return d;
}
export function advanceDemography(s,prev) {
  const d=s.demography,k=s.parameters,p=s.policy;
  const oldPopulation=prev.population;
  // Only realized last-month expenditure changes services. Changing a slider alone
  // cannot buy survival or deliver babies; effects have service and pregnancy lags.
  const fiscal=prev.lastReport.fiscal;
  const realHealth=(fiscal.healthcare??s.base.monthlyGDP*.02)/(prev.consumerPriceIndex/100)/oldPopulation;
  const realFamily=(fiscal.familyBenefits??s.base.monthlyGDP*.005)/(prev.consumerPriceIndex/100)/Math.max(prev.ageCohorts[0],.001);
  const income=Math.max(.2,prev.metrics.realIncomeIndex/100);
  const privateAccess=Math.max(0,(prev.services?.healthCoverage??1)-(prev.services?.publicHealthDelivered??1));
  d.healthAccess+=k.healthAdjustment*(clamp(realHealth/10+privateAccess,.15,3)-d.healthAccess);
  d.familySupport+=k.fertilityAdjustment*(clamp(realFamily/(25/2.8),0,5)-d.familySupport);
  const mortalityTarget=clamp(Math.exp(-k.healthMortalityElasticity*Math.log(Math.max(.15,d.healthAccess))-.08*Math.log(income)),.55,1.8);
  d.mortalityFactor+=k.healthAdjustment*(mortalityTarget-d.mortalityFactor);
  const fertilityTarget=clamp(k.initialFertility*Math.exp(-k.fertilityTrend*s.month/12
    +k.fertilityBenefitElasticity*Math.log(Math.max(.2,d.familySupport))+.06*Math.log(income)
    -.002*Math.max(0,prev.metrics.unemployment-9)-.10*(prev.skills-1)
    -k.fertilityHousingElasticity*Math.log(Math.max(.1,prev.services?.housingBurden??.25)/k.initialHousingBurden)
    +k.fertilityChildcareElasticity*Math.log((.5+(prev.services?.childcareAccess??.5)))
    +k.fertilityWorkLifeElasticity*(Math.log(40/p.normalWorkweek)+Math.min(p.parentalLeaveMonths,12)/12-1/3)),.5,Math.max(5,k.initialFertility));
  d.fertility+=k.fertilityAdjustment*(fertilityTarget-d.fertility);
  const conceived=expectedBirths(d);
  d.births=d.pregnancies.shift();d.pregnancies.push(conceived);
  let deaths=0;
  for(const sex of ['female','male']) {
    const old=d[sex],next=Array(LAST+1).fill(0);
    for(let a=0;a<=LAST;a++) {
      const hazard=annualMortalityHazard(a/12,sex)*d.mortalityFactor*Math.exp(-k.mortalityImprovement*s.month/12);
      const death=old[a]*(-Math.expm1(-hazard/12));deaths+=death;
      next[Math.min(LAST,a+1)]+=old[a]-death;
    }
    next[0]+=d.births*(sex==='male'?1.05/2.05:1/2.05);d[sex]=next;
  }
  const migrationPressure=clamp(.004*Math.log(income)-.025*(prev.metrics.unemployment-9)/100,-.01,.01);
  const desiredMigration=migrationPressure>0?migrationPressure*p.migrationOpenness/100:migrationPressure;
  d.migrationRate+=k.migrationAdjustment*(desiredMigration-d.migrationRate);
  const requested=oldPopulation*d.migrationRate/12;
  let migrated=0;
  for(const sex of ['female','male']) for(let a=240;a<480;a++) {
    const amount=Math.max(-d[sex][a],requested/480);d[sex][a]+=amount;migrated+=amount;
  }
  d.deaths=deaths;d.netMigration=migrated;
  s.ageCohorts=cohortTotals(d);s.population=sum(s.ageCohorts);s.workingAgeShare=s.ageCohorts[1]/s.population;
  d.populationResidual=s.population-(oldPopulation+d.births-deaths+migrated);
  return migrated;
}
export function demographicMetrics(s) {
  const d=s.demography;
  return {population:s.population,births:d.births,deaths:d.deaths,naturalIncrease:d.births-d.deaths,
    totalFertilityRate:d.fertility,birthRate:d.births*12/s.population*1000,deathRate:d.deaths*12/s.population*1000,
    elderlyShare:s.ageCohorts[2]/s.population*100,dependencyRatio:(s.ageCohorts[0]+s.ageCohorts[2])/s.ageCohorts[1]*100,
    lifeExpectancy:periodLifeExpectancy(d,s.parameters,s.month),healthAccess:d.healthAccess*100,familySupport:d.familySupport*100};
}

import {SECTORS} from './config.js';

const sum = values => values.reduce((total,value)=>total+value,0);
const shares = values => {
  const total=sum(values);
  return values.map(value=>value/total);
};

export const regionalProductionActive = s => s.scenario?.id==='uk-2000' && s.economy?.revision>=26;

export function advanceRegionalProduction(s, previous, reference) {
  if(!regionalProductionActive(s))return;
  if(previous?.month===s.month && previous.regionalProduction)return;
  const prior=previous?.regionalProduction;
  const {capitalShare}=s.economy.parameters;
  const retention=(1-s.parameters.annualDepreciation)**(1/12);
  const oldRegions=previous?.regional?.regions;
  // Settled resident incomes proxy local demand for construction and services.
  // Growth relative to the opening share removes differences in initial market size.
  const incomeShare=oldRegions && shares(oldRegions.map(region=>Math.max(1e-12,region.householdIncomeMonthly)));
  s.regionalProduction=SECTORS.map(({id},j)=>{
    const openingJobs=reference.map(region=>region.jobs[j]);
    const openingCapital=reference.map(region=>region.gva[j]);
    if(!prior)return {id,jobs:openingJobs,capital:openingCapital,capacity:openingCapital};

    const current=s.firms[j];
    const opening=prior[j];
    const oldCapital=previous.firms[j].capital;
    // Allocate local-market additions using resident demand. For tradable
    // sectors, installed capacity is the initial proxy for investment location.
    const score=opening.capital.map((stock,i)=>{
      const demand=j>=3&&incomeShare ? incomeShare[i]/reference[i].income : 1;
      return stock*Math.max(.5,Math.min(2,demand));
    });
    const incoming=shares(score);
    const surviving=Math.min(current.capital,oldCapital*retention);
    const additions=current.capital-surviving;
    const capital=current.capital>0?shares(opening.capital.map((weight,i)=>weight*surviving+incoming[i]*additions)):opening.capital;
    // Regional hiring follows installed capital gradually. Workplace job
    // weights also retain the observed regional labour intensity of the branch.
    const desiredJobs=shares(openingJobs.map((weight,i)=>
      weight*(capital[i]/openingCapital[i])**capitalShare));
    const adjustment=s.parameters.employmentAdjustment;
    const jobs=shares(opening.jobs.map((weight,i)=>weight+(desiredJobs[i]-weight)*adjustment));
    const capacity=shares(openingCapital.map((weight,i)=>
      weight*(capital[i]/weight)**capitalShare*(jobs[i]/openingJobs[i])**(1-capitalShare)));
    return {id,jobs,capital,capacity};
  });
}

export function validateRegionalProduction(s, count) {
  if(!regionalProductionActive(s))return;
  const keys=['jobs','capital','capacity'];
  if(!Array.isArray(s.regionalProduction)||s.regionalProduction.length!==SECTORS.length||
    s.regionalProduction.some((sector,i)=>sector?.id!==SECTORS[i].id||keys.some(key=>{
      const values=sector[key];
      return !Array.isArray(values)||values.length!==count||
        values.some(value=>!Number.isFinite(value)||value<=0)||Math.abs(sum(values)-1)>1e-9;
    })))throw new Error('Повреждены счета регионального производства');
}

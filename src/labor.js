import {livelihoodsActive,familyWageShares,familyLaborReservations} from './livelihoods.js';
import {effectiveSchoolingTarget} from './talent-migration.js';
import {settlementsActive,residenceSorting} from './settlements.js';
import {detailedHouseholds} from './household-structure.js';
// Bargaining, rent sharing and employer wage-setting power; coefficients are assumptions.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((x,v)=>x+v,0);
export function initializeLabor(s){s.firms.forEach(f=>{f.labor={density:.18,coverage:.25,power:.25,
  wageFactor:1,strikeShare:0,turnover:.025};f.referenceWage=f.wage;});}
export function advanceLabor(s,prev,events){
  const p=s.policy,k=s.parameters;
  s.firms.forEach((f,i)=>{
    const a=f.labor,old=prev.firms[i].labor;
    const freedom=s.politics.civilFreedom*Number(p.associationFreedom);
    const incentive=clamp(.20+.5*k.laborMarkdown+.12*Math.max(0,prev.metrics.inflationYoY-5)/100+.1*Number(p.workerRepresentation),.05,.7);
    a.density+=k.unionAdjustment*(freedom*incentive-a.density);
    const targetCoverage=p.collectiveBargaining?clamp(a.density*(p.bargainingSystem==='firm'?1.2:2.5),0,.9):0;
    a.coverage+=k.unionAdjustment*(targetCoverage-a.coverage);
    const outsideOption=clamp(1-prev.metrics.unemployment/30,.05,1);
    a.power=clamp(a.density*.8+outsideOption*.25+.10*Number(p.workerRepresentation),0,.8)*Number(p.collectiveBargaining);
    const payroll=Math.max(1,f.workers*f.wage*p.normalWorkweek/40),rents=Math.max(0,f.lastProfit)/payroll;
    const markdown=k.laborMarkdown*(1-s.institutions.competition);
    const coordinated=p.bargainingSystem==='coordinated'?.7:1;
    const realWageLoss=clamp(Math.log(f.referenceWage*prev.consumerPriceIndex/100*f.productivity/Math.max(f.wage,1e-9)),0,.10);
    const targetFactor=1+a.coverage*a.power*(markdown+k.unionRentSharing*Math.min(.5,rents)+k.unionConflictSensitivity*realWageLoss)*coordinated;
    a.wageFactor+=.08*(targetFactor-a.wageFactor);
    const surprise=Math.max(0,prev.metrics.inflationMonthly/100-Math.log1p(prev.expectedInflation)/12);
    const dispute=Math.max(0,targetFactor-a.wageFactor-.005)+k.unionConflictSensitivity*surprise+.05*Math.min(1,f.arrears/Math.max(f.lastRevenue,1));
    a.strikeShare=p.strikeRights?clamp(a.coverage*dispute*(p.bargainingSystem==='coordinated'?.35:1),0,.04):0;
    a.turnover=clamp(.03-.012*a.coverage-.002*p.employmentProtection,.005,.05);
    if(a.strikeShare>.002&&old.strikeShare<=.002)events.push(`${f.name}: трудовой конфликт, потеря ${(a.strikeShare*100).toFixed(1)}% рабочих часов.`);
  });
}
export function laborWageShares(s,f,groups){
  if(detailedHouseholds(s)){
    initializeLaborDistribution(s);settleLaborDistribution(s);
    const i=s.firms.indexOf(f);return familyWageShares(s,i,[...s.laborDistribution.sectors[i].wageShares]);
  }
  const compression=s.parameters.unionWageCompression*f.labor.coverage;
  const values=groups.map(g=>Math.pow(g.wageShare,1-compression));const total=sum(values);
  return values.map(x=>x/total);
}
export function laborMetrics(s){const weights=s.firms.map(f=>f.workers),total=Math.max(sum(weights),.001);
  const average=key=>sum(s.firms.map((f,i)=>f.labor[key]*weights[i]))/total*100;
  return {unionDensity:average('density'),bargainingCoverage:average('coverage'),bargainingPower:average('power'),
    strikeHours:average('strikeShare'),workerTurnover:average('turnover')};
}

// Supply-demand-institutions mechanism: Goldin/Katz (2007), Song et al.
// (2015), Farber et al. (2018). Numbers below are scenario assumptions, not
// universal causal estimates. No change to firms' aggregate payroll or output.
export const LABOR_DISTRIBUTION_ASSUMPTIONS=Object.freeze({schoolingSpread:4.5,schoolingReturn:.08,sorting:.18,scarcityResponse:.04,cohortReplacement:1/360,compression:.5});
const sectorRequirements=[6,11,12,9,13];
export function initializeLaborDistribution(s){
 if(!detailedHouseholds(s)||s.laborDistribution)return;
 const mean=s.education.meanYears,a=LABOR_DISTRIBUTION_ASSUMPTIONS;
 const offsets=[-1,-.8,-.6,-.4,-.2,0,.2,.4,.6,1];
 let lo=-10,hi=10,schooling;
 for(let k=0;k<60;k++){
  const shift=(lo+hi)/2;schooling=offsets.map(x=>clamp(mean+shift+x*a.schoolingSpread,0,18));
  if(sum(schooling.map((x,i)=>x*s.households[i].population))<mean)lo=shift;else hi=shift;
 }
 const employed=sum(s.firms.map(f=>f.workers)),required=sum(s.firms.map((f,i)=>f.workers*sectorRequirements[i]))/Math.max(employed,1e-9);
 s.laborDistribution={version:1,startedMonth:s.month,assumptions:{...a},schooling,initialSchooling:mean,initialRequirement:required,sectors:[],groups:[],fingerprint:null};
}
export function advanceLaborDistribution(s){
 if(!detailedHouseholds(s))return;initializeLaborDistribution(s);
 const d=s.laborDistribution,a=d.assumptions;
 // Qualification stocks change with cohort replacement and actual access,
 // never instantly when the education budget changes. Preserve the national
 // mean from the existing cohort model: no second human-capital growth bonus.
 d.schooling=d.schooling.map((x,i)=>x+a.cohortReplacement*((s.education.expectedYears??12)*.75*(s.services.educationByGroup[i]??0)-x));
 let lo=-18,hi=18,adjusted;
 for(let k=0;k<50;k++){
  const shift=(lo+hi)/2;adjusted=d.schooling.map(x=>clamp(x+shift,0,18));
  if(sum(adjusted.map((x,i)=>x*s.households[i].population))<effectiveSchoolingTarget(s))lo=shift;else hi=shift;
 }
 d.schooling=adjusted;d.fingerprint=null;
}
export function settleLaborDistribution(s){
 const d=s.laborDistribution,a=d.assumptions;
 const keyParts=[d.schooling,s.settlements?.groups.map(g=>g.urbanShare),s.population,s.workingAgeShare,s.participation,s.firms.map(f=>[f.workers,f.wage,f.productivity,f.labor.coverage])];if(livelihoodsActive(s))keyParts.push(familyLaborReservations(s));const key=JSON.stringify(keyParts);
 if(d.fingerprint===key)return;
 const employed=sum(s.firms.map(f=>f.workers)),workforce=Math.max(employed,s.population*s.workingAgeShare*s.participation);
 const fixed=familyLaborReservations(s),fixedSectors=s.firms.map((_,i)=>sum(fixed.map(row=>row[i])));
 const supply=s.households.map(h=>workforce*h.population),columns=[...s.firms.map(f=>f.workers),Math.max(0,workforce-employed)];
 const mean=sum(d.schooling.map((x,i)=>x*s.households[i].population));
 const requirements=s.firms.map((f,i)=>sectorRequirements[i]+Math.log(Math.max(.2,f.productivity))*2);
 const required=sum(requirements.map((x,i)=>x*s.firms[i].workers))/Math.max(employed,1e-9);
 const scarcity=(required-d.initialRequirement)-(mean-d.initialSchooling);
 const premium=clamp(a.schoolingReturn+a.scarcityResponse*scarcity,.02,.20);
 // RAS matches group worker supplies and actual sector job counts, including
 // unemployment as a sixth destination. No worker can occupy two jobs.
 const cells=supply.flatMap((v,j)=>settlementsActive(s)&&s.settlements?[false,true].map(urban=>({group:j,urban,populationShare:urban?s.settlements.groups[j].urbanShare:1-s.settlements.groups[j].urbanShare,supply:v*(urban?s.settlements.groups[j].urbanShare:1-s.settlements.groups[j].urbanShare)})):[{group:j,urban:null,populationShare:1,supply:v}]);
 const fixedCells=cells.map(c=>s.firms.map((_,i)=>c.urban===null||c.urban===(i!==0)?fixed[c.group][i]:0));
 if(livelihoodsActive(s)){for(const [j,c] of cells.entries())c.supply=Math.max(0,c.supply-sum(fixedCells[j]));for(let i=0;i<5;i++)columns[i]=Math.max(0,columns[i]-fixedSectors[i]);}
 const jobs=cells.map(c=>columns.map((n,i)=>n?Math.exp(clamp(a.sorting*(d.schooling[c.group]-mean)*((requirements[i]??4)-required),-20,20))*(c.urban===null?1:residenceSorting(s,c.group,i,c.urban)):0));
 for(let k=0;k<120;k++){
  for(let j=0;j<cells.length;j++){const total=sum(jobs[j]);for(let i=0;i<6;i++)jobs[j][i]*=cells[j].supply/Math.max(total,1e-100);}
  for(let i=0;i<6;i++){const total=sum(jobs.map(row=>row[i]));for(let j=0;j<cells.length;j++)jobs[j][i]*=columns[i]/Math.max(total,1e-100);}
 }
 if(livelihoodsActive(s))for(let j=0;j<jobs.length;j++)for(let i=0;i<5;i++)jobs[j][i]+=fixedCells[j][i];
 d.sectors=s.firms.map((f,i)=>{
  const compression=a.compression*f.labor.coverage;
  const quality=d.schooling.map(x=>Math.exp(premium*(x-mean)*(1-compression)));
  const weights=supply.map((_,j)=>sum(jobs.map((row,k)=>cells[k].group===j?Math.max(0,row[i]-(livelihoodsActive(s)?fixedCells[k][i]:0))*quality[j]:0))),total=sum(weights);
  return {sector:i,workers:supply.map((_,j)=>sum(jobs.map((row,k)=>cells[k].group===j?row[i]:0))),wageShares:weights.map((x,j)=>total>0?x/total:s.households[j].population),requiredSchooling:requirements[i],schoolingPremium:premium*(1-compression)};
 });
 d.groups=supply.map((workers,j)=>({group:j,laborForce:workers,employed:sum(d.sectors.map(r=>r.workers[j])),unemployed:sum(jobs.map((row,k)=>cells[k].group===j?row[5]:0)),schooling:d.schooling[j],grossPayroll:sum(d.sectors.map((r,i)=>r.wageShares[j]*s.firms[i].workers*s.firms[i].wage))}));
 if(settlementsActive(s))d.residence=cells.map((c,k)=>({group:c.group,urban:c.urban,populationShare:c.populationShare,employed:sum(jobs[k].slice(0,5)),unemployed:jobs[k][5],workers:jobs[k].slice(0,5),sectorWageShares:d.sectors.map((r,i)=>r.workers[c.group]>0?r.wageShares[c.group]*jobs[k][i]/r.workers[c.group]:0),grossPayroll:sum(d.sectors.map((r,i)=>r.workers[c.group]>0?r.wageShares[c.group]*jobs[k][i]/r.workers[c.group]*s.firms[i].workers*s.firms[i].wage:0))}));
 d.fingerprint=key;
}
export function validateLaborDistribution(s){
 const d=s.laborDistribution;if(!detailedHouseholds(s)){if(d)throw new Error('Повреждена ревизия рынка труда');return;}
 const nonnegative=x=>Number.isFinite(x)&&x>=0;
 if(!d||d.version!==1||!Number.isInteger(d.startedMonth)||d.startedMonth<0||d.startedMonth>s.month||!Array.isArray(d.schooling)||d.schooling.length!==10||d.schooling.some(x=>!nonnegative(x)||x>18)||!nonnegative(d.initialSchooling)||!nonnegative(d.initialRequirement)||!Array.isArray(d.sectors)||d.sectors.length!==5||!Array.isArray(d.groups)||d.groups.length!==10)throw new Error('Повреждена структура рынка труда');
 for(const k of Object.keys(LABOR_DISTRIBUTION_ASSUMPTIONS))if(!nonnegative(d.assumptions?.[k])||d.assumptions[k]>10)throw new Error('Повреждены допущения рынка труда');
 for(const r of d.sectors)if(!Array.isArray(r.workers)||r.workers.length!==10||r.workers.some(x=>!nonnegative(x))||!Array.isArray(r.wageShares)||r.wageShares.length!==10||r.wageShares.some(x=>!nonnegative(x))||Math.abs(sum(r.wageShares)-1)>1e-8)throw new Error('Повреждено распределение зарплат');
 for(const [j,g] of d.groups.entries())if(!['laborForce','employed','unemployed','grossPayroll'].every(k=>nonnegative(g[k]))||Math.abs(g.employed+g.unemployed-g.laborForce)>1e-6*Math.max(1,g.laborForce)||Math.abs(g.employed-sum(d.sectors.map(r=>r.workers[j])))>1e-8)throw new Error('Нарушен баланс работников');
}

// Initial observations/calibration only. No income-category switches in behaviour.
// Monetary/physical volumes use the same scenario-start LC unit as engine.js.
// These synthetic vectors are NOT estimates of a named country. Sources and
// parameter status are recorded in docs/OPEN-ECONOMY.md.
import {OBSERVATIONS} from './economic-observations.js';
const measured=(id,assumptions)=>{
 const o=OBSERVATIONS[id],a=o.agricultureEmployment/100,b=o.industryEmployment/100,c=o.servicesEmployment/100,total=a+b+c;
 return {...assumptions,workerShares:[a/total,b*.10/total,b*.65/total,b*.25/total,c/total],
  schooling:o.schooling,creditRatio:o.privateCredit/100,lifeExpectancy:o.lifeExpectancy,
  exportGDPShare:o.exportsGDP/100,importGDPShare:o.importsGDP/100,agricultureGDPShare:o.agricultureValueAdded/100,
  exportWeights:[.04,.12,.60,0,.24]};
};
export const ECONOMIC_STRUCTURES={
 poor:measured('BGD',{
  workerShares:[.60,.025,.10,.06,.215],consumptionWeights:[.45,.07,.17,.06,.25],
  exportWeights:[.48,.10,.25,0,.17],capitalOutput:[1.8,3.6,2.6,1.8,2.5],
  expectedSchooling:8.5,infrastructureRatio:.38,
  creditRatio:.22,householdCreditShare:.25,reserveMonths:4,informality:.65,
  courtCapacity:.48,administrativeCapacity:.48,healthAccess:.45,
  foreignCreditRatio:.10,tradeCost:.32,participation:.69
 }),
 middle:measured('MEX',{
  workerShares:[.20,.035,.25,.13,.385],consumptionWeights:[.28,.08,.23,.07,.34],
  exportWeights:[.18,.08,.46,0,.28],capitalOutput:[2.4,4.2,3.0,2.0,3.2],
  expectedSchooling:12,infrastructureRatio:.70,
  creditRatio:.65,householdCreditShare:.30,reserveMonths:5,informality:.30,
  courtCapacity:.65,administrativeCapacity:.65,healthAccess:.80,
  foreignCreditRatio:.25,tradeCost:.18,participation:.70
 }),
 rich:measured('FRA',{
  workerShares:[.04,.02,.19,.08,.67],consumptionWeights:[.13,.07,.22,.06,.52],
  exportWeights:[.06,.05,.43,0,.46],capitalOutput:[3.0,4.5,3.3,2.2,3.6],
  expectedSchooling:16,infrastructureRatio:1,
  creditRatio:1.15,householdCreditShare:.48,reserveMonths:4,informality:.12,
  courtCapacity:.80,administrativeCapacity:.80,healthAccess:1,
  foreignCreditRatio:.50,tradeCost:.09,participation:.73
 })
};

export function validateStructure(c){
 const positive=v=>Number.isFinite(v)&&v>0;
 if(!c||Object.keys(c).length!==Object.keys(ECONOMIC_STRUCTURES.middle).length||Object.keys(ECONOMIC_STRUCTURES.middle).some(k=>!Object.hasOwn(c,k)))throw new Error('Неполная исходная структура экономики');
 for(const k of ['workerShares','consumptionWeights','exportWeights'])if(!Array.isArray(c[k])||c[k].length!==5||c[k].some(v=>!Number.isFinite(v)||v<0)||Math.abs(c[k].reduce((a,b)=>a+b,0)-1)>1e-9)throw new Error('Некорректные исходные доли');
 if(!Array.isArray(c.capitalOutput)||c.capitalOutput.length!==5||c.capitalOutput.some(v=>!positive(v)||v>15))throw new Error('Некорректный исходный капитал');
 for(const k of Object.keys(c).filter(k=>!Array.isArray(c[k])))if(!positive(c[k]))throw new Error('Некорректная исходная характеристика: '+k);
 for(const k of ['householdCreditShare','informality','courtCapacity','administrativeCapacity','healthAccess','participation'])if(c[k]>1)throw new Error('Исходная доля вне диапазона: '+k);
 if(c.schooling>15||c.expectedSchooling>18||c.creditRatio>4||c.tradeCost>2)throw new Error('Исходная характеристика вне диапазона');
 return c;
}

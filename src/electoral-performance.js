import {clamp,clone} from './political-config.js';
// Outcomes, not appropriations. Numerical weights are scenario assumptions.
export const MATERIAL_KEYS=new Set(['incomeTax','corporateTax','vat','tariff','transfers','familyBenefits','childcareBudget','healthcare','education','infrastructureMaintenance','publicInvestment','minimumWage','militaryBudget']);
export const performanceActive=s=>s.politics?.performanceVoting?.revision===1;
const priceStress=v=>Math.max(0,v-5)+Math.max(0,-v-2);
const logRatio=(x,y)=>Math.log(Math.max(.05,x)/Math.max(.05,y));
export function serviceExperience(s,income){
 const indices=[income*2,income*2+1],a=s.services;
 return {health:indices.reduce((v,i)=>v+(a.healthByGroup?.[i]??a.healthCoverage??1),0)/4+.5*Math.min(2,a.publicHealthDelivered??1),education:indices.reduce((v,i)=>v+(a.educationByGroup?.[i]??a.educationCoverage??1),0)/4+.5*Math.min(2,a.publicEducationDelivered??1)};
}
export function initializePerformanceVoting(s){
 const p=s.politics;if(!p.enabled||performanceActive(s))return;
 p.performanceVoting={revision:1,startedMonth:s.month,reference:{national:s.metrics.realIncomeIndex,unemployment:s.metrics.unemployment,inflation:s.metrics.inflationYoY,groups:Array.from({length:5},(_,i)=>(s.households[i*2].realIncomeIndex+s.households[i*2+1].realIncomeIndex)/2),services:Array.from({length:5},(_,i)=>serviceExperience(s,i))},initialMemory:Object.fromEntries(Object.entries(p.groupMemory??{}).map(([id,g])=>[id,g.income])),policy:clone(s.policy),legacyDecisionEvents:clone(p.publicEvents.filter(e=>e.type==='decision')),assumptions:{ownIncomeWeight:.65,nationalIncomeWeight:.35,unemploymentWeight:.018,priceStressWeight:.004,healthWeight:.1,educationWeight:.1},status:'research-informed outcomes; weights not estimated electoral elasticities'};
}
export function performanceExperience(s,income,id){
 const v=s.politics.performanceVoting,r=v.reference,k=v.assumptions,a=serviceExperience(s,income),b=r.services[income];
 const own=(s.households[income*2].realIncomeIndex+s.households[income*2+1].realIncomeIndex)/2;
 return (v.initialMemory[id]??0)+k.ownIncomeWeight*logRatio(own,r.groups[income])+k.nationalIncomeWeight*logRatio(s.metrics.realIncomeIndex,r.national)-k.unemploymentWeight*(s.metrics.unemployment-r.unemployment)-k.priceStressWeight*(priceStress(s.metrics.inflationYoY)-priceStress(r.inflation))+k.healthWeight*logRatio(a.health,b.health)+k.educationWeight*logRatio(a.education,b.education);
}
export function validatePerformanceVoting(s){
 const v=s.politics?.performanceVoting;if(v===undefined)return;
 if(v.revision!==1||!Number.isInteger(v.startedMonth)||v.startedMonth>s.month||!v.reference||!Array.isArray(v.reference.groups)||v.reference.groups.length!==5||!Array.isArray(v.reference.services)||v.reference.services.length!==5||!Array.isArray(v.legacyDecisionEvents)||!v.policy||!v.assumptions||!v.initialMemory)throw new Error('Повреждена модель экономического голосования');
 const values=[v.reference.national,v.reference.unemployment,v.reference.inflation,...v.reference.groups,...v.reference.services.flatMap(x=>[x.health,x.education]),...Object.values(v.assumptions),...Object.values(v.initialMemory)];
 if(values.some(x=>!Number.isFinite(x)))throw new Error('Недопустимые показатели экономического голосования');
}

// Recent changes are more salient than the same gains already lived with for
// years. Keep this channel bounded to avoid runaway ratings during long saves.
export function recentLivingConditions(s,reference,income=null){
 const current=s.metrics;
 const own=income===null?current.realIncomeIndex:
  (s.households[income*2].realIncomeIndex+s.households[income*2+1].realIncomeIndex)/2;
 const prior=income===null?reference.national:reference.groups[income];
 return {
  income:logRatio(own,prior),
  jobs:-.032*(current.unemployment-(reference.unemployment??current.unemployment)),
  prices:-.009*(priceStress(current.inflationYoY)-priceStress(reference.inflation??current.inflationYoY))
 };
}
export function electoralExperienceTarget(s,income,experienced){
 const history=s.politics.economicHistory;
 const recent=recentLivingConditions(s,history.find(h=>h.month>=s.month-3)??history.at(-1),income);
 return .50*Math.tanh(experienced/.50)+clamp(.95*recent.income+recent.jobs+recent.prices,-.28,.28);
}

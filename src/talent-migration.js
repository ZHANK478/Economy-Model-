// Revision 21. Qualifications are stocks, with recognition and employment limits.
// Empirical mechanisms, not estimated universal migration/innovation bonuses.
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const talentActive=s=>(s.economy?.revision??0)>=21;
const human=y=>Math.exp(.134*Math.min(y,4)+.101*clamp(y-4,0,4)+.068*Math.max(0,y-8));
export function initializeTalent(s){
 if(!talentActive(s)||s.talentMigration)return;
 const d=s.laborDistribution,mean=s.education.meanYears;
 s.talentMigration={version:1,startedMonth:s.month,assumptions:{recognitionMonths:24,unrecognizedSchooling:8,capacityShare:.01,highSkillBase:.15,lowSkillBase:.45},groups:s.households.map((h,i)=>({group:i,adults:0,schoolYears:0,unrecognizedYears:0,highSkilled:0,unrecognizedHigh:0})),referencePremium:s.firms.map((f,i)=>{const r=d?.sectors?.[i],workers=sum(r?.workers??[]);return workers>0?human(sum(r.workers.map((n,j)=>n*d.schooling[j]))/workers)/human(mean):1;}),last:{inflow:0,outflow:0,recognized:0,employedHigh:0},history:[]};
}
export function effectiveSchoolingTarget(s){
 if(!talentActive(s)||!s.talentMigration)return s.education.meanYears;
 const adults=Math.max(.01,s.ageCohorts[1]+s.ageCohorts[2]);return Math.max(0,s.education.meanYears-sum(s.talentMigration.groups.map(g=>g.unrecognizedYears))/adults);
}
export function advanceTalent(s,prev,migration){
 if(!talentActive(s))return;initializeTalent(s);const t=s.talentMigration,a=t.assumptions,oldAdults=Math.max(.01,prev.ageCohorts[1]+prev.ageCohorts[2]);
 t.last={inflow:Math.max(0,migration),outflow:Math.max(0,-migration),recognized:0,employedHigh:0,composition:[]};
 const wageGap=Math.log(Math.max(.05,(prev.metrics.meanWageUSD??1)/(s.economy.previousWorldGDP/sum(s.economy.regions.map(r=>r.population))/12))),security=s.politics.civilFreedom*s.institutions.contractReliability;
 const high=clamp(a.highSkillBase*Math.exp(.35*wageGap+.6*(security-.5)-Math.max(0,prev.metrics.unemployment-8)/100),.03,.5),low=clamp(a.lowSkillBase*Math.exp(-.2*wageGap),.15,.65),middle=Math.max(.05,1-high-low),total=low+middle+high;
 const types=[{share:low/total,years:6,groups:[0,1,2,3]},{share:middle/total,years:12,groups:[4,5,6,7]},{share:high/total,years:16,groups:[8,9]}];
 const groupPeople=prev.households.map(h=>prev.population*h.population),oldMean=s.education.meanYears;
 let addedYears=0;
 if(migration>0)for(const type of types){
  const n=migration*type.share,automatic=clamp(.2+.3*s.institutions.contractReliability,.2,.5);addedYears+=n*type.years;
  for(const i of type.groups){const people=n/type.groups.length,g=t.groups[i],oldGroupAdults=oldAdults*prev.households[i].population;
   if(s.laborDistribution)s.laborDistribution.schooling[i]=(s.laborDistribution.schooling[i]*oldGroupAdults+people*(Math.min(type.years,a.unrecognizedSchooling)+automatic*Math.max(0,type.years-a.unrecognizedSchooling)))/Math.max(.01,oldGroupAdults+people);
   groupPeople[i]+=people;g.adults+=people;g.schoolYears+=people*type.years;
   const unrecognized=people*(1-automatic)*Math.max(0,type.years-a.unrecognizedSchooling);g.unrecognizedYears+=unrecognized;if(type.years===16){g.highSkilled+=people;g.unrecognizedHigh+=people*(1-automatic);}
  }t.last.composition.push({years:type.years,people:n});
 }
 if(migration<0){
  const out=-migration,highOut=clamp(a.highSkillBase*Math.exp(-.35*wageGap+.6*(.5-security)),.03,.5),outTypes=[{share:.4,years:6,groups:[0,1,2,3]},{share:Math.max(.1,.6-highOut),years:12,groups:[4,5,6,7]},{share:highOut,years:16,groups:[8,9]}],normal=sum(outTypes.map(x=>x.share));
  addedYears=0;
  for(const type of outTypes){let removed=0;for(const i of type.groups){const n=out*type.share/normal/type.groups.length,g=t.groups[i],oldGroupAdults=oldAdults*prev.households[i].population,rate=clamp(n/Math.max(oldGroupAdults,.01),0,1);
    groupPeople[i]-=n;removed+=n;for(const k of ['adults','schoolYears','unrecognizedYears','highSkilled','unrecognizedHigh'])g[k]*=1-rate;
    if(s.laborDistribution)s.laborDistribution.schooling[i]=clamp((s.laborDistribution.schooling[i]*oldGroupAdults-n*type.years)/Math.max(.01,oldGroupAdults-n),0,18);
   }addedYears-=removed*type.years;t.last.composition.push({years:type.years,people:-removed});}
 }

 const natural=s.population-prev.population-migration,denominator=sum(groupPeople);
 for(let i=0;i<10;i++)groupPeople[i]+=natural*(denominator>0?groupPeople[i]/denominator:prev.households[i].population);
 const peopleTotal=sum(groupPeople);s.households.forEach((h,i)=>h.population=groupPeople[i]/Math.max(peopleTotal,1e-12));
 if(Math.abs(migration)>0)s.education.meanYears=clamp((oldAdults*oldMean+addedYears)/Math.max(.01,oldAdults+migration),0,18);
 const spare=Math.max(0,(prev.services.publicEducationCapacity??0)-(prev.services.publicEducationDelivered??0))*prev.ageCohorts[0]*a.capacityShare;
 const availableCapacity=(prev.lastReport.fiscal.education??0)>0?spare:0;let capacity=availableCapacity;
 for(const g of t.groups){const rate=1-Math.exp(-s.institutions.contractReliability/a.recognitionMonths),wanted=g.unrecognizedYears*rate,recognized=Math.min(wanted,capacity*8);capacity-=recognized/8;
  const fraction=g.unrecognizedYears>0?recognized/g.unrecognizedYears:0;g.unrecognizedYears-=recognized;g.unrecognizedHigh*=1-fraction;t.last.recognized+=recognized;
 }
 t.last.recognitionCapacityUsed=availableCapacity-capacity;
}
export function skillCapacityFactor(s,sector){
 if(!talentActive(s)||!s.talentMigration||!s.laborDistribution?.sectors[sector])return 1;
 const d=s.laborDistribution,r=d.sectors[sector],workers=sum(r.workers);if(workers<=0)return 1;
 const employedMean=sum(r.workers.map((n,j)=>n*d.schooling[j]))/workers;
 return human(employedMean)/human(s.education.meanYears)/Math.max(.01,s.talentMigration.referencePremium[sector]);
}
export function finishTalent(s){
 if(!talentActive(s))return;const t=s.talentMigration,d=s.laborDistribution;
 t.last.employedHigh=sum(t.groups.map((g,i)=>{const eligible=Math.max(0,g.highSkilled-g.unrecognizedHigh),laborForce=d.groups[i]?.laborForce??0,employed=d.groups[i]?.employed??0;return eligible*clamp(employed/Math.max(laborForce,1e-9),0,1);}));
 t.last.unrecognizedHigh=sum(t.groups.map(g=>g.unrecognizedHigh));t.last.residentAdults=sum(t.groups.map(g=>g.adults));
 t.history.push({month:s.month,...t.last});t.history=t.history.slice(-120);s.lastReport.talentMigration=structuredClone(t.last);
}
export function validateTalent(s){
 if(!talentActive(s))return;const t=s.talentMigration,valid=x=>Number.isFinite(x)&&x>=0;
 if(!t||t.version!==1||!Number.isInteger(t.startedMonth)||t.startedMonth>s.month||t.groups?.length!==10||t.referencePremium?.length!==5||t.referencePremium.some(x=>!valid(x)||x===0)||!Array.isArray(t.history)||t.history.length>120)throw new Error('Повреждена квалифицированная миграция');
 for(const [i,g] of t.groups.entries())if(g.group!==i||['adults','schoolYears','unrecognizedYears','highSkilled','unrecognizedHigh'].some(k=>!valid(g[k]))||g.highSkilled>g.adults+1e-8||g.unrecognizedHigh>g.highSkilled+1e-8)throw new Error('Повреждены квалификации мигрантов');
}

export function annotateFounderOrigin(s,c,foreign){
 if(!talentActive(s)||!s.talentMigration)return;
 const eligible=sum(s.talentMigration.groups.map(g=>Math.max(0,g.highSkilled-g.unrecognizedHigh))),pool=Math.max(.01,(s.ageCohorts[1]+s.ageCohorts[2])*.15),share=clamp(eligible/pool,0,1);
 let salt=0;for(const ch of c.id)salt=(Math.imul(salt,31)+ch.charCodeAt(0))>>>0;let x=(s.seed^Math.imul(s.month+1,2654435761)^salt)>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;
 c.founderOrigin=foreign?'foreign-investor':(x>>>0)/4294967296<share?'resident-migrant':'resident';c.migrantFounderEligibility=share;
}

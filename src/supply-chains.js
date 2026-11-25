// Revision 5: reduced-form imported-input bottlenecks, not a materials ledger.
// Evidence and sensitivity choices: docs/SUPPLY-CHAINS.md. The IMF/Fed evidence
// identifies heterogeneity/critical inputs, NOT these five-sector coefficients.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const SUPPLY_ASSUMPTIONS=Object.freeze({
 // Amplification of imported share of intermediate inputs: cheap critical parts
 // can stop an assembly line. Services have less specialised physical inputs.
 criticality:Object.freeze([1.25,1.25,2.5,1.75,.5]),
 pressureMonths:2,recoveryMonths:1,adaptationMonths:6,maximumReplacement:.5,replacementPremium:.25
});
function logistics(old,shortfall){
 const a=SUPPLY_ASSUMPTIONS;
 const pressure=old.pressure+(shortfall-old.pressure)*(-Math.expm1(-1/(shortfall>old.pressure?a.pressureMonths:a.recoveryMonths)));
 // Supplier search/substitution is partial and slow, never complete immunity.
 // A normal month gradually retires costly replacement arrangements.
 const replacement=old.replacement+(shortfall*a.maximumReplacement-old.replacement)*(-Math.expm1(-1/a.adaptationMonths));
 return {pressure,replacement};
}
export function prepareSupplyChains(s,availability,matrix){
 const a=SUPPLY_ASSUMPTIONS,shortfall=clamp(1-availability/100,0,1);
 let old=s.economy.supplyChains;
 if(!old){
  old={pressure:0,replacement:0};
  // A mid-crisis migration must not grant a second grace period. Reconstruct
  // only auxiliary logistics indices from recorded external conditions; no
  // historical money, jobs, production or journal entries are changed.
  for(const entry of s.journal??[]){
   const past=entry.effectiveWorld?.importAvailability??entry.calculationTrace?.report.world?.importAvailability??100;
   old=logistics(old,clamp(1-past/100,0,1));
  }
 }
 const {pressure,replacement}=logistics(old,shortfall);
 const effectiveShortfall=Math.max(0,pressure-Math.min(pressure,replacement));
 const sectors=s.firms.map((f,i)=>{
  const domestic=matrix.reduce((v,row)=>v+row[i],0),imports=f.importCoefficient;
  const importedInputShare=imports/Math.max(1e-12,domestic+imports);
  const exposure=clamp(importedInputShare*a.criticality[i],0,1);
  return {sector:i,importedInputShare,exposure,capacityFactor:1-exposure*effectiveShortfall};
 });
 return s.economy.supplyChains={version:1,shortfall,pressure,replacement,effectiveShortfall,
  componentPriceFactor:1+replacement*a.replacementPremium,sectors};
}
export function supplySalesSignal({orders,production,physicalCapacity,normalUtilization,temporarySupply}){
 // Orders lost to temporary rationing are not disappearing demand. Do not turn
 // them into unconstrained hiring either: retain at most normal physical output.
 return temporarySupply?Math.min(orders,Math.max(production,physicalCapacity*normalUtilization)):production;
}
export function validateSupplyChains(s){
 const q=s.economy?.supplyChains;
 if(!q)return; // A migrated save initializes at its next month boundary.
 if(s.economy.revision<5||q.version!==1||['shortfall','pressure','replacement','effectiveShortfall'].some(k=>!Number.isFinite(q[k])||q[k]<0||q[k]>1)||!Number.isFinite(q.componentPriceFactor)||q.componentPriceFactor<1||q.componentPriceFactor>1.25||!Array.isArray(q.sectors)||q.sectors.length!==5||q.sectors.some((x,i)=>x.sector!==i||['importedInputShare','exposure','capacityFactor'].some(k=>!Number.isFinite(x[k])||x[k]<0||x[k]>1)))throw new Error('Повреждена модель поставок');
}

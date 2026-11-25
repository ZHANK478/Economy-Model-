// Evidence-informed mechanisms, synthetic magnitudes. No regime/GDP bonus.
// Administrative delivery areas are NOT new separately simulated economies.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((v,x)=>v+x,0);
import {regimeActive,regimeInformation,regimeCompetence} from './regime-dynamics.js';
export const LOCAL_GOV_ASSUMPTIONS=Object.freeze({effectStrength:1,transitionMonths:24,capacityMonths:48,
 staffingBaseBudget:.02,staffingDelegationBudget:.08,localScaleCost:.06,railCoordinationCost:.18,gridCoordinationCost:.15,
 centralNeedsKnowledge:.55,implementationFloor:.65,implementationCeiling:1.15});
const ELIGIBLE_SERVICE_SHARE={school:.85,health:.55};
const localShare=(g,kind)=>g.servicesShare*ELIGIBLE_SERVICE_SHARE[kind];
const AREA_PROFILES=[
 {id:'urban',population:.40,school:.85,health:1.05,roads:.9,capacityOffset:.05},
 {id:'industrial',population:.25,school:.95,health:1.10,roads:1.05,capacityOffset:0},
 {id:'rural',population:.25,school:1.20,health:.85,roads:1.15,capacityOffset:-.04},
 {id:'remote',population:.10,school:1.25,health:1.10,roads:1.35,capacityOffset:-.08}
];
export const localGovernmentActive=s=>s.localGovernment?.revision===1;
function accountability(s){
 const p=s.policy,i=s.institutions,politics=s.politics;
 const audit=clamp((Number(p.publicDisclosure)*.45+Number(p.openProcurement)*.25+.30)*i.courtCapacity);
 const voice=p.localElections?clamp((.3+.35*Number(p.freeMedia)+.35*Number(p.associationFreedom))*politics.electoralIntegrity):0;
 // External audit remains useful with appointed local officials.
 return clamp(.65*audit+.35*voice);
}
function rawDelivery(s,kind,owner){
 const g=s.localGovernment,k=g.assumptions,local=owner==='municipal',q=accountability(s);
 const needs=g.areas.map(a=>a.population*(a[kind]??a.roads)),total=sum(needs);
 const fractions=needs.map(v=>v/total),knowledge=local?1:k.centralNeedsKnowledge*(regimeActive(s)?.5+.5*regimeInformation(s)/.65:1);
 const allocations=g.areas.map((a,i)=>(1-knowledge)*a.population+knowledge*fractions[i]);
 const capacity=local?g.areas.map(a=>a.capacity):g.areas.map(()=>g.centralCapacity);
 // Service units lost to mismatch, administrative overhead and weak control.
 const scale=local?1+k.localScaleCost:1;
 const coordination=local?(kind==='rail'?k.railCoordinationCost:kind==='grid'?k.gridCoordinationCost:0):0;
 const match=sum(allocations.map((v,i)=>Math.min(v,fractions[i])));
 const control=local?q:clamp((.3+.45*Number(s.policy.publicDisclosure)+.25*Number(s.policy.openProcurement))*s.institutions.courtCapacity);
 const execution=sum(allocations.map((v,i)=>v*(.65+.35*capacity[i])))*(.9+.1*control);
 return match*execution/(scale+coordination);
}
function factor(s,kind,owner,reference){
 if(!localGovernmentActive(s))return 1;
 const k=s.localGovernment.assumptions,ratio=rawDelivery(s,kind,owner)/Math.max(.01,reference);
 return clamp(1+k.effectStrength*(ratio-1),k.implementationFloor,k.implementationCeiling);
}
export function initializeLocalGovernment(s,assumptions={}){
 if(localGovernmentActive(s))return;
 const inherited=s.month===0?(s.economy?.initial.administrativeCapacity??s.politics.civilService??.65):((s.politics.civilService??.65)+(s.institutions.soeAuditCapacity??.65))/2;
 const initial=clamp(inherited,.15,.95);
 s.localGovernment={revision:1,startMonth:s.month,assumptions:{...LOCAL_GOV_ASSUMPTIONS,...assumptions},
 centralCapacity:initial,servicesShare:s.policy.municipalServicesShare/100,infrastructureShare:s.policy.municipalInvestmentShare/100,
 areas:AREA_PROFILES.map(a=>({...a,capacity:clamp(initial+a.capacityOffset,.15,.95)})),reference:{},lastAllocation:null};
 const g=s.localGovernment;
 for(const kind of ['school','health','roads','rail','grid'])g.reference[kind]=rawDelivery(s,kind,'public');
 // Preserve current service delivery on activation; no invented historical gains.
 for(const kind of ['school','health']){const x=localShare(g,kind);g.reference[kind]=(1-x)*rawDelivery(s,kind,'public')+x*rawDelivery(s,kind,'municipal');}
 validateLocalGovernment(s);
}
export function prepareLocalGovernment(s,prev){
 if(!localGovernmentActive(s))return;
 const g=s.localGovernment,k=g.assumptions,p=s.policy,f=prev.lastReport.fiscal;
 g.servicesShare+=(p.municipalServicesShare/100-g.servicesShare)/k.transitionMonths;
 g.infrastructureShare+=(p.municipalInvestmentShare/100-g.infrastructureShare)/k.transitionMonths;
 const base=s.base.monthlyGDP*(prev.consumerPriceIndex/100);
 const workload=(g.servicesShare*2+g.infrastructureShare)/3;
 const required=base*(k.staffingBaseBudget+k.staffingDelegationBudget*workload)/100;
 const paid=f.localAdministration??(prev.month===0&&g.startMonth===0?base*p.localAdministrationBudget/100:0);
 const staffing=clamp(paid/Math.max(required,1e-9),0,1.5);
 const merit=Number(p.meritCivilService),audit=accountability(s);
 const senior=regimeActive(s)?.18*(regimeCompetence(s)-.65):0;
 const centralTarget=clamp(.45+.25*merit+.15*audit+senior,.2,.95);
 g.centralCapacity+=(centralTarget-g.centralCapacity)/k.capacityMonths;
 for(const a of g.areas){
  const target=clamp(.45+.2*merit+.15*audit+.18*(staffing-1)+a.capacityOffset+senior,.15,.95);
  a.capacity+=(target-a.capacity)/k.capacityMonths;
 }
}
export function serviceDeliveryFactor(s,kind){
 if(!localGovernmentActive(s))return 1;
 const g=s.localGovernment;
 const key=kind==='health'?'healthcare':'education';
 const settled=g.lastAllocation?.month===s.month&&s.territorialGovernment?.last?.month===s.month?g.lastAllocation[key]:null;
 const x=settled?settled.local/Math.max(1e-9,settled.local+settled.central):localShare(g,kind);
 return (1-x)*factor(s,kind,'public',g.reference[kind])+x*factor(s,kind,'municipal',g.reference[kind]);
}
export function infrastructureDeliveryFactor(s,network,owner){
 if(!localGovernmentActive(s))return 1;
 return factor(s,network,owner,s.localGovernment.reference[network]);
}
export function localPublicInvestmentPlan(s,amount,territorialShare){
 if(!localGovernmentActive(s))return null;
 const g=s.localGovernment,x=territorialShare===undefined?g.infrastructureShare:clamp(territorialShare);
 return s.networks.map(n=>({network:n.id,public:amount*n.weight*(1-x)*infrastructureDeliveryFactor(s,n.id,'public'),
 municipal:amount*n.weight*x*infrastructureDeliveryFactor(s,n.id,'municipal')}));
}
export function recordLocalServices(s,flow,territorial){
 if(!localGovernmentActive(s))return;
 const g=s.localGovernment;
 const actualShare=(key,kind)=>territorial?clamp(sum(territorial.rows.map(row=>row.byKey[key]))/Math.max(1e-9,flow[key])):localShare(g,kind);
 const healthShare=actualShare('healthcare','health'),schoolShare=actualShare('education','school');
 const allocate=(amount,kind)=>{
  const needs=g.areas.map(a=>a.population*a[kind]),total=sum(needs);
  return g.areas.map((a,i)=>({area:a.id,amount:amount*needs[i]/total}));
 };
 // Memo allocations of already paid consolidated purchases; never new transfers.
 g.lastAllocation={month:s.month,healthcare:{central:flow.healthcare*(1-healthShare),local:flow.healthcare*healthShare,
  areas:allocate(flow.healthcare*healthShare,'health'),deliveryFactor:serviceDeliveryFactor(s,'health')},
 education:{central:flow.education*(1-schoolShare),local:flow.education*schoolShare,areas:allocate(flow.education*schoolShare,'school'),deliveryFactor:serviceDeliveryFactor(s,'school')},
 administration:flow.localAdministration??0};
 flow.localGovernment=structuredClone(g.lastAllocation);
}
export function validateLocalGovernment(s){
 const g=s.localGovernment;if(g===undefined)return;
 const valid=(v,a=0,b=1)=>Number.isFinite(v)&&v>=a&&v<=b;
 if(g.revision!==1||!Number.isInteger(g.startMonth)||g.startMonth<0||g.startMonth>s.month||!valid(g.centralCapacity)||!valid(g.servicesShare)||!valid(g.infrastructureShare)||!Array.isArray(g.areas)||g.areas.length!==AREA_PROFILES.length)throw new Error('Повреждено местное управление');
 if((s.economy?.revision??0)>=20&&Math.abs(sum(g.areas.map(a=>a.population))-1)>1e-8)throw new Error('Нарушено население местных территорий');
 for(const [i,a] of g.areas.entries())if(!valid(a.capacity)||Object.entries(AREA_PROFILES[i]).some(([key,value])=>key==='population'&&(s.economy?.revision??0)>=20?!valid(a[key])||a[key]>1:a[key]!==value))throw new Error('Повреждены территории местных услуг');
 if(Object.keys(g.assumptions).length!==Object.keys(LOCAL_GOV_ASSUMPTIONS).length||Object.keys(LOCAL_GOV_ASSUMPTIONS).some(key=>!valid(g.assumptions[key],key==='effectStrength'?0:.001,key.includes('Months')?240:key==='effectStrength'?1:2)))throw new Error('Повреждены параметры местного управления');
 if(g.assumptions.centralNeedsKnowledge>1||g.assumptions.implementationFloor>1||g.assumptions.implementationCeiling<1)throw new Error('Несогласованные параметры местных услуг');
 if(['school','health','roads','rail','grid'].some(k=>!valid(g.reference[k],.01,2)))throw new Error('Повреждены исходные условия местных услуг');
 if(g.lastAllocation){
  const x=g.lastAllocation;if(!Number.isInteger(x.month)||x.month<g.startMonth||x.month>s.month||!valid(x.administration,0,Infinity))throw new Error('Повреждено исполнение местных расходов');
  for(const key of ['healthcare','education']){const a=x[key];if(!a||!valid(a.central,0,Infinity)||!valid(a.local,0,Infinity)||!valid(a.deliveryFactor,g.assumptions.implementationFloor,g.assumptions.implementationCeiling)||!Array.isArray(a.areas)||a.areas.length!==g.areas.length||a.areas.some((r,i)=>r.area!==g.areas[i].id||!valid(r.amount,0,Infinity))||Math.abs(sum(a.areas.map(r=>r.amount))-a.local)>1e-7*Math.max(1,a.local))throw new Error('Не сходятся местные расходы на услуги');}
 }

}


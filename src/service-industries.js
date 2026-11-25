// Revision 18: operating service industries inside the consolidated service
// account. These are production units with earmarked capital, NOT extra deposits
// or independent legal firms. Technology and demand coefficients are assumptions.
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const norm=a=>{const total=sum(a);return a.map(x=>total>0?x/total:1/a.length);};
export const servicesDetailed=s=>(s.economy?.revision??0)>=18;
// id, capital elasticity, skill sensitivity, labour demand intensity, input mix
// (agriculture, energy, industry, construction, services), imported input factor.
export const SERVICE_TECHNOLOGIES=[
 ['transport',.40,.6,1.1,[.1,3,1,1,.8],1.3],
 ['business',.25,1.4,1.1,[.1,.4,.5,.5,1.3],1.2],
 ['personal',.18,.6,1.4,[.5,.7,.8,.7,.9],.5],
 ['trade',.28,.7,1.1,[.5,.7,1.4,.8,.8],.9],
 ['digital',.30,1.7,.9,[.1,.65,.6,.5,1.25],1.5],
 ['financial',.25,1.5,.8,[.1,.25,.2,.6,1.5],.6],
 ['hospitality',.30,.6,1.3,[2,1.4,.8,.9,.7],.5],
 ['property',.55,.7,.5,[.1,.5,.4,2.5,.7],.2]
];
const tech=new Map(SERVICE_TECHNOLOGIES.map(x=>[x[0],x]));
const products=s=>s.productMarkets.products.filter(x=>x.sector===4);
function demandSources(s){const m=s.lastReport.market??{},deflator=Math.max(.01,s.consumerPriceIndex/100);return {consumption:Math.max(1,m.requestedConsumption??s.base.consumption),investment:Math.max(1,m.requestedInvestment??s.base.investment),business:Math.max(1,sum(s.firms.slice(0,4).map(f=>f.production))),credit:Math.max(1,(s.metrics.credit??1)/deflator),exports:Math.max(1,m.exports?sum(m.exports):s.base.exports),population:s.population};}
export function initializeServiceIndustries(s,matrix){
 if(!servicesDetailed(s)||s.serviceIndustries)return;
 const f=s.firms[4],rows=products(s),mean=i=>sum(rows.map(p=>p.demandShare*tech.get(p.id)[4][i])),imports=sum(rows.map(p=>p.demandShare*tech.get(p.id)[5])),laborShares=norm(rows.map(p=>p.capacityShare*tech.get(p.id)[3]));
 s.serviceIndustries={version:1,startedMonth:s.month,reference:{capital:f.capital,workers:f.workers,skills:s.skills,sources:demandSources(s)},assumptions:{laborAdjustment:1/12,positionSubstitution:.35},branches:rows.map((p,j)=>{const t=tech.get(p.id);return {id:p.id,name:p.name,initialShare:p.capacityShare,capital:f.capital*p.capacityShare,workers:f.workers*laborShares[j],laborShare:laborShares[j],initialLaborShare:laborShares[j],capitalElasticity:t[1],skillSensitivity:t[2],laborIntensity:t[3],inputs:matrix.map((row,i)=>row[4]*t[4][i]/mean(i)),importCoefficient:f.importCoefficient*t[5]/imports,plannedInvestmentShare:p.capacityShare,last:null};}),last:null,accounting:'Branch production, capital and flows consolidate into firms[4]; no additional cash account. Financial fees exclude loans, deposits, interest and insurance reserves.'};
}
export function serviceDemandWeights(s,rows){
 if(!servicesDetailed(s)||!s.serviceIndustries)return rows.map(p=>p.referenceShare);
 const r=s.serviceIndustries.reference.sources,n=demandSources(s),q={};for(const key of Object.keys(r))q[key]=clamp(n[key]/Math.max(1e-9,r[key]),.1,10);
 const demand={transport:.3*q.consumption+.3*q.business+.2*q.exports+.2*q.investment,business:.15*q.consumption+.45*q.investment+.4*q.business,personal:.9*q.consumption+.1*q.population,trade:.8*q.consumption+.2*q.business,digital:.35*q.consumption+.35*q.investment+.3*q.business,financial:.25*(q.consumption+q.credit+q.investment+q.business),hospitality:Math.pow(q.consumption,1.15)*Math.pow(q.exports,.15),property:.5*q.consumption+.5*q.investment};
 return rows.map(p=>p.referenceShare*demand[p.id]);
}
export function prepareServiceIndustries(s){
 if(!servicesDetailed(s)||!s.serviceIndustries)return;
 const branches=s.serviceIndustries.branches,rows=products(s),desired=norm(branches.map(c=>rows.find(p=>p.id===c.id).demandShare*c.laborIntensity));
 branches.forEach((c,i)=>{c.laborShare+=(desired[i]-c.laborShare)*s.serviceIndustries.assumptions.laborAdjustment;});
 const shares=norm(branches.map(c=>c.laborShare));branches.forEach((c,i)=>{c.laborShare=shares[i];});
 s.firms[4].importCoefficient=sum(branches.map(c=>c.importCoefficient*rows.find(p=>p.id===c.id).demandShare));
}
export function serviceInputMatrix(s,matrix){
 if(!servicesDetailed(s)||!s.serviceIndustries)return matrix;
 const rows=products(s);return matrix.map((row,i)=>row.map((v,j)=>j===4?sum(s.serviceIndustries.branches.map(c=>c.inputs[i]*rows.find(p=>p.id===c.id).demandShare)):v));
}
export function syncServiceCapital(s){
 if(!servicesDetailed(s)||!s.serviceIndustries)return;
 const rows=s.serviceIndustries.branches,total=sum(rows.map(c=>c.capital)),target=s.firms[4].capital;let used=0;
 rows.forEach((c,i)=>{c.capital=i===rows.length-1?Math.max(0,target-used):target*(total>0?c.capital/total:c.initialShare);used+=c.capital;});
}
function physical(s,workers){
 const m=s.serviceIndustries,r=m.reference,a=s.economy.parameters.capitalShare;
 const aggregate=Math.pow(Math.max(1e-12,s.firms[4].capital/r.capital),a)*Math.pow(Math.max(1e-12,workers/r.workers),1-a);
 const meanSkill=sum(m.branches.map(c=>c.initialShare*c.skillSensitivity));
 const values=m.branches.map(c=>c.initialShare*Math.pow(Math.max(0,c.capital/(r.capital*c.initialShare)),c.capitalElasticity)*Math.pow(Math.max(0,workers*c.laborShare/(r.workers*c.initialLaborShare)),1-c.capitalElasticity)*Math.pow(Math.max(.1,s.skills/r.skills),c.skillSensitivity-meanSkill));
 return {values,factor:sum(values)/Math.max(1e-12,aggregate)};
}
export function serviceTechnologyFactor(s,workers){return servicesDetailed(s)&&s.serviceIndustries?physical(s,workers).factor:1;}
export function refreshServiceCapacity(s){
 if(!servicesDetailed(s)||!s.serviceIndustries)return;
 const m=s.serviceIndustries,shares=norm(physical(s,s.firms[4].workers).values),rows=products(s);
 m.branches.forEach((c,i)=>{rows.find(p=>p.id===c.id).capacityShare=Math.max(1e-12,shares[i]);c.workers=s.firms[4].workers*c.laborShare;});
 const q=norm(rows.map(p=>p.capacityShare));rows.forEach((p,i)=>{p.capacityShare=q[i];});
}
export function planServiceInvestment(s,amount){
 if(!servicesDetailed(s)||!s.serviceIndustries)return null;
 const rows=products(s),m=s.serviceIndustries,weights=norm(m.branches.map(c=>{const p=rows.find(p=>p.id===c.id),margin=c.last?clamp(c.last.operatingProfit/Math.max(1,c.last.revenue),-.5,.5):0,shortage=clamp(p.demandShare/p.capacityShare,.25,4);return Math.max(1e-9,c.capital)*shortage*Math.exp(margin); }));
 m.branches.forEach((c,i)=>{c.plannedInvestmentShare=weights[i];c.fundedInvestment=amount*weights[i];});return {ids:m.branches.map(c=>c.id),shares:weights};
}
export function serviceProjectAllocation(s){return servicesDetailed(s)&&s.serviceIndustries?{serviceIds:s.serviceIndustries.branches.map(c=>c.id),serviceShares:s.serviceIndustries.branches.map(c=>c.plannedInvestmentShare)}:{};}
export function completeServiceCapital(s,amount,project){
 if(!servicesDetailed(s)||!s.serviceIndustries)return;
 const rows=s.serviceIndustries.branches;
 // Capital was added to the parent by the engine. Allocate the very same asset,
 // never a second completion; old paid projects use their inherited stock mix.
 const old=sum(rows.map(c=>c.capital)),weights=project.serviceIds?rows.map(c=>project.serviceShares[project.serviceIds.indexOf(c.id)]??0):rows.map(c=>old>0?c.capital/old:c.initialShare);
 rows.forEach((c,i)=>{c.capital+=amount*weights[i];});syncServiceCapital(s);refreshServiceCapacity(s);
}
export function settleServiceIndustries(s,{revenue,inputCost,payroll,depreciation,interest,operatingProfit,sectorValueAdded,componentPrice,prices}){
 if(!servicesDetailed(s)||!s.serviceIndustries)return;
 const rows=products(s),m=s.serviceIndustries,branches=m.branches;
 const direct=branches.map(c=>{const p=rows.find(p=>p.id===c.id);return p.production*(sum(c.inputs.map((v,i)=>v*prices[i]))+c.importCoefficient*componentPrice*(1+s.policy.tariff/100));});
 const extras=inputCost-sum(direct),capital=sum(branches.map(c=>c.capital)),labor=sum(branches.map(c=>c.workers));let usedVA=0;
 branches.forEach((c,i)=>{const p=rows.find(p=>p.id===c.id),share=p.demandShare,pay=payroll*(labor>0?c.workers/labor:share),wear=depreciation*(capital>0?c.capital/capital:share),inputs=direct[i]+extras*share;
  const valueAdded=i===branches.length-1?sectorValueAdded-usedVA:p.production*(prices[4]-sum(c.inputs.map((v,j)=>v*prices[j]))-c.importCoefficient*componentPrice*(1+s.policy.tariff/100));usedVA+=valueAdded;
  c.last={month:s.month,revenue:p.revenue,inputCost:inputs,payroll:pay,depreciation:wear,interest:interest*share,operatingProfit:p.revenue-inputs-pay-wear-interest*share,valueAdded,capital:c.capital,workers:c.workers,production:p.production,capacity:p.capacity,price:p.price,paidInvestment:(s.firms[4].lastInvestment??0)*c.plannedInvestmentShare};
  p.last.inputCost=inputs;p.last.valueAdded=valueAdded;const report=s.lastReport.products.find(x=>x.id===p.id);report.inputCost=inputs;report.valueAdded=valueAdded;
 });
 m.last={month:s.month,branches:branches.map(c=>({id:c.id,name:c.name,...c.last})),fundingAccount:'firms[4]',banking:{credit:s.metrics.credit,deposits:s.metrics.deposits,lendingRate:s.metrics.lendingRate,bankEquity:s.bank.equity},accounting:m.accounting};s.lastReport.serviceIndustries=m.last;
}
export function validateServiceIndustries(s){
 if(!servicesDetailed(s))return;
 const m=s.serviceIndustries;if(!m||m.version!==1||!Number.isInteger(m.startedMonth)||m.startedMonth>s.month||m.branches?.length!==8||new Set(m.branches.map(c=>c.id)).size!==8)throw new Error('Повреждены отрасли услуг');
 for(const c of m.branches)if(!tech.has(c.id)||['initialShare','initialLaborShare','capital','workers','laborShare','capitalElasticity','skillSensitivity','laborIntensity','importCoefficient','plannedInvestmentShare'].some(k=>!Number.isFinite(c[k])||c[k]<0)||c.inputs?.length!==5||c.inputs.some(x=>!Number.isFinite(x)||x<0))throw new Error('Повреждена отрасль услуг '+c.id);
 const near=(a,b)=>Math.abs(a-b)<Math.max(1e-6,Math.abs(b)*1e-8);
 if(!near(sum(m.branches.map(c=>c.capital)),s.firms[4].capital)||!near(sum(m.branches.map(c=>c.laborShare)),1))throw new Error('Нарушена консолидация капитала услуг: '+JSON.stringify({month:s.month,branches:sum(m.branches.map(c=>c.capital)),parent:s.firms[4].capital,labor:sum(m.branches.map(c=>c.laborShare))}));
 for(const p of s.projects.filter(p=>p.serviceIds!==undefined))if(p.type!=='private'||p.sector!==4||!Array.isArray(p.serviceShares)||p.serviceShares.length!==p.serviceIds.length||new Set(p.serviceIds).size!==p.serviceIds.length||p.serviceIds.some(id=>!tech.has(id))||p.serviceShares.some(x=>!Number.isFinite(x)||x<0)||!near(sum(p.serviceShares),1))throw new Error('Повреждены получатели инвестиций услуг');
}
export function serviceIndustriesView(s,{n}){
 if(!s.serviceIndustries?.last)return '';
 return `<details class="country-subdetail"><summary>Отрасли услуг</summary><div class="small">Добавленная стоимость — млн национальной валюты в месяц.</div><table><thead><tr><th>Отрасль</th><th>Добавленная стоимость</th><th>Занятые, тыс.</th></tr></thead><tbody>${s.serviceIndustries.last.branches.map(c=>`<tr><td>${c.name}</td><td>${n(c.valueAdded,1)}</td><td>${n(c.workers*1000,1)}</td></tr>`).join('')}</tbody></table></details>`;
}

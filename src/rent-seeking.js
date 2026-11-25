// Revision 22. Transfers and administrative obstruction, never a GDP haircut.
import {sectorCompanies} from './enterprise-market.js';
import {recordOwnerRent,ownerRentCash} from './wealth-owners.js';
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const rentSeekingActive=s=>(s.economy?.revision??0)>=22;
const draw=(s,id,salt=0)=>{let h=(s.seed^Math.imul(s.month+1,2654435761)^salt)>>>0;for(const ch of id)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;h^=h>>>16;h=Math.imul(h,2246822519);h^=h>>>13;return (h>>>0)/4294967296;};
const businesses=s=>s.firms.flatMap((f,i)=>sectorCompanies(s,i).length?sectorCompanies(s,i):[f]);
export function initializeRentSeeking(s){
 if(!rentSeekingActive(s)||s.rentSeeking)return;
 s.rentSeeking={version:1,startedMonth:s.month,assumptions:{connectedShare:.25,contractRentShare:.025,permitRentShare:.01,permitDelayMonths:2,auditBase:.005,auditIntensity:.12,auditCostGDPShare:.00001,courtCaseCostGDPShare:.00002,caseDelayMonths:3,fineMultiplier:1,deterrenceMonths:36},connections:{},cases:[],nextCase:1,totals:{rents:0,recovered:0,fines:0,detected:0},referenceRiskPremium:s.parameters.politicalRiskSensitivity*s.politics.corruption,perceivedRisk:0,last:{},history:[]};
}
export function rentConditions(s){
 const p=s.policy,i=s.institutions,a=s.rentSeeking.assumptions;
 const audit=clamp(i.soeAuditCapacity*Number(p.independentSoeAudit)),information=clamp(.25+.45*Number(p.publicDisclosure)+.30*s.politics.mediaFreedom),enforcement=clamp(i.courtCapacity*s.politics.judicialIndependence);
 const risk=clamp((.04+.18*(1-s.politics.civilService)+.10*(1-Number(p.openProcurement))+.08*clamp(p.patronageBudget/2))*(1-audit*enforcement*information));
 return {audit,information,enforcement,risk,auditProbability:clamp(a.auditBase+a.auditIntensity*audit*information)};
}
function connection(s,c){
 const d=s.rentSeeking;if(!d.connections[c.id])d.connections[c.id]={connected:draw({...s,month:0},c.id,71)<d.assumptions.connectedShare,recipient:4+Math.floor(draw({...s,month:0},c.id,83)*6),sanctionUntil:-1};
 return d.connections[c.id];
}
export function prepareRentSeeking(s){
 if(!rentSeekingActive(s))return;initializeRentSeeking(s);s.rentSeeking.last={rents:0,recovered:0,fines:0,detected:0,permitDelays:0,permitDecisions:[],operations:[],caseUpdates:[],conditions:rentConditions(s)};
 for(const c of businesses(s))connection(s,c);
}
function payRent(s,c,amount,kind,base){
 const d=s.rentSeeking,link=connection(s,c),paid=Math.min(Math.max(0,c.cash)*.10,Math.max(0,amount));if(!(paid>1e-9))return 0;
 c.cash-=paid;s.households[link.recipient].cash+=paid;recordOwnerRent(s,link.recipient,paid);
 c.lastProfit-=paid;if(c.last)c.last.illicitTransfer=(c.last.illicitTransfer??0)+paid;
 const entry={id:d.nextCase++,month:s.month,company:c.id,recipient:link.recipient,kind,exposure:base,paid,status:'unobserved',detectedMonth:null,due:null,recovered:0,finePaid:0};d.cases.push(entry);d.last.operations.push({...entry});d.last.rents+=paid;d.totals.rents+=paid;return paid;
}
export function settleRentSeeking(s,flow,governmentOrders,householdIncome,householdSources,events){
 if(!rentSeekingActive(s))return;const d=s.rentSeeking,a=d.assumptions,q=rentConditions(s),all=businesses(s);
 // Existing paid government orders are exposure, not additional spending.
 for(const [sector,f] of s.firms.entries()){
  const rows=sectorCompanies(s,sector).length?sectorCompanies(s,sector):[f],revenues=sum(rows.map(c=>Math.max(0,c.lastRevenue)));
  for(const c of rows){if(c.active===false)continue;const link=connection(s,c),deterrence=s.month<link.sanctionUntil?.2:1,exposure=Math.min(Math.max(0,c.lastRevenue),governmentOrders[sector]*(revenues>0?Math.max(0,c.lastRevenue)/revenues:0));
   if(exposure>0&&draw(s,c.id,101)<q.risk*deterrence)payRent(s,c,exposure*a.contractRentShare,'procurement-kickback',exposure);
  }
 }
 // Once per new funded project: refusal/insufficient funds delays permits;
 // a paid bribe is a transfer, not a faster production technology.
 for(const p of s.projects.filter(p=>p.type==='private'&&!p.legacy&&!p.integrityChecked&&p.createdMonth===s.month)){
  p.integrityChecked=true;const ids=p.firmIds??p.enterpriseIds,shares=p.firmShares??p.enterpriseShares,rows=ids?all.filter(c=>ids.includes(c.id)):[s.firms[p.sector]];
  for(const c of rows){const link=connection(s,c),share=ids?(shares[ids.indexOf(c.id)]??0):1;if(c.active===false||share<=0||s.month<link.sanctionUntil||draw(s,c.id+'-'+p.due,131)>=q.risk*clamp(s.policy.registrationProcedures/6,0,2))continue;
   const exposure=p.amount*share*(s.metrics.investmentPrice??1),request=exposure*a.permitRentShare*(link.connected?.5:1),paid=payRent(s,c,request,'permit-extortion',exposure);
   const delay=paid<request*.99&&!link.connected?a.permitDelayMonths:0;if(delay){p.due+=delay;p.integrityDelay=(p.integrityDelay??0)+delay;d.last.permitDelays++;}d.last.permitDecisions.push({company:c.id,connected:link.connected,requested:request,paid,delay});
  }
 }
 const income=s.households.map(()=>0);for(const op of d.last.operations)income[op.recipient]+=op.paid;
 income.forEach((n,i)=>{householdIncome[i]+=n;householdSources[i].rents=(householdSources[i].rents??0)+n;});
 let auditSlots=Math.floor(Math.max(0,flow.soeAudits??0)/Math.max(.01,s.consumerPriceIndex/100)/Math.max(1e-9,s.base.monthlyGDP*a.auditCostGDPShare)),courtSlots=Math.floor(Math.max(0,flow.courts??0)/Math.max(.01,s.consumerPriceIndex/100)/Math.max(1e-9,s.base.monthlyGDP*a.courtCaseCostGDPShare));d.last.auditSlots=auditSlots;d.last.courtSlots=courtSlots;
 for(const c of d.cases){
  if(c.status==='unobserved'&&auditSlots>0&&s.month>c.month&&draw(s,String(c.id),173)<q.auditProbability){auditSlots--;c.status='investigating';c.detectedMonth=s.month;c.due=s.month+a.caseDelayMonths;d.last.detected++;d.totals.detected++;d.last.caseUpdates.push({...c});}
  if(c.status==='investigating'&&s.month>=c.due){
   if(courtSlots<=0){c.due++;continue;}courtSlots--;
   if(draw(s,String(c.id),199)<q.enforcement){const h=s.households[c.recipient],available=Math.max(0,Math.min(h.cash,ownerRentCash(s,c.recipient))),recover=Math.min(c.paid,available*.25),fine=Math.min(c.paid*a.fineMultiplier,Math.max(0,available-recover)*.10);h.cash-=recover+fine;s.government.cash+=recover+fine;recordOwnerRent(s,c.recipient,-recover-fine);c.recovered=recover;c.finePaid=fine;c.status='adjudicated';const defendant=all.find(x=>x.id===c.company)??(c.company==='agriculture'?all.find(x=>x.agricultureProtectionClaim):null);connection(s,defendant??{id:c.company}).sanctionUntil=s.month+a.deterrenceMonths;d.last.recovered+=recover;d.last.fines+=fine;d.totals.recovered+=recover;d.totals.fines+=fine;}
   else {c.status='dismissed';}d.last.caseUpdates.push({...c});
  }
 }
 flow.integrityReceipts=(flow.integrityReceipts??0)+d.last.recovered+d.last.fines;
 const visible=sum(d.cases.filter(c=>c.detectedMonth!==null&&s.month-c.detectedMonth<12).map(c=>c.paid));d.perceivedRisk+=.05*(clamp(visible/Math.max(1,s.metrics.nominalGDPAnnual)*100)-d.perceivedRisk);
 d.cases=d.cases.filter(c=>['unobserved','investigating'].includes(c.status)||s.month-c.month<120).slice(-720);
 if(d.last.detected>0)events.push(`Проверки выявили подозрительные платежи: ${d.last.detected}. Судебное решение требует времени и независимого исполнения.`);
 for(const [i,f] of s.firms.entries())if(sectorCompanies(s,i).length)f.lastProfit=sum(sectorCompanies(s,i).map(c=>c.lastProfit));
 d.history.push({month:s.month,rents:d.last.rents,recovered:d.last.recovered,fines:d.last.fines,detected:d.last.detected,permitDelays:d.last.permitDelays});d.history=d.history.slice(-120);
}
export function validateRentSeeking(s){
 if(!rentSeekingActive(s))return;const d=s.rentSeeking;if(!d||d.version!==1||d.startedMonth>s.month||!Number.isInteger(d.startedMonth)||!Array.isArray(d.cases)||d.cases.length>720||!Array.isArray(d.history)||d.history.length>120)throw new Error('Повреждён учёт нарушений');
 if(Object.values(d.assumptions).some(x=>!Number.isFinite(x)||x<0)||d.assumptions.contractRentShare>1||d.assumptions.permitRentShare>1)throw new Error('Повреждены допущения контроля');for(const c of d.cases)if(!Number.isInteger(c.id)||!Number.isInteger(c.recipient)||c.recipient<0||c.recipient>9||!['unobserved','investigating','adjudicated','dismissed'].includes(c.status)||['paid','exposure','recovered','finePaid'].some(k=>!Number.isFinite(c[k])||c[k]<0)||c.recovered>c.paid+1e-8)throw new Error('Повреждено дело о нарушении');
 for(const n of Object.values(d.totals))if(!Number.isFinite(n)||n<0)throw new Error('Повреждены суммы нарушений');
}

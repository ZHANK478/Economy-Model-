import {validateLivelihoods} from './livelihoods.js';
import {validateRentSeeking} from './rent-seeking.js';
import {validateDurables} from './durable-goods.js';
import {validateFirmMarkets} from './firm-markets.js';
import {validateTalent} from './talent-migration.js';
import {validateInternationalCapital} from './international-capital.js';
import {validateOwners} from './wealth-owners.js';
import {validateSettlements} from './settlements.js';
import {validateLaborDistribution} from './labor.js';
import {NETWORKS} from './infrastructure.js';

// Validate physical/institutional stocks as well as the financial identities.
export function validateExtendedState(s){validateRentSeeking(s);validateDurables(s);validateLivelihoods(s);
  validateLaborDistribution(s);validateFirmMarkets(s);validateTalent(s);validateInternationalCapital(s);validateOwners(s);validateSettlements(s);
  const number=(v,min=0,max=Infinity)=>Number.isFinite(v)&&v>=min&&v<=max;
  const close=(a,b)=>Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-10);
  const fail=message=>{throw new Error(message);};
  if(!Array.isArray(s.networks)||s.networks.length!==NETWORKS.length)fail('Повреждён инфраструктурный фонд');
  for(const [i,n] of s.networks.entries()){
    const def=NETWORKS[i];
    if(n.id!==def.id||n.sector!==def.sector||n.weight!==def.weight||!['public','municipal','private','concession','fee'].every(k=>number(n[k]))
      ||!number(n.maintenanceCoverage,0,1)||!number(n.privateMaintenanceCoverage,0,1)||!Array.isArray(n.contracts))fail('Повреждена инфраструктурная сеть');
    if(n.contracts.some(c=>!number(c.remaining)||!number(c.guarantee,0,1)||!number(c.promisedAnnual,0,1)||!Number.isInteger(c.end)||c.end<=s.month)
      ||!close(n.contracts.reduce((v,c)=>v+c.remaining,0),n.concession))fail('Повреждены концессионные договоры');
  }
  const physical=s.networks.reduce((v,n)=>v+n.public+n.municipal+n.private+n.concession,0);
  if(!number(s.infrastructure,1e-9)||!close(s.infrastructure,physical))fail('Нарушен баланс инфраструктурных фондов');
  for(const [i,f] of s.firms.entries()){
    const corporate=s.networks.filter(n=>n.sector===i).reduce((v,n)=>v+n.private+n.concession,0),a=f.labor;
    if(!close(f.infrastructureCapital,(s.economy?.revision??0)>=13?0:corporate))fail('Нарушен учёт инфраструктуры оператора');
    if(!a||!['density','coverage','power','strikeShare','turnover'].every(k=>number(a[k],0,1))||!number(a.wageFactor,.01)||!number(f.referenceWage,1e-9))fail('Повреждены трудовые отношения');
  }
  const a=s.services;
  if(!a||!['publicHealthCapacity','publicEducationCapacity'].every(k=>number(a[k],0,(s.economy?.revision??0)>=6?Infinity:2))||!['publicHealthDelivered','publicEducationDelivered'].every(k=>number(a[k],0,2))
    ||!['healthCoverage','educationCoverage','childcareAccess'].every(k=>number(a[k],0,1))||!number(a.housingBurden,0)
    ||!['healthByGroup','educationByGroup'].every(k=>Array.isArray(a[k])&&a[k].length===10&&a[k].every(v=>number(v,0,1))))fail('Повреждены социальные услуги');
  const p=s.politics;
  if(!p||!['judicialIndependence','mediaFreedom','electoralIntegrity','legislativeConstraint','civilFreedom','civilService','corruption','publicSupport','parliamentSupport'].every(k=>number(p[k],0,1))
    ||!Array.isArray(p.elections)||!Array.isArray(p.lastReview)||!Number.isInteger(p.nextElection)||p.nextElection<=s.month)fail('Повреждены политические институты');
  if(!s.monetary||!number(s.monetary.effectiveRate,0,100)||!number(s.monetary.peg,1e-12)||s.monetary.previousRegime!==s.policy.monetaryRegime)fail('Повреждён денежный режим');
  if(!Array.isArray(s.projects)||s.projects.some(p=>!['public','private','network',...((s.economy?.revision??0)>=12?['agriculture']:[]),...((s.economy?.revision??0)>=9?['housing']:[])].includes(p.type)||!number(p.amount)||!number(p.efficiency,0,1)||(p.importShare!==undefined&&!number(p.importShare,0,1))
    ||!Number.isInteger(p.due)||p.due<=s.month||(!['public','agriculture'].includes(p.type)&&(!Number.isInteger(p.sector)||p.sector<0||p.sector>4))
    ||(p.type==='housing'&&(typeof p.public!=='boolean'||p.sector!==4))
    ||(p.type==='network'&&(!NETWORKS.some(n=>n.id===p.network)||!['private','concession'].includes(p.owner)||!number(p.guarantee,0,1)))))fail('Повреждён реестр строящихся объектов');
  for(const project of s.projects.filter(p=>p.enterpriseShares!==undefined)){if((s.economy?.revision??0)<16||project.type!=='private'||project.sector!==2||!Array.isArray(project.enterpriseShares)||(project.enterpriseIds?project.enterpriseShares.length!==project.enterpriseIds.length:project.enterpriseShares.length!==4)||project.enterpriseShares.some(q=>!number(q,0,1))||Math.abs(project.enterpriseShares.reduce((a,b)=>a+b,0)-1)>1e-8)fail('Повреждены инвестиции предприятий');}
  for(const project of s.projects.filter(p=>p.enterpriseIds!==undefined))if((s.economy?.revision??0)<17||!Array.isArray(project.enterpriseIds)||new Set(project.enterpriseIds).size!==project.enterpriseIds.length||project.enterpriseIds.some(id=>!s.enterpriseMarket.companies.some(c=>c.id===id)))fail('Повреждены получатели капитала');
  for(const project of s.projects.filter(p=>p.localPlan!==undefined)){
    const plan=project.localPlan;
    if(!s.localGovernment||project.type!=='public'||!Array.isArray(plan)||plan.length!==NETWORKS.length||plan.some((r,i)=>r.network!==NETWORKS[i].id||!number(r.public)||!number(r.municipal))||plan.reduce((v,r)=>v+r.public+r.municipal,0)>project.amount*s.localGovernment.assumptions.implementationCeiling+1e-7)fail('Повреждено распределение инфраструктурного проекта');
  }

}

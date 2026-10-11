import {NETWORKS} from './infrastructure.js';

// Validate physical/institutional stocks as well as the financial identities.
export function validateExtendedState(s){
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
    if(!close(f.infrastructureCapital,corporate))fail('Нарушен учёт инфраструктуры оператора');
    if(!a||!['density','coverage','power','strikeShare','turnover'].every(k=>number(a[k],0,1))||!number(a.wageFactor,.01)||!number(f.referenceWage,1e-9))fail('Повреждены трудовые отношения');
  }
  const a=s.services;
  if(!a||!['publicHealthCapacity','publicEducationCapacity','publicHealthDelivered','publicEducationDelivered'].every(k=>number(a[k],0,2))
    ||!['healthCoverage','educationCoverage','childcareAccess','housingBurden'].every(k=>number(a[k],0,1))
    ||!['healthByGroup','educationByGroup'].every(k=>Array.isArray(a[k])&&a[k].length===10&&a[k].every(v=>number(v,0,1))))fail('Повреждены социальные услуги');
  const p=s.politics;
  if(!p||!['judicialIndependence','mediaFreedom','electoralIntegrity','legislativeConstraint','civilFreedom','civilService','corruption','publicSupport','parliamentSupport'].every(k=>number(p[k],0,1))
    ||!Array.isArray(p.elections)||!Array.isArray(p.lastReview)||!Number.isInteger(p.nextElection)||p.nextElection<=s.month)fail('Повреждены политические институты');
  if(!s.monetary||!number(s.monetary.effectiveRate,0,100)||!number(s.monetary.peg,1e-12)||s.monetary.previousRegime!==s.policy.monetaryRegime)fail('Повреждён денежный режим');
  if(!Array.isArray(s.projects)||s.projects.some(p=>!['public','private','network'].includes(p.type)||!number(p.amount)||!number(p.efficiency,0,1)
    ||!Number.isInteger(p.due)||p.due<=s.month||(p.type!=='public'&&(!Number.isInteger(p.sector)||p.sector<0||p.sector>4))
    ||(p.type==='network'&&(!NETWORKS.some(n=>n.id===p.network)||!['private','concession'].includes(p.owner)||!number(p.guarantee,0,1)))))fail('Повреждён реестр строящихся объектов');
}

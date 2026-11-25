import {clamp,clone,hash,logistic} from './political-config.js';
import {leaderName} from './leader-names.js';

// Evidence selects mechanisms, not the numbers below. No regime label enters
// an output, productivity, investment or survival multiplier. See the report.
export const REGIME_ASSUMPTIONS=Object.freeze({
 version:1,capacityMonths:36,organizationMonths:60,appointmentMonths:60,
 grievanceMonths:9,mobilizationMonths:6,backlashMonths:24,successionMonths:18,
 securityReferenceGDP:.35,securitySaturation:.95,councilThreshold:.5,
 uncertaintyPremium:.04,localLostHours:.02,nationalLostHours:.08,conflictLostHours:.15,
 mortalityAt55:.004,mortalityDoublingYears:9,transitionMonths:18,
 crisisHazardScale:.006,protestHazardScale:.004
});
export const REGIME_POLICY_KEYS=['successionProcedure','eliteRecruitment','securityGovernance','censorshipScope','businessAccess','protestResponse'];
export function regimePolicyDefaults(type){return {
 successionProcedure:type==='party'||type==='military'?'council':type==='personalist'?'designation':'elections',
 eliteRecruitment:type==='personalist'?'personal':'balanced',
 securityGovernance:type==='military'?'collegial':type==='personalist'?'parallel':'professional',
 censorshipScope:type==='personalist'?'blanket':'complaints',
 businessAccess:type==='party'?'connections':'open',protestResponse:'tolerate'
};}
export const regimeActive=s=>s.politics?.regimeDynamics?.revision===1;
const closed=s=>!s.policy.competitiveElections;
const sum=a=>a.reduce((v,x)=>v+x,0);
const mean=a=>sum(a)/Math.max(1,a.length);
const rate=(annual)=>1-Math.pow(1-clamp(annual,0,.95),1/12);
const approach=(v,target,months)=>clamp(v+(target-v)/months);
const own=s=>s.politics.parties.find(x=>x.id===s.politics.executive.playerParty);
const tell=(s,type,text,events)=>{
 const r=s.politics.regimeDynamics,id=`regime:${s.month}:${type}`;
 if(r.notices.some(n=>n.id===id))return;
 r.notices.push({id,month:s.month,type,text});r.notices=r.notices.slice(-40);events?.push(text);
};
export function initializeRegimeDynamics(s,{assumptions={},rules=null}={}){
 if(!s.politics.enabled||regimeActive(s))return;
 const p=s.politics,type=p.constitution.regime;
 const defaults=rules??regimePolicyDefaults(type);
 for(const key of REGIME_POLICY_KEYS)if(rules||!Object.hasOwn(p.lawPolicy,key)){
  s.policy[key]=defaults[key];p.lawPolicy[key]=defaults[key];
 }
 const initial={personalist:[.80,.35,.30,.62,.15],party:[.28,.82,.50,.78,.65],military:[.25,.35,.85,.72,.55],hybrid:[.40,.50,.55,.62,.45],democracy:[.15,.60,.35,.70,.75]}[type];
 const [personalControl,partyOrganization,militaryAutonomy,eliteCohesion,successionReadiness]=initial;
 const name=p.executive.presidentName??(p.executive.role==='president'?own(s).candidateName:own(s).leader);
 p.regimeDynamics={revision:1,startedMonth:s.month,foundingType:type,assumptions:{...REGIME_ASSUMPTIONS,...assumptions},
  activation:{month:s.month,rules:Object.fromEntries(REGIME_POLICY_KEYS.map(k=>[k,s.policy[k]]))},
  evidence:{report:'docs/AUTHORITARIAN-INSTITUTIONS.md',status:'Mechanisms informed by research; numerical parameters are scenario assumptions',sources:['10.1017/S1537592714000851','10.1111/j.1540-5907.2009.00382.x','10.1146/annurev-polisci-032211-213418','When Dictators Die (2016)','10.1016/j.jce.2011.04.002','10.1017/S0003055413000014','10.1111/ajps.12065','10.1111/jeea.12124','10.1017/9781009507967','10.1017/S1537592715003217','10.1007/s11127-025-01316-y','10.1086/700936','10.1257/aer.102.6.3059','10.1257/aer.102.6.3077','10.3386/w34093']},
  personalControl,partyOrganization,militaryAutonomy,eliteCohesion,successionReadiness,
  securityCapacity:.60,securityCohesion:.70,rankLoyalty:.65,informationQuality:.65,administrativeCompetence:.65,
  capture:0,independentBusiness:.4,backlash:0,fear:0,nationalMobilization:0,politicalDemands:0,electoralDispute:0,armedConflict:0,lostWorkFraction:0,
  leader:{name,ageMonths:Math.floor((45+hash(s.seed,'regime-age')*15)*12),startedMonth:s.month,generation:0,history:[]},
  successor:null,successionCrisis:0,crisisSince:null,civilianDemand:0,transition:null,transitionCooldown:s.month,
  cadres:Array.from({length:4},(_,i)=>({id:i,competence:.65,loyalty:.65,appointedMonth:s.month})),
  regions:Array.from({length:4},(_,i)=>({id:i,weight:[.40,.25,.25,.10][i],grievance:.2,mobilization:0,localPower:.3})),
  eliteGrievances:{party:0,administration:0,security:0,business:0},
  lastElectionId:null,last:null,notices:[],effectiveType:type,regimeEnded:false
 };
 validateRegimeDynamics(s);
}

export function regimeCouncil(s){
 if(!regimeActive(s)||!closed(s))return {kind:null,power:0};
 const r=s.politics.regimeDynamics;
 const party=r.partyOrganization*(1-r.personalControl),officers=r.militaryAutonomy*(1-r.personalControl);
 return officers>party?{kind:'officers',power:officers}:{kind:'party',power:party};
}
// A council veto has a substantive constituency and a recorded explanation.
// Ordinary changes unrelated to its interests are not randomly blocked.
export function reviewRegimeBill(s,b,events=[]){
 if(!regimeActive(s)||b.regimeReview)return b.regimeReview?.accepted!==false;
 const p=s.politics,r=p.regimeDynamics,council=regimeCouncil(s),old=p.lawPolicy,patch=b.patch;
 const losses={party:0,administration:0,security:0,business:0};
 const cut=key=>Math.max(0,(old[key]??0)-(patch[key]??old[key]??0))/Math.max(.1,old[key]??0);
 losses.party+=.55*cut('patronageBudget');losses.security+=.55*cut('securityBudget')+.55*cut('militaryBudget');
 if(patch.eliteRecruitment&&patch.eliteRecruitment!==old.eliteRecruitment){losses.party+=.20;losses.administration+=.12;}
 if(patch.securityGovernance==='parallel'&&old.securityGovernance!=='parallel')losses.security+=.45;
 if(patch.successionProcedure==='designation'&&old.successionProcedure!=='designation'){losses.party+=.35;losses.security+=.30;}
 if(patch.businessAccess==='open'&&old.businessAccess==='connections'){losses.party+=.30*r.capture;losses.business+=.12*r.capture;}
 if(patch.competitiveElections===true&&!old.competitiveElections){losses.party+=.3;losses.security+=.2;}
 const weights=council.kind==='officers'?{party:.10,administration:.15,security:.65,business:.10}:{party:.60,administration:.20,security:.10,business:.10};
 const votes=Object.keys(weights).map(k=>({bloc:k,weight:weights[k],loyalty:p.elites[k],loss:losses[k],support:clamp(p.elites[k]+.10-losses[k]-r.eliteGrievances[k])}));
 const support=sum(votes.map(v=>v.weight*v.support));
 const accepted=council.power<.35||support>=r.assumptions.councilThreshold||Math.max(...Object.values(losses))<.01;
 b.regimeReview={month:s.month,...council,support,required:r.assumptions.councilThreshold,accepted,votes,losses};
 if(!accepted){b.status='rejected';tell(s,'council-veto-'+b.id,`${council.kind==='officers'?'Совет офицеров':'Руководящий совет партии'} отклонил «${b.title}»: пакет затрагивает его полномочия или ресурсы.`,events);}
 return accepted;
}
export function applyRegimeBill(s,b){
 if(!regimeActive(s)||b.regimeEffectApplied)return;
 if(!b.regimeReview)reviewRegimeBill(s,b);
 if(b.regimeReview.accepted===false)return;
 const r=s.politics.regimeDynamics;
 for(const [key,loss] of Object.entries(b.regimeReview.losses))r.eliteGrievances[key]=clamp(r.eliteGrievances[key]+loss*.25);
 b.regimeEffectApplied=true;
}

export function regimeAction(s,action,events=[]){
 if(!regimeActive(s))throw new Error('Новые правила институтов включатся после следующего месяца.');
 const p=s.politics,r=p.regimeDynamics;
 if(action==='successorAgreement'){
  if(!closed(s))throw new Error('При конкурентных выборах преемника определяют выборы.');
  if(r.successor&&s.month-r.successor.agreedMonth<12)throw new Error('Соглашение уже действует; поддержка накапливается постепенно.');
  r.successor={name:leaderName(s.seed,'regime-successor-'+r.leader.generation,new Set([r.leader.name,...r.leader.history.map(x=>x.name)])),agreedMonth:s.month};
  r.eliteGrievances.party=clamp(r.eliteGrievances.party+.05*r.personalControl);
  tell(s,'successor-agreement','Начато согласование преемника. Объявление имени само по себе не гарантирует признания его полномочий.',events);return;
 }
 if(action==='handover'){
  if(!closed(s)||!r.successor&&s.policy.successionProcedure==='designation')throw new Error('Сначала согласуйте преемника.');
  if(s.month-r.leader.startedMonth<12)throw new Error('После смены руководителя требуется год для нового соглашения.');
  transferLeader(s,'voluntary',events);return;
 }
 if(action==='civilianTransition'){
  if(!closed(s)||regimeCouncil(s).kind!=='officers'||r.militaryAutonomy<.5||r.personalControl>.65)throw new Error('Для пакта нужен самостоятельный совет офицеров, а не личная армия руководителя.');
  if(r.transition||s.month<r.transitionCooldown)throw new Error('Переход уже обсуждается или действует срок после срыва пакта.');
  r.transition={startedMonth:s.month,progress:0,status:'negotiating'};
  tell(s,'civilian-pact','Предложен пакт о гражданском правлении. Совет оценивает исполнение военного бюджета, своё единство и соблюдение договорённостей; выборы ещё не назначены.',events);return;
 }
 if(action==='cancelTransition'){
  if(!r.transition||r.transition.status==='completed')throw new Error('Нет незавершённого пакта.');
  r.transition=null;r.transitionCooldown=s.month+24;r.electoralDispute=clamp(r.electoralDispute+.25);
  r.eliteGrievances.security=clamp(r.eliteGrievances.security+.2);p.executive.legalExposure++;
  tell(s,'civilian-pact-broken','Пакт о передаче власти отменён. Нарушение соглашения увеличило недоверие офицеров и политический конфликт.',events);return;
 }
 throw new Error('Неизвестное институциональное действие');
}
function transferLeader(s,reason,events){
 const p=s.politics,r=p.regimeDynamics,a=r.assumptions,leader=r.leader;
 const council=regimeCouncil(s),agreement=r.successor?clamp((s.month-r.successor.agreedMonth)/a.successionMonths):0;
 const recognition=clamp(.15+.45*r.successionReadiness+.25*r.eliteCohesion+.15*Math.max(council.power,agreement));
 const disputed=hash(s.seed,'regime-succession',s.month,leader.generation)>recognition;
 leader.history.push({name:leader.name,startedMonth:leader.startedMonth,endedMonth:s.month,reason,ageMonths:leader.ageMonths,disputed});
 leader.generation++;leader.name=r.successor?.name??leaderName(s.seed,'regime-council-'+leader.generation,new Set(leader.history.map(x=>x.name)));
 leader.ageMonths=Math.floor((42+hash(s.seed,'successor-age',leader.generation)*16)*12);leader.startedMonth=s.month;
 r.successor=null;r.successionReadiness*=.6;
 r.personalControl*=.65;r.successionCrisis=disputed?clamp(1-recognition):0;r.crisisSince=disputed?s.month:null;
 p.executive.presidentName=leader.name;own(s).leader=leader.name;
 if(p.executive.role==='president')own(s).candidateName=leader.name;
 tell(s,'succession',`${reason==='death'?'Руководитель умер естественной смертью.':'Состоялась передача руководства.'} ${leader.name} ${disputed?'стал преемником, но часть элит оспаривает распределение полномочий.':'признан правящей коалицией; режим продолжает существовать.'}`,events);
}
function recruit(s){
 const r=s.politics.regimeDynamics,a=r.assumptions,rule=s.policy.eliteRecruitment;
 for(const c of r.cadres)if(hash(s.seed,'cadre-turnover',s.month,c.id)<1/a.appointmentMonths){
  const candidates=Array.from({length:6},(_,j)=>({competence:.25+.7*hash(s.seed,'cadre-skill',s.month,c.id,j),loyalty:.25+.7*hash(s.seed,'cadre-loyal',s.month,c.id,j)}));
  const weight=rule==='personal'?.2:rule==='professional'?.85:.55;
  candidates.sort((x,y)=>weight*(y.competence-x.competence)+(1-weight)*(y.loyalty-x.loyalty));
  Object.assign(c,candidates[0],{appointedMonth:s.month});
 }
 r.administrativeCompetence=mean(r.cadres.map(c=>c.competence));
}
export function advanceRegimeDynamics(s,prev,events,flow){
 if(!regimeActive(s))return null;
 const p=s.politics,r=p.regimeDynamics,a=r.assumptions,policy=s.policy;
 recruit(s);
 // Electoral or term-limited rotation already installed by the constitution.
 // It changes the person, not the country's economic stocks or regime.
 if(p.executive.role==='president'&&p.executive.presidentName&&p.executive.presidentName!==r.leader.name){
  r.leader.history.push({name:r.leader.name,startedMonth:r.leader.startedMonth,endedMonth:s.month,reason:'constitutionalRotation',ageMonths:r.leader.ageMonths,disputed:false});
  r.leader.generation++;r.leader.name=p.executive.presidentName;r.leader.startedMonth=s.month;
  r.leader.ageMonths=Math.floor((42+hash(s.seed,'constitutional-leader-age',r.leader.generation)*16)*12);
 }
 r.leader.ageMonths++;
 const realPrice=Math.max(.01,(s.consumerPriceIndex??100)/100),population=s.population/s.base.initialPopulation;
 const securityReal=Math.max(0,flow.politicalSecurity??0)/realPrice;
 const reference=s.base.monthlyGDP*a.securityReferenceGDP/100*population;
 const securityTarget=a.securitySaturation*(1-Math.exp(-securityReal/Math.max(1,reference)));
 const fundingCoverage=clamp(s.defense?.payCoverage??securityReal/Math.max(1,reference));
 r.securityCapacity=approach(r.securityCapacity,securityTarget,a.capacityMonths);
 const professional=policy.securityGovernance!=='parallel',collegial=policy.securityGovernance==='collegial';
 r.securityCohesion=approach(r.securityCohesion,clamp((professional?.85:.45)-.25*r.successionCrisis-.2*r.backlash-.15*(1-fundingCoverage)),a.capacityMonths);
 r.militaryAutonomy=approach(r.militaryAutonomy,collegial?.85:professional?.55:.18,a.organizationMonths);
 const selection=policy.eliteRecruitment==='personal'?.88:policy.eliteRecruitment==='balanced'?.45:.22;
 r.personalControl=approach(r.personalControl,clamp(selection+(professional?0:.1)-(policy.successionProcedure==='council'?.15:0)),a.organizationMonths);
 const orgTarget=clamp(.3+.25*Number(policy.successionProcedure==='council')+.3*mean(r.cadres.map(c=>c.loyalty))-.25*r.personalControl);
 r.partyOrganization=approach(r.partyOrganization,orgTarget,a.organizationMonths);
 const complaints=policy.freeMedia||policy.censorshipScope==='complaints';
 const informationTarget=clamp(.12+.48*p.mediaFreedom+.18*Number(policy.publicDisclosure)+.18*Number(complaints)+.10*r.administrativeCompetence);
 r.informationQuality=approach(r.informationQuality,informationTarget,a.capacityMonths);
 const audit=clamp(s.institutions.courtCapacity*(.35+.4*Number(policy.publicDisclosure)+.25*p.judicialIndependence));
 const captureTarget=clamp((policy.businessAccess==='connections'?.55:0)*(1-audit)+mean(r.regions.map(x=>x.localPower))*.15*(1-audit));
 r.capture=approach(r.capture,captureTarget,a.capacityMonths);
 const privateCapital=sum(s.firms.map(f=>f.capital*(f.ownership.domestic+f.ownership.foreign))),totalCapital=sum(s.firms.map(f=>f.capital));
 r.independentBusiness=approach(r.independentBusiness,clamp(privateCapital/Math.max(1,totalCapital)*s.institutions.contractReliability*(1-r.capture)),a.organizationMonths);
 // Access rents bind connected beneficiaries to the incumbent coalition.
 // They do not create deposits, transfers or extra production.
 p.elites.party=clamp(p.elites.party+.002*r.capture);
 p.elites.business=clamp(p.elites.business+.001*r.capture);
 const civilianTies=policy.defenseService==='conscription'?1.2:1;
 const restraint=.12*(1-r.personalControl)*r.nationalMobilization*Number(policy.protestResponse==='force')*civilianTies;
 r.rankLoyalty=approach(r.rankLoyalty,clamp(.35+.35*fundingCoverage+.15*r.securityCohesion-.25*r.backlash-restraint),a.capacityMonths);
 for(const key of Object.keys(r.eliteGrievances)){
  r.eliteGrievances[key]*=1-1/24;
  p.elites[key]=clamp(p.elites[key]-.02*r.eliteGrievances[key]);
 }
 r.eliteCohesion=approach(r.eliteCohesion,clamp(mean(Object.values(p.elites))+.15*r.partyOrganization-.3*mean(Object.values(r.eliteGrievances))-.2*r.successionCrisis),a.capacityMonths);
 const council=regimeCouncil(s),preparation=r.successor?clamp((s.month-r.successor.agreedMonth)/a.successionMonths):0;
 const successionTarget=policy.successionProcedure==='elections'?p.electoralIntegrity*Number(policy.competitiveElections):clamp(.10+.45*council.power+.35*preparation+.2*r.eliteCohesion);
 r.successionReadiness=approach(r.successionReadiness,successionTarget,a.successionMonths);
 r.successionCrisis=approach(r.successionCrisis,0,Math.max(6,24*(1-r.eliteCohesion)));
 r.fear=approach(r.fear,0,12);r.backlash=approach(r.backlash,0,a.backlashMonths);
 const legalResolution=.35+.65*s.institutions.courtCapacity*p.judicialIndependence+.2*Number(policy.publicDisclosure);
 r.electoralDispute=approach(r.electoralDispute,0,18/legalResolution);
 const election=p.elections.findLast(e=>!e.initial&&e.month===s.month);
 if(election&&election.id!==r.lastElectionId){
  r.lastElectionId=election.id;
  if(policy.competitiveElections){
   const rows=election.results.slice().sort((x,y)=>y.share-x.share),margin=((rows[0]?.share??100)-(rows[1]?.share??0))/100;
   const advantage=regimeMediaAdvantage(s,p.executive.playerParty);
   const dispute=clamp((1-p.electoralIntegrity)*(.25+advantage)*Math.max(0,1-margin*5));
   r.electoralDispute=clamp(r.electoralDispute+dispute);
   if(dispute>.12)tell(s,'election-dispute','После близких выборов возник спор о равенстве условий. Независимая проверка снижает конфликт; одно объявление результата его не устраняет.',events);
  }
 }
 const first=p.economicHistory[0],incomeChange=Math.log(Math.max(.1,s.metrics.realIncomeIndex)/Math.max(.1,first?.national??s.metrics.realIncomeIndex));
 const economicPain=clamp(Math.max(0,-incomeChange)*1.5+.008*Math.max(0,s.metrics.unemployment-8)+.004*Math.max(0,s.metrics.inflationYoY-10));
 const corporateStrain=clamp(economicPain+r.nationalMobilization+(1-r.securityCohesion)*.5+(s.defense?.war?.3:0));
 const civilianDemand=closed(s)&&council.kind==='officers'&&council.power>.35?corporateStrain*(1-r.personalControl):0;
 r.civilianDemand=approach(r.civilianDemand,civilianDemand,18);
 if(r.civilianDemand>.25&&!r.transition){
  r.eliteGrievances.security=clamp(r.eliteGrievances.security+.002*r.civilianDemand);
  if((prev.politics.regimeDynamics?.civilianDemand??0)<=.25)tell(s,'officer-civilian-demand','В совете офицеров усилилось требование вернуть армии профессиональную роль и обсудить гражданское правление. Поддержка пакта зависит от условий, а переход не предрешён.',events);
 }
 const voice=clamp(.08+.45*p.civilFreedom+.25*p.mediaFreedom+.12*Number(policy.localElections)+.1*r.independentBusiness);
 const delegation=((s.localGovernment?.servicesShare??policy.municipalServicesShare/100)+(s.localGovernment?.infrastructureShare??policy.municipalInvestmentShare/100))/2;
 for(const region of r.regions){
  region.localPower=approach(region.localPower,clamp(.15+.65*delegation+.15*Number(policy.localElections)),a.organizationMonths);
  const regionalPoll=p.poll.groups?.find(g=>g.dimension==='region'&&Number(g.id)===region.id);
  const approval=regionalPoll?.approval===null||regionalPoll?.approval===undefined?p.hiddenApproval:regionalPoll.approval/100;
  const relief=policy.protestResponse==='dialogue'?(.04*r.informationQuality*audit):0;
  const grievance=clamp(.55*(1-approval)+economicPain+.2*r.capture+.3*r.backlash+.3*r.electoralDispute-relief);
  region.grievance=approach(region.grievance,grievance,a.grievanceMonths);
  const deterrence=clamp(r.securityCapacity*r.securityCohesion*r.rankLoyalty);
  const force=policy.protestResponse==='force'?deterrence:0;
  const target=clamp(Math.max(0,region.grievance-.30)*2*voice*(1-.65*force)*(1-.4*r.fear));
  region.mobilization=approach(region.mobilization,target,a.mobilizationMonths);
 }
 const local=sum(r.regions.map(x=>x.weight*x.mobilization));
 const demands=clamp(.35*(1-p.civilFreedom)*local+.4*r.backlash+.6*r.electoralDispute+.3*r.successionCrisis+.15*clamp(p.lawConflict/4));
 r.politicalDemands=approach(r.politicalDemands,demands,6);
 r.nationalMobilization=approach(r.nationalMobilization,clamp(local*(.25+.75*voice)+r.politicalDemands*voice),a.mobilizationMonths);
 if(policy.protestResponse==='force'&&local+r.nationalMobilization>.12&&s.month%3===0){
  const executed=clamp((local+r.nationalMobilization)*r.securityCapacity*r.securityCohesion*r.rankLoyalty);
  r.fear=clamp(r.fear+executed*.3);
  const backfire=hash(s.seed,'repression-backfire',s.month)<clamp(.15+.5*p.mediaFreedom+.2*r.electoralDispute);
  if(backfire)r.backlash=clamp(r.backlash+executed*.5);
  tell(s,'protest-force',`Силовой ответ на выступления: ${executed>.05?'часть мобилизации сдержана':'исполнение приказа ограничено'}${backfire?'; инцидент вызвал дополнительное возмущение.':'. Недовольство сохраняется.'}`,events);
 }
 const armedTarget=r.nationalMobilization>.40&&r.securityCohesion<.45&&r.backlash>.15?clamp((r.nationalMobilization-.4)*r.backlash):0;
 r.armedConflict=approach(r.armedConflict,armedTarget,18);
 r.lostWorkFraction=clamp(a.localLostHours*local+a.nationalLostHours*r.nationalMobilization+a.conflictLostHours*r.armedConflict,0,.25);
 if(local>.10&&(prev.politics.regimeDynamics?.last?.localMobilization??0)<=.10)tell(s,'local-protests','В нескольких территориях проходят выступления по местным вопросам. Это ещё не общенациональное движение за смену власти.',events);
 if(r.nationalMobilization>.25&&(prev.politics.regimeDynamics?.nationalMobilization??0)<=.25)tell(s,'national-protests','Местные выступления перешли в общенациональную мобилизацию; её исход зависит также от согласия элит и поведения силовых структур.',events);
 advanceTransition(s,events);
 const annualDeath=Math.min(.6,a.mortalityAt55*Math.pow(2,(r.leader.ageMonths/12-55)/a.mortalityDoublingYears));
 const deathHazard=rate(annualDeath);
 if(closed(s)&&hash(s.seed,'regime-natural-death',s.month,r.leader.generation)<deathHazard)transferLeader(s,'death',events);
 const disgruntled=clamp(1-mean(Object.values(p.elites))+.4*mean(Object.values(r.eliteGrievances)));
 const localBrokers=mean(r.regions.map(x=>x.localPower))*(1-Number(policy.localElections)*p.electoralIntegrity);
 const coupCoordination=clamp((.15+.45*council.power+.25*(1-r.personalControl)+.15*localBrokers)*disgruntled);
 const eliteRisk=closed(s)?p.parameters.eliteHazard*logistic(12*(disgruntled-.65)+4*r.successionCrisis)*coupCoordination:0;
 const successionRisk=closed(s)?a.crisisHazardScale*r.successionCrisis*(1-r.eliteCohesion):0;
 const protestRisk=a.protestHazardScale*r.nationalMobilization**2*(1-r.rankLoyalty*r.securityCohesion)*(1-r.eliteCohesion);
 p.internalRemovalRisk=clamp(eliteRisk+successionRisk+protestRisk,0,.1);
 r.effectiveType=policy.competitiveElections?(Math.min(p.mediaFreedom,p.judicialIndependence,p.electoralIntegrity)>.65?'democracy':'hybrid'):r.personalControl>.65?'personalist':r.militaryAutonomy>r.partyOrganization?'military':'party';
 r.last={month:s.month,localMobilization:local,economicPain,voice,securityReal,securityReference:reference,securityTarget,council:clone(council),coupCoordination,eliteRisk,successionRisk,protestRisk,deathHazard,uncertaintyPremium:regimeInvestmentPremium(s),lostWorkFraction:r.lostWorkFraction,informationQuality:r.informationQuality,capture:r.capture,effectiveType:r.effectiveType};
 if(p.executive.inOffice&&hash(s.seed,'regime-removal',s.month)<p.internalRemovalRisk){
  const collapse=r.nationalMobilization>.4&&r.eliteCohesion<.4;
  r.regimeEnded=collapse;
  const reason=collapse?'Массовая мобилизация и раскол правящей коалиции завершили существование прежнего режима':'Правящая коалиция сменила руководителя; сама система власти сохранилась';
  tell(s,collapse?'regime-breakdown':'leader-removal',reason,events);return reason;
 }
 return null;
}
function advanceTransition(s,events){
 const p=s.politics,r=p.regimeDynamics,t=r.transition;
 if(!t||t.status==='completed')return;
 const support=clamp(.4*p.elites.security+.3*r.securityCohesion+.3*r.eliteCohesion-.5*r.personalControl-.2*mean(Object.values(r.eliteGrievances)));
 t.support=support;
 if(support>.45){t.status='negotiating';t.progress=clamp(t.progress+support/r.assumptions.transitionMonths);}
 else{t.status='stalled';t.progress=Math.max(0,t.progress-.01);}
 if(t.progress>=1){
  t.status='completed';t.completedMonth=s.month;
  for(const key of ['competitiveElections','associationFreedom','freeMedia','parliamentOversight']){s.policy[key]=true;p.lawPolicy[key]=true;}
  p.constitution.regime='hybrid';p.nextPresidentElection=s.month+3;p.nextParliamentElection=s.month+3;
  tell(s,'civilian-elections','Пакт выполнен: назначены конкурентные президентские и парламентские выборы через три месяца. Независимость судов и качество выборов ещё требуют работы; гражданская власть не гарантирована.',events);
 }
}
// These economic channels depend on observable mechanisms, never the label.
export function regimeInvestmentPremium(s){
 if(!regimeActive(s))return 0;
 const r=s.politics.regimeDynamics,age=r.leader.ageMonths/12;
 const expectedSuccession=rate(Math.min(.6,r.assumptions.mortalityAt55*Math.pow(2,(age-55)/r.assumptions.mortalityDoublingYears)))*(1-r.successionReadiness)*12;
 const uncertainty=clamp(r.successionCrisis+.6*r.electoralDispute+.5*r.armedConflict+.25*r.nationalMobilization+expectedSuccession);
 return r.assumptions.uncertaintyPremium*uncertainty;
}
export function regimeContractFactor(s){
 if(!regimeActive(s))return 1;
 const r=s.politics.regimeDynamics;
 const coalitionCommitment=r.partyOrganization*(1-r.personalControl)*r.eliteCohesion;
 return clamp(1-.3*r.capture-.2*r.successionCrisis+.12*coalitionCommitment,.65,1.12);
}
export const regimeEntryFactor=s=>regimeActive(s)?1+2*s.politics.regimeDynamics.capture:1;
export const regimeWorkFactor=s=>regimeActive(s)?1-s.politics.regimeDynamics.lostWorkFraction:1;
export const regimeInformation=s=>regimeActive(s)?s.politics.regimeDynamics.informationQuality:.65;
export const regimeCompetence=s=>regimeActive(s)?s.politics.regimeDynamics.administrativeCompetence:.65;
export function regimeMediaAdvantage(s,id){
 if(!regimeActive(s)||id!==s.politics.executive.playerParty)return 0;
 const p=s.politics,r=p.regimeDynamics;
 // Access/persuasion changes voter utilities, not the counted ballots.
 return clamp((1-p.mediaFreedom)*(.18+.25*r.partyOrganization)*(1-.6*p.judicialIndependence),0,.45);
}
export function regimeMetrics(s){
 if(!regimeActive(s))return {};
 const r=s.politics.regimeDynamics;
 return {personalControl:r.personalControl*100,rulingPartyOrganization:r.partyOrganization*100,politicalMilitaryAutonomy:r.militaryAutonomy*100,eliteCohesion:r.eliteCohesion*100,successionReadiness:r.successionReadiness*100,politicalInformationQuality:r.informationQuality*100,securityServiceCapacity:r.securityCapacity*100,nationalMobilization:r.nationalMobilization*100,localMobilization:(r.last?.localMobilization??0)*100,electoralDispute:r.electoralDispute*100,politicalLostHours:r.lostWorkFraction*100,politicalInvestmentPremium:regimeInvestmentPremium(s)*100,politicalCapture:r.capture*100,leaderAge:r.leader.ageMonths/12};
}
export function validateRegimeDynamics(s){
 const r=s.politics?.regimeDynamics;if(r===undefined)return;
 const valid=(v,a=0,b=1)=>Number.isFinite(v)&&v>=a&&v<=b;
 if(r.revision!==1||!Number.isInteger(r.startedMonth)||r.startedMonth<0||r.startedMonth>s.month)throw new Error('Повреждена версия институтов власти');
  const fractions=['personalControl','partyOrganization','militaryAutonomy','eliteCohesion','successionReadiness','securityCapacity','securityCohesion','rankLoyalty','informationQuality','administrativeCompetence','capture','independentBusiness','backlash','fear','nationalMobilization','politicalDemands','electoralDispute','armedConflict','lostWorkFraction','successionCrisis','civilianDemand'];
 if(fractions.some(k=>!valid(r[k]))||Object.keys(REGIME_ASSUMPTIONS).length!==Object.keys(r.assumptions??{}).length||Object.keys(REGIME_ASSUMPTIONS).some(k=>!valid(r.assumptions[k],0,k.includes('Months')||k==='mortalityDoublingYears'?240:2))||r.assumptions.version!==1)throw new Error('Повреждены параметры институтов власти');
 if(['capacityMonths','organizationMonths','appointmentMonths','grievanceMonths','mobilizationMonths','backlashMonths','successionMonths','transitionMonths','mortalityDoublingYears','securityReferenceGDP'].some(k=>r.assumptions[k]<=0)||r.assumptions.councilThreshold<=0||r.assumptions.councilThreshold>1)throw new Error('Неверный масштаб институтов власти');
 if(!r.leader||typeof r.leader.name!=='string'||!Number.isInteger(r.leader.ageMonths)||!valid(r.leader.ageMonths,0,1800)||!Array.isArray(r.leader.history)||!Number.isInteger(r.leader.generation)||r.leader.generation<0||!Number.isInteger(r.leader.startedMonth)||r.leader.startedMonth>s.month)throw new Error('Повреждена преемственность руководства');
 if(!Array.isArray(r.cadres)||r.cadres.length!==4||r.cadres.some((c,i)=>c.id!==i||!valid(c.competence)||!valid(c.loyalty)||!Number.isInteger(c.appointedMonth)||c.appointedMonth>s.month)||!Array.isArray(r.regions)||r.regions.length!==4||r.regions.some((x,i)=>x.id!==i||x.weight!==[.4,.25,.25,.1][i]||!valid(x.grievance)||!valid(x.mobilization)||!valid(x.localPower)))throw new Error('Повреждены кадры или региональные состояния');
 if(Object.keys(r.eliteGrievances??{}).sort().join()!=='administration,business,party,security'||Object.values(r.eliteGrievances).some(x=>!valid(x))||!Array.isArray(r.notices)||r.notices.length>40||r.notices.some(n=>typeof n.text!=='string'||!Number.isInteger(n.month)||n.month>s.month)||typeof r.regimeEnded!=='boolean')throw new Error('Повреждена история институтов власти');
 if(r.successor&&(typeof r.successor.name!=='string'||!Number.isInteger(r.successor.agreedMonth)||r.successor.agreedMonth>s.month)||r.transition&&(!valid(r.transition.progress)||!['negotiating','stalled','completed'].includes(r.transition.status)||!Number.isInteger(r.transition.startedMonth)||r.transition.startedMonth>s.month))throw new Error('Повреждён переход власти');
}

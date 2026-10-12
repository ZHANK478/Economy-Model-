import {BASE_POLICY} from './config.js';
import {PARTY_FAMILIES,partyDisplayName,AXES,CONSTITUTIONAL_POLICY_KEYS,BUDGET_KEYS,CB_KEYS,clamp,clone,hash,logistic,distance,platformObject,constitutionFrom,parametersFrom} from './political-config.js';
import {pollElectorate,validateElectorateGroups,conductElection,advanceCitizenship,electorateTotals,makeElectorate,governedPlatform} from './electorate.js';
import {policyAuthority,createBill,amendBill,acceptAmendment,voteArticle,voteBill,presidentialDecision,referendum,enactBills,rollCall,validatePolicyPatch,validateLegislativeAction} from './legislation.js';
import {initializeAgenda,generateMonthlyAgenda,expireMonthlyAgenda,decideBill,plannedPolicy} from './political-agenda.js';
export {plannedPolicy};
export {policyAuthority,createBill};
const sum=a=>a.reduce((v,x)=>v+x,0);
const party=(s,id)=>s.politics.parties.find(x=>x.id===id);
const leaderNames=['Алексей Ветров','Мария Орлова','Данияр Соколов','Елена Миронова','Тимур Лазарев','Анна Полевая','Роман Волков','София Речная'];
const labelRole=role=>role==='president'?'президент':'премьер-министр';
export function initializePoliticalSystem(s,options={}){
  const p=s.politics;p.enabled=Boolean(options.politicalMode);if(!p.enabled)return;
  p.constitution=constitutionFrom(options.politicalOptions?.constitution??{});p.parameters=parametersFrom(options.politicalOptions?.parameters??{});
  if(options.politicalOptions?.dashboardMode===true)p.dashboardMode=true;
  const c=p.constitution,regime=c.regime;
  const competitive=regime==='democracy'||regime==='hybrid',free=regime==='democracy';
  // Starting constitutions are scenario assumptions, not a reform performed
  // without a vote. Political quality still changes gradually thereafter.
  if(!options.policy){Object.assign(s.policy,{competitiveElections:competitive,freeMedia:free,protectedJudges:free,judicialReview:free,parliamentOversight:competitive,associationFreedom:competitive,electionAdministration:.12,securityBudget:regime==='military'?1.2:.35,patronageBudget:competitive?0:.4});}
  Object.assign(p,{judicialIndependence:free?.65:regime==='hybrid'?.45:.2,mediaFreedom:free?.7:regime==='hybrid'?.4:.2,electoralIntegrity:free?.7:regime==='hybrid'?.5:.15,legislativeConstraint:free?.65:regime==='hybrid'?.4:.15,civilFreedom:competitive?.75:.25});
  p.lawPolicy=clone(s.policy);p.parties=PARTY_FAMILIES.map((f,i)=>({id:`p${i+1}`,family:f.id,name:f.label,color:f.color,leader:leaderNames[i],candidateName:leaderNames[(i+3)%leaderNames.length],platform:platformObject(f.platform),organization:[.75,.92,.9,.9,.7,.65,.65,.55][i],competence:.45+hash(s.seed,'competence',i)*.35,candidateCompetence:.3+hash(s.seed,'candidate',i)*.65,discipline:.7+hash(s.seed,'discipline',i)*.25,active:true,tolerated:i<4,seats:0,deputies:[],foundedMonth:0,parentIds:[],coalitionGrievance:0,brokenPromises:0,promises:[],cabinetPosts:0}));
  const player=p.parties.find(x=>x.family===(options.politicalOptions?.playerFamily??'liberal'))??p.parties[2];
  p.executive={role:c.playerRole,playerParty:player.id,presidentParty:c.form==='semiPresidential'&&c.playerRole==='primeMinister'?p.parties[3].id:player.id,primeMinisterParty:player.id,inOffice:true,startedMonth:0,termsServed:1,legalExposure:0,reason:null,formationDeadline:null};
  p.coalition=[];p.coalitionAgreements=[];p.bills=[];p.rollCalls=[];p.pendingCommands=[];p.lastActions=[];p.commandHistory=[];p.nextCommandId=1;p.nextBillId=1;p.nextPartyId=9;p.nextElectionId=1;p.elections=[];p.groupMemory={};p.publicEvents=[];p.partyHistory=[];p.authorizedActions=[];p.lastSubmittedActions=[];p.lastCommands=[];p.budgetExpires=12;p.provisionalBudget=false;p.emergency=null;p.scheduledParliament=null;p.nextParliamentElection=c.parliamentOffset||c.parliamentTerm;p.nextPresidentElection=c.form==='parliamentary'?null:c.presidentTerm;
  const adults=s.demography.female.slice(216).reduce((v,x)=>v+x,0)+s.demography.male.slice(216).reduce((v,x)=>v+x,0);
  p.citizenship={residents:adults*.025,naturalized:adults*.03,newlyNaturalized:0,arrivals:[{month:-24,people:adults*.025}],naturalizations:[{month:-60,people:adults*.03}],integration:1-Math.exp(-60/96)};
  p.economicHistory=[{month:0,national:s.metrics.realIncomeIndex,groups:Array.from({length:5},(_,i)=>(s.households[i*2].realIncomeIndex+s.households[i*2+1].realIncomeIndex)/2)}];
  p.elites={party:.7,administration:.7,security:.7,business:.65};p.hiddenApproval=.58;p.officialApproval=.58;p.lawConflict=0;
  // Initialize persistent identities before the incoming parliament is elected.
  // Their first appearance must not create a mechanical month-one poll jump.
  pollElectorate(s);
  const election=conductElection(s,'parliament',{initial:true});installParliament(s,election);p.elections.push(election);initialCoalition(s);
  p.nextElection=p.nextPresidentElection===null?p.nextParliamentElection:Math.min(p.nextParliamentElection,p.nextPresidentElection);
  const {poll}=pollElectorate(s);p.publicSupport=poll.approval;p.hiddenApproval=poll.approval;p.officialApproval=poll.approval;p.presidentApproval=poll.presidentApproval;p.cabinetApproval=poll.cabinetApproval;p.parliamentSupport=coalitionSeats(s)/p.totalSeats;
  p.partyHistory.push({month:0,approval:p.hiddenApproval,officialApproval:p.officialApproval,parliamentSupport:p.parliamentSupport,parties:poll.parties.map(x=>({...x,seats:party(s,x.id).seats})),...(p.dashboardMode?{groups:clone(poll.groups),presidentApproval:p.presidentApproval*100,cabinetApproval:p.cabinetApproval*100}:{})});
  p.initialOptions={constitution:clone(c),parameters:clone(p.parameters),playerFamily:player.family};
  p.instantRules=options.politicalOptions?.instantRules!==false;
  p.initialOptions.instantRules=p.instantRules;
  if(p.dashboardMode)p.initialOptions.dashboardMode=true;
  if(options.politicalOptions?.agendaSlots!==undefined){if(![1,3].includes(options.politicalOptions.agendaSlots))throw new Error('Неверное число инициатив');p.agendaSlots=options.politicalOptions.agendaSlots;p.initialOptions.agendaSlots=p.agendaSlots;}
  if(options.politicalOptions?.decisionLimit!==undefined){if(options.politicalOptions.decisionLimit!==3)throw new Error('Неверный лимит решений');p.decisionLimit=3;p.initialOptions.decisionLimit=3;}
  if(p.instantRules){initializeAgenda(s);generateMonthlyAgenda(s);}
  s.provenance.initialPolicy=clone(s.policy);s.provenance.politicalMode=true;s.provenance.politicalOptions=clone(p.initialOptions);
}
export function coalitionSeats(s){return sum(s.politics.parties.filter(x=>s.politics.coalition.includes(x.id)).map(x=>x.seats));}
function installParliament(s,election){const p=s.politics;p.totalSeats=election.totalSeats;p.allocatedSeatBase=p.constitution.seats;
  for(const x of p.parties){x.seats=election.results.find(r=>r.id===x.id)?.seats??0;x.deputies=Array.from({length:x.seats},(_,i)=>({id:`${election.id}-${x.id}-${i}`,district:election.districts.filter(d=>d.winner===x.id)[i]?.id??null}));}
  p.lastParliamentElection=election.id;
}
function initialCoalition(s){const p=s.politics,player=party(s,p.executive.playerParty),ordered=p.parties.filter(x=>x.active&&x.id!==player.id&&x.seats>0).sort((a,b)=>distance(a.platform,player.platform)-distance(b.platform,player.platform));
  p.coalition=[player.id];let seats=player.seats;
  for(const x of ordered){if(seats>p.totalSeats/2)break;p.coalition.push(x.id);seats+=x.seats;}
  allocateCabinet(s);p.coalitionAgreements=p.coalition.map(id=>({partyId:id,month:0,platform:clone(party(s,id).platform),policy:clone(s.policy),posts:party(s,id).cabinetPosts,initial:true}));
}
function allocateCabinet(s){const p=s.politics,members=p.parties.filter(x=>p.coalition.includes(x.id)),total=coalitionSeats(s);for(const x of p.parties)x.cabinetPosts=0;
  const quotas=members.map(x=>8*x.seats/Math.max(1,total)),posts=quotas.map(Math.floor),left=8-sum(posts),order=quotas.map((v,i)=>({i,r:v-posts[i]})).sort((a,b)=>b.r-a.r);
  for(let i=0;i<left&&order.length;i++)posts[order[i%order.length].i]++;members.forEach((x,i)=>x.cabinetPosts=posts[i]);
}
export function schedulePolitical(s,command){const p=s.politics;if(!p.enabled)throw new Error('Включите политическую игру при создании страны');if(!p.executive.inOffice)throw new Error('Ваше правление завершено');
  const kinds=['proposeBill','chooseLaw','policyDecision','decideBill','activateInstantRules','setAgendaSlots','setDecisionLimit','setDashboardMode','amend','acceptAmendment','voteArticle','voteBill','sign','veto','override','withdraw','referendum','coalitionOffer','coalitionLeave','confidence','dissolve','impeach','emergency','ratifyEmergency','endEmergency','constitutionalConflict','partyProgram','promise','partySplit','partyMerge','parameters','renewBudget'];
  if(!kinds.includes(command?.kind))throw new Error('Неизвестное политическое действие');
  const c=clone(command);delete c.id;delete c.month;
  if(['proposeBill','chooseLaw','policyDecision'].includes(c.kind)){validatePolicyPatch(c.patch??{});if(c.constitutionPatch)constitutionFrom({...p.constitution,...c.constitutionPatch});if(c.actions)c.actions.forEach(validateLegislativeAction);}
  if(c.kind==='parameters')parametersFrom({...p.parameters,...c.values});
  if(c.kind==='partyProgram'&&(!c.platform||AXES.some(k=>!Number.isFinite(c.platform[k])||Math.abs(c.platform[k])>1)))throw new Error('Неверная программа партии');
  const request={...c,id:p.nextCommandId++,month:s.month};p.pendingCommands.push(request);return request;
}
const FREE_COMMANDS=new Set(['activateInstantRules','setAgendaSlots','setDecisionLimit','setDashboardMode','parameters']);
export function decisionBudget(s){
 const p=s.politics;if(!p.enabled||!p.decisionLimit)return {limit:null,used:0,remaining:Infinity,optionalRemaining:Infinity};
 const commands=p.turnCommands??[],start=commands.findLastIndex(c=>c.kind==='setDecisionLimit');
 const used=commands.slice(start+1).filter(c=>!FREE_COMMANDS.has(c.kind)).length,remaining=Math.max(0,p.decisionLimit-used);
 const waiting=p.bills.some(b=>b.monthlyInitiative&&b.month===s.month&&!b.executiveResponse&&['draft','articles','awaitingSignature','referendum'].includes(b.status));
 return {limit:p.decisionLimit,used,remaining,optionalRemaining:Math.max(0,remaining-(waiting?1:0))};
}
export function assertDecisionAvailable(s,command){
 if(FREE_COMMANDS.has(command.kind))return;
 const budget=decisionBudget(s);if(!budget.limit)return;
 if(!budget.remaining)throw new Error('Все 3 решения этого месяца использованы. Перейдите к следующему месяцу.');
 const b=s.politics.bills.find(b=>b.id===Number(command.billId));
 const mandatory=b?.monthlyInitiative&&b.month===s.month&&!b.executiveResponse&&command.kind==='decideBill';
 if(!mandatory&&!budget.optionalRemaining)throw new Error('Последнее решение оставлено для обязательного предложения партии.');
}
// Current-turn decisions are recorded separately from monthly economic flows.
// Replay executes them before the corresponding advanceMonth, including an
// unfinished current turn. A failed command rolls back its entire mutation.
export function executePolitical(s,command){
  const p0=s.politics,archives=['rollCalls','elections','partyHistory','commandHistory'];
  const backup=clone({...p0,...Object.fromEntries(archives.map(key=>[key,[]])),bills:[]});
  for(const key of archives)if(p0[key])backup[key]=p0[key].slice();
  if(p0.bills)backup.bills=p0.bills.map(b=>['draft','articles','awaitingSignature','referendum','passed'].includes(b.status)||b.id===Number(command?.billId)?clone(b):b);
  const pending=clone(s.pendingActions),nextAction=s.nextActionId;
  try{
    assertDecisionAvailable(s,command);
    const request=schedulePolitical(s,command),p=s.politics; p.pendingCommands.pop();
    initializeAgenda(s);const start=p.lastActions.length,events=[];
    const result=processCommand(s,request,events);
    p.turnCommands.push(clone(request));p.turnActions.push(...clone(p.lastActions.slice(start)));p.turnEvents.push(...events);
    p.commandHistory.push({...clone(request),processedMonth:s.month,timing:'currentTurn',status:'processed'});
    return result;
  }catch(e){s.politics=backup;s.pendingActions=pending;s.nextActionId=nextAction;throw e;}
}
export function enableInstantPolitics(s){
  if(!s.politics.enabled||s.politics.instantRules||!s.politics.executive.inOffice)return;
  executePolitical(s,{kind:'activateInstantRules'});
  // Honor actions already selected in an older save without another month.
  const queued=clone(s.politics.pendingCommands);s.politics.pendingCommands=[];
  for(const command of queued){try{executePolitical(s,command.kind==='proposeBill'?{...command,kind:'chooseLaw'}:command.kind==='renewBudget'?{kind:'chooseLaw',renewBudget:true,title:'Бюджет на следующий год'}:command);}catch{/* Invalid legacy selections stay in their old saved history. */}}
}
function loseOffice(s,reason,events){const p=s.politics;if(!p.executive.inOffice)return;
  p.executive.inOffice=false;p.executive.reason=reason;p.executive.endedMonth=s.month;
  p.executive.report={month:s.month,monthsServed:s.month-p.executive.startedMonth,reason,approval:p.hiddenApproval*100,partyRating:p.poll?.parties.find(x=>x.id===p.executive.playerParty)?.share??0,seatShare:party(s,p.executive.playerParty).seats/p.totalSeats*100,realGDP:s.metrics.realGDPAnnualized,gdpPerCapita:s.metrics.gdpPerCapitaReal,inflation:s.metrics.inflationYoY,unemployment:s.metrics.unemployment,debt:s.metrics.debtRatio,population:s.population,gini:s.metrics.giniDisposable,laws:p.bills.filter(x=>x.status==='enacted').length};
  events.push(`Правление завершено: ${reason}. Итоговый отчёт сохранён; новую страну можно начать отдельно.`);
}
function confidenceVote(s,{replacement=null,automatic=false}={},events){const p=s.politics,c=p.constitution;if(c.form==='presidential')throw new Error('Президентское правление не прекращается обычным вотумом недоверия');
  const opposition=p.parties.filter(x=>x.seats>0&&!p.coalition.includes(x.id)).sort((a,b)=>b.seats-a.seats),leader=replacement?party(s,replacement):opposition[0];
  if(c.confidence==='constructive'&&(!leader||p.coalition.includes(leader.id)))throw new Error('Конструктивный вотум требует кандидата нового большинства');
  const bill={id:-s.month-1000,revision:0,kind:'ordinary',patch:{},sponsor:leader?.id??p.executive.playerParty};
  const result=rollCall(s,bill,{confidence:true});const against=result.no,required=Math.floor(p.totalSeats/2)+1;
  const alternative=leader?opposition.filter(x=>distance(x.platform,leader.platform)<=p.parameters.coalitionTolerance):[];
  const replacementSeats=sum(alternative.map(x=>x.seats)),passed=against>=required&&(c.confidence==='ordinary'||replacementSeats>=required);
  p.lastActions.push({kind:'confidence',month:s.month,against,required,replacement:leader?.id??null,alternativeParties:alternative.map(x=>x.id),passed,automatic,rollCall:result});
  if(passed){if(p.executive.role==='primeMinister')loseOffice(s,'Парламент выразил недоверие и сменил кабинет',events);else{p.coalition=alternative.map(x=>x.id);p.executive.primeMinisterParty=leader.id;allocateCabinet(s);events.push('Парламент сменил кабинет. Президент сохраняет свой отдельный мандат.');}}
}
function offerCoalition(s,command,events){const p=s.politics,x=party(s,command.partyId);if(!x||!x.active||!x.seats||p.coalition.includes(x.id))throw new Error('Эта партия не может вступить в новую коалицию');
  const concessions=validatePolicyPatch(command.concessions??{}),projected=governedPlatform({...s,policy:{...s.policy,...concessions}}),gap=distance(x.platform,projected),posts=clamp(Number(command.posts??1),0,8);
  const occupied=sum(p.parties.map(x=>x.cabinetPosts)),reassignable=party(s,p.executive.playerParty).cabinetPosts;
  const accepted=gap<=p.parameters.coalitionTolerance&&posts>=1&&posts<=8-occupied+reassignable&&x.coalitionGrievance<1;
  p.lastActions.push({kind:'coalitionOffer',partyId:x.id,concessions,posts,accepted,programDistance:gap});
  if(!accepted){events.push(`${x.name}: предложение коалиции отклонено из-за программы или прежних нарушений договорённостей.`);return;}
  party(s,p.executive.playerParty).cabinetPosts-=Math.max(0,posts-(8-occupied));p.coalition.push(x.id);x.cabinetPosts=posts;x.coalitionGrievance=0;p.coalitionAgreements.push({partyId:x.id,month:s.month,platform:clone(projected),policy:{...clone(p.lawPolicy),...concessions},posts,initial:false});
  if(Object.keys(concessions).length){const b=createBill(s,concessions,{title:'Коалиционное соглашение с '+x.name});if(p.instantRules)decideBill(s,b.id,'accept',events);}if(coalitionSeats(s)>p.totalSeats/2)p.executive.formationDeadline=null;
  events.push(`${x.name} вошла в коалицию. ${p.instantRules?'Предложенные уступки рассмотрены в этом ходу.':'Обещанные изменения ещё требуют закона.'}`);
}
function partySplit(s,command){const p=s.politics,parent=party(s,command.partyId??p.executive.playerParty);if(parent?.id!==p.executive.playerParty||!parent.active||p.parties.filter(x=>x.active).length>=16)throw new Error('Можно организовать фракцию только в своей партии; достигнутый предел партий также ограничивает раскол');
  const x=clone(parent);x.id=`p${p.nextPartyId++}`;x.name=String(command.name??parent.name+' · новая фракция').slice(0,80);x.parentIds=[parent.id];x.foundedMonth=s.month;x.cabinetPosts=0;x.coalitionGrievance=0;x.organization*=.35;
  if(command.platform){if(AXES.some(k=>!Number.isFinite(command.platform[k])||Math.abs(command.platform[k])>1))throw new Error('Неверная программа');x.platform=clone(command.platform);}
  const moved=Math.floor(parent.seats*.25);x.seats=moved;x.deputies=parent.deputies.splice(-moved||parent.deputies.length,moved);parent.seats-=moved;parent.organization*=.75;p.parties.push(x);p.lastActions.push({kind:'partySplit',parent:parent.id,newParty:x.id,moved});
}
function partyMerge(s,command){const p=s.politics,ids=[...new Set(command.partyIds??[])],members=ids.map(id=>party(s,id));if(ids.length<2||!ids.includes(p.executive.playerParty)||members.some(x=>!x?.active))throw new Error('Для объединения нужны действующие партии и участие вашей партии');
  const anchor=members[0];if(members.some(x=>distance(x.platform,anchor.platform)>.25))throw new Error('Партии отказались объединяться: слишком разные программы');
  const x=clone(anchor);x.id=`p${p.nextPartyId++}`;x.name=String(command.name??'Союз '+members.map(x=>x.name).join(' / ')).slice(0,100);x.parentIds=ids;x.foundedMonth=s.month;x.seats=sum(members.map(x=>x.seats));x.deputies=members.flatMap(x=>x.deputies);x.organization=clamp(sum(members.map(x=>x.organization))*.7,0,1.5);x.cabinetPosts=sum(members.map(x=>x.cabinetPosts));
  const wasCoalition=ids.some(id=>p.coalition.includes(id));for(const m of members){m.active=false;m.seats=0;m.deputies=[];m.cabinetPosts=0;}p.parties.push(x);p.coalition=p.coalition.filter(id=>!ids.includes(id));if(wasCoalition)p.coalition.push(x.id);
  for(const k of ['playerParty','presidentParty','primeMinisterParty'])if(ids.includes(p.executive[k]))p.executive[k]=x.id;
  for(const g of Object.values(p.groupMemory))if(ids.includes(g.identity))g.identity=x.id;p.lastActions.push({kind:'partyMerge',parentIds:ids,newParty:x.id});
}
function processCommand(s,command,events){const p=s.politics,c=p.constitution;
  switch(command.kind){
    case 'activateInstantRules':p.initialOptions.instantRules??=false;p.instantRules=true;initializeAgenda(s);generateMonthlyAgenda(s);return;
    case 'setDashboardMode':{
      p.dashboardMode=true;
      const grouped=pollElectorate(s,{commitMemory:false,trackGroups:true,assignPoll:false}).poll.groups;
      p.poll.groups=grouped;
      const i=p.partyHistory.findLastIndex(h=>h.month===s.month);if(i>=0)p.partyHistory[i]={...p.partyHistory[i],groups:clone(grouped),presidentApproval:p.presidentApproval*100,cabinetApproval:p.cabinetApproval*100};
      p.nextAgendaMonth=s.month+2+Math.floor(hash(s.seed,'agenda-delay',s.month)*3);return;
    }
    case 'setDecisionLimit':if(command.limit!==3)throw new Error('Неверный лимит решений');p.decisionLimit=3;return;
    case 'setAgendaSlots':{
      if(![1,3].includes(command.slots))throw new Error('Неверное число инициатив');
      p.agendaSlots=command.slots;
      const live=p.bills.filter(b=>b.monthlyInitiative&&b.month===s.month&&!b.executiveResponse&&['draft','articles','awaitingSignature','referendum'].includes(b.status));
      for(const b of live.slice(command.slots)){b.status='withdrawn';b.executiveResponse={decision:'agendaMigration',month:s.month};p.initiativeCredits[b.sponsor]=(p.initiativeCredits[b.sponsor]??0)+1;}
      return;
    }
    case 'decideBill':return decideBill(s,command.billId,command.decision,events);
    case 'chooseLaw':{
      const b=createBill(s,command.patch??{},{constitutionPatch:command.constitutionPatch,title:command.title,sponsor:p.executive.playerParty,actions:command.actions,renewBudget:command.renewBudget});
      if(command.actions){const ids=new Set(command.actions.map(a=>a.id));s.pendingActions=s.pendingActions.filter(a=>!ids.has(a.id));s.nextActionId=Math.max(s.nextActionId,...command.actions.map(a=>a.id+1));}
      return decideBill(s,b.id,'accept',events);
    }
    case 'policyDecision':{
      const patch=validatePolicyPatch(command.patch??{}),law={},current=plannedPolicy(s);
      for(const [key,value] of Object.entries(patch)){
        if(value===current[key])continue;
        const authority=policyAuthority(s,key);
        if(authority==='centralBank')throw new Error('Это решение принимает независимый центральный банк');
        const divided=c.form==='semiPresidential'&&p.executive.role==='president'&&p.executive.primeMinisterParty!==p.executive.playerParty&&!p.coalition.includes(p.executive.playerParty);
        if(authority==='executive'&&!divided){p.lawPolicy[key]=value;p.lastDecision={month:s.month,kind:'executive',key,from:current[key],to:value};p.lastActions.push({kind:'executiveDecision',key,from:current[key],to:value});}
        else if(p.emergency?.ratified&&BUDGET_KEYS.includes(key)&&Math.abs(value-p.lawPolicy[key])<=2){p.emergency.temporaryPolicy??={};p.emergency.temporaryPolicy[key]=value;p.lastActions.push({kind:'emergencyAppropriation',key,value,expires:p.emergency.expires});}
        else law[key]=value;
      }
      if(Object.keys(law).length)return processCommand(s,{kind:'chooseLaw',patch:law,title:command.title},events);
      return;
    }
    case 'proposeBill':return createBill(s,command.patch,{constitutionPatch:command.constitutionPatch,title:command.title,sponsor:p.executive.playerParty});
    case 'renewBudget':return createBill(s,{}, {renewBudget:true,title:'Бюджетные ассигнования на следующий год'});
    case 'amend':return amendBill(s,Number(command.billId),Number(command.articleId),command.value);
    case 'acceptAmendment':return acceptAmendment(s,Number(command.billId),Number(command.amendmentId));
    case 'voteArticle':return voteArticle(s,Number(command.billId),Number(command.articleId));
    case 'voteBill':return voteBill(s,Number(command.billId));
    case 'sign':case 'veto':case 'override':return presidentialDecision(s,Number(command.billId),command.kind);
    case 'referendum':return referendum(s,Number(command.billId));
    case 'withdraw':{const b=p.bills.find(x=>x.id===Number(command.billId));if(!b||['enacted','withdrawn'].includes(b.status)||b.sponsor!==p.executive.playerParty)throw new Error('Нельзя отозвать действующий закон или проект другой партии');b.status='withdrawn';return;}
    case 'coalitionOffer':return offerCoalition(s,command,events);
    case 'coalitionLeave':if(!p.coalition.includes(command.partyId)||command.partyId===p.executive.playerParty)throw new Error('Нельзя исключить эту партию');p.coalition=p.coalition.filter(x=>x!==command.partyId);party(s,command.partyId).cabinetPosts=0;return;
    case 'confidence':return confidenceVote(s,command,events);
    case 'dissolve':if(c.form==='presidential'||!c.dissolution)throw new Error('Конституция не даёт исполнительной власти право распускать парламент');if(p.lastDissolution!==undefined&&s.month-p.lastDissolution<12)throw new Error('Повторный роспуск ограничен годовым сроком');p.scheduledParliament=s.month+2;p.lastDissolution=s.month;events.push('Досрочные парламентские выборы назначены через два месяца.');return;
    case 'impeach':{if(c.form==='parliamentary'||p.executive.legalExposure<=0)throw new Error('Для импичмента нужны установленные нарушения, а не низкий рейтинг');const bill={id:-s.month-2000,revision:0,kind:'constitutional',patch:{},sponsor:p.parties.find(x=>!p.coalition.includes(x.id))?.id};const r=rollCall(s,bill,{impeachment:true});if(r.passed&&p.judicialIndependence>.45){if(p.executive.role==='president')loseOffice(s,'Импичмент за нарушение конституции',events);else p.executive.presidentParty=p.parties.find(x=>x.id!==p.executive.presidentParty).id;}return;}
    case 'emergency':if(p.emergency)throw new Error('Чрезвычайное положение уже действует');if(!(s.government.defaultActive||s.metrics.unemployment>18||s.metrics.inflationYoY>35||command.reason==='disaster'))throw new Error('Для чрезвычайного положения в модели требуется кризис или зарегистрированная катастрофа');if(command.reason==='disaster'&&!p.publicEvents.some(e=>e.type==='disaster'&&s.month-e.month<6))throw new Error('Катастрофа не зарегистрирована');p.emergency={start:s.month,expires:s.month+c.emergencyMonths,ratifyBy:s.month+1,ratified:false};events.push('Временные чрезвычайные полномочия объявлены; требуется ратификация парламента.');return;
    case 'ratifyEmergency':{if(!p.emergency)throw new Error('Чрезвычайное положение не объявлено');const r=rollCall(s,{id:-s.month-3000,revision:0,kind:'ordinary',patch:{},sponsor:p.executive.playerParty});p.emergency.ratified=r.passed;return;}
    case 'endEmergency':p.emergency=null;return;
    case 'constitutionalConflict':{const patch=validatePolicyPatch(command.patch??{competitiveElections:false,parliamentOversight:false,freeMedia:false,protectedJudges:false,judicialReview:false});if(Object.keys(patch).some(k=>!CONSTITUTIONAL_POLICY_KEYS.includes(k)&&k!=='judicialReview'))throw new Error('Это не конституционный конфликт');
      const opposition=1-p.parliamentSupport,resistance=clamp(.45*p.judicialIndependence+.35*p.civilFreedom+.2*opposition),elite=sum(Object.values(p.elites))/4;
      p.executive.legalExposure++;p.lawConflict+=1;p.publicEvents.push({month:s.month,type:'constitutionalConflict',region:null,effect:-.35,attention:.15});
      const success=elite-resistance+hash(s.seed,'conflict',s.month)*.15>.1;p.lastActions.push({kind:'constitutionalConflict',success,resistance,elite});
      if(success){Object.assign(p.lawPolicy,patch);p.emergency={start:s.month,expires:s.month+6,ratifyBy:s.month+1,ratified:true,unconstitutional:true};events.push('Конституционный конфликт: исполнительная власть навязала ограничения. Законность оспаривается; вырос риск отстранения и внутреннего раскола.');}
      else{p.elites.security=clamp(p.elites.security-.15);events.push('Суды, парламент и аппарат блокировали попытку ограничить конституционные права.');if(p.executive.role==='primeMinister')confidenceVote(s,{automatic:true},events);}return;}
    case 'partyProgram':{const x=party(s,p.executive.playerParty);const change=distance(x.platform,command.platform);x.platform=clone(command.platform);x.organization=clamp(x.organization-change*.25,.1,1.5);return;}
    case 'promise':{validatePolicyPatch({[command.key]:command.value});party(s,p.executive.playerParty).promises.push({key:command.key,value:command.value,month:s.month,due:s.month+clamp(Number(command.months??12),3,48),status:'pending'});return;}
    case 'partySplit':return partySplit(s,command);
    case 'partyMerge':return partyMerge(s,command);
    case 'parameters':p.parameters=parametersFrom({...p.parameters,...command.values});return;
  }
}
export function reviewPoliticalPolicy(s,prev,requested,events){const p=s.politics;
  p.lastActions=clone(p.turnActions??[]);events.push(...(p.turnEvents??[]));p.turnCommands=[];p.turnActions=[];p.turnEvents=[];
  p.lastReview=[];p.authorizedActions=[];p.lastSubmittedActions=clone(prev.pendingActions);p.lastCommands=clone(p.pendingCommands);
  expireMonthlyAgenda(s,prev.month,events);
  // Property decisions enter the legislative queue before the economy executes
  // any transfer. Submitted and executed actions are stored separately.
  s.pendingActions=[];
  for(const command of p.pendingCommands){try{processCommand(s,command,events);p.commandHistory.push({...clone(command),processedMonth:s.month,status:'processed'});}catch(e){p.commandHistory.push({...clone(command),processedMonth:s.month,status:'rejected',reason:e.message});p.lastActions.push({kind:'commandRejected',commandId:command.id,reason:e.message});events.push(e.message);}}
  p.pendingCommands=[];
  if(!p.executive.inOffice)return {...prev.policy};
  enactBills(s,events);
  if(p.emergency&&(s.month>=p.emergency.expires||s.month>p.emergency.ratifyBy&&!p.emergency.ratified)){p.emergency=null;events.push('Временные чрезвычайные полномочия истекли; временные ассигнования прекращены.');}
  const lawPatch={},constitutionPatch={},accepted={...p.lawPolicy};
  for(const [key,value] of Object.entries(requested)){
    if(value===prev.policy[key]||value===p.lawPolicy[key])continue;const authority=policyAuthority(s,key);
    if(authority==='executive'){
      const divided=p.constitution.form==='semiPresidential'&&p.executive.role==='president'&&p.executive.primeMinisterParty!==p.executive.playerParty&&!p.coalition.includes(p.executive.playerParty);
      if(divided){lawPatch[key]=value;p.lastReview.push({key,requested:value,accepted:accepted[key],reason:'cabinetAndParliament'});}
      else{accepted[key]=value;p.lawPolicy[key]=value;}
    }
    else if(authority==='centralBank'){p.lastReview.push({key,requested:value,accepted:accepted[key],reason:'independentCentralBank'});}
    else if(p.emergency?.ratified&&BUDGET_KEYS.includes(key)&&Math.abs(value-p.lawPolicy[key])<=2){p.emergency.temporaryPolicy??={};p.emergency.temporaryPolicy[key]=value;p.lastActions.push({kind:'emergencyAppropriation',key,value,expires:p.emergency.expires});}
    else{(authority==='constitution'?constitutionPatch:lawPatch)[key]=value;p.lastReview.push({key,requested:value,accepted:accepted[key],reason:'pendingLegislation'});}
  }
  if(Object.keys(lawPatch).length){const b=createBill(s,lawPatch);if(p.instantRules)decideBill(s,b.id,'accept',events);}
  if(Object.keys(constitutionPatch).length){const b=createBill(s,constitutionPatch,{title:'Изменение прав и конституционных гарантий'});if(p.instantRules)decideBill(s,b.id,'accept',events);}
  for(const a of p.lastSubmittedActions)createBill(s,{}, {actions:[a],title:a.kind==='restructure'?'Обмен государственного долга':'Операция с собственностью'});
  if(p.instantRules)enactBills(s,events);
  // Laws enacted in this month prevail over the unchanged old UI draft.
  Object.assign(accepted,p.lawPolicy);
  const unconstrained=!accepted.parliamentOversight&&p.legislativeConstraint<.35;
  if(unconstrained)for(const b of p.bills.filter(x=>['draft','articles'].includes(x.status)&&x.kind!=='constitutional')){b.status='passed';b.byDecree=true;p.lastActions.push({kind:'decree',billId:b.id});}
  if(unconstrained){enactBills(s,events);Object.assign(accepted,p.lawPolicy);}
  if(s.month>=p.budgetExpires){p.provisionalBudget=true;if(!p.bills.some(b=>b.renewBudget&&['draft','articles','passed','awaitingSignature'].includes(b.status)))createBill(s,{}, {renewBudget:true,title:'Ежегодное продление бюджетных ассигнований'});
    if(!p.constitution.budgetContinuity){for(const key of BUDGET_KEYS)accepted[key]=0;events.push('Ассигнования истекли: до принятия бюджета приостановлены соответствующие закупки и трансферты.');}}
  if(p.emergency?.ratified)Object.assign(accepted,p.emergency.temporaryPolicy??{});
  return accepted;
}
function partyDynamics(s,events){const p=s.politics,current=governedPlatform(s);
  for(const x of p.parties.filter(x=>x.active)){
    if(p.instantRules)x.executiveLoyalty=clamp((x.executiveLoyalty??.5)+.006*((p.coalition.includes(x.id)?.75:.45)-(x.executiveLoyalty??.5)));
    const share=p.poll.parties.find(z=>z.id===x.id)?.share??0;x.organization=clamp(x.organization+.005*(.3+share/25-x.organization),.1,1.5);
    for(const promise of x.promises.filter(z=>z.status==='pending'&&z.due<=s.month)){const achieved=typeof promise.value==='number'?Math.abs(s.policy[promise.key]-promise.value)<=Math.max(.1,Math.abs(promise.value)*.03):s.policy[promise.key]===promise.value;promise.status=achieved?'fulfilled':'broken';if(!achieved)x.brokenPromises++;p.lastActions.push({kind:'promiseReviewed',partyId:x.id,key:promise.key,status:promise.status});}
    if(p.coalition.includes(x.id)&&x.id!==p.executive.playerParty){const agreement=[...p.coalitionAgreements].reverse().find(a=>a.partyId===x.id),target=agreement?.initial?x.platform:agreement?.platform??x.platform,breach=distance(target,current);
      x.coalitionGrievance=clamp(x.coalitionGrievance+.02*(breach-.3)+.003*x.brokenPromises,0,1.5);
      if(x.coalitionGrievance>1){p.coalition=p.coalition.filter(id=>id!==x.id);x.cabinetPosts=0;events.push(`${x.name} вышла из коалиции: расхождения с согласованной программой.`);p.lastActions.push({kind:'coalitionExit',partyId:x.id});}}
  }
  if(s.month%36===0&&p.parties.filter(x=>x.active).length<16&&s.policy.associationFreedom){const groups=makeElectorate(s),unrepresented=groups.filter(g=>Math.min(...p.parties.filter(x=>x.active).map(x=>distance(g.ideal,x.platform)))>p.parameters.newPartyDemand),weight=sum(unrepresented.map(g=>g.weight));
    if(weight>p.poll.eligible*.08){const platform=Object.fromEntries(AXES.map(k=>[k,sum(unrepresented.map(g=>g.weight*g.ideal[k]))/weight])),family=PARTY_FAMILIES.reduce((best,x)=>distance(platformObject(x.platform),platform)<distance(platformObject(best.platform),platform)?x:best,PARTY_FAMILIES[0]);
      const id=`p${p.nextPartyId++}`;p.parties.push({id,family:family.id,name:family.label+' · новая волна '+id.slice(1),color:family.color,leader:'Новый лидер '+id.slice(1),candidateName:'Кандидат '+id.slice(1),platform,organization:.2,competence:.45,candidateCompetence:.45,discipline:.65,active:true,tolerated:false,seats:0,deputies:[],foundedMonth:s.month,parentIds:[],coalitionGrievance:0,brokenPromises:0,promises:[],cabinetPosts:0});events.push('Появилась новая партия, представляющая неудовлетворённый программный спрос.');p.lastActions.push({kind:'partyFounded',partyId:id,unrepresentedShare:weight/p.poll.eligible});}}
  if(!p.instantRules&&s.month%6===0){const opposition=p.parties.filter(x=>x.active&&x.seats>0&&!p.coalition.includes(x.id)).sort((a,b)=>(p.poll.parties.find(x=>x.id===b.id)?.share??0)-(p.poll.parties.find(x=>x.id===a.id)?.share??0))[0];
    if(opposition&&!p.bills.some(b=>b.sponsor===opposition.id&&['draft','articles','awaitingSignature'].includes(b.status))){const redistribution=opposition.platform.economy<0;createBill(s,redistribution?{transfers:clamp(p.lawPolicy.transfers+.5,0,20)}:{incomeTax:clamp(p.lawPolicy.incomeTax-1,0,50)},{sponsor:opposition.id,title:opposition.name+': '+(redistribution?'поддержка доходов':'снижение подоходного налога')});}}
}
function publicEvents(s,flow,events,world){const p=s.politics,r=hash(s.seed,'public-event',s.month);
  if(r<.012*p.corruption*(.2+p.mediaFreedom)){const e={month:s.month,type:'corruption',region:Math.floor(hash(s.seed,s.month,'region')*4),effect:-.18,attention:.12};p.publicEvents.push(e);events.push('Журналистское расследование выявило коррупционный эпизод. Эффект сильнее в затронутом регионе и постепенно затухает.');}
  if(s.government.defaultActive&&!p.publicEvents.some(e=>e.type==='default'&&s.month-e.month<24))p.publicEvents.push({month:s.month,type:'default',region:null,effect:-.25,attention:.08});
  if(world.weather<80&&(world.weather<65||r<.08)&&!p.publicEvents.some(e=>e.type==='disaster'&&s.month-e.month<12)){p.publicEvents.push({month:s.month,type:'disaster',region:2,effect:-.08,attention:.1});events.push('Неурожай затронул аграрные области; политическая реакция зависит также от доходов и помощи.');}
  if(s.month%24===0&&s.services.healthCoverage>.85&&flow.healthcare>0){p.publicEvents.push({month:s.month,type:'serviceSuccess',region:null,effect:.035,attention:.02});}
  p.publicEvents=p.publicEvents.filter(e=>s.month-e.month<60);
}
export function advancePoliticalSystem(s,prev,events,flow={},world=s.world){
  const p=s.politics;if(!p.enabled)return;
  advanceCitizenship(s,prev);publicEvents(s,flow,events,world);
  p.economicHistory.push({month:s.month,national:s.metrics.realIncomeIndex,groups:Array.from({length:5},(_,i)=>(s.households[i*2].realIncomeIndex+s.households[i*2+1].realIncomeIndex)/2)});p.economicHistory=p.economicHistory.slice(-13);
  const {poll}=pollElectorate(s);
  p.presidentApproval+=p.parameters.approvalAdjustment*(poll.presidentApproval-p.presidentApproval);p.cabinetApproval+=p.parameters.approvalAdjustment*(poll.cabinetApproval-p.cabinetApproval);
  p.hiddenApproval+=p.parameters.approvalAdjustment*(poll.approval-p.hiddenApproval);p.publicSupport=p.hiddenApproval;
  p.officialApproval=clamp(p.hiddenApproval+(s.policy.freeMedia?0:.35*(1-p.mediaFreedom))+(s.policy.competitiveElections?0:.15));
  partyDynamics(s,events);
  if(p.instantRules)initializeAgenda(s);
  const budgetBase=prev.metrics.nominalGDPAnnual/12,paid=(key,flowKey)=>flow[flowKey]/Math.max(.001,budgetBase*Math.max(s.policy[key],.001)/100);
  const securityPaid=clamp(paid('securityBudget','politicalSecurity')),patronagePaid=clamp(paid('patronageBudget','politicalPatronage'));
  const economy=clamp(.6+poll.approval-.5-(s.government.defaultActive?.3:0));
  const targets={party:clamp(.35+.3*p.parliamentSupport+.3*patronagePaid*(s.policy.patronageBudget>0?1:0)),administration:clamp(.35+.3*p.civilService+.25*economy),security:clamp(.3+.35*securityPaid+.2*economy-.12*p.lawConflict),business:clamp(.4+.25*economy+.2*s.institutions.contractReliability-.15*p.lawConflict)};
  for(const k of Object.keys(targets))p.elites[k]+=.025*(targets[k]-p.elites[k]);
  const electionPaid=clamp(paid('electionAdministration','politicalElections'));if(s.policy.competitiveElections)p.electoralIntegrity+=.01*((.55+.35*electionPaid)-p.electoralIntegrity);
  const competitive=s.policy.competitiveElections&&p.electoralIntegrity>.45;
  if(!competitive){const support=p.constitution.regime==='military'?p.elites.security:p.constitution.regime==='party'?p.elites.party:Math.min(...Object.values(p.elites));
    const hazard=p.parameters.eliteHazard*logistic((.4-support)*12+(.35-p.hiddenApproval)*4+p.lawConflict*.4);
    p.internalRemovalRisk=hazard;
    if(hash(s.seed,'internal-removal',s.month)<hazard)loseOffice(s,p.constitution.regime==='military'?'Военное руководство сменило главу исполнительной власти':'Правящая коалиция элит отстранила руководителя',events);
  }else p.internalRemovalRisk=0;
  if(p.executive.inOffice&&(s.month>=p.nextParliamentElection||p.scheduledParliament!==null&&s.month>=p.scheduledParliament)){
    const e=conductElection(s,'parliament');installParliament(s,e);p.elections.push(e);p.nextParliamentElection=s.month+p.constitution.parliamentTerm;p.scheduledParliament=null;
    events.push(`Парламентские выборы: участие ${e.turnout.toFixed(1)}%, партия игрока ${party(s,p.executive.playerParty).seats} из ${p.totalSeats} мест.`);
    p.coalition=p.coalition.filter(id=>party(s,id)?.seats>0);allocateCabinet(s);if(p.constitution.form!=='presidential'&&coalitionSeats(s)<=p.totalSeats/2){p.executive.formationDeadline=s.month+3;events.push('После выборов нет большинства: три месяца на соглашение о поддержке кабинета.');}
  }
  if(p.executive.inOffice&&p.nextPresidentElection!==null&&s.month>=p.nextPresidentElection){
    const e=conductElection(s,'president');p.elections.push(e);p.nextPresidentElection=s.month+p.constitution.presidentTerm;p.executive.presidentParty=e.winner;
    events.push(`Президентские выборы: победила ${party(s,e.winner).name}. Парламентский состав рассчитывается отдельно.`);
    if(p.executive.role==='president'){if(p.constitution.termLimit>0&&p.executive.termsServed>=p.constitution.termLimit)loseOffice(s,'Истёк конституционный предел президентских сроков',events);else if(e.winner!==p.executive.playerParty)loseOffice(s,'Поражение на президентских выборах',events);else p.executive.termsServed++;}
  }
  p.parliamentSupport=clamp(coalitionSeats(s)/Math.max(1,p.totalSeats));
  if(p.executive.inOffice&&p.constitution.form!=='presidential'){
    if(p.executive.formationDeadline!==null&&s.month>=p.executive.formationDeadline&&p.parliamentSupport<=.5){if(p.executive.role==='primeMinister')loseOffice(s,'Не сформировано парламентское большинство после выборов',events);else{const leader=p.parties.filter(x=>x.seats>0).sort((a,b)=>b.seats-a.seats)[0];p.coalition=[leader.id];p.executive.primeMinisterParty=leader.id;p.executive.formationDeadline=null;events.push('Президент назначил кабинет крупнейшей парламентской партии.');}}
    else if(p.parliamentSupport<.45&&s.month%6===0&&p.executive.formationDeadline===null)confidenceVote(s,{automatic:true},events);
  }
  // Constitutional conflict can lead to impeachment, with a distinct legal gate.
  if(p.executive.inOffice&&p.executive.role==='president'&&p.executive.legalExposure>0&&p.judicialIndependence>.5&&p.parliamentSupport<.4&&s.month%6===0){try{processCommand(s,{kind:'impeach'},events);}catch{/* No legal majority. */}}
  p.partyHistory.push({month:s.month,approval:p.hiddenApproval,officialApproval:p.officialApproval,parliamentSupport:p.parliamentSupport,parties:p.poll.parties.map(x=>({...x,seats:party(s,x.id).seats})),...(p.dashboardMode?{groups:clone(p.poll.groups),presidentApproval:p.presidentApproval*100,cabinetApproval:p.cabinetApproval*100}:{})});
  p.nextElection=Math.min(p.nextParliamentElection,p.nextPresidentElection??Infinity,p.scheduledParliament??Infinity);if(p.nextElection<=s.month)p.nextElection=s.month+1;
  generateMonthlyAgenda(s);
}
export function politicalMetrics(s){const p=s.politics;if(!p.enabled)return {};
  const totals=electorateTotals(s),player=p.poll.parties.find(x=>x.id===p.executive.playerParty);
  return {executiveApproval:p.hiddenApproval*100,presidentApproval:p.presidentApproval*100,cabinetApproval:p.cabinetApproval*100,officialApproval:p.officialApproval*100,governmentPartyRating:player?.share??0,presidentialCandidateRating:player?.candidateShare??0,eligibleVoters:totals.eligible,foreignResidents:totals.residents,naturalizedCitizens:totals.naturalized,expectedTurnout:p.poll.turnout,coalitionSeatShare:p.parliamentSupport*100,internalRemovalRisk:(p.internalRemovalRisk??0)*100,activeParties:p.parties.filter(x=>x.active).length,politicalLaws:p.bills.filter(x=>x.status==='enacted').length,inOffice:Number(p.executive.inOffice)};
}
export function validatePoliticalSystem(s){const p=s.politics;if(Boolean(s.provenance.politicalMode)!==Boolean(p.enabled))throw new Error('Не совпадает политический режим журнала и состояния');if(!p.enabled)return;
  constitutionFrom(p.constitution);parametersFrom(p.parameters);
  const valid=(x,min=0,max=Infinity)=>Number.isFinite(x)&&x>=min&&x<=max;
  if(['hiddenApproval','officialApproval','presidentApproval','cabinetApproval'].some(k=>!valid(p[k],0,1))||Object.values(p.elites).some(x=>!valid(x,0,1)))throw new Error('Повреждены оценки поддержки');
  if(!Array.isArray(p.parties)||p.parties.length<2||p.parties.length>10000||p.parties.filter(x=>x.active).length>16||new Set(p.parties.map(x=>x.id)).size!==p.parties.length||p.parties.some(x=>!/^#[0-9a-fA-F]{6}$/.test(x.color)||!Number.isInteger(x.seats)||x.seats<0||x.deputies.length!==x.seats||AXES.some(k=>!Number.isFinite(x.platform[k])||Math.abs(x.platform[k])>1)))throw new Error('Повреждены партии или парламент');
  if(sum(p.parties.map(x=>x.seats))!==p.totalSeats||p.totalSeats<p.allocatedSeatBase||p.totalSeats>p.allocatedSeatBase*2)throw new Error('Не сходится число парламентских мест');
  if(!party(s,p.executive.playerParty)||typeof p.executive.inOffice!=='boolean'||p.coalition.some(id=>!party(s,id)))throw new Error('Повреждена исполнительная власть');
  if(!Array.isArray(p.bills)||!Array.isArray(p.pendingCommands)||!Array.isArray(p.rollCalls)||!p.lawPolicy||!p.citizenship||p.citizenship.residents<0||p.citizenship.naturalized<0)throw new Error('Повреждена политическая история');
  if(p.dashboardMode!==undefined&&typeof p.dashboardMode!=='boolean')throw new Error('Повреждено наблюдение за электоратом');
  if(p.nextAgendaMonth!==undefined&&(!Number.isInteger(p.nextAgendaMonth)||p.nextAgendaMonth<0))throw new Error('Повреждён календарь инициатив');
  if(p.dashboardMode){if(p.poll.groups)validateElectorateGroups(p.poll.groups);for(const h of p.partyHistory)if(h.groups)validateElectorateGroups(h.groups);}
  if(p.decisionLimit!==undefined&&p.decisionLimit!==3)throw new Error('Повреждён лимит решений');
  if(p.instantRules&&(!Array.isArray(p.turnCommands)||!Array.isArray(p.turnActions)||!Array.isArray(p.turnEvents)||!p.initiativeCredits||Object.values(p.initiativeCredits).some(v=>!Number.isFinite(v))||p.parties.some(x=>!valid(x.executiveLoyalty,0,1))||p.turnCommands.some(c=>!Number.isInteger(c.id)||c.id<1||c.month!==s.month)))throw new Error('Повреждены решения текущего хода или лояльность партий');
  const citizenship=p.citizenship;if(!valid(citizenship.integration,0,1)||!Array.isArray(citizenship.arrivals)||!Array.isArray(citizenship.naturalizations)||[...citizenship.arrivals,...citizenship.naturalizations].some(b=>!Number.isInteger(b.month)||b.month>s.month||!valid(b.people))||Math.abs(sum(citizenship.arrivals.map(b=>b.people))-citizenship.residents)>1e-8||Math.abs(sum(citizenship.naturalizations.map(b=>b.people))-citizenship.naturalized)>1e-8)throw new Error('Повреждены когорты гражданства');
  if(!Array.isArray(p.economicHistory)||!p.economicHistory.length||p.economicHistory.some(h=>!Number.isInteger(h.month)||!valid(h.national,0)||!Array.isArray(h.groups)||h.groups.length!==5||h.groups.some(x=>!valid(x))))throw new Error('Повреждена память экономического опыта');
  if(new Set(p.bills.map(b=>b.id)).size!==p.bills.length)throw new Error('Повторяющиеся идентификаторы законов');
  validatePolicyPatch(p.lawPolicy);for(const b of p.bills){validatePolicyPatch(b.patch);if(Object.keys(b.constitutionPatch).length)constitutionFrom({...p.constitution,...b.constitutionPatch});b.actions.forEach(validateLegislativeAction);
    if(!Array.isArray(b.articles)||new Set(b.articles.map(a=>a.id)).size!==b.articles.length||b.articles.some(a=>Object.hasOwn(b.patch,a.key)&&JSON.stringify(b.patch[a.key])!==JSON.stringify(a.value)||a.key.startsWith('constitution.')&&JSON.stringify(b.constitutionPatch[a.key.slice(13)])!==JSON.stringify(a.value)))throw new Error('Не совпадают статьи и текст закона');
  }
  s.pendingActions.forEach(validateLegislativeAction);
  if(new Set(p.parties.flatMap(x=>x.deputies.map(d=>d.id))).size!==p.totalSeats||sum(p.parties.map(x=>x.cabinetPosts))>8)throw new Error('Повреждены депутатские мандаты или портфели кабинета');
  for(const r of p.rollCalls)if(!Number.isInteger(r.total)||r.yes+r.no+r.abstain!==r.total||r.deputies.length!==r.total||new Set(r.deputies.map(d=>d.id)).size!==r.total)throw new Error('Повреждена ведомость голосования');
  for(const e of p.elections)if(e.voters>e.eligible||e.results.reduce((v,r)=>v+r.votes,0)!==e.voters||e.kind==='parliament'&&e.results.reduce((v,r)=>v+r.seats,0)!==e.totalSeats)throw new Error('Нарушен учёт голосов');
  if(p.poll.eligible>electorateTotals(s).adults+1e-8)throw new Error('Избирателей больше, чем взрослых жителей');
}
export function executiveDescription(s){const p=s.politics;return p.enabled?`${labelRole(p.executive.role)} · ${partyDisplayName(party(s,p.executive.playerParty))}`:'Экономическая лаборатория';}

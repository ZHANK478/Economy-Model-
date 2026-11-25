import {prepareElectoralPacts,answerElectoralPact,validateElectoralPact} from './electoral-pacts.js';
import {startScenarioPilot} from './scenario-pilots.js';
import {expireWorldDecisions,worldDecisionById,worldDecisionResponse} from './world-decisions.js';
import {decideForeignStep} from './foreign-programme.js';
import {enableGovernmentGoals,chooseGovernmentMilestone,validateGovernmentGoals} from './government-goals.js';
import {startTradeCourse} from './trade-course.js';
import {queueTerritorialProgram} from './territorial-programs.js';
import {activateScenarioDiplomacy,setDiplomacyLevel,setDiplomacyShare,treatyTariff,treatyTariffMessage,validateScenarioDiplomacy,enablePartnerTrade,notifyEUWithdrawal,advanceEUMembership} from './scenario-diplomacy.js';
import {synchronizeCharacters} from './character-world.js';
import {initializePolicyReputation,validatePolicyReputation} from './policy-reputation.js';
import {initializePerformanceVoting,validatePerformanceVoting} from './electoral-performance.js';
import {parliamentary,playerExecutive,cabinetParty} from './parliamentary-state.js';
import {PARLIAMENTARY_CATALOG,initializeParliamentaryRoster,calibrateParliamentaryStart,beginFormation,negotiateCoalition,formPlayerCabinet,rivalCabinet,rotateParliamentaryParties,advanceParliamentary,automaticCabinetDecision,validateParliamentary} from './parliamentary.js';
import {initializeTerritorialGovernment,appointTerritorialLeader,unifyLondonMayor} from './territorial-government.js';
import {initializeLocalGovernment} from './local-government.js';
import {regimeActive,initializeRegimeDynamics,advanceRegimeDynamics,regimeAction,validateRegimeDynamics} from './regime-dynamics.js';
import {accountable,presidential,activateAccountability,clearPresidentialCoalition,recordDecision} from './political-accountability.js';
import {initializeDefense,defenseResponse,defenseMetrics,DEFENSE_ASSUMPTIONS} from './defense.js';
import {britishName,leaderName} from './leader-names.js';
import {respondToCampaign} from './campaign-events.js';
import './config.js';
import {PARTY_FAMILIES,PRESIDENTIAL_PARTY_FAMILIES,partyDisplayName,AXES,CONSTITUTIONAL_POLICY_KEYS,BUDGET_KEYS,clamp,clone,hash,logistic,distance,platformObject,constitutionFrom,parametersFrom} from './political-config.js';
import {pollElectorate,validateElectorateGroups,conductElection,advanceCitizenship,electorateTotals,makeElectorate,governedPlatform,territorialVotes} from './electorate.js';
import {policyAuthority,createBill,amendBill,acceptAmendment,voteArticle,voteBill,presidentialDecision,referendum,enactBills,rollCall,validatePolicyPatch,validateLegislativeAction} from './legislation.js';
import {initializeAgenda,generateMonthlyAgenda,expireMonthlyAgenda,decideBill,plannedPolicy,activatePresidentialDecisions} from './political-agenda.js';
export {plannedPolicy};
export {policyAuthority,createBill};
const sum=a=>a.reduce((v,x)=>v+x,0);
const party=(s,id)=>s.politics.parties.find(x=>x.id===id);
const leaderNames=['Алексей Ветров','Мария Орлова','Данияр Соколов','Елена Миронова','Тимур Лазарев','Анна Полевая','Роман Волков','София Речная'];
const labelRole=role=>role==='president'?'президент':'премьер-министр';
export function initializePoliticalSystem(s,options={}){
  const p=s.politics;p.enabled=Boolean(options.politicalMode);if(!p.enabled)return;
  p.constitution=constitutionFrom(options.politicalOptions?.constitution??{});p.parameters=parametersFrom(options.politicalOptions?.parameters??{});
  if(options.politicalOptions?.ministerialBriefings===1)p.ministerialBriefings=1;
  if(options.politicalOptions?.livingWorld===true)p.livingWorld=true;
  if(options.politicalOptions?.historicalWorld===1){p.historicalWorldStart=0;s.stochastic=false;}
  if(options.politicalOptions?.dashboardMode===true)p.dashboardMode=true;
  if(options.politicalOptions?.electionExperience===1){p.electionExperience=1;p.nameSeed=options.politicalOptions.nameSeed??s.seed;p.autoBudget=true;p.constitution.presidentSystem='plurality';}
  if(Number.isSafeInteger(options.politicalOptions?.characterSeed))p.characterSeed=options.politicalOptions.characterSeed;
  if(options.politicalOptions?.accountabilityRevision===1)p.accountabilityRevision=1;
  if(options.politicalOptions?.startingPoliticsRevision===1&&p.constitution.form==='presidential')p.startingPoliticsRevision=1;
  if(options.politicalOptions?.stablePreferences===true)p.stablePreferences=true;
  if(options.politicalOptions?.partyProgramRevision===1)p.partyProgramRevision=1;
  if(options.politicalOptions?.oppositionRevision===1)p.oppositionRevision=1;
  if(options.politicalOptions?.presidentialDecisionRevision===1){p.presidentialDecisionRevision=1;p.constitution.vetoOverrideAllowed??=true;}
  if(options.politicalOptions?.politicalDynamicsRevision===1)p.politicalDynamicsRevision=1;
  if(options.politicalOptions?.parliamentaryRevision===1&&p.constitution.form==='parliamentary')p.parliamentaryRevision=1;
  if(s.scenario?.id==='uk-2000'&&options.politicalOptions?.guidedOpening===1&&parliamentary(s))p.guidedOpening=1;
  const c=p.constitution,regime=c.regime;
  const competitive=regime==='democracy'||regime==='hybrid',free=regime==='democracy';
  // Starting constitutions are scenario assumptions, not a reform performed
  // without a vote. Political quality still changes gradually thereafter.
  if(!options.policy){Object.assign(s.policy,{competitiveElections:competitive,freeMedia:free,protectedJudges:free,judicialReview:free,parliamentOversight:competitive,associationFreedom:competitive,electionAdministration:.12,securityBudget:regime==='military'?1.2:.35,patronageBudget:competitive?0:.4});}
  Object.assign(p,{judicialIndependence:free?.65:regime==='hybrid'?.45:.2,mediaFreedom:free?.7:regime==='hybrid'?.4:.2,electoralIntegrity:free?.7:regime==='hybrid'?.5:.15,legislativeConstraint:free?.65:regime==='hybrid'?.4:.15,civilFreedom:competitive?.75:.25});
  const families=parliamentary(s)?PARLIAMENTARY_CATALOG:p.startingPoliticsRevision===1?[...PARTY_FAMILIES,...PRESIDENTIAL_PARTY_FAMILIES.filter(x=>!PARTY_FAMILIES.some(y=>y.id===x.id))]:PARTY_FAMILIES;
  p.lawPolicy=clone(s.policy);p.parties=families.map((f,i)=>({id:`p${i+1}`,family:f.id,name:f.label,color:f.color,...(p.startingPoliticsRevision===1?{initialParty:true}:{}),leader:leaderNames[i%leaderNames.length],candidateName:leaderNames[(i+3)%leaderNames.length],platform:platformObject(f.platform),organization:[.75,.92,.9,.9,.7,.65,.65,.55][i]??.7,competence:.45+hash(s.seed,'competence',i)*.35,candidateCompetence:.3+hash(s.seed,'candidate',i)*.65,discipline:.7+hash(s.seed,'discipline',i)*.25,active:true,tolerated:i<4,seats:0,deputies:[],foundedMonth:0,parentIds:[],coalitionGrievance:0,brokenPromises:0,promises:[],cabinetPosts:0}));
  if(parliamentary(s)){initializeParliamentaryRoster(s,options.politicalOptions?.playerFamily??'liberal');if(options.politicalOptions?.factionControlRevision===1)p.parliamentary.factionControl=1;}
  if(p.electionExperience){configureElectionParties(s,options.politicalOptions?.playerFamily??'liberal');assignLeaderNames(s);}
  const player=p.parties.find(x=>x.family===(options.politicalOptions?.playerFamily??'liberal'))??p.parties[2];
  p.executive={role:c.playerRole,playerParty:player.id,presidentParty:c.form==='semiPresidential'&&c.playerRole==='primeMinister'?p.parties[3].id:player.id,primeMinisterParty:player.id,inOffice:true,startedMonth:0,termsServed:1,legalExposure:0,reason:null,formationDeadline:null};
  p.coalition=[];p.coalitionAgreements=[];p.bills=[];p.rollCalls=[];p.pendingCommands=[];p.lastActions=[];p.commandHistory=[];p.nextCommandId=1;p.nextBillId=1;p.nextPartyId=p.parties.length+1;p.nextElectionId=1;p.elections=[];p.groupMemory={};p.publicEvents=[];p.partyHistory=[];p.authorizedActions=[];p.lastSubmittedActions=[];p.lastCommands=[];p.budgetExpires=12;p.provisionalBudget=false;p.emergency=null;p.scheduledParliament=null;p.nextParliamentElection=c.parliamentOffset||c.parliamentTerm;p.nextPresidentElection=c.form==='parliamentary'?null:c.presidentTerm;
  const adults=s.demography.female.slice(216).reduce((v,x)=>v+x,0)+s.demography.male.slice(216).reduce((v,x)=>v+x,0);
  p.citizenship={residents:adults*.025,naturalized:adults*.03,newlyNaturalized:0,arrivals:[{month:-24,people:adults*.025}],naturalizations:[{month:-60,people:adults*.03}],integration:1-Math.exp(-60/96)};
  p.economicHistory=[{month:0,national:s.metrics.realIncomeIndex,...(accountable(s)?{unemployment:s.metrics.unemployment,inflation:s.metrics.inflationYoY}:{}),groups:Array.from({length:5},(_,i)=>(s.households[i*2].realIncomeIndex+s.households[i*2+1].realIncomeIndex)/2)}];
  p.elites={party:.7,administration:.7,security:.7,business:.65};p.hiddenApproval=.58;p.officialApproval=.58;p.lawConflict=0;
  if(options.politicalOptions?.regimeRevision===1)initializeRegimeDynamics(s,{assumptions:options.politicalOptions.regimeAssumptions??{}});
  // Initialize persistent identities before the incoming parliament is elected.
  // Their first appearance must not create a mechanical month-one poll jump.
  pollElectorate(s);
  if(p.startingPoliticsRevision===1)initializeStartingRatings(s);
  if(parliamentary(s))calibrateParliamentaryStart(s);
  if([1,2].includes(options.politicalOptions?.governmentGoalsRevision))enableGovernmentGoals(s,options.politicalOptions.governmentGoalsRevision===2);
  const election=conductElection(s,'parliament',{initial:true});installParliament(s,election);p.elections.push(election);if(parliamentary(s))beginFormation(s);else initialCoalition(s);
  p.nextElection=p.nextPresidentElection===null?p.nextParliamentElection:Math.min(p.nextParliamentElection,p.nextPresidentElection);
  if(p.guidedOpening&&options.politicalOptions?.openingPollRevision===1){
    calibrateParliamentaryStart(s,{seatShares:true});
    p.openingPollRevision=1;
  }
  const {poll}=pollElectorate(s);p.publicSupport=poll.approval;p.hiddenApproval=poll.approval;p.officialApproval=poll.approval;p.presidentApproval=poll.presidentApproval;p.cabinetApproval=poll.cabinetApproval;p.parliamentSupport=coalitionSeats(s)/p.totalSeats;
  p.partyHistory.push({month:0,approval:p.hiddenApproval,officialApproval:p.officialApproval,parliamentSupport:p.parliamentSupport,parties:poll.parties.map(x=>({...x,seats:party(s,x.id).seats})),...(p.dashboardMode?{groups:clone(poll.groups),presidentApproval:p.presidentApproval*100,cabinetApproval:p.cabinetApproval*100}:{})});
  p.initialOptions={constitution:clone(c),parameters:clone(p.parameters),playerFamily:player.family,...(p.electionExperience?{electionExperience:1,nameSeed:p.nameSeed}:{})};
  if(s.scenario?.id==='uk-2000'&&options.politicalOptions?.constituencyProfileRevision===1){
    p.constituencyProfileRevision=1;
    p.initialOptions.constituencyProfileRevision=1;
  }
  if(p.guidedOpening)p.initialOptions.guidedOpening=1;
  if(p.openingPollRevision)p.initialOptions.openingPollRevision=1;
  if(p.governmentGoals)p.initialOptions.governmentGoalsRevision=p.foreignGoalsEnabled?2:1;
  if(p.characterSeed!==undefined)p.initialOptions.characterSeed=p.characterSeed;
  p.instantRules=options.politicalOptions?.instantRules!==false;
  if(p.startingPoliticsRevision===1)p.initialOptions.startingPoliticsRevision=1;
  if(p.stablePreferences)p.initialOptions.stablePreferences=true;
  if(parliamentary(s)){p.initialOptions.parliamentaryRevision=1;if(p.parliamentary.factionControl===1)p.initialOptions.factionControlRevision=1;}
  if(p.politicalDynamicsRevision===1)p.initialOptions.politicalDynamicsRevision=1;
  if(p.partyProgramRevision===1)p.initialOptions.partyProgramRevision=1;
  if(p.oppositionRevision===1)p.initialOptions.oppositionRevision=1;
  p.initialOptions.instantRules=p.instantRules;if(accountable(s))p.initialOptions.accountabilityRevision=1;if(p.presidentialDecisionRevision===1)p.initialOptions.presidentialDecisionRevision=1;
  if(p.dashboardMode)p.initialOptions.dashboardMode=true;
  if(p.ministerialBriefings===1)p.initialOptions.ministerialBriefings=1;
  if(p.livingWorld)p.initialOptions.livingWorld=true;
  if(p.historicalWorldStart===0)p.initialOptions.historicalWorld=1;
  if(options.politicalOptions?.partyContinuity===true){initializePartyContinuity(s);p.initialOptions.partyContinuity=true;}
  if(options.politicalOptions?.agendaSlots!==undefined){if(![1,3].includes(options.politicalOptions.agendaSlots))throw new Error('Неверное число инициатив');p.agendaSlots=options.politicalOptions.agendaSlots;p.initialOptions.agendaSlots=p.agendaSlots;}
  if(options.politicalOptions?.decisionLimit!==undefined){if(options.politicalOptions.decisionLimit!==3)throw new Error('Неверный лимит решений');p.decisionLimit=3;p.initialOptions.decisionLimit=3;}
  if(p.instantRules){initializeAgenda(s);generateMonthlyAgenda(s);}
  if(options.politicalOptions?.regimeRevision===1){p.initialOptions.regimeRevision=1;if(options.politicalOptions.regimeAssumptions)p.initialOptions.regimeAssumptions=clone(options.politicalOptions.regimeAssumptions);}
  if(options.politicalOptions?.performanceRevision===1){initializePerformanceVoting(s);p.initialOptions.performanceRevision=1;}
  if(options.politicalOptions?.reputationRevision===1){initializePolicyReputation(s);p.initialOptions.reputationRevision=1;}
  s.provenance.initialPolicy=clone(s.policy);s.provenance.politicalMode=true;s.provenance.politicalOptions=clone(p.initialOptions);
}

// A two-party presidential scenario, not a claim that presidential institutions
// inevitably produce two parties. Independents aggregate unaffiliated MPs.
function configureElectionParties(s,family){
 const p=s.politics;if(p.constitution.form!=='presidential')return;
 const own=p.parties.find(x=>x.family===family)??p.parties[2];
 const choices=p.parties.filter(x=>x.id!==own.id&&PRESIDENTIAL_PARTY_FAMILIES.some(f=>f.id===x.family));
 const other=p.startingPoliticsRevision===1?choices[Math.floor(hash(p.nameSeed,'starting-opponent')*choices.length)]:p.parties.find(x=>x.family===(own.family==='liberal'?'conservative':'liberal'));
 const independent=p.parties.find(x=>x.id!==own.id&&x.id!==other.id);
 p.majorPartyIds=[own.id,other.id];p.independentPartyId=independent.id;
 const retained=[own,other,independent],mapping=new Map();
 for(const x of p.parties){
  const target=retained.includes(x)?x:retained.slice(0,2).reduce((best,y)=>distance(x.platform,y.platform)<distance(x.platform,best.platform)?y:best,own);
  mapping.set(x.id,target.id);
  if(target!==x){target.seats+=x.seats;target.deputies.push(...x.deputies);x.seats=0;x.deputies=[];x.cabinetPosts=0;}
  x.active=retained.includes(x);
 }
 independent.independent=true;independent.name='Независимые';independent.color='#8a91a3';
 independent.organization=.12;
 independent.platform=platformObject([0,.4,0,0,.4,0]);
 for(const x of [own,other])x.organization=Math.max(.85,x.organization);
 if(p.executive){
  for(const key of ['playerParty','presidentParty','primeMinisterParty'])p.executive[key]=mapping.get(p.executive[key])??p.executive[key];
  // Carry the incumbent mandate and existing MPs forward; no fictitious election.
  p.coalition=presidential(s)?[]:[p.executive.playerParty];
  for(const b of p.bills??[])if(!['enacted','rejected','vetoed','declined','expired','withdrawn','blockedByCourt'].includes(b.status))b.sponsor=mapping.get(b.sponsor)??b.sponsor;
  for(const g of Object.values(p.groupMemory??{}))g.identity=mapping.get(g.identity)??g.identity;
  allocateCabinet(s);
 }
}
// Fit persistent voter preferences, not display-only random numbers. These
// Legacy starts decay with a 24-month time constant. Stable preferences retain
// the calibrated electorate background; outcomes and decisions still matter.
function initializeStartingRatings(s){
 const p=s.politics,[own,other]=p.majorPartyIds;
 const a=20+20*hash(p.nameSeed,'starting-own-rating'),b=20+20*hash(p.nameSeed,'starting-opponent-rating');
 const president=40+20*hash(p.nameSeed,'starting-president-rating');
 p.startingRatings={parties:{[own]:a,[other]:b,[p.independentPartyId]:100-a-b},president};
 p.startingPreferences={parliament:{},president:{},approval:0};
 const logit=x=>Math.log(x/(1-x));
 for(let i=0;i<24;i++){
  const {poll}=pollElectorate(s,{commitMemory:false,trackGroups:false,assignPoll:false});
  for(const row of poll.parties){
   p.startingPreferences.parliament[row.id]=(p.startingPreferences.parliament[row.id]??0)+Math.log(p.startingRatings.parties[row.id]/row.share);
   if(p.majorPartyIds.includes(row.id))p.startingPreferences.president[row.id]=(p.startingPreferences.president[row.id]??0)+Math.log((row.id===own?president:100-president)/row.candidateShare);
  }
  p.startingPreferences.approval+=logit(president/100)-logit(poll.presidentApproval);
 }
}
function assignLeaderNames(s){
 const p=s.politics,used=new Set();
 const name=(key)=>p.characterSeed===undefined?leaderName(p.nameSeed,key,used)
  :britishName(p.characterSeed,key,Number(hash(p.characterSeed,key,'profile')<.43),used);
 for(const x of p.parties){x.leader=name(x.id+'-leader');used.add(x.leader);x.candidateName=name(x.id+'-candidate');used.add(x.candidateName);}
 if(p.executive)p.executive.presidentName=party(s,p.executive.presidentParty).candidateName;
}
function upgradeElections(s){
 const p=s.politics;if(p.electionExperience)return;
 p.electionExperience=1;p.nameSeed=hash(s.seed,'election-names',s.month);p.autoBudget=true;p.constitution.presidentSystem='plurality';
 configureElectionParties(s,party(s,p.executive.playerParty).family);assignLeaderNames(s);
 const recent=new Set(['president','parliament'].map(kind=>p.elections.filter(e=>!e.initial&&e.kind===kind).at(-1)?.id));
 p.electionNoticesSeen=p.elections.filter(e=>!e.initial&&!recent.has(e.id)).map(e=>e.id);
 p.budgetExpires=Math.max(s.month+12,p.budgetExpires);p.provisionalBudget=false;
 for(const b of p.bills)if(b.renewBudget&&!['enacted','rejected','vetoed','declined','expired','withdrawn'].includes(b.status)){b.status='withdrawn';b.executiveResponse={decision:'automaticBudget',month:s.month};}
 pollElectorate(s,{commitMemory:false});
 const frame=p.partyHistory.findLast(h=>h.month===s.month);
 if(frame){frame.parties=p.poll.parties.map(x=>({...x,seats:party(s,x.id).seats}));if(p.dashboardMode)frame.groups=clone(p.poll.groups);}
 p.parliamentSupport=coalitionSeats(s)/p.totalSeats;
 Object.assign(s.metrics,politicalMetrics(s));
 const current=s.history.find(h=>h.month===s.month);if(current)Object.assign(current,politicalMetrics(s));
}
export function enableDefense(s){if(s.politics.enabled&&s.politics.executive.inOffice&&!s.defense?.enabled)executePolitical(s,{kind:'activateDefense'});}
export function enablePresidentialDecisions(s){if(s.politics.enabled&&s.politics.presidentialDecisionRevision!==1&&s.politics.executive.inOffice)executePolitical(s,{kind:'upgradePresidentialDecisions'});}
export function enableLocalGovernment(s){if(s.politics.enabled&&s.politics.executive.inOffice&&!s.localGovernment)executePolitical(s,{kind:'activateLocalGovernment'});}
export function enablePartyPrograms(s){if(s.politics.enabled&&s.politics.executive.inOffice&&s.politics.partyProgramRevision!==1)executePolitical(s,{kind:'upgradePartyPrograms'});}
export function enableOppositionCompetition(s){if(s.politics.enabled&&s.politics.executive.inOffice&&s.politics.oppositionRevision!==1)executePolitical(s,{kind:'upgradeOpposition'});}
export function enablePoliticalDynamics(s){
 if(s.politics.enabled&&s.politics.executive.inOffice&&!s.politics.politicalDynamicsRevision)executePolitical(s,{kind:'upgradePoliticalDynamics'});
}
export function enableFactionControl(s){if(parliamentary(s)&&s.politics.parliamentary.factionControl!==1&&s.politics.executive.inOffice)executePolitical(s,{kind:'activateFactionControl'});}
export function enableStablePreferences(s){if(s.politics.enabled&&!s.politics.stablePreferences&&s.politics.startingPreferences&&s.politics.executive.inOffice)executePolitical(s,{kind:'stabilizePreferences'});}
export function enableAccountability(s){if(s.politics.enabled&&!accountable(s)&&s.politics.executive.inOffice)executePolitical(s,{kind:'upgradeAccountability'});}

export function enableElectionExperience(s){
 if(s.politics.enabled&&s.politics.executive.inOffice&&!s.politics.electionExperience)executePolitical(s,{kind:'upgradeElections'});
}

export function coalitionSeats(s){return sum(s.politics.parties.filter(x=>presidential(s)?x.id===s.politics.executive.playerParty:s.politics.coalition.includes(x.id)).map(x=>x.seats));}
function installParliament(s,election){const p=s.politics;p.totalSeats=election.totalSeats;p.allocatedSeatBase=p.constitution.seats;
  for(const x of p.parties){x.seats=election.results.find(r=>r.id===x.id)?.seats??0;x.deputies=Array.from({length:x.seats},(_,i)=>({id:`${election.id}-${x.id}-${i}`,district:election.districts.filter(d=>d.winner===x.id)[i]?.id??null}));}
  p.lastParliamentElection=election.id;
}
function initialCoalition(s){if(presidential(s)){clearPresidentialCoalition(s);return;}const p=s.politics,player=party(s,p.executive.playerParty),ordered=p.parties.filter(x=>x.active&&x.id!==player.id&&x.seats>0).sort((a,b)=>distance(a.platform,player.platform)-distance(b.platform,player.platform));
  p.coalition=[player.id];let seats=player.seats;
  for(const x of ordered){if(seats>p.totalSeats/2)break;p.coalition.push(x.id);seats+=x.seats;}
  allocateCabinet(s);p.coalitionAgreements=p.coalition.map(id=>({partyId:id,month:0,platform:clone(party(s,id).platform),policy:clone(s.policy),posts:party(s,id).cabinetPosts,initial:true}));
}
function allocateCabinet(s){if(presidential(s)){clearPresidentialCoalition(s);return;}const p=s.politics,members=p.parties.filter(x=>p.coalition.includes(x.id)),total=coalitionSeats(s);for(const x of p.parties)x.cabinetPosts=0;
  const quotas=members.map(x=>8*x.seats/Math.max(1,total)),posts=quotas.map(Math.floor),left=8-sum(posts),order=quotas.map((v,i)=>({i,r:v-posts[i]})).sort((a,b)=>b.r-a.r);
  for(let i=0;i<left&&order.length;i++)posts[order[i%order.length].i]++;members.forEach((x,i)=>x.cabinetPosts=posts[i]);
}
export function schedulePolitical(s,command){const p=s.politics;if(!p.enabled)throw new Error('Включите политическую игру при создании страны');if(!p.executive.inOffice&&!['unifyLondonMayor','enableGovernmentGoals','retireGovernmentProgramme'].includes(command?.kind))throw new Error('Ваше правление завершено');
  const kinds=['upgradePoliticalDynamics','activateFactionControl','setFactionVote','negotiateCoalition','formCabinet','stabilizePreferences','activateLocalGovernment','upgradePartyPrograms','upgradeOpposition','upgradePresidentialDecisions','upgradeAccountability','activateDefense','defenseResponse','upgradeElections','setLivingWorld','enableHistoricalWorld','campaignResponse','proposeBill','chooseLaw','policyDecision','decideBill','activateInstantRules','setAgendaSlots','setDecisionLimit','setDashboardMode','setPartyContinuity','amend','acceptAmendment','voteArticle','voteBill','sign','veto','override','withdraw','referendum','coalitionOffer','coalitionLeave','confidence','dissolve','impeach','emergency','ratifyEmergency','endEmergency','constitutionalConflict','partyProgram','promise','partySplit','partyMerge','parameters','renewBudget'];
  kinds.push('enableGovernmentGoals','retireGovernmentProgramme','alignOpeningPoll','chooseGovernmentMilestone','startTradeCourse','activateTerritorialGovernment','unifyLondonMayor','reformTerritorialFiscal','appointTerritorialLeader','territorialProgramme','regimeAction','activateScenarioDiplomacy','setDiplomacyLevel','setDiplomacyShare','enablePartnerTrade','notifyEUWithdrawal','enablePressMarket','answerWorldDecision','enableMinisterialBriefings','foreignProgrammeStep','startScenarioPilot','enableElectoralPacts','answerElectoralPact','enableConstituencyProfiles');
  if(!kinds.includes(command?.kind))throw new Error('Неизвестное политическое действие');
  const c=clone(command);delete c.id;delete c.month;if(c.kind==='activateDefense')c.assumptions??=clone(DEFENSE_ASSUMPTIONS);
  if(['proposeBill','chooseLaw','policyDecision'].includes(c.kind)){validatePolicyPatch(c.patch??{});if(c.constitutionPatch)constitutionFrom({...p.constitution,...c.constitutionPatch});if(c.actions)c.actions.forEach(validateLegislativeAction);}
  if(c.kind==='parameters')parametersFrom({...p.parameters,...c.values});
  if(c.kind==='partyProgram'&&(!c.platform||AXES.some(k=>!Number.isFinite(c.platform[k])||Math.abs(c.platform[k])>1)))throw new Error('Неверная программа партии');
  const request={...c,id:p.nextCommandId++,month:s.month};p.pendingCommands.push(request);return request;
}
const FREE_COMMANDS=new Set(['enableGovernmentGoals','retireGovernmentProgramme','alignOpeningPoll','chooseGovernmentMilestone','startTradeCourse','activateTerritorialGovernment','unifyLondonMayor','reformTerritorialFiscal','appointTerritorialLeader','enablePressMarket','enablePartnerTrade','activateScenarioDiplomacy','upgradePoliticalDynamics','activateFactionControl','setFactionVote','stabilizePreferences','activateLocalGovernment','upgradePartyPrograms','upgradeOpposition','upgradePresidentialDecisions','upgradeAccountability','activateDefense','upgradeElections','activateInstantRules','setAgendaSlots','setDecisionLimit','setDashboardMode','setPartyContinuity','parameters','campaignResponse','setLivingWorld','enableHistoricalWorld','answerWorldDecision','enableMinisterialBriefings','enableElectoralPacts','answerElectoralPact','enableConstituencyProfiles']);
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
  const pending=clone(s.pendingActions),nextAction=s.nextActionId,defenseBackup=s.defense?clone(s.defense):undefined;
  const syncRoster=s.characters&&['formCabinet','coalitionLeave','coalitionOffer','partyMerge','partySplit','confidence','enableMinisterialBriefings'].includes(command?.kind);
  const changesTerritory=['appointTerritorialLeader','activateTerritorialGovernment','unifyLondonMayor','reformTerritorialFiscal','territorialProgramme'].includes(command?.kind);
  const territoryBackup=changesTerritory&&s.territorialGovernment?clone(s.territorialGovernment):null;
  const characterBackup=syncRoster?clone(s.characters):null;
  try{
    if(parliamentary(s)&&!playerExecutive(s)&&['emergency','ratifyEmergency','endEmergency','constitutionalConflict','defenseResponse','dissolve','sign','veto','override','coalitionLeave'].includes(command.kind))throw new Error('Это полномочие действующего правительства');
    assertDecisionAvailable(s,command);
    const request=schedulePolitical(s,command),p=s.politics; p.pendingCommands.pop();
    initializeAgenda(s);const start=p.lastActions.length,events=[];
    const result=processCommand(s,request,events);
    if(accountable(s)){
      const before=p.poll;pollElectorate(s,{commitMemory:false});
      const reaction=(result??p.bills.find(b=>b.id===Number(request.billId)))?.publicReaction;if(reaction){const a=before?.parties.find(x=>x.id===p.executive.playerParty),b=p.poll.parties.find(x=>x.id===p.executive.playerParty);reaction.presidentDelta=(b?.candidateShare??0)-(a?.candidateShare??0);reaction.partyDelta=(b?.share??0)-(a?.share??0);}
      Object.assign(s.metrics,politicalMetrics(s));
    }
    if(syncRoster)synchronizeCharacters(s,events);
    p.turnCommands.push(clone(request));p.turnActions.push(...clone(p.lastActions.slice(start)));p.turnEvents.push(...events);
    p.commandHistory.push({...clone(request),processedMonth:s.month,timing:'currentTurn',status:'processed'});
    return result;
  }catch(e){if(changesTerritory){if(territoryBackup)s.territorialGovernment=territoryBackup;else delete s.territorialGovernment;}if(characterBackup)s.characters=characterBackup;if(defenseBackup)s.defense=defenseBackup;else delete s.defense;s.politics=backup;s.pendingActions=pending;s.nextActionId=nextAction;throw e;}
}
export function enableInstantPolitics(s){
  if(!s.politics.enabled||s.politics.instantRules||!s.politics.executive.inOffice)return;
  executePolitical(s,{kind:'activateInstantRules'});
  // Honor actions already selected in an older save without another month.
  const queued=clone(s.politics.pendingCommands);s.politics.pendingCommands=[];
  for(const command of queued){try{executePolitical(s,command.kind==='proposeBill'?{...command,kind:'chooseLaw'}:command.kind==='renewBudget'?{kind:'chooseLaw',renewBudget:true,title:'Бюджет на следующий год'}:command);}catch{/* Invalid legacy selections stay in their old saved history. */}}
}
function initializePartyContinuity(s){
  const p=s.politics;if(p.partyContinuity)return;
  p.partyContinuity=true;
  p.executive.presidentName=party(s,p.executive.presidentParty).candidateName;
  p.executive.leaderStartedMonth=p.executive.startedMonth;
  p.executive.leaderHistory=[];
  const own=party(s,p.executive.playerParty);own.candidateGeneration=0;
  own.candidateIncumbent=p.executive.presidentParty===own.id;
}
function prepareSuccessor(s,events){
  const p=s.politics,e=p.executive,c=p.constitution;
  if(!p.partyContinuity||e.role!=='president'||!e.inOffice||!c.termLimit||e.termsServed<c.termLimit||s.month<p.nextPresidentElection-12)return;
  const own=party(s,e.playerParty);if(own.candidateName!==e.presidentName)return;
  const previous=own.candidateName,generation=(own.candidateGeneration??0)+1;
  let index=(p.parties.indexOf(own)+3+generation)%leaderNames.length;
  if(leaderNames[index]===previous)index=(index+1)%leaderNames.length;
  own.candidateGeneration=generation;own.candidateName=p.electionExperience?leaderName(p.nameSeed,own.id+'-successor-'+generation,new Set(p.parties.map(x=>x.candidateName).concat(e.leaderHistory.map(x=>x.name),e.presidentName))):leaderNames[index];
  own.candidateCompetence=.3+hash(s.seed,'successor-competence',own.id,generation)*.65;
  own.candidateIncumbent=false;
  events.push(`Предел сроков действующего президента: партия выдвинула преемника ${own.candidateName}. Для продолжения правления он должен победить на выборах.`);
}
function installSuccessor(s,events){
  const p=s.politics,e=p.executive,own=party(s,e.playerParty);
  e.leaderHistory.push({name:e.presidentName,startedMonth:e.leaderStartedMonth,endedMonth:s.month,termsServed:e.termsServed,reason:'Смена президента своей партии'});
  e.presidentName=own.candidateName;e.leaderStartedMonth=s.month;e.termsServed=1;e.legalExposure=0;
  own.candidateIncumbent=true;
  events.push(`Президент ${own.candidateName} вступил в должность. Вы продолжаете за исполнительную власть своей партии; у нового президента первый срок.`);
}
function loseOffice(s,reason,events){const p=s.politics;if(!p.executive.inOffice)return;
  p.executive.inOffice=false;p.executive.reason=reason;p.executive.endedMonth=s.month;
  p.executive.report={month:s.month,monthsServed:s.month-p.executive.startedMonth,reason,approval:p.hiddenApproval*100,partyRating:p.poll?.parties.find(x=>x.id===p.executive.playerParty)?.share??0,seatShare:party(s,p.executive.playerParty).seats/p.totalSeats*100,realGDP:s.metrics.realGDPAnnualized,gdpPerCapita:s.metrics.gdpPerCapitaReal,inflation:s.metrics.inflationYoY,unemployment:s.metrics.unemployment,debt:s.metrics.debtRatio,population:s.population,gini:s.metrics.giniDisposable,laws:p.bills.filter(x=>x.status==='enacted').length};
  events.push(`Правление завершено: ${reason}. Итоговый отчёт сохранён; новую страну можно начать отдельно.`);
}
function confidenceVote(s,{replacement=null,automatic=false}={},events){const p=s.politics,c=p.constitution;if(parliamentary(s)){const changed=rivalCabinet(s,events);if(!changed)throw new Error('Нет большинства за альтернативный кабинет');return;}if(c.form==='presidential')throw new Error('Президентское правление не прекращается обычным вотумом недоверия');
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
  if(p.politicalDynamicsRevision&&parliamentary(s)&&['coalitionOffer','coalitionLeave'].includes(command.kind))throw new Error('Измените состав кабинета через парламентские переговоры');
  if(presidential(s)&&['coalitionOffer','coalitionLeave','confidence','partySplit','partyMerge'].includes(command.kind))throw new Error('В президентском сценарии две партии и независимые; коалиций и смены кабинета парламентом нет.');
  if(accountable(s)&&command.kind==='promise')throw new Error('Обещания отключены: поддержка зависит от решений и результатов.');
  switch(command.kind){
    case 'enableConstituencyProfiles':
      if(s.scenario?.id==='uk-2000')p.constituencyProfileRevision=1;
      return;
    case 'alignOpeningPoll':{
      if(!p.guidedOpening||s.month!==0||p.openingPollRevision)throw new Error('Стартовый опрос уже установлен или недоступен.');
      calibrateParliamentaryStart(s,{seatShares:true});
      p.openingPollRevision=1;
      const {poll}=pollElectorate(s,{commitMemory:false});
      p.partyHistory=p.partyHistory.map(frame=>frame.month!==0?frame:{...frame,
        parties:poll.parties.map(x=>({...x,seats:party(s,x.id).seats})),
        ...(p.dashboardMode?{groups:clone(poll.groups)}:{}),
      });
      const metrics=politicalMetrics(s);
      Object.assign(s.metrics,metrics);
      const opening=s.history?.find(row=>row.month===0);
      if(opening)Object.assign(opening,metrics);
      return;
    }
    case 'activateScenarioDiplomacy':return activateScenarioDiplomacy(s);
    case 'enablePressMarket':if(s.scenario?.id==='uk-2000'&&s.economy)p.pressRevision=1;return;
    case 'retireGovernmentProgramme':
      if(p.governmentGoals)p.governmentProgrammeRetired=true;
      return;
    case 'enableGovernmentGoals':return enableGovernmentGoals(s,command.foreign===true);
    case 'startScenarioPilot':return startScenarioPilot(s,command.pilot,command.choice);
    case 'foreignProgrammeStep':return decideForeignStep(s,command,rollCall,events);
    case 'chooseGovernmentMilestone':return chooseGovernmentMilestone(s,command.milestoneId);
    case 'startTradeCourse':
      if(p.governmentGoals)throw new Error('Торговый курс завершён');
      return startTradeCourse(s);
    case 'enablePartnerTrade':return enablePartnerTrade(s);
    case 'notifyEUWithdrawal':
      if(!playerExecutive(s)||p.parliamentSupport<=.5)throw new Error('Для выхода нужно действующее правительство с большинством в парламенте.');
      return notifyEUWithdrawal(s);
    case 'setDiplomacyShare':
      if(!playerExecutive(s))throw new Error('Программы утверждает действующее правительство.');
      return setDiplomacyShare(s,command.organization,command.share,command.budgeted===true);
    case 'setDiplomacyLevel':
      if(!playerExecutive(s))throw new Error('Программы утверждает действующее правительство.');
      return setDiplomacyLevel(s,command.organization,command.level);
    case 'regimeAction':return regimeAction(s,command.action,events);
    case 'upgradePresidentialDecisions':activatePresidentialDecisions(s);return;
    case 'upgradePoliticalDynamics':p.politicalDynamicsRevision=1;return;
    case 'upgradeAccountability':activateAccountability(s);return;
    case 'stabilizePreferences':{
      if(p.stablePreferences||!p.startingPreferences)return;
      const factor=Math.exp(-s.month/24);
      for(const key of ['parliament','president'])for(const id of Object.keys(p.startingPreferences[key]))p.startingPreferences[key][id]*=factor;
      p.startingPreferences.approval*=factor;p.stablePreferences=true;return;
    }
    case 'unifyLondonMayor':unifyLondonMayor(s);return;
    case 'reformTerritorialFiscal':if(s.territorialGovernment)s.territorialGovernment.fiscalRevision=2;return;
    case 'activateTerritorialGovernment':initializeTerritorialGovernment(s,territorialVotes,{londonMayor:command.londonMayorRevision===1});return;
    case 'territorialProgramme':
      if(!playerExecutive(s))throw new Error('Финансирование утверждает действующее правительство.');
      queueTerritorialProgram(s,command);return;
    case 'appointTerritorialLeader':
      if(!playerExecutive(s))throw new Error('Назначение проводит действующее правительство.');
      appointTerritorialLeader(s,command.officeId);return;
    case 'activateLocalGovernment':initializeLocalGovernment(s,command.assumptions);return;
    case 'upgradePartyPrograms':p.partyProgramRevision=1;return;
    case 'upgradeOpposition':p.oppositionRevision=1;return;
    case 'activateDefense':{initializeDefense(s,command.assumptions);Object.assign(s.metrics,defenseMetrics(s));const current=s.history.find(h=>h.month===s.month);if(current)Object.assign(current,defenseMetrics(s));return;}
    case 'defenseResponse':return defenseResponse(s,command.action);
    case 'upgradeElections':return upgradeElections(s);
    case 'answerWorldDecision':return worldDecisionResponse(s,worldDecisionById(command.eventId),command,rollCall);
    case 'enableMinisterialBriefings':
      p.ministerialBriefings=1;
      return;
    case 'enableHistoricalWorld':p.historicalWorldStart??=s.month+1;s.stochastic=false;return;
    case 'setLivingWorld':if(!p.livingWorld)p.livingWorldStart=s.month;p.livingWorld=true;s.stochastic=false;return;
    case 'enableElectoralPacts':
      if(s.scenario?.id!=='uk-2000')throw new Error('Предвыборные соглашения доступны в британском сценарии.');
      p.electoralPactRevision=1;
      prepareElectoralPacts(s,()=>conductElection(s,'parliament',{preview:true}));
      return;
    case 'answerElectoralPact':return answerElectoralPact(s,command.choice);
    case 'campaignResponse':return respondToCampaign(s,command);
    case 'activateInstantRules':p.initialOptions.instantRules??=false;p.instantRules=true;initializeAgenda(s);generateMonthlyAgenda(s);return;
    case 'setPartyContinuity':initializePartyContinuity(s);return;
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
    case 'activateFactionControl':if(!parliamentary(s))throw new Error('Нужна парламентская игра');p.parliamentary.factionControl=1;return;
    case 'setFactionVote':if(!parliamentary(s)||playerExecutive(s)||p.parliamentary.factionControl!==1||!['accept','reject','abstain'].includes(command.vote))throw new Error('Выберите позицию оппозиционной фракции');p.parliamentary.oppositionVote=command.vote;return;
    case 'negotiateCoalition':if(!parliamentary(s))throw new Error('Переговоры доступны в парламентской демократии');return negotiateCoalition(s,command.partyId,command.mode,events);
    case 'formCabinet':if(!parliamentary(s))throw new Error('Кабинет доступен в парламентской демократии');return formPlayerCabinet(s,events,command);
    case 'decideBill':return decideBill(s,command.billId,command.decision,events,{deferReferendum:command.deferReferendum===true});
    case 'chooseLaw':{
      const b=createBill(s,command.patch??{},{constitutionPatch:command.constitutionPatch,title:command.title,sponsor:p.executive.playerParty,actions:command.actions,renewBudget:command.renewBudget});
      if(command.actions){const ids=new Set(command.actions.map(a=>a.id));s.pendingActions=s.pendingActions.filter(a=>!ids.has(a.id));s.nextActionId=Math.max(s.nextActionId,...command.actions.map(a=>a.id+1));}
      return decideBill(s,b.id,'accept',events,{deferReferendum:command.deferReferendum===true});
    }
    case 'policyDecision':{
      const patch=validatePolicyPatch(command.patch??{}),law={},current=plannedPolicy(s);
      for(const [key,value] of Object.entries(patch)){
        if(value===current[key])continue;
        const authority=policyAuthority(s,key);
        if(authority==='treaty')throw new Error(treatyTariffMessage);
        if(authority==='centralBank')throw new Error('Это решение принимает независимый центральный банк');
        if(parliamentary(s)&&!playerExecutive(s)&&authority==='executive')throw new Error('В оппозиции доступны законодательные предложения; исполнительные решения принимает кабинет');
        const divided=c.form==='semiPresidential'&&p.executive.role==='president'&&p.executive.primeMinisterParty!==p.executive.playerParty&&!p.coalition.includes(p.executive.playerParty);
        if(authority==='executive'&&!divided){p.lawPolicy[key]=value;p.lastDecision={month:s.month,kind:'executive',key,from:current[key],to:value};p.lastActions.push({kind:'executiveDecision',key,from:current[key],to:value});}
        else if(p.emergency?.ratified&&BUDGET_KEYS.includes(key)&&Math.abs(value-p.lawPolicy[key])<=2){p.emergency.temporaryPolicy??={};p.emergency.temporaryPolicy[key]=value;p.lastActions.push({kind:'emergencyAppropriation',key,value,expires:p.emergency.expires});}
        else law[key]=value;
      }
      if(Object.keys(law).length)return processCommand(s,{kind:'chooseLaw',patch:law,title:command.title,deferReferendum:command.deferReferendum===true},events);
      return;
    }
    case 'proposeBill':return createBill(s,command.patch,{constitutionPatch:command.constitutionPatch,title:command.title,sponsor:p.executive.playerParty});
    case 'renewBudget':return createBill(s,{}, {renewBudget:true,title:'Бюджетные ассигнования на следующий год'});
    case 'amend':return amendBill(s,Number(command.billId),Number(command.articleId),command.value);
    case 'acceptAmendment':return acceptAmendment(s,Number(command.billId),Number(command.amendmentId));
    case 'voteArticle':return voteArticle(s,Number(command.billId),Number(command.articleId));
    case 'voteBill':return voteBill(s,Number(command.billId));
    case 'sign':case 'veto':case 'override':return presidentialDecision(s,Number(command.billId),command.kind);
    case 'referendum':{const b=p.bills.find(b=>b.id===Number(command.billId));referendum(s,Number(command.billId));if(b.status==='passed')b.effectiveMonth=s.month+1;recordDecision(s,b,'accept',accountable(s)?makeElectorate(s):[]);return b;}
    case 'withdraw':{const b=p.bills.find(x=>x.id===Number(command.billId));if(!b||['enacted','withdrawn'].includes(b.status)||b.sponsor!==p.executive.playerParty)throw new Error('Нельзя отозвать действующий закон или проект другой партии');b.status='withdrawn';return;}
    case 'coalitionOffer':return offerCoalition(s,command,events);
    case 'coalitionLeave':if(!p.coalition.includes(command.partyId)||command.partyId===p.executive.playerParty)throw new Error('Нельзя исключить эту партию');p.coalition=p.coalition.filter(x=>x!==command.partyId);party(s,command.partyId).cabinetPosts=0;return;
    case 'confidence':return confidenceVote(s,command,events);
    case 'dissolve':if(!c.dissolution)throw new Error('Конституция не даёт исполнительной власти право распускать парламент');if(p.lastDissolution!==undefined&&s.month-p.lastDissolution<12)throw new Error('Повторный роспуск ограничен годовым сроком');p.scheduledParliament=s.month+2;p.lastDissolution=s.month;events.push('Досрочные парламентские выборы назначены через два месяца.');return;
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
  advanceEUMembership(s,events);
  if(!p.executive.inOffice)return {...prev.policy};
  enactBills(s,events);
  if(p.emergency&&(s.month>=p.emergency.expires||s.month>p.emergency.ratifyBy&&!p.emergency.ratified)){p.emergency=null;events.push('Временные чрезвычайные полномочия истекли; временные ассигнования прекращены.');}
  if(parliamentary(s))automaticCabinetDecision(s,events);
  const lawPatch={},constitutionPatch={},accepted={...p.lawPolicy};
  for(const [key,value] of Object.entries(requested)){
    if(value===prev.policy[key]||value===p.lawPolicy[key])continue;
    if(parliamentary(s)&&!playerExecutive(s)){p.lastReview.push({key,requested:value,accepted:accepted[key],reason:'opposition'});continue;}
    const authority=policyAuthority(s,key);
    if(authority==='executive'){
      const divided=p.constitution.form==='semiPresidential'&&p.executive.role==='president'&&p.executive.primeMinisterParty!==p.executive.playerParty&&!p.coalition.includes(p.executive.playerParty);
      if(divided){lawPatch[key]=value;p.lastReview.push({key,requested:value,accepted:accepted[key],reason:'cabinetAndParliament'});}
      else{accepted[key]=value;p.lawPolicy[key]=value;}
    }
    else if(authority==='treaty'){p.lastReview.push({key,requested:value,accepted:treatyTariff(s),reason:'treaty'});}
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
  if(unconstrained)for(const b of p.bills.filter(x=>['draft','articles'].includes(x.status)&&x.kind!=='constitutional'&&(!parliamentary(s)||x.sponsor===cabinetParty(s)))){b.status='passed';b.byDecree=true;p.lastActions.push({kind:'decree',billId:b.id});}
  if(unconstrained){enactBills(s,events);Object.assign(accepted,p.lawPolicy);}
  if(p.autoBudget&&s.month>=p.budgetExpires){p.budgetExpires=s.month+12;p.provisionalBudget=false;}
  if(!p.autoBudget&&s.month>=p.budgetExpires){p.provisionalBudget=true;if(!p.bills.some(b=>b.renewBudget&&['draft','articles','passed','awaitingSignature'].includes(b.status)))createBill(s,{}, {renewBudget:true,title:'Ежегодное продление бюджетных ассигнований'});
    if(!p.constitution.budgetContinuity){for(const key of BUDGET_KEYS)accepted[key]=0;events.push('Ассигнования истекли: до принятия бюджета приостановлены соответствующие закупки и трансферты.');}}
  if(p.emergency?.ratified)Object.assign(accepted,p.emergency.temporaryPolicy??{});
  if(treatyTariff(s)!==undefined)accepted.tariff=treatyTariff(s);
  return accepted;
}
function partyDynamics(s,events){const p=s.politics,current=governedPlatform(s);
  for(const x of p.parties.filter(x=>x.active)){
    if(p.instantRules&&!accountable(s))x.executiveLoyalty=clamp((x.executiveLoyalty??.5)+.006*((p.coalition.includes(x.id)?.75:.45)-(x.executiveLoyalty??.5)));
    const share=p.poll.parties.find(z=>z.id===x.id)?.share??0;x.organization=clamp(x.organization+.005*(.3+share/25-x.organization),.1,1.5);
    for(const promise of (accountable(s)?[]:x.promises).filter(z=>z.status==='pending'&&z.due<=s.month)){const achieved=typeof promise.value==='number'?Math.abs(s.policy[promise.key]-promise.value)<=Math.max(.1,Math.abs(promise.value)*.03):s.policy[promise.key]===promise.value;promise.status=achieved?'fulfilled':'broken';if(!achieved)x.brokenPromises++;p.lastActions.push({kind:'promiseReviewed',partyId:x.id,key:promise.key,status:promise.status});}
    if(!parliamentary(s)&&!presidential(s)&&p.coalition.includes(x.id)&&x.id!==p.executive.playerParty){const agreement=[...p.coalitionAgreements].reverse().find(a=>a.partyId===x.id),target=agreement?.initial?x.platform:agreement?.platform??x.platform,breach=distance(target,current);
      x.coalitionGrievance=clamp(x.coalitionGrievance+.02*(breach-.3)+.003*x.brokenPromises,0,1.5);
      if(x.coalitionGrievance>1){p.coalition=p.coalition.filter(id=>id!==x.id);x.cabinetPosts=0;events.push(`${x.name} вышла из коалиции: расхождения с согласованной программой.`);p.lastActions.push({kind:'coalitionExit',partyId:x.id});}}
  }
  if(!parliamentary(s)&&!(p.electionExperience&&p.constitution.form==='presidential')&&s.month%36===0&&p.parties.filter(x=>x.active).length<16&&s.policy.associationFreedom){const groups=makeElectorate(s),unrepresented=groups.filter(g=>Math.min(...p.parties.filter(x=>x.active).map(x=>distance(g.ideal,x.platform)))>p.parameters.newPartyDemand),weight=sum(unrepresented.map(g=>g.weight));
    if(weight>p.poll.eligible*.08){const platform=Object.fromEntries(AXES.map(k=>[k,sum(unrepresented.map(g=>g.weight*g.ideal[k]))/weight])),family=(p.startingPoliticsRevision===1?PRESIDENTIAL_PARTY_FAMILIES:PARTY_FAMILIES).reduce((best,x)=>distance(platformObject(x.platform),platform)<distance(platformObject(best.platform),platform)?x:best,PARTY_FAMILIES[0]);
      const id=`p${p.nextPartyId++}`;p.parties.push({id,family:family.id,name:family.label+' · новая волна '+id.slice(1),color:family.color,leader:p.electionExperience?leaderName(p.nameSeed,id+'-leader'): 'Новый лидер '+id.slice(1),candidateName:p.electionExperience?leaderName(p.nameSeed,id+'-candidate',new Set(p.parties.map(x=>x.candidateName))):'Кандидат '+id.slice(1),platform,organization:.2,competence:.45,candidateCompetence:.45,discipline:.65,active:true,tolerated:false,seats:0,deputies:[],foundedMonth:s.month,parentIds:[],coalitionGrievance:0,brokenPromises:0,promises:[],cabinetPosts:0});events.push('Появилась новая партия, представляющая неудовлетворённый программный спрос.');p.lastActions.push({kind:'partyFounded',partyId:id,unrepresentedShare:weight/p.poll.eligible});}}
  if(!p.instantRules&&s.month%6===0){const opposition=p.parties.filter(x=>x.active&&x.seats>0&&!p.coalition.includes(x.id)).sort((a,b)=>(p.poll.parties.find(x=>x.id===b.id)?.share??0)-(p.poll.parties.find(x=>x.id===a.id)?.share??0))[0];
    if(opposition&&!p.bills.some(b=>b.sponsor===opposition.id&&['draft','articles','awaitingSignature'].includes(b.status))){const redistribution=opposition.platform.economy<0;createBill(s,redistribution?{transfers:clamp(p.lawPolicy.transfers+.5,0,20)}:{incomeTax:clamp(p.lawPolicy.incomeTax-1,0,50)},{sponsor:opposition.id,title:opposition.name+': '+(redistribution?'поддержка доходов':'снижение подоходного налога')});}}
}
function publicEvents(s,flow,events,world){const p=s.politics,r=hash(s.seed,'public-event',s.month);
  if((s.economy?.revision??0)<22&&!accountable(s)&&r<.012*p.corruption*(.2+p.mediaFreedom)){const e={month:s.month,type:'corruption',region:Math.floor(hash(s.seed,s.month,'region')*4),effect:-.18,attention:.12};p.publicEvents.push(e);events.push('Журналистское расследование выявило коррупционный эпизод. Эффект сильнее в затронутом регионе и постепенно затухает.');}
  if(s.government.defaultActive&&!p.publicEvents.some(e=>e.type==='default'&&s.month-e.month<24))p.publicEvents.push({month:s.month,type:'default',region:null,effect:-.25,attention:.08});
  if(world.weather<80&&(world.weather<65||r<.08)&&!p.publicEvents.some(e=>e.type==='disaster'&&s.month-e.month<12)){p.publicEvents.push({month:s.month,type:'disaster',region:2,effect:-.08,attention:.1});events.push('Неурожай затронул аграрные области; политическая реакция зависит также от доходов и помощи.');}
  if(s.month%24===0&&s.services.healthCoverage>.85&&flow.healthcare>0){p.publicEvents.push({month:s.month,type:'serviceSuccess',region:null,effect:.035,attention:.02});}
  p.publicEvents=p.publicEvents.filter(e=>s.month-e.month<60);
}
export function advancePoliticalSystem(s,prev,events,flow={},world=s.world){
  const p=s.politics;if(!p.enabled)return;
  advanceCitizenship(s,prev);publicEvents(s,flow,events,world);expireWorldDecisions(s,prev,rollCall);prepareSuccessor(s,events);
  p.economicHistory.push({month:s.month,national:s.metrics.realIncomeIndex,...(accountable(s)?{unemployment:s.metrics.unemployment,inflation:s.metrics.inflationYoY}:{}),groups:Array.from({length:5},(_,i)=>(s.households[i*2].realIncomeIndex+s.households[i*2+1].realIncomeIndex)/2)});p.economicHistory=p.economicHistory.slice(-13);
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
  const competitive=s.policy.competitiveElections&&p.electoralIntegrity>.45,closedRegime=regimeActive(s)&&!s.policy.competitiveElections;
  if(!regimeActive(s)&&!competitive&&!parliamentary(s)){const support=p.constitution.regime==='military'?p.elites.security:p.constitution.regime==='party'?p.elites.party:Math.min(...Object.values(p.elites));
    const hazard=p.parameters.eliteHazard*logistic((.4-support)*12+(.35-p.hiddenApproval)*4+p.lawConflict*.4);
    p.internalRemovalRisk=hazard;
    if(hash(s.seed,'internal-removal',s.month)<hazard)loseOffice(s,p.constitution.regime==='military'?'Военное руководство сменило главу исполнительной власти':'Правящая коалиция элит отстранила руководителя',events);
  }else p.internalRemovalRisk=0;
  if(p.executive.inOffice&&(s.month>=p.nextParliamentElection||p.scheduledParliament!==null&&s.month>=p.scheduledParliament)){
    const e=conductElection(s,'parliament');installParliament(s,e);p.elections.push(e);p.nextParliamentElection=s.month+p.constitution.parliamentTerm;p.scheduledParliament=null;
    events.push(`Парламентские выборы: участие ${e.turnout.toFixed(1)}%, партия игрока ${party(s,p.executive.playerParty).seats} из ${p.totalSeats} мест.`);
    p.coalition=p.coalition.filter(id=>party(s,id)?.seats>0);allocateCabinet(s);
    if(parliamentary(s)){
      if(party(s,p.executive.playerParty).seats===0)loseOffice(s,'Ваша партия не получила ни одного места в парламенте',events);
      else{rotateParliamentaryParties(s,e);beginFormation(s,events);}
    }
    if(!closedRegime&&!parliamentary(s)&&p.constitution.form!=='presidential'&&coalitionSeats(s)<=p.totalSeats/2){p.executive.formationDeadline=s.month+3;events.push('После выборов нет большинства: три месяца на соглашение о поддержке кабинета.');}
  }
  if(p.electoralPact?.due<=s.month)delete p.electoralPact;
  prepareElectoralPacts(s,()=>conductElection(s,'parliament',{preview:true}));
  const closedAppointment=closedRegime&&p.constitution.termLimit===0;
  if(closedAppointment&&p.nextPresidentElection!==null&&s.month>=p.nextPresidentElection){
    p.nextPresidentElection=s.month+p.constitution.presidentTerm;events.push('Очередной цикл подтверждения полномочий без конкурентного избрания главы. Передача руководства зависит от правящей коалиции и процедуры преемственности.');
  }
  if(!closedAppointment&&p.executive.inOffice&&p.nextPresidentElection!==null&&s.month>=p.nextPresidentElection){
    const e=conductElection(s,'president');p.elections.push(e);p.nextPresidentElection=s.month+p.constitution.presidentTerm;p.executive.presidentParty=e.winner;if(p.electionExperience&&p.executive.role!=='president')p.executive.presidentName=e.winnerCandidate;
    events.push(`Президентские выборы: победила ${party(s,e.winner).name}. Парламентский состав рассчитывается отдельно.`);
    if(p.executive.role==='president'){
      if(p.partyContinuity){
        if(e.winner!==p.executive.playerParty)loseOffice(s,'Поражение на президентских выборах',events);
        else if(party(s,e.winner).candidateName!==p.executive.presidentName)installSuccessor(s,events);
        else p.executive.termsServed++;
      }else{if(p.constitution.termLimit>0&&p.executive.termsServed>=p.constitution.termLimit)loseOffice(s,'Истёк конституционный предел президентских сроков',events);else if(e.winner!==p.executive.playerParty)loseOffice(s,'Поражение на президентских выборах',events);else p.executive.termsServed++;}
    }
  }
  clearPresidentialCoalition(s);
  p.parliamentSupport=clamp(coalitionSeats(s)/Math.max(1,p.totalSeats));
  if(parliamentary(s))advanceParliamentary(s,events);
  if(!closedRegime&&!parliamentary(s)&&p.executive.inOffice&&p.constitution.form!=='presidential'){
    if(p.executive.formationDeadline!==null&&s.month>=p.executive.formationDeadline&&p.parliamentSupport<=.5){
      if(p.partyContinuity){
        p.executive.formationDeadline=null;
        try{confidenceVote(s,{automatic:true},events);}catch{events.push('Новое большинство не предложило допустимую замену кабинета.');}
        if(p.executive.inOffice&&p.lastActions.at(-1)?.passed!==true)events.push('Большинство для коалиции не собрано, но кабинет не отстранён: правительство продолжает работу в меньшинстве.');
      }else{if(p.executive.role==='primeMinister')loseOffice(s,'Не сформировано парламентское большинство после выборов',events);else{const leader=p.parties.filter(x=>x.seats>0).sort((a,b)=>b.seats-a.seats)[0];p.coalition=[leader.id];p.executive.primeMinisterParty=leader.id;p.executive.formationDeadline=null;events.push('Президент назначил кабинет крупнейшей парламентской партии.');}}
    }
    else if(p.parliamentSupport<.45&&s.month%6===0&&p.executive.formationDeadline===null)confidenceVote(s,{automatic:true},events);
  }
  // Constitutional conflict can lead to impeachment, with a distinct legal gate.
  if(p.executive.inOffice&&p.executive.role==='president'&&p.executive.legalExposure>0&&p.judicialIndependence>.5&&p.parliamentSupport<.4&&s.month%6===0){try{processCommand(s,{kind:'impeach'},events);}catch{/* No legal majority. */}}
  const regimeRemoval=advanceRegimeDynamics(s,prev,events,flow);if(regimeRemoval)loseOffice(s,regimeRemoval,events);
  p.partyHistory.push({month:s.month,approval:p.hiddenApproval,officialApproval:p.officialApproval,parliamentSupport:p.parliamentSupport,parties:p.poll.parties.map(x=>({...x,seats:party(s,x.id).seats})),...(p.dashboardMode?{groups:clone(p.poll.groups),presidentApproval:p.presidentApproval*100,cabinetApproval:p.cabinetApproval*100}:{})});
  p.nextElection=Math.min(p.nextParliamentElection,p.nextPresidentElection??Infinity,p.scheduledParliament??Infinity);if(p.nextElection<=s.month)p.nextElection=s.month+1;
  generateMonthlyAgenda(s);
}
export function politicalMetrics(s){const p=s.politics;if(!p.enabled)return {};
  const totals=electorateTotals(s),player=p.poll.parties.find(x=>x.id===p.executive.playerParty);
  return {executiveApproval:p.hiddenApproval*100,presidentApproval:p.presidentApproval*100,cabinetApproval:p.cabinetApproval*100,officialApproval:p.officialApproval*100,governmentPartyRating:player?.share??0,presidentialCandidateRating:player?.candidateShare??0,...(p.electionExperience?{presidentialVoteShare:player?.candidateShare??0}:{}),eligibleVoters:totals.eligible,foreignResidents:totals.residents,naturalizedCitizens:totals.naturalized,expectedTurnout:p.poll.turnout,coalitionSeatShare:p.parliamentSupport*100,internalRemovalRisk:(p.internalRemovalRisk??0)*100,activeParties:p.parties.filter(x=>x.active).length,politicalLaws:p.bills.filter(x=>x.status==='enacted').length,inOffice:Number(p.executive.inOffice)};
}
export function validatePoliticalSystem(s){
  validateRegimeDynamics(s);validatePerformanceVoting(s);validatePolicyReputation(s);validateScenarioDiplomacy(s);
  validateGovernmentGoals(s);validateParliamentary(s);const p=s.politics;if(Boolean(s.provenance.politicalMode)!==Boolean(p.enabled))throw new Error('Не совпадает политический режим журнала и состояния');if(!p.enabled)return;
  if(p.historicalWorldStart!==undefined&&(!Number.isInteger(p.historicalWorldStart)||p.historicalWorldStart<0||p.historicalWorldStart>s.month+1))
    throw new Error('Повреждён календарь мировых событий');
  constitutionFrom(p.constitution);parametersFrom(p.parameters);validateElectoralPact(p,s.month);
  if(p.parliamentaryRevision!==undefined&&p.parliamentaryRevision!==1)throw new Error('Неизвестная версия парламентской игры');
  if(p.presidentialDecisionRevision!==undefined&&p.presidentialDecisionRevision!==1)throw new Error('Неизвестные правила президентских решений');
  if(p.accountabilityRevision!==undefined&&p.accountabilityRevision!==1)throw new Error('Неизвестная версия политических правил');
  if(accountable(s)&&p.publicEvents.some(e=>e.type==='decision'&&(!e.effects||typeof e.effects!=='object'||Object.values(e.effects).some(v=>!Number.isFinite(v)||Math.abs(v)>.18+1e-9)||![e.presidentWeight,e.sponsorWeight].every(Number.isFinite))))throw new Error('Повреждена история реакции избирателей');
  const valid=(x,min=0,max=Infinity)=>Number.isFinite(x)&&x>=min&&x<=max;
  if(['hiddenApproval','officialApproval','presidentApproval','cabinetApproval'].some(k=>!valid(p[k],0,1))||Object.values(p.elites).some(x=>!valid(x,0,1)))throw new Error('Повреждены оценки поддержки');
  if(!Array.isArray(p.parties)||p.parties.length<2||p.parties.length>10000||p.parties.filter(x=>x.active).length>16||new Set(p.parties.map(x=>x.id)).size!==p.parties.length||p.parties.some(x=>!/^#[0-9a-fA-F]{6}$/.test(x.color)||!Number.isInteger(x.seats)||x.seats<0||x.deputies.length!==x.seats||AXES.some(k=>!Number.isFinite(x.platform[k])||Math.abs(x.platform[k])>1)))throw new Error('Повреждены партии или парламент');
  if(sum(p.parties.map(x=>x.seats))!==p.totalSeats||p.totalSeats<p.allocatedSeatBase||p.totalSeats>p.allocatedSeatBase*2)throw new Error('Не сходится число парламентских мест');
  if(!party(s,p.executive.playerParty)||typeof p.executive.inOffice!=='boolean'||p.coalition.some(id=>!party(s,id)))throw new Error('Повреждена исполнительная власть');
  if(!Array.isArray(p.bills)||!Array.isArray(p.pendingCommands)||!Array.isArray(p.rollCalls)||!p.lawPolicy||!p.citizenship||p.citizenship.residents<0||p.citizenship.naturalized<0)throw new Error('Повреждена политическая история');
  if(p.partyContinuity!==undefined&&typeof p.partyContinuity!=='boolean')throw new Error('Повреждён режим преемственности');
  if(p.partyContinuity&&(!Array.isArray(p.executive.leaderHistory)||typeof p.executive.presidentName!=='string'||!Number.isInteger(p.executive.termsServed)||p.executive.termsServed<1||!Number.isInteger(p.executive.leaderStartedMonth)))throw new Error('Повреждена история руководителей');
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

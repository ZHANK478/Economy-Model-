import {treatyTariff} from './scenario-diplomacy.js';
import {parliamentary,playerExecutive} from './parliamentary-state.js';
import {programCandidates,chooseProgramArticle} from './party-programs.js';
import {revisedDecisions,overrideRequested} from './presidential-decisions.js';
import {accountable,presidential,recordDecision,independentPlatform} from './political-accountability.js';
import {makeElectorate} from './electorate.js';
import {POLICY_FIELDS} from './config.js';
import {clamp,clone,hash} from './political-config.js';
import {createBill,voteBill,presidentialDecision,referendum,approvedPolicy} from './legislation.js';
import {reviewRegimeBill} from './regime-dynamics.js';

export const MONTHLY_INITIATIVES=3;
export const unresolvedInitiatives=s=>s.politics.enabled&&s.politics.executive.inOffice?s.politics.bills.filter(b=>b.monthlyInitiative&&b.month===s.month&&!b.executiveResponse&&['draft','articles','awaitingSignature','referendum'].includes(b.status)):[];
const unresolved=['draft','articles','awaitingSignature','referendum'];
export const plannedPolicy=approvedPolicy;
export function initializeAgenda(s){
  const p=s.politics;
  p.turnCommands??=[];p.turnActions??=[];p.turnEvents??=[];p.initiativeCredits??={};
  for(const x of p.parties)x.executiveLoyalty??=accountable(s)?(x.id===p.executive.playerParty?.75:.45):p.coalition.includes(x.id)?.75:.45;
}
export function refusalCost(s,party){
  const c=s.politics.constitution;
  const factor=c.form==='parliamentary'?1:c.form==='semiPresidential'?(s.politics.executive.role==='primeMinister'?.8:.5):.25;
  return .12*factor*(s.politics.coalition.includes(party.id)?1:.7);
}
function partyReaction(s,bill,decision,events){
  if(accountable(s)){
    if(bill.partyReaction||!bill.monthlyInitiative||!['accept','reject','ignored'].includes(decision))return;
    const p=s.politics,x=p.parties.find(x=>x.id===bill.sponsor);if(!x||x.independent)return;
    const before=x.executiveLoyalty??.5,passed=['passed','enacted'].includes(bill.status);
    const delta=decision==='accept'?(passed?.1:0):decision==='ignored'?-.05:-.14;
    x.executiveLoyalty=clamp(before+delta);bill.partyReaction={partyId:x.id,decision,before,after:x.executiveLoyalty,delta:x.executiveLoyalty-before};
    p.lastActions.push({kind:'initiativeResponse',billId:bill.id,...clone(bill.partyReaction)});return;
  }
  if(!bill.monthlyInitiative||bill.partyReaction)return;
  const p=s.politics,x=p.parties.find(x=>x.id===bill.sponsor);if(!x)return;
  const before=x.executiveLoyalty??.5;
  const delta=decision==='accept'?(bill.status==='passed'?.04:.015):-refusalCost(s,x)*(decision==='ignored'?.4:1);
  x.executiveLoyalty=clamp(before+delta);
  if(x.id!==p.executive.playerParty&&(p.coalition.includes(x.id)||delta>0))x.coalitionGrievance=clamp(x.coalitionGrievance-delta*2.4,0,1.5);
  bill.partyReaction={partyId:x.id,decision,before,after:x.executiveLoyalty,delta:x.executiveLoyalty-before};
  p.lastActions.push({kind:'initiativeResponse',billId:bill.id,...clone(bill.partyReaction)});
  if(p.coalition.includes(x.id)&&x.id!==p.executive.playerParty&&x.coalitionGrievance>1){
    p.coalition=p.coalition.filter(id=>id!==x.id);x.cabinetPosts=0;
    p.lastActions.push({kind:'coalitionExit',partyId:x.id,reason:'repeatedInitiativeRefusals'});
    events.push(`${x.name} вышла из коалиции после накопленных разногласий и отказов.`);
  }
  p.parliamentSupport=p.parties.filter(x=>p.coalition.includes(x.id)).reduce((v,x)=>v+x.seats,0)/p.totalSeats;
}
export function decideBill(s,id,decision='accept',events=[],{deferReferendum=false}={}){
  const p=s.politics,b=p.bills.find(b=>b.id===Number(id));
  if(!b)throw new Error('Законопроект не найден');
  if(!['accept','reject',...(parliamentary(s)&&s.politics.parliamentary.factionControl===1?['abstain']:[])].includes(decision))throw new Error('Выберите принятие или отказ');
  if(b.executiveResponse||!unresolved.includes(b.status)){p.lastDecision={billId:b.id,month:s.month,status:b.status,decision:b.executiveResponse?.decision??decision,sponsor:b.sponsor};return b;}
  const current=plannedPolicy(s);for(const a of b.articles)if(Object.hasOwn(current,a.key))a.before=current[a.key];
  if(parliamentary(s)){
    b.playerVote=decision;
    if(['draft','articles'].includes(b.status))voteBill(s,b.id);
    if(b.status==='referendum'&&!deferReferendum)referendum(s,b.id);
    b.executiveResponse={decision,month:s.month};b.decidedMonth=s.month;
    p.nextDecisionSequence??=1;b.decisionSequence=p.nextDecisionSequence++;
    if(b.status==='passed')b.effectiveMonth=s.month+1;
    recordDecision(s,b,decision,makeElectorate(s));
    p.lastDecision={billId:b.id,month:s.month,status:b.status,decision,sponsor:b.sponsor};
    p.lastActions.push({kind:'instantBillDecision',billId:b.id,status:b.status,decision});return b;
  }

  if(decision==='reject'&&revisedDecisions(s)&&p.executive.role==='president'){
    if(b.status==='awaitingSignature')presidentialDecision(s,b.id,'veto');
    else{b.status='declined';b.presidentDecision={month:s.month,partyId:p.executive.presidentParty,decision:'reject'};}
  }else if(decision==='reject'){
    if(p.executive.role==='president'&&p.constitution.presidentialVeto&&b.kind!=='constitutional'){
      if(['draft','articles'].includes(b.status))voteBill(s,b.id);
      if(b.status==='awaitingSignature')presidentialDecision(s,b.id,'veto');
    }else if(b.status==='awaitingSignature'&&p.executive.role==='president')presidentialDecision(s,b.id,'veto');
    else b.status='declined';
  }else{
    if(!current.parliamentOversight&&p.legislativeConstraint<.35&&b.kind!=='constitutional'){
      if(reviewRegimeBill(s,b,events)){b.status='passed';b.byDecree=true;p.lastActions.push({kind:'decree',billId:b.id});}
    }else if(['draft','articles'].includes(b.status))voteBill(s,b.id);
    if(b.status==='referendum'&&!deferReferendum)referendum(s,b.id);
    if(b.status==='awaitingSignature'&&p.executive.role==='president')presidentialDecision(s,b.id,'sign');
  }
  b.executiveResponse={decision,month:s.month};b.decidedMonth=s.month;
  p.nextDecisionSequence??=1;b.decisionSequence=p.nextDecisionSequence++;
  if(b.status==='passed')b.effectiveMonth=s.month+1;
  if(!(deferReferendum&&b.status==='referendum')){partyReaction(s,b,decision,events);
  recordDecision(s,b,decision,accountable(s)?makeElectorate(s):[]);}
  if(decision==='reject'&&overrideRequested(s,b)){
    const vote=presidentialDecision(s,b.id,'override');b.overrideAttempt={month:s.month,passed:vote.passed};b.overrideVote=clone(vote);
    if(vote.passed){b.vetoOverridden=true;b.effectiveMonth=s.month+1;events.push(`Парламент преодолел вето: ${vote.yes} из ${vote.total} голосов.`);}
  }
  p.lastDecision={billId:b.id,month:s.month,status:b.status,decision,sponsor:b.sponsor};
  p.lastActions.push({kind:'instantBillDecision',billId:b.id,decision,status:b.status});
  return b;
}
// Program targets and response costs are transparent gameplay assumptions.
// They are not empirical estimates of any real party's behavior.
function candidateArticles(s,party){
  if(s.politics.partyProgramRevision===1){const x=party.independent&&party.deputies.length?{...party,platform:independentPlatform(s,party.deputies[s.month%party.deputies.length])}:party;return programCandidates(s,x,plannedPolicy(s));}
  const a=party.independent&&accountable(s)&&party.deputies.length?independentPlatform(s,party.deputies[s.month%party.deputies.length]):party.platform,current=plannedPolicy(s),targets=[
    ['incomeTax',18-8*a.economy],['corporateTax',25-9*a.economy],
    ['transfers',5-3*a.economy],['healthcare',3.5-1.5*a.economy],
    ['education',2.5+.8*a.liberty],['familyBenefits',1.5-1.1*a.culture],
    ['publicInvestment',4.5+1.5*a.environment+1.5*a.decentralization],
    ['migrationOpenness',50+35*a.openness],['tariff',5-5*a.openness],
    ['infrastructureMaintenance',1.1+.5*a.decentralization],
    ['childcareBudget',.6+.4*a.culture]
  ];
  return targets.flatMap(([key,target])=>{
    if(key==='tariff'&&treatyTariff(s)!==undefined)return [];
    const f=POLICY_FIELDS.find(f=>f[0]===key);if(!f)return [];
    target=clamp(Math.round(target/f[4])*f[4],f[2],f[3]);
    const gap=target-current[key];if(Math.abs(gap)<f[4]*.9)return [];
    const size=key==='migrationOpenness'?5:key==='incomeTax'||key==='corporateTax'||key==='tariff'?1:f[4]*2;
    const value=Math.round((current[key]+Math.sign(gap)*Math.min(Math.abs(gap),size))/f[4])*f[4];
    return [{key,value:Math.round(value*100)/100,label:f[1],unit:f[5]}];
  });
}
export function generateMonthlyAgenda(s){
  const p=s.politics;if(!p.enabled||!p.instantRules||!p.executive.inOffice||p.agendaMonth===s.month)return;
  initializeAgenda(s);p.agendaMonth=s.month;
  if(parliamentary(s)&&s.politics.parliamentary.phase==='forming')return;
  if(p.dashboardMode){if(s.month<(p.nextAgendaMonth??s.month))return;p.nextAgendaMonth=s.month+2+Math.floor(hash(s.seed,'agenda-delay',s.month)*3);}
  const eligible=p.parties.filter(x=>x.active&&x.seats>0&&(!parliamentary(s)||playerExecutive(s)||p.coalition.includes(x.id))&&candidateArticles(s,x).length);
  const total=eligible.reduce((v,x)=>v+x.seats,0);if(!total)return;
  for(const x of eligible)p.initiativeCredits[x.id]=(p.initiativeCredits[x.id]??0)+(p.agendaSlots??MONTHLY_INITIATIVES)*x.seats/total;
  const slots=p.agendaSlots??MONTHLY_INITIATIVES;
  const used=new Set();
  for(let slot=0;slot<slots;slot++){
    const candidates=eligible.map(x=>({party:x,articles:candidateArticles(s,x).filter(a=>!used.has(a.key))})).filter(x=>x.articles.length);
    if(!candidates.length)break;
    candidates.sort((a,b)=>p.initiativeCredits[b.party.id]-p.initiativeCredits[a.party.id]||hash(s.seed,s.month,a.party.id)-hash(s.seed,s.month,b.party.id));
    const {party:x,articles}=candidates[0],article=p.partyProgramRevision===1?chooseProgramArticle(s,x,articles):articles[Math.floor(hash(s.seed,'initiative-topic',s.month,slot,x.id)*articles.length)];
    const b=createBill(s,article.actions?{}:{[article.key]:article.value},{sponsor:x.id,title:article.label,monthlyInitiative:true,...(article.actions?{actions:article.actions.map(a=>({...a,id:s.nextActionId++}))}:{})});
    if(!b.monthlyInitiative||b.month!==s.month)continue;
    if(revisedDecisions(s)&&p.executive.role==='president'&&p.constitution.presidentialVeto){voteBill(s,b.id);if(b.status==='awaitingSignature')b.parliamentPresented=true;}
    if(p.partyProgramRevision===1){b.programTopic=article.topic;b.programKey=article.key;}
    b.agendaSlot=slot;b.seatShare=x.seats/p.totalSeats;b.rationale=`Программное предложение партии «${x.name}».`;
    p.initiativeCredits[x.id]-=1;used.add(article.key);
  }
}
export function expireMonthlyAgenda(s,decisionMonth,events){
  const p=s.politics;if(!p.instantRules)return;
  for(const b of p.bills.filter(b=>b.monthlyInitiative&&b.month<=decisionMonth&&unresolved.includes(b.status))){
    if(parliamentary(s)){if(['draft','articles'].includes(b.status))voteBill(s,b.id);b.executiveResponse={decision:'automatic',month:decisionMonth};b.decidedMonth=decisionMonth;if(b.status==='passed')b.effectiveMonth=s.month;continue;}
    b.status='expired';b.decidedMonth=decisionMonth;b.executiveResponse={decision:'ignored',month:decisionMonth};
    partyReaction(s,b,'ignored',events);
  }
}

export function activatePresidentialDecisions(s){
 const p=s.politics;if(revisedDecisions(s))return;
 p.presidentialDecisionRevision=1;p.constitution.vetoOverrideAllowed??=true;
 for(const b of p.bills.filter(b=>b.monthlyInitiative&&!b.executiveResponse&&['draft','articles','awaitingSignature'].includes(b.status))){
  if(p.executive.role!=='president'||!p.constitution.presidentialVeto)continue;
  if(['draft','articles'].includes(b.status))voteBill(s,b.id);
  if(b.status==='awaitingSignature')b.parliamentPresented=true;
 }
}

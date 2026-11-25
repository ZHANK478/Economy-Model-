import {expireGovernmentMilestone,setCabinetProgram} from './government-goals.js';
import {defenseResponse} from './defense.js';
import {PARTY_FAMILIES,PRESIDENTIAL_PARTY_FAMILIES,partyDisplayName,hash,clone,distance,clamp,BUDGET_KEYS} from './political-config.js';
import {POLICY_FIELDS} from './config.js';
import {programCandidates} from './party-programs.js';
import {pollElectorate} from './electorate.js';
import {createBill,voteBill,approvedPolicy,policyAuthority} from './legislation.js';
import {parliamentary,playerExecutive} from './parliamentary-state.js';
export {parliamentary,playerExecutive};
const sum=a=>a.reduce((v,x)=>v+x,0),party=(s,id)=>s.politics.parties.find(x=>x.id===id);
export const PARLIAMENTARY_CATALOG=[...PARTY_FAMILIES,...PRESIDENTIAL_PARTY_FAMILIES.filter(x=>!PARTY_FAMILIES.some(y=>y.id===x.id))];
export function initializeParliamentaryRoster(s,family){
 const p=s.politics,own=p.parties.find(x=>x.family===family),seed=p.nameSeed??s.seed;
 const minimum=p.guidedOpening?4:2,count=minimum+Math.floor(hash(seed,'parliament-party-count')*(11-minimum));
 const others=p.parties.filter(x=>x!==own).sort((a,b)=>hash(seed,'parliament-party',a.family)-hash(seed,'parliament-party',b.family));
 const anchor=p.guidedOpening?others.find(x=>compatibleCoalition(s,own,x,'accept',1)):null;
 const active=new Set([own.id,...(anchor?[anchor.id]:[]),...others.filter(x=>x!==anchor).slice(0,count-(anchor?2:1)).map(x=>x.id)]);
 if(anchor)p.openingPartner=anchor.id;
 for(const x of p.parties){x.active=active.has(x.id);x.initialParty=true;}
 p.parliamentary={phase:'forming',formationUntil:s.month+3,negotiations:[],draftAgreements:[],agreements:[],notices:[],history:[],initialCount:count};
}
export function calibrateParliamentaryStart(s,{seatShares=false}={}){
 const p=s.politics,active=p.parties.filter(x=>x.active);
 const weights=active.map(x=>seatShares?Math.max(1e-7,x.seats):.8+.6*hash(p.nameSeed,'parliament-initial-share',x.id));
 const total=sum(weights);
 if(!seatShares)p.startingPreferences={parliament:{},president:{},approval:0};
 p.stablePreferences=true;
 for(let i=0;i<24;i++){
  const poll=pollElectorate(s,{commitMemory:false,assignPoll:false,trackGroups:false}).poll;
  active.forEach((x,j)=>p.startingPreferences.parliament[x.id]=(p.startingPreferences.parliament[x.id]??0)+Math.log(100*weights[j]/total/poll.parties.find(r=>r.id===x.id).share));
 }
}
const priorities={socialist:'transfers',socialDemocrat:'healthcare',liberal:'incomeTax',conservative:'militaryBudget',national:'militaryBudget',green:'publicInvestment',communist:'corporateTax',authoritarianLeft:'militaryBudget',libertarian:'corporateTax',centerRight:'incomeTax',centerLeft:'education',agrarian:'municipalInvestmentShare',regional:'municipalInvestmentShare'};
export function coalitionCondition(s,id,{compromise=false}={}){
 const x=party(s,id),current=approvedPolicy(s),articles=programCandidates(s,x,current).filter(a=>!a.actions&&policyAuthority(s,a.key)==='law');
 const article=articles.find(a=>a.key===priorities[x.family])??articles.find(a=>BUDGET_KEYS.includes(a.key))??articles[0];
 if(!article)return null;
 const f=POLICY_FIELDS.find(f=>f[0]===article.key),before=current[article.key];let value=article.value;
 if(compromise&&f){value=Math.round((before+(value-before)/2)/f[4])*f[4];if(value===before)value=article.value;value=Number(value.toFixed(4));}
 return {...article,before,value};
}
function notice(s,title,text){const q=s.politics.parliamentary;q.notices.push({month:s.month,title,text});q.notices=q.notices.slice(-12);}
export function cabinetSeats(s,ids=s.politics.coalition){return sum(ids.map(id=>party(s,id)?.seats??0));}
export function installCabinet(s,leader,members,events=[],{agreements=[]}={}){
 const p=s.politics,q=p.parliamentary,old=p.executive.primeMinisterParty;
 if(!members.includes(leader)||members.some(id=>!party(s,id)?.seats))throw new Error('Кабинету нужна поддержка действующих депутатов');
 if(leader!==p.executive.playerParty)expireGovernmentMilestone(s);
 q.history.push({month:s.month,leader,members:[...members],previous:old});q.history=q.history.slice(-100);
 p.executive.primeMinisterParty=leader;p.executive.formationDeadline=null;p.coalition=[...members];p.coalitionAgreements=[];
 q.phase='government';if(p.politicalDynamicsRevision)delete q.minoritySince;q.formationUntil=null;q.negotiations=[];q.draftAgreements=[];q.agreements=clone(agreements);q.caretaker=false;
 const seats=cabinetSeats(s);for(const x of p.parties){x.cabinetPosts=members.includes(x.id)?8*x.seats/Math.max(1,seats):0;x.coalitionGrievance=0;}
 p.parliamentSupport=seats/Math.max(1,p.totalSeats);
 const mine=leader===p.executive.playerParty;
 notice(s,mine?'Вы сформировали правительство':'Сформирован новый кабинет',mine?`Опора кабинета — ${seats} из ${p.totalSeats} мест.`:`Премьер — ${partyDisplayName(party(s,leader))}. Ваша партия продолжает в оппозиции.`);
 events.push(mine?'Ваша партия сформировала правительство.':'Кабинет возглавила '+partyDisplayName(party(s,leader))+'. Ваша партия продолжает в оппозиции.');
 for(const a of agreements)if(a.condition&&approvedPolicy(s)[a.condition.key]!==a.condition.value){
  const b=createBill(s,{[a.condition.key]:a.condition.value},{sponsor:leader,title:'Коалиционное соглашение: '+a.condition.label});
  voteBill(s,b.id);b.cabinetAgreement=true;b.executiveResponse={decision:'accept',month:s.month};b.decidedMonth=s.month;if(b.status==='passed')b.effectiveMonth=s.month+1;
 }
}
export function beginFormation(s,events=[]){
 const p=s.politics,q=p.parliamentary,own=p.executive.playerParty;
 q.phase='forming';q.formationUntil=s.month+3;q.negotiations=[own];q.draftAgreements=[];q.caretaker=true;
 if(!p.coalition.length){p.executive.primeMinisterParty=own;p.coalition=[own];}
 if(!p.governmentGoals&&party(s,own).seats>p.totalSeats/2)installCabinet(s,own,[own],events);
 else notice(s,'Формирование правительства','Чтобы стать премьером, согласуйте коалицию и нажмите «Сформировать кабинет». На переговоры — три месяца.');
}
// Coalition membership and the premiership are distinct bargains. The
// thresholds model this scenario's party system, not a constitutional rule.
function coalitionDistance(a,b){
 const gap=key=>(a.platform[key]-b.platform[key])**2;
 return .33*gap('economy')+.25*gap('liberty')+.14*gap('culture')+
  .10*gap('environment')+.08*gap('decentralization')+.10*gap('openness');
}
export function compatibleCoalition(s,a,b,mode='accept',electionId=s.politics.elections?.at(-1)?.id??0){
 const p=s.politics;
 if(!p.politicalDynamicsRevision)return distance(a.platform,b.platform)<=(mode==='compromise'?.6:.9);
 const gap=coalitionDistance(a,b);
 const limit=clamp(p.parameters.coalitionTolerance+.08,.35,1.05);
 const friction=.06*hash(p.nameSeed??s.seed,'coalition-talks',electionId,...[a.id,b.id].sort());
 return Math.abs(a.platform.economy-b.platform.economy)<1.65&&
  Math.abs(a.platform.liberty-b.platform.liberty)<1.45&&gap+friction<=limit*(mode==='compromise'?.72:1);
}
function conflictingConditions(conditions){
 return conditions.some((a,i)=>conditions.slice(i+1).some(b=>a.key===b.key&&
  (typeof a.value==='number'&&typeof b.value==='number'?
   (a.value-a.before)*(b.value-b.before)<0:a.value!==b.value)));
}
function coalitionOptions(s,eligible,{largerThan=0}={}){
 const p=s.politics,majority=Math.floor(p.totalSeats/2)+1;
 const compatible=eligible.map((a,i)=>eligible.map((b,j)=>i===j||compatibleCoalition(s,a,b)));
 const conditions=eligible.map(x=>coalitionCondition(s,x.id));
 let best=null;
 function search(start,group,seats){
  if(seats>=majority){
   for(const i of group){
    const leader=eligible[i];
    if(leader.seats<=largerThan||group.some(j=>eligible[j].seats>leader.seats))continue;
    if(conflictingConditions(group.filter(j=>i!==j).map(j=>conditions[j]).filter(Boolean)))continue;
    const span=Math.max(0,...group.flatMap(j=>group.map(k=>coalitionDistance(eligible[j],eligible[k]))));
    const score=1.5*leader.seats/p.totalSeats-span-.12*(group.length-1)-
     .3*(seats-majority)/p.totalSeats+.06*hash(p.nameSeed??s.seed,'cabinet-bargain',p.elections.at(-1)?.id??0,leader.id,...group.map(j=>eligible[j].id).sort());
    if(!best||score>best.score)best={leader:leader.id,members:group.map(j=>eligible[j].id),score};
   }
   return;
  }
  for(let i=start;i<eligible.length;i++)if(group.every(j=>compatible[i][j]))search(i+1,[...group,i],seats+eligible[i].seats);
 }
 search(0,[],0);
 return best;
}
export function playerCabinetBlock(s,members){
 const p=s.politics,own=party(s,p.executive.playerParty),partners=members.filter(id=>id!==own.id).map(id=>party(s,id));
 const seats=cabinetSeats(s,members);
 if(seats<=p.totalSeats/2)return 'Для нового кабинета нужно больше половины мест';
 if(!p.politicalDynamicsRevision)return '';
 const caucuses=[own,...partners];
 if(caucuses.some((a,i)=>caucuses.slice(i+1).some(b=>!compatibleCoalition(s,a,b))))return 'Программы партий несовместимы';
 const conditions=p.parliamentary.draftAgreements.filter(a=>members.includes(a.partyId)&&a.condition).map(a=>a.condition);
 if(conflictingConditions(conditions))return 'Партнёры выдвинули противоречащие условия';
 if(own.seats>p.totalSeats/2)return '';
 const dominant=partners.find(x=>x.seats>own.seats&&x.seats>seats/2);
 if(dominant)return partyDisplayName(dominant)+' претендует на пост премьера';
 const rivals=p.parties.filter(x=>x.active&&x.seats>0&&x!==own);
 if(coalitionOptions(s,rivals,{largerThan:own.seats}))return 'Соперники могут собрать большинство без вас';
 if(partners.some(x=>x.seats>own.seats)&&seats-own.seats>p.totalSeats/2)return 'Партнёры располагают большинством без вашей фракции';
 return '';
}
export function openingCoalitionPartner(s){
 const p=s.politics,own=party(s,p.executive.playerParty);
 if(own.seats<.4*p.totalSeats||own.seats>.5*p.totalSeats)return null;
 const rivals=p.parties.filter(x=>x.active&&x.id!==own.id&&x.seats>0);
 if(rivals.some(x=>x.seats>=own.seats))return null;
 return rivals.sort((a,b)=>b.seats-a.seats).find(x=>!playerCabinetBlock(s,[own.id,x.id]))??null;
}

export function negotiateCoalition(s,id,mode,events=[]){
 const p=s.politics,q=p.parliamentary,own=p.executive.playerParty,x=party(s,id);
 if(!x?.active||!x.seats||id===own)throw new Error('Выберите парламентскую партию для переговоров');
 if(!['accept','compromise','remove'].includes(mode))throw new Error('Неизвестный вариант соглашения');
 if(mode==='remove'){if(!q.negotiations.length&&playerExecutive(s)){q.negotiations=[...p.coalition];q.draftAgreements=clone(q.agreements);}
 q.negotiations=q.negotiations.filter(x=>x!==id);q.draftAgreements=q.draftAgreements.filter(x=>x.partyId!==id);return;}
 const condition=coalitionCondition(s,id,{compromise:mode==='compromise'});
 if(!compatibleCoalition(s,party(s,own),x,mode))throw new Error('Партия отказывается: слишком большие программные разногласия');
 if(p.politicalDynamicsRevision){
  const members=q.negotiations.length?q.negotiations:playerExecutive(s)?p.coalition:[own];
  if(members.some(id=>id!==x.id&&!compatibleCoalition(s,party(s,id),x)))throw new Error('Программы партнёров несовместимы');
  const agreed=q.negotiations.length?q.draftAgreements:playerExecutive(s)?q.agreements:[];
  if(condition&&conflictingConditions([condition,...agreed.filter(a=>a.partyId!==x.id&&a.condition).map(a=>a.condition)]))throw new Error('Условия партнёров противоречат друг другу');
 }
 if(q.phase==='government'&&playerExecutive(s)&&p.coalition.includes(id)){
  const a=q.agreements.find(a=>a.partyId===id);if(a?.warningSince===undefined)throw new Error('Действующее соглашение соблюдается');
 }
 if(!q.negotiations.length&&playerExecutive(s)){q.negotiations=[...p.coalition];q.draftAgreements=clone(q.agreements);}
 q.negotiations=Array.from(new Set([own,...q.negotiations,id]));
 q.draftAgreements=q.draftAgreements.filter(a=>a.partyId!==id);q.draftAgreements.push({partyId:id,condition,month:s.month});
 p.lastActions.push({kind:'parliamentaryAgreement',partyId:id,mode,condition});
 events.push('Согласовано условие партии '+partyDisplayName(x)+'.');
}
export function formPlayerCabinet(s,events=[],{goalId,milestoneId}={}){
 const p=s.politics,q=p.parliamentary,own=p.executive.playerParty;
 const members=Array.from(new Set([own,...q.negotiations])).filter(id=>party(s,id)?.seats>0);
 const block=playerCabinetBlock(s,members);if(block)throw new Error(block);
 setCabinetProgram(s,goalId,milestoneId);
 installCabinet(s,own,members,events,{agreements:q.draftAgreements.filter(a=>members.includes(a.partyId))});
}
export function rivalCabinet(s,events=[],{excludePlayer=true,reason=''}={}){
 const p=s.politics,own=p.executive.playerParty;
 const eligible=p.parties.filter(x=>x.active&&x.seats>0&&(!excludePlayer||x.id!==own)).sort((a,b)=>b.seats-a.seats);
 let best=p.politicalDynamicsRevision?coalitionOptions(s,eligible):null;
 for(const leader of p.politicalDynamicsRevision?[]:eligible){
  const members=[leader.id];let seats=leader.seats;
  for(const x of eligible.filter(x=>x!==leader).sort((a,b)=>distance(a.platform,leader.platform)-distance(b.platform,leader.platform))){
   if(seats>p.totalSeats/2)break;if(distance(x.platform,leader.platform)>.9)continue;members.push(x.id);seats+=x.seats;
  }
  if(seats>p.totalSeats/2&&(!best||leader.seats>best.strength))best={leader:leader.id,members,strength:leader.seats};
 }
 if(best){const agreements=best.members.filter(id=>id!==best.leader).map(id=>({partyId:id,condition:coalitionCondition(s,id),month:s.month}));installCabinet(s,best.leader,best.members,events,{agreements});return true;}
 return false;
}
export function rotateParliamentaryParties(s,election){
 const p=s.politics,own=p.executive.playerParty,failed=p.parties.filter(x=>x.active&&x.id!==own&&(election.results.find(r=>r.id===x.id)?.seats??0)===0);
 const excluded=new Set(p.parties.filter(x=>x.active).map(x=>x.family));
 const pool=PARLIAMENTARY_CATALOG.filter(f=>!excluded.has(f.id)).sort((a,b)=>hash(p.nameSeed,election.id,'new-party',a.id)-hash(p.nameSeed,election.id,'new-party',b.id));
 for(const old of failed){
  old.active=false;old.retiredMonth=s.month;
  const f=pool.shift();if(!f)continue;
  const template=p.parties.find(x=>x.family===f.id);const id='p'+p.nextPartyId++;
  const next={...clone(template),id,name:f.label,initialParty:true,active:true,seats:0,deputies:[],foundedMonth:s.month,parentIds:[],cabinetPosts:0,coalitionGrievance:0,promises:[],brokenPromises:0,executiveLoyalty:.45};delete next.retiredMonth;
  p.parties.push(next);p.startingPreferences??={parliament:{},president:{},approval:0};
  p.startingPreferences.parliament[id]=-.25+hash(p.nameSeed,election.id,'entrant-support',id)*.5;
  notice(s,'Новая партия',partyDisplayName(next)+' начинает следующую избирательную кампанию.');
 }
}
export function advanceParliamentary(s,events=[]){
 const p=s.politics,q=p.parliamentary;if(!p.executive.inOffice)return;
 if(q.phase==='forming'){
  if(s.month>=q.formationUntil){
   if(!rivalCabinet(s,events)){
    // A minority cabinet can survive while no replacement majority exists.
    const strongest=p.parties.filter(x=>x.active&&x.seats>0).sort((a,b)=>b.seats-a.seats)[0];
    installCabinet(s,strongest.id,[strongest.id],events);if(strongest.seats<=p.totalSeats/2)notice(s,'Кабинет меньшинства','Большинство не согласовало коалицию. Законы требуют отдельной поддержки.');
   }
  }
  return;
 }
 for(const a of q.agreements.filter(a=>p.coalition.includes(a.partyId)&&a.condition)){
  const {key,value,before}=a.condition,current=p.lawPolicy[key],field=POLICY_FIELDS.find(f=>f[0]===key),tolerance=field?field[4]*.51:0;
  const respected=typeof value==='number'?(value>=before?current>=value-tolerance:current<=value+tolerance):current===value;
  if(respected){delete a.warningSince;continue;}
  if(s.month<=a.month+2)continue;
  if(a.warningSince===undefined){a.warningSince=s.month;notice(s,'Союзник требует выполнить соглашение',partyDisplayName(party(s,a.partyId))+': '+a.condition.label+'. На урегулирование — три месяца.');}
  else if(s.month-a.warningSince>=3){p.coalition=p.coalition.filter(id=>id!==a.partyId);party(s,a.partyId).cabinetPosts=0;events.push(partyDisplayName(party(s,a.partyId))+' вышла из коалиции: нарушено соглашение.');notice(s,'Партия вышла из коалиции',partyDisplayName(party(s,a.partyId))+'.');}
 }
 p.parliamentSupport=cabinetSeats(s)/p.totalSeats;
 if(p.parliamentSupport<=.5){
  if(q.minoritySince===undefined){q.minoritySince=s.month;notice(s,'Кабинет потерял большинство','Можно договориться о новой коалиции.');}
  if(s.month-q.minoritySince>=3&&rivalCabinet(s,events))delete q.minoritySince;
 }else delete q.minoritySince;
}
export function automaticCabinetDecision(s,events=[]){
 if(playerExecutive(s)||s.politics.parliamentary.phase==='forming')return;
 const p=s.politics,leader=party(s,p.executive.primeMinisterParty),current=approvedPolicy(s);
 const conflict=s.defense?.war??s.defense?.crisis;
 if(conflict&&!conflict.negotiation){defenseResponse(s,'negotiate');events.push('Правительство начало переговоры по внешнему конфликту.');}
 // Executive instruments belong to the actual cabinet. Laws are offered via
 // the common agenda and settled through actual parliamentary votes.
 const choices=programCandidates(s,leader,current).filter(a=>!a.actions&&policyAuthority(s,a.key)==='executive');
 if(s.month%3===0&&choices.length){const a=choices[Math.floor(hash(p.nameSeed,'cabinet-executive',s.month)*choices.length)];p.lawPolicy[a.key]=a.value;p.lastActions.push({kind:'cabinetExecutive',partyId:leader.id,key:a.key,value:a.value});}
}
export function validateParliamentary(s){
 if(!parliamentary(s))return;const p=s.politics,q=p.parliamentary,ids=new Set(p.parties.map(x=>x.id));
 if(!q||!['forming','government'].includes(q.phase)||!Array.isArray(q.negotiations)||q.negotiations.some(id=>!ids.has(id))||!Array.isArray(q.draftAgreements)||!Array.isArray(q.agreements)||!Array.isArray(q.notices)||!Array.isArray(q.history)||!ids.has(p.executive.primeMinisterParty))throw new Error('Повреждено состояние парламентской игры');
 if(q.factionControl!==undefined&&q.factionControl!==1||q.oppositionVote!==undefined&&!['accept','reject','abstain'].includes(q.oppositionVote))throw new Error('Повреждены указания фракции');
 if(new Set(q.negotiations).size!==q.negotiations.length||q.agreements.some(a=>!ids.has(a.partyId)))throw new Error('Повреждены коалиционные соглашения');
}

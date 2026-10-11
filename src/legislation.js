import {BASE_POLICY,POLICY_FIELDS,POLICY_CHECKS,POLICY_CHOICES} from './config.js';
import {CONSTITUTIONAL_POLICY_KEYS,EXECUTIVE_KEYS,CB_KEYS,BUDGET_KEYS,clamp,clone,hash,logistic,distance,constitutionFrom} from './political-config.js';
import {governedPlatform,makeElectorate,turnout} from './electorate.js';
import {integerVotes} from './elections.js';
export function policyAuthority(s,key){
  if(!s.politics.enabled)return 'laboratory';
  if(CONSTITUTIONAL_POLICY_KEYS.includes(key))return 'constitution';
  if(s.politics.constitution.independentCB&&CB_KEYS.includes(key))return 'centralBank';
  if(EXECUTIVE_KEYS.includes(key)||!s.politics.constitution.independentCB&&CB_KEYS.includes(key))return 'executive';
  return 'law';
}
export function validatePolicyPatch(patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).length>Object.keys(BASE_POLICY).length)throw new Error('Неверные статьи закона');
  for(const [key,value] of Object.entries(patch)){
    if(!Object.hasOwn(BASE_POLICY,key))throw new Error('Неизвестная статья закона: '+key);
    const field=POLICY_FIELDS.find(x=>x[0]===key),check=POLICY_CHECKS.find(x=>x[0]===key),choice=POLICY_CHOICES.find(x=>x[0]===key);
    if(field&&(!Number.isFinite(value)||value<field[2]||value>field[3])||check&&typeof value!=='boolean'||choice&&!choice[3].some(x=>x[0]===value))throw new Error('Недопустимое значение статьи: '+key);
  }return clone(patch);
}
export function validateLegislativeAction(a){
  if(!a||!Number.isInteger(a.id)||a.id<1)throw new Error('Недопустимая операция законопроекта');
  if(a.kind==='restructure'){if(!Number.isFinite(a.haircut)||a.haircut<0||a.haircut>.7||!Number.isInteger(a.extension)||a.extension<12||a.extension>120)throw new Error('Недопустимая операция с долгом');return;}
  if(a.network){if(!['roads','rail','grid'].includes(a.network)||!['networkSale','networkPurchase','networkMunicipalize'].includes(a.kind))throw new Error('Недопустимая инфраструктурная операция');}
  else if(!Number.isInteger(a.sector)||a.sector<0||a.sector>4||!['purchase','privatize','foreignSale','cooperatize','municipalize','nationalize','recapitalize'].includes(a.kind)||!Number.isFinite(a.compensation)||a.compensation<0||a.compensation>1)throw new Error('Недопустимая операция собственности');
  if(!Number.isFinite(a.points)||a.points<=0||a.points>100)throw new Error('Недопустимая доля передачи');
}
const titleOf=key=>POLICY_FIELDS.find(x=>x[0]===key)?.[1]??POLICY_CHECKS.find(x=>x[0]===key)?.[1]??POLICY_CHOICES.find(x=>x[0]===key)?.[1]??key;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const fingerprintOf=(patch,constitutionPatch,actions)=>JSON.stringify(canonical([patch,constitutionPatch,actions]));
export function createBill(s,patch={},options={}){
  const p=s.politics,validated=validatePolicyPatch(patch),constitutionPatch=options.constitutionPatch??{};
  if(options.actions){if(!Array.isArray(options.actions))throw new Error('Операции должны быть списком');options.actions.forEach(validateLegislativeAction);}
  if(Object.keys(constitutionPatch).length)constitutionFrom({...p.constitution,...constitutionPatch});
  if(Object.keys(validated).some(key=>policyAuthority(s,key)==='centralBank'))throw new Error('Операционная ставка и банковские нормативы независимого ЦБ не устанавливаются обычным законом');
  const kind=Object.keys(constitutionPatch).length||Object.keys(validated).some(k=>CONSTITUTIONAL_POLICY_KEYS.includes(k))?'constitutional':options.actions?.length?'property':options.renewBudget||Object.keys(validated).some(k=>BUDGET_KEYS.includes(k))?'budget':'ordinary';
  const fingerprint=fingerprintOf(validated,constitutionPatch,options.actions??[]);
  const existing=p.bills.find(b=>b.fingerprint===fingerprint&&(['draft','articles','awaitingSignature','referendum','passed'].includes(b.status)||['rejected','vetoed'].includes(b.status)&&b.parliamentId===p.lastParliamentElection&&s.month-b.month<6));if(existing)return existing;
  if(!Object.keys(validated).length&&!Object.keys(constitutionPatch).length&&!options.actions?.length&&!options.renewBudget)throw new Error('В законопроекте нет статей');
  const bill={id:p.nextBillId++,month:s.month,parliamentId:p.lastParliamentElection,title:String(options.title??(kind==='constitutional'?'Изменение конституционных правил':kind==='budget'?'Бюджетный пакет':kind==='property'?'Операция с собственностью':'Изменение экономических правил')).slice(0,160),sponsor:options.sponsor??p.executive.playerParty,kind,status:'draft',revision:0,fingerprint,patch:validated,constitutionPatch:clone(constitutionPatch),actions:clone(options.actions??[]),renewBudget:Boolean(options.renewBudget),articles:[],amendments:[],votes:[],finalVote:null};
  for(const [key,value] of Object.entries(validated))bill.articles.push({id:bill.articles.length+1,key,label:titleOf(key),value,status:'pending'});
  for(const [key,value] of Object.entries(constitutionPatch))bill.articles.push({id:bill.articles.length+1,key:'constitution.'+key,label:'Конституция: '+key,value,status:'pending'});
  for(const a of bill.actions)bill.articles.push({id:bill.articles.length+1,key:'action.'+a.id,label:'Передача собственности / обмен долга',value:a,status:'pending'});
  if(options.renewBudget&&!bill.articles.length)bill.articles.push({id:1,key:'renewBudget',label:'Продление бюджетных ассигнований на год',value:true,status:'pending'});
  p.bills.push(bill);p.lastActions.push({kind:'billSubmitted',billId:bill.id,title:bill.title,sponsor:bill.sponsor});
  for(const party of p.parties.filter(x=>x.active&&x.seats>0&&x.id!==bill.sponsor)){
    const article=bill.articles.find(a=>['incomeTax','corporateTax','transfers','healthcare','publicInvestment','minimumWage'].includes(a.key));if(!article)continue;
    const field=POLICY_FIELDS.find(f=>f[0]===article.key),redistributive=['transfers','healthcare','publicInvestment','minimumWage'].includes(article.key),direction=redistributive?-party.platform.economy:-party.platform.economy;
    const proposed=clamp(article.value+direction*(article.key==='minimumWage'?8:1),field[2],field[3]);
    if(Math.abs(proposed-article.value)>.2)bill.amendments.push({id:bill.amendments.length+1,partyId:party.id,articleId:article.id,value:Math.round(proposed*100)/100,status:'offered',reason:'Приблизить статью к программе партии; поддержка остальных статей оценивается отдельно.'});
  }
  return bill;
}
function resetVotes(bill){bill.revision++;bill.status='draft';bill.finalVote=null;bill.fingerprint=fingerprintOf(bill.patch,bill.constitutionPatch,bill.actions);for(const a of bill.articles){a.status='pending';delete a.vote;}bill.votes=[];}
const voteSummary=r=>{const {deputies,...summary}=r;return summary;};
export function amendBill(s,id,articleId,value){const b=s.politics.bills.find(x=>x.id===id);if(!b||!['draft','articles','rejected','vetoed'].includes(b.status))throw new Error('Этот закон уже нельзя править');const a=b.articles.find(x=>x.id===articleId);if(!a||a.key.startsWith('action.')||a.key==='renewBudget')throw new Error('Операцию или чистое продление нельзя подменить числом; внесите содержательный альтернативный бюджет');
  const field=POLICY_FIELDS.find(f=>f[0]===a.key);if(JSON.stringify(value)===JSON.stringify(a.value)||field&&Math.abs(value-a.value)<field[4]/2)throw new Error('Поправка должна содержательно менять статью; прежние голоса сохраняются');
  if(a.key.startsWith('constitution.')){const k=a.key.slice(13);constitutionFrom({...s.politics.constitution,...b.constitutionPatch,[k]:value});b.constitutionPatch[k]=value;}
  else if(a.key!=='renewBudget'){validatePolicyPatch({[a.key]:value});b.patch[a.key]=value;}a.value=value;resetVotes(b);s.politics.lastActions.push({kind:'articleAmended',billId:id,articleId,value});return b;}
export function acceptAmendment(s,id,amendmentId){const b=s.politics.bills.find(x=>x.id===id),a=b?.amendments.find(x=>x.id===amendmentId);if(!a||a.status!=='offered')throw new Error('Поправка недоступна');amendBill(s,id,a.articleId,a.value);a.status='accepted';s.politics.parties.find(x=>x.id===a.partyId).negotiatedBill=id;}
function projectedPlatform(s,bill,article){const patch=article?article.key in BASE_POLICY?{[article.key]:article.value}:{}:bill.patch;return governedPlatform({...s,policy:{...s.policy,...patch}});}
export function rollCall(s,bill,{article=null,override=false,confidence=false,impeachment=false}={}){
  const p=s.politics,c=p.constitution,old=governedPlatform(s),next=projectedPlatform(s,bill,article),constitutional=bill.kind==='constitutional';
  const counts={yes:0,no:0,abstain:0},parties=[],deputies=[];
  for(const party of p.parties.filter(x=>x.seats>0)){
    const coalition=p.coalition.includes(party.id),alignment=distance(party.platform,old)-distance(party.platform,next),negotiated=party.negotiatedBill===bill.id;
    let utility=(coalition?.9:-.45)+5*alignment+.65*(negotiated?1:0)+.3*(party.id===bill.sponsor?1:0)-party.coalitionGrievance;
    if(constitutional){const weakensRights=Object.entries(bill.patch).some(([k,v])=>CONSTITUTIONAL_POLICY_KEYS.includes(k)&&v===false);utility+=(weakensRights?-2*party.platform.liberty:party.platform.liberty*.35);if(bill.constitutionPatch.form)utility-=.3;}
    if(override)utility-=.35;if(confidence)utility=coalition?1.4-party.coalitionGrievance*2:-1.2;
    if(impeachment)utility=(p.executive.legalExposure>0?1.4:-4)+(coalition?-.7:0);
    const row={id:party.id,yes:0,no:0,abstain:0};
    for(let i=0;i<party.seats;i++){
      const member=party.deputies[i],local=(hash(s.seed,'deputy-ideology',member?.id??`${party.id}-${i}`)-.5)*.7;
      const u=utility+local+(party.id===p.executive.playerParty?.2:0),prob=logistic(u*2.2);
      const draw=hash(s.seed,'rollcall',bill.id,bill.revision,article?.id??'final',override,confidence,impeachment,member?.id??i,party.id),abs=clamp(.025+.09*(1-party.discipline),.015,.12);
      const vote=draw<abs?'abstain':(draw-abs)/(1-abs)<prob?'yes':'no';counts[vote]++;row[vote]++;deputies.push({id:member?.id??`${party.id}-${i}`,partyId:party.id,district:member?.district??null,vote});
    }parties.push(row);
  }
  const total=p.totalSeats,present=counts.yes+counts.no,quorum=Math.ceil(total/2),fraction=impeachment?2/3:override?c.overrideFraction:constitutional?c.constitutionalFraction:.5;
  const required=fraction===.5?Math.floor(total/2)+1:Math.ceil(total*fraction-1e-9),passed=present>=quorum&&counts.yes>=required;
  const result={month:s.month,billId:bill.id,revision:bill.revision,articleId:article?.id??null,override,confidence,impeachment,...counts,total,quorum,required,passed,parties,deputies};p.rollCalls.push(result);return result;
}
export function voteArticle(s,id,articleId){const b=s.politics.bills.find(x=>x.id===id);if(!b||!['draft','articles'].includes(b.status))throw new Error('Голосование по этому законопроекту завершено');const a=b.articles.find(x=>x.id===articleId);if(!a)throw new Error('Статья не найдена');if(a.vote)return a.vote;
  const r=rollCall(s,b,{article:a});a.vote=voteSummary(r);a.status=r.passed?'accepted':'rejected';b.status='articles';b.votes.push(voteSummary(r));return r;}
export function voteBill(s,id){const p=s.politics,b=p.bills.find(x=>x.id===id);if(!b||!['draft','articles'].includes(b.status))throw new Error('Законопроект не готов к голосованию');
  for(const a of b.articles)if(!a.vote)voteArticle(s,id,a.id);
  if(b.articles.some(a=>a.status!=='accepted')){b.status='rejected';p.lastActions.push({kind:'billRejected',billId:id,reason:'Не все статьи приняты. Исправьте пакет или внесите новый.'});return null;}
  b.finalVote=voteSummary(rollCall(s,b));if(!b.finalVote.passed){b.status='rejected';return b.finalVote;}
  if(b.kind==='constitutional'&&p.constitution.constitutionalReferendum)b.status='referendum';
  else if(p.constitution.form!=='parliamentary'&&p.constitution.presidentialVeto)b.status='awaitingSignature';else b.status='passed';
  // A player PM cannot sign for a separately elected president.
  if(b.status==='awaitingSignature'&&p.executive.role==='primeMinister'){
    const pres=p.parties.find(x=>x.id===p.executive.presidentParty),benefit=distance(pres.platform,governedPlatform(s))-distance(pres.platform,projectedPlatform(s,b));
    b.status=p.coalition.includes(pres.id)||benefit>=-.04?'passed':'vetoed';b.presidentDecision={month:s.month,partyId:pres.id,decision:b.status};
  }
  p.lastActions.push({kind:'finalVote',billId:id,status:b.status});return b.finalVote;
}
export function presidentialDecision(s,id,decision){const p=s.politics,b=p.bills.find(x=>x.id===id);if(!b)throw new Error('Законопроект не найден');
  if(decision==='override'){if(b.status!=='vetoed')throw new Error('Вето не наложено');const r=rollCall(s,b,{override:true});if(r.passed)b.status='passed';b.votes.push(voteSummary(r));return r;}
  if(p.executive.role!=='president'||b.status!=='awaitingSignature')throw new Error('Подпись и вето принадлежат президенту');
  b.status=decision==='sign'?'passed':'vetoed';b.presidentDecision={month:s.month,partyId:p.executive.presidentParty,decision};p.lastActions.push({kind:'presidentDecision',billId:id,decision});
}
export function referendum(s,id){const p=s.politics,b=p.bills.find(x=>x.id===id);if(b?.status!=='referendum')throw new Error('Референдум по этому проекту не назначен');const groups=makeElectorate(s),old=governedPlatform(s),next=projectedPlatform(s,b);
  let yes=0,total=0,eligible=0;for(const g of groups){const u=distance(g.ideal,old)-distance(g.ideal,next),rights=Object.entries(b.patch).some(([k,v])=>CONSTITUTIONAL_POLICY_KEYS.includes(k)&&v===false)?-g.ideal.liberty:0;
    const c=p.constitution,patch=b.constitutionPatch;let institutional=0;
    for(const key of ['form','electoralSystem','confidence'])if(patch[key]!==undefined){const choices=key==='form'?['presidential','parliamentary','semiPresidential']:key==='confidence'?['ordinary','constructive']:['pr','plurality','twoRound','parallel','mmp'],preferred=choices[Math.floor(hash(s.seed,g.id,'constitutional-preference',key)*choices.length)];institutional+=.3*(Number(patch[key]===preferred)-Number(c[key]===preferred));}
    for(const key of ['independentCB','constitutionalReferendum'])if(patch[key]!==undefined)institutional+=.2*g.ideal.liberty*(Number(patch[key])-Number(c[key]));
    if(patch.termLimit!==undefined)institutional+=.12*g.ideal.liberty*(Number(patch.termLimit>0)-Number(c.termLimit>0));
    const weight=g.weight*turnout(s,g);yes+=weight*logistic(4*u+rights+institutional);total+=weight;eligible+=g.weight;}
  const voters=Math.round(total*1e6),counts=integerVotes([yes,total-yes],voters);
  b.referendum={month:s.month,yesShare:voters?counts[0]/voters*100:0,eligible:Math.round(eligible*1e6),voters,yesVotes:counts[0],noVotes:counts[1],passed:counts[0]>voters/2};b.status=b.referendum.passed?'passed':'rejected';p.lastActions.push({kind:'referendum',billId:id,result:clone(b.referendum)});
}
export function enactBills(s,events){const p=s.politics;
  for(const b of p.bills.filter(x=>x.status==='passed')){
    const unprotected=Object.entries(b.patch).some(([k,v])=>CONSTITUTIONAL_POLICY_KEYS.includes(k)&&v===false);
    if(b.kind!=='constitutional'&&unprotected){b.status='blockedByCourt';events.push('Суд остановил неконституционный закон.');continue;}
    p.lawPolicy={...p.lawPolicy,...b.patch};
    if(Object.keys(b.constitutionPatch).length){const previousForm=p.constitution.form;p.constitution=constitutionFrom({...p.constitution,...b.constitutionPatch});p.executive.role=p.constitution.playerRole;
      if(p.constitution.form==='parliamentary'){p.nextPresidentElection=null;p.executive.primeMinisterParty=p.executive.playerParty;if(p.parliamentSupport<=.5)p.executive.formationDeadline=s.month+3;}
      else if(previousForm==='parliamentary'){p.nextPresidentElection=s.month+3;p.executive.termsServed=0;events.push('Переходная исполнительная власть: прямые президентские выборы через три месяца.');}
    }
    for(const a of b.actions){s.pendingActions.push({...clone(a),authorizedMonth:s.month,effectiveMonth:s.month});p.authorizedActions.push(a.id);}
    if(b.kind==='budget'||b.renewBudget){p.budgetExpires=s.month+12;p.provisionalBudget=false;}
    b.status='enacted';b.enactedMonth=s.month;p.lastActions.push({kind:'lawEnacted',billId:b.id,patch:clone(b.patch),constitutionPatch:clone(b.constitutionPatch)});events.push(`Закон «${b.title}» вступил в силу.`);
  }
}

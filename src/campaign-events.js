import {clamp} from './political-config.js';
import {recentLivingConditions} from './electoral-performance.js';
import {parliamentary,playerExecutive} from './parliamentary-state.js';
import {POLICY_FIELDS,POLICY_CHOICES} from './config.js';
import {partyPolicyTargets} from './party-programs.js';

// Gameplay coefficients, not estimated election effects. Existing voter utilities
// turn these small, temporary signals into votes; no fixed rating bonus.
export const CAMPAIGN_SCENES=[
 {title:'Интервью перед выборами',text:'Журналист спрашивает, почему избирателям стоит снова поддержать вашу партию.',choices:[{label:'Обсудить реальные результаты',hint:'Успехи помогут, инфляция и безработица ослабят аргумент.',kind:'results'},{label:'Защитить политические принципы партии',hint:'Близкие по взглядам избиратели откликнутся; оппоненты могут отдалиться.',kind:'principles'}]},
 {title:'Дебаты с соперником',text:'Соперник требует назвать главный экономический приоритет.',choices:[{label:'Свобода бизнеса и рыночные реформы',hint:'Привлечёт сторонников рынка, но оттолкнёт сторонников перераспределения.',kind:'market'},{label:'Социальная защита и перераспределение',hint:'Привлечёт сторонников социальной политики, но оттолкнёт сторонников рынка.',kind:'social'}]},
 {title:'Поездка перед выборами',text:'У вас есть время на одну встречу с избирателями. Где провести её?',choices:[{label:'В столице',hint:'Больше внимания столичным избирателям; другие регионы получат меньше внимания.',kind:'capital'},{label:'В сельских регионах',hint:'Больше внимания сельским избирателям; другие регионы получат меньше внимания.',kind:'rural'}]}
];
const issues={
 income:{label:'Доходы и стоимость жизни',keys:['transfers','minimumWage','incomeTax','vat']},
 jobs:{label:'Рабочие места',keys:['businessSupport','publicInvestment','retrainingBudget']},
 prices:{label:'Рост цен',keys:['tariff','vat']}
};
const policyLabel=key=>POLICY_FIELDS.find(field=>field[0]===key)?.[1]??
 POLICY_CHOICES.find(field=>field[0]===key)?.[1];
function currentScene(s,phase){
 const p=s.politics,own=p.executive.playerParty;
 const history=p.economicHistory,reference=history.find(h=>h.month>=s.month-6)??history.at(-1);
 const conditions=recentLivingConditions(s,reference);
 const topic=Object.keys(issues).sort((a,b)=>Math.abs(conditions[b])-Math.abs(conditions[a]))[0],issue=issues[topic];
 const government=playerExecutive(s)&&(!parliamentary(s)||!p.parliamentary.caretaker);
 const recent=p.bills.findLast(b=>b.publicReaction&&b.decidedMonth>=s.month-6&&
  (b.sponsor===own||b.executiveResponse||['accept','reject'].includes(b.playerVote))&&
  Object.keys(b.patch??{}).some(policyLabel));
 const lawLabel=recent&&policyLabel(Object.keys(recent.patch).find(policyLabel));
 if(phase===1&&lawLabel){
  return {title:'Дебаты о решении парламента',text:lawLabel,choices:[
   {label:'Объяснить позицию фракции',kind:'vote',bill:recent},
   {label:'Перейти к теме «'+issue.label+'»',kind:'record',topic,reference,government}
  ]};
 }
 const party=p.parties.find(x=>x.id===own),targets=partyPolicyTargets(s,party);
 const key=issue.keys.find(k=>Number.isFinite(targets[k])&&Math.abs(targets[k]-s.policy[k])>.1);
 const label=key?((targets[key]>s.policy[key]?'Предложить повышение: ':'Предложить снижение: ')+policyLabel(key)):'Объяснить действующую позицию';
 return {title:phase===2?'Последнее интервью':phase===1?'Предвыборные дебаты':'Вопрос журналиста',text:issue.label,choices:[
  {label:government?'Оценить работу кабинета':'Оценить действия правительства',kind:'record',topic,reference,government},
  {label,kind:'proposal',key,value:key?targets[key]:null}
 ]};
}
export function campaignEvent(s){
 const p=s.politics;if(!p?.enabled||!p.executive.inOffice||!s.policy.competitiveElections)return null;
 const elections=[['parliament',Math.min(p.nextParliamentElection,p.scheduledParliament??Infinity)],['president',p.nextPresidentElection]].filter(([,due])=>Number.isFinite(due)&&due>s.month).sort((a,b)=>a[1]-b[1]);
 for(const [kind,due] of elections){const remaining=due-s.month;if(remaining>12)continue;const phase=remaining>8?0:remaining>4?1:2,id=`campaign:${kind}:${due}:${phase}`;
  if((p.campaignResponses??[]).some(x=>x.id===id))continue;
  return {id,kind,due,remaining,phase,...(p.politicalDynamicsRevision?currentScene(s,phase):CAMPAIGN_SCENES[phase])};
 }
 return null;
}
export function respondToCampaign(s,command){
 const e=campaignEvent(s);if(!e||e.id!==command.eventId||![0,1].includes(command.choice))throw new Error('Предвыборное событие уже завершено или недоступно');
 const p=s.politics,own=p.parties.find(x=>x.id===p.executive.playerParty),choice=e.choices[command.choice],signal={month:s.month,type:'campaign',partyId:own.id,electionKind:e.kind,eventId:e.id,attention:0,region:null,effect:0};
 if(choice.kind==='record'){
  const change=recentLivingConditions(s,choice.reference)[choice.topic];
  signal.effect=clamp(change*(choice.government?1:-.45),-.085,.085);
 }
 if(choice.kind==='vote'){
  const event=p.publicEvents.findLast(x=>x.type==='decision'&&x.billId===choice.bill.id);
  const attribution=event?.partyWeights?event.partyWeights[own.id]:event?.presidentParty===own.id?event.presidentWeight:event?.sponsor===own.id?event.sponsorWeight:0;
  if(attribution)signal.groupEffects=Object.fromEntries(Object.entries(event.effects).map(([id,value])=>[id,clamp(.5*value*attribution,-.06,.06)]));
 }
 if(choice.kind==='proposal'){
  if(choice.key)signal.proposal={key:choice.key,value:choice.value,before:s.policy[choice.key]};
 }
 if(choice.kind==='results')signal.effect=Math.max(-.08,Math.min(.08,.04+(s.metrics.realIncomeIndex-100)*.002-Math.max(0,s.metrics.inflationYoY-10)*.002-Math.max(0,s.metrics.unemployment-9)*.004));
 if(['principles','market','social'].includes(choice.kind)){signal.axis='economy';signal.position=choice.kind==='principles'?own.platform.economy:choice.kind==='market'?1:-1;signal.effect=.12;}
 if(['capital','rural'].includes(choice.kind)){signal.region=choice.kind==='capital'?0:2;signal.effect=.12;signal.otherRegionEffect=-.025;}
 p.publicEvents.push(signal);p.campaignResponses??=[];p.campaignResponses.push({id:e.id,month:s.month,kind:e.kind,due:e.due,title:e.title,choice:command.choice,label:choice.label});
 p.lastActions.push({kind:'campaignResponse',eventId:e.id,choice:command.choice,label:choice.label});
 return choice.hint??'Позиция партии опубликована.';
}
const voterTargets=new WeakMap();
function proposalEffect(s,g,proposal){
 let targets=voterTargets.get(g);
 if(!targets){targets=partyPolicyTargets(s,{platform:g.ideal,family:null});voterTargets.set(g,targets);}
 const target=targets[proposal.key],field=POLICY_FIELDS.find(f=>f[0]===proposal.key);
 if(!Number.isFinite(target)||!field)return 0;
 return .08*clamp((Math.abs(target-proposal.before)-Math.abs(target-proposal.value))/((field[3]-field[2])*.25),-1,1);
}
export function campaignUtility(s,g,party,kind){
 return s.politics.publicEvents.filter(e=>e.type==='campaign'&&e.partyId===party.id&&(e.electionKind==='president'?(kind==='president'):(kind!=='president'))).reduce((v,e)=>v+(e.proposal?proposalEffect(s,g,e.proposal):e.groupEffects?(e.groupEffects[g.id]??0):e.axis?e.effect*e.position*g.ideal[e.axis]:e.region===null||e.region===g.region?e.effect:e.otherRegionEffect??0)*Math.exp(-(s.month-e.month)/6),0);
}

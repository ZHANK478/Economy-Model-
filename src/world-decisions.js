import {attachBritishMission, britishDefenseActive, britishDefenseEvents, iraqMission, missionOutcomeText, shippingPremium} from './british-defense.js';
import {playerExecutive} from './parliamentary-state.js';

const option=(ru,en,result,enResult,effects={})=>({ru,en,result,enResult,...effects});

const monthIndex=(year,month)=>(year-2000)*12+month-1;

export const WORLD_DECISIONS=[
  {id:'iraq',date:monthIndex(2003,3),window:1,title:'Запрос союзников по Ираку',en:'Allied request on Iraq',
    text:'Вашингтон просит Британию присоединиться к коалиции. Инспекторы ООН ещё работают. Кабинету предстоит ответить.',
    enText:'Washington asks Britain to join the coalition. UN inspectors are still at work. The cabinet must respond.',
    defense:{partners:['USA'],subject:'IRQ',label:'Ирак',enLabel:'Iraq'},fallback:'decline',motion:'join',options:{
      join:option('Вынести участие на голосование','Put participation to a vote','Британия вступает в коалицию','Britain joins the coalition',{spending:.00065,months:36,signal:.80,mission:iraqMission}),
      un:option('Добиваться продолжения инспекций ООН','Seek further UN inspections','Лондон добивается продолжения инспекций','London seeks further UN inspections',{signal:-.25}),
      decline:option('Отказаться от участия','Decline military participation','Британия остаётся вне коалиции','Britain stays out of the coalition',{signal:-.65}),
    }},
  {id:'syria',date:monthIndex(2015,9),window:3,title:'Сирийские беженцы',en:'Syrian refugees',
    text:'Из-за войны семьи покидают Сирию. Кабинет решает, финансировать ли помощь в соседних странах и открывать ли программу переселения.',
    enText:'Families are fleeing the war in Syria. The cabinet must decide whether to fund relief in neighbouring countries, run a resettlement programme, or both.',
    fallback:'decline',options:{
      aid:option('Финансировать помощь за рубежом','Fund relief abroad','Кабинет выделил средства на помощь за рубежом','The cabinet funds relief abroad',{spending:.00010,months:36,signal:.25}),
      resettle:option('Открыть программу переселения','Open a resettlement programme','Британия открыла программу переселения','Britain opens a resettlement programme',{arrivals:20000,months:60,signal:.65}),
      both:option('Совместить помощь и переселение','Fund relief and resettle families','Кабинет утвердил помощь и переселение','The cabinet funds relief and opens resettlement',{spending:.00010,arrivals:20000,months:60,signal:.80}),
      decline:option('Оставить нынешнюю политику','Keep current policy','Кабинет сохранил нынешний курс','The cabinet keeps its current policy',{signal:-.60}),
    }},
  {id:'huawei',date:monthIndex(2020,7),window:3,title:'Оборудование Huawei в сетях 5G',en:'Huawei equipment in 5G networks',
    text:'Санкции США меняют цепочку поставок Huawei. Операторам связи нужен срок, к которому они должны заменить оборудование.',
    enText:'US sanctions change Huawei’s supply chain. Operators are waiting for a deadline to replace the equipment.',
    fallback:'retain',options:{
      phase:option('Заменять оборудование постепенно','Phase out the equipment','Началась поэтапная замена оборудования','A phased replacement programme begins',{premium:.014,months:84,signal:.25}),
      fast:option('Ускорить замену оборудования','Accelerate replacement','Кабинет ускорил замену оборудования','The cabinet accelerates equipment replacement',{premium:.042,months:28,signal:.75}),
      retain:option('Оставить оборудование под надзором','Keep the equipment under review','Оборудование пока остаётся в сетях','The equipment remains in use under review',{signal:-.50}),
    }},
  {id:'hong-kong',date:monthIndex(2020,7),window:3,title:'Визовый маршрут для Гонконга',en:'A Hong Kong visa route',
    text:'После принятия закона о национальной безопасности кабинет решает, открывать ли отдельный маршрут для обладателей статуса BN(O) и их семей.',
    enText:'After the national security law is introduced, the cabinet considers a dedicated route for BN(O) status holders and their families.',
    fallback:'standard',options:{
      route:option('Открыть маршрут BN(O)','Open a BN(O) route','Британия открыла визовый маршрут BN(O)','Britain opens a BN(O) visa route',{arrivals:140000,months:60,delay:6,signal:.75}),
      standard:option('Сохранить действующие визовые правила','Keep existing visa rules','Лондон сохранил действующие визовые правила','London keeps its existing visa rules',{signal:-.60}),
    }},
];
const newDefenseIds=new Set(britishDefenseEvents.map(event=>event.id));
const allEvents=[...WORLD_DECISIONS,...britishDefenseEvents].sort((a,b)=>a.date-b.date);
const eventsById=new Map(allEvents.map(event=>[event.id,event]));
export const worldDecisionById=id=>eventsById.get(id);
export const worldDecisionStart=(s,event)=>event.date-12*((s.startYear??2000)-2000);
const start=worldDecisionStart;
const availableEvents=s=>allEvents.filter(event=>!newDefenseIds.has(event.id)||
  britishDefenseActive(s)&&start(s,event)>=s.politics.britishDefenseStart);

export function pendingWorldDecisions(s){
  if(s.scenario?.id!=='uk-2000'||s.politics?.historicalWorldStart===undefined)return [];
  return availableEvents(s).filter(event=>{
    const onset=start(s,event);
    return onset>=s.politics.historicalWorldStart&&onset<=s.month&&s.month<onset+event.window&&
      !s.politics.worldDecisions?.[event.id];
  });
}

export function worldDecisionOpinion(event,platform){
  if(event.id==='iraq')return Math.max(-1,Math.min(1,.35*platform.openness-.42*platform.liberty+.70*platform.culture+.16));
  if(event.id==='huawei')return .62*platform.culture-.40*platform.openness;
  return .75*platform.openness+.25*platform.liberty-.45*platform.culture;
}

export function resolveWorldDecision(s,event,choice,{vote,positions,sponsor,expired=false}={}){
  const p=s.politics;
  (p.worldDecisions??={})[event.id]={choice,month:s.month,sponsor,expired,
    ...(vote?{vote:{yes:vote.yes,no:vote.no,abstain:vote.abstain,passed:vote.passed}}:{})};
  attachBritishMission(s,event,choice,p.worldDecisions[event.id]);
  p.publicEvents.push({type:'worldDecision',id:event.id,month:s.month,region:null,effect:0,attention:.03,
    positions:positions??(sponsor?{[sponsor]:event.options[choice].signal}:{})});
}

export function worldDecisionResponse(s,event,command,rollCall){
  if(!pendingWorldDecisions(s).includes(event))throw new Error('Это событие уже завершилось.');
  const p=s.politics,executive=playerExecutive(s),sponsor=p.executive.primeMinisterParty;
  if(!sponsor)throw new Error('Сначала должен быть сформирован кабинет.');
  if(executive&&command.choice!==event.motion&&Object.hasOwn(event.options,command.choice)){
    resolveWorldDecision(s,event,command.choice,{sponsor});return;
  }
  if(!event.motion||!['accept','reject','abstain'].includes(command.vote)||
      (executive?command.choice!==event.motion:command.choice!=='motion'))throw new Error('Это решение принимает кабинет.');
  ballot(s,event,command.vote,sponsor,executive,rollCall);
}
function ballot(s,event,instruction,sponsor,executive,rollCall,expired=false){
  const p=s.politics;
  const controlled=executive?p.coalition:[p.executive.playerParty];
  const vote=rollCall(s,{id:-10000-event.date,revision:0,kind:'ordinary',patch:{},sponsor},
    {motion:{alignment:party=>worldDecisionOpinion(event,party.platform),controlled,instruction}});
  const positions=Object.fromEntries(vote.parties.map(row=>[row.id,.80*(row.yes-row.no)/Math.max(1,row.yes+row.no+row.abstain)]));
  resolveWorldDecision(s,event,vote.passed?event.motion:event.fallback,{vote,positions,sponsor,expired});
}

export function expireWorldDecisions(s,prev,rollCall){
  for(const event of pendingWorldDecisions(prev)){
    if(s.month<start(s,event)+event.window)continue;
    const sponsor=prev.politics.executive.primeMinisterParty;
    if(sponsor&&!playerExecutive(prev)){
      if(event.motion)ballot(s,event,'abstain',sponsor,false,rollCall,true);
      else{
        const platform=prev.politics.parties.find(p=>p.id===sponsor)?.platform;
        const opinion=platform?worldDecisionOpinion(event,platform):0;
        const choice=Object.keys(event.options).reduce((best,id)=>Math.abs(event.options[id].signal-opinion)<Math.abs(event.options[best].signal-opinion)?id:best,event.fallback);
        resolveWorldDecision(s,event,choice,{sponsor,expired:true});
      }
    }else resolveWorldDecision(s,event,event.fallback,{sponsor,expired:true});
  }
}

export function worldDecisionAnnouncements(s){
  if(s.scenario?.id!=='uk-2000'||s.politics?.historicalWorldStart===undefined)return [];
  return availableEvents(s).flatMap(event=>{
    const onset=start(s,event);
    if(onset<s.politics.historicalWorldStart||onset>s.month)return [];
    return [{id:'agenda:'+event.id,decisionId:event.id,start:onset,title:event.title,enTitle:event.en,text:event.text,enText:event.enText}];
  });
}

export function worldDecisionNews(s){
  return availableEvents(s).flatMap(event=>{
    const result=s.politics?.worldDecisions?.[event.id];
    if(!result)return [];
    const selected=event.options[result.choice];
    const declined=result.vote&&!result.vote.passed;
    const vote=result.vote;
    const text=vote?`Голосование: за — ${vote.yes}, против — ${vote.no}, воздержались — ${vote.abstain}.`:
      result.expired?'Срок ответа истёк. Кабинет определился к концу срока.':selected.result+'.';
    const enText=vote?`The vote: ${vote.yes} in favour, ${vote.no} against and ${vote.abstain} abstentions.`:
      result.expired?'The cabinet settled its position when the response period ended.':selected.enResult+'.';
    const articles=[{id:'decision:'+event.id,start:result.month,
      title:declined?(event.id==='iraq'?'Палата общин отклонила участие в Ираке':'Палата общин отклонила предложение'):selected.result,
      enTitle:declined?(event.id==='iraq'?'Commons rejects participation in Iraq':'Commons rejects the motion'):selected.enResult,
      text,enText,vote,expired:result.expired}];
    const outcome=result.mission?.outcome;
    if(outcome){
      const [title,enTitle,text,enText]=missionOutcomeText(event,outcome.status);
      articles.push({id:'mission:'+event.id,start:outcome.month,
        title:event.defense.label+' · '+title,enTitle:event.defense.enLabel+' · '+enTitle,
        text,enText});
    }
    return articles;
  });
}

export function worldDecisionEffects(s){
  const result={spending:0,arrivals:0,premium:0,freight:0};
  for(const [id,decision] of Object.entries(s.politics?.worldDecisions??{})){
    const choice=worldDecisionById(id)?.options[decision.choice];
    const age=s.month-decision.month-(choice?.delay??0);
    const m=decision.mission;
    if(m){
      if(age>=1&&age<=m.months)result.spending+=m.spending;
      continue;
    }
    if(!choice||age<1||age>choice.months||!choice.months)continue;
    result.spending+=choice.spending??0;
    result.arrivals+=(choice.arrivals??0)/choice.months/1e6;
    result.premium+=choice.premium??0;
  }
  for(const event of availableEvents(s)) {
    const onset=start(s,event);
    if(s.politics?.historicalWorldStart!==undefined&&onset>=s.politics.historicalWorldStart)
      result.freight+=shippingPremium(s,event,onset);
  }
  return result;
}

const month = (year,number) => (year-2000)*12+number-1;
const option = (ru,en,result,enResult,signal,mission=null) => ({ru,en,result,enResult,signal,mission});
const mission = (kind,demand,months,spending) => ({kind,demand,months,spending});

export const iraqMission = mission('joint',2,36,.00065);

export const britishDefenseEvents = [
  {id:'syria-2013',date:month(2013,8),window:2,title:'После Гуты кабинет просит слова у Палаты общин',en:'After Ghouta, the cabinet turns to the Commons',
   text:'Сообщения о гибели мирных жителей под Дамаском вновь поставили вопрос о британском участии. Союзники ждут ответа Лондона.\n\nВ Палате общин обсуждают, достаточно ли сведений для решения и какие обязательства оно создаст.',
   enText:'Reports of civilian deaths outside Damascus have reopened the question of British involvement. Allies await London’s reply.\n\nThe Commons is debating whether the evidence is sufficient and what commitments a decision would create.',
   defense:{partners:['USA','FRA'],subject:'SYR',label:'Сирия · 2013',enLabel:'Syria · 2013'},fallback:'un',motion:'join',options:{
     join:option('Вынести участие на голосование','Put participation to a vote','Палата одобрила участие Британии','Commons backs British participation',.55,mission('joint',2,3,.00035)),
     un:option('Продолжить дипломатические усилия','Continue diplomatic efforts','Лондон продолжит работу через ООН','London will continue working through the UN',.1),
     decline:option('Отказаться от участия','Decline participation','Лондон отказался от участия','London declines participation',-.25)
   }},
  {id:'syria-2015-defense',date:month(2015,12),window:2,title:'Палата общин обсуждает расширение миссии против ИГИЛ',en:'Commons weighs expanding the mission against ISIL',
   text:'Партнёры по коалиции просят распространить британский мандат на Сирию. Кабинет предлагает вынести вопрос в Палату общин.\n\nДепутаты требуют ясных целей, оценки расходов и срока пересмотра решения.',
   enText:'Coalition partners want Britain’s mandate extended to Syria. The cabinet proposes putting the question to the Commons.\n\nMPs want clear objectives, a cost estimate and a review date.',
   defense:{partners:['USA','FRA'],subject:'SYR',label:'Сирия · 2015',enLabel:'Syria · 2015'},fallback:'decline',motion:'join',options:{
     join:option('Вынести расширение мандата на голосование','Put the mandate to a vote','Палата одобрила расширение мандата','Commons approves a wider mandate',.6,mission('joint',2,6,.0004)),
     decline:option('Сохранить нынешний мандат','Keep the current mandate','Британия сохранила прежний мандат','Britain retains the existing mandate',-.25)
   }},
  {id:'nato-2014',date:month(2014,9),window:3,title:'Союзники на Балтике ждут гарантий от Лондона',en:'Baltic allies seek assurances from London',
   text:'После аннексии Крыма восточные члены НАТО добиваются большей поддержки. В преддверии союзных консультаций Эстония просит Лондон подкрепить заявления вкладом в общую миссию.\n\nАдмиралтейство предупреждает, что это займёт часть доступного флота.',
   enText:'After the annexation of Crimea, NATO’s eastern members are seeking greater support. Ahead of allied talks, Estonia is asking London to back its assurances with a contribution to a joint mission.\n\nThe Admiralty says this would commit part of the available fleet.',
   defense:{partners:['EST','LVA','LTU'],subject:'RUS',label:'Поддержка союзников на Балтике',enLabel:'Support for Baltic allies'},fallback:'talks',options:{
     deploy:option('Выделить силы флота для совместной миссии','Contribute naval forces to the joint mission','Лондон выделяет силы для поддержки союзников','London commits naval forces to allied support',.5,mission('fleet',1,6,.00025)),
     talks:option('Ограничиться дипломатической поддержкой','Offer diplomatic support','Лондон подтверждает дипломатическую поддержку','London confirms diplomatic support',.1)
   }},
  {id:'ukraine-2022',date:month(2022,2),window:3,title:'Вторжение России в Украину меняет повестку кабинета',en:'Russia’s invasion of Ukraine reshapes the cabinet’s agenda',
   text:'Киев просит помощи.\n\nСоюзники НАТО обсуждают, как поддержать Украину и укрепить гарантии безопасности своим членам. Кабинету предстоит определить британский вклад и объяснить парламенту его стоимость.',
   enText:'Kyiv is asking for help.\n\nNATO allies are discussing how to support Ukraine and reinforce security assurances to their members. The cabinet must decide what Britain will contribute and explain the cost to Parliament.',
   defense:{partners:['UKR','POL','EST'],subject:'RUS',label:'Поддержка Украины',enLabel:'Support for Ukraine'},fallback:'diplomacy',options:{
     support:option('Утвердить программу поддержки','Approve a support programme','Лондон утвердил программу поддержки Украины','London approves a Ukraine support programme',.7,mission('support',2,8,.00055)),
     diplomacy:option('Сосредоточиться на дипломатии','Focus on diplomacy','Лондон сосредоточился на дипломатических мерах','London focuses on diplomatic action',.15)
   }},
  {id:'red-sea-2024',date:month(2024,1),window:3,title:'Суда уходят с маршрута через Красное море',en:'Ships divert from the Red Sea route',
   text:'Судоходные компании меняют маршруты после нападений на торговые суда. Поставки идут дольше, а перевозки дорожают.\n\nПартнёры предлагают совместную миссию по защите торгового судоходства и спрашивают, какие силы может выделить Британия.',
   enText:'Shipping companies are rerouting after attacks on merchant ships. Deliveries are taking longer and freight costs are rising.\n\nPartners propose a joint mission to protect commercial shipping and ask what Britain can contribute.',
   defense:{partners:['USA','FRA'],subject:'YEM',label:'Красное море',enLabel:'Red Sea',tradeMonths:12,premium:.018,relief:.012},fallback:'decline',options:{
     patrol:option('Присоединиться к защите судоходства','Join the shipping protection mission','Британия присоединяется к защите судоходства','Britain joins the shipping protection mission',.6,mission('fleet',2,9,.00032)),
     decline:option('Оставить перевозчикам обходной маршрут','Leave shipping firms to use the diversion','Перевозчики сохраняют обходной маршрут','Shipping firms keep using the diversion',-.2)
   }},
];

export const britishDefenseActive=s=>s.scenario?.id==='uk-2000'&&s.politics?.britishDefenseRevision===1;
const clamp=value=>Math.max(0,Math.min(1,value));

export function fleetCapacity(s){
  const d=s.defense;
  if(!d?.enabled)return 0;
  return clamp(.30*d.funding+.30*d.logistics+.25*d.readiness+.15*d.supplyCoverage);
}

export function britishFleet(s){
  const level=fleetCapacity(s);
  const groups=4,ready=Math.min(groups,Math.floor(level*(groups+1)));
  const active=Object.entries(s.politics?.worldDecisions??{}).filter(([,row])=>row.mission&&!row.mission.outcome);
  let used=0;
  const missions=active.map(([id,row])=>{
    const model=row.mission;
    const allocation=model.kind==='fleet'?Math.min(model.demand,Math.max(0,ready-used)):0;
    used+=allocation;
    return {id,...model,allocation};
  });
  return {groups,ready,used,available:ready-used,missions};
}

export function attachBritishMission(s,event,choice,row){
  if(!britishDefenseActive(s)||!event.defense)return;
  row.foreignResponse={partners:[...event.defense.partners],subject:event.defense.subject,choice};
  const plan=event.options[choice].mission;
  if(plan)row.mission={...plan,start:s.month,samples:0,capacitySum:0};
}

export function advanceBritishMissions(s,flow){
  if(!britishDefenseActive(s))return;
  const fleet=britishFleet(s);
  for(const report of fleet.missions){
    const row=s.politics.worldDecisions[report.id],m=row.mission;
    const age=s.month-m.start;
    if(age<1||age<=m.samples)continue;
    const strength=m.kind==='fleet'?report.allocation/m.demand:fleetCapacity(s);
    const covered=flow.worldCommitmentDue>0?clamp((flow.worldCommitments??0)/flow.worldCommitmentDue):0;
    const capacity=strength*covered;
    m.capacitySum+=capacity;
    m.samples++;
    if(age>=m.months){
      const average=m.capacitySum/m.samples;
      m.outcome={month:s.month,status:average>=.76?'fulfilled':average>=.40?'limited':'shortfall'};
    }
  }
}

export function shippingPremium(s,event,onset){
  if(!britishDefenseActive(s)||!event.defense?.tradeMonths)return 0;
  const age=s.month-onset;
  if(age<0||age>=event.defense.tradeMonths)return 0;
  const m=s.politics.worldDecisions?.[event.id]?.mission;
  const coverage=m?.samples?Math.min(1,m.capacitySum/m.samples):0;
  return event.defense.premium-event.defense.relief*coverage;
}

export function missionOutcomeText(event,status){
  if(event.defense.tradeMonths){
    if(status==='fulfilled')return ['Перевозчики сообщают о снижении издержек','Shipping firms report lower costs','Суда всё ещё используют разные маршруты, однако британский вклад в совместную миссию уменьшил надбавку к стоимости перевозок.','Ships are still using different routes, but Britain’s contribution to the joint mission reduced the freight surcharge.'];
    if(status==='limited')return ['Судоходство получило лишь частичную поддержку','Shipping receives only partial support','Доступных сил хватило на часть обязательств. Перевозчики продолжают платить повышенные ставки.','Available forces covered part of the commitment. Shipping firms continue to pay elevated rates.'];
    return ['Перевозки остаются дорогими','Freight costs remain high','Британия смогла предоставить лишь ограниченную часть обещанных сил. Основная надбавка к стоимости перевозок сохраняется.','Britain provided only a limited share of the forces it pledged. Most of the freight surcharge remains.'];
  }
  if(status==='fulfilled')return ['Британия выполнила обязательства по миссии','Britain meets its mission commitment','Кабинет отчитался о завершении британского вклада. Союзники получили поддержку в согласованном объёме.','The cabinet reported on the completion of Britain’s contribution. Allies received the agreed level of support.'];
  if(status==='limited')return ['Британская миссия выполнена частично','British mission only partly fulfilled','Часть обещанной помощи предоставлена. Готовность сил и финансирование ограничили выполнение остальных обязательств.','Some pledged support was provided. Readiness and funding limited the rest of the commitment.'];
  return ['Британская миссия не выполнила обещанный объём','Mission ends with commitments unfulfilled','Партнёры получили лишь ограниченную поддержку. Кабинету предстоит объяснить, почему имеющихся сил и ресурсов оказалось недостаточно.','Partners received only limited support. The cabinet must explain why available forces and resources fell short.'];
}

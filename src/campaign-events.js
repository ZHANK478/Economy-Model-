// Gameplay coefficients, not estimated election effects. Existing voter utilities
// turn these small, temporary signals into votes; no fixed rating bonus.
export const CAMPAIGN_SCENES=[
 {title:'Интервью перед выборами',text:'Журналист спрашивает, почему избирателям стоит снова поддержать вашу партию.',choices:[{label:'Обсудить реальные результаты',hint:'Успехи помогут, инфляция и безработица ослабят аргумент.',kind:'results'},{label:'Защитить политические принципы партии',hint:'Близкие по взглядам избиратели откликнутся; оппоненты могут отдалиться.',kind:'principles'}]},
 {title:'Дебаты с соперником',text:'Соперник требует назвать главный экономический приоритет.',choices:[{label:'Свобода бизнеса и рыночные реформы',hint:'Привлечёт сторонников рынка, но оттолкнёт сторонников перераспределения.',kind:'market'},{label:'Социальная защита и перераспределение',hint:'Привлечёт сторонников социальной политики, но оттолкнёт сторонников рынка.',kind:'social'}]},
 {title:'Поездка перед выборами',text:'У вас есть время на одну встречу с избирателями. Где провести её?',choices:[{label:'В столице',hint:'Больше внимания столичным избирателям; другие регионы получат меньше внимания.',kind:'capital'},{label:'В сельских регионах',hint:'Больше внимания сельским избирателям; другие регионы получат меньше внимания.',kind:'rural'}]}
];
export function campaignEvent(s){
 const p=s.politics;if(!p?.enabled||!p.executive.inOffice||!s.policy.competitiveElections)return null;
 const elections=[['parliament',Math.min(p.nextParliamentElection,p.scheduledParliament??Infinity)],['president',p.nextPresidentElection]].filter(([,due])=>Number.isFinite(due)&&due>s.month).sort((a,b)=>a[1]-b[1]);
 for(const [kind,due] of elections){const remaining=due-s.month;if(remaining>12)continue;const phase=remaining>8?0:remaining>4?1:2,id=`campaign:${kind}:${due}:${phase}`;
  if((p.campaignResponses??[]).some(x=>x.id===id))continue;
  return {id,kind,due,remaining,phase,...CAMPAIGN_SCENES[phase]};
 }
 return null;
}
export function respondToCampaign(s,command){
 const e=campaignEvent(s);if(!e||e.id!==command.eventId||![0,1].includes(command.choice))throw new Error('Предвыборное событие уже завершено или недоступно');
 const p=s.politics,own=p.parties.find(x=>x.id===p.executive.playerParty),choice=e.choices[command.choice],signal={month:s.month,type:'campaign',partyId:own.id,electionKind:e.kind,eventId:e.id,attention:0,region:null,effect:0};
 if(choice.kind==='results')signal.effect=Math.max(-.08,Math.min(.08,.04+(s.metrics.realIncomeIndex-100)*.002-Math.max(0,s.metrics.inflationYoY-10)*.002-Math.max(0,s.metrics.unemployment-9)*.004));
 if(['principles','market','social'].includes(choice.kind)){signal.axis='economy';signal.position=choice.kind==='principles'?own.platform.economy:choice.kind==='market'?1:-1;signal.effect=.12;}
 if(['capital','rural'].includes(choice.kind)){signal.region=choice.kind==='capital'?0:2;signal.effect=.12;signal.otherRegionEffect=-.025;}
 p.publicEvents.push(signal);p.campaignResponses??=[];p.campaignResponses.push({id:e.id,month:s.month,kind:e.kind,due:e.due,title:e.title,choice:command.choice,label:choice.label});
 p.lastActions.push({kind:'campaignResponse',eventId:e.id,choice:command.choice,label:choice.label});
 return choice.hint;
}
export function campaignUtility(s,g,party,kind){
 return s.politics.publicEvents.filter(e=>e.type==='campaign'&&e.partyId===party.id&&(e.electionKind==='president'?(kind==='president'):(kind!=='president'))).reduce((v,e)=>v+(e.axis?e.effect*e.position*g.ideal[e.axis]:e.region===null||e.region===g.region?e.effect:e.otherRegionEffect??0)*Math.exp(-(s.month-e.month)/6),0);
}

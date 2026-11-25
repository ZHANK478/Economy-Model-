import {playerExecutive} from './parliamentary-state.js';
import {dollarsPerEuro,ecbRate} from './euro-observations.js';

export const FOREIGN_PROGRAMMES={
 integration:{title:'Полная интеграция с ЕС',label:'Ввести евро и присоединиться к Шенгену'},
 globalBritain:{title:'Глобальная Британия',label:'Ввести в силу соглашения с Японией, Канадой и Австралией'},
};

export const FOREIGN_STEPS={
 erm:{goal:'integration',title:'Вступление в ERM II',months:3,brief:'Согласуем центральный курс с ЕЦБ. Для перехода на евро понадобятся два года устойчивого курса.'},
 schengen:{goal:'integration',title:'Вступление в Шенген',months:12,brief:'Согласуем с Дублином общий порядок поездок, затем представим проект странам Шенгена.'},
 euro:{goal:'integration',title:'Переход на евро',months:3,brief:'Передадим оценку готовности Британии Совету ЕС. После перехода денежную ставку будет устанавливать ЕЦБ.'},
 japan:{goal:'globalBritain',title:'Соглашение с Японией',months:9,cost:.025,brief:'Обсудим признание стандартов и условия доступа для британских и японских поставщиков.'},
 canada:{goal:'globalBritain',title:'Соглашение с Канадой',months:6,cost:.02,brief:'Закрепим самостоятельные условия торговли с Канадой после выхода из ЕС.'},
 australia:{goal:'globalBritain',title:'Соглашение с Австралией',months:18,cost:.04,brief:'Готовим взаимное снижение барьеров. Австралийским поставщикам станет проще конкурировать на британском рынке.'},
};

const has=(object,key)=>Object.hasOwn(object,key);
const pact=(s,id)=>s.politics?.foreignProgramme?.steps?.[id];
export const foreignStepDone=(s,id)=>pact(s,id)?.signed!=null;
export const euroAdopted=s=>foreignStepDone(s,'euro');
const euroParity=s=>s.exchangeRate*dollarsPerEuro(s);
const stable=(s,erm)=>Math.abs(euroParity(s)/erm.parity-1)<=.15;
export const ermMonths=s=>pact(s,'erm')?.stableMonths??0;
export const euroExchangeRate=s=>pact(s,'euro').parity/dollarsPerEuro(s);
export const foreignProgrammeId=s=>s.politics?.governmentGoals?.id;
const euTrade=s=>s.politics?.scenarioDiplomacy?.euTrade;
const tradeSteps={jp:'japan',ca:'canada',au:'australia'};

export function foreignStepBlock(s,id){
 const step=FOREIGN_STEPS[id];
 if(!step||step.goal!==foreignProgrammeId(s)||!s.politics.executive.inOffice||!playerExecutive(s))
  return 'Переговоры ведёт действующий кабинет.';
 if(!euTrade(s)||!s.economy)return 'Дальнейшие договоры требуют международного торгового режима.';
 if(step.goal==='globalBritain'&&euTrade(s)?.exitMonth==null)return 'Сначала завершите выход из ЕС для самостоятельных торговых переговоров.';
 if(step.goal==='integration'&&euTrade(s)?.exitDue!=null)return 'На время выхода переговоры об интеграции закрыты.';
 if(id==='euro'){
  if(ermMonths(s)<24)return 'Сначала нужен устойчивый курс в ERM II в течение 24 месяцев.';
  const recent=[...s.history.filter(row=>!row.synthetic&&row.month<s.month).slice(-11),s.metrics];
  if(recent.reduce((sum,row)=>sum+row.inflationYoY,0)/recent.length>3.5)return 'Годовая инфляция пока слишком высока для перехода на евро.';
  const deficit=recent.reduce((sum,row)=>sum+row.deficitRatio,0)/recent.length;
  const debt=s.metrics.debtRatio,older=s.history.findLast(row=>row.month<=s.month-12);
  if(deficit>3||(debt>60&&!(older?.debtRatio>debt)))return 'Для перехода на евро нужен дефицит до 3% и долг до 60% ВВП или устойчивое снижение долга.';
  const bondYield=recent.reduce((sum,row)=>sum+row.policyRate+row.sovereignSpread,0)/recent.length;
  const euroBenchmark=recent.reduce((sum,row)=>sum+ecbRate({...s,month:row.month}),0)/recent.length;
  if(bondYield>euroBenchmark+5)return 'Стоимость заимствований пока слишком высока для перехода на евро.';
 }
 return '';
}

export function foreignStepStatus(s,id){
 const row=pact(s,id);
 if(row?.signed!=null)return 'signed';
 if(!row||row.rejected!=null)return 'available';
 return s.month<row.due?'talks':'vote';
}

export function decideForeignStep(s,command,rollCall,events){
 if(s.politics.governmentProgrammeRetired)throw new Error('Эта программа завершена.');
 const id=command.step;
 if(!has(FOREIGN_STEPS,id))throw new Error('Неизвестный этап переговоров.');
 const block=foreignStepBlock(s,id);
 if(block)throw new Error(block);
 const step=FOREIGN_STEPS[id],status=foreignStepStatus(s,id);
 const program=(s.politics.foreignProgramme??={steps:{},news:[]});
 if(command.action==='realign'&&id==='erm'&&status==='signed'&&!euroAdopted(s)&&!stable(s,program.steps.erm)){
  program.steps.erm.parity=euroParity(s);
  program.steps.erm.stableMonths=0;
  return;
 }
 if(command.action==='open'&&status==='available'&&pact(s,id)?.rejected!==s.month){
  program.steps[id]={opened:s.month,due:s.month+step.months};
  return;
 }
 if(command.action!=='ratify'||status!=='vote')throw new Error('Проект соглашения пока не готов к голосованию.');
 const p=s.politics;
 const vote=rollCall(s,{id:-22000-Object.keys(FOREIGN_STEPS).indexOf(id),revision:s.month,kind:'ordinary',patch:{},sponsor:p.executive.primeMinisterParty},
  {motion:{alignment:party=>step.goal==='integration'?.85*party.platform.openness-.4*party.platform.culture:
   .55*party.platform.openness+.35*party.platform.economy,controlled:p.coalition,instruction:'accept'}});
 const record=program.steps[id];
 if(vote.passed){
  record.signed=s.month;
  if(id==='erm'||id==='euro')record.parity=euroParity(s);
  if(id==='erm')record.stableMonths=0;
 }else record.rejected=s.month;
 const result=vote.passed?'Палата общин одобрила проект':'Палата общин отклонила проект';
 program.news.push({id,month:s.month,passed:vote.passed});
 program.news=program.news.slice(-48);
 events.push(result+' · '+step.title);
 return vote;
}

export const canRealignERM=s=>foreignStepDone(s,'erm')&&!euroAdopted(s)&&!stable(s,pact(s,'erm'));
export function recordERMMonth(s){
 const erm=pact(s,'erm');
 if(s.politics.governmentProgrammeRetired||erm?.signed==null||euroAdopted(s)||euTrade(s)?.exitDue!=null||s.month<=erm.signed)return;
 erm.stableMonths=stable(s,erm)?erm.stableMonths+1:0;
}

export function foreignTradeCost(s,market,sector){
 if(market==='eu'&&euTrade(s)?.exitMonth==null){
  const paymentCost=euroAdopted(s)?.994:1;
  return paymentCost*(sector===4&&foreignStepDone(s,'schengen')?.98:1);
 }
 const id=tradeSteps[market];
 return id&&foreignStepDone(s,id)?1-FOREIGN_STEPS[id].cost:1;
}

export function validateForeignProgramme(s){
 const program=s.politics.foreignProgramme;
 if(program===undefined)return;
 const invalid=()=>{throw new Error('Повреждены данные переговоров.');};
 if(s.scenario?.id!=='uk-2000'||!s.politics.foreignGoalsEnabled||!euTrade(s)||!has(FOREIGN_PROGRAMMES,foreignProgrammeId(s))||!program?.steps||
    Array.isArray(program.steps)||!Array.isArray(program.news)||program.news.length>48)invalid();
 const date=month=>Number.isInteger(month)&&month>=0&&month<=s.month;
 for(const [id,step] of Object.entries(program.steps)){
  if(!has(FOREIGN_STEPS,id)||FOREIGN_STEPS[id].goal!==foreignProgrammeId(s)||!date(step?.opened)||
     step.due!==step.opened+FOREIGN_STEPS[id].months)invalid();
  if(step.signed!==undefined&&(!date(step.signed)||step.signed<step.due||step.rejected!==undefined))invalid();
  if(step.rejected!==undefined&&(!date(step.rejected)||step.rejected<step.due))invalid();
  if(step.signed!=null&&['euro','erm'].includes(id)&&!(Number.isFinite(step.parity)&&step.parity>0))invalid();
  if(id==='erm'&&step.signed!=null&&(!Number.isInteger(step.stableMonths)||step.stableMonths<0||step.stableMonths>s.month-step.signed))invalid();
 }
 if(program.news.some(row=>!row||!has(program.steps,row.id)||!date(row.month)||typeof row.passed!=='boolean'))invalid();
 if(euroAdopted(s)&&(!foreignStepDone(s,'erm')||euTrade(s)?.exitDue!=null))invalid();
}

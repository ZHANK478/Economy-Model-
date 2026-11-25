import {POLICY_FIELDS} from './config.js';
import {hash} from './political-config.js';
import {territorialRequestFunding} from './territorial-requests.js';

const definitions=[
  ['jobs','labour',90,'Рабочие места исчезают','Jobs are disappearing',
    'За последние месяцы занятых стало меньше, а безработица выросла.','Employment has fallen and unemployment has risen in recent months.',
    ['retrainingBudget','unemploymentReplacement']],
  ['funding','treasury',85,'Бюджет не покрывает обязательства','The budget cannot cover its commitments',
    'Казначейство не смогло полностью профинансировать расходы.','The Treasury could not fully fund public spending.',[]],
  ['credit','uk-bank-governor',82,'Банкам не хватает ликвидности','Banks are short of liquidity',
    'У банков сократился запас ликвидности. Комитет следит за тем, как это сказывается на кредите.','Banks have lost liquidity. The committee is monitoring the effect on credit.',[]],
  ['health','health',77,'Доступ к медицине ухудшился','Access to healthcare has worsened',
    'Доступность медицины падает. Предлагаю добавить средства в действующую программу.','Access to care is falling. I propose increasing funding for the existing programme.',['healthcare']],
  ['harvest','agriculture',75,'Неблагоприятный сезон','A poor harvest',
    'Погода ударила по хозяйствам. Можем усилить действующие меры поддержки.','The weather has hurt farms. We can reinforce the existing support programme.',['agricultureProtection']],
  ['industry','industry',74,'Предприятия сокращают выпуск','Businesses are cutting production',
    'В промышленности стало меньше рабочих мест и сократился выпуск.','Industrial output and employment have both fallen.',['businessSupport','retrainingBudget']],
  ['foreign','foreign',72,'За рубежом стало меньше заказов','Foreign orders have weakened',
    'На фоне мирового спада нашим экспортёрам труднее найти покупателей. Давайте посмотрим, какие переговоры можно начать.','The world slowdown is making it harder for exporters to find buyers. Let us review which talks we can open.',[]],
  ['defence','defence',70,'Готовность войск снизилась','Military readiness has fallen',
    'Готовность заметно снизилась. Предлагаю пересмотреть действующий приоритет расходов.','Readiness has fallen noticeably. I propose reviewing the current spending priority.',['defensePriority']],
  ['schools','education',67,'Школы справляются хуже','Access to schooling has worsened',
    'Доступность образования падает. Предлагаю увеличить финансирование школ.','Access to education is falling. I propose increasing school funding.',['education']],
  ['housing','home',65,'Растёт нагрузка на местные службы','Pressure on local services is rising',
    'Жильё становится менее доступным. Давайте расширим действующую жилищную помощь.','Housing is becoming less affordable. Let us expand the existing housing allowance.',['housingAllowance']],
  ['courts','justice',64,'Суды и исполнение договоров','Courts and contract enforcement',
    'Исполнять договоры стало сложнее. Предлагаю укрепить работу судов и реестра.','Contracts have become harder to enforce. I propose strengthening courts and the property registry.',['courtBudget']],
  ['audit','uk-auditor',62,'Что нашла проверка','What the audit found',
    'Проверка вскрыла нарушения. Предлагаю рассмотреть, сколько средств выделяется на надзор.','The audit uncovered irregularities. I propose reviewing how much is allocated to oversight.',['soeAuditBudget']],
];

function detect(s){
  const m=s.metrics,h=s.history.findLast(row=>row.month<=s.month-3&&!row.synthetic),last=s.lastReport;
  if(!h||!last)return {};
  const old=s.history.at(-2);
  const drop=(key,amount,limit=Infinity)=>m[key]<limit&&h[key]-m[key]>=amount&&old?.[key]>m[key];
  return {
    jobs:m.unemployment-h.unemployment>=1&&m.employment<h.employment*.992,
    funding:last.fiscal?.financingRequests?.some(row=>row.unfunded>m.nominalGDPMonthly*.005),
    credit:drop('liquidityCoverage',12,60),
    health:drop('totalHealthAccess',2,85),
    harvest:s.agriculture?.weather<.88,
    industry:(last.market?.production?.[2]??Infinity)<s.base.output[2]*.86&&m.employment<h.employment*.99,
    foreign:(last.world?.foreignDemand??100)<97&&m.exports<h.exports*.96,
    defence:drop('militaryReadiness',5,65),
    schools:drop('totalEducationAccess',2,85),
    housing:m.housingBurden>h.housingBurden+.025&&old?.housingBurden<m.housingBurden,
    courts:drop('contractReliability',.025,.75)||drop('contractReliability',2.5,75),
    audit:s.rentSeeking?.cases?.some(row=>row.detectedMonth===s.month&&row.status!=='unobserved'),
  };
}

function measure(s,key){
  if(key==='defensePriority')return s.policy[key]==='readiness'?null:{key,value:'readiness'};
  const field=POLICY_FIELDS.find(([id])=>id===key);
  if(!field||s.policy[key]>=field[3])return null;
  const [, , ,max,step]=field;
  return {key,value:Number(Math.min(max,s.policy[key]+step).toFixed(4))};
}

function retrainingTarget(s,requests){
  const existing=requests.find(request=>request.appeal.programme==='retraining'&&territorialRequestFunding(s,request));
  if(existing)return existing;
  const history=s.regionalStatus?.history??[];
  const previous=history.find(row=>row.month===s.month-3)?.areas;
  const current=history.at(-1)?.areas;
  const affected=(s.regional?.regions??[]).map(({id})=>({
    id,lost:(previous?.[id]?.[0]??0)-(current?.[id]?.[0]??0),
  })).filter(region=>region.lost>.002).sort((a,b)=>b.lost-a.lost);
  for(const {id} of affected){
    const request={appeal:{territoryId:id,city:false,programme:'retraining'}};
    if(territorialRequestFunding(s,request))return request;
  }
  return null;
}

export function ministerialBriefings(s,press,requests=[]){
  if(!s.politics?.ministerialBriefings||!s.politics.executive.inOffice||!s.characters?.cabinet.premier)return [];
  const hits=detect(s);
  const regional=new Set(requests.map(request=>request.appeal.programme));
  const briefings=definitions.flatMap(([type,office,priority,title,en,text,enText,keys])=>{
    if(!hits[type]||s.month-(press.ministerialContact?.[type]??-12)<9||
      type==='schools'&&regional.has('education')||type==='health'&&regional.has('healthcare')||
      type==='harvest'&&regional.has('agricultureProtection'))return [];
    const holder=s.characters.cabinet[office]??office;
    const proposals=keys.map(key=>measure(s,key)).filter(Boolean);
    const proposal=proposals[Math.floor(hash(s.characters.seed,holder,type)*proposals.length)]??null;
    const from=type==='jobs'?retrainingTarget(s,requests):null;
    return [{id:type,office,priority,title,en,text,enText,proposal,request:from||null}];
  });
  const bill=s.politics.bills?.find(b=>b.monthlyInitiative&&!b.executiveResponse&&b.month===s.month&&
    Object.keys(b.patch??{}).some(key=>['unemploymentReplacement','retrainingBudget','healthcare','education','transfers','housingAllowance','businessSupport'].includes(key)));
  if(bill&&(hits.jobs||hits.health||hits.schools||hits.industry||hits.housing)&&s.month-(press.ministerialContact?.parliament??-12)>=9){
    briefings.push({id:'parliament',office:'uk-speaker',priority:83,billId:bill.id,
      title:'Палата общин ждёт ответа',en:'The Commons asks for a response',
      text:'Депутаты внесли предложение. Палата ждёт ответа на него.',
      enText:'MPs have tabled a proposal. The House is waiting for a response.'});
  }
  return briefings.sort((a,b)=>b.priority-a.priority);
}

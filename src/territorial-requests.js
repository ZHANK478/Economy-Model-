import {sectorCompanies} from './enterprise-market.js';
import {OUTLOOK_LIMITS} from './country-outlook.js';
import {territorialOffice} from './territorial-government.js';
import {nationalProgrammeGDP,territorialOfficePrograms,territorialProgrammeGDP,territorialPrograms} from './territorial-programs.js';
import {CODEX_REGIONS} from './codex-locations.js';

const sum=values=>values.reduce((total,value)=>total+value,0);
const majorJobLoss=.0005; // The model counts workers in millions.
const jobsFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
const moneyFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const percentFormat=new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:1});
const regionalNames=new Map(CODEX_REGIONS.map(region=>[region.id,region.name]));
const areaName=area=>regionalNames.get(area.id)??area.name;
const serviceAlerts=[
  ['education','education',OUTLOOK_LIMITS.education[0],'Снизилась доступность образования','Регион просит дополнительное финансирование школ.'],
  ['health','healthcare',OUTLOOK_LIMITS.health[0],'Снизилась доступность медицины','Регион просит дополнительное финансирование медицины.'],
  ['housing','socialHousing',.85,'Обострилась нехватка жилья','Местные власти просят софинансировать социальное жильё.'],
];

export function updateTerritorialEvents(state,previous){
  if(state.scenario?.id!=='uk-2000')return;
  if(state.month===previous.month)return;
  const regions=state.regional.regions;
  const history=state.regionalStatus.history;
  const old=previous.territorialEvents??{};
  const active={};
  const news=[];
  const request=(area,city,programme)=>territorialOffice(state,area.id,city)&&
    territorialPrograms(state,city).some(([key])=>key===programme)?
    {territoryId:area.id,city,programme}:null;
  const add=(key,title,detail,appeal=null,text='',isolated=false)=>{
    const prior=old.active?.[key];
    const event={id:prior?.id??'territorial:'+key+':'+state.month,month:prior?.month??state.month,
      title,detail,appeal,text,isolated};
    active[key]=event;
    if(!prior)news.push(event);
  };

  for(const [key,event] of Object.entries(old.active??{})){
    if(event.isolated&&state.month-event.month<12)active[key]=event;
  }

  for(const [sector] of state.firms.entries()){
    const oldCompanies=new Map(sectorCompanies(previous,sector).map(company=>[company.id,company]));
    for(const company of sectorCompanies(state,sector)){
      const before=oldCompanies.get(company.id);
      if(!before?.active)continue;
      const sites=company.operatingSites??before.sites??company.sites??[];
      const impacts=new Map();
      for(const site of sites){
        const region=regions.find(row=>row.id===site.regionId);
        if(!region)continue;
        const city=region.cities?.find(row=>row.id===site.cityId);
        const area=city??region;
        const key=(city?'city:':'region:')+area.id;
        const jobs=(company.last?.bankruptMonth===state.month?company.workers:before.workers)*site.share;
        const impact=impacts.get(key)??{area,region,city:Boolean(city),jobs:0};
        impact.jobs+=jobs;
        impacts.set(key,impact);
      }
      if(!company.active){
        delete active['firm-credit:'+company.id];
        const affected=[...impacts.values()].filter(row=>row.jobs>=majorJobLoss&&row.jobs>=.005*(row.area.employment+row.jobs))
          .sort((a,b)=>b.jobs-a.jobs);
        if(!affected.length)continue;
        const {area,city}=affected[0];
        const appeal=request(area,city,'retraining');
        const places=affected.map(({area,city,jobs})=>(city?area.name:areaName(area))+' ('+jobsFormat.format(jobs*1e6)+' рабочих мест)').join(', ');
        add('closure:'+company.id,'Закрылось предприятие «'+company.name+'»',
          'Закрылись производственные площадки. До закрытия на них работали: '+places+'.',
          appeal,'Местные власти просят профинансировать переобучение уволенных работников.',true);
      }else if(!old.active?.['firm-credit:'+company.id]&&company.interestDue>0&&company.unpaidInterest>=.25*company.interestDue&&
        before.interestDue>0&&before.unpaidInterest<.25*before.interestDue){
        const main=[...impacts.values()].sort((a,b)=>b.jobs-a.jobs)[0];
        if(main&&main.jobs>=majorJobLoss&&main.jobs>=.005*main.region.employment){
          add('firm-credit:'+company.id,'Предприятие «'+company.name+'» испытывает трудности с выплатами',
            'Предприятие продолжает работу, но пропустило часть процентного платежа.',
            request(main.region,false,'businessSupport'),'Регион просит профинансировать поддержку предприятий.',true);
        }
      }
    }
  }

  for(const region of regions){
    const last=history.slice(-3);
    const lastBudget=state.territorialGovernment?.last?.rows??[];
    const paid=lastBudget.filter(row=>row.regionId===region.id);
    const accounts=state.territorialGovernment?.accounts??{};
    const fundingShort=paid.length>0&&paid.some(row=>{
      const account=accounts[row.id];
      const cash=(account?.cash??0)-(account?.capitalCash??0);
      return cash<=.25*row.spending+1e-8;
    });
    for(const [indicator,programme,limit,title,ask] of serviceAlerts){
      const readings=last.map(row=>row.regions[region.id]?.[indicator]);
      if(last.length!==3||last[0].month!==state.month-2||!readings.every(value=>Number.isFinite(value)&&value<limit))continue;
      const baseline=history.find(row=>row.month===state.month-3)?.regions[region.id]?.[indicator];
      const key=region.id+':'+indicator;
      const scale=indicator==='housing'?1:100;
      if(!old.active?.[key]&&(!Number.isFinite(baseline)||baseline-readings[2]<.04*scale))continue;
      const area=region.id==='TLI'&&indicator==='housing'?region.city:region;
      add(key,title+' · '+(area===region.city?area.name:areaName(area)),
        'Показатель три месяца подряд ниже порога. Текущее значение — '+percentFormat.format(readings[2]/scale)+'.',
        fundingShort?request(area,area===region.city,programme):null,ask);
    }
    const crop=region.sectors.find(row=>row.id==='agriculture');
    const oldCrop=previous.regional?.regions.find(row=>row.id===region.id)?.sectors.find(row=>row.id==='agriculture');
    if(!old.active?.[region.id+':harvest']&&state.agriculture?.weather<=.9&&crop?.output<.8*oldCrop?.output&&
      oldCrop.workers>=.015*region.employment){
      add(region.id+':harvest','Сельскохозяйственный выпуск резко упал · '+areaName(region),
        'На фоне неблагоприятной погоды выпуск за месяц снизился на '+percentFormat.format(1-crop.output/oldCrop.output)+'.',
        request(region,false,'agricultureProtection'),'Регион просит временно поддержать хозяйства.',true);
    }
    for(const area of [region,...(region.cities??[]).filter(city=>city.id!==region.id)]){
      const bonds=(state.territorialGovernment?.bonds??[]).filter(bond=>bond.territoryId===area.id&&
        (bond.arrears>1e-8||bond.maturity<=state.month));
      if(!bonds.length)continue;
      const debt=sum(bonds.map(bond=>bond.arrears+(bond.maturity<=state.month?bond.principal:0)));
      add(area.id+':arrears','Просрочка по местному долгу · '+areaName(area),
        'Местный бюджет пропустил платежи по своим облигациям. Просрочено '+moneyFormat.format(debt)+' млн в валюте модели.',
        request(area,area!==region||area.id==='TLI','localBudget'),'Местные власти просят экстренный трансферт.');
    }
  }
  state.territorialEvents={active,news};
}

export function territorialRequests(state,press){
  const resolved=press.resolvedTerritorialRequests??[];
  return Object.values(state.territorialEvents?.active??{}).filter(event=>event.appeal&&
    !resolved.includes(event.id)&&territorialPrograms(state,event.appeal.city).some(([key])=>key===event.appeal.programme));
}

// Municipal requests are sized relative to the affected economy. Temporary
// shocks call for one grant, while service shortages require a standing line.
const monthlyRates={education:.12,healthcare:.15,socialHousing:.08};
const grantRates={retraining:.05,businessSupport:.08,agricultureProtection:.08,localBudget:.12};

export function territorialRequestFunding(state,event){
  const {territoryId,city,programme}=event.appeal;
  const contact=territorialOffice(state,territoryId,city);
  if(!contact||!territorialOfficePrograms(state,contact.office).some(([id])=>id===programme))return null;
  const local=territorialProgrammeGDP(state,territoryId,city);
  const national=nationalProgrammeGDP(state);
  if(!(local>0&&national>0))return null;
  const {id:officeId}=contact.office;
  if(Object.hasOwn(monthlyRates,programme)){
    // Match the fine slider's valid steps, so it shows the exact approved rate.
    const raw=local/national*monthlyRates[programme];
    const quantum=raw<=.01?.0001:raw<=1?.01:raw<=10?.1:1;
    const share=Math.min(100,Number((Math.max(1,Math.ceil(raw/quantum))*quantum).toFixed(4)));
    const current=state.territorialGovernment.standingPrograms?.[officeId+'|'+programme]?.share??0;
    return {...contact,officeId,programme,recurring:true,share,amount:national*share/100,alreadyFunded:current>=share};
  }
  const rate=grantRates[programme];
  if(!rate)return null;
  const amount=Math.max(1,Math.round(local*rate/100));
  return {...contact,officeId,programme,amount,recurring:false};
}

export function nextTerritorialRequest(requests,press){
  const seen=press.seenTerritorialRequests??[];
  return requests.find(event=>!seen.includes(event.id))??null;
}

export function territorialRequestQuote(event){
  switch(event.appeal.programme){
    case 'education':return 'Прошу выделить средства нашим школам.';
    case 'healthcare':return 'Прошу поддержать местные больницы и поликлиники.';
    case 'socialHousing':return 'Нам нужна помощь со строительством социального жилья.';
    case 'retraining':return 'Прошу помочь с переобучением уволенных работников.';
    case 'localBudget':return 'Нам нужен разовый трансферт, чтобы покрыть просрочку.';
    case 'businessSupport':return 'Прошу поддержать местные предприятия.';
    case 'agricultureProtection':return 'Прошу временно поддержать наши хозяйства.';
    default:return event.text||event.detail;
  }
}

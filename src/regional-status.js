import {OUTLOOK_LIMITS} from './country-outlook.js';

const badgeRules = [
  {key:'industry', sector:'industry', enter:.10, exit:.08},
  {key:'farm', sector:'agriculture', enter:.01, exit:.008},
];
const sum = values => values.reduce((total,value)=>total+value,0);
const ratio = (value,total) => total>0 ? value/total : 0;
const percent = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
const tones = ['negative','neutral','positive'];
const band = (value,[low,high]) => value<low?0:value>=high?2:1;
const formatPercent = value => percent.format(value)+'%';

function laborSnapshot(area){
  return [area.employment,...badgeRules.map(({sector})=>area.sectors.find(item=>item.id===sector)?.workers??0)];
}

function regionSnapshot(region, nationalInfrastructure){
  const {labor,publicServices,households,housing,infrastructure}=region;
  return {
    gdp:region.realGDPMonthly,
    unemployment:labor.unemploymentRate*100,
    education:publicServices.education.coverage*100,
    health:publicServices.health.coverage*100,
    poverty:100*ratio(households.relativePoverty,region.population),
    housing:housing.homesPerHousehold,
    infrastructure:nationalInfrastructure>0?100*infrastructure.capitalPerResident/nationalInfrastructure:null,
  };
}

export function updateRegionalStatus(state, previous=state.regionalStatus){
  if(state.scenario?.id!=='uk-2000')return;
  if(previous?.history?.at(-1)?.month===state.month){
    state.regionalStatus=previous;
    return;
  }
  const regions=state.regional.regions;
  const areas=Object.fromEntries(regions.flatMap(region=>
    [region,...(region.cities??[region.city]).filter(city=>city.id!==region.id)]
      .map(area=>[area.id,laborSnapshot(area)])));
  const national=laborSnapshot({employment:state.metrics.employment,sectors:state.firms.map(firm=>({
    id:firm.id,workers:firm.workers,
  }))});
  const nationalInfrastructure=ratio(sum(regions.map(region=>region.infrastructure.capitalStock)),state.population);
  const snapshot={month:state.month,national,areas,
    regions:Object.fromEntries(regions.map(region=>[region.id,regionSnapshot(region,nationalInfrastructure)]))};
  const history=[...(previous?.history??[]).filter(row=>row.month>=state.month-14&&row.month<state.month),snapshot];
  const recent=history.slice(-12);
  const nationalJobs=sum(recent.map(row=>row.national[0]));
  const badges=Object.fromEntries(Object.keys(areas).map(id=>{
    const observations=recent.filter(row=>row.areas[id]);
    const total=sum(observations.map(row=>row.areas[id][0]));
    const statuses=Object.fromEntries(badgeRules.flatMap(({key,enter,exit},index)=>{
      const column=index+1;
      const share=ratio(sum(observations.map(row=>row.areas[id][column])),total);
      const nationalShare=ratio(sum(observations.map(row=>row.national[column])),observations.length===recent.length?nationalJobs:sum(observations.map(row=>row.national[0])));
      const active=Boolean(previous?.badges?.[id]?.[key]);
      const qualifies=nationalShare>0 && share>=(active?exit:enter) && share/nationalShare>=(active?1.10:1.25);
      return qualifies?[[key,`${formatPercent(share*100)} рабочих мест в отрасли при ${formatPercent(nationalShare*100)} по стране.`]]:[];
    }));
    return [id,statuses];
  }));
  const ranks=Object.fromEntries(regions.map(region=>{
    const older=history.find(row=>row.month===state.month-12)?.regions[region.id]?.gdp;
    const current=snapshot.regions[region.id];
    current.growth=older>0?100*(current.gdp/older-1):null;
    const window=history.slice(-3);
    const prior=previous?.ranks?.[region.id];
    return [region.id,Object.fromEntries(situations.map(([key,,limits,,reverse])=>{
      const classify=value=>reverse?2-band(value,limits):band(value,limits);
      const readings=window.map(row=>row.regions[region.id]?.[key]);
      const agreed=window.length===3 && window[2].month-window[0].month===2 &&
        readings.every(Number.isFinite) && readings.every(value=>classify(value)===classify(readings[0]));
      return [key,agreed?classify(current[key]):prior?.[key]??(key==='growth'||!Number.isFinite(current[key])?1:classify(current[key]))];
    }))];
  }));
  state.regionalStatus={history,badges,ranks};
}

const situations = [
  ['growth','Экономика',[-.5,.5],['Спад производства','Стабильный выпуск','Рост производства']],
  ['unemployment','Занятость',OUTLOOK_LIMITS.unemployment,['Высокая безработица','Напряжённый рынок труда','Высокая занятость'],true],
  ['education','Образование',OUTLOOK_LIMITS.education,['Низкая доступность образования','Ограниченная доступность образования','Доступное образование']],
  ['health','Здравоохранение',OUTLOOK_LIMITS.health,['Низкая доступность медицины','Ограниченная доступность медицины','Доступная медицина']],
  ['poverty','Уровень жизни',OUTLOOK_LIMITS.poverty,['Широкая бедность','Заметная бедность','Низкая доля бедности'],true],
  ['housing','Жильё',[.85,1],['Нехватка жилья','Ограниченное предложение жилья','Жилищный фонд покрывает число домохозяйств']],
  ['infrastructure','Инфраструктура',[80,110],['Низкая обеспеченность инфраструктурой','Средняя обеспеченность инфраструктурой','Высокая обеспеченность инфраструктурой']],
];

export function regionalSituations(state,regionId){
  const history=state.regionalStatus?.history??[];
  const latest=history.at(-1)?.regions[regionId];
  const ranks=state.regionalStatus?.ranks?.[regionId];
  if(!latest)return [];
  return situations.flatMap(([key,category,,labels])=>{
    const current=latest[key];
    if(!Number.isFinite(current)){
      return key==='growth'?[{id:key,category,label:'Динамика выпуска ещё уточняется',tone:'neutral',detail:'Для годового сравнения нужны данные за 12 месяцев.'}]:[];
    }
    const rank=ranks?.[key]??1;
    return [{id:key,category,label:labels[rank],tone:tones[rank],
      detail:key==='housing'?`${formatPercent(current*100)} от числа домохозяйств`:formatPercent(current)+(key==='growth'?' за год':key==='infrastructure'?' от среднего по стране на жителя':'')}];
  }).sort((a,b)=>tones.indexOf(a.tone)-tones.indexOf(b.tone));
}

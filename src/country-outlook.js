import {scenarioDefenseReliability} from './scenario-diplomacy.js';
import {euOutside,euTradeStatus,partnerMarketsActive} from './trade-partners.js';
// Presentation thresholds are gameplay conventions. They never alter model values.
// The bands describe levels, not month-to-month changes or causal diagnoses.
export const OUTLOOK_LIMITS={
 unemployment:[5,12],poverty:[10,25],income:[90,110],
 health:[65,90],education:[65,90],readiness:[40,70],freedom:[40,65],
 contracts:[45,75],corruption:[20,45],debt:[40,90],
};
const tones=['negative','neutral','positive'];
const upward=(value,[low,high])=>value<low?0:value>=high?2:1;
const downward=(value,limits)=>2-upward(value,limits);

export function growthOutlook(state){
 const value=state.metrics.gdpGrowthYoY;
 if(!Number.isFinite(value)||state.metrics.gdpGrowthYoYDefined===0)return {label:'Нет оценки',direction:0,strength:0};
 const direction=value<-.5?-1:value>.5?1:0;
 return {label:direction<0?'Спад':direction>0?'Рост':'Стагнация',direction,strength:direction?Math.min(4,Math.max(1,Math.ceil(Math.abs(value)/2))):0};
}

export function countryOutlook(state,category){
 const m=state.metrics,d=state.defense;
 // Synthetic warm-up rows do not confirm a sustained condition.
 const rows=[...(state.history??[]).filter(row=>row.month>=0&&!row.synthetic&&row.month<state.month),{...m,month:state.month}];
 function sustained(read,band,months=3,openingKnown=true){
  if(!Number.isFinite(read(rows.at(-1))))return null;
  for(let end=rows.length-1;end>=months-1;end--){
   const window=rows.slice(end-months+1,end+1);
   if(window.some((row,i)=>!Number.isFinite(read(row))||(i&&row.month!==window[i-1].month+1)))continue;
   const ranks=window.map(row=>band(read(row)));
   if(ranks.every(rank=>rank===ranks[0]))return ranks[0];
  }
  return openingKnown&&Number.isFinite(read(rows[0]))?band(read(rows[0])):null;
 }
 const result=[];
 const add=(id,rank,labels,descriptions)=>result.push({id,label:labels[rank??1]??labels[0],description:descriptions[rank??1]??descriptions[0],tone:tones[rank??1]});
 function level(id,key,limits,labels,descriptions,{reverse=false,months=3,openingKnown=true}={}){
  if(!Number.isFinite(m[key]))return;
  const rank=sustained(row=>row[key],value=>(reverse?downward:upward)(value,limits),months,openingKnown);
  add(id,rank,labels,descriptions);
 }
 if(category==='economy'){
  if(state.government.defaultActive)add('default',0,['Государственный дефолт'],['Государство не выполнило часть долговых обязательств.']);
  const rank=sustained(row=>row.gdpGrowthYoY,value=>value<-.5?0:value>.5?2:1);
  if(Number.isFinite(m.gdpGrowthYoY)&&m.gdpGrowthYoYDefined!==0)add('growth',rank,['Экономический спад','Стагнация экономики','Экономический рост'],['Производство сокращается.','Экономическая активность меняется незначительно.','Производство расширяется.']);
  level('employment','unemployment',OUTLOOK_LIMITS.unemployment,['Массовая безработица','Напряжённый рынок труда','Высокая занятость'],['Большой части рабочей силы не удаётся найти работу.','Безработица остаётся заметной общественной проблемой.','Большинство участников рынка труда обеспечено работой.'],{reverse:true});
  if(Number.isFinite(m.inflationYoY)){
   const priceBand=value=>value<-.5||value>12?0:value>=.5&&value<=4?2:1;
   const price=sustained(row=>row.inflationYoY,priceBand);
   add('prices',price,['Нестабильный уровень цен','Неустойчивый рост цен','Стабильный уровень цен'],['Резкие изменения цен создают трудности для экономики.','Динамика цен требует внимания.','Рост цен остаётся сдержанным.']);
  }
  if(state.month>0&&Number.isFinite(state.government.lastDeficit)){
   const balance=-state.government.lastDeficit;
   add('budget',balance>0?2:balance<0?0:1,['Дефицит бюджета','Сбалансированный бюджет','Профицит бюджета'],['Текущие расходы превышают доходы бюджета.','Доходы покрывают текущие расходы бюджета.','Текущие доходы превышают расходы бюджета.']);
  }
  if(Number.isFinite(m.exchangeRate)){
   const moves=rows.slice(1).map((row,i)=>({month:row.month,move:row.month===rows[i].month+1&&rows[i].exchangeRate>0&&row.exchangeRate>0?Math.abs(Math.log(row.exchangeRate/rows[i].exchangeRate)):null}));
   const recent=moves.slice(-6),stable=recent.length===6&&recent.every(row=>row.move!==null&&row.move<.02);
   const crisis=recent.at(-1)?.move>.10;
   add('currency',crisis?0:stable?2:1,['Валютная нестабильность','Валюта стабилизируется','Стабильная валюта'],['Курс резко изменился.','Устойчивость курса ещё не подтверждена длительным наблюдением.','Курс сохраняет устойчивость в течение продолжительного времени.']);
  }
  if(Number.isFinite(m.npl)&&Number.isFinite(m.liquidityCoverage)){
   const bankBand=row=>row.npl>15||row.liquidityCoverage<70?0:row.npl<5&&row.liquidityCoverage>=100?2:1;
   const bank=sustained(row=>Number.isFinite(row.npl)&&Number.isFinite(row.liquidityCoverage)?bankBand(row):NaN,value=>value);
   const acute=m.liquidityCoverage<50;
   add('banks',acute?0:bank,['Банковская система под угрозой','Уязвимая банковская система','Устойчивая банковская система'],['Проблемы кредитов или ликвидности угрожают банковским расчётам.','Банки сохраняют заметные финансовые уязвимости.','Качество кредитов и запас ликвидности поддерживают устойчивость банков.']);
  }
  level('debt','debtRatio',OUTLOOK_LIMITS.debt,['Высокая долговая нагрузка','Заметная долговая нагрузка','Низкая долговая нагрузка'],['Государственный долг велик относительно экономики.','Обслуживание государственного долга требует внимания.','Государственный долг сравнительно невелик.'],{reverse:true});
 }
 if(category==='welfare'){
  level('income','realIncomeIndex',OUTLOOK_LIMITS.income,['Падение уровня жизни','Умеренный уровень жизни','Рост благосостояния'],['Покупательная способность доходов существенно ниже исходного уровня.','Покупательная способность доходов близка к исходному уровню.','Покупательная способность доходов существенно выше исходного уровня.']);
  level('poverty','relativePoverty',OUTLOOK_LIMITS.poverty,['Широкая бедность','Заметная бедность','Ограниченная бедность'],['Большая часть населения находится далеко ниже обычного уровня доходов.','Заметная часть населения имеет низкие доходы.','Доля населения с относительно низкими доходами невелика.'],{reverse:true});
  level('health','totalHealthAccess',OUTLOOK_LIMITS.health,['Недоступная медицина','Ограниченная доступность медицины','Доступная медицина'],['Многие жители не получают необходимые медицинские услуги.','Доступ к медицинским услугам обеспечен лишь частично.','Большинство жителей имеет доступ к медицинским услугам.']);
  level('education','totalEducationAccess',OUTLOOK_LIMITS.education,['Недоступное образование','Ограниченная доступность образования','Доступное образование'],['Образовательные услуги недоступны многим жителям.','Охват образовательными услугами остаётся неполным.','Образовательные услуги широко доступны.']);
 }
 if(category==='law'){
  level('judiciary','judicialIndependence',OUTLOOK_LIMITS.freedom,['Зависимые суды','Ограниченная независимость судов','Независимые суды'],['Судебная система испытывает сильное внешнее влияние.','Самостоятельность судебной системы ограничена.','Судебная система обладает высокой самостоятельностью.']);
  level('liberty','civilFreedom',OUTLOOK_LIMITS.freedom,['Ограниченные гражданские свободы','Средний уровень гражданских свобод','Широкие гражданские свободы'],['Гражданские права существенно ограничены.','Гражданские права защищены частично.','Гражданские права широко защищены.']);
  level('press','mediaFreedom',OUTLOOK_LIMITS.freedom,['Подконтрольная пресса','Ограниченная свобода прессы','Свободная пресса'],['Средства массовой информации находятся под сильным контролем.','Самостоятельность средств массовой информации ограничена.','Средства массовой информации обладают высокой самостоятельностью.']);
  level('contracts','contractReliability',OUTLOOK_LIMITS.contracts,['Ненадёжное исполнение договоров','Неустойчивое исполнение договоров','Надёжное исполнение договоров'],['Защита договорных обязательств работает слабо.','Исполнение обязательств обеспечивается непоследовательно.','Договорные обязательства надёжно защищены.']);
 }
 if(category==='decrees')level('corruption','corruptionRisk',OUTLOOK_LIMITS.corruption,['Высокий риск коррупции','Заметный риск коррупции','Низкий риск коррупции'],['Условия создают широкие возможности для злоупотреблений.','Сохраняются заметные возможности для злоупотреблений.','Действующие условия ограничивают возможности злоупотреблений.'],{reverse:true});
 if(category==='defense'&&d?.enabled){
  if(d.war)add('war',0,['Война'],['Страна участвует в вооружённом конфликте.']);
  if(d.sovereigntyLost)add('occupation',0,['Потеря суверенитета'],['Страна утратила самостоятельность в результате военного поражения.']);
  level('army','militaryReadiness',OUTLOOK_LIMITS.readiness,['Слабая армия','Армия ограниченной готовности','Боеспособная армия'],['Готовность вооружённых сил остаётся низкой.','Вооружённым силам требуется укрепление готовности.','Вооружённые силы устойчиво сохраняют высокую готовность.'],{months:6,openingKnown:false});
 }
 if(category==='diplomacy'){
  if(d?.enabled){
   if(d.war)add('external-war',0,['Вооружённый конфликт'],['Страна участвует в войне. Ход конфликта и возможность переговоров доступны в разделе армии.']);
   else if(d.crisis)add('crisis',0,['Международный кризис'],['Отношения с внешним противником обострились. В разделе армии доступны сведения об угрозе и действия правительства.']);
  }
  if(!d?.war&&!d?.crisis&&!d?.sovereigntyLost)
   add('peace',2,['Стабильная внешняя обстановка'],['В текущем ходе нет открытого военного кризиса или вооружённого конфликта.']);
  const treaty=scenarioDefenseReliability(state);
  const alliance=Math.max(treaty,d?.alliance?.active?d.alliance.reliability:0);
  // Match the defense model's strongest available guarantee. Display bands are qualitative.
  if(alliance>0||d?.alliance?.active)add('alliance-strength',alliance>=.65?2:alliance>=.35?1:0,
   ['Слабые союзнические гарантии','Ограниченная союзническая поддержка','Сильный оборонный союз'],
   ['На помощь союзников можно рассчитывать лишь в ограниченной мере.','Союз действует. Вклад партнёров в оборону ограничен их готовностью.','Союзники обеспечивают поддержку. Она учитывается при оценке оборонных возможностей страны.']);
  else if(!d?.alliance?.requested)add('no-alliance',1,['Самостоятельная оборона'],['У страны пока нет действующих гарантий взаимной обороны.']);
  if(d?.enabled&&d.alliance?.requested&&!d.alliance.active)add('alliance-pending',1,['Переговоры о военном союзе'],['Партнёр ещё не подтвердил союзнические обязательства.']);
  const exit=euTradeStatus(state);
  if(euOutside(state))add('eu-trade-barriers',0,['Новые барьеры в торговле с ЕС'],['Таможенные формальности повышают издержки торговли с ЕС. Часть британского импорта переключается на других поставщиков.']);
  else if(exit?.exitDue!=null)add('eu-transition',1,['Подготовка к выходу из ЕС'],['До смены торгового режима осталось '+(exit.exitDue-state.month)+' мес. До выхода продолжаются платежи по членству.']);
  const unpaid=Object.values(state.politics?.scenarioDiplomacy?.ledger??{}).some(item=>item.arrears>1e-8);
  if(unpaid)add('international-arrears',0,['Просроченные международные взносы'],['Часть обязательных взносов перенесена на следующий месяц. Добровольные программы ждут погашения задолженности.']);
  if(partnerMarketsActive(state)&&state.month>0){
   // The trade balance needs three observations in the same band, like other outlooks.
   const trade=sustained(row=>row.nominalGDPMonthly>0?row.tradeBalance/row.nominalGDPMonthly:NaN,value=>value<-.01?0:value>.01?2:1,3,false);
   if(trade!==null)add('external-trade',trade,['Устойчивый торговый дефицит','Торговля близка к равновесию','Устойчивый торговый профицит'],['Импорт устойчиво превышает экспорт. Разница увеличивает потребность экономики во внешнем финансировании при прочих равных.','Стоимость экспорта и импорта близка по итогам нескольких ходов.','Экспорт устойчиво превышает импорт и приносит стране чистую валютную выручку от торговли.']);
  }
  if(!result.length)add('external-quiet',1,['Дипломатическая обстановка без изменений'],['Новых дипломатических событий за этот ход не зафиксировано.']);
 }
 return result.sort((a,b)=>tones.indexOf(a.tone)-tones.indexOf(b.tone));
}

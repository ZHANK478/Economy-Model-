import {interfaceNumberFormatter} from './localization.js';
import {UK_BASE_YEAR_DOLLARS_PER_POUND} from './uk-observations.js';

const shortNumber=interfaceNumberFormatter({maximumSignificantDigits:3,useGrouping:false});
const chartNumber=interfaceNumberFormatter({maximumSignificantDigits:5,useGrouping:false});
const fullNumber=interfaceNumberFormatter({maximumFractionDigits:2});
const percent=interfaceNumberFormatter({maximumFractionDigits:1});

export const atlasCurrency=state=>state.scenario?.id==='uk-2000'?'£':'$';
export const atlasDomesticAmount=(state,millions)=>
  state.scenario?.id==='uk-2000'?millions/UK_BASE_YEAR_DOLLARS_PER_POUND:millions;

export function compactAtlasMoney(millions,currency,{chart=false}={}){
  if(!Number.isFinite(millions))return '—';
  if(millions===0)return '0 '+currency;
  const units=['тыс.','млн','млрд','трлн'];
  const exponent=Math.floor(Math.log10(Math.abs(millions))/3)+1;
  let index=Math.max(0,Math.min(exponent,units.length-1));
  let value=millions/1000**(index-1);
  if(Math.abs(Number(value.toPrecision(chart?5:3)))>=1000&&index<units.length-1){
    value/=1000;index++;
  }
  if(Math.abs(value)>=1e6||Math.abs(value)<.001)return millions.toExponential(2).replace('.',',')+' млн '+currency;
  return (chart?chartNumber:shortNumber).format(value)+' '+units[index]+' '+currency;
}

const fullMoney=(millions,currency)=>Number.isFinite(millions)?fullNumber.format(millions)+' млн '+currency:'—';
const percentage=value=>Number.isFinite(value)?percent.format(value)+'%':'—';

export function atlasStatistics(state,{expanded=false,decisions=0,decisionsOpen=false}={}){
  const metrics=state.metrics;
  const currency=atlasCurrency(state);
  const cash=atlasDomesticAmount(state,state.government.cash);
  const budget=state.month>0?atlasDomesticAmount(state,-state.government.lastDeficit):null;
  const signed=(value,format)=>value>0?'+'+format(value,currency):format(value,currency).replace(/^-/, '−');
  const previous=state.history?.at(-2);
  const latest=metrics.realGDPRolling;
  const hasChange=state.month>0&&previous?.month===state.month-1&&previous.realGDPRolling>0&&Number.isFinite(latest);
  const change=hasChange?latest/previous.realGDPRolling-1:0;
  const rise=Math.sign(change)*Math.min(6,Math.max(1.7,Math.abs(change)*280));
  const trend=hasChange?'ВВП за последний ход: '+(change>0?'+':'')+fullNumber.format(change*100)+'%':'График ВВП с начала кампании';
  const rows=[
    ['ВВП',compactAtlasMoney(atlasDomesticAmount(state,latest),currency),'Реальный ВВП за последние 12 месяцев'],
    ['Безработица',percentage(metrics.unemployment),''],
    ['Инфляция',percentage(metrics.inflationYoY),'Изменение цен за 12 месяцев'],
    ['Госдолг',Number.isFinite(metrics.debtRatio)?percentage(metrics.debtRatio)+' ВВП':'—','Государственный долг в процентах ВВП'],
    ['Резервы',compactAtlasMoney(state.government.reservesUSD,'$'),'Валютные резервы в долларах США'],
  ];
  return `<div class="atlas-statistics"><div class="reference-resources">
    <button type="button" class="reference-growth" data-atlas-gdp aria-label="Открыть график ВВП" title="${trend}"><small>ВВП</small><span class="atlas-gdp-strip" aria-hidden="true"><svg viewBox="0 0 76 17"><path d="M3 ${8.5+rise}L73 ${8.5-rise}"/></svg></span></button>
    <span data-monthly-budget title="Баланс бюджета за месяц · ${signed(budget,fullMoney)}. Остаток в казначействе · ${fullMoney(cash,currency)}"><small>БЮДЖЕТ</small><strong>${signed(budget,compactAtlasMoney)}</strong></span>
    <button type="button" class="atlas-decisions-toggle" data-category="decisions"
      aria-expanded="${decisionsOpen}" aria-label="Решения, использовано за месяц: ${decisions}">
      <small>РЕШЕНИЯ</small><strong>${decisions}</strong>
    </button>
    <button type="button" class="atlas-summary-toggle" data-atlas-summary aria-controls="atlas-summary" aria-expanded="${expanded}" aria-label="${expanded?'Свернуть статистику':'Развернуть статистику'}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg></button>
  </div>
  <dl id="atlas-summary" class="atlas-summary" aria-label="Статистика страны" ${expanded?'':'hidden'}>${rows.map(([name,value,title])=>`<div${title?` title="${title}"`:''}><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl></div>`;
}

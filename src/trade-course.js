import {UK_MARKETS,euTradeStatus,partnerMarketsActive} from './trade-partners.js';

const BASELINE_SHARE=UK_MARKETS.find(market=>market.id==='eu').exportShare;
export const TRADE_COURSE={
  pilotShare:.000015, standardShare:.00003, pilotMonths:3, exportMonths:6,
  growth:.05, standardMonths:6, pilotRelief:.0025, standardRelief:.005
};

export function euExportVolume(state,quantities=state.lastReport?.market?.exports){
  const eu=state.economy?.regions.findIndex(region=>region.id==='eu')??-1;
  const orders=state.economy?.last.exportDemandUSD;
  if(eu<0||!quantities?.length||!orders?.length)return state.base.exports*BASELINE_SHARE;
  return quantities.reduce((total,quantity,i)=>{
    const row=orders[i]??[],all=row.reduce((sum,value)=>sum+value,0);
    return total+(all>0?quantity*(row[eu]??0)/all:0);
  },0);
}

export function startTradeCourse(state){
  if(!partnerMarketsActive(state)||euTradeStatus(state)?.exitDue!=null)throw new Error('Курс доступен, пока Британия участвует в ЕС.');
  const diplomacy=state.politics.scenarioDiplomacy;
  if(diplomacy.tradeCourse)throw new Error('Курс уже выбран.');
  diplomacy.tradeCourse={baseline:Math.max(1e-9,euExportVolume(state)),stage:0,months:0,exports:[]};
}

export function recordTradeCourseMonth(state,configuredShare,quantities,events){
  const diplomacy=state.politics.scenarioDiplomacy,course=diplomacy?.tradeCourse;
  if(!course||course.stage===3||euTradeStatus(state)?.exitDue!=null)return;
  const {pilotShare,standardShare,pilotMonths,growth,exportMonths,standardMonths}=TRADE_COURSE;
  const fundedShare=configuredShare*(diplomacy.ledger.eu?.funded??0);
  if(course.stage===0){
    course.exports.push(euExportVolume(state,quantities));
    if(course.exports.length>exportMonths)course.exports.shift();
    const average=course.exports.reduce((sum,value)=>sum+value,0)/course.exports.length;
    if(course.exports.length<exportMonths||average<course.baseline*(1+growth))return;
  }else{
    const target=course.stage===1?pilotShare:standardShare;
    if(fundedShare+1e-12>=target)course.months++;
    if(course.months<(course.stage===1?pilotMonths:standardMonths))return;
  }
  course.stage++;
  course.months=0;
  course.exports=[];
  events.push([
    'Физический объём поставок в ЕС устойчиво вырос. Можно закрепить результат торговой программой.',
    'Электронное оформление британского экспорта испытано. У участников программы сократились административные издержки.',
    'Единое оформление британского экспорта стало постоянной процедурой. Торговые издержки участников снизились.'
  ][course.stage-1]);
}

export function tradeCourseRelief(state,configuredShare){
  const stage=state.politics.scenarioDiplomacy?.tradeCourse?.stage??0;
  const {pilotShare,pilotRelief,standardRelief}=TRADE_COURSE;
  return (stage===3?standardRelief:stage===2?pilotRelief:0)*Math.min(1,configuredShare/pilotShare);
}

export function validateTradeCourse(state){
  const course=state.politics.scenarioDiplomacy?.tradeCourse;
  if(course===undefined)return;
  if(!partnerMarketsActive(state)||!course||!Number.isFinite(course.baseline)||course.baseline<=0||
    !Number.isInteger(course.stage)||course.stage<0||course.stage>3||
    !Number.isInteger(course.months)||course.months<0||
    course.months>=(course.stage===1?TRADE_COURSE.pilotMonths:course.stage===2?TRADE_COURSE.standardMonths:1)||
    !Array.isArray(course.exports)||course.exports.length>(course.stage===0?TRADE_COURSE.exportMonths:0)||
    course.exports.some(value=>!Number.isFinite(value)||value<0))
    throw new Error('Повреждены данные торгового курса.');
}

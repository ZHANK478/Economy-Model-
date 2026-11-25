import {pilotRecord,settleScenarioPilots,validateScenarioPilots} from './scenario-pilots.js';
import {euroAdopted,validateForeignProgramme} from './foreign-programme.js';
import {tradeCourseRelief,validateTradeCourse} from './trade-course.js';
import {euOutside,euTradeStatus,partnerMarketsActive} from './trade-partners.js';
import {UK_BASE_YEAR_DOLLARS_PER_POUND} from './uk-observations.js';

const uk2000 = [
  {
    id:'eu', name:'Европейский союз', status:'Государство-член',
    description:'В 2000 году Великобритания участвует в едином рынке и в согласовании общих правил ЕС. Общая торговая политика и внешний тариф определяются на уровне ЕС. В игре тариф сохраняется на уровне начала учёта членства. Она сохраняет фунт стерлингов. В бюджетном расчёте учитываются британская скидка и поступления британскому государственному сектору.',
    program:'Софинансирование упрощения торговых процедур',
    effect:'Совместная программа снижает издержки оформления британского экспорта в ЕС. В модели на ЕС приходится 54,3% британского экспорта на старте сценария. Изменение спроса проходит через обычный торговый расчёт.',
    annualGBP:{due:8433, receipts:4241}, optionalShares:[0,.000015,.000030],
    exportExposure:.543, exportCostRelief:[0,.005,.01]
  },
  {
    id:'nato', name:'НАТО', status:'Государство-член',
    description:'Североатлантический договор предусматривает коллективную оборону. Взнос в общий бюджет альянса учитывается отдельно от национальных расходов на армию.',
    program:'Дополнительное финансирование совместной подготовки',
    effect:'Оплаченная программа повышает вклад союзников в оборонную готовность. Действующая военная модель учитывает наиболее сильную из доступных союзнических гарантий.',
    dueShare:.00010, optionalShares:[0,.00004,.00008], defenseReliability:.70, defenseBonus:[0,.05,.10]
  },
  {
    id:'un', name:'Организация Объединённых Наций', status:'Государство-член · постоянное место в Совете Безопасности',
    description:'ООН финансирует регулярную деятельность и миротворческие операции за счёт начисленных взносов. Великобритания имеет постоянное место в Совете Безопасности.',
    program:'Добровольное финансирование гуманитарных программ',
    effect:'Оплаченные взносы пополняют бюджет гуманитарных программ. Карточка показывает, сколько правительство перечислило с начала учёта.',
    dueShare:.00020, optionalShares:[0,.00004,.00008]
  },
  {
    id:'commonwealth', name:'Содружество наций', status:'Государство-член',
    description:'Содружество объединяет самостоятельные государства. Фонд технического сотрудничества финансируется добровольными взносами и помогает государствам-участникам развивать профессиональные навыки и государственные институты.',
    program:'Взнос в Фонд технического сотрудничества',
    effect:'Оплаченные взносы финансируют техническую помощь. Карточка показывает накопленные перечисления по этой программе.',
    optionalShares:[0,.00001,.00002]
  },
  {
    id:'wto', name:'Всемирная торговая организация', status:'Государство-член с 1995 года',
    description:'ВТО устанавливает общие правила мировой торговли и предоставляет механизм разрешения споров. В 2000 году на переговорах по общей торговой политике ЕС обычно выступает от имени своих членов.'
  }
];

const tradePromotion={id:'trade-promotion',name:'Поддержка британского экспорта',
  program:'Помощь экспортёрам на выбранном рынке',optionalShares:[0,.000015,.00003]};

const catalog = new Map([['uk-2000', uk2000]]);
export const scenarioOrganizations = s => {
  const organizations=catalog.get(s.scenario?.id)??[];
  return organizations.length&&pilotRecord(s,'global')?[...organizations,tradePromotion]:organizations;
};
export const diplomacyActive = s => s.politics?.scenarioDiplomacy?.version === 1;

export const treatyTariff = s => diplomacyActive(s) && !euOutside(s) ? s.politics.scenarioDiplomacy.externalTariff : undefined;
export const treatyTariffMessage = 'Внешний тариф устанавливается общей торговой политикой ЕС.';

export function enablePartnerTrade(s) {
  if (s.economy && s.scenario?.id==='uk-2000' && diplomacyActive(s) && !partnerMarketsActive(s))
    Object.assign(s.politics.scenarioDiplomacy,{tradeRevision:1,euTrade:{}});
}

export function notifyEUWithdrawal(s) {
  if(euroAdopted(s))throw new Error('Британия входит в еврозону. Выход требует отдельного соглашения о валюте.');
  const status=euTradeStatus(s);
  if (!partnerMarketsActive(s) || !status || status.exitDue!=null) throw new Error('Выход уже запущен или недоступен.');
  status.exitDue=s.month+24;
}

export function advanceEUMembership(s,events) {
  const status=euTradeStatus(s);
  if (status?.exitDue!==s.month || euOutside(s)) return;
  status.exitMonth=s.month;
  const diplomacy=s.politics.scenarioDiplomacy;
  diplomacy.levels.eu=0;
  delete diplomacy.shares?.eu;
  delete diplomacy.budgeted?.eu;
  events.push('Великобритания вышла из ЕС. Вступило в силу торговое соглашение с таможенными формальностями.');
}

export function repairExitedEUProgramme(s) {
  const diplomacy=s.politics?.scenarioDiplomacy;
  const budgeted=diplomacy?.budgeted;
  // Older saves cleared the contribution share at exit but retained its budget flag.
  if(s.scenario?.id==='uk-2000'&&partnerMarketsActive(s)&&euOutside(s)&&
    budgeted&&typeof budgeted==='object'&&!Array.isArray(budgeted)&&
    budgeted.eu===true&&diplomacy.shares?.eu===undefined&&diplomacy.levels?.eu===0)
    delete budgeted.eu;
}

export function validateScenarioDiplomacy(s) {
  validateForeignProgramme(s);
  const state = s.politics.scenarioDiplomacy;
  if (state === undefined) return;
  validateTradeCourse(s);
  validateScenarioPilots(s);
  if (state?.tradeRevision!==undefined){
    const eu=state.euTrade;
    if (state.tradeRevision!==1 || !s.economy || s.scenario?.id!=='uk-2000' || !eu || typeof eu!=='object' || Array.isArray(eu)
        || (eu.exitDue!==undefined&&(!Number.isInteger(eu.exitDue)||eu.exitDue<1||eu.exitDue>s.month+24))
        || (eu.exitMonth!==undefined&&(eu.exitMonth!==eu.exitDue||eu.exitMonth>s.month))
        || (eu.exitDue<=s.month&&eu.exitMonth===undefined)) throw new Error('Повреждены данные о торговых соглашениях.');
  }
  const programs = scenarioOrganizations(s).filter(org=>org.optionalShares);
  const levelValid = (id,level) => programs.some(org=>org.id===id && Number.isInteger(level) && level>=0 && level<org.optionalShares.length);
  const shareValid=(id,share)=>programs.some(org=>org.id===id&&Number.isFinite(share)&&share>=0&&share<=1);
  const record = value => value && typeof value==='object' && !Array.isArray(value);
  if (!diplomacyActive(s) || !programs.length || !Number.isFinite(state.externalTariff) || state.externalTariff<0 || state.externalTariff>30
      || !record(state.levels) || Object.entries(state.levels).some(([id,level])=>!levelValid(id,level))
      || (state.shares!==undefined&&(!record(state.shares)||Object.entries(state.shares).some(([id,share])=>!shareValid(id,share))))
      || (state.budgeted!==undefined&&(!record(state.budgeted)||Object.entries(state.budgeted).some(([id,value])=>value!==true||!shareValid(id,state.shares?.[id]))))
      || !record(state.ledger) || Object.entries(state.ledger).some(([id,entry])=>!entry || entry.id!==id || !levelValid(id,entry.level)
        || ['due','receipts','paid','arrears','program','programPaid','programTotal','funded'].some(key=>!Number.isFinite(entry[key]) || entry[key]<0)
        || entry.funded>1+1e-8||(entry.share!==undefined&&!shareValid(id,entry.share))))
    throw new Error('Повреждены данные международных обязательств.');
}

export function activateScenarioDiplomacy(s) {
  if (scenarioOrganizations(s).length && !diplomacyActive(s))
    s.politics.scenarioDiplomacy = {version:1, externalTariff:s.policy.tariff, levels:{}, ledger:{}};
}

export function setDiplomacyLevel(s, id, level) {
  const state = s.politics.scenarioDiplomacy;
  const organization = scenarioOrganizations(s).find(item => item.id === id);
  if (!diplomacyActive(s) || !organization || id==='trade-promotion'&&pilotRecord(s,'global')?.completed===false || !Number.isInteger(level) || level < 0 || level >= (organization.optionalShares?.length ?? 0))
    throw new Error('Эта программа недоступна в сценарии.');
  if(id==='eu'&&euTradeStatus(s)?.exitDue!=null)throw new Error('Программа ЕС недоступна после начала выхода.');
  if ((state.levels[id] ?? 0) === level) throw new Error('Этот уровень уже выбран.');
  state.levels[id] = level;
  if(state.shares)delete state.shares[id];
  if(state.budgeted)delete state.budgeted[id];
}

export function setDiplomacyShare(s,id,share,budgeted=false){
  const org=scenarioOrganizations(s).find(item=>item.id===id);
  if(!diplomacyActive(s)||!org?.optionalShares||!Number.isFinite(share)||share<0||share>1||id==='trade-promotion'&&pilotRecord(s,'global')?.completed===false||
    id==='eu'&&euTradeStatus(s)?.exitDue!=null)throw new Error('Этот взнос недоступен.');
  const state=s.politics.scenarioDiplomacy;
  if(Math.abs((state.shares?.[id]??org.optionalShares[state.levels[id]??0])-share)<1e-12)throw new Error('Такая доля уже установлена.');
  (state.shares??={})[id]=share;
  if(budgeted)(state.budgeted??={})[id]=true;
}
export const diplomacyGDPBase=s=>(s.history.at(-1)?.nominalGDPAnnual??s.metrics.nominalGDPAnnual)/12;
export function diplomacyShare(s,org){
  const state=s.politics.scenarioDiplomacy;
  return state?.shares?.[org.id]??org.optionalShares?.[state?.levels[org.id]??0]??0;
}
function programmeEffect(org,effect,entry){
  if(entry.share===undefined)return effect[entry.level];
  const values=org.optionalShares;
  const upper=values.findIndex(value=>value>=entry.share);
  if(upper<=0)return effect[upper===0?0:effect.length-1];
  const fraction=(entry.share-values[upper-1])/(values[upper]-values[upper-1]);
  return effect[upper-1]+fraction*(effect[upper]-effect[upper-1]);
}

export function diplomacyAmounts(s, org, level) {
  const priceLevel = s.consumerPriceIndex / 100;
  const share=s.politics.scenarioDiplomacy?.shares?.[org.id];
  const gdpBase=diplomacyGDPBase(s);
  const monthlyBase=s.territorialGovernment?.fiscalRevision===2?gdpBase:s.base.monthlyGDP*priceLevel;
  const annualBase=s.base.monthlyGDP*12;
  const gbpShare=amount=>amount*UK_BASE_YEAR_DOLLARS_PER_POUND/annualBase;
  if(org.id==='eu'&&euOutside(s)) return {due:0,receipts:0,program:0};
  if(s.territorialGovernment?.fiscalRevision!==2){
    const conversion=UK_BASE_YEAR_DOLLARS_PER_POUND*priceLevel/12;
    return {due:org.annualGBP?org.annualGBP.due*conversion:(org.dueShare??0)*monthlyBase,
      receipts:(org.annualGBP?.receipts??0)*conversion,
      program:share===undefined?org.optionalShares[level]*monthlyBase:share*gdpBase};
  }
  return {
    due:(org.annualGBP?gbpShare(org.annualGBP.due):org.dueShare??0)*monthlyBase,
    receipts:gbpShare(org.annualGBP?.receipts??0)*monthlyBase,
    program:share===undefined?org.optionalShares[level]*monthlyBase:share*gdpBase
  };
}

export function plannedDiplomacyContributions(s){
  const state=s.politics.scenarioDiplomacy;
  return scenarioOrganizations(s).reduce((total,org)=>state?.budgeted?.[org.id]?
    total+diplomacyAmounts(s,org,state.levels[org.id]??0).program:total,0);
}

export function settleScenarioDiplomacy(s, receive, pay, events=[]) {
  const state = s.politics.scenarioDiplomacy;
  const entries = scenarioOrganizations(s).filter(org=>org.optionalShares).map(org => {
    const level = state.levels[org.id] ?? 0;
    const previous = state.ledger[org.id];
    const amounts = diplomacyAmounts(s,org,level);
    const due = amounts.due + (previous?.arrears ?? 0);
    receive(amounts.receipts);
    return {id:org.id, level, ...(state.shares?.[org.id]!==undefined?{share:state.shares[org.id]}:{}), ...amounts, due, programTotal:previous?.programTotal ?? 0};
  });
  for (const entry of entries) {
    entry.paid = pay(entry.due);
    entry.arrears = Math.max(0, entry.due - entry.paid);
  }
  const obligationsMet = entries.every(entry => entry.arrears < 1e-8);
  for (const entry of entries) {
    entry.programPaid = obligationsMet ? pay(entry.program) : 0;
    entry.funded = entry.program > 0 ? Math.min(1,entry.programPaid / entry.program) : 0;
    entry.programTotal += entry.programPaid;
    state.ledger[entry.id] = entry;
  }
  const ledger=Object.fromEntries(entries.map(entry => [entry.id, entry]));
  settleScenarioPilots(s,ledger,events);
  return ledger;
}

export function exportCostProgram(s) {
  if (!diplomacyActive(s) || euOutside(s)) return null;
  const org = scenarioOrganizations(s).find(item => item.exportCostRelief);
  const last = org && s.politics.scenarioDiplomacy.ledger[org.id];
  return last?.funded ? {exposure:org.exportExposure, relief:(programmeEffect(org,org.exportCostRelief,last)+tradeCourseRelief(s,last.share??org.optionalShares[last.level])) * last.funded} : null;
}

export function scenarioDefenseReliability(s) {
  if (!diplomacyActive(s)) return 0;
  const org = scenarioOrganizations(s).find(item => item.defenseReliability);
  if (!org) return 0;
  const last = s.politics.scenarioDiplomacy.ledger[org.id];
  return org.defenseReliability + (last?.funded ? programmeEffect(org,org.defenseBonus,last) * last.funded : 0);
}

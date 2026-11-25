import {euroAdopted} from './foreign-programme.js';
import {europeanInstitutions} from './eu-institutions.js';
import {commissionPresident} from './european-commission.js';
import {PILOTS,pilotHeadline,pilotOption,pilotRecord} from './scenario-pilots.js';
import {esc} from './atlas-interface.js';
import {UK_BASE_YEAR_DOLLARS_PER_POUND} from './uk-observations.js';
import {interfaceNumberFormatter} from './localization.js';
import {diplomacyActive,diplomacyAmounts,diplomacyGDPBase,diplomacyShare,scenarioOrganizations} from './scenario-diplomacy.js';
import {formatGDPPercent,gdpSlider} from './gdp-slider.js';
import {UK_MARKETS,euTradeStatus,partnerMarketsActive} from './trade-partners.js';

const number = interfaceNumberFormatter({maximumFractionDigits:2});
const percent = share => number.format(share*100) + '%';
const names = {eu:'ЕС',un:'ООН'};
const exportShareLabel='<b class="scenario-market-share">британского экспорта</b>';
export function tradeOverview(s) {
  if(!partnerMarketsActive(s))return [];
  const report=s.lastReport.external?.partners;
  const total=s.lastReport.external;
  return UK_MARKETS.map(market=>{
    const current=report?.find(item=>item.id===market.id);
    const exports=total?.exportsUSD&&current?current.exportsUSD/total.exportsUSD:market.exportShare;
    const imports=total?.importsUSD&&current?current.importsUSD/total.importsUSD:market.importShare;
    const growth=current?.growth==null?'':' Рост рынка за месяц '+number.format(current.growth)+'%.';
    return {name:market.name,
      description:(current?'За последний месяц':'Стартовая оценка')+' — '+percent(exports)+' британского экспорта и '+percent(imports)+' импорта.'+growth};
  });
}

export function scenarioDiplomacyPanel(s,selected,blocked,confirmExit=false) {
  const organizations=scenarioOrganizations(s);
  const org=organizations.find(item=>item.id===selected&&item.optionalShares);
  const pilotId=selected==='pilot-eu'?'eu':selected==='pilot-global'?'global':null;
  const list=`<div class="scenario-options" aria-label="Международные организации">
    ${organizations.filter(item=>item.optionalShares&&item.id!=='trade-promotion').map(item=>`<button data-scenario-organization="${item.id}">${names[item.id]??item.name} <span aria-hidden="true">›</span></button>`).join('')}
    ${organizations.length?'<button data-scenario-organization="pilot-global">Глобальная Британия <span aria-hidden="true">›</span></button>':''}
  </div>`;
  const detail=pilotId?pilotDetail(s,pilotId,blocked):org?organizationDetail(s,org,blocked,confirmExit):list;
  return `<section class="connections-panel scenario-diplomacy" aria-labelledby="scenario-title">
    <header><h2 id="scenario-title">Решения сценария</h2><button data-close-button data-strategy-close="true" aria-label="Закрыть решения сценария">×</button></header>
    <div class="scenario-content">${detail}</div></section>`;
}

function withdrawal(s,blocked,confirmExit){
  const exit=euTradeStatus(s);
  if(!exit||exit.exitDue||euroAdopted(s))return '';
  return `<div class="scenario-withdraw">${confirmExit?
    `<p>Переходный период — 24 месяца.</p><button data-scenario-exit="" ${blocked||s.politics.parliamentSupport<=.5?'disabled':''}>Подтвердить выход из ЕС</button>
      <button data-scenario-exit-preview="close">Отмена</button>`:
    `<button data-scenario-exit-preview="open" ${blocked?'disabled':''}>Начать выход из ЕС</button>`}</div>`;
}

function programmeSlider(s,org,blocked){
  const disabled=Boolean(blocked||!diplomacyActive(s)||org.id==='eu'&&euTradeStatus(s)?.exitDue);
  return `<div class="territorial-programme" data-diplomacy-share="${org.id}"${blocked?` title="${esc(blocked)}"`:''}>
    ${gdpSlider({value:diplomacyShare(s,org)*100,maximum:org.optionalShares.at(-1)*100,disabled,label:'Добровольная программа',precision:'fine'})}
  </div>`;
}

function organizationDetail(s,org,blocked,confirmExit){
  const level=s.politics.scenarioDiplomacy?.levels[org.id]??0;
  const {due,receipts}=diplomacyAmounts(s,org,level);
  const base=diplomacyGDPBase(s);
  const asShare=amount=>number.format(100*amount/base)+'% ВВП';
  const money=amount=>number.format(amount/UK_BASE_YEAR_DOLLARS_PER_POUND);
  return `<button class="scenario-back" data-scenario-organization="" aria-label="Вернуться к списку организаций">← Организации</button>
    <h3>${org.name}</h3>
    ${due||receipts?`<dl class="scenario-funding">
      ${due?`<div><dt>Обязательный взнос</dt><dd>${asShare(due)} · ${money(due)} <span>млн £ в месяц</span></dd></div>`:''}
      ${receipts?`<div><dt>Поступления в бюджет</dt><dd>${asShare(receipts)} · ${money(receipts)} <span>млн £ в месяц</span></dd></div>`:''}
    </dl>`:''}
    <p>${org.program}</p>${programmeSlider(s,org,blocked)}
    ${org.id==='eu'?`<h4>Акты и программы</h4>
      <div class="scenario-options"><button data-scenario-organization="pilot-eu">Европейская интеграция · Intrastat <span aria-hidden="true">›</span></button></div>
      <details class="eu-institutions"><summary>Органы и организации ЕС</summary>
        ${europeanInstitutions.map(([name,description])=>`<p><b>${name}</b> <span>${description}</span></p>`).join('')}
      </details>${withdrawal(s,blocked,confirmExit)}`:''}`;
}

function pilotDetail(s,id,blocked){
  const eu=id==='eu',record=pilotRecord(s,id),pilot=PILOTS[id];
  const minister=s.characters?.people[s.characters.cabinet.industry??s.characters.cabinet.foreign];
  const speaker=eu?commissionPresident(s)?.name:minister?.name;
  const title=eu?'Европейская интеграция':'Глобальная Британия';
  const restriction=blocked||!diplomacyActive(s)||eu&&euTradeStatus(s)?.exitDue;
  const back=`<button class="scenario-back" data-scenario-organization="${eu?'eu':''}">← ${eu?'ЕС':'Организации'}</button>`;
  const brief=eu?'В ЕС обсуждают упрощение Intrastat, отчётности о торговле товарами. Можно внедрить упрощённую форму или заодно помочь малым фирмам перейти на неё.':
    'Небольшим экспортёрам дорого искать покупателей за рубежом. Выделим деньги на помощь с первыми контрактами. Бюджета хватит на одну площадку.';
  const intro=`<h3>${title}</h3>${speaker?`<p><b>${esc(speaker)}</b></p>`:''}`;
  const reason=blocked?`<p>${esc(blocked)}</p>`:'';
  if(!record)return back+intro+`<p>${brief}</p>${reason}
    <div class="scenario-options">${Object.entries(pilot.options).map(([choice,option])=>{
      const share=s.economy?.regions.find(market=>market.id===option.market)?.exportShare;
      return `<button data-scenario-pilot="${id}" data-pilot-choice="${choice}" ${restriction?'disabled':''}>
        ${option.name} <span>${eu?formatGDPPercent(option.minimum*100):share==null?'':percent(share)+' '+exportShareLabel}</span></button>`;
    }).join('')}</div>`;
  const org=scenarioOrganizations(s).find(item=>item.id===pilot.organization);
  const option=pilotOption(id,record.choice);
  const funding=org&&(eu||record.completed!==false)?programmeSlider(s,org,blocked):'';
  return back+intro+`<p><b>${option.name}</b></p>
    ${record.finished!==undefined?`<p>${pilotHeadline(id,record.completed)}</p>`:
      `<p>${eu?'Оплатить внедрение экспортных форм':'Профинансировать работу экспортного бюро'}</p><p>${formatGDPPercent(option.minimum*100)} <span>ежемесячно</span></p>
        <p><span>Оплачено месяцев</span> · ${record.paidMonths} / ${pilot.months}</p><p>На запуск отведено шесть месяцев.</p>`}
    ${funding?`${funding}${reason}<p>Бюджет действует каждый месяц, пока не уменьшишь взнос.</p>`:''}`;
}

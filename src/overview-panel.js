import {esc} from './atlas-interface.js';
import {treatyTariff,diplomacyActive} from './scenario-diplomacy.js';
import {euOutside} from './trade-partners.js';
import {tradeOverview} from './scenario-diplomacy-ui.js';
import {countryOutlook} from './country-outlook.js';
const categories=[
  {id:'defense',label:'Оборона',color:'#595139',shape:'<path d="M3 2h18v6l-9 5-9-5zm0 9 9 5 9-5v4l-9 5-9-5zm0 7 9 5 9-5v3l-9 5-9-5z"/><path fill="var(--icon-ground)" d="m12 3 1 2 2 .3-1.5 1.5.4 2L12 8l-1.9.8.4-2L9 5.3l2-.3z"/>'},
  {id:'law',label:'Закон',color:'#632f36',shape:'<path d="m9 2 3-2 8 8-3 3-1-1-2 2 9 9-2 2-9-9-2 2 1 1-3 3-8-8 3-3 1 1 6-6zm-8 20h12v2H1z"/>'},
  {id:'economy',label:'Экономика',color:'#62502e',shape:'<g transform="rotate(35 12 12)"><path d="M2 5h20v14H2zm2 2v10h16V7z" fill-rule="evenodd"/><ellipse cx="12" cy="12" rx="4" ry="4"/><path d="M5 10h2v4H5zm12 0h2v4h-2z"/></g>'},
  {id:'welfare',label:'Благосостояние',color:'#286052',shape:'<path d="M2 10 0 12l3 8 5 4h3v-7l-5-5-2 1 3 4-2-1zm20 0 2 2-3 8-5 4h-3v-7l5-5 2 1-3 4 2-1zM8 3h2v7H8zm3-2h2v9h-2zm3 2h2v7h-2zM8 11h8l-2 4h-4z"/>'},
  {id:'decrees',label:'Указы',color:'#344667',shape:'<path d="M4 2h16l-1 3 2 5v4c0 5-5 8-9 10-4-2-9-5-9-10v-4l2-5z"/><circle cx="12" cy="12" r="6" fill="var(--icon-ground)"/><path d="m12 7 1.4 3.3 3.6.3-2.7 2.3.8 3.5-3.1-1.9-3.1 1.9.8-3.5L7 10.6l3.6-.3z"/>'},
  {id:'diplomacy',label:'Дипломатия',color:'#285750',shape:'<path d="M3 4l18 17-1 2L2 6zm18 0 1 2L4 23l-1-2zM4 5l7 6-6 5-5-6zm16 0-7 6 6 5 5-6z"/>'}
];

export function overviewEntries(state,category,mode){
  if(mode==='situations')return countryOutlook(state,category);
  const p=state.policy,d=state.defense;
  const rule=(id,label,description)=>({id,label,description,tone:'neutral'});
  const flag=(id,key,on,off)=>rule(id,p[key]?on:off,p[key]?'Правило действует.':'Правило не действует.');
  const burden=value=>value<15?'Низкая':value<30?'Умеренная':'Высокая';
  const policies={
    defense:[
      rule('service',p.defenseService==='conscription'?'Призывная армия':'Контрактная армия','Действующий порядок комплектования вооружённых сил.'),
      rule('priority',({balanced:'Сбалансированное развитие армии',readiness:'Приоритет боевой готовности',equipment:'Приоритет перевооружения'})[p.defensePriority]??'Оборонная политика','Установленный приоритет использования оборонных ресурсов.')
    ],
    law:[
      flag('judges','protectedJudges','Защита независимости судей','Ограниченная защита судей'),
      flag('review','judicialReview','Судебный контроль законов','Отсутствие судебного контроля'),
      flag('oversight','parliamentOversight','Парламентский надзор','Ограниченный парламентский надзор'),
      flag('press','freeMedia','Свобода средств массовой информации','Государственный контроль СМИ'),
      flag('association','associationFreedom','Свобода объединений','Ограничение общественных объединений')
    ],
    economy:[
      rule('corporateTax',burden(p.corporateTax)+' налоговая нагрузка на прибыль','Действующий уровень налогообложения прибыли предприятий.'),
      rule('incomeTax',burden(p.incomeTax)+' подоходная нагрузка','Действующий уровень подоходного налогообложения.'),
      rule('vat',burden(p.vat)+' нагрузка косвенных налогов','Действующий уровень налога на добавленную стоимость.'),
      flag('entry','privateBusinessEntry','Свободный вход частного бизнеса','Ограничение входа частного бизнеса'),
      flag('foreign','foreignBusinessEntry','Допуск иностранных предприятий','Ограничение иностранных предприятий'),
      rule('trade',treatyTariff(state)!==undefined?'Общий торговый режим ЕС':p.tariff<1?'Беспошлинный импорт':p.tariff<15?'Умеренная защита внутреннего рынка':'Высокие импортные барьеры','Действующий таможенный режим.'),
      rule('capital',p.capitalControls<10?'Свободное движение капитала':p.capitalControls<60?'Частичные ограничения капитала':'Жёсткие ограничения капитала','Правила зарубежных финансовых вложений резидентов.'),
      rule('monetary',p.monetaryRegime==='rule'?'Денежная политика по правилу':'Особый денежный режим','Действующий способ проведения денежной политики.')
    ],
    welfare:[
      rule('health',p.healthcare<2?'Ограниченное финансирование здравоохранения':p.healthcare<5?'Умеренное финансирование здравоохранения':'Расширенное финансирование здравоохранения','Установленный уровень государственных расходов на медицинские услуги.'),
      rule('education',p.education<2?'Ограниченное финансирование образования':p.education<5?'Умеренное финансирование образования':'Расширенное финансирование образования','Установленный уровень государственных расходов на образование.'),
      rule('unemployment',p.unemploymentReplacement<25?'Ограниченная поддержка безработных':p.unemploymentReplacement<60?'Умеренная поддержка безработных':'Расширенная поддержка безработных','Действующий уровень замещения заработка пособием по безработице.'),
      flag('bargaining','collectiveBargaining','Коллективные трудовые переговоры','Ограничение коллективных переговоров')
    ],
    decrees:[
      flag('procurement','openProcurement','Открытые государственные закупки','Закрытые государственные закупки'),
      flag('disclosure','publicDisclosure','Публичное раскрытие сведений','Ограниченное раскрытие сведений'),
      flag('service','meritCivilService','Профессиональная государственная служба','Непрофессиональный порядок госслужбы')
    ],
    diplomacy:[
      rule('trade-regime',euOutside(state)?'Торговое соглашение с ЕС':treatyTariff(state)!==undefined?'Участие в едином рынке ЕС':'Национальная торговая политика',
        euOutside(state)?'Британия устанавливает внешний тариф. В торговле с ЕС действуют таможенные формальности.':
        treatyTariff(state)!==undefined?'Британия участвует в едином рынке и платит взносы. Внешний тариф определяется на уровне ЕС.':
        p.tariff>0?'Правительство применяет национальную импортную пошлину.':'В модели действует нулевая импортная пошлина.'),
      ...(d?.enabled||diplomacyActive(state)?[rule('alliance',diplomacyActive(state)?'Коллективная оборона в НАТО':d.alliance?.active?'Участие в оборонном союзе':'Самостоятельная оборона',
        diplomacyActive(state)?'Британия участвует в коллективной обороне. Кабинет может финансировать совместную подготовку.':
        d.alliance?.active?'Действуют союзнические обязательства взаимной помощи.':'В модели нет действующих союзнических гарантий.')]:[]),
      ...(diplomacyActive(state)?[
        rule('multilateral-aid','Международная помощь и сотрудничество','Британия вносит обязательные платежи в ООН. Кабинет определяет добровольные взносы на гуманитарную помощь и программы Содружества.'),
        rule('world-trade-rules','Торговля по правилам ВТО','Британия участвует в системе общих правил международной торговли.')
      ]:[]),
      rule('foreign-investment',p.foreignBusinessEntry?'Допуск иностранных предприятий':'Ограничение иностранных предприятий',
        p.foreignBusinessEntry?'Иностранные инвесторы могут создавать предприятия в стране.':'Создание новых предприятий иностранными инвесторами ограничено.')
    ]
  };
  return policies[category]??[];
}

export const overviewIcon='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 11 6H1zm-10 8h20v2H2zm2 3h3v6H4zm6.5 0h3v6h-3zm6.5 0h3v6h-3zM2 20h20v2H2z"/></svg>';
export const overviewCategories=categories.map(({id})=>id);
export function overviewPanel(category,mode,selected,state){
  const situation=mode==='situations';
  const items=overviewEntries(state,category,mode);
  const chosen=items.find(item=>item.id===selected)??items[Math.max(0,Math.min(Number(selected)||0,items.length-1))];
  const markets=!situation&&category==='diplomacy'&&chosen?.id==='trade-regime'?tradeOverview(state):[];
  return `<section class="connections-panel overview-panel" aria-labelledby="overview-title">
    <header><h2 id="overview-title">Обзор</h2><button data-close-button data-strategy-close="true" aria-label="Закрыть обзор">×</button></header>
    <nav aria-label="Категории обзора">${categories.map(({id,label,color,shape})=>`
      <button data-overview-category="${id}" aria-label="${label}" title="${label}" aria-pressed="${category===id}" style="--icon-ground:${color}">
        <svg viewBox="0 0 24 26" fill="currentColor" aria-hidden="true">${shape}</svg><span>${label}</span>
      </button>`).join('')}</nav>
    <div class="overview-modes" aria-label="Режим обзора">
      <button data-overview-mode="policy" aria-pressed="${!situation}">Политика</button>
      <button data-overview-mode="situations" aria-pressed="${situation}">Ситуации</button>
    </div>
    <div class="overview-content">
      ${overviewCards(items,chosen,{title:situation?'Состояние страны':'Действующие правила',situation,
        extra:markets.length?`<details class="overview-trade"><summary>Торговля по рынкам</summary>${markets.map(market=>`<p><strong>${esc(market.name)}</strong> ${esc(market.description)}</p>`).join('')}</details>`:''})}
    </div>
  </section>`;
}

const severity={negative:'Неблагоприятное состояние',neutral:'Промежуточное состояние',positive:'Благоприятное состояние'};

export function overviewCards(items,chosen,{title,situation=false,itemAttribute='data-overview-item',extra=''}){
  return `${overviewList(items,chosen,{title,situation,itemAttribute})}
  <section class="overview-card"><h3>${esc(chosen?.label??'Сведения отсутствуют')}</h3><p>${esc(chosen?.description??'Для этого раздела пока нет доступной оценки.')}</p>${extra}</section>`;
}

export function overviewList(items,chosen,{title,situation=false,itemAttribute='data-overview-item'}){
  return `<section class="overview-card"><h3>${title}</h3>
    <ul>${items.map(item=>`<li><button ${itemAttribute}="${esc(item.id)}" aria-pressed="${item===chosen}" class="${situation?item.tone:''}" aria-label="${esc(item.label)}${situation?' · '+severity[item.tone]:''}">${esc(item.label)}</button></li>`).join('')}</ul>
  </section>`;
}

import {territorialRequestQuote} from './territorial-requests.js';
import {interfaceNumberFormatter} from './localization.js';
import {territorialDebt} from './territorial-assets.js';
import {sectorCompanies} from './enterprise-market.js';
import {nationalProgrammeGDP,TERRITORIAL_PROGRAMS,territorialOfficePrograms} from './territorial-programs.js';
import {territorialOffice,territorialRules,territorialTaxRates} from './territorial-government.js';
import {territorialCharacter,characterPortrait,personBriefing} from './character-roster.js';
import {formatGDPPercent,gdpSlider} from './gdp-slider.js';
import {decisionBudget} from './political-system.js';
import {parliamentary,playerExecutive} from './parliamentary-state.js';
import {partyDisplayName} from './political-config.js';
import {regionalSituations} from './regional-status.js';
import {overviewCards,overviewList} from './overview-panel.js';
import {UK_BASE_YEAR_DOLLARS_PER_POUND} from './uk-observations.js';
import {atlasIcon,esc} from './atlas-interface.js';
import {codexName,locationLink,regionMapImage} from './codex-locations.js';
import {EDINBURGH_2000,UK_REGIONS_2000} from './uk-regional-calibration.js';

const regions=['Северо-Восточная Англия','Северо-Западная Англия','Йоркшир и Хамбер','Восточный Мидленд','Западный Мидленд','Восточная Англия','Большой Лондон','Юго-Восточная Англия','Юго-Западная Англия','Уэльс','Шотландия','Северная Ирландия'];
const descriptions=[
  ['Порт и промышленность на Тайне.',['port','industry']],
  ['Город Северо-Западной Англии с промышленным наследием и университетами.',['industry','university']],
  ['Деловой и университетский центр Йоркшира.',['business','university']],
  ['Университетский город Восточного Мидленда.',['university']],
  ['Промышленный центр Западного Мидленда.',['industry']],
  ['Приморский курорт в устье Темзы.',['resort']],
  ['Столица Соединённого Королевства и финансовый центр.',['capital','finance']],
  ['Приморский курорт на южном побережье Англии.',['resort']],
  ['Портовый и университетский город на юго-западе Англии.',['port','university']],
  ['Столица Уэльса и порт на Бристольском заливе.',['regional-capital','port']],
  ['Крупный город на Клайде с промышленным наследием и университетами.',['industry','university']],
  ['Столица Северной Ирландии и порт на берегу Белфастского залива.',['regional-capital','port']],
];

const cityPhotos={
  TLC:'newcastle', TLD:'manchester', TLE:'leeds', TLF:'nottingham', TLG:'birmingham', TLH:'southend',
  TLJ:'brighton', TLK:'bristol', TLL:'cardiff', TLM:'glasgow', TLN:'belfast',
};
const photoFor=regionId=>regionId==='TLI'?'./assets/codex-reference/westminster.webp':
  cityPhotos[regionId]?`./assets/codex-cities/${cityPhotos[regionId]}.webp`:null;

export const BRITISH_CITIES=UK_REGIONS_2000.map((region,index)=>({
  id:region.city.id,name:region.city.name,regionId:region.id,region:regions[index],
  description:descriptions[index][0],statuses:descriptions[index][1],photo:photoFor(region.id),
})).concat({id:EDINBURGH_2000.id,name:EDINBURGH_2000.name,regionId:EDINBURGH_2000.regionId,region:"Шотландия",
  description:"Столица Шотландии расположена у залива Ферт-оф-Форт. Над Старым городом возвышается Эдинбургский замок. В 1999 году в городе возобновил работу парламент Шотландии.",
  statuses:["regional-capital","university"],photo:"./assets/codex-cities/edinburgh.webp"});
const statusInfo={
  capital:['Столица страны','Здесь находятся парламент и центральные органы правительства.','M3 10l9-6 9 6M4 20h16M6 11v7m6-7v7m6-7v7'],
  'regional-capital':['Столица региона','Здесь находятся основные органы управления региона.','M5 21V4m0 1h14l-4 4 4 4H5'],
  port:['Торговый порт','Город связан с морскими перевозками и портовой торговлей.','M12 8v13M8 11h8M4 15c0 4 4 6 8 6s8-2 8-6M4 15l3 1m13-1-3 1M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'],
  industry:['Промышленный центр','Промышленность заметна в экономике или историческом развитии города.','M3 20V9l6 4V9l6 4V5h4l2 15H3Zm4-4h2m3 0h2m3 0h2'],
  university:['Университетский центр','В городе работают университеты, привлекающие студентов и исследователей.','m2 9 10-5 10 5-10 5-10-5Zm5 3v5c3 3 7 3 10 0v-5m5-3v7'],
  business:['Деловой центр','В городе сосредоточены офисы и деловые услуги.','M4 8h16v12H4Zm4 0V5h8v3M4 13h16m-9-1h2v3h-2z'],
  finance:['Финансовый центр','В городе сосредоточены банки, рынки капитала и финансовые услуги.','M12 3v18m5-14H9a3 3 0 1 0 0 6h6a3 3 0 1 1 0 6H7'],
  resort:['Приморский курорт','Побережье и туристические услуги определяют роль города.','M3 18q3-3 6 0t6 0 6 0M12 3v2m6 1-2 2M6 6l2 2m-1 6a5 5 0 0 1 10 0'],
};
const regionFeatures={
  TLC:[['port','Морская торговля','Порты в устьях Тайна и Тиса связывают регион с Северным морем.'],['industry','Промышленность','Промышленные центры расположены в долинах Тайна и Тиса.']],
  TLD:[['industry','Промышленное наследие','Манчестер вырос на текстильном производстве.'],['port','Атлантическая торговля','Порт Ливерпуля связывает регион с атлантическими маршрутами.']],
  TLE:[['business','Деловой центр','Лидс — деловой центр региона.'],['industry','Металлургия','Шеффилд вырос вокруг сталелитейного производства.']],
  TLF:[['industry','Промышленный пояс','Ноттингем, Дерби и Лестер образуют промышленный пояс.'],['farm','Сельское хозяйство','К востоку от городов лежат сельскохозяйственные земли Линкольншира.']],
  TLG:[['industry','Машиностроение','Бирмингем вырос вокруг металлообработки, а Ковентри связан с автомобилестроением.'],['port','Промышленные каналы','Сеть каналов связывала промышленные города региона.']],
  TLH:[['farm','Сельское хозяйство','Сельскохозяйственные равнины тянутся до побережья Северного моря.'],['university','Университет','Кембридж известен своим университетом.']],
  TLI:[['capital','Столичный регион','В Вестминстере сосредоточены органы управления страной.'],['finance','Финансовый центр','В лондонском Сити сосредоточены банки и финансовые учреждения.']],
  TLJ:[['rail','Связи со столицей','Железные дороги связывают пригороды с Лондоном.'],['resort','Побережье Ла-Манша','Брайтон и другие прибрежные города выходят к Ла-Маншу.']],
  TLK:[['port','Морские порты','Бристоль вырос на морской торговле, а Плимут связан с флотом.'],['resort','Прибрежный туризм','Побережье и сельские районы привлекают отдыхающих.']],
  TLL:[['mountains','Горные районы','Горные районы занимают значительную часть Уэльса.'],['regional-capital','Национальная ассамблея','Национальная ассамблея Уэльса заседает в Кардиффе.']],
  TLM:[['regional-capital','Парламент Шотландии','Парламент Шотландии заседает в Эдинбурге.'],['industry','Судостроение','Глазго вырос вокруг промышленности и судостроения на Клайде.']],
  TLN:[['port','Порт и судостроение','Белфаст вырос вокруг порта и судостроения.'],['regional-capital','Разделение власти','Белфастское соглашение заложило основу для разделения власти в регионе.']],
};
const regionIconPaths={
  farm:'M2 20h20M12 20V5m0 10C6 15 4 11 4 8c5 0 8 3 8 7Zm0-4c0-4 3-7 8-7 0 4-3 7-8 7Z',
  rail:'M7 4h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 8h14M9 18l-3 4m9-4 3 4M8 15h2m4 0h2',
  mountains:'m2 20 7-13 4 7 3-5 6 11H2Zm5-9 2 2 2-2',
};
const number=interfaceNumberFormatter({maximumFractionDigits:2});
const whole=interfaceNumberFormatter({maximumFractionDigits:0});
const cityArt=city=>{
  const photo=city.photo;
  return `<img class="city-vignette${photo?'':' region-inset'}" src="${photo??regionMapImage(city.regionId)}" alt="${esc(city.name)}${photo?'':' и его регион на игровой карте'}">`;
};

function statuses(features){
  if(!features.length)return '';
  const icons=features.map(([key,label,,path])=>
    `<button type="button" data-city-status="${key}" aria-expanded="false" aria-controls="city-status-${key}" aria-label="${esc(label)}" title="${esc(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg></button>`).join('');
  const notes=features.map(([key,label,description])=>
    `<div class="city-status-note" id="city-status-${key}" hidden><strong>${esc(label)}</strong><p>${esc(description)}</p></div>`).join('');
  return `<div class="city-status"><h3>Статус</h3><div class="city-status-icons">${icons}</div>${notes}</div>`;
}

const economicLabels={industry:'Промышленное производство',farm:'Сельское хозяйство'};
const economicStatuses=(state,id)=>Object.entries(state?.regionalStatus?.badges?.[id]??{}).map(([key,detail])=>
  [key,economicLabels[key],detail,statusInfo[key]?.[2]??regionIconPaths[key]]);
const fixedStatus=key=>!(key in economicLabels);
const cityStatuses=(city,state)=>statuses([
  ...city.statuses.filter(fixedStatus).map(key=>[key,...statusInfo[key]]),
  ...economicStatuses(state,city.id),
]);

export function toggleCityStatus(button){
  const expanded=button.getAttribute('aria-expanded')==='false';
  const status=button.closest('.city-status');
  for(const icon of status.querySelectorAll('[data-city-status]')){
    const open=expanded&&icon===button;
    icon.setAttribute('aria-expanded',String(open));
    status.querySelector('#'+icon.getAttribute('aria-controls')).hidden=!open;
  }
}

export function cityArticle(city,state){
  return `<h3 tabindex="-1">${esc(codexName(city.name))}</h3><div class="city-article"><p class="atlas-dossier-date">${esc(city.region)}</p>${cityArt(city)}<p>${esc(city.description)}</p>${cityStatuses(city,state)}</div>`;
}

export function cityDossier(state,city,dispatch,requests=[]){
  const regionalAccounts=state.regional?.regions??[];
  const accounts=regionalAccounts.flatMap(region=>region.cities??[region.city]);
  const scotland=regionalAccounts.find(region=>region.id===EDINBURGH_2000.regionId);
  if(scotland&&!scotland.cities){
    const baseline=UK_REGIONS_2000.find(region=>region.id===scotland.id);
    accounts.push({
      id:EDINBURGH_2000.id,
      population:scotland.population*(EDINBURGH_2000.population/baseline.population),
      nominalGDPMonthly:scotland.nominalGDPMonthly*(EDINBURGH_2000.gvaMillionGBP/baseline.gvaMillionGBP),
    });
  }
  const account=accounts.find(item=>item.id===city.id);
  const data=dossierStats(account,accounts,account?.sameTerritory?'Большого Лондона':'города в границах учётной территории','главных городов на карте');
  const london=city.id==='TLI';
  const parliamentLink=london&&parliamentary(state)?'<button type="button" class="city-parliament-link" data-view="government" data-open-view="true">Парламент <span aria-hidden="true">→</span></button>':'';
  const notice=london&&dispatch?.kind==='proposal'?`<section class="city-notice"><h3>Требует внимания</h3><button data-action="proposal-open">${esc(dispatch.label)} →</button></section>`:'';
  return placeDossier({
    name:city.name,subtitle:locationLink('regions',city.regionId,city.region),closeLabel:'Закрыть сведения о городе',
    art:cityArt(city),codexLink:`<button class="atlas-demography-link" data-codex-city="${esc(city.id)}">Открыть запись кодекса</button>`,
    status:cityStatuses(city,state),parliamentLink,data,notice:notice+territorialOfficeBlock(state,city.id,true)+regionSections(state,city.id,true,requests),
  });
}

export function regionDossier(state,region,requests=[]){
  const accounts=state.regional?.regions??[];
  const account=accounts.find(item=>item.id===region.id);
  const features=regionFeatures[region.id].filter(([key])=>fixedStatus(key)).map(([key,label,description])=>
    [key,label,description,statusInfo[key]?.[2]??regionIconPaths[key]]);
  return placeDossier({
    name:region.name,subtitle:'Великобритания',closeLabel:'Закрыть сведения о регионе',
    art:`<img class="city-vignette region-inset" src="${regionMapImage(region.id)}" alt="${esc(region.name)} на игровой карте">`,
    codexLink:`<button type="button" class="atlas-demography-link" data-codex-location="regions" data-location-id="${esc(region.id)}">Открыть запись кодекса</button>`,
    status:statuses([...features,...economicStatuses(state,region.id)]),
    data:dossierStats(account,accounts,'всего региона','регионов Великобритании'),
    notice:territorialOfficeBlock(state,region.id,false)+regionSections(state,region.id,false,requests),
  });
}

function territorialOfficeBlock(state,id,city){
  const entry=territorialOffice(state,id,city);
  if(!entry)return '';
  const {office,person}=entry;
  const role=office.city?'Мэр':'Глава региона';
  if(!person){
    const canAppoint=!state.policy.localElections&&state.politics.executive.inOffice&&playerExecutive(state);
    return `<section class="territorial-office"><div><span>${role}</span><strong>Должность свободна</strong>
      ${canAppoint?`<button data-territorial-appointment="${esc(office.id)}">Назначить однопартийца</button>`:''}</div></section>`;
  }
  const leader=territorialCharacter(state,person);
  const year=(state.startYear??2026)+Math.floor(office.until/12),month=String(office.until%12+1).padStart(2,'0');
  const national=city?null:state.politics.elections.findLast(election=>election.kind==='parliament'&&election.territories);
  const localResult=national?.territories.find(area=>area.id===id)?.results;
  const nationalWinner=localResult?.reduce((best,result)=>result.votes>(best?.votes??0)?result:best,null);
  const winningParty=state.politics.parties.find(p=>p.id===nationalWinner?.id);
  return `<section class="territorial-office"><button class="territorial-leader" data-character-card="${esc(leader.id)}">
    ${characterPortrait(leader)}<span><small>${role}</small><strong>${esc(leader.name)}</strong>
    ${leader.affiliation?`<small>${esc(leader.affiliation)}</small>`:''}</span></button>
    <p class="territorial-term">Срок до ${month}.${year}</p>
    ${winningParty?`<p class="territorial-term">Парламентские выборы · ${esc(partyDisplayName(winningParty))}</p>`:''}
    </section>`;
}

function programmeForm(state,id,city){
  const office=territorialOffice(state,id,city)?.office;
  if(!office)return '<p>Территориальное управление недоступно.</p>';
  const world=state.territorialGovernment;
  const base=nationalProgrammeGDP(state);
  const settled=(world.lastPrograms?.orders??[]).filter(row=>row.officeId===office.id);
  const enabled=state.politics.executive.inOffice&&playerExecutive(state)&&decisionBudget(state).optionalRemaining>0;
  const items=territorialOfficePrograms(state,office).map(([id,label])=>({id,label}));
  return `${overviewList(items,null,{title:'Финансирование',itemAttribute:'data-territorial-choice'})}
    ${items.map(item=>`<section class="overview-card" data-territorial-editor="${item.id}" hidden>
      <h3>${item.label}</h3>
      ${settled.filter(row=>row.programme===item.id).map(row=>`<p>За прошлый месяц · ${formatGDPPercent(row.paid/Math.max(1e-9,row.recurring?row.base:base)*100)}</p>`).join('')}
      <form class="territorial-programme" data-territorial-programme="${esc(office.id)}" data-programme="${item.id}">
        ${gdpSlider({precision:'fine',value:world.standingPrograms?.[office.id+'|'+item.id]?.share??0,disabled:!enabled})}
        <button type="submit" ${enabled?'':'disabled'}>Установить ежемесячное финансирование</button>
      </form>
    </section>`).join('')}`;

}

function territorialFiscalPanel(state,id,city,kind){
  const world=state.territorialGovernment;
  const last=world.last?.rows.find(row=>row.id===id);
  const rates=kind==='taxes'?territorialTaxRates(state,id,city):null;
  const budgetBase=(state.history?.at(-2)?.nominalGDPAnnual??state.metrics.nominalGDPAnnual)/12;
  const rows=rates?
    [['НДС','vat'],['Налог на доходы','incomeTax'],['Налог на прибыль','corporateTax']].map(([label,key])=>
      [label,number.format(rates[key])+'%']):
    ['education','healthcare','infrastructureMaintenance','publicInvestment'].map(key=>
      [TERRITORIAL_PROGRAMS[key],formatGDPPercent(budgetBase>0?(last?.byKey[key]??0)/budgetBase*100:0)]);
  if(kind==='spending'&&budgetBase>0){
    const grants=state.lastReport?.fiscal?.territorialGrants??[];
    const received=grants.reduce((total,row)=>total+(row.territoryId===id&&row.source?row.paid:0),0);
    if(received>0)rows.unshift(['Общий трансферт за месяц',formatGDPPercent(received/budgetBase*100)]);
  }
  return `<section id="region-${kind}" class="overview-content territorial-fiscal" aria-label="${kind==='taxes'?'Местные налоги':'Местные расходы'}" hidden>
    <section class="overview-card"><dl>${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section>
  </section>`;
}

function territorialHoldings(state,id,kind){
  const assets=kind==='property'?[
    ...state.networks.map(network=>[network.name,100*network.municipal*(network.localOwners?.[id]??0)/
      Math.max(1e-9,network.public+network.municipal+network.private+network.concession)]),
    ...state.firms.flatMap((firm,sector)=>{
      const companies=sectorCompanies(state,sector);
      return (companies.length?companies:[firm]).map(company=>[company.name,100*company.ownership.municipal*(company.localOwners?.[id]??0)]);
    }),
  ].filter(([,share])=>share>1e-8):[];
  const title=kind==='property'?'Муниципальное имущество':'Местный долг';
  const debt=territorialDebt(state,id);
  const annual=nationalProgrammeGDP(state)*12;
  return `<section id="region-${kind}" class="overview-content territorial-fiscal" aria-label="${title}" hidden>
    <section class="overview-card"><dl>${kind==='property'?assets.map(([name,share])=>`<div><dt>${esc(name)}</dt><dd>${number.format(share)}%</dd></div>`).join(''):
      `<div><dt>Обязательства по облигациям</dt><dd>${formatGDPPercent(annual>0?100*debt/annual:0)}</dd></div>`}</dl>
      ${kind==='property'&&!assets.length?'<p>У территории пока нет муниципальных долей.</p>':''}</section>
  </section>`;
}

function regionSections(state,id,city=false,requests=[]){
  // London is modeled on the same territory as Greater London. Other city
  // accounts cover part of their region and must not inherit regional readings.
  const cards=(!city||id==='TLI')?regionalSituations(state,id).map(item=>({...item,description:item.detail})):[];
  const showSituation=!city||cards.length>0;
  const person=territorialOffice(state,id,city)?.person;
  const caller=person?territorialCharacter(state,person):null;
  const rules=territorialRules(state),active=Boolean(territorialOffice(state,id,city));
  const taxes=active&&rules.tax==='local',spending=active&&rules.spending==='local';
  const property=active&&rules.property==='local',borrowing=active&&rules.borrowing==='local';
  return `<div class="region-dossier-sections">
    ${requests.filter(event=>event.appeal.territoryId===id&&event.appeal.city===city).map(event=>`
      <section class="city-notice territorial-request">
        ${personBriefing(caller)}
        <h3>${esc(event.title)}</h3>
        <blockquote>${esc(territorialRequestQuote(event))}</blockquote>
        <button type="button" data-request-open="${esc(event.id)}">Открыть запрос</button>
      </section>`).join('')}
    <div class="region-dossier-tabs${showSituation?'':' city-programme-tabs'}">
      <button type="button" data-region-section="decisions" aria-expanded="false" aria-controls="region-decisions">Решения</button>
      ${showSituation?'<button type="button" data-region-section="situation" aria-expanded="false" aria-controls="region-situation">Ситуация</button>':''}
    </div>
    ${taxes||spending||property||borrowing?`<div class="region-dossier-tabs territorial-fiscal-tabs">
      ${taxes?'<button type="button" data-region-section="taxes" aria-expanded="false" aria-controls="region-taxes">Местные налоги</button>':''}
      ${spending?'<button type="button" data-region-section="spending" aria-expanded="false" aria-controls="region-spending">Местные расходы</button>':''}
      ${property?'<button type="button" data-region-section="property" aria-expanded="false" aria-controls="region-property">Имущество</button>':''}
      ${borrowing?'<button type="button" data-region-section="borrowing" aria-expanded="false" aria-controls="region-borrowing">Долг</button>':''}
    </div>`:''}
    <section id="region-decisions" aria-label="${city?'Решения города':'Решения региона'}" hidden>${programmeForm(state,id,city)}</section>
    ${showSituation?`<section id="region-situation" class="overview-content" data-situation-territory="${esc(id)}" aria-label="${city?'Ситуация в Лондоне':'Ситуация в регионе'}" hidden>
      ${overviewCards(cards,cards[0],{title:city?'Состояние Лондона':'Состояние региона',situation:true,itemAttribute:'data-region-situation-item'})}
    </section>`:''}
    ${taxes?territorialFiscalPanel(state,id,city,'taxes'):''}
    ${spending?territorialFiscalPanel(state,id,city,'spending'):''}
    ${property?territorialHoldings(state,id,'property'):''}
    ${borrowing?territorialHoldings(state,id,'borrowing'):''}
  </div>`;
}

export function selectTerritorialProgramme(button){
  const panel=button.closest('#region-decisions');
  for(const item of panel.querySelectorAll('[data-territorial-choice]'))item.setAttribute('aria-pressed',String(item===button));
  for(const section of panel.querySelectorAll('[data-territorial-editor]'))section.hidden=section.dataset.territorialEditor!==button.dataset.territorialChoice;
}

export function toggleRegionSection(button){
  const open=button.getAttribute('aria-expanded')==='false';
  const panel=button.closest('.region-dossier-sections');
  for(const tab of panel.querySelectorAll('[data-region-section]')){
    const active=open&&tab===button;
    tab.setAttribute('aria-expanded',String(active));
    panel.querySelector('#'+tab.getAttribute('aria-controls')).hidden=!active;
  }
}

export function selectRegionSituation(button,state){
  const panel=button.closest('#region-situation');
  const item=regionalSituations(state,panel.dataset.situationTerritory).find(item=>item.id===button.dataset.regionSituationItem);
  if(!item)return;
  panel.querySelector('[data-region-situation-item][aria-pressed="true"]')?.setAttribute('aria-pressed','false');
  button.setAttribute('aria-pressed','true');
  panel.querySelector('.overview-card:last-child h3').textContent=item.label;
  panel.querySelector('.overview-card:last-child p').textContent=item.detail;
}

function dossierStats(account,accounts,territory,comparison){
  if(!account)return '';
  const rank=key=>1+accounts.filter(item=>item[key]>account[key]).length;
  const row=(key,value)=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`;
  const money=value=>number.format(value/(1000*UK_BASE_YEAR_DOLLARS_PER_POUND))+' млрд £';
  return `<dl>${row('Население',whole.format(account.population*1e6))}${row('Место по населению',rank('population')+' из '+accounts.length)}${row('Номинальный ВВП за месяц',money(account.nominalGDPMonthly))}${row('Место по ВВП',rank('nominalGDPMonthly')+' из '+accounts.length)}</dl>
    <p class="atlas-fineprint">Расчётные показатели ${territory}. Места сравниваются среди ${comparison}. Суммы переведены в фунты стерлингов по среднему курсу 2000 года.</p>`;
}

function placeDossier({name,subtitle,closeLabel,art,codexLink,status,parliamentLink='',data,notice=''}){
  return `<section class="atlas-dossier city-dossier" role="dialog" aria-modal="true" aria-labelledby="atlas-dossier-title">
    <header><button data-close-button data-atlas-dismiss="true" aria-label="${closeLabel}">${atlasIcon('close')}</button></header>
    <div class="dossier-inner"><h2 id="atlas-dossier-title">${esc(codexName(name))}</h2><p class="atlas-dossier-date">${subtitle}</p>
      <div class="city-dossier-overview"><div>${art}${codexLink}</div><div>${status}${parliamentLink}</div></div>
      ${data}${notice}
    </div></section>`;
}

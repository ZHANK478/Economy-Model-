import {interfaceNumberFormatter,seatUnit} from './localization.js';
import {CODEX_REFERENCE_IMAGES} from './codex-reference-images.js';
import {codexContent} from './codex-content.js';
import {ideologyEmblem,organizationEmblem} from './codex-organizations.js';
import {CODEX_COUNTRIES,codexName,foreignLeaderId,locationLink,regionArticle} from './codex-locations.js';
import {cityArticle} from './city-dossier.js';
import {esc} from './atlas-interface.js';
import {characterLink,characterPortrait} from './character-roster.js';
export const CODEX_CATEGORIES = [
  {id:'history', label:'История', icon:'history', sections:[
    {id:'timeline', label:'Хронология'},
    {id:'events', label:'Важные события'},
    {id:'ideologies', label:'Идеологии'},
    {id:'other-history', label:'Прочие исторические сведения'},
  ]},
  {id:'locations', label:'Локации', icon:'locations', sections:[
    {id:'countries', label:'Страны'},
    {id:'regions', label:'Регионы'},
    {id:'cities', label:'Города'},
    {id:'landmarks', label:'Достопримечательности'},
  ]},
  {id:'organizations', label:'Организации', icon:'organizations', sections:[
    {id:'parties', label:'Политические партии'},
    {id:'corporations', label:'Корпорации'},
    {id:'governmental', label:'Государственные организации'},
    {id:'political', label:'Политические организации'},
    {id:'intergovernmental', label:'Межправительственные организации'},
    {id:'other', label:'Прочие организации'},
    {id:'factions', label:'Фракции'},
  ]},
  {id:'characters', label:'Персонажи', icon:'characters', sections:[
    {id:'family', label:'Семья'},
    {id:'cabinet', label:'Кабинет'},
    {id:'judiciary', label:'Судебная власть'},
    {id:'party-leaders', label:'Лидеры партий'},
    {id:'parliament', label:'Парламент'},
    {id:'state-figures', label:'Государственные деятели'},
    {id:'social-factions', label:'Представители фракций'},
    {id:'business', label:'Бизнес'},
    {id:'foreign-leaders', label:'Иностранные лидеры'},
    {id:'former-premiers', label:'Бывшие премьер-министры'},
    {id:'other-characters', label:'Прочие'},
  ]},
];
const coreSections = new Set(['ideologies', 'countries', 'regions', 'cities', 'parties',
  'intergovernmental', 'cabinet', 'party-leaders']);
const art = {
  history:'<path d="M4 17h7M4 21h14M6 17c1-6 4-13 13-14-1 8-5 12-11 13m0-1 8-8"/>',
  locations:'<path d="m2 20 6-13 5 9 3-6 6 10ZM5.5 12l2.5 2 2-1M14 14l2 1.5 2-1.5"/>',
  organizations:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4.5" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/>',
  characters:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-4c0-4 3-6 8-6s8 2 8 6v4Z"/>',
};
const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${art[id]}</svg>`;

const wealthText=person=>interfaceNumberFormatter().format(person.wealth)+' тыс. £';
const yearAt=(startYear,month)=>startYear+Math.floor(month/12);

function characterDetails(person,startYear,{popup=false}={}){
  if(person.bio)return `<div class="codex-location-text"><p>${esc(person.role)}</p>
    ${person.affiliation?`<p>${esc(person.affiliation)}</p>`:''}<p>${esc(person.bio)}</p></div>`;
  const portrait=characterPortrait(person,true);
  const yearUnit=new Intl.PluralRules('ru-RU').select(person.age);
  const age=person.age+' '+({one:'год',few:'года'}[yearUnit]??'лет');
  return `<div class="codex-person-details">${popup?portrait:`<button type="button" class="character-portrait-button codex-portrait-button" data-character-card="${esc(person.id)}" aria-label="Открыть личную карточку">${portrait}</button>`}
    ${person.roles.length?`<ul>${person.roles.map(role=>`<li>${esc(role)}</li>`).join('')}</ul>`:''}
    ${person.affiliation?`<p><i class="connections-dot" style="background:${person.color}" aria-hidden="true"></i> ${esc(person.affiliation)}</p>`:''}
    <p>${person.diedMonth===null?`Возраст · ${age}`:`Год смерти · ${yearAt(startYear,person.diedMonth)} · Возраст на момент смерти · ${age}`}</p>
    ${popup&&Number.isFinite(person.wealth)?`<dl class="character-wealth"><dt>${person.diedMonth===null?'Состояние':'Состояние на момент смерти'}</dt><dd>${wealthText(person)}</dd></dl>`:''}
  </div>`;
}

function characterArticle(person,startYear){
  const relatives=person.relatives;
  return `<h3 tabindex="-1">${esc(person.name)}</h3>
    ${characterDetails(person,startYear)}
    ${person.referenceId?'<div class="character-history"><button class="character-link" data-codex-reference="eu">Европейский союз</button></div>':''}
    ${person.countryId?`<div class="character-history">${locationLink('countries',person.countryId,'К статье о стране')}</div>`:''}
    ${person.factionId?`<div class="character-history">${organizationLink(person.factionId,'К статье о фракции')}</div>`:''}
    ${person.organizationId?`<div class="character-history">${organizationLink(person.organizationId,'К организации')}</div>`:''}
    ${person.relatedPerson?`<div class="character-history"><h4>Родство</h4>${characterLink(person.relatedPerson)}</div>`:''}
    ${relatives.length?`<div class="character-history"><h4>Семья</h4>${relatives.map(relative=>`<div>${characterLink(relative)}<small>${esc(relative.roles[0]??relative.role)}</small></div>`).join('')}</div>`:''}
    ${person.history.length?`<div class="character-history"><h4>Назначения</h4><ul>${[...person.history].reverse().map(term=>`<li>${esc(term.title)}<small>${yearAt(startYear,term.from)}${term.to===null?' — настоящее время':' — '+yearAt(startYear,term.to)}</small></li>`).join('')}</ul></div>`:''}`;
}

export function characterCard(person,startYear){
  return `<dialog id="character-card" class="character-card" aria-labelledby="character-card-name">
    <header><h2 id="character-card-name">${esc(person.name)}</h2><button data-close-button type="button" data-character-card-close="true" aria-label="Закрыть карточку">×</button></header>
    ${characterDetails(person,startYear,{popup:true})}
    ${characterLink(person,'Открыть в кодексе →')}
  </dialog>`;
}

const organizationLink=(id,name,selected=false)=>`<button type="button" class="character-link" data-codex-organization="${esc(id)}"${selected?' aria-current="true"':''}>${esc(codexName(name))}</button>`;
const mandateCount=interfaceNumberFormatter();
function partyHistory(entry,startYear){
  if(entry.parents.length>1)return 'Партия образовалась в '+yearAt(startYear,entry.foundedMonth)+' году в результате объединения партий «'+entry.parents.join('» и «')+'».';
  if(entry.parents.length)return 'Партия появилась в '+yearAt(startYear,entry.foundedMonth)+' году после раскола партии «'+entry.parents[0]+'».';
  if(entry.foundedMonth>0)return 'Партия начала политическую деятельность в '+yearAt(startYear,entry.foundedMonth)+' году.';
  return 'Партия действует с начала кампании.';
}
function partyParliament(entry,startYear,legislature){
  if(entry.archived){
    const date=Number.isFinite(entry.endedMonth)?' в '+yearAt(startYear,entry.endedMonth)+' году':'';
    return entry.merged?'Партия вошла в состав нового политического объединения.':'Партия прекратила участие в выборах'+date+'.';
  }
  if(!entry.seats)return 'Партия пока не представлена в парламенте.';
  const count=mandateCount.format(entry.seats)+' '+seatUnit(entry.seats,'ru');
  const seats='В '+(legislature??'парламенте')+' партия занимает '+count+'.';
  if(entry.status==='В правительстве')return seats+' Её представители входят в правительство.';
  if(entry.status==='Участвует в формировании правительства')return seats+' Она участвует в формировании кабинета.';
  return seats;
}
function organizationArticle(entry,seed,startYear,legislature){
  const isParty=entry.section==='parties';
  const year=entry.openingYear??(entry.foundedMonth>=0?yearAt(startYear,entry.foundedMonth):null);
  const text=isParty?partyHistory(entry,startYear)+' '+partyParliament(entry,startYear,legislature):
    year?'Компания была основана в '+year+' году. '+entry.description.replace(/^(Компания|Предприятие|Подрядчик|Фирма) /,'Она '):entry.description;
  const representative=entry.representative;
  const leaderLabel=isParty?(entry.archived?'Последний лидер партии':'Лидер партии'):
    entry.archived?'Последний руководитель':'Генеральный директор';
  return `<h3 tabindex="-1"${isParty?'':' lang="en"'}>${esc(codexName(entry.name))}</h3><div class="organization-article">
    ${organizationEmblem(entry,seed)}
    <p>${esc(text)}</p>
    ${entry.influence&&!entry.archived?`<p>${esc(entry.influence)}</p>`:''}
    ${representative?`<p>${leaderLabel} — ${characterLink(representative)}.</p>`:''}
    ${entry.publisher?`<p>Крупнейший частный совладелец — ${characterLink(entry.publisher)}.</p>`:''}
  </div>`;
}

function referenceLink(entry,selected){
  return `<button type="button" class="character-link" data-codex-reference="${esc(entry.id)}"${selected?' aria-current="true"':''}>${esc(codexName(entry.name))}</button>`;
}
function referenceArticle(entry,{representative,context,contextTitle}={}){
  const image=CODEX_REFERENCE_IMAGES[entry.id];
  return `<h3 tabindex="-1">${esc(codexName(entry.name))}</h3><div class="codex-location-text">
    ${image?`<figure class="codex-reference-figure"><img src="./assets/codex-reference/${esc(image[0])}.webp" alt="${esc(image[1])}"><figcaption>${esc(image[1])}</figcaption></figure>`:''}
    ${entry.family?`<figure class="codex-ideology">${ideologyEmblem(entry.family,esc(entry.symbol))}</figure>`:''}
    <p>${esc(entry.description??entry.summary)}</p>
    ${context?`<div class="codex-scenario-context"><h4>${esc(contextTitle)}</h4><p>${esc(context)}</p></div>`:''}
    ${entry.influence?`<p>${esc(entry.influence)}</p>`:''}
    ${representative?`<p>Представитель — ${characterLink(representative)}</p>`:''}
  </div>`;
}

function countryArticle(country,roster){
  const leader=roster?.people.get(foreignLeaderId(country));
  const capital=country.id==='south-africa'?'Правительство работает в Претории.':'Столица — '+country.capital+'.';
  return `<h3 tabindex="-1">${esc(codexName(country.name))}</h3><div class="codex-location-text">
    <img class="codex-country-flag" src="./assets/codex-flags/${esc(country.id)}.svg" alt="Флаг · ${esc(codexName(country.name))}">
    <p>${esc(capital)} ${esc(country.description)}</p>
    ${leader?`<p>Глава государства — ${characterLink(leader)}</p>`:''}
  </div>`;
}
export function codexPanel(categoryId='organizations',sectionId=null,{roster,personId,returnTab,startYear=2000,scenarioId,cityId,returnCity=false,organizationId,locationId,regionalAccounts,regionalStatus}={}) {
  const content=codexContent(scenarioId);
  const city=categoryId==='locations'&&sectionId==='cities'?content.cities.find(city=>city.id===cityId):null;
  const active=CODEX_CATEGORIES.find(item=>item.id===categoryId) ?? CODEX_CATEGORIES[0];
  const person=active.id==='characters'?roster?.people.get(personId):null;
  const organization=active.id==='organizations'?roster?.organizations?.find(entry=>entry.id===organizationId):null;
  const country=active.id==='locations'&&sectionId==='countries'?CODEX_COUNTRIES.find(item=>item.id===locationId):null;
  const region=active.id==='locations'&&sectionId==='regions'?content.regions.find(item=>item.id===locationId):null;
  const faction=active.id==='organizations'&&sectionId==='factions'?roster?.factions?.find(entry=>entry.id===organizationId):null;
  const references=content.articles.filter(entry=>entry.category===active.id);
  const reference=references.find(entry=>entry.section===sectionId&&entry.id===locationId);
  const entries=section=>{
    const articles=references.filter(entry=>entry.section===section);
    if(articles.length)return articles.map(entry=>referenceLink(entry,entry.id===locationId)).join('');
    if(active.id==='organizations'&&section==='factions')
      return (roster?.factions??[]).map(entry=>organizationLink(entry.id,entry.name,entry.id===organizationId)).join('');
    if(active.id==='locations'&&section==='countries')return CODEX_COUNTRIES.map(item=>locationLink(section,item.id,item.name)).join('');
    if(active.id==='locations'&&section==='regions')return content.regions.map(item=>locationLink(section,item.id,item.name)).join('');
    if(active.id==='characters')return roster?.sections[section]?.map(item=>characterLink(item)).join('')??'';
    if(active.id==='locations'&&section==='cities')return content.cities.map(item=>`<button type="button" class="character-link" data-codex-city="${esc(item.id)}">${esc(codexName(item.name))}</button>`).join('');
    if(active.id==='organizations'&&['parties','corporations'].includes(section)){
      const group=roster?.organizations?.filter(entry=>entry.section===section)??[];
      const rows=list=>list.map(entry=>organizationLink(entry.id,entry.name,entry.id===organizationId)).join('');
      const archived=group.filter(entry=>entry.archived);
      return rows(group.filter(entry=>!entry.archived))+(archived.length?`<details class="organization-archive" ${organization?.archived?'open':''}><summary>Архив</summary>${rows(archived)}</details>`:'');
    }
    return '';
  };
  const visibleSections=active.sections.map(section=>({...section,items:entries(section.id)})).filter(section=>section.items);
  const primary=visibleSections.filter(section=>coreSections.has(section.id));
  const additional=visibleSections.filter(section=>!coreSections.has(section.id));
  const sectionList=sections=>sections.map(section=>`<li><button data-codex-section="${section.id}" aria-pressed="${sectionId===section.id}" aria-expanded="${sectionId===section.id}" aria-controls="codex-items-${section.id}"><span>${esc(codexName(section.label))}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button><div id="codex-items-${section.id}" class="codex-entries" ${sectionId===section.id?'':'hidden'}>${section.items}</div></li>`).join('');
  return `<section class="codex-panel" aria-labelledby="codex-title">
    <header>${returnCity?'<button class="codex-back" type="button" data-codex-city-back="true" aria-label="Вернуться к городу">←</button>':returnTab?'<button class="codex-back" type="button" data-codex-back="true" aria-label="Вернуться в связи">←</button>':''}<h2 id="codex-title">Кодекс</h2><button data-close-button data-strategy-close="true" aria-label="Закрыть кодекс">×</button></header>
    <nav class="codex-categories" aria-label="Разделы кодекса">${CODEX_CATEGORIES.map(category=>`
      <button data-codex-category="${category.id}" aria-pressed="${category.id===active.id}">
        <span class="codex-category-icon">${icon(category.icon)}</span><span>${esc(codexName(category.label))}</span>
      </button>`).join('')}</nav>
    <div class="codex-columns">
      <section class="codex-index" aria-labelledby="codex-index-title">
        <h3 id="codex-index-title">${esc(codexName(active.label))}</h3>
        <ul class="codex-section-list">${sectionList(primary)}</ul>
        ${additional.length?`<details class="codex-reference" ${additional.some(section=>section.id===sectionId)?'open':''}><summary>Дополнительно</summary><ul class="codex-section-list">${sectionList(additional)}</ul></details>`:''}
      </section>
      <section class="codex-article" aria-label="Статья кодекса">${person?characterArticle(person,startYear):organization?organizationArticle(organization,roster.organizationSeed,startYear,content.legislature):city?cityArticle(city,{regionalStatus}):region?regionArticle(region,regionalAccounts?.regions.find(item=>item.id===region.id)):country?countryArticle(country,roster):reference?referenceArticle(reference,{context:content.organizationContext[reference.id],contextTitle:content.contextTitle}):faction?referenceArticle(faction,{representative:faction.representative}):''}</section>
    </div>
  </section>`;
}

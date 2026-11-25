import {commissionPresident} from './european-commission.js';
import {interfaceNumberFormatter} from './localization.js';
import {atlasIcon,atlasMemberships,esc} from './atlas-interface.js';
import {CODEX_COUNTRIES,foreignLeaderId,locationLink} from './codex-locations.js';
import {characterLink} from './character-roster.js';
import {euOutside,partnerMarketsActive} from './trade-partners.js';
import {countryWorldFigure,detailedWorldActive,europeanUnionFigure} from './world-accounts.js';
import {EU_COUNTRY_NAMES,OPENING_EU_FISCAL} from './eu-members.js';

export const EUROPEAN_UNION_ATLAS={id:'eu',name:'Европейский союз',capital:'Брюссель'};

// 2000 population in millions: U.S. Census Bureau, Statistical Abstract 2001, table 1352.
// Nominal GDP in billions of USD and rank among WEO economies with 2000 data: IMF WEO (October 2026), NGDPD.
// Defense describes the starting posture. Bilateral relations use the scenario's common memberships.
export const FOREIGN_COUNTRY_MAP={
  usa:{code:'USA',market:'us',nato:true,securityCouncil:true,government:'Президентская республика',languages:'Английский (де-факто)',population:275.563,gdp:10250.950,rank:1,defense:'Ядерная держава · НАТО'},
  russia:{code:'RUS',market:'ru',securityCouncil:true,government:'Смешанная республика',languages:'Русский',population:146.001,gdp:278.264,rank:20,defense:'Ядерная держава'},
  china:{code:'CHN',market:'cn',securityCouncil:true,government:'Социалистическая республика',languages:'Стандартный китайский (путунхуа)',population:1261.832,gdp:1223.770,rank:6,defense:'Ядерная держава'},
  france:{code:'FRA',market:'eu',nato:true,securityCouncil:true,government:'Смешанная республика',languages:'Французский',population:59.330,gdp:1361.560,rank:5,defense:'Ядерная держава · НАТО'},
  germany:{code:'DEU',market:'eu',nato:true,government:'Парламентская республика',languages:'Немецкий',population:82.797,gdp:1967.850,rank:3,defense:'Коллективная оборона НАТО'},
  iran:{code:'IRN',market:'rest',government:'Исламская республика',languages:'Персидский (фарси)',population:65.620,gdp:447.805,rank:14,defense:'Самостоятельная оборона'},
  india:{code:'IND',market:'rest',commonwealth:true,government:'Парламентская республика',languages:'Хинди и английский (на уровне союза)',population:1014.004,gdp:468.396,rank:13,defense:'Ядерная держава'},
  australia:{code:'AUS',market:'rest',commonwealth:true,government:'Парламентская монархия',languages:'Английский (де-факто)',population:19.165,gdp:401.053,rank:16,defense:'Союз с США (АНЗЮС)'},
  japan:{code:'JPN',market:'jp',government:'Парламентская монархия',languages:'Японский (де-факто)',population:126.550,gdp:5042.382,rank:2,defense:'Союз с США'},
  canada:{code:'CAN',market:'ca',nato:true,commonwealth:true,government:'Парламентская монархия',languages:'Английский, французский',population:31.278,gdp:744.631,rank:8,defense:'Коллективная оборона НАТО'},
  italy:{code:'ITA',market:'eu',nato:true,government:'Парламентская республика',languages:'Итальянский',population:57.634,gdp:1150.169,rank:7,defense:'Коллективная оборона НАТО'},
  'south-africa':{code:'ZAF',market:'rest',commonwealth:true,government:'Парламентская республика',languages:'Африкаанс, английский, венда, зулу, коса, ндебеле, северный сото, сесото, свати, тсвана, тсонга',population:43.421,gdp:151.855,rank:31,defense:'Самостоятельная оборона'},
};

export const countryFlagPath=id=>'./assets/codex-flags/'+id+'.svg';
const number=interfaceNumberFormatter({maximumFractionDigits:1});

const row=(label,value)=>'<div><dt>'+esc(label)+'</dt><dd>'+value+'</dd></div>';

export function foreignCountryDossier(state,country,roster){
  const profile=FOREIGN_COUNTRY_MAP[country.id];
  const leader=roster?.people.get(foreignLeaderId(country));
  const uk=state.scenario?.id==='uk-2000';
  const eu=profile.market==='eu';
  const ties=uk?[
    ...(profile.nato?['НАТО']:[]),
    ...(eu&&!euOutside(state)?['ЕС']:[]),
    ...(profile.commonwealth?['Содружество']:[]),
  ]:[];
  const relations=ties.length?ties.join(' · '):uk?'Дипломатические отношения':'Не заданы';
  const alliances=[
    ['ООН','Международное сотрудничество',profile.securityCouncil?'Постоянный член Совета Безопасности ООН.':'Государство-член ООН.'],
    ...(profile.nato?[['НАТО','Военный союз','Союз основан на коллективной обороне его участников.']]:[]),
    ...(eu?[['ЕС','Экономический и политический союз','Государство участвует в едином рынке ЕС.']]:[]),
    ...(profile.commonwealth?[['Содружество','Международное сотрудничество','Государство входит в Содружество наций.']]:[]),
  ];
  const figure=detailedWorldActive(state)?countryWorldFigure(state,profile.code):null;
  const population=figure?.population??profile.population;
  const gdp=figure?figure.gdp/1000:profile.gdp;
  const rank=figure?.rank??profile.rank;
  const marketNote=figure||partnerMarketsActive(state)
    ? eu?'Экономика страны входит в общий рынок ЕС.'
      : !figure&&profile.market==='rest'?'Экономика страны входит в группу «Остальной мир».':'У страны отдельный торговый рынок.'
    : '';

  const fiscal=uk?OPENING_EU_FISCAL[profile.code]:null;
  return `<section class="atlas-dossier foreign-dossier" role="dialog" aria-modal="true" aria-labelledby="atlas-dossier-title">
    <header><div class="foreign-dossier-seal"><img src="${countryFlagPath(country.id)}" alt=""></div>
      <button data-close-button type="button" data-atlas-dismiss="true" aria-label="Закрыть сведения о стране">${atlasIcon('close')}</button>
    </header>
    <div class="dossier-inner">
      <h2 id="atlas-dossier-title">${esc(country.name)}</h2>
      <div class="foreign-dossier-overview">
        <div class="foreign-dossier-flag"><img src="${countryFlagPath(country.id)}" alt="Флаг · ${esc(country.name)}">
          ${locationLink('countries',country.id,'Открыть запись Кодекса')}</div>
        ${atlasMemberships(alliances)}
      </div>
      <dl>
        ${row('Отношения',esc(relations))}
        ${row('Оборона',esc(profile.defense))}
        ${row('Лидер',leader?esc(country.role)+' '+characterLink(leader):'—')}
        ${row('Правительство',esc(profile.government))}
        ${row('Столица',esc(country.id==='south-africa'?'Претория, Кейптаун, Блумфонтейн':country.capital))}
        ${row('Официальные языки',esc(profile.languages))}
        ${row('Население',number.format(population)+' млн')}
        ${row('Номинальный ВВП',number.format(gdp)+' млрд $')}
        ${row('Место в мировом ВВП',rank+'-е место')}
        ${fiscal?row('Госдолг в 2000 г.',number.format(fiscal.debt)+'% ВВП'):''}
        ${fiscal?row('Сальдо бюджета в 2000 г.',number.format(fiscal.balance)+'% ВВП'):''}
      </dl>
      ${uk&&eu?'<button type="button" class="inline-context-link" data-atlas-foreign="eu">Европейский союз</button>':''}
      ${marketNote?`<p class="foreign-dossier-market">${esc(marketNote)}</p>`: ''}
    </div>
  </section>`;
}

export function europeanUnionDossier(state){
  const union=europeanUnionFigure(state);
  const president=commissionPresident(state);
  const partner=state.lastReport?.external?.partners?.find(market=>market.id==='eu');
  const flag=countryFlagPath('eu');
  const members=union.members.map(code=>{
    const name=esc(EU_COUNTRY_NAMES[code]);
    const country=CODEX_COUNTRIES.find(item=>FOREIGN_COUNTRY_MAP[item.id].code===code);
    if(country)return `<li><button type="button" class="inline-context-link" data-atlas-foreign="${country.id}">${name}</button></li>`;
    if(code==='GBR')return `<li><button type="button" class="inline-context-link" data-atlas-home="true">${name}</button></li>`;
    return `<li>${name}</li>`;
  }).join('');
  return `<section class="atlas-dossier foreign-dossier eu-dossier" role="dialog" aria-modal="true" aria-labelledby="atlas-dossier-title">
    <header>
      <div class="foreign-dossier-seal"><img src="${flag}" alt=""></div>
      <button data-close-button type="button" data-atlas-dismiss="true" aria-label="Закрыть сведения о союзе">${atlasIcon('close')}</button>
    </header>
    <div class="dossier-inner">
      <h2 id="atlas-dossier-title">${EUROPEAN_UNION_ATLAS.name}</h2>
      <div class="foreign-dossier-overview">
        <div class="foreign-dossier-flag"><img src="${flag}" alt="Флаг Европейского союза">
          <button type="button" data-codex-reference="eu">Открыть запись Кодекса</button>
        </div>
        ${atlasMemberships([['ЕС','Экономический и политический союз','Государства союза участвуют в едином рынке.']])}
      </div>
      <dl>
        ${row('Представительство на карте',EUROPEAN_UNION_ATLAS.capital)}
        ${row('Председатель Европейской комиссии',president?characterLink(president):'—')}
        ${row('Страны-участницы',union.members.length)}
        ${row('Статус Великобритании',union.ukMember?'Член Европейского союза':'Вне Европейского союза')}
        ${row('Население союза',number.format(union.population)+' млн')}
        ${row('Номинальный ВВП союза',number.format(union.gdp/1000)+' млрд $')}
        ${partner?row('Экспорт Британии на рынок ЕС за месяц',number.format(partner.exportsUSD/1000)+' млрд $'):''}
        ${partner?row('Импорт Британии с рынка ЕС за месяц',number.format(partner.importsUSD/1000)+' млрд $'):''}
      </dl>
      <button type="button" class="inline-context-link" data-scenario-eu>Решения по ЕС</button>
      <details class="eu-members"><summary>Состав союза</summary><ul>${members}</ul></details>
    </div>
  </section>`;
}

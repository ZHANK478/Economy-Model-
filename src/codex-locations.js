import {activeLanguage, interfaceNumberFormatter, translateText} from './localization.js';
import {esc} from './atlas-interface.js';
import {foreignSkinTone} from './character-demographics.js';
import {hash} from './political-config.js';
import {SECTORS} from './config.js';
import {UK_BASE_YEAR_DOLLARS_PER_POUND} from './uk-observations.js';

export const CODEX_REGIONS=[
  ['TLC','Северо-Восточная Англия','Побережье Северного моря и долина Тайна связывают регион с морской торговлей. Ньюкасл-апон-Тайн вырос вокруг порта и промышленности. На юге региона река Тис выходит к морю у Мидлсбро.'],
  ['TLD','Северо-Западная Англия','Манчестер и Ливерпуль образуют два крупных городских центра региона. Манчестер вырос на текстильном производстве, а порт Ливерпуля связывал промышленные города с атлантической торговлей. К северу от них лежит Озёрный край.'],
  ['TLE','Йоркшир и Хамбер','Лидс служит деловым центром, Шеффилд связан с металлургией, а Халл стоит у эстуария Хамбер. К западу от городских равнин поднимаются Пеннинские горы.'],
  ['TLF','Восточный Мидленд','Ноттингем, Дерби и Лестер образуют промышленный пояс в глубине Англии. К востоку от городов простираются сельскохозяйственные земли Линкольншира.'],
  ['TLG','Западный Мидленд','Бирмингем и соседние города выросли вокруг металлообработки и машиностроения. Ковентри связан с автомобильной промышленностью, а сеть каналов напоминает о времени, когда грузы перевозили между заводами по воде.'],
  ['TLH','Восточная Англия','Сельскохозяйственные равнины Восточной Англии тянутся к побережью Северного моря. Кембридж известен университетом, а Саутенд-он-Си лежит у устья Темзы.'],
  ['TLI','Большой Лондон','Столица раскинулась по обе стороны Темзы. Вестминстер служит центром управления страной, а Сити сосредоточивает банки и финансовые учреждения. Окрестные районы связаны с центром железными дорогами и метро.'],
  ['TLJ','Юго-Восточная Англия','Регион окружает Большой Лондон и выходит к Ла-Маншу. Железные дороги связывают пригороды со столицей, а Брайтон и портовые города южного побережья обращены к морю.'],
  ['TLK','Юго-Западная Англия','От Бристоля и устья Северна регион тянется до полуострова Корнуолл. Бристоль вырос на морской торговле, Плимут связан с флотом, а сельские районы и побережье привлекают отдыхающих.'],
  ['TLL','Уэльс','Горные районы занимают значительную часть Уэльса. На юге бывшие угольные долины выходят к побережью, где находятся Кардифф и Суонси. В Кардиффе заседает Национальная ассамблея Уэльса, избранная в 1999 году.'],
  ['TLM','Шотландия','Большинство крупных городов лежит в Центральном поясе. На западе Глазго вырос вокруг промышленности и судостроения на Клайде. На востоке, у залива Ферт-оф-Форт, расположен Эдинбург, где в 1999 году возобновил работу парламент Шотландии.'],
  ['TLN','Северная Ирландия','Регион занимает северо-восток острова Ирландия и связан с Великобританией морскими маршрутами. Белфаст вырос вокруг порта и судостроения. Белфастское соглашение 1998 года стало основой для разделения власти в регионе.'],
].map(([id,name,description])=>({id,name,description}));

const countries=[
  ['usa','США','Вашингтон','Федеральная республика в Северной Америке. Доллар широко используется в международных расчётах, а американские финансовые рынки привлекают капитал со всего мира. США играют значительную роль в международной безопасности и развитии технологий.','Президент',['Daniel','Robert','James'],['Wallace','Bennett','Mitchell']],
  ['russia','Россия','Москва','Россия занимает территории в Восточной Европе и Северной Азии. Она экспортирует нефть, газ и металлы. Постоянное место в Совете Безопасности ООН и крупный ядерный арсенал придают ей вес в вопросах международной безопасности.','Президент',['Alexei','Mikhail','Andrei'],['Orlov','Krylov','Sokolov']],
  ['china','Китай','Пекин','Китай занимает значительную часть Восточной Азии. Прибрежные промышленные районы производят товары на экспорт, а внутренний рынок привлекает зарубежных поставщиков. Китай входит в число постоянных членов Совета Безопасности ООН.','Председатель КНР',['Wei','Jian','Ming'],['Lin','Guo','He'],true],
  ['france','Франция','Париж','Франция участвует в формировании политики Европейского союза и входит в число постоянных членов Совета Безопасности ООН. Её предприятия работают на мировых рынках авиации, энергетики, продовольствия и товаров класса люкс.','Президент',['Laurent','Pierre','Alain'],['Moreau','Garnier','Lefèvre']],
  ['germany','Германия','Берлин','Германия расположена в центре Европы. Её автомобильные и машиностроительные предприятия входят в международные производственные цепочки. Страна играет значительную роль в промышленности и экономической политике Европейского союза.','Федеральный канцлер',['Martin','Stefan','Klaus'],['Keller','Berger','Hartmann']],
  ['iran','Иран','Тегеран','Иран расположен между Каспийским морем и Персидским заливом. Его нефтегазовый сектор и положение рядом с Ормузским проливом связывают события в стране с международными энергетическими рынками.','Президент',['Reza','Ali','Mehdi'],['Farzani','Naderi','Karimi']],
  ['india','Индия','Нью-Дели','Индия занимает большую часть Южной Азии. Её крупный внутренний рынок дополняет экспорт программного обеспечения, деловых услуг и промышленных товаров. Положение в Индийском океане придаёт стране значение для морской торговли региона.','Премьер-министр',['Arun','Rajiv','Vikram'],['Mehta','Raman','Sharma']],
  ['australia','Австралия','Канберра','Австралия поставляет на мировые рынки железную руду, уголь и сельскохозяйственную продукцию. Она тесно связана с экономиками Азиатско-Тихоокеанского региона и участвует в региональном сотрудничестве по вопросам безопасности.','Премьер-министр',['Michael','Peter','Graham'],['Lawson','Reid','Fletcher']],
  ['japan','Япония','Токио','Япония расположена на островах у восточного побережья Азии. Её автомобили, электроника и промышленное оборудование занимают заметное место в мировой торговле. Японские компании ведут производство и инвестируют за рубежом.','Премьер-министр',['Kenjiro','Hiroshi','Takashi'],['Moriyama','Kondo','Okada'],true],
  ['canada','Канада','Оттава','Канада занимает северную часть Северной Америки. Её производство тесно связано с рынком США, а нефть, древесина, зерно и металлы идут на экспорт. Страна участвует в работе Группы семи.','Премьер-министр',['Marc','Philippe','David'],['Bouchard','Leblanc','Mackenzie']],
  ['italy','Италия','Рим','Италия находится в центральной части Средиземного моря. Её промышленные предприятия экспортируют машины, одежду и продовольствие. Средиземноморские порты связывают Италию с торговыми маршрутами между Европой, Африкой и Азией.','Председатель Совета министров',['Matteo','Carlo','Paolo'],['Rinaldi','Morelli','Ferraro']],
  ['south-africa','ЮАР','Претория','ЮАР находится на юге Африки, у морских маршрутов между Атлантическим и Индийским океанами. Её порты обслуживают торговлю юга континента, а горнодобывающие предприятия поставляют золото, платину и другие металлы.','Президент',['Thabo','Sipho','Nkosi'],['Maseko','Dlamini','Ndlovu']],
];
export const CODEX_COUNTRIES=countries.map(([id,name,capital,description,role,first,last,familyFirst])=>({id,name,capital,description,role,first,last,familyFirst}));
const femaleNames={
  usa:['Eleanor','Catherine','Diane'],russia:['Elena','Irina','Natalya'],china:['Lan','Li','Xue'],
  france:['Claire','Anne','Sophie'],germany:['Karin','Sabine','Petra'],iran:['Leila','Maryam','Sara'],
  india:['Anita','Mira','Neelam'],australia:['Julia','Helen','Margaret'],japan:['Keiko','Yuko','Michiko'],
  canada:['Marie','Louise','Catherine'],italy:['Laura','Anna','Francesca'],'south-africa':['Nomsa','Naledi','Zinzi'],
};
export const foreignLeaderId=country=>'foreign-'+country.id;
export function foreignLeader(country,seed){
  const id=foreignLeaderId(country);
  const pick=(names,key)=>names[Math.floor(hash(seed,id,key)*names.length)];
  const profile=Number(hash(seed,id,'profile')<.3);
  const first=pick(profile?femaleNames[country.id]:country.first,'first');
  const surname=pick(country.last,'last');
  const last=profile&&country.id==='russia'?surname+'a':surname;
  return {id,name:country.familyFirst?last+' '+first:first+' '+last,affiliation:country.name,countryId:country.id,
    profile,skinTone:foreignSkinTone(seed,id,country.id),age:47+Math.floor(hash(seed,id,'age')*19),diedMonth:null,appearanceSeed:hash(seed,id,'portrait'),
    roles:[],history:[],relatives:[]};
}

export function codexName(label) {
  const text = translateText(label);
  return text.replace(/^\p{Ll}/u, first => first.toUpperCase());
}
export const locationLink=(section,id,label)=>`<button type="button" class="character-link" data-codex-location="${esc(section)}" data-location-id="${esc(id)}">${esc(codexName(label))}</button>`;
const regionNumber=interfaceNumberFormatter({maximumFractionDigits:2});
function regionMoney(gdp){
  const amount=regionNumber.format(gdp/(1000*UK_BASE_YEAR_DOLLARS_PER_POUND));
  return activeLanguage()==='en'?'£'+amount+'bn':amount+' млрд £';
}

export const regionMapImage=(id,language=activeLanguage())=>'./assets/codex-regions/'+esc(id)+(language==='en'?'-en':'')+'.webp';

function regionalEconomyText(account,sectorNames,english){
  const population=regionNumber.format(account.population);
  const employment=regionNumber.format(account.employment);
  const gdp=regionMoney(account.nominalGDPMonthly);
  return english?[
    `The region has a population of ${population} million and supports ${employment} million jobs. Estimated monthly GDP is ${gdp}.`,
    `The biggest contributors were ${sectorNames}.`,
  ]:[
    `Население региона — ${population} млн человек, число рабочих мест — ${employment} млн. Расчётный ВВП за месяц — ${gdp}.`,
    `Наибольшую добавленную стоимость дали ${sectorNames}.`,
  ];
}

export function regionArticle(region,account){
  const english=activeLanguage()==='en';
  const locale=english?'en-GB':'ru-RU';
  const leading=account&&[...account.sectors].sort((a,b)=>b.nominalValueAdded-a.nominalValueAdded).slice(0,2);
  const sectorNames=leading?.map(sector=>translateText(SECTORS.find(item=>item.id===sector.id).name).toLocaleLowerCase(locale)).join(english?' and ':' и ');
  const parts=account?.remainder?[...account.cities,account.remainder]:[];
  const breakdown=parts.map(area=>`<li>${esc(codexName(area.name))} — ${esc(regionMoney(area.nominalGDPMonthly))}</li>`).join('');
  const current=account?`<h4>Экономика региона</h4>
    ${regionalEconomyText(account,sectorNames,english).map(sentence=>`<p>${esc(sentence)}</p>`).join('')}
    ${breakdown?`<h4>Состав ВВП региона</h4><ul>${breakdown}</ul>`:''}`:'';

  return `<h3 tabindex="-1">${esc(codexName(region.name))}</h3><div class="codex-location-text">
    <figure><img src="${regionMapImage(region.id)}" alt="${esc(region.name)} на игровой карте" width="720" height="432"><figcaption>${esc(region.name)} на игровой карте</figcaption></figure>
    <p>${esc(region.description)}</p>${current}
  </div>`;
}

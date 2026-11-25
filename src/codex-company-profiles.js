import {hash} from './political-config.js';

const specialties={
  bank:{suffix:'Bank',color:'#c8b48a',texts:['Коммерческий банк принимает вклады и кредитует домохозяйства и предприятия.']},
  rail:{suffix:'Rail Infrastructure',color:'#b6b7ca',texts:['Оператор обслуживает участки железнодорожной сети, находящиеся в частном управлении.']},
  roads:{suffix:'Road Services',color:'#bdccad',texts:['Оператор обслуживает дорожную инфраструктуру на участках, переданных в частное управление.']},
  grid:{suffix:'Power Networks',color:'#dcc67f',texts:['Оператор обслуживает часть электросетевой инфраструктуры страны.']},
  pension:{suffix:'Pension Trust',color:'#baa0aa',texts:['Фонд собирает пенсионные взносы и выплачивает накопления по мере выхода участников на пенсию.']},
  investment:{suffix:'Investment Fund',color:'#8fb5ae',texts:['Фонд объединяет сбережения домохозяйств и размещает часть средств в банковском капитале.']},
  insurance:{suffix:'Mutual',color:'#beae96',texts:['Фонд объединяет страховые взносы работников.']},
  health:{suffix:'Health Mutual',color:'#a8b998',texts:['Фонд объединяет частные взносы на медицинское страхование.']},
  farming:{suffix:'Farms',color:'#b3c194',texts:['Предприятие производит сельскохозяйственную продукцию.']},
  energy:{suffix:'Energy',color:'#d8ae76',texts:['Компания работает в сфере добычи и энергетики.']},
  engineering:{suffix:'Engineering',color:'#d5b278',texts:[
    'Компания выпускает насосы, приводы и другое оборудование для промышленных предприятий.',
    'Основу производства составляют машины и запасные части для заводских линий.',
  ]},
  metals:{suffix:'Metals',color:'#b8c4cc',texts:[
    'Предприятие поставляет стальной прокат и металлические заготовки для заводов и строительных подрядчиков.',
    'Компания обрабатывает листовой металл и выпускает профили для производства и строительства.',
  ]},
  electrical:{suffix:'Electrical',color:'#dcc67f',texts:[
    'Компания выпускает распределительное оборудование и компоненты для промышленных электросетей.',
    'Предприятие специализируется на силовой электронике и системах управления для заводов.',
  ]},
  materials:{suffix:'Materials',color:'#c4aa91',texts:[
    'Компания производит защитные покрытия, герметики и другие материалы для промышленных заказчиков.',
    'Предприятие поставляет технические покрытия и изоляционные составы для производственных и строительных работ.',
  ]},
  civil:{suffix:'Civil Engineering',color:'#bdccad',texts:[
    'Подрядчик строит мосты и дорожные развязки, берётся за реконструкцию транспортных объектов.',
    'Компания выполняет инженерные работы на дорогах и мостах, от подготовки площадки до монтажа конструкций.',
  ]},
  building:{suffix:'Construction',color:'#d6ac96',texts:[
    'Компания строит жилые кварталы и переоборудует существующие здания.',
    'Подрядчик ведёт жилищное строительство и реконструкцию зданий.',
  ]},
  contracting:{suffix:'Contracting',color:'#d4c6a3',texts:[
    'Подрядчик строит склады и производственные здания, а также оснащает их инженерными системами.',
    'Компания возводит коммерческие здания и берёт на себя монтаж внутренних коммуникаций.',
  ]},
  logistics:{suffix:'Logistics',color:'#9bc3c5',texts:[
    'Компания организует грузовые перевозки и складское обслуживание для торговых и промышленных предприятий.',
    'Компания занимается доставкой грузов и хранением товаров на распределительных складах.',
  ]},
  retail:{suffix:'Retail Group',color:'#d5b283',texts:[
    'Компания управляет сетью магазинов и закупает товары для продажи через собственные торговые точки.',
    'Компания занимается розничной торговлей и снабжает магазины через свои распределительные центры.',
  ]},
  systems:{suffix:'Systems',color:'#a9c7df',texts:[
    'Компания разрабатывает программы для учёта, управления запасами и обработки заказов.',
    'Компания внедряет корпоративные системы и помогает предприятиям вести учёт и обрабатывать заказы.',
  ]},
  advisory:{suffix:'Advisory',color:'#d1c3a2',texts:[
    'Фирма консультирует предприятия по управлению проектами и организации производства.',
    'Фирма помогает заказчикам планировать проекты и перестраивать работу подразделений.',
  ]},
  property:{suffix:'Property Services',color:'#c1b9d5',texts:[
    'Компания обслуживает офисные и торговые здания и управляет ими по договорам с владельцами.',
    'Компания ведёт эксплуатацию коммерческих зданий и координирует работу подрядчиков по ремонту.',
  ]},
};

const openingCompanies={
  'bank-1':['Marlowe Commercial Bank','bank'],
  'bank-2':['Kingsmere Bank','bank'],
  'bank-3':['Wexford & Vale Bank','bank'],
  'network-rail':['Ridgemere Rail Infrastructure','rail'],
  'network-roads':['Crownway Road Services','roads'],
  'network-grid':['Westerwick Power Networks','grid'],
  'fund-pension':['Alderwick Pension Trust','pension'],
  'fund-investment':['Seabourne Investment Fund','investment'],
  'fund-insurance':['Wrenhall Mutual','insurance'],
  'fund-health':['Fellbridge Health Mutual','health'],
  'industry-1':['Northmere Engineering','engineering',1948],
  'industry-2':['Calderwick Metals','metals',1932],
  'industry-3':['Alderbridge Electrical','electrical',1961],
  'industry-4':['Wrenford Materials','materials',1974],
  'construction-company-1':['Bracken & Holt Civil Engineering','civil',1956],
  'construction-company-2':['Ashbourne Construction','building',1983],
  'construction-company-3':['Cairnfield Contracting','contracting',1971],
  'services-company-1':['Fenwick Logistics','logistics',1968],
  'services-company-2':['Elmstead Retail Group','retail',1952],
  'services-company-3':['Hawthorn Systems','systems',1987],
};
const branches={
  agriculture:['farming'],resources:['energy'],bank:['bank'],
  industry:['engineering','metals','electrical','materials'],
  construction:['civil','building','contracting'],
  services:['logistics','retail','systems','advisory','property'],
};
const prefixes=['Alder','Ash','Bramble','Cedar','Crown','East','Fair','Fox','Grey','High','Kings','Linden','Oak','Ravens','West','Willow'];
const endings=['bourne','bridge','brook','croft','dale','field','ford','gate','hall','hurst','mere','moor','ridge','stead','wick','wood'];

export function codexCompanyProfile(company,sector,seed){
  const opening=openingCompanies[company.id];
  const candidates=branches[sector];
  const specialty=opening?.[1]??candidates[Math.floor(hash(seed,company.id,'specialty')*candidates.length)];
  const {suffix,color,texts}=specialties[specialty];
  const index=Number(company.id.split('-').at(-1));
  const slot=Number.isInteger(index)?index:Math.floor(hash(company.id)*256);
  const offset=Math.floor(hash(seed,sector,'trade name')*256);
  const nameIndex=(slot*53+offset)%256;
  const stem=prefixes[Math.floor(nameIndex/16)]+endings[nameIndex%16];
  const partner=prefixes[(nameIndex+Math.floor(slot/256)+5)%16]+endings[(nameIndex+7)%16];
  const name=opening?.[0]??(slot<256?stem:stem+' & '+partner)+' '+suffix;
  return {name,specialty,color,openingYear:opening?.[2],description:texts[Math.floor(hash(seed,company.id,'description')*texts.length)]};
}

// Monthly calendar, January 2000 = 0. Impulses are scenario estimates relative
// to a world without the event, not historical UK results. See docs/HISTORICAL-WORLD.md.
const calendar=[
  ['dotcom',2000,3,30,'Лопнул пузырь доткомов','Dot-com bubble bursts',
    'Акции технологических компаний пошли вниз после бурного роста. В США стало сложнее привлечь деньги на новые проекты, и инвестиции начали сокращаться.',
    'Technology shares tumbled after a long boom. US firms found it harder to raise money for new projects, and investment began to fall.',
    {markets:{us:-.025},channels:{foreignDemand:-.018}}],
  ['september',2001,9,10,'Теракты 11 сентября','September 11 attacks',
    'После терактов в США спрос на международные поездки упал. Это ударило по работе авиакомпаний и туристических фирм.',
    'Demand for international travel fell after the attacks in the United States, disrupting airlines and tourism businesses.',
    {markets:{us:-.007},services:-.07}],
  ['china-wto',2001,12,60,'Китай вступил в ВТО','China joins the WTO',
    'Китай вступил в Всемирную торговую организацию. По мере включения страны в мировую торговлю китайские предприятия наращивают выпуск и поставки.',
    'China has joined the World Trade Organization. Its manufacturers are expanding production and supplies as the country becomes more integrated into global trade.',
    {markets:{cn:.14},importCosts:{cn:-.12}},'lasting'],
  ['euro-cash',2002,1,24,'Евро входит в обращение','Euro cash enters circulation',
    'В двенадцати странах Европы покупатели начали расплачиваться банкнотами и монетами евро. Единая валюта упрощает расчёты внутри еврозоны.',
    'Shoppers in twelve European countries began paying with euro notes and coins. The common currency makes payments easier across the euro area.',
    {markets:{eu:.003}},'lasting'],
  ['iraq',2003,3,8,'Началась война в Ираке','Iraq War begins',
    'Начало войны в Ираке усилило тревогу на нефтяном рынке. Главный вопрос для покупателей топлива — насколько надёжны поставки.',
    'War in Iraq has put oil markets on edge. Fuel buyers face fresh uncertainty over supplies.',
    {channels:{energyPrice:.12}}],
  ['eu-enlargement',2004,5,48,'Расширение Евросоюза','European Union enlarges',
    'Европейский союз принял десять новых стран. Вступление открывает новый этап для их торговли с остальной Европой.',
    'The European Union has admitted ten new members, bringing their economies further into European trade.',
    {markets:{eu:.008}},'lasting'],
  ['financial',2007,8,71,'Мировой финансовый кризис','Global financial crisis',
    'Убытки по американским ипотечным бумагам вышли за пределы США. Кредитные рынки других стран тоже оказались под давлением.',
    'Losses on US mortgage securities have spread beyond the United States, putting credit markets elsewhere under pressure.',
    {markets:{us:-.055,eu:-.06,jp:-.065,ca:-.035,cn:-.016,rest:-.035},channels:{foreignDemand:-.09},capital:-.32},'pulse',17],
  ['lehman',2008,9,1,'Банкротство Lehman Brothers','Lehman Brothers files for bankruptcy',
    'Американский банк Lehman Brothers подал заявление о банкротстве. Банки стали осторожнее кредитовать друг друга, а предприятиям стало труднее получить финансирование.',
    'Lehman Brothers filed for bankruptcy, deepening the financial crisis. Banks grew more reluctant to lend to one another, and businesses struggled to raise money.',
    {}],
  ['euro-debt',2010,5,48,'Долговой кризис еврозоны','Euro-area debt crisis',
    'Рост стоимости займов в уязвимых странах еврозоны давит на кредитование и спрос в Европе.',
    'Higher borrowing costs in vulnerable euro-area countries put pressure on European lending and demand.',
    {markets:{eu:-.035},capital:-.08},'pulse',26],
  ['japan',2011,3,12,'Землетрясение и цунами в Японии','Earthquake and tsunami in Japan',
    'После землетрясения и цунами японские заводы временно сократили выпуск. Перебои дошли и до зарубежных предприятий, зависящих от японских комплектующих.',
    'Japanese factories cut output after the earthquake and tsunami. The disruption left manufacturers abroad short of Japanese components.',
    {markets:{jp:-.035},importCosts:{jp:.10},channels:{importAvailability:-.045}}],
  ['paris',2015,12,72,'Парижское соглашение по климату','Paris Agreement on climate change',
    'Страны приняли климатическое соглашение. Ограничения и расходы Британии зависят от её собственных решений.',
    'Countries adopt a climate agreement. British restrictions and spending remain a matter for its own government.',
    {}],
  ['tariff-conflict',2018,7,32,'Торговый конфликт США и Китая','US–China trade conflict',
    'Взаимные пошлины повышают издержки и ухудшают условия для инвестиций в обеих странах.',
    'Tit-for-tat tariffs raise costs and weaken investment conditions in both countries.',
    {markets:{us:-.007,cn:-.018},channels:{foreignDemand:-.012},capital:-.06}],
  ['pandemic',2020,3,29,'Пандемия COVID-19','COVID-19 pandemic',
    'Всемирная организация здравоохранения назвала вспышку COVID-19 пандемией. Спрос на поездки резко упал, а перебои на зарубежных заводах нарушают привычные торговые связи.',
    'The World Health Organization described the COVID-19 outbreak as a pandemic. Travel demand plunged, and factory disruptions abroad began to reshape trade.',
    {markets:{us:-.075,eu:-.095,jp:-.065,ca:-.08,cn:-.025,ru:-.045,in:-.08,rest:-.06},channels:{foreignDemand:-.075,importAvailability:-.14},services:-.26,capital:-.16},'pulse',3],
  ['ukraine',2022,2,45,'Россия вторглась в Украину','Russia invades Ukraine',
    'Война нарушает поставки топлива и зерна. Растут издержки импортёров энергии и продовольствия.',
    'The war disrupts fuel and grain supplies, raising costs for energy and food importers.',
    {markets:{ru:-.09,eu:-.025},channels:{energyPrice:.58,commodityPrice:.23,importAvailability:-.045,globalRate:.45}},'pulse',7],
  ['red-sea',2023,12,25,'Перебои с судоходством в Красном море','Red Sea shipping disruptions',
    'Часть перевозчиков направила суда вокруг Африки в обход Суэцкого канала. Для импортёров это означает более долгую и дорогую доставку из Азии.',
    'Some shipping companies have rerouted vessels around Africa to avoid the Suez Canal. Importers face longer, more expensive journeys from Asia.',
    {importCosts:{cn:.06,jp:.045,in:.06,rest:.014},channels:{importAvailability:-.025}}],
  ['tariffs',2025,4,36,'США повышают импортные пошлины','US raises import tariffs',
    'Новые американские пошлины и ответные меры повышают торговую неопределённость и меняют направления поставок.',
    'New US tariffs and responses raise trade uncertainty and redirect supply chains.',
    {markets:{us:-.015,cn:-.02,eu:-.009},exportCosts:{us:.10},channels:{foreignDemand:-.018},capital:-.055}],
  ['hormuz',2026,2,12,'Перебои поставок через Ормузский пролив','Disruption in the Strait of Hormuz',
    'Война на Ближнем Востоке ограничивает поставки нефти и газа через пролив, повышая мировые цены на энергию.',
    'War in the Middle East constrains oil and gas shipments through the strait, raising global energy prices.',
    {markets:{ir:-.08},channels:{energyPrice:.28,commodityPrice:.045}},'pulse',3],
];

const monthIndex=(year,month)=>(year-2000)*12+month-1;
export const HISTORICAL_WORLD=calendar.map(([id,year,month,duration,title,enTitle,text,enText,effects,shape='pulse',peak=2])=>
  ({id:'history:'+id,date:monthIndex(year,month),duration,title,enTitle,text,enText,effects,shape,peak}));
const calendarMonth=(s,month)=>(s.startYear??2000)*12-2000*12+month;

export function historicalNews(s,month=s.month){
  if(s.scenario?.id!=='uk-2000'||s.politics?.historicalWorldStart===undefined)return [];
  const offset=calendarMonth(s,0);
  return HISTORICAL_WORLD.filter(event=>event.date-offset>=s.politics.historicalWorldStart&&event.date-offset<=month)
    .map(({id,date,title,text,enTitle,enText})=>({id,start:date-offset,title,text,enTitle,enText}));
}

const factorsByDate=new Map();

export function historicalWorldFactors(s,month=s.month){
  const factors={channels:{},markets:{},importCosts:{},exportCosts:{},services:1,capital:1};
  if(s.scenario?.id!=='uk-2000'||s.politics?.historicalWorldStart===undefined||month<s.politics.historicalWorldStart)return factors;
  const date=calendarMonth(s,month);
  if(factorsByDate.has(date))return factorsByDate.get(date);
  for(const event of HISTORICAL_WORLD){
    const age=date-event.date;
    if(age<0||event.shape==='pulse'&&age>=event.duration)continue;
    const weight=event.shape==='lasting'?Math.min(1,(age+1)/event.duration):
      age<event.peak?(age+1)/(event.peak+1):(event.duration-age)/(event.duration-event.peak);
    for(const key of ['channels','markets','importCosts','exportCosts']){
      for(const [id,change] of Object.entries(event.effects[key]??{})){
        factors[key][id]=(factors[key][id]??1)*(1+change*weight);
      }
    }
    factors.services*=1+(event.effects.services??0)*weight;
    factors.capital*=1+(event.effects.capital??0)*weight;
  }
  factorsByDate.set(date,factors);
  return factors;
}

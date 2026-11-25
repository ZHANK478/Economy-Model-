// Council of the EU accession calendar. Population anchors in million residents
// are rounded; growth rates are real per-resident scenario assumptions.
export const EU_ACCESSIONS = [
  {year:2004,month:5,countries:[
    ['CYP',.69,.93,.028],['CZE',10.28,10.90,.028],['EST',1.40,1.37,.034],
    ['HUN',10.22,9.58,.023],['LVA',2.38,1.87,.034],['LTU',3.51,2.89,.038],
    ['MLT',.38,.56,.026],['POL',38.26,36.62,.035],['SVK',5.40,5.42,.031],
    ['SVN',1.99,2.12,.023],
  ]},
  {year:2007,month:1,countries:[['BGR',8.19,6.45,.033],['ROU',22.46,19.06,.038]]},
  {year:2013,month:7,countries:[['HRV',4.50,3.86,.026]]},
];

export const EU_COUNTRY_NAMES = {
  AUT:'Австрия',BEL:'Бельгия',BGR:'Болгария',CYP:'Кипр',CZE:'Чехия',
  DEU:'Германия',DNK:'Дания',EST:'Эстония',ESP:'Испания',FIN:'Финляндия',
  FRA:'Франция',GBR:'Великобритания',GRC:'Греция',HRV:'Хорватия',HUN:'Венгрия',
  IRL:'Ирландия',ITA:'Италия',LTU:'Литва',LUX:'Люксембург',LVA:'Латвия',
  MLT:'Мальта',NLD:'Нидерланды',POL:'Польша',PRT:'Португалия',ROU:'Румыния',
  SVK:'Словакия',SVN:'Словения',SWE:'Швеция',
};

// IMF Country Report 01/203, Table II.3. General government balance
// excluding receipts from 3G licences, and gross debt, as shares of GDP.
export const OPENING_EU_FISCAL = {
  FRA:{balance:-1.4,debt:57.6},
  DEU:{balance:-1.0,debt:60.3},
  ITA:{balance:-1.5,debt:110.2},
};

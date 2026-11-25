import {newGameOptions} from './start-presets.js';
import {UK_OBSERVATIONS as o} from './uk-observations.js';
import {publicPolicyFromAccounts} from './macro-core.js';
export const COUNTRY_SCENARIOS={'uk-2000':{name:'Великобритания · 2000',status:'Исследовательский сценарий'}};
export function scenarioOptions(id='uk-2000',{party='socialDemocrat',nameSeed=2000}={}){
 if(!COUNTRY_SCENARIOS[id])throw Error('Неизвестный сценарий');
 const base=newGameOptions({government:'parliamentary',country:'rich',party,resource:false});
 const assumptions=[
 ['schooling',10.5,'Оценка исходной квалификации; не британская серия образования'],
 ['depositRateAnnual',.035,'Оценка депозитной ставки: WDI за 2000 год не содержит наблюдения'],
 ['trendGrowth',.025,'Сценарный долгосрочный ориентир, не прогноз фактической истории'],
 ['serviceStructure',null,'Унаследованные восемь направлений и их доли; британская детализация пока не загружена'],
 ['financialStocks',null,'Структура депозитов, госдолга, валютных долгов, собственности и резервов остаётся модельной'],
 ['politicalOpening',null,'659 мест и окружная система; стартовые голоса, партии и кабинет модельные'],
 ['world',null,'Внешний ВВП калибруется по 2000 году; население следует наблюдениям 2000–2024 годов, затем экстраполируется. Внешний ВВП и торговые шоки рассчитываются моделью'],
 ['taxAndServices',null,'НДС 17,5%; прочие налоги, распределение бюджетных услуг, пенсии и мощности укрупнены']
 ];
 const evidence=Object.entries(o).map(([key,value])=>({key,value,year:2000,status:value===null?'missing':'observed',source:`https://api.worldbank.org/v2/country/GBR/indicator/${key}?date=2000&format=json`,usage:key==='GC.DOD.TOTL.GD.ZS'?'Не применено: определение долга требует согласования с моделью':key==='PA.NUS.FCRF'?'Справочно: расчётная валюта нормирована к доллару базового года':'Национальный ориентир; не региональная статистика'}));
 evidence.push(...assumptions.map(([key,value,source])=>({key,value,year:2000,status:'assumption',source})));
 const a=o['SL.AGR.EMPL.ZS']/100,b=o['SL.IND.EMPL.ZS']/100,c=o['SL.SRV.EMPL.ZS']/100,total=a+b+c;
 const structure={...base.economicStructure,workerShares:[a,b*.10,b*.65,b*.25,c].map(x=>x/total),schooling:10.5,lifeExpectancy:o['SP.DYN.LE00.IN'],creditRatio:o['FS.AST.PRVT.GD.ZS']/100,exportGDPShare:o['NE.EXP.GNFS.ZS']/100,importGDPShare:o['NE.IMP.GNFS.ZS']/100,agricultureGDPShare:o['NV.AGR.TOTL.ZS']/100};
 const accounts={version:1,referenceCountry:'GBR',referenceYear:2000,consumptionGDP:o['NE.CON.PRVT.ZS'],governmentConsumptionGDP:o['NE.CON.GOVT.ZS'],investmentGDP:o['NE.GDI.TOTL.ZS'],remittancesGDP:0,trendGrowth:.025,broadMoneyGDP:null};
 const policy=publicPolicyFromAccounts({...base.policy,vat:17.5,corporateTax:30,monetaryRegime:'rule',inflationTarget:2.5},accounts);
 // CPI observation is not the historical RPIX target. This is an approximate
 // CPI-based rule, explicitly documented, not a reconstruction of the MPC.
 const children=o['SP.POP.0014.TO.ZS']/100,elderly=o['SP.POP.65UP.TO.ZS']/100;
 return {...base,economicRevision:28,initialPopulation:o['SP.POP.TOTL']/1e6,initialGDPPerCapita:o['NY.GDP.PCAP.CD'],initialAccounts:accounts,economicStructure:structure,
 initialMacro:{version:1,referenceYear:2000,inflationAnnual:o['FP.CPI.TOTL.ZG']/100,unemployment:o['SL.UEM.TOTL.ZS']/100,realGrowthAnnual:o['NY.GDP.MKTP.KD.ZG']/100,lendingRateAnnual:o['FR.INR.LEND']/100,depositRateAnnual:.035},
 policy,parameters:{...base.parameters,initialFertility:o['SP.DYN.TFRT.IN'],initialChildShare:children+(1-children-elderly)*3/50,initialElderlyShare:elderly},
 politicalOptions:{...base.politicalOptions,nameSeed,constitution:{...base.politicalOptions.constitution,seats:659,electoralSystem:'plurality',parliamentTerm:60,parliamentOffset:60,confidence:'ordinary',independentCB:true,territorialProperty:'local',territorialBorrowing:'local'}},
 scenario:{version:1,id,name:'Великобритания',referenceYear:2000,status:'experimental',basis:'Ретроспективная калибровка по годовым данным 2000 года; не информация, известная в январе. Последующая история определяется моделью.',currency:'Расчётная единица базового года, нормированная к доллару; не исторический фунт',evidence,limitations:[...assumptions.map(x=>x[2]),'Разделение промышленной занятости, демография 15–17 лет, потребительские корзины и капитальные фонды оценены моделью.','Денежное правило использует CPI; британская цель 2000 года относилась к RPIX.','Границы карты современные и обобщённые; это не исторические избирательные округа.','Нет полноценного рынка покупки жилья и ипотеки. Территориальные отрасли делят национальные рабочие места, капитал и выпуск. Спрос и торговые потоки замыкаются на национальном рынке.'],
 geography:{version:1,assetId:'uk-constituent-countries-v1',layers:[{id:'country',kind:'territorial',validFrom:2000,validTo:null},{id:'constituent',kind:'territorial',validFrom:2000,validTo:null}],territories:[{id:'GBR',name:'Соединённое Королевство',parent:null,layer:'country'},...Object.entries({E92000001:'Англия',S92000003:'Шотландия',W92000004:'Уэльс',N92000002:'Северная Ирландия'}).map(([id,name])=>({id,name,parent:'GBR',layer:'constituent'}))],observations:[]}}};
}

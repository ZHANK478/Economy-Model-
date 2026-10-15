// Scenario presets, not empirical causal estimates. See docs/START-PRESETS.md.
import {DEFAULT_CONSTITUTION,PARTY_LABELS} from './political-config.js';
import {ECONOMIC_STRUCTURES} from './economic-structure.js';
import {OBSERVATIONS} from './economic-observations.js';
export const GOVERNMENT_PRESETS={
 presidential:{label:'Президент · президентская демократия',description:'Вы возглавляете исполнительную власть. Президент и парламент избираются отдельно.',constitution:{form:'presidential',playerRole:'president',regime:'democracy'}},
 parliamentary:{label:'Премьер-министр · парламентская демократия',description:'Вы возглавляете кабинет, который зависит от поддержки парламентского большинства.',constitution:{form:'parliamentary',playerRole:'primeMinister',regime:'democracy',presidentialVeto:false}},
 mixedPresident:{label:'Президент · смешанная демократия',description:'Вы президент; кабинет и премьер-министр также зависят от парламента.',constitution:{form:'semiPresidential',playerRole:'president',regime:'democracy'}},
 mixedPremier:{label:'Премьер-министр · смешанная демократия',description:'Вы возглавляете кабинет; рядом существует отдельно избранный президент.',constitution:{form:'semiPresidential',playerRole:'primeMinister',regime:'democracy'}},
 hybrid:{label:'Президент · ограниченная демократия',description:'Выборы сохраняются, но независимость судов, СМИ и контроль власти ослаблены.',constitution:{form:'presidential',playerRole:'president',regime:'hybrid',independentCB:false}},
 personalist:{label:'Лидер · персоналистская автократия',description:'Власть сосредоточена у лидера. Удержание власти зависит от элит, силовиков и общества.',constitution:{form:'presidential',playerRole:'president',regime:'personalist',termLimit:0,independentCB:false}},
 party:{label:'Глава правительства · партийная автократия',description:'Вы возглавляете исполнительную власть доминирующей партии; важна поддержка партийных элит.',constitution:{form:'parliamentary',playerRole:'primeMinister',regime:'party',presidentialVeto:false,termLimit:0,independentCB:false}},
 military:{label:'Глава государства · военное правление',description:'Опора режима — силовые структуры. Их лояльность не заменяет устойчивую экономику.',constitution:{form:'presidential',playerRole:'president',regime:'military',termLimit:0,independentCB:false}}
};
const populationProfile=(reference,defaults)=>{
 const o=OBSERVATIONS[reference],children=o.childShare14/100,elderly=o.elderlyShare/100;
 // Ages 15-17 approximated from ages 15-64; exact monthly cohorts are unavailable.
 return {...defaults,fertility:o.fertility,childShare:children+(1-children-elderly)*3/50,elderlyShare:elderly};
};
export const COUNTRY_PRESETS={
 poor:populationProfile('BGD',{label:'Бедная страна',gdp:500}),
 middle:populationProfile('MEX',{label:'Страна среднего достатка',gdp:6000}),
 rich:populationProfile('FRA',{label:'Богатая страна',gdp:25000})
};
export function newGameOptions({government='presidential',country='middle',party='liberal',resource=true}={}){
 if(!Object.hasOwn(GOVERNMENT_PRESETS,government)||!Object.hasOwn(COUNTRY_PRESETS,country)||!Object.hasOwn(PARTY_LABELS,party))throw new Error('Неизвестный стартовый сценарий');
 const c=COUNTRY_PRESETS[country];
 return {startYear:2000,seed:42,stochastic:false,resourceMode:resource,modelProfile:'balanced',initialGDPPerCapita:c.gdp,economicStructure:structuredClone(ECONOMIC_STRUCTURES[country]),
 parameters:{initialFertility:c.fertility,initialChildShare:c.childShare,initialElderlyShare:c.elderlyShare},politicalMode:true,
 politicalOptions:{livingWorld:true,constitution:{...DEFAULT_CONSTITUTION,...GOVERNMENT_PRESETS[government].constitution},agendaSlots:1,decisionLimit:3,dashboardMode:true,partyContinuity:true,playerFamily:party}};
}

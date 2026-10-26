import {NATIONAL_ACCOUNTS} from './national-accounts.js';
import {publicPolicyFromAccounts} from './macro-core.js';
import {BASE_POLICY} from './config.js';
import {MACRO_OBSERVATIONS} from './macro-observations.js';
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
 const c=COUNTRY_PRESETS[country],accounts=structuredClone(NATIONAL_ACCOUNTS[({poor:'BGD',middle:'MEX',rich:'FRA'})[country]]);
 const regime=GOVERNMENT_PRESETS[government].constitution.regime,competitive=['democracy','hybrid'].includes(regime),free=regime==='democracy';
 const macro=MACRO_OBSERVATIONS[accounts.referenceCountry];
 const policy=publicPolicyFromAccounts({...BASE_POLICY,rate:100*((1+.03)*(1+macro.inflationAnnual)-1),inflationTarget:100*macro.inflationAnnual,electionAdministration:.12,securityBudget:regime==='military'?1.2:.35,patronageBudget:competitive?0:.4,competitiveElections:competitive,freeMedia:free,protectedJudges:free,judicialReview:free,parliamentOversight:competitive,associationFreedom:competitive},accounts);
 return {initialAccounts:accounts,policy,startYear:2000,seed:42,stochastic:false,resourceMode:resource,modelProfile:'balanced',initialGDPPerCapita:c.gdp,initialMacro:structuredClone(MACRO_OBSERVATIONS[({poor:'BGD',middle:'MEX',rich:'FRA'})[country]]),economicStructure:structuredClone(ECONOMIC_STRUCTURES[country]),
 parameters:{governanceEfficiencyElasticity:0,competitionEfficiencyElasticity:0,softBudgetEfficiencyPenalty:0,initialFertility:c.fertility,initialChildShare:c.childShare,initialElderlyShare:c.elderlyShare},politicalMode:true,
 politicalOptions:{electionExperience:1,nameSeed:Math.floor(Math.random()*4294967296),livingWorld:true,constitution:{...DEFAULT_CONSTITUTION,...GOVERNMENT_PRESETS[government].constitution},agendaSlots:1,decisionLimit:3,dashboardMode:true,partyContinuity:true,playerFamily:party}};
}

// Institutional rules are choices. Behavioral numbers are synthetic assumptions,
// not estimated universal effects. See docs/POLITICS.md for evidence and limits.
export const FORMS={presidential:'Президентская республика',parliamentary:'Парламентская республика',semiPresidential:'Смешанная республика'};
export const ELECTORAL_SYSTEMS={pr:'Пропорциональная',plurality:'Округа: относительное большинство',twoRound:'Округа: два тура',parallel:'Смешанная параллельная',mmp:'Смешанная компенсирующая'};
export const PRESIDENT_SYSTEMS={twoRound:'Два тура',plurality:'Относительное большинство',ranked:'Преференциальное голосование'};
export const REGIMES={democracy:'Конкурентная демократия',hybrid:'Ограниченная конкуренция',party:'Партийная автократия',personalist:'Персоналистская автократия',military:'Военное правление'};
export const AXES=['economy','liberty','culture','environment','decentralization','openness'];
export const AXIS_NAMES={economy:'Перераспределение ← → рынок',liberty:'Контроль ← → гражданские права',culture:'Традиция ← → культурная открытость',environment:'Рост любой ценой ← → экология',decentralization:'Центр ← → регионы',openness:'Закрытость ← → внешняя открытость'};
export const PARTY_FAMILIES=[
  {id:'socialist',name:'Социалистическая',label:'Труд и солидарность',color:'#b65353',platform:[-.85,.35,.1,.35,.05,-.15]},
  {id:'socialDemocrat',name:'Социал-демократическая',label:'Социальный союз',color:'#cc7857',platform:[-.5,.65,.35,.4,.05,.3]},
  {id:'liberal',name:'Либеральная',label:'Свобода и развитие',color:'#c09b34',platform:[.7,.8,.5,.15,.2,.75]},
  {id:'conservative',name:'Консервативная',label:'Гражданский порядок',color:'#5079a5',platform:[.25,.2,-.65,-.1,-.25,.05]},
  {id:'national',name:'Национал-консервативная',label:'Национальный выбор',color:'#806898',platform:[-.05,-.25,-.8,-.3,-.4,-.75]},
  {id:'green',name:'Зелёная',label:'Зелёное будущее',color:'#51895d',platform:[-.3,.8,.7,.95,.45,.45]},
  {id:'agrarian',name:'Аграрная',label:'Земля и общины',color:'#9a9460',platform:[-.15,.3,-.35,.45,.7,-.2]},
  {id:'regional',name:'Региональная',label:'Союз регионов',color:'#558e91',platform:[.05,.5,.15,.2,.95,.2]}
];
export const DEFAULT_CONSTITUTION={form:'presidential',playerRole:'president',regime:'democracy',electoralSystem:'pr',presidentSystem:'twoRound',seats:120,threshold:4,parliamentTerm:48,presidentTerm:48,parliamentOffset:24,confidence:'constructive',independentCB:true,presidentialVeto:true,overrideFraction:2/3,constitutionalFraction:2/3,constitutionalReferendum:false,dissolution:true,termLimit:2,budgetContinuity:true,naturalizationYears:5,localResidentVote:false,emergencyMonths:3};
export const POLITICAL_PARAMETERS={ideologyWeight:1.8,identityWeight:.65,economicWeight:1.1,competenceWeight:.45,approvalAdjustment:.12,memoryMonths:18,polarization:.35,turnoutIntercept:.9,organizationWeight:.35,coalitionTolerance:.8,naturalizationUptake:.012,eliteHazard:.004,newPartyDemand:.22};
export const POLITICAL_PARAMETER_FIELDS=[
  ['ideologyWeight','Вес близости программы',0,4,.1],['identityWeight','Партийная идентичность',0,2,.1],['economicWeight','Вес экономического опыта',0,3,.1],['competenceWeight','Вес компетентности кандидата',0,2,.1],['approvalAdjustment','Скорость изменения одобрения',.01,.5,.01],['memoryMonths','Память экономического опыта, месяцев',3,60,1],['polarization','Ослабление реакции сторонников на неудачи',0,.9,.05],['turnoutIntercept','Склонность участвовать: константа логита',-2,3,.1],['organizationWeight','Вес партийной организации',0,2,.1],['coalitionTolerance','Допустимая программная дистанция коалиции',.2,1.5,.05],['naturalizationUptake','Месячная доля натурализации после срока',0,.05,.001],['eliteHazard','Масштаб месячного риска распада автократии',0,.03,.001],['newPartyDemand','Дистанция для появления новой партии',.1,.6,.02]
];
export const CONSTITUTIONAL_POLICY_KEYS=['protectedJudges','judicialReview','freeMedia','competitiveElections','parliamentOversight','associationFreedom'];
export const EXECUTIVE_KEYS=['fxIntervention','taxEnforcement','stabilizationSaving','foreignBorrowingShare','liquiditySupport'];
export const CB_KEYS=['rate','reserveRequirement','bankCapitalRequirement'];
export const POLITICAL_BUDGET_KEYS=['electionAdministration','securityBudget','patronageBudget'];
export const BUDGET_KEYS=['governmentConsumption','publicInvestment','transfers','education','healthcare','familyBenefits','businessSupport','antitrustBudget','courtBudget','soeAuditBudget','infrastructureMaintenance','childcareBudget',...POLITICAL_BUDGET_KEYS];
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const clone=v=>JSON.parse(JSON.stringify(v));
export const logistic=x=>1/(1+Math.exp(-clamp(x,-40,40)));
export function hash(...values){let h=2166136261;for(const c of values.join('|')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return(h>>>0)/4294967296;}
export function constitutionFrom(options={}){
  if(Object.keys(options).some(k=>!Object.hasOwn(DEFAULT_CONSTITUTION,k)))throw new Error('Неизвестное конституционное правило');
  const c={...DEFAULT_CONSTITUTION,...options};
  if(!(c.form in FORMS)||!(c.electoralSystem in ELECTORAL_SYSTEMS)||!(c.presidentSystem in PRESIDENT_SYSTEMS)||!(c.regime in REGIMES))throw new Error('Неизвестная форма государства, режим или избирательная система');
  if(!['president','primeMinister'].includes(c.playerRole)||!['ordinary','constructive'].includes(c.confidence))throw new Error('Неверная роль или вотум недоверия');
  if(c.form==='parliamentary')c.playerRole='primeMinister';if(c.form==='presidential')c.playerRole='president';
  for(const [k,min,max] of [['seats',30,360],['threshold',0,15],['parliamentTerm',12,84],['presidentTerm',12,84],['parliamentOffset',0,84],['termLimit',0,4],['naturalizationYears',0,20],['emergencyMonths',1,12]])if(!Number.isFinite(c[k])||c[k]<min||c[k]>max||!Number.isInteger(c[k]))throw new Error('Некорректное конституционное правило: '+k);
  for(const k of ['overrideFraction','constitutionalFraction'])if(!Number.isFinite(c[k])||c[k]<.5||c[k]>1)throw new Error('Некорректное квалифицированное большинство');
  for(const k of ['independentCB','presidentialVeto','constitutionalReferendum','dissolution','budgetContinuity','localResidentVote'])if(typeof c[k]!=='boolean')throw new Error('Конституционное правило должно быть логическим: '+k);
  return c;
}
export function parametersFrom(values={}){if(Object.keys(values).some(k=>!Object.hasOwn(POLITICAL_PARAMETERS,k)))throw new Error('Неизвестный политический коэффициент');const k={...POLITICAL_PARAMETERS,...values};for(const [key,,min,max] of POLITICAL_PARAMETER_FIELDS)if(!Number.isFinite(k[key])||k[key]<min||k[key]>max)throw new Error('Некорректное политическое допущение: '+key);return k;}
export const distance=(a,b)=>AXES.reduce((v,k)=>v+(a[k]-b[k])**2,0)/AXES.length;
export const platformObject=values=>Object.fromEntries(AXES.map((k,i)=>[k,values[i]]));

export const VERSION = '3.0.0';
export const SECTORS = [
  { id:'agriculture', name:'Сельское хозяйство', color:'#9dbd70' },
  { id:'resources', name:'Добыча и энергия', color:'#e8b76b' },
  { id:'industry', name:'Промышленность', color:'#85b7e5' },
  { id:'construction', name:'Строительство', color:'#bd9cde' },
  { id:'services', name:'Услуги', color:'#65c7b8' }
];
// Domestic inputs A[i][j]: units supplied by industry i per unit of output j.
export const INPUTS = [
  [.06,.00,.10,.00,.02],
  [.03,.05,.06,.05,.025],
  [.06,.08,.10,.18,.035],
  [.01,.02,.01,.03,.025],
  [.04,.05,.06,.06,.06]
];
// Synthetic equal-population strata, not observed national deciles. Ranking is
// recalculated for statistics; within-stratum inequality is not represented.
export const GROUPS = Array.from({length:10},(_,i)=>({
  id:`d${i+1}`,name:`Группа ${i+1} · 10% населения`,population:.1,
  mpc:[.97,.96,.95,.94,.93,.91,.89,.86,.80,.66][i],
  wageShare:[.04,.05,.06,.07,.08,.09,.105,.12,.145,.24][i],
  transferShare:[.18,.16,.14,.12,.10,.09,.075,.06,.045,.03][i],
  dividendShare:[.002,.003,.005,.01,.02,.035,.055,.09,.18,.60][i],
  familyShare:[.14,.135,.125,.115,.105,.095,.085,.075,.065,.06][i],
  householdSize:[4.6,4.4,4.1,3.8,3.5,3.3,3.1,2.9,2.7,2.5][i]
}));
export const MODEL_PROFILES={
  balanced:{name:'Управление и конкуренция',governanceProductivity:.006,competitionProductivity:.004,softBudgetPenalty:.006},
  competition:{name:'Сильная роль конкуренции',governanceProductivity:.004,competitionProductivity:.008,softBudgetPenalty:.008},
  institutions:{name:'Сильная роль институтов',governanceProductivity:.010,competitionProductivity:.003,softBudgetPenalty:.010}
};
export const BASE_POLICY = {
  rate:8.25, inflationTarget:5, vat:18, incomeTax:18, corporateTax:25,
  royalty:18, tariff:0, governmentConsumption:7, publicInvestment:3,
  transfers:3, education:1.5, healthcare:2, familyBenefits:.5, businessSupport:0, minimumWage:100,
  energyTariff:100, fxIntervention:0, reserveRequirement:5,
  bankCapitalRequirement:10, foreignBorrowingShare:25,
  stabilizationSaving:35, taxEnforcement:60, competition:60,
  capitalControls:0, migrationOpenness:60, bankRescue:true,
  liquiditySupport:true, incomeTaxProgressivity:0, soeGovernance:65, ruleOfLaw:65,
  bankCompetition:60, automaticRestructuring:true
};
export const POLICY_FIELDS = [
  ['rate','Ключевая ставка',0,40,.25,'% годовых','Кредит','Новые кредитные ставки меняются постепенно; старые кредиты пересматриваются ещё медленнее.'],
  ['inflationTarget','Цель по инфляции',0,15,.5,'% годовых','Кредит','Якорь ожиданий; результат зависит от доверия.'],
  ['reserveRequirement','Резервное требование',0,25,.5,'% депозитов','Кредит','Потребность банков в ликвидности.'],
  ['bankCapitalRequirement','Требование к капиталу',4,25,.5,'% рискованных активов','Кредит','Ограничивает новые кредиты при нехватке капитала.'],
  ['vat','НДС на потребление',0,35,.5,'%','Налоги','Применяется к конечному потреблению; инвестиции и госзакупки освобождены в этой модели.'],
  ['incomeTax','Подоходный налог',0,40,.5,'%','Налоги','Собираемость зависит от теневого сектора и контроля.'],
  ['incomeTaxProgressivity','Прогрессивность налога',0,1,.05,'наклон шкалы','Налоги','Ставка каждой группы зависит от её трудового дохода относительно среднего; предел — 60%.'],
  ['corporateTax','Налог на прибыль',0,45,.5,'%','Налоги','Начисляется на положительную прибыль после процентов и износа.'],
  ['royalty','Сырьевая рента',0,50,1,'% выручки добычи','Налоги','Изменяет бюджет и доходность добывающей отрасли.'],
  ['tariff','Импортная пошлина',0,30,.5,'%','Налоги','Повышает цену импортных товаров и компонентов.'],
  ['taxEnforcement','Налоговый контроль',0,100,1,'индекс / 100','Налоги','Улучшает собираемость и сокращает теневой сектор; администрирование требует бюджетных закупок.'],
  ['governmentConsumption','Государственные закупки',0,35,.5,'% ВВП за 12 мес.','Бюджет','Доля известного ВВП последних 12 месяцев; месячный бюджет = годовая сумма / 12. Социальные услуги отдельно.'],
  ['publicInvestment','Инфраструктура',0,15,.25,'% ВВП за 12 мес.','Бюджет','Сначала спрос на строительство; ввод объектов через 12–24 месяца.'],
  ['transfers','Пособия и пенсии',0,20,.25,'% ВВП за 12 мес.','Бюджет','Перевод дохода семьям; сам перевод не входит в ВВП.'],
  ['education','Образование',0,8,.25,'% ВВП за 12 мес.','Бюджет','Текущие закупки услуг; квалификация меняется медленно.'],
  ['healthcare','Здравоохранение',0,10,.25,'% ВВП за 12 мес.','Бюджет','Оплаченные услуги на человека постепенно меняют возрастную смертность.'],
  ['familyBenefits','Поддержка семей с детьми',0,6,.25,'% ВВП за 12 мес.','Бюджет','Трансферты семьям; умеренное влияние на рождаемость с задержкой.'],
  ['businessSupport','Поддержка предприятий',0,8,.25,'% ВВП за 12 мес.','Бюджет','Денежный трансферт фирмам, не дополнительный выпуск.'],
  ['foreignBorrowingShare','Внешнее финансирование',0,80,1,'% новых займов','Бюджет','Валютный риск; доступность зависит от долгов и доверия.'],
  ['stabilizationSaving','Сбережение сырьевой ренты',0,100,1,'% ренты','Бюджет','Пополняет валютный фонд при наличии средств казначейства.'],
  ['minimumWage','Минимальная зарплата',60,200,1,'индекс, старт = 100','Структура','Влияет на нижнюю часть зарплат и издержки найма.'],
  ['energyTariff','Регулируемый энерготариф',50,180,1,'индекс, старт = 100','Структура','Изменение тарифа постепенно переносится в цены.'],
  ['competition','Конкурентная политика',0,100,1,'индекс / 100','Структура','Постепенно меняет наценки и производительность; проведение политики требует бюджетных закупок.'],
  ['soeGovernance','Управление госпредприятиями',0,100,1,'индекс / 100','Структура','Профессиональное управление меняется постепенно; реформы требуют расходов.'],
  ['ruleOfLaw','Предсказуемость прав собственности',0,100,1,'индекс / 100','Структура','Влияет на риск вложений. Изъятие без компенсации временно увеличивает риск.'],
  ['bankCompetition','Конкуренция за вкладчиков',0,100,1,'индекс / 100','Кредит','Депозитная ставка зависит также от доходности активов и потребности в фондировании.'],
  ['migrationOpenness','Миграционная открытость',0,100,1,'индекс / 100','Структура','Миграция реагирует на доходы и занятость с задержкой.'],
  ['fxIntervention','Валютная интервенция',-500,500,25,'млн $ / месяц','Валюта','Плюс: продажа резервов для поддержки валюты. Минус: покупка валюты.'],
  ['capitalControls','Ограничения капитала',0,100,1,'индекс / 100','Валюта','Сдерживают отток, но снижают приток инвестиций.']
];
export const PARAMETERS = {
  initialFertility:2.6, fertilityTrend:.004, fertilityAdjustment:.035, fertilityBenefitElasticity:.04,
  mortalityImprovement:.005, healthAdjustment:1/36, healthMortalityElasticity:.18, migrationAdjustment:.05, pregnancyDelay:9,
  annualDepreciation:.06, annualInfrastructureDepreciation:.03,
  annualTechnicalProgress:.009, wageAdjustment:.14, employmentAdjustment:.24,
  pricePersistence:.70, expectationAdjustment:.10, investmentAdjustment:.16,
  ratePassThrough:.20, oldLoanRepricing:.07, importPassThrough:.18,
  demandPriceResponse:.012, scarcityPriceResponse:.02, interestInvestmentElasticity:3.0,
  interestConsumptionElasticity:1.2, exportElasticity:.65, importElasticity:.45,
  wealthConsumption:.003, dividendPayout:.70, inventoryTarget:.12, inventoryAdjustment:.12,
  privateInvestmentDelay:6, publicInvestmentDelay:18, skillsAdjustment:.012,
  capitalCapacityElasticity:.42, infrastructureElasticity:.08,
  exchangeFlowSensitivity:.015, exchangeInterestSensitivity:.025, exchangeParityAdjustment:.015,
  defaultSensitivity:.40, maximumPublicDebtRatio:1.8, sovereignRiskSensitivity:.12,
  stochasticAmplitude:1, neutralRealRate:.03, depositRateAdjustment:.20,
  reserveRemunerationShare:.70, foreignAssetRiskWeight:.20, fxRiskWeight:1,
  liquidityOutflowRate:.10, minimumLeverageRatio:.03, fxPortfolioShare:.25,
  expectationsAnchor:.65, wealthAnnuity:.0015, educationElasticity:.12,
  governanceAdjustment:1/36, ownershipDisruption:.04, ownershipRiskDecay:1/60,
  refinancingRiskIntercept:-5, refinancingDebtCoefficient:2,
  refinancingServiceCoefficient:3, restructuringDelay:3, marketExclusionMonths:24,
  pppConversionFactor:1.65, absolutePovertyRealMonthly:90
};
export const PARAMETER_FIELDS = [
  ['interestInvestmentElasticity','Чувствительность инвестиций к реальной ставке',0,8,.1],
  ['interestConsumptionElasticity','Чувствительность потребления к реальной ставке',0,5,.1],
  ['importPassThrough','Перенос импортных цен',0,.6,.01],
  ['exportElasticity','Реакция экспорта на реальный курс',0,2,.05],
  ['pricePersistence','Инерция месячной инфляции',.1,.95,.01],
  ['expectationAdjustment','Скорость изменения ожиданий',.01,.5,.01],
  ['oldLoanRepricing','Доля старых кредитов с пересмотром ставки за месяц',.01,.4,.01],
  ['employmentAdjustment','Скорость найма и увольнений',.02,.7,.02],
  ['investmentAdjustment','Скорость пересмотра инвестиций',.02,.5,.02],
  ['exchangeFlowSensitivity','Чувствительность курса к валютным потокам',.005,.12,.005],
  ['privateInvestmentDelay','Ввод частного капитала, месяцев',1,24,1],
  ['publicInvestmentDelay','Ввод инфраструктуры, месяцев',3,48,1],
  ['initialFertility','Базовая рождаемость, детей на женщину',1,5,.1],
  ['fertilityBenefitElasticity','Влияние реальной поддержки семей на рождаемость',0,.2,.01],
  ['healthMortalityElasticity','Влияние услуг здравоохранения на смертность',0,.5,.01]
  ,['neutralRealRate','Нейтральная реальная ставка · условная',0,.10,.005]
  ,['depositRateAdjustment','Скорость пересмотра депозитных ставок',.05,.5,.01]
  ,['expectationsAnchor','Максимальный вес цели в ожиданиях',.2,.9,.05]
  ,['foreignAssetRiskWeight','Кредитный вес внешних активов',0,1,.05]
  ,['fxRiskWeight','Эквивалентный вес открытой валютной позиции',0,2,.1]
  ,['educationElasticity','Эластичность школьного охвата по реальным расходам',0,.4,.02]
  ,['refinancingRiskIntercept','Константа условного риска потери финансирования',-8,-2,.25]
];
export const WORLD = {commodityPrice:100,energyPrice:100,foreignDemand:100,globalRate:4,weather:100,importAvailability:100};
export const MODULES = [
  ['Население и рабочая сила','Возрастно-половые месячные когорты, рождения, смертность, миграция и участие в труде.'],
  ['Отраслевое производство','Пять отраслей, собственные мощности, работники и цены.'],
  ['Межотраслевые связи','Матрица затрат Леонтьева; дефицит компонентов ограничивает выпуск.'],
  ['Капитал и производительность','Износ, очередь ввода инвестиций, инфраструктура и навыки.'],
  ['Запасы и ограничения','Склады, загрузка мощностей, рационирование заказов.'],
  ['Домохозяйства','Десять групп: доходы, богатство, долги, налоги и склонность к потреблению.'],
  ['Занятость и зарплаты','Инерция найма, реальные зарплаты, минимальная зарплата.'],
  ['Инвестиции бизнеса','Продажи, загрузка, реальная ставка, кредит и доверие.'],
  ['Цены и инфляция','Отраслевые цены, продовольствие, энергия, базовая инфляция.'],
  ['Ожидания и доверие','Адаптивные ожидания с частичным якорем инфляционной цели.'],
  ['Денежная политика','Ставка, кредитный канал, реальная ставка и валютный канал.'],
  ['Банки и кредит','Согласованные кредиты и депозиты, капитал, ликвидность, спасение банков.'],
  ['Частные долги','Валютная часть, фиксированные ставки, погашения и списания.'],
  ['Налоги','НДС, доходы, прибыль, пошлины, рента и собираемость.'],
  ['Государственные расходы','Закупки, инфраструктура, образование, трансферты и субсидии.'],
  ['Государственный долг','Когорты облигаций со ставкой и сроком; рефинансирование и дефолты.'],
  ['Внешняя торговля','Экспорт и импорт, реальные объёмы, мировые цены и сроки реакции.'],
  ['Курс и капитал','Валютные потоки, риск, прямые инвестиции, отток и переводы.'],
  ['Резервы и сырьё','Интервенции, валютный фонд, сырьевой сценарий и внешние шоки.'],
  ['Институты','Теневая экономика, собираемость, конкуренция, эффективность вложений.']
  ,['Собственность','Государственные, отечественные и иностранные доли; приобретение, приватизация, изъятие.']
  ,['Неравенство и развитие','Джини, бедность, медианный доход, образование и модельная оценка ИЧР.']
  ,['История решений','Полная помесячная политика, параметры, операции, внешние условия и воспроизводимый журнал.']
];

import {savedWorldEvents} from './world-events.js';

// Presentation-only thresholds, not probabilities or changes to the economy.
// One issue per event/episode; ordinary alerts have a six-month global cooldown.
// A first default or a new banking collapse can interrupt that cooldown.
const finite=x=>Number.isFinite(x)?x:0;
const amount=x=>finite(x).toLocaleString('ru-RU',{maximumFractionDigits:1});
export function newspaperCandidates(s){
 if(s.month<2)return [];
 const m=s.metrics,f=s.lastReport?.fiscal??{},before=s.lastReport?.calculationTrace?.before;
 const previous=s.history?.find(h=>h.month===s.month-1)??before?.metrics??{};
 const episode=s.government.defaultEpisodes?.at(-1),episodeId=episode?.start??s.month;
 const candidates=[];
 const add=(key,priority,title,lead,body,facts,watch,stage=0)=>candidates.push({id:`${key}:${key==='default'||key==='banking'?episodeId:s.month}`,key,priority,month:s.month,title,lead,body,facts,watch,stage});
 const failedPayment=f.treasuryPayments?.find(p=>p.reason);
 const externalArrears=s.government.externalBonds.some(b=>b.inDefault&&(b.overdue??0)>1e-8);
 if(s.government.defaultActive){
  const continuing=episode&&episode.start<s.month;
  const unfunded=f.financingRequests?.[0]?.unfunded??0;
  add('default',100,continuing?'Долговой кризис продолжается':'Государство пропустило платёж',
   failedPayment?.reason==='budget-cash'?'Казначейство не смогло в срок собрать сумму, необходимую для платежа.':failedPayment?.reason==='settlement-liquidity'?'Валютные резервы у страны есть. Провести платёж помешала нехватка средств для расчётов у банков.':externalArrears?'Внешние кредиторы не получили деньги в срок. Платежи по этим обязательствам нужно проводить в иностранной валюте.':'Часть долговых обязательств не оплачена в срок.',
   externalArrears&&Number.isFinite(f.financingRequests?.[0]?.unfunded)&&unfunded<1e-7?'Финансирование в национальной валюте было привлечено, однако это не обеспечило полную оплату внешнего долга. Валюта и доступ к внешнему кредиту ограничены.':Number.isFinite(f.financingRequests?.[0]?.unfunded)?`Непокрытая потребность казначейства в начале месяца: ${amount(unfunded)} млн. Просрочка ограничивает доступ к новым внешним займам.`:'Зафиксирована просрочка по долговым обязательствам. Она ограничивает доступ к новым внешним займам.',
   [['Долг / ВВП',amount(m.debtRatio)+'%'],['Резервы',amount(s.government.reservesUSD)+' млн $'],['Просроченные платежи',amount(s.government.arrears)+' млн']],
   'Проверьте валютную ликвидность и график долга. Списание облигаций может нанести потери банкам, которые их держат.');
 }
 const requirement=s.policy?.bankCapitalRequirement??10;
 const bankCross=finite(m.capitalRatio)<requirement&&finite(previous.capitalRatio)>=requirement;
 if(f.domesticHaircut>0&&bankCross){
  add('banking',95,'Списание долга ударило по банкам','Государство пересмотрело условия по своим облигациям. Банкам, которые держали эти бумаги, пришлось признать убытки.',
   'Убытки сократили капитал банков. Теперь им может стать сложнее выдавать новые кредиты и покупать государственные бумаги.',
   [['Капитал банков',amount(m.capitalRatio)+'%'],['Было месяц назад',amount(previous.capitalRatio)+'%'],['Помощь банкам',amount(f.bankRescue)+' млн']],
   'Проверьте банковский капитал и исполнение бюджета. Новое списание долга может снова увеличить потери банков.');
 }
 const plan=s.lastReport?.calculationTrace?.budgetPlan;
 if(plan?.requestedPurchases>0&&f.purchases/plan.requestedPurchases<.2&&(previous.governmentPurchases>5*finite(m.governmentPurchases))){
  add('budget',95,'Бюджет утверждён. Выплаты остановлены','Поставщикам государства поступила лишь малая часть денег, предусмотренных на закупки.',
   `На государственные закупки требовалось ${amount(plan.requestedPurchases)} млн, оплачено ${amount(f.purchases)} млн.${f.bankRescue>0?` Отдельно на пополнение капитала банков направлено ${amount(f.bankRescue)} млн.`:''} Из-за сокращения закупок у предприятий стало меньше заказов от государства.`,
   [['Закупки оплачены',amount(100*f.purchases/plan.requestedPurchases)+'%'],['Армии назначено',amount(f.militaryRequested)+' млн'],['Армии выплачено',amount(f.militaryPurchases)+' млн']],
   'Проверьте доступное финансирование, платежи по долгу и помощь банкам. Повышение бюджетного процента само по себе не создаёт денег.');
  if(episode)candidates.at(-1).id=`budget:${episodeId}`;
 }
 const tax=finite(f.tax??m.taxRevenue),interest=finite(f.interest??m.interestExpense),burden=tax>0?interest/tax:0;
 // A high sovereign premium can strain the budget even with ample FX reserves.
 // Thresholds choose rare headlines; they do not change debt pricing or funding.
 const spread=Number.isFinite(f.sovereignSpread)?f.sovereignSpread*100:m.sovereignSpread;
 const revenue=tax+finite(f.centralIncome)+finite(f.stateDividends);
 const grossBorrowing=finite(f.domesticIssued)+finite(f.externalIssued)*finite(m.exchangeRate??s.exchangeRate);
 if(!s.government.defaultActive&&spread>=15&&grossBorrowing>1e-8&&revenue>0&&interest/revenue>=.25){
  add('borrowing',80,'Государственные займы подорожали',
   'Казна платит больше за новые займы. Проценты уже забирают заметную долю её доходов.',
   '',[], '');
 }
 const hasExternalDebt=s.government.externalBonds.some(b=>b.principal>0);
 if(!s.government.defaultActive&&hasExternalDebt&&m.reserveMonths<3&&(burden>.35||m.debtServiceRevenue>70)){
  const stage=m.reserveMonths<1&&burden>.5?2:1;
  add('warning',75,stage===2?'Валютная подушка почти исчерпана':'Обслуживание долга становится опаснее',
   'На выплаты по долгам уходит значительная часть доходов казны, а запас иностранной валюты остаётся низким.',
   `Проценты за месяц составили ${amount(interest)} млн при налоговых поступлениях ${amount(tax)} млн. Для внешнего долга нужна валюта; национальная валюта её не заменяет. Это предупреждение о риске, а не прогноз неизбежного дефолта.`,
   [['Проценты / налоги',amount(burden*100)+'%'],['Резервы',amount(s.government.reservesUSD)+' млн $'],['Резервы / импорт',(m.reserveMonths>0&&m.reserveMonths<.1?'<0,1':amount(m.reserveMonths))+' мес.']],
   'Оцените ближайшие валютные платежи, накопление резервов и новые займы. Наращивание резервов тоже требует средств.',stage);
 }
 const outlook=s.lastReport?.paymentOutlook;
 if(outlook&&!s.government.defaultActive&&(outlook.fxGap>1e-7||outlook.cashGap>1e-7&&m.refinancingRisk>60)){
  add('payment-risk',85,'Приближаются крупные долговые платежи',outlook.fxGap>1e-7?'Казначейству предстоят выплаты по долгу. Иностранной валюты для них может не хватить.':'До ближайшего срока выплат по долгу казначейству предстоит привлечь дополнительные средства.','',[],'');
 }
 const forecast=s.agriculture?.forecast;
 if(forecast&&forecast.start>s.month){
  add('harvest-risk',70,'Под угрозой будущий урожай','Неблагоприятная погода поставила будущий урожай под угрозу. Хозяйства готовятся к трудному сезону.','',[],'');
  candidates.at(-1).id=forecast.id;
 }
 const drop=previous.realGDPMonthly>0?100*(m.realGDPMonthly/previous.realGDPMonthly-1):0;
 if(drop< -8&&!s.government.defaultActive&&f.purchases>0){
  const supply=s.lastReport.diagnostics?.capacityBound?.some(Boolean),fx=s.lastReport.diagnostics?.foreignLiquidityBound;
  add('output',65,'Резкое сокращение производства',`Предприятия выпустили на ${amount(-drop)}% меньше продукции в реальном выражении, чем месяцем ранее.`,
   fx?'Нехватка иностранной валюты затруднила закупки за рубежом. Предприятиям стало сложнее выполнять заказы.':supply?'Предприятия столкнулись с ограничениями производственных мощностей или поставок.':'Месячные данные показывают спад. Они пока не позволяют судить, какую роль сыграли спрос, инвестиции и госрасходы.',
   [['Выпуск за месяц',amount(drop)+'%'],['Безработица',amount(m.unemployment)+'%'],['Исполнение заказов',amount(m.fulfillment)+'%']],
   'Сравните государственные закупки, инвестиции и доступность импорта. Стимулирование спроса не устраняет физическую нехватку компонентов.');
 }
 const world=[s.lastReport.worldNews,...savedWorldEvents(s)].find(e=>e?.start===s.month&&e.duration>=3&&((['importAvailability','weather','foreignDemand'].includes(e.key)&&e.multiplier<=.85)||(e.key==='energyPrice'&&e.multiplier>=1.25)||(e.key==='commodityPrice'&&s.resourceMode&&e.multiplier<=.8)));
 if(world){
  add('world',60,world.title,world.text,
   'Это изменение внешних условий. Его влияние на выпуск и занятость зависит от структуры экономики, запасов и доступного финансирования.',
   [['Изменение условия',(world.multiplier>1?'+':'')+amount((world.multiplier-1)*100)+'%'],['Длительность',world.duration+' мес.']],
   world.key==='importAvailability'?'Проверьте импортозависимые отрасли. Масштаб изменения поставок не равен такому же падению ВВП.':'Следите за экспортной выручкой, издержками и валютной ликвидностью.');
  candidates.at(-1).id=world.id??`world:${world.start}:${world.key}`;
 }
 if(previous.defaultActive&&!m.defaultActive&&f.purchases>0){
  add('recovery',55,'Текущие просрочки урегулированы','Казначейство вышло из дефолта и возобновило оплату государственных закупок.',
   'Последствия кризиса могут сохраняться. Доступ к зарубежным займам остаётся под вопросом, а понесённые банками потери ещё могут сдерживать кредитование.',
   [['Безработица',amount(m.unemployment)+'%'],['Закупки',amount(f.purchases)+' млн']],
   'Проверьте устойчивость новых платежей и банковский капитал, прежде чем наращивать обязательства.');
 }
 return candidates.sort((a,b)=>b.priority-a.priority);
}
export function updateNewspaper(s,press){
 press.version=1;
 // Re-evaluate the current month once when opening a pre-update UI save.
 if(press.borrowingAlertRevision!==1){press.borrowingAlertRevision=1;press.checkedMonth=null;}
 if(press.checkedMonth===s.month)return null;
 const previousChecked=press.checkedMonth;
 const fiscal=s.lastReport?.fiscal??{},spread=Number.isFinite(fiscal.sovereignSpread)?fiscal.sovereignSpread*100:s.metrics.sovereignSpread;
 const income=finite(fiscal.tax??s.metrics.taxRevenue)+finite(fiscal.centralIncome)+finite(fiscal.stateDividends);
 const healthy=Number.isFinite(spread)&&spread<10&&income>0&&finite(fiscal.interest??s.metrics.interestExpense)/income<.25&&!s.government.defaultActive;
 press.borrowingRecovery=healthy?(previousChecked===s.month-1?(press.borrowingRecovery??0)+1:1):0;
 if(press.borrowingRecovery>=6)press.borrowingWarned=false;
 press.checkedMonth=s.month;press.seen??=[];press.lastByKey??={};
 if(s.metrics.reserveMonths>=3&&(s.metrics.debtServiceRevenue??0)<50)press.warningStage=0;
 const issue=newspaperCandidates(s).find(a=>!press.seen.includes(a.id)
  &&(a.key!=='warning'||a.stage>(press.warningStage??0))
  &&(a.key!=='borrowing'||!press.borrowingWarned)
  &&s.month-(press.lastByKey[a.key]??-10000)>=(a.key==='warning'?6:12)
  &&(a.priority>=95||s.month-(press.lastPopupMonth??-10000)>=6)
  &&(!press.pending||a.priority>=(press.issue?.priority??0)));
 if(!issue)return null;
 press.issue=issue;press.pending=true;press.lastPopupMonth=s.month;press.lastByKey[issue.key]=s.month;
 if(issue.key==='warning')press.warningStage=issue.stage;
 if(issue.key==='borrowing')press.borrowingWarned=true;
 press.seen=[...press.seen,issue.id].slice(-100);
 return issue;
}
export function newspaperDialog(issue,{esc,date}){
 // Also shorten issues already cached by an earlier interface version.
 const lead=issue.key==='warning'?'На выплаты по долгам уходит значительная часть доходов казны, а запас иностранной валюты остаётся низким.':issue.key==='budget'?'Поставщикам государства поступила лишь малая часть денег, предусмотренных на закупки.':issue.lead;
 return `<dialog id="world-news-dialog" class="newspaper-popup" aria-labelledby="world-news-heading"><article class="newspaper-sheet"><header class="newspaper-masthead"><span>Специальный выпуск</span><strong>Вестник республики</strong><div><span>Экономика и общество</span><time>${date(issue.month,true)}</time></div></header><div class="newspaper-rubric">${issue.priority>=95?'Экстренный выпуск':'Главное событие'}</div><h2 id="world-news-heading">${esc(issue.title)}</h2><p class="newspaper-lead">${esc(lead)}</p>${issue.body?`<p>${esc(issue.body)}</p>`:''}<footer><button data-action="world-news-close">К управлению <span aria-hidden="true">→</span></button></footer></article></dialog>`;
}

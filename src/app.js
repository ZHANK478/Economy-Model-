import {campaignEvent} from './campaign-events.js';
import {GOVERNMENT_PRESETS,COUNTRY_PRESETS,newGameOptions} from './start-presets.js';
import {validation} from './validation-results.js';
import {politicalValidation} from './political-validation-results.js';
import {extendedValidation} from './extended-validation-results.js';
import {createSimulation,advanceMonth,runMonths,comparePolicies,exportSimulation,importSimulation,accountBalances,scheduleShock,scheduleOwnership,scheduleNetwork,scheduleRestructuring,replayJournal,copy,sanitizePolicy,realInterestRate} from './engine.js';
import {VERSION,POLICY_FIELDS,POLICY_CHECKS,POLICY_CHOICES,PARAMETER_FIELDS,MODULES,SECTORS,BASE_POLICY,MODEL_PROFILES} from './config.js';
import {createBrowserStorage} from './storage.js';
import {extendedViews} from './extended-views.js';
import {politicalViews,handlePoliticalAction} from './political-views.js';
import {METRIC_INFO,budgetBalance,metricSeries,currentMetric,GROUP_DIMENSIONS,electorateSeries} from './dashboard-data.js';
import {PARTY_FAMILIES,partyDisplayName,FORMS,ELECTORAL_SYSTEMS,PRESIDENT_SYSTEMS,REGIMES} from './political-config.js';
import {createUIObservation} from './ui-observation.js';
import {presidentialStanding} from './political-reporting.js';
import {unresolvedInitiatives} from './political-agenda.js';
import {policyAuthority,executiveDescription,executePolitical,enableInstantPolitics,plannedPolicy,decisionBudget,assertDecisionAvailable} from './political-system.js';

const STORE='economy-model-v5',CHECKPOINT='economy-checkpoint-v5';
const storage=createBrowserStorage();
let legacySave=null;
try{legacySave=await storage.get('economy-model-v4')??await storage.get('economy-model-v31')??await storage.get('economy-model-v3')??localStorage.getItem('economy-model-v2')??localStorage.getItem('economy-model-v1');}catch{/* Do not overwrite inaccessible older data. */}
const app=document.getElementById('app');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(x,d=1)=>Number.isFinite(Number(x))?Number(x).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const signed=(x,d=1)=>(x>0?'+':'')+n(x,d);
const money=x=>n(x/1000,2);
const pct=x=>n(x,1)+'%';
const months=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const date=(month,short=false)=>short?`${String(month%12+1).padStart(2,'0')}.${(state.startYear??2026)+Math.floor(month/12)}`:`${months[month%12]} ${(state.startYear??2026)+Math.floor(month/12)}`;
const iconCheck='<span class="tick">✓</span>';
let state=createSimulation(newGameOptions()),draft=copy(state.policy),checkpoint=null,comparison=null;
let view='policy',policyTab=null,chartMetric='gdpPerCapitaReal',compareMetric='gdpPerCapitaReal',compareMonths=24,compareSource='current',journalPage=0;
let comparisonBase=null;
let campaignOpen=false,announcedCampaign=null,campaignFeedback=null,settingsOpen=false,proposalOpen=false,proposalId=null,announcedProposal=null,trendMetric=null,electorateDimension='age',electorateMeasure='party',electorateParty=null;
let openCategory='decisions',resultBillId=null,resultExecutive=null,observedDecisionKeys=new Set(),trackedView=null,trackedCategory=null,trackedPolicy=null,trackedWindows=new Set(),sectionObserver=null;
let usageStorage=null;try{usageStorage=globalThis.localStorage;}catch{}
const usage=createUIObservation({storage:usageStorage});
let mobileOpen=false,busy=false,toastTimer,saveStatus='Сохраняется на этом устройстве';
try {
  const saved=await storage.get(STORE);
  if(saved){const wrapper=JSON.parse(saved);state=importSimulation(wrapper.simulation);draft=sanitizePolicy(wrapper.draft);}
  const snap=await storage.get(CHECKPOINT);if(snap) checkpoint=importSimulation(snap);
} catch(e) {setTimeout(()=>toast('Не удалось прочитать сохранение. Открыты исходные условия.'),0);}
if(!state.politics.enabled){view='country';openCategory='statistics';}
if(state.politics.enabled){const edits=Object.fromEntries(Object.entries(draft).filter(([key,value])=>value!==state.policy[key]));enableInstantPolitics(state);if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.agendaSlots!==1)executePolitical(state,{kind:'setAgendaSlots',slots:1});if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.decisionLimit!==3)executePolitical(state,{kind:'setDecisionLimit',limit:3});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.dashboardMode)executePolitical(state,{kind:'setDashboardMode'});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.partyContinuity)executePolitical(state,{kind:'setPartyContinuity'});draft={...plannedPolicy(state),...edits};}

snapshotDecisions();
usage.context({seed:state.seed,startYear:state.startYear,month:state.month});usage.session();usage.visibility(document.visibilityState!=='hidden');usage.event('viewport',null,{width:globalThis.innerWidth??null,height:globalThis.innerHeight??null});

function toast(message) {
  const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);
}
function persist() {
  usage.flush();
  const simulation=JSON.stringify({format:'economy-model',version:VERSION,state});
  return storage.set(STORE,JSON.stringify({simulation,draft})).then(()=>{
    saveStatus='Сохранено на этом устройстве';const el=document.getElementById('save-status');if(el)el.textContent=saveStatus;
  }).catch(()=>{
    saveStatus='Нужно сохранить файл';const el=document.getElementById('save-status');if(el)el.textContent=saveStatus;
    toast('Браузер не сохранил состояние. Используйте «Сохранить файл».');
  });
}
function download(filename,content,type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const pending=()=>{const baseline=state.politics.enabled?plannedPolicy(state):state.policy;return Object.keys(draft).filter(key=>draft[key]!==baseline[key]);};
const previous=()=>state.history.find(x=>x.month===state.month-1)??state.metrics;

const chartOptions=[['gdpPerCapitaReal','ВВП / человек'],['inflationYoY','Инфляция'],['unemployment','Безработица'],['debtRatio','Госдолг'],['realGDPAnnualized','Общий ВВП'],['population','Население'],['giniDisposable','Джини'],['hdi','ИЧР']];
const metricNames={gdpPerCapitaReal:'Реальный ВВП на человека',inflationYoY:'Инфляция за 12 месяцев',unemployment:'Безработица',debtRatio:'Госдолг / ВВП',exchangeRate:'Курс валюты',realGDPAnnualized:'Общий реальный ВВП, млн в базовых ценах · годовой темп',population:'Население, млн',giniDisposable:'Джини располагаемых доходов · 0–100',hdi:'ИЧР · модельная оценка'};
function chart(series,key,{compare=false,compact=false,multi=false}={}) {
  const data=series.map(x=>({...x,points:x.points.filter(p=>p.month>=0&&Number.isFinite(p[key]))}));
  const points=data.flatMap(x=>x.points);
  if(points.length<2||new Set(points.map(p=>p.month)).size<2) return '<div class="chart-empty"><div><strong>Первое решение — начало графика</strong><br>Измените политику и перейдите к следующему месяцу.</div></div>';
  const narrow=Number.isFinite(globalThis.innerWidth)&&globalThis.innerWidth<=600;
  const W=narrow?360:compact?420:780,H=compact||narrow?220:260,left=52,right=18,top=18,bottom=36;
  let lo=Math.min(...points.map(p=>p[key])),hi=Math.max(...points.map(p=>p[key]));
  const padding=Math.max((hi-lo)*.15,key==='hdi'?.005:key==='gdpPerCapitaReal'?50:key==='exchangeRate'?.02:.5);
  lo-=padding;hi+=padding;
  const from=Math.min(...points.map(p=>p.month)),to=Math.max(...points.map(p=>p.month));
  const x=m=>left+(m-from)/(to-from)*(W-left-right);
  const y=v=>top+(hi-v)/(hi-lo)*(H-top-bottom);
  let out=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc((METRIC_INFO[key]?.label??metricNames[key]??'Поддержка избирателей'))}, помесячный график">`;
  for(let i=0;i<5;i++) {
    const val=lo+(hi-lo)*i/4,py=y(val);
    out+=`<line x1="${left}" y1="${py}" x2="${W-right}" y2="${py}" stroke="#e8effb"/><text x="${left-9}" y="${py+4}" text-anchor="end" fill="#456794" font-size="10">${n(val,key==='hdi'?3:key==='gdpPerCapitaReal'?0:1)}</text>`;
  }
  if(!compare&&data[0].points.length>1) {
    const line=data[0].points.map(p=>`${x(p.month)},${y(p[key])}`).join(' ');
    out+=`<defs><linearGradient id="chart-fill-${key}-${compact?'small':'large'}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#456794" stop-opacity=".24"/><stop offset="100%" stop-color="#456794" stop-opacity="0"/></linearGradient></defs><polygon points="${x(from)},${H-bottom} ${line} ${x(to)},${H-bottom}" fill="url(#chart-fill-${key}-${compact?'small':'large'})"/>`;
  }
  data.forEach((s,j)=>{
    const poly=s.points.map(p=>`${x(p.month)},${y(p[key])}`).join(' ');
    out+=`<polyline points="${poly}" fill="none" stroke="${j%2===0?'#174ca1':'#c52b39'}" stroke-width="2.4" ${j>1?`stroke-dasharray="${[3,7,2,5][(j-2)%4]} ${[3,3,6,6][(j-2)%4]}"`:''} ${j===0&&compare&&!multi?'stroke-dasharray="5 4"':''} stroke-linecap="round" stroke-linejoin="round"/>`;
    const end=s.points.at(-1);if(end) out+=`<circle cx="${x(end.month)}" cy="${y(end[key])}" r="3.5" fill="${j%2===0?'#174ca1':'#c52b39'}" stroke="white" stroke-width="2"/>`;
  });
  for(let i=0;i<5;i++) {const month=Math.round(from+(to-from)*i/4);out+=`<text x="${x(month)}" y="${H-10}" fill="#456794" text-anchor="middle" font-size="10">${date(month,true)}</text>`;}
  const first=data[0].points;
  first.forEach((p,i)=>{
    const next=first[i+1],before=first[i-1];const width=Math.max(6,((next?x(next.month):W-right)-(before?x(before.month):left))/2);
    const values=data.map(ds=>{const v=ds.points.find(z=>z.month===p.month);return v?`${ds.name}: ${n(v[key],key==='hdi'?3:key==='gdpPerCapitaReal'?0:1)}`:'';}).filter(Boolean).join(' · ');
    out+=`<rect data-chart-tip="${esc(date(p.month)+' · '+values)}" x="${x(p.month)-width/2}" y="${top}" width="${width}" height="${H-top-bottom}" fill="transparent"><title>${esc(date(p.month)+' · '+values)}</title></rect>`;
  });
  return out+'</svg><div class="chart-tip"></div>';
}
function spark(key) {
  const pts=state.history.filter(x=>x.month>=0).slice(-18);if(pts.length<2) return '';
  const values=pts.map(p=>p[key]),lo=Math.min(...values),hi=Math.max(...values),range=Math.max(hi-lo,.001);
  const points=values.map((v,i)=>`${i/(values.length-1)*65},${26-(v-lo)/range*23}`).join(' ');
  return `<svg class="spark" viewBox="0 0 65 29" aria-hidden="true"><polyline points="${points}" fill="none" stroke="#456794" stroke-width="1.4"/></svg>`;
}
function cards() {
  const m=state.metrics,prev=previous();
  const data=[
    ['gdpPerCapitaReal','Реальный ВВП / человек',n(m.gdpPerCapitaReal,0),'$ базы',true,false],
    ['realGDPAnnualized','Общий реальный ВВП',money(m.realGDPAnnualized),'млрд $ базы / год',true,false],
    ['population','Население',n(m.population,3),'млн человек',true,false],
    ['inflationYoY','Инфляция за 12 месяцев',n(m.inflationYoY,1),'%',false,true],
    ['unemployment','Безработица',n(m.unemployment,1),'%',false,true],
    ['realIncomeIndex','Реальные доходы',n(m.realIncomeIndex,1),'индекс',true,false],
    ['gdpGrowthYoY','Рост реального ВВП',signed(m.gdpGrowthYoY,1),'% г/г',true,true],
    ['exchangeRate','Национальная валюта',n(m.exchangeRate,3),'ед. / $',false,false],
    ['deficitRatio','Дефицит бюджета',signed(m.deficitRatio,1),'% ВВП',false,true],
    ['debtRatio','Государственный долг',n(m.debtRatio,1),'% ВВП',false,true],
    ['giniDisposable','Джини доходов',n(m.giniDisposable,1),'из 100',false,false],
    ['hdi','ИЧР · модельная оценка',n(m.hdi,3),'из 1',true,false]
  ];
  const allCards=data.map(([key,name,value,unit,higher,pp])=>{
    const delta=m[key]-prev[key],color=state.month===0||Math.abs(delta)<.001?'neutral':((delta>0)===higher?'positive':'negative');
    const formatted=state.month===0?'Исходные условия':`${signed(delta,key==='exchangeRate'?3:1)} ${pp?'п.п.':''} за ход`;
    return `<div class="kpi"><div class="name">${name}</div><div class="value">${value} <span class="unit">${unit}</span></div><div class="change ${color}">${formatted}</div>${spark(key)}</div>`;
  });
  return '<div class="kpis">'+allCards.slice(0,6).join('')+'</div><details class="more-indicators"><summary>Ещё показатели страны</summary><div class="kpis">'+allCards.slice(6).join('')+'</div></details>';
}
function policyControls() {
  const locked=state.politics.enabled&&decisionBudget(state).optionalRemaining===0;
  const applicable=key=>!(key==='rate'&&draft.monetaryRegime!=='discretion')&&!(key==='inflationTarget'&&!['discretion','rule'].includes(draft.monetaryRegime))&&!(key==='energyTariff'&&draft.energyPricing==='market')&&!(key==='fxIntervention'&&['currencyBoard','dollarized'].includes(draft.monetaryRegime))&&!(key==='infrastructureFeeCap'&&draft.infrastructurePricing!=='capped');
  const authority=key=>state.politics.enabled?`<span class="authority-tag">${({law:'Закон',constitution:'Конституционный закон',executive:'Исполнительная власть',centralBank:'Независимый ЦБ'})[policyAuthority(state,key)]}</span>`:'';
  return (state.politics.enabled&&state.politics.constitution.independentCB&&policyTab==='Кредит'?`<div class="callout dark-callout">Независимый ЦБ рассчитывает ставку: ${pct(state.monetary.effectiveRate)}. Исполнительная власть задаёт мандат законом. Для прямого управления ставкой измените правило независимости в разделе «Конституция».</div>`:'')+POLICY_CHOICES.filter(x=>x[2]===policyTab).map(([key,label,,choices,help])=>`<label class="field policy-choice">${esc(label)} ${authority(key)}<select data-policy-choice="${key}" ${locked?'disabled':''}>${choices.map(([value,name])=>`<option value="${value}" ${draft[key]===value?'selected':''}>${esc(name)}</option>`).join('')}</select><span class="policy-help">${esc(help)}</span></label>`).join('')+POLICY_FIELDS.filter(x=>x[6]===policyTab&&applicable(x[0])&&policyAuthority(state,x[0])!=='centralBank').map(([key,name,min,max,step,unit,,help])=>`
    <div class="policy-control"><div class="control-title"><label for="policy-${key}">${name} ${authority(key)}</label><output class="control-value" id="value-${key}">${n(draft[key],step<1?2:0)}</output></div>

    <div class="control-meta"><span>${esc(unit)}</span><input id="policy-${key}" type="number" class="number-entry" min="${min}" max="${max}" step="${step}" value="${draft[key]}" data-policy-number="${key}" ${locked?'disabled':''} aria-label="${name}, точное значение"></div>
    <div class="policy-help">${help}</div></div>`).join('');
}
function draftBaseRate(){
  if(state.politics.enabled)return state.monetary.effectiveRate;
  const regime=draft.monetaryRegime;
  return regime==='discretion'?draft.rate:regime==='rule'?Math.max(0,Math.min(40,state.parameters.neutralRealRate*100+draft.inflationTarget+1.5*(state.metrics.inflationYoY-draft.inflationTarget)+.5*state.metrics.outputGap)):['currencyBoard','dollarized'].includes(regime)?state.world.globalRate:Math.max(0,Math.min(40,state.world.globalRate+state.expectedInflation*100-2+Math.max(0,25-state.metrics.bankLiquidity)*.08));
}
function sidebar() {
  const changes=pending();
  const stopped=state.politics.enabled&&!state.politics.executive.inOffice;
  const body=`    <div id="policy-controls">${policyControls()}</div>
    <div class="policy-checks">${POLICY_CHECKS.filter(f=>f[2]===policyTab&&(f[0]!=='liquiditySupport'||['discretion','rule'].includes(draft.monetaryRegime))).map(([key,label,,help])=>`<label class="check"><input type="checkbox" data-policy-check="${key}" ${state.politics.enabled&&decisionBudget(state).optionalRemaining===0?'disabled':''} ${draft[key]?'checked':''}> ${esc(label)}${state.politics.enabled?`<small class="authority-tag">${({law:'Закон',constitution:'Конституционный закон',executive:'Исполнительная власть',centralBank:'Независимый ЦБ'})[policyAuthority(state,key)]}</small>`:''}</label><p class="policy-help">${esc(help)}</p>`).join('')}</div>
    ${policyTab==='Структура'?'<p class="small muted">Здесь задаются правила и бюджеты. Фактические сроки, исполнение и управление — в разделе «Институты», их нельзя установить ползунком.</p>':''}
`;
  return `<aside class="sidebar policy-panel"><div class="sidebar-head"><div><span class="eyebrow">ВАША РОЛЬ · ${state.politics.enabled?'ИСПОЛНИТЕЛЬНАЯ ВЛАСТЬ':'ГОСУДАРСТВО'}</span><h2>Экономическая политика</h2></div>${mobileOpen?'<button class="dark-button" data-action="controls" aria-label="Закрыть">×</button>':''}</div>
    <p class="small muted">${state.politics.enabled?esc(executiveDescription(state))+'<br>Выберите значение — голосование и результат появятся сразу.':'Решения действуют со следующего месяца. Реакция экономики занимает время.'}</p>
    <div class="policy-tabs">${['Кредит','Налоги','Бюджет','Валюта','Структура','Инфраструктура','Услуги','Труд','Институты'].map(t=>`<section class="policy-topic"><button data-policy-tab="${t}" class="${t===policyTab?'active':''}" aria-expanded="${t===policyTab}">${t} <span aria-hidden="true">${t===policyTab?'−':'+'}</span></button>${t===policyTab?body:''}</section>`).join('')}</div>
    <div class="policy-foot"><div class="policy-summary"><span>Ожидаемая реальная базовая ставка</span><strong id="real-rate">${n(realInterestRate(draftBaseRate()/100,state.expectedInflation)*100,1)}%</strong></div>
      <div id="pending-note" class="policy-pending">${changes.length?`Изменено решений: ${changes.length}`:'Текущая политика сохранена'}</div>
      <details class="sidebar-more"><summary>Другие действия</summary>
      <button class="secondary wide" data-action="cancel-policy" id="cancel-policy" ${changes.length?'':'disabled'}>Сбросить неподтверждённый ввод</button>
      <label class="field">Гипотеза или причина решения<textarea id="decision-note" data-note maxlength="1000" placeholder="Например: снизить инфляцию, сохранив занятость">${esc(state.pendingNote)}</textarea></label>
      </details></div></aside>`;
}
const ROW_GRAPHS={'ВВП · номинальный':'gdpUSDRolling','ВВП · реальный':'realGDPRolling','Инфляция':'inflationYoY','Безработица':'unemployment','Население':'population','Средняя зарплата · до налогов':'meanWageNominal','Средняя реальная зарплата':'meanWageReal','ИЧР · модельная оценка':'hdi','Джини · после налогов и трансфертов':'giniDisposable','Джини · до перераспределения':'giniMarket','Ожидаемая продолжительность жизни':'lifeExpectancy','Рождаемость':'totalFertilityRate','Государственный долг':'debtRatio','Валютные резервы':'reservesUSD'};
const graphButton=key=>`<button class="graph-button" data-graph="${key}" aria-label="Динамика: ${esc(METRIC_INFO[key]?.label??key)}" title="Открыть график"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18M6 15l5-5 4 3 5-8" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>`;
function row(label,value,meta='') {return `<div class="data-row"><div>${label}${meta?`<div class="meta">${meta}</div>`:''}</div><div class="row-value"><b>${value}</b>${ROW_GRAPHS[label]?graphButton(ROW_GRAPHS[label]):''}</div></div>`;}
function bar(label,value,display,color='#a8bce0') {return `<div class="bar-row"><div class="bar-title"><span>${label}</span><b>${display}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,value))}%;background:${color}"></div></div></div>`;}
function country() {
  const m=state.metrics,annualPopulation=state.history.filter(r=>r.month>=state.month-11).reduce((v,r)=>v+r.population,0)/12;
  const development=m.hdi>=.8?'очень высокий':m.hdi>=.7?'высокий':m.hdi>=.55?'средний':'низкий';
  return `<section class="panel country-lead"><span class="eyebrow">ПАСПОРТ СТРАНЫ · ${date(state.month,true)}</span><h2>Вымышленная республика</h2><p>${state.resourceMode?'Страна с большой ролью сырьевого экспорта':'Страна с диверсифицированным экспортом'}, население ${n(m.population,2)} млн человек. Реальный выпуск на человека — ${n(m.gdpPerCapitaReal,0)} в ценах начала игры. Модельный уровень человеческого развития — ${development}.</p><p class="small muted">Это справочник о вашей стране, не официальный рейтинг. Денежные величины в базовых ценах, текущих долларах и по условному ППС различаются.</p></section>
    <div class="two-cols"><section class="panel"><h2>Экономика</h2>${row('ВВП · номинальный',money(m.gdpUSDRolling)+' млрд $','Последние 12 месяцев, каждый поток по курсу своего месяца')}${row('ВВП на человека · номинальный',n(m.gdpUSDRolling/annualPopulation,0)+' $ / год','Годовой ВВП / среднее население последних 12 месяцев')}${row('ВВП · реальный',money(m.realGDPRolling)+' млрд $ базы','Последние 12 месяцев, постоянные цены ${state.startYear??2026} года')}${row('ВВП на человека · реальный',n(m.realGDPRolling/annualPopulation,0)+' $ базы / год')}${row('ВВП по условному ППС',money(m.realGDPRolling*state.parameters.pppConversionFactor)+' млрд','Условный коэффициент ППС, не обследование цен')}${row('Рост реального ВВП',pct(m.gdpGrowthYoY),'Последний месяц к тому же месяцу год назад')}${row('Инфляция',pct(m.inflationYoY),'Изменение потребительских цен за 12 месяцев')}${row('Безработица',pct(m.unemployment))}${row('Средняя зарплата · до налогов',n(m.meanWageNominal,0)+' ед. / месяц',n(m.meanWageUSD,0)+' $ по текущему курсу; фонд оплаты / занятые')}${row('Средняя реальная зарплата',n(m.meanWageReal,0)+' $ базы / месяц')}${row('Медианный эквивалентный доход',n(m.medianEquivalentIncomeReal,0)+' $ базы / месяц','После налогов и трансфертов; с поправкой на размер семьи')}</section>
    <section class="panel"><h2>Люди и качество жизни</h2>${row('Население',n(m.population,3)+' млн')}${row('Ожидаемая продолжительность жизни',n(m.lifeExpectancy,1)+' лет')}${row('Рождаемость',n(m.totalFertilityRate,2)+' детей / женщину')}${row('Доля населения 65+',pct(m.elderlyShare))}${row('Средние годы обучения взрослых',n(m.meanSchooling,1)+' лет')}${row('Ожидаемые годы обучения детей',n(m.expectedSchooling,1)+' лет')}${row('ИЧР · модельная оценка',n(m.hdi,3),'Формула UNDP; образование и ВНД по ППС — условные входы')}${row('Джини · после налогов и трансфертов',n(m.giniDisposable,1)+' / 100','Меньше — равномернее; расчёт по 10 группам за 12 месяцев')}${row('Джини · до перераспределения',n(m.giniMarket,1)+' / 100')}${row('Относительная бедность',pct(m.relativePoverty),'Доход ниже 50% медианного эквивалентного дохода')}${row('Фиксированный порог бедности',pct(m.absolutePoverty),'Ниже '+n(state.parameters.absolutePovertyRealMonthly,0)+' $ базы / человек / месяц; не международный порог')}${row('Доля доходов верхних 10%',pct(m.top10IncomeShare))}${row('Доля богатства верхних 10%',pct(m.top10WealthShare),'С учётом депозитов, долгов и долей предприятий')}</section></div>
    <section class="panel" style="margin-top:15px"><h2>Финансы и устройство экономики</h2><div class="two-cols"><div>${row('Государственный долг',pct(m.debtRatio)+' ВВП')}${row('Баланс бюджета',m.deficitRatio>0?'Дефицит '+pct(m.deficitRatio):'Профицит '+pct(-m.deficitRatio))}${row('Валютные резервы',money(m.reservesUSD)+' млрд $')}${row('Сырьевой фонд',money(m.fundUSD)+' млрд $')}${row('Эпизоды суверенного дефолта',n(m.defaultEpisodes??0,0),state.government.defaultActive?'Сейчас есть непогашенный дефолт':'Текущие платежи исполняются или проведён обмен')}</div><div>${row('Государственная доля активов предприятий',pct(m.stateAssetShare))}${row('Иностранная доля активов',pct(m.foreignAssetShare))}${row('Отечественная частная доля активов',pct(100-m.stateAssetShare-m.foreignAssetShare))}${row('Государственная доля выпуска',pct(m.stateOutputShare),'Взвешенная по добавленной стоимости, не по количеству предприятий')}${row('Профиль допущений',esc(MODEL_PROFILES[state.modelProfile].name))}</div></div><div class="callout" style="margin-top:15px">Джини — приближение по группам; различия внутри групп не наблюдаются. ИЧР использует правильную структуру индекса, но модельные данные. Площадь, столица и международное место не выдумываются.</div></section>`;
}
function ownershipView() {
  return `<section class="panel"><span class="eyebrow">ГОСУДАРСТВО КАК СОБСТВЕННИК</span><h2>Собственность и эффективность</h2><p class="small muted">Смена собственника не создаёт выпуск. Эффективность меняется через управление, конкуренцию, инвестиции и реорганизацию; знак эффекта не задан самим названием собственника.</p><div class="table-wrap"><table class="table"><thead><tr><th>Отрасль</th><th>Государство</th><th>Частные отечественные</th><th>Иностранные</th><th>Муниципальные</th><th>Работников</th><th>Управление / 100</th><th>Эффективность, начало = 100</th></tr></thead><tbody>${state.firms.map(f=>`<tr><td>${esc(f.name)}</td><td>${pct(f.ownership.state*100)}</td><td>${pct(f.ownership.domestic*100)}</td><td>${pct(f.ownership.foreign*100)}</td><td>${pct(f.ownership.municipal*100)}</td><td>${pct(f.ownership.cooperative*100)}</td><td>${n(f.governance*100,1)}</td><td>${n(f.managementEfficiency*100,1)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel"><h2>Запланировать операцию</h2><div class="world-grid"><label class="field">Отрасль<select id="ownership-sector">${state.firms.map((f,i)=>`<option value="${i}">${esc(f.name)}</option>`).join('')}</select></label><label class="field">Действие<select id="ownership-kind"><option value="purchase">Купить долю государству</option><option value="privatize">Продать отечественным инвесторам</option><option value="foreignSale">Продать иностранным инвесторам</option><option value="cooperatize">Продать долю кооперативу работников</option><option value="municipalize">Передать долю муниципалитетам</option><option value="nationalize">Национализировать</option><option value="recapitalize">Внести капитал за новую долю</option></select></label><label class="field">Доля, процентных пунктов<input id="ownership-points" type="number" min="1" max="100" value="10"></label><label class="field">Компенсация при национализации, %<input id="ownership-compensation" type="number" min="0" max="100" value="100"></label></div><button data-action="ownership-queue">${state.politics.enabled?'Голосовать по операции':'Запланировать со следующего месяца'}</button>${queuedActions()}</section>`;
}
function queuedActions() {
  return state.pendingActions.length?`<div class="callout">Операции следующего месяца:<br>${state.pendingActions.map(a=>`${a.kind==='restructure'?'Реструктуризация долга':esc(a.network?state.networks.find(n=>n.id===a.network)?.name:state.firms[a.sector].name)+' · '+esc(actionName(a.kind))+' · '+n(a.points,0)+' п.п.'} <button data-cancel-action="${a.id}">Отменить</button>`).join('<br>')}</div>`:'';
}
const actionName=kind=>({purchase:'Покупка государственной доли',privatize:'Приватизация',nationalize:'Национализация',recapitalize:'Рекапитализация',foreignSale:'Продажа иностранному инвестору',cooperatize:'Выкуп работниками',municipalize:'Передача муниципалитетам',networkSale:'Продажа фонда оператору',networkPurchase:'Выкуп фонда государством',networkMunicipalize:'Передача фонда муниципалитетам',restructure:'Обмен государственного долга',refinance:'Рефинансирование'})[kind]??kind;
const reasonName=key=>({'judicial-review':'судебный контроль: неполная компенсация','cooperative-entry':'кооперативная форма запрещена','infrastructure-entry':'вход операторов закрыт','investor-return':'ожидаемая доходность ниже требуемой',parliament:'недостаточно парламентской поддержки'})[key]??key;
const CONSTITUTION_LABELS={form:'Форма правления',playerRole:'Должность игрока',regime:'Исходный режим',electoralSystem:'Выборы парламента',presidentSystem:'Выборы президента',seats:'Число депутатов',threshold:'Избирательный порог',parliamentTerm:'Срок парламента',presidentTerm:'Срок президента',parliamentOffset:'Календарь парламента',confidence:'Вотум недоверия',independentCB:'Независимость центрального банка',presidentialVeto:'Вето президента',overrideFraction:'Порог преодоления вето',constitutionalFraction:'Порог конституционной поправки',constitutionalReferendum:'Обязательный референдум',dissolution:'Право роспуска парламента',termLimit:'Предел личных президентских сроков',budgetContinuity:'Продолжение бюджета',naturalizationYears:'Проживание до гражданства',localResidentVote:'Местное голосование жителей',emergencyMonths:'Срок чрезвычайного положения'};
const decisionName=key=>CONSTITUTION_LABELS[key.replace('constitution.','')]??POLICY_FIELDS.find(f=>f[0]===key)?.[1]??POLICY_CHECKS.find(f=>f[0]===key)?.[1]??POLICY_CHOICES.find(f=>f[0]===key)?.[1]??PARAMETER_FIELDS.find(f=>f[0]===key)?.[1]??key;
function institutionsView() {
  const m=state.metrics,f=state.lastReport.fiscal,i=state.institutions;
  const serviceRows=[['antitrust','Регистрация и надзор','antitrustBudget','antitrustCapacity'],['courts','Суды и реестр','courtBudget','courtCapacity'],['soeAudits','Аудит госпредприятий','soeAuditBudget','soeAuditCapacity']];
  return `<section class="panel"><span class="eyebrow">РЕШЕНИЯ ≠ РЕЗУЛЬТАТЫ</span><h2>Как исполняются ваши правила</h2><p>Вы устанавливаете бюджеты, процедуры и правила назначения. Ниже — получившиеся результаты. Расходы не покупают качество мгновенно: имеют значение оплаченные услуги, накопленная способность исполнения и правовые последствия ваших действий.</p><div class="callout warning">Это условные показатели модели, не официальные индексы. Здесь пять агрегированных отраслей и один сводный банк: число конкурентов, HHI и рыночную концентрацию мы не наблюдаем.</div></section>
    <div class="two-cols"><section class="panel"><h2>Доступ и договоры</h2>${row('Обязательные процедуры',n(state.policy.registrationProcedures,0),'Ваше действующее правовое решение')}${row('Фактический срок регистрации',n(m.registrationDays,1)+' дней','Условная оценка: процедуры × время их исполнения')}${row('Срок исполнения договоров',n(m.contractDelayDays,0)+' дней','Условная оценка, не статистика судов')}${row('Надёжность исполнения',n(m.contractReliability,1)+' / 100','Результат судебной способности и риска изъятия')}${row('Риск изъятия без компенсации',n(i.ownershipRisk*100,1)+' / 100')}${row('Доступность конкуренции',n(m.marketContestability,1)+' / 100','Агрегированный proxy; не HHI и не число фирм')}</section>
    <section class="panel"><h2>Банки и управление</h2>${row('Возможность входа / смены банка',n(m.bankContestability,1)+' / 100','Результат правил, доверия, рисков и состояния банков')}${row('Депозитная ставка',pct(m.depositRate)+' / год','Ограничена доходностью активов и стоимостью фондирования')}${row('Разница кредитной и депозитной ставок',n(m.lendingRate-m.depositRate,1)+' п.п.','Это не чистая прибыль банка: есть риски и расходы')}${row('Аудиторская способность',n(m.soeAuditCapacity,1)+' / 100','Оплаченные услуги относительно размера государственного портфеля')}${row('Независимые проверки',state.policy.independentSoeAudit?'Включены':'Не предусмотрены')}${row('Управление предприятиями','По отраслям','В разделе «Собственность»; одинаковый собственник не гарантирует одинаковую эффективность')}</section></div>
    <section class="panel"><h2>Обещанный бюджет и оплаченные услуги</h2><p class="small muted">Млн национальной валюты за последний месяц. Уже входят в государственные закупки; не добавляются к ВВП повторно. Способность накапливается примерно за два года; качество управления — ещё медленнее.</p><div class="table-wrap"><table class="table"><thead><tr><th>Направление</th><th>Годовая доля ВВП</th><th>План месяца</th><th>Оплачено</th><th>Накопленная способность / 100</th></tr></thead><tbody>${serviceRows.map(([key,label,budget,capacity])=>`<tr><td>${label}</td><td>${n(state.policy[budget],3)}%</td><td>${n(f.institutionRequested?.[key]??0,2)}</td><td>${n(f[key]??0,2)}</td><td>${n(i[capacity]*100,1)}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Недостаток финансирования и производства уменьшает фактическое исполнение. Увеличение средств имеет убывающую отдачу и не гарантирует успех.</p></section>
    <section class="panel"><h2>Можно ли «всё хорошее» включить сразу?</h2><p>Можно принять несколько полезных правил одновременно. Модель не выдумывает штраф за защиту собственности или отмену ненужного барьера. Но принятие правила не равно исполнению, а большие бюджеты требуют ресурсов и финансирования. Отдача ограничена и зависит от допущений.</p><p><a href="./docs/INSTITUTIONS.md" target="_blank" rel="noopener">Формулы, исследования и возражения Мизеса и Хайека</a>. В разделе «Модель» можно обнулить отдачу бюджетных программ и институциональные эффекты. Сами расходы при этом остаются расходами.</p></section>`;
}
function journalView() {
  const current=state.politics.enabled&&state.politics.turnCommands?.length?`<section class="panel"><h2>Решения текущего месяца</h2><p class="small muted">Уже рассмотрены, месяц ещё не завершён. Эти решения сохраняются в файле и войдут в месячную запись.</p>${(state.politics.turnActions??[]).filter(a=>['instantBillDecision','executiveDecision','initiativeResponse','coalitionOffer','coalitionExit'].includes(a.kind)).map(a=>{const b=state.politics.bills.find(b=>b.id===a.billId);return `<p class="small">${a.kind==='instantBillDecision'?esc(b?.title??'Закон №'+a.billId)+' · '+esc(({passed:'Принят',rejected:'Отклонён парламентом',vetoed:'Вето',declined:'Отказ'})[a.status]??a.status):a.kind==='executiveDecision'?esc(decisionName(a.key))+': '+esc(policyValue(a.key,a.from))+' → '+esc(policyValue(a.key,a.to)):a.kind==='initiativeResponse'?'Лояльность партии: '+pct(a.before*100)+' → '+pct(a.after*100):a.kind==='coalitionExit'?'Партия вышла из коалиции':'Предложение коалиции: '+(a.accepted?'принято':'отклонено')}</p>`;}).join('')}<details class="method-details"><summary>Полная запись текущих решений</summary><pre class="journal-json">${esc(JSON.stringify(state.politics.turnCommands,null,2))}</pre></details></section>`:'';

  const end=state.journal.length-journalPage*24,start=Math.max(0,end-24),entries=state.journal.slice(start,Math.max(0,end)).reverse();
  return current+`<section class="panel"><span class="eyebrow">ИСТОРИЯ · ПОЛНЫЕ ПРИМЕНЁННЫЕ РЕШЕНИЯ</span><h2>Журнал эксперимента</h2><p class="small muted">Каждый ход содержит всю политику, параметры, внешние условия, фактически выполненные операции и результаты. «+12 месяцев» записывает 12 отдельных ходов. Непроведённый черновик сохраняется отдельно в файле.</p><div class="section-actions"><button data-action="journal-export">Скачать журнал JSON</button><button data-action="replay" ${busy?'disabled':''}>Проверить воспроизведение</button><button data-journal-page="${Math.max(0,journalPage-1)}" ${journalPage===0?'disabled':''}>Более новые</button><button data-journal-page="${journalPage+1}" ${start===0?'disabled':''}>Более старые</button></div>${entries.length?entries.map(e=>`<details class="journal-entry"><summary><strong>${date(e.month,true)}</strong><span>${e.policyChanges.length} изменений политики · ${e.actions.length} операций · инфляция ${pct(e.outcome.inflationYoY)}</span></summary>${e.note?`<p>${esc(e.note)}</p>`:''}${e.policyReview?.length?`<div class="callout warning">Предложения и ограничения: ${e.policyReview.map(r=>esc(decisionName(r.key))+' · '+esc(r.requested)+' → '+esc(r.accepted)).join('; ')}</div>`:''}<p class="small">${e.policyChanges.map(c=>`${esc(decisionName(c.key))}: ${esc(c.from)} → ${esc(c.to)}`).join('<br>')||'Политика сохранена без изменений.'}</p>${e.parameterChanges.length?`<p class="small">Допущения: ${e.parameterChanges.map(c=>`${esc(decisionName(c.key))}: ${esc(c.from)} → ${esc(c.to)}`).join('; ')}</p>`:''}${e.actions.map(a=>`<p class="small">${esc(actionName(a.kind))}: ${a.network?esc(state.networks.find(n=>n.id===a.network)?.name):a.sector!==undefined?esc(state.firms[a.sector].name):'государственный долг'} · ${a.rejected?'Отклонено: '+esc(reasonName(a.reason)):a.cost!==undefined?n(a.cost,0)+' млн':n(a.haircut*100,0)+'% списание'}</p>`).join('')}<p class="small muted">${e.events.map(esc).join('<br>')||'Без дополнительных событий.'}</p><details class="method-details"><summary>Полные решения и условия этого месяца</summary><pre class="journal-json">${esc(JSON.stringify({requestedPolicy:e.requestedPolicy,policy:e.policy,review:e.policyReview,parameters:e.parameters,world:e.world,shocks:e.shocks,submittedActions:e.submittedActions,politicalCommands:e.politicalCommands,turnPoliticalCommands:e.turnPoliticalCommands,politicalResults:e.politicalResults,elections:e.politicalElections,rollCalls:e.politicalRollCalls,politicalState:e.politicalState},null,2))}</pre></details></details>`).join(''):'<p class="muted">Первый месячный ход начнёт журнал.</p>'}<div class="callout" style="margin-top:15px">Версия ${VERSION}, seed ${state.seed}. Совпадение воспроизведения проверяет вычисления, но не доказывает причинность. Для отдельной гипотезы используйте одинаковые условия в A/B.</div></section>`;
}
function chartPanel() {
  return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">ДИНАМИКА ЭКОНОМИКИ</span><h2>${metricNames[chartMetric]}</h2><span class="muted small">Каждая точка — один месяц</span></div><div class="pill-group">${chartOptions.map(([key,label])=>`<button class="${chartMetric===key?'active':''}" data-chart="${key}">${label}</button>`).join('')}</div></div>
    <div class="chart-wrap">${chart([{name:'Экономика',points:state.history}],chartMetric)}</div><div class="chart-legend"><span><span class="legend-line"></span>Ваш эксперимент</span><span>${state.month} ${state.month===1?'месяц':'мес.'} · ${state.stochastic?'Внешние колебания включены':'Без случайных шоков'}</span></div></section>`;
}
function report() {
  if(state.month===0) return `<ol class="report-list"><li><div class="report-number">01</div><div><strong>Выберите экономическую гипотезу</strong><span>Например, предложите изменение налога и проведите закон в разделе «Власть и законы». В лаборатории решения применяются напрямую.</span></div></li><li><div class="report-number">02</div><div><strong>Перейдите к следующему месяцу</strong><span>Сравните инфляцию, спрос, занятость и курс. Последствия накапливаются.</span></div></li><li><div class="report-number">03</div><div><strong>Сравните два пути</strong><span>Одинаковые исходные условия и внешние шоки, разная государственная политика.</span></div></li></ol>`;
  const r=state.lastReport,m=state.metrics;
  const items=[
    [`Выпуск: ${signed(r.changes.gdp,1)}% за месяц`,`Потребление ${n(m.consumption,0)}, инвестиции ${n(m.investment,0)}, госзакупки ${n(m.governmentPurchases,0)} млн в базовых ценах.`],
    [`Цены: ${signed(m.inflationMonthly,2)}% за месяц`,`За 12 месяцев ${pct(m.inflationYoY)}. Ожидания: ${pct(m.expectedInflation)}; кредитная ставка: ${pct(m.lendingRate)}.`],
    [`Валюта: ${signed(r.changes.exchange,2)}% к доллару`,`Текущий счёт: ${signed(r.external.currentAccountUSD,0)} млн $. Резервов на ${n(m.reserveMonths,1)} месяца импорта.`]
  ];
  return '<ol class="report-list">'+items.map(([title,body],i)=>`<li><div class="report-number">0${i+1}</div><div><strong>${title}</strong><span>${body}</span></div></li>`).join('')+'</ol>';
}
function overview() {
  const m=state.metrics;
  return `<section class="panel" style="margin-bottom:20px"><h2>Общий ВВП страны</h2><div class="two-cols"><div>${row('Реальный ВВП · последние 12 месяцев',money(m.realGDPRolling)+' млрд $ базы')}${row('Реальный ВВП · текущий годовой темп',money(m.realGDPAnnualized)+' млрд $ базы','Последний месячный выпуск × 12')}</div><div>${row('Номинальный ВВП · последние 12 месяцев',money(m.nominalGDPAnnual)+' млрд нац. валюты')}${row('ВВП в долларах · последние 12 месяцев',money(m.gdpUSDRolling)+' млрд $','Каждый месячный поток пересчитан по курсу своего месяца')}</div></div></section>`+chartPanel()+`<div class="two-cols"><section class="panel"><div class="panel-head"><h2>Отчёт за месяц</h2><span class="eyebrow">${date(state.month,true)}</span></div>${report()}</section>
    <section class="panel"><div class="panel-head"><h2>Устойчивость</h2><span class="badge">${state.resourceMode?'Сырьевой экспорт':'Диверсификация'}</span></div>
    ${bar('Резервы / месяцы импорта',m.reserveMonths/12*100,n(m.reserveMonths,1)+' мес.')}
    ${bar('Капитал банков / норматив',m.capitalRatio/state.policy.bankCapitalRequirement/2*100,pct(m.capitalRatio/state.policy.bankCapitalRequirement*100),m.capitalRatio<state.policy.bankCapitalRequirement?'#c52b39':'#a8bce0')}
    ${bar('Исполнение конечных заказов',m.fulfillment,pct(m.fulfillment))}
    ${bar('Доверие к политике',m.confidence,n(m.confidence,0)+' / 100')}
    <div class="audit-ok" style="margin-top:20px">${iconCheck} Балансы сходятся · погрешность ${n(m.auditError,8)} млн</div></section></div>
    ${state.lastReport.events.length?`<div class="callout warning" style="margin-top:15px"><strong>События и ограничения</strong>${state.lastReport.events.slice(0,5).map(esc).join('<br>')}</div>`:''}`;
}
function economy() {
  const m=state.metrics,r=state.lastReport;
  return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">РЕАЛЬНЫЙ СЕКТОР</span><h2>Производство и мощности</h2></div><span class="muted small">Объёмы: млн в базовых ценах</span></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Отрасль</th><th>Выпуск</th><th>Загрузка</th><th>Работники, тыс.</th><th>Запасы</th><th>Цены, индекс</th></tr></thead><tbody>${state.firms.map((f,i)=>`<tr><td><span class="sector-color" style="background:${SECTORS[i].color}"></span>${esc(f.name)}</td><td>${n(f.production,0)}</td><td>${pct(f.utilization*100)}</td><td>${n(f.workers*1000,0)}</td><td>${n(f.inventory,0)}</td><td>${n(f.price*100,1)}</td></tr>`).join('')}</tbody></table></div></section>
    <div class="two-cols"><section class="panel"><h2>ВВП по расходам</h2><p class="small muted">Млрд национальной валюты за месяц. Трансферты не прибавляются к ВВП.</p>
      ${row('Потребление',money(r.gdp?.consumption??m.consumption)+' млрд')}${row('Инвестиции',money(r.gdp?.investment??m.investment)+' млрд')}${row('Государственные закупки',money(r.gdp?.government??m.governmentPurchases)+' млрд')}${row('Экспорт',money(r.gdp?.exports??m.exports)+' млрд')}${row('− Импорт',money(r.gdp?.imports??m.imports)+' млрд')}${row('Изменение запасов',money(r.gdp?.inventories??0)+' млрд')}${row('Номинальный ВВП',money(m.nominalGDPMonthly)+' млрд')}
    </section><section class="panel"><h2>Будущий выпуск</h2>${row('ВВП: разрыв с потенциалом',signed(m.outputGap,1)+'%')}${row('Производительность',n(m.productivity,1),'Индекс начала = 100')}${row('Инфраструктура',n(m.infrastructure,1),'Реальный запас с учётом износа')}${row('Квалификация',n(m.skills,1))}${row('Введено капитала за месяц',money(m.investmentCompleted)+' млрд базы')}${row('Проекты в очереди',String(state.projects.length),'Вложения уже оплачены; ввод ещё впереди')}
      </section></div>`;
}
function fiscal() {
  const m=state.metrics,f=state.lastReport.fiscal,a=accountBalances(state),g=state.government;
  const domesticRate=g.domesticBonds.length?g.domesticBonds.reduce((v,b)=>v+b.principal*b.rate,0)/a.domesticDebt*100:0;
  return `<section class="panel"><span class="eyebrow">ДОЛГОВАЯ УСТОЙЧИВОСТЬ</span><h2>${g.defaultActive?'Есть непогашенный дефолт':'Состояние государственных обязательств'}</h2><div class="two-cols"><div>${row('Эпизоды дефолта',String(g.defaults))}${row('Долг, затронутый неплатежом',money(m.debtInDefault??0)+' млрд')}${row('Просроченные платежи',money(g.arrears)+' млрд')}${row('Обслуживание долга / доходы',pct(m.debtServiceRevenue??0))}</div><div>${row('Условный риск потери финансирования',pct(m.refinancingRisk??0)+' / год','Логистический сценарный показатель; не эмпирическая вероятность дефолта')}${row('Ограничение доступа к внешнему рынку',state.month<g.excludedUntil?'До '+date(g.excludedUntil,true):'Нет')}${row('Дивиденды государственных долей',money(f.stateDividends??0)+' млрд')}${row('Отложенные убытки ЦБ',money(state.centralBank.deferredLoss)+' млрд','Уменьшают будущие перечисления ЦБ, не являются долгом казначейства')}</div></div><details class="method-details"><summary>Вынужденная реструктуризация и история дефолтов</summary><p>Неплатёж по купону или основному долгу — дефолт. Обмен с потерей приведённой стоимости также считается дефолтом. Высокий долг сам по себе не означает дефолт.</p><div class="section-actions"><label class="field">Списание номинала, %<input id="debt-haircut" type="number" min="0" max="70" value="30"></label><label class="field">Новый срок, месяцев<input id="debt-extension" type="number" min="12" max="120" value="60"></label><button data-action="restructure-queue">${state.politics.enabled?'Голосовать по обмену долга':'Запланировать обмен долга'}</button></div>${g.defaultEpisodes.map(e=>`<p>${date(e.start,true)} — ${e.end===null?'не разрешён':date(e.end,true)} · потери номинала ${money(e.faceLossLC)} млрд · потери приведённой стоимости ${money(e.npvLossLC)} млрд.</p>`).join('')||'<p>Дефолтов не было.</p>'}${queuedActions()}</details></section><div class="balance-strip"><div class="panel"><span class="eyebrow">ДОЛГ ГОСУДАРСТВА</span><div class="big">${money(a.totalGovernmentDebt)} млрд</div><span class="small muted">${pct(m.debtRatio)} ВВП за 12 месяцев</span></div><div class="panel"><span class="eyebrow">КАЗНАЧЕЙСТВО</span><div class="big">${money(g.cash)} млрд</div><span class="small muted">Средства на счёте</span></div><div class="panel"><span class="eyebrow">ПРОЦЕНТЫ ПО ДОЛГУ</span><div class="big">${money(m.interestExpense)} млрд</div><span class="small muted">За текущий месяц</span></div></div>
    <div class="two-cols"><section class="panel"><h2>Доходы бюджета</h2>${row('НДС',money(f.vat??0)+' млрд')}${row('Подоходный налог',money(f.incomeTax??0)+' млрд')}${row('Налог на прибыль',money(f.corporateTax??0)+' млрд')}${row('Пошлины',money(f.tariff??0)+' млрд')}${row('Сырьевая рента',money(f.royalty??0)+' млрд')}${row('Доход центрального банка',money(f.centralIncome??0)+' млрд')}${row('Всего налогов',money(m.taxRevenue)+' млрд')}${row('Собираемость прямых налогов',pct(state.institutions.taxCompliance*100))}</section>
    <section class="panel"><h2>Расходы и финансирование</h2>${row('Закупки и инвестиции',money(f.purchases??0)+' млрд')}${row('Пособия и пенсии',money(f.transfers??0)+' млрд')}${row('Поддержка семей',money(f.familyBenefits??0)+' млрд')}${row('Здравоохранение · внутри закупок',money(f.healthcare??0)+' млрд')}${row('Образование · внутри закупок',money(f.education??0)+' млрд')}${row('Администрирование · внутри закупок',money(f.institutionCost??0)+' млрд')}${row('Поддержка бизнеса',money(f.businessSupport??0)+' млрд')}${row('Выплаты по гарантиям концессий',money(f.concessionGuarantees??0)+' млрд')}${row('Обслуживание фонда · внутри закупок',money(f.infrastructureMaintenance??0)+' млрд')}${row('Покупки существующей инфраструктуры',money(f.networkPurchases??0)+' млрд')}${row('Продажи существующей инфраструктуры',money(f.networkSales??0)+' млрд')}${row('Обслуживание долга',money(f.interest??0)+' млрд')}${row('Спасение банков',money(f.bankRescue??0)+' млрд')}${row('Дефицит за месяц',money(state.government.lastDeficit)+' млрд')}${row('Новые внутренние займы',money(f.domesticIssued??0)+' млрд')}${row('Новые внешние займы',money(f.externalIssued??0)+' млрд $')}${row('Погашение основного долга',money((f.domesticRedeemed??0)+(f.externalRedeemed??0)*state.exchangeRate)+' млрд')}</section></div>
    <section class="panel" style="margin-top:15px"><h2>Сроки и валютный риск</h2><div class="mini-stats"><div class="mini-stat"><span>Средний внутренний купон</span><strong>${pct(domesticRate)}</strong></div><div class="mini-stat"><span>Внешний долг</span><strong>${money(a.externalDebtUSD)} млрд $</strong></div><div class="mini-stat"><span>Премия за риск новых займов</span><strong>${pct(m.sovereignSpread)}</strong></div></div><p class="small muted">Старые облигации сохраняют купон. Ставка влияет на бюджет при новых займах и рефинансировании. Дефицит на карточке — текущий месячный поток × 12 / ВВП последних 12 месяцев.</p></section>`;
}
function credit(){
 const m=state.metrics,a=accountBalances(state);
 return `<section class="panel"><h2>Банковская система</h2>${row('Кредиты частному сектору',money(a.privateLoans)+' млрд')}${row('Депозиты',money(a.deposits)+' млрд')}${row('Ставка новых кредитов',pct(m.lendingRate)+' годовых')}${row('Ставка депозитов',pct(m.depositRate)+' годовых')}${row('Доступность кредитов',pct(state.bank.creditSupply*100))}${row('Проблемные кредиты',pct(m.npl))}${row('Капитал / рискованные активы',pct(m.capitalRatio),'Минимум: '+pct(state.policy.bankCapitalRequirement))}${row('Покрытие стресс-оттока ликвидностью',pct(m.liquidityCoverage))}</section>`;
}
function creditDetails() {
  const m=state.metrics,b=state.bank,a=accountBalances(state);
  return `<section class="panel"><h2>Капитал и ликвидность — разные ограничения</h2><div class="two-cols"><div>${row('Капитал / все активы · leverage',pct(m.leverageRatio))}${row('Покрытие месячного стресс-оттока · модельное',pct(m.liquidityCoverage))}${row('Риск-взвешенные активы',money(a.riskWeightedAssets)+' млрд')}</div><div>${row('Государственная доля банков',pct(b.stateOwnership*100))}${row('Прибыль ЦБ за месяц',money(state.centralBank.lastProfit)+' млрд')}${row('Перечисление ЦБ в бюджет',money(state.centralBank.lastRemittance)+' млрд')}</div></div><p class="small muted">Внешние активы и открытая валютная позиция имеют отдельные веса риска. Покрытие ликвидности — упрощённый аналог, не полная реализация Basel LCR. Депозитная ставка ограничена доходностью портфеля и стоимостью фондирования.</p></section><div class="two-cols"><section class="panel"><h2>Передача ставки</h2>${row('Денежный режим',esc(POLICY_CHOICES[0][3].find(([value])=>value===state.policy.monetaryRegime)?.[1]))}${row('Действующая базовая ставка',pct(m.effectivePolicyRate),'Решение ЦБ, процентное правило или внешний ориентир')}${row('Ожидания инфляции',pct(m.expectedInflation))}${row('Ожидаемая реальная ставка',pct(realInterestRate(m.effectivePolicyRate/100,state.expectedInflation)*100))}${row('Новые кредиты',pct(m.lendingRate),'Годовая эффективная ставка')}${row('Депозиты',pct(m.depositRate),'Годовая эффективная ставка')}${row('Кредитная доступность',pct(b.creditSupply*100))}${row('Выдано кредитов / овердрафтов',money(m.moneyCreated)+' млрд')}${row('Списано кредитов',money(m.creditLosses)+' млрд')}
    <div class="callout" style="margin-top:15px">Ставки старых кредитов пересматриваются частично. Выдача кредита создаёт депозит; погашение уменьшает оба. Списание уменьшает актив и капитал банка.</div></section>
    <section class="panel"><h2>Баланс банков</h2>${row('Активы за вычетом внешнего фондирования',money(a.bankAssets)+' млрд')}${row('Кредиты частному сектору',money(a.privateLoans)+' млрд')}${row('Депозиты',money(a.deposits)+' млрд')}${row('Капитал',money(a.bankEquity)+' млрд')}${row('Капитал / рискованные активы',pct(m.capitalRatio))}${row('Проблемные кредиты',pct(m.npl))}${row('Ликвидность / депозиты',pct(m.bankLiquidity))}${row('Заём у центрального банка',money(b.centralBorrowing)+' млрд')}${row('Чистые внешние активы',money(b.foreignAssetsUSD)+' млрд $')}
    <div class="audit-ok" style="margin-top:15px">${iconCheck} Активы = депозиты + заём ЦБ + капитал</div></section></div>
    <section class="panel" style="margin-top:15px"><h2>Долговая нагрузка</h2><div class="table-wrap"><table class="table"><thead><tr><th>Заёмщик</th><th>Долг, млн</th><th>Валютная часть, млн $</th><th>Средняя ставка</th><th>Проценты / месяц</th></tr></thead><tbody>${[...state.households,...state.firms].map(a=>`<tr><td>${esc(a.name)}</td><td>${n(a.loanLC+a.loanFX*state.exchangeRate,0)}</td><td>${n(a.loanFX,0)}</td><td>${pct(a.averageRate*100)}</td><td>${n(a.interestPaid??0,0)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function external() {
  const m=state.metrics,e=state.lastReport.external??{};
  const worldFields=[['commodityPrice','Мировая цена сырья',25,250,5,'Индекс, старт = 100'],['energyPrice','Цена импортной энергии',25,250,5,'Индекс, старт = 100'],['foreignDemand','Внешний спрос',40,180,5,'Индекс, старт = 100'],['globalRate','Зарубежная ставка',0,15,.25,'% годовых'],['weather','Урожайность',40,150,5,'Индекс, нормальная = 100'],['importAvailability','Доступность компонентов',10,120,5,'Индекс, старт = 100']];
  return `<div class="two-cols"><section class="panel"><h2>Внешние счета</h2>${row('Курс валюты',n(m.exchangeRate,3)+' ед. / $')}${row('Реальный курс',n(m.realExchangeRate,1),'Индекс начала = 100; рост означает реальное обесценение')}${row('Экспорт',money(e.exportsUSD??0)+' млрд $')}${row('Импорт',money(e.importsUSD??0)+' млрд $')}${row('Текущий счёт',money(m.currentAccountUSD)+' млрд $')}${row('Прямые инвестиции',money(e.inflowUSD??0)+' млрд $')}${row('Вывод сбережений за рубеж',money(e.flightUSD??0)+' млрд $')}${row('Переводы мигрантов',money(e.remittancesUSD??0)+' млрд $')}</section>
    <section class="panel"><h2>Резервы и сырьё</h2>${row('Валютные резервы',money(m.reservesUSD)+' млрд $')}${row('Резервы / импорт',n(m.reserveMonths,1)+' мес.')}${row('Стабилизационный фонд',money(m.fundUSD)+' млрд $')}${row('Валютная интервенция',n(state.policy.fxIntervention,0)+' млн $ / мес.')}${row('Сценарий',state.resourceMode?'Сырьевая экономика':'Диверсифицированная экономика')}
    <p class="small muted" style="margin-top:15px">Сырьевая структура выбирается в начале эксперимента: она меняет экспорт, размещение капитала и бюджетную ренту.</p><button data-action="new">Изменить структуру и начать заново</button></section></div>
    <section class="panel" style="margin-top:15px"><span class="eyebrow">УСЛОВИЯ ЭКСПЕРИМЕНТА · НЕ ГОСУДАРСТВЕННЫЕ РЫЧАГИ</span><h2 style="margin-top:5px">Внешний мир</h2><p class="small muted">Установите условия для проверки гипотезы. При сравнении A/B обе экономики получают одни и те же значения и шоки.</p>
    <div class="world-grid">${worldFields.map(([key,label,min,max,step,unit])=>`<label class="field">${label}<input type="number" data-world="${key}" value="${state.world[key]}" min="${min}" max="${max}" step="${step}"><span class="small muted">${unit}</span></label>`).join('')}</div>
    <div class="section-actions" style="margin-top:18px"><label class="check" style="margin:0"><input type="checkbox" data-stochastic ${state.stochastic?'checked':''}> Случайные внешние колебания · seed ${state.seed}</label></div>
    <h3 style="margin-top:20px">Запланировать шок на ближайшие 12 месяцев</h3><div class="shock-list"><button data-shock="commodity">Сырьё −30%</button><button data-shock="energy">Энергия +30%</button><button data-shock="demand">Внешний спрос −15%</button><button data-shock="weather">Неурожай −20%</button><button data-shock="supply">Компоненты −30%</button></div>
    ${state.shocks.length?`<div class="timeline-note">${state.shocks.map((x,i)=>`${esc(x.key)} × ${n(x.multiplier,2)} · ${date(x.start,true)}–${date(x.start+x.duration-1,true)} <button class="small secondary" data-remove-shock="${i}" ${state.month>=x.start?'disabled':''}>Удалить</button>`).join('<br>')}</div>`:''}</section>`;
}
function households() {
  const m=state.metrics;
  return `<section class="panel"><h2>Демография: возраст и пол</h2><p class="small muted">Рождения рассчитаны по возрасту женщин; переход в рабочую силу — с 18 лет. Услуги здравоохранения и реальная поддержка семей влияют с задержкой. Все исходные возрастные нормы условные.</p><div class="table-wrap"><table class="table"><thead><tr><th>Возраст</th><th>Женщины, тыс.</th><th>Мужчины, тыс.</th></tr></thead><tbody>${Array.from({length:11},(_,i)=>{const from=i*120,to=i===10?1201:from+120;return `<tr><td>${i===10?'100+':`${i*10}–${i*10+9}`}</td><td>${n(state.demography.female.slice(from,to).reduce((a,b)=>a+b,0)*1000,1)}</td><td>${n(state.demography.male.slice(from,to).reduce((a,b)=>a+b,0)*1000,1)}</td></tr>`;}).join('')}</tbody></table></div></section><section class="panel" style="margin-top:20px"><span class="eyebrow">ЛЮДИ И ДОХОДЫ</span><h2 style="margin-top:5px">Десять групп домохозяйств</h2><p class="small muted">Доход и расходы — млн национальной валюты за месяц. Потребление — объём в базовых ценах.</p><div class="table-wrap"><table class="table"><thead><tr><th>Группа</th><th>Население, млн</th><th>Доход</th><th>Потребление</th><th>Депозиты</th><th>Долг</th><th>Склонность к потреблению</th></tr></thead><tbody>${state.households.map(h=>`<tr><td>${esc(h.name)}</td><td>${n(state.population*h.population,2)}</td><td>${n(h.income,0)}</td><td>${n(h.consumption,0)}</td><td>${n(h.cash,0)}</td><td>${n(h.loanLC+h.loanFX*state.exchangeRate,0)}</td><td>${pct(h.mpc*100)}</td></tr>`).join('')}</tbody></table></div></section>
    <div class="two-cols"><section class="panel"><h2>Рынок труда</h2>${row('Население',n(state.population,3)+' млн')}${row('Дети / трудоспособные / пожилые',state.ageCohorts.map(x=>n(x,2)).join(' / ')+' млн')}${row('Рождения',n(m.births*1000000,0)+' человек / мес.')}${row('Смерти',n(m.deaths*1000000,0)+' человек / мес.')}${row('Естественный прирост',signed(m.naturalIncrease*1000000,0)+' человек / мес.')}${row('Суммарная рождаемость',n(m.totalFertilityRate,2)+' детей на женщину','Периодный показатель, не число детей в каждой семье')}${row('Периодная ожидаемая продолжительность жизни',n(m.lifeExpectancy,1)+' лет','По текущей возрастной смертности; это не средний возраст')}${row('Доля 65+',pct(m.elderlyShare))}${row('Демографическая нагрузка',n(m.dependencyRatio,1)+' на 100 трудоспособных')}${row('Рабочая сила',n(m.laborForce,3)+' млн')}${row('Занятость',n(m.employment,3)+' млн')}${row('Безработица',pct(m.unemployment))}${row('Миграционный прирост',signed(m.migration*1000000,0)+' человек / мес.')}${row('Участие в рынке труда',pct(state.participation*100))}</section>
    <section class="panel"><h2>Покупательная способность</h2>${row('Реальный доход на человека',n(m.realIncomeIndex,1),'Индекс исходного состояния = 100')}${row('Потребительские цены',n(state.consumerPriceIndex,1),'Индекс исходного состояния = 100')}${row('Продовольственная инфляция',pct(m.foodInflation),'За 12 месяцев')}${row('Энергетическая инфляция',pct(m.energyInflation),'За 12 месяцев')}${row('Базовая инфляция',pct(m.coreInflation),'Промышленность, строительство и услуги')}${row('Теневая экономика',pct(m.informality))}</section></div>`;
}
function compareView() {
  const changed=pending();
  let controls=`<section class="panel"><span class="eyebrow">ПРОВЕРКА ГИПОТЕЗ</span><h2 style="margin-top:5px">Одна страна. Два решения.</h2><p class="small muted">A сохраняет политику исходной точки и не исполняет разовые операции. B применяет ваши ползунки и очередь операций выбранной точки. Внешние условия одинаковые.</p><div class="section-actions"><span class="toolbar-label">Начало</span><select id="compare-source" aria-label="Исходная точка"><option value="current" ${compareSource==='current'?'selected':''}>Текущий месяц</option><option value="checkpoint" ${compareSource==='checkpoint'?'selected':''} ${!checkpoint?'disabled':''}>Сохранённая точка ${checkpoint?'· '+date(checkpoint.month,true):''}</option></select><span class="toolbar-label">Горизонт</span><select id="compare-months" aria-label="Горизонт сравнения">${[6,12,24,60,120,360].map(v=>`<option value="${v}" ${compareMonths===v?'selected':''}>${v} месяцев</option>`).join('')}</select><button class="primary" data-action="compare" ${busy?'disabled':''}>${busy?'Вычисление…':'Рассчитать A / B'}</button></div><div class="small muted">${changed.length?`${changed.length} изменений относительно текущей политики.`:'Измените политику или запланируйте операцию с собственностью / долгом.'}</div></section>`;
  if(!comparison) return controls+`<section class="panel comparison-empty"><span class="eyebrow">КОНТРОЛЬНЫЙ ЭКСПЕРИМЕНТ</span><h2>Отделите эффект политики</h2><p>Создайте точку сравнения, измените ставку или бюджет и посмотрите на обе траектории. Основное время не продвигается.</p><button data-action="checkpoint">Сохранить текущую точку</button></section>`;
  const c=comparison,a=c.a.metrics,b=c.b.metrics;
  const base=c.a;
  if(c.politicalProtocol)controls+=`<div class="callout"><strong>Сравнение с принятием законов</strong>В обеих ветвях простой сценарный политик пытается провести новые собственные проекты через статьи, парламент и подпись. Принятие не гарантировано. A дошла до ${date(c.a.month,true)}, B — до ${date(c.b.month,true)}.${c.a.month!==c.b.month?' Разные даты завершения не позволяют трактовать разницу показателей как чистый эффект одного инструмента.':''}</div>`;
  const differences=Object.entries(c.b.policy).filter(([key,val])=>val!==base.policy[key]);
  controls+=`<section class="panel"><div class="panel-head"><div><span class="eyebrow">РЕЗУЛЬТАТ · ${c.months} МЕСЯЦЕВ</span><h2>${metricNames[compareMetric]}</h2><span class="small muted">${date(c.originMonth,true)} → ${date(c.originMonth+c.months,true)}</span></div><div class="pill-group">${chartOptions.map(([key,label])=>`<button data-compare-chart="${key}" class="${compareMetric===key?'active':''}">${label}</button>`).join('')}</div></div><div class="chart-wrap">${chart([{name:'A',points:c.a.history.filter(x=>x.month>=c.originMonth)},{name:'B',points:c.b.history.filter(x=>x.month>=c.originMonth)}],compareMetric,{compare:true})}</div><div class="chart-legend"><span><span class="legend-line"></span>A · прежняя политика</span><span><span class="legend-line alt"></span>B · ваша гипотеза</span></div></section>`;
  const president=state.politics.enabled&&state.politics.executive.role==='president',standing=president?presidentialStanding(state):null;
  const metrics=[['gdpPerCapitaReal','ВВП / человек, $ базы',0],['inflationYoY','Инфляция, %',1],['unemployment','Безработица, %',1],['realIncomeIndex','Реальный доход, индекс',1],['debtRatio','Госдолг / ВВП, %',1],['exchangeRate','Курс, ед. / $',3],['reservesUSD','Резервы, млн $',0],['investment','Инвестиции / месяц, млн базы',0],['giniDisposable','Джини располагаемых доходов, 0–100',1],['hdi','ИЧР модели',3],['stateAssetShare','Государственная доля активов, %',1],['defaultEpisodes','Эпизоды дефолта',0]];
  controls+=`<section class="panel"><h2>Результаты на конец горизонта</h2><div class="table-wrap"><table class="table"><thead><tr><th>Показатель</th><th>A</th><th>B</th><th>Разница B − A</th></tr></thead><tbody>${metrics.map(([key,label,d])=>`<tr><td>${label}</td><td>${n(a[key],d)}</td><td>${n(b[key],d)}</td><td>${signed(b[key]-a[key],d)}</td></tr>`).join('')}</tbody></table></div><p class="small muted" style="margin-top:12px">Изменённые решения: ${differences.map(([key,val])=>`${esc(POLICY_FIELDS.find(f=>f[0]===key)?.[1]??key)}: ${esc(base.policy[key])} → ${esc(val)}`).join('; ')||'политика одинакова; при наличии разовых операций ветвь B может отличаться'}.</p><p class="small muted">Вывод относится к допущениям этой модели. Для проверки устойчивости повторите эксперимент с другими коэффициентами.</p></section>`;
  return controls;
}
function politicalValidationView(){
  const v=politicalValidation;
  return `<section class="panel"><span class="eyebrow">ПОЛИТИЧЕСКАЯ МОДЕЛЬ ${v.version}</span><h2>Институты: десять стратегий</h2>${row('Партии с горизонтом 30 лет',n(v.totalGames,0))}${row('Выполненные месячные ходы',n(v.monthsChecked,0))}${row('Достигли 360 месяцев',n(v.completed30Years,0))}${row('Завершились раньше',n(v.endedEarly,0),'Поражение, предел сроков или смена исполнительной власти завершают игру законно')}${row('Точные воспроизведения',n(v.replayChecks,0))}<div class="section-actions"><a href="./docs/POLITICAL-VALIDATION.md" target="_blank" rel="noopener">Политические партии: протокол и результаты</a><a href="./docs/political-validation-results.json" download>Полный отчёт JSON</a><a href="./docs/political-monthly.csv" download>Помесячные ряды</a></div><p class="small muted">Сценарная проверка синтетической модели. Раннее завершение не подменяется продолжением за другого правителя. Ниже отдельно приведены экономические эксперименты лабораторного режима.</p></section>`;
}
function validationView() {
  const table=games=>'<div class="table-wrap"><table class="table"><thead><tr><th>Стратегия</th><th>ВВП / человек</th><th>Инфляция</th><th>Долг / ВВП</th><th>Джини</th><th>ИЧР модели</th><th>Дефолты</th></tr></thead><tbody>'+games.map(x=>'<tr><td style="white-space:normal;max-width:260px"><strong>'+esc(x.name)+'</strong><div class="small muted">'+esc(x.description)+'</div></td><td>'+n(x.gdpPerCapitaReal,0)+'</td><td>'+pct(x.inflationYoY)+'</td><td>'+pct(x.debtRatio)+'</td><td>'+n(x.giniDisposable,1)+'</td><td>'+n(x.hdi,3)+'</td><td>'+x.defaults+'</td></tr>').join('')+'</tbody></table></div>';
  return politicalValidationView()+'<section class="panel"><span class="eyebrow">ЛАБОРАТОРНЫЙ РЕЖИМ · МОДЕЛЬ '+validation.version+' · ПРОВЕРКА 30 ЛЕТ</span><h2>Десять стратегий: 360 месяцев</h2><p class="small muted">Одинаковые начальные условия, без случайных шоков. Стабилизация меняет ставку каждый месяц; остальные пакеты постоянны. Это результаты условной модели, не прогноз.</p>'+table(validation.main)+'<details class="method-details"><summary>Те же стратегии в сырьевой экономике</summary>'+table(validation.resource)+'</details><div class="section-actions"><a href="./docs/VALIDATION.md" target="_blank" rel="noopener">Полный отчёт и сравнение собственности</a><a href="./docs/strategies-monthly.csv" download>Месячные ряды CSV</a><a href="./docs/validation-results.json" download>Результаты JSON</a></div></section><section class="panel"><h2>Расширенная проверка</h2>'+row('Всего игр',n(validation.totalGames??0,0))+row('Повторы с общими шоками',n(validation.stochasticGames,0))+row('Сравнения собственности и профилей',n(validation.ownershipGameCount??0,0))+row('Кризисные сценарии',n(validation.crisisGameCount??0,0))+row('Проверки чувствительности',n(validation.sensitivityGames,0))+row('Пятидесятилетние игры',n(validation.longHorizonGames,0))+row('Точные воспроизведения журнала',n(validation.replayChecks??0,0))+row('Проверенные месячные переходы',n(validation.monthsChecked,0))+row('Максимальная относительная ошибка балансов',validation.maxRelativeFinancialAudit.toExponential(3))+'<p class="small muted">Правильность учёта не означает эмпирической точности. Коэффициенты условные, внутри групп доходы не различаются; ИЧР и ППС — модельные оценки.</p></section><section class="panel"><h2>Новые механики: 12 пакетов по 30 лет</h2><p class="small muted">Диверсифицированная страна, общий seed 11 и одинаковые шоки. Пакеты меняют несколько решений; это не чистая оценка эффекта собственности.</p>'+table(extendedValidation.games.filter(g=>g.age==='young'&&g.seed===11&&!g.resourceMode))+row('Дополнительные партии',n(extendedValidation.totalGames,0))+row('Дополнительные месячные переходы',n(extendedValidation.monthsChecked,0))+row('Воспроизведения новых сценариев',n(extendedValidation.replayChecks,0))+'<div class="section-actions"><a href="./docs/EXTENDED-VALIDATION.md" target="_blank" rel="noopener">Отчёт: режимы, население, услуги и профсоюзы</a><a href="./docs/extended-strategies-monthly.csv" download>Ряды новых партий CSV</a></div></section>';
}
function methodology() {
  const audit=state.lastReport.audit;
  return `<section class="panel"><span class="eyebrow">МОДЕЛЬ ${VERSION}</span><h2 style="margin-top:5px">Что именно вычисляется</h2><p><a href="./docs/POLITICS.md" target="_blank" rel="noopener">Политическая модель: полномочия, формулы выборов, научные источники и условные коэффициенты</a></p><div class="callout warning"><strong>Исследовательская модель с условной калибровкой</strong>Балансовые тождества проверяются при каждом ходе. Поведенческие коэффициенты не оценены по данным конкретной страны; результат — следствие заданных допущений. Это не точный прогноз реальной экономики.</div>
    <div class="explain"><p>Открытая экономика: пять отраслей, десять групп семей, банки, отдельный баланс центрального банка, казначейство и внешний сектор. Месячный шаг, ограничения производства, собственность и согласованные финансовые операции.</p><p><a href="./docs/PARAMETERS.md" target="_blank" rel="noopener">Научные методы, единицы, источники и статус коэффициентов</a>. Джини рассчитан по группам; ИЧР использует модельное образование и условный ППС. Ни одна форма собственности не получает автоматического бонуса эффективности.</p><p><a href="./docs/INSTITUTIONS.md" target="_blank" rel="noopener">Институты: правила, услуги и спорные механизмы</a>. Качество не задаётся игроком. Институты меняют ограниченный уровень эффективности, а не дают постоянную надбавку к темпу роста. Нулевые коэффициенты позволяют проверить отсутствие предполагаемой отдачи; это не полноценная модель какой-либо экономической школы.</p>
      <div class="formula">ВВП = потребление + инвестиции + госзакупки + экспорт − импорт + изменение запасов</div>
      <ul><li><strong>Годовая эффективная ставка → месяц:</strong> <code>(1 + r)^(1/12) − 1</code>. Износ: <code>1 − (1 − δ)^(1/12)</code>. Купоны с номинальной годовой ставкой: <code>долг × купон / 12</code>.</li><li><strong>Инфляция за 12 месяцев:</strong> <code>ИПЦ[t] / ИПЦ[t−12] − 1</code>. Рост ВВП сравнивает месячный реальный выпуск с тем же месяцем прошлого года.</li><li><strong>Бюджет:</strong> доля известного номинального ВВП последних 12 месяцев делится на 12. Дополнительной индексации по ИПЦ нет. Проценты и погашение долга рассчитываются по каждой когорте.</li><li><strong>Долг / ВВП:</strong> накопленный долг делится на сумму номинального ВВП за последние 12 месяцев. Дефицит на главном экране — месячный поток, приведённый к годовому темпу.</li><li><strong>$6 000 на человека:</strong> начальная годовая величина при населении 10 млн и ВВП $60 млрд. Реальный показатель на карточке — текущий месячный выпуск × 12 / население, в ценах начала. Это годовой темп, а не сумма прошедшего года.</li><li><strong>Первые годовые сравнения:</strong> до января ${state.startYear??2026} используется явная синтетическая история с ростом 3% и инфляцией 8%. После 12 ходов весь годовой расчёт опирается на ваши месяцы.</li><li><strong>Цены:</strong> операции месяца проходят по открывающим ценам. В конце месяца рассчитываются новые цены и ИПЦ; они действуют в следующем месяце. Разовый НДС не становится повторяющимся ценовым шоком. Частные медицинские, образовательные услуги и плата за инфраструктуру освобождены от НДС в этой модели.</li></ul></div>
    <div class="section-actions"><a href="./docs/EXTENSIONS.md" target="_blank" rel="noopener">Новые механики: формулы, источники и допущения</a><a href="./docs/VALIDATION.md" target="_blank" rel="noopener">Результаты проверки</a><span class="separator"></span><a href="./docs/MODEL.md" target="_blank" rel="noopener">Уравнения и ограничения</a><span class="separator"></span><a href="https://github.com/ZHANK478/Economy-Model-" target="_blank" rel="noopener">Исходный код</a></div></section>
    <section class="panel"><h2>Все ${MODULES.length} экономических блоков</h2><div class="module-grid">${MODULES.map(([name,detail],i)=>`<div class="module-card"><span class="module-index">${String(i+1).padStart(2,'0')}</span><strong>${name}</strong><p>${detail}</p></div>`).join('')}</div></section>
    <section class="panel"><h2>Проверка учёта за последний месяц</h2><p class="small muted">Остатки тождеств, млн. Малые значения порядка 10⁻⁹ — погрешность вычислений.</p>${Object.keys(audit).length?Object.entries(audit).map(([key,val])=>row(({population:'Баланс населения (млн человек)',centralBank:'Баланс центрального банка',bankBalance:'Банковский баланс',nominalGDP:'ВВП: номинальное тождество',realGDP:'ВВП: реальное тождество',goods:'Баланс товаров',externalNFA:'Чистые внешние активы / текущий счёт',governmentCash:'Движение казначейского счёта',governmentDebt:'Движение госдолга'})[key]??key,`<span class="audit-code">${val.toExponential(3)}</span>`)).join(''):'<p class="small muted">Полный набор проверок появится после первого месяца.</p>'}</section>
    <section class="panel"><span class="eyebrow">УСТОЙЧИВОСТЬ ГИПОТЕЗ</span><h2 style="margin-top:5px">Изменить допущения</h2><p class="small muted">Это параметры исследователя, а не действия правительства. Они применяются к последующим ходам. Сравнение из сохранённой точки использует параметры этой точки.</p>${PARAMETER_FIELDS.map(([key,label,min,max,step])=>`<div class="parameter-control"><label for="param-${key}">${label}</label><input type="range" id="param-${key}" min="${min}" max="${max}" step="${step}" value="${state.parameters[key]}" data-parameter="${key}"><input type="number" min="${min}" max="${max}" step="${step}" value="${state.parameters[key]}" data-parameter-number="${key}" aria-label="${label}, значение"></div>`).join('')}</section>`;
}

function missionControl(budget,stopped,waiting){
  const m=state.metrics,prev=previous(),balance=currentMetric(state,'budgetBalance');
  const president=state.politics.enabled&&state.politics.executive.role==='president',standing=president?presidentialStanding(state):null;
  const metrics=[['gdpPerCapitaReal','ВВП / человек',n(m.gdpPerCapitaReal,0),'$ базы',true],['inflationYoY','Инфляция',n(m.inflationYoY,1),'%',false],['unemployment','Безработица',n(m.unemployment,1),'%',false],['population','Население',n(m.population,3),'млн',true],state.politics.enabled?(president?['presidentialCandidateRating','Рейтинг президента',n(standing.share,1),'% голосов',true]:['governmentPartyRating','Парламентский рейтинг',n(m.governmentPartyRating,1),'% голосов',true]):['realIncomeIndex','Реальные доходы',n(m.realIncomeIndex,1),'индекс',true]];
  if(president)metrics.push(['governmentPartyRating','Парламентский рейтинг',n(m.governmentPartyRating,1),'% голосов',true]);
  return `<section class="mission-control" aria-label="Основные показатели и переход месяца"><div class="turn-header"><div class="control-date"><span class="eyebrow">${state.politics.enabled?esc(executiveDescription(state)):'Экономическая лаборатория'}</span><div class="turn-date">${date(state.month)} <span>Ход ${state.month}</span></div>${budget.limit?`<div class="decision-meter">Решения <b>${budget.used} / ${budget.limit}</b></div>`:''}</div><div class="budget-total"><span>Баланс бюджета за месяц ${graphButton('budgetBalance')}</span><strong class="${balance!==null&&balance<0?'negative':'positive'}">${balance===null?'Ещё нет расчёта':signed(balance,0)+' млн'}</strong><small>Доходы − расходы, включая проценты</small></div><div class="turn-action"><button class="primary" data-action="step" ${busy||stopped?'disabled':''}>${busy?'Расчёт…':stopped?'Правление завершено':'Следующий месяц →'}</button>${campaignEvent(state)?'<button data-action="campaign-open">Предвыборное событие</button>':''}${waiting?'<button class="proposal-reminder" data-action="proposal-open">Есть предложение партии</button>':''}</div></div></section><section class="primary-metrics"><div class="metric-strip">${metrics.map(([key,label,value,unit,higher])=>{const delta=m[key]-prev[key],color=state.month===0||!Number.isFinite(delta)||Math.abs(delta)<.00001?'neutral':(delta>0)===higher?'positive':'negative';return `<div class="compact-metric"><div><span>${label}</span>${graphButton(key)}</div><strong>${value} <small>${unit}</small></strong><small class="${color}">${state.month===0?'Исходные условия':Number.isFinite(delta)?signed(delta,key==='population'?3:key==='gdpPerCapitaReal'?0:1)+' за месяц':'Начало наблюдения'}</small></div>`;}).join('')}</div>${president?`<div class="election-watch"><span>Первый тур · место ${standing.rank} из ${standing.candidates.length}. ${state.politics.constitution.presidentSystem==='twoRound'?'Для второго тура нужно войти в двух лидеров; победа зависит от перераспределения голосов.':'Поддержка в опросе не гарантирует победу.'}</span><button data-view="elections">Выборы и соперники</button></div>`:''}</section>`;
}
function settingsWindow(){
 if(!settingsOpen)return '';
 return `<dialog id="settings-dialog" class="settings-popup" aria-labelledby="settings-heading"><div class="popup-head"><h2 id="settings-heading">Настройки</h2><button data-action="settings-close" aria-label="Закрыть настройки">×</button></div><div class="settings-actions"><button data-action="export">Сохранить игру</button><button data-action="import">Открыть сохранение</button><button data-action="new">Новая игра</button>${legacySave?'<button data-action="legacy-export">Прежнее сохранение</button>':''}<button data-action="checkpoint">Сохранить точку ${checkpoint?'· '+date(checkpoint.month,true):''}</button>${checkpoint?'<button data-action="restore">Вернуться к точке</button>':''}<button data-action="csv">Скачать статистику CSV</button><button data-action="journal-export">Скачать историю решений</button><button data-action="usage-export">Скачать журнал интерфейса</button>${!state.politics.enabled?'<button data-action="run3">+3 месяца</button><button data-action="run12">+12 месяцев</button>':''}</div><p class="small muted" id="save-status">${esc(saveStatus)}</p></dialog>`;
}
function floatingWindows(views){
  const proposal=proposalOpen&&state.politics.bills.find(b=>b.id===proposalId);
  let out=proposal?`<dialog id="proposal-dialog" class="proposal-popup" aria-labelledby="proposal-heading"><div class="popup-head"><h2 id="proposal-heading">Предложения партий</h2><button data-action="proposal-close" aria-label="Закрыть предложение">×</button></div>${views.proposal(proposal.id)}<button class="wide" data-action="proposal-close">${proposal.executiveResponse?'Готово':'Рассмотреть позже'}</button></dialog>`:'';
  if(trendMetric&&METRIC_INFO[trendMetric]){
    const info=METRIC_INFO[trendMetric],series=metricSeries(state,trendMetric),last=series.at(-1),first=series[0];
    out+=`<dialog id="trend-dialog" class="trend-popup" aria-labelledby="trend-heading"><div class="popup-head"><h2 id="trend-heading">${esc(info.label)}</h2><button data-action="trend-close" aria-label="Закрыть график">×</button></div><p class="small muted">${esc(info.unit)} · каждая точка — месяц</p><div class="chart-wrap">${chart([{name:'Ваша страна',points:series}],trendMetric,{compact:true})}</div>${last?`<div class="trend-values"><span>Сейчас <b>${n(last[trendMetric],info.digits)}</b></span>${first&&last.month!==first.month?`<span>С начала <b>${signed(last[trendMetric]-first[trendMetric],info.digits)}</b></span>`:''}</div>`:''}${trendMetric==='budgetBalance'?'<p class="small muted">Плюс — профицит, минус — дефицит. Налоги, неналоговые доходы и все бюджетные расходы, включая проценты. Заимствования относятся к финансированию, а не к доходам. Баланс отличается от остатка денег казначейства.</p>':''}<button class="wide" data-action="trend-close">Закрыть</button></dialog>`;
  }
  if(resultBillId!==null||resultExecutive)out+=`<dialog id="result-dialog" class="result-popup" aria-labelledby="result-heading"><div class="popup-head"><h2 id="result-heading">Результат решения</h2><button data-action="result-close" aria-label="Закрыть результат">×</button></div>${decisionResult()}<button class="primary wide" data-action="result-close">Понятно</button></dialog>`;
  if(campaignOpen&&!proposal&&!settingsOpen&&resultBillId===null&&!resultExecutive){const e=campaignEvent(state);if(e||campaignFeedback)out+=`<dialog id="campaign-dialog" aria-labelledby="campaign-heading"><div class="popup-head"><h2 id="campaign-heading">${esc(campaignFeedback?'Ответ опубликован':e.title)}</h2><button data-action="campaign-close" aria-label="Закрыть событие">×</button></div>${campaignFeedback?`<p>${esc(campaignFeedback)}</p><p class="small muted">Реакция избирателей отразится в опросах после следующего месяца.</p><button class="wide" data-action="campaign-close">Готово</button>`:`<p>${esc(e.text)}</p><p class="small muted">До ${e.kind==='president'?'президентских':'парламентских'} выборов ${e.remaining} мес.</p><div class="settings-actions">${e.choices.map((c,i)=>`<button data-campaign-choice="${i}" data-event-id="${esc(e.id)}"><strong>${esc(c.label)}</strong><span style="display:block" class="small muted">${esc(c.hint)}</span></button>`).join('')}</div><button class="wide" data-action="campaign-close">Позже</button>`}</dialog>`;}
  return out;
}
function bindFloatingWindows(){
  for(const [id,close] of [['campaign-dialog',()=>{campaignOpen=false;}],['settings-dialog',()=>{settingsOpen=false;}],['proposal-dialog',()=>{proposalOpen=false;}],['trend-dialog',()=>{trendMetric=null;}],['result-dialog',()=>{resultBillId=null;resultExecutive=null;}]]){
    const dialog=document.getElementById(id);if(!dialog)continue;
    if(!dialog.open)dialog.showModal();
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();render();});
  }
}
function electorateView(){
  const p=state.politics;if(!p.enabled)return '<section class="panel"><h2>Электорат</h2><p>Доступен в политической игре.</p></section>';
  const id=p.parties.some(x=>x.active&&x.id===electorateParty)?electorateParty:p.executive.playerParty,groups=p.poll.groups?.filter(g=>g.dimension===electorateDimension)??[],series=electorateSeries(state,electorateDimension,electorateMeasure,id),label=electorateMeasure==='party'?'Поддержка партии':electorateMeasure==='candidate'?'Поддержка кандидата в первом туре':electorateMeasure==='presidentApproval'?'Одобрение президента':'Одобрение исполнительной власти';
  const past=p.partyHistory.filter(h=>h.groups).at(-2),oldValue=g=>{const old=past?.groups.find(x=>x.dimension===electorateDimension&&x.id===g.id);return electorateMeasure==='party'?old?.parties[id]:electorateMeasure==='candidate'?old?.candidates[id]:electorateMeasure==='presidentApproval'?old?.presidentApproval:old?.approval;},value=g=>electorateMeasure==='party'?g.parties[id]:electorateMeasure==='candidate'?g.candidates[id]:electorateMeasure==='presidentApproval'?g.presidentApproval:g.approval;
  return `<section class="panel"><h2>Как меняется поддержка избирателей</h2><p class="small muted">Сравните группы и их реакцию на экономический опыт, политику и события. Разделение по группам не означает, что все люди в группе думают одинаково.</p><div class="electorate-filters"><label class="field">Группы<select data-electorate-dimension="true">${Object.entries(GROUP_DIMENSIONS).map(([key,text])=>`<option value="${key}" ${key===electorateDimension?'selected':''}>${text}</option>`).join('')}</select></label><label class="field">Показатель<select data-electorate-measure="true">${[['party','Парламентский рейтинг партии'],['candidate','Президентский рейтинг кандидата']].map(([key,text])=>`<option value="${key}" ${key===electorateMeasure?'selected':''}>${text}</option>`).join('')}</select></label><label class="field">Партия<select data-electorate-party="true">${p.parties.filter(x=>x.active).map(x=>`<option value="${x.id}" ${x.id===id?'selected':''}>${esc(partyDisplayName(x))}</option>`).join('')}</select></label></div><h3>${label} · %</h3>${groups.length?`<div class="chart-wrap electorate-chart">${chart(series,'value',{compare:true,multi:true})}</div><div class="group-legend">${series.map((g,i)=>`<span><i style="border-color:${i%2===0?'#174ca1':'#c52b39'};border-style:${i>1?'dashed':'solid'}"></i>${esc(g.name)}</span>`).join('')}</div><div class="table-wrap"><table class="table"><thead><tr><th>Группа</th><th>Избиратели</th><th>Поддержка сейчас</th><th>Изменение, п.п.</th></tr></thead><tbody>${groups.map(g=>`<tr><td>${esc(g.label)}</td><td>${n(g.eligible*1e6,0)}</td><td>${Number.isFinite(value(g))?pct(value(g)):g.eligible>0?'Нет наблюдения':'Нет избирателей'}</td><td>${Number.isFinite(value(g))&&Number.isFinite(oldValue(g))?signed(value(g)-oldValue(g),1):'Начало наблюдения'}</td></tr>`).join('')}</tbody></table></div>`:'<p>Подробное наблюдение начнётся со следующего расчёта месяца.</p>'}<p class="small muted">${p.partyHistory.find(h=>h.groups)?'Групповые ряды записываются с '+date(p.partyHistory.find(h=>h.groups).month,true)+'.':'История групп ещё не записана.'} Пропуски в старой истории не заполняются вымышленными значениями. Опросы — модельные предпочтения, а не голоса состоявшихся выборов. Поддержка партий взвешивается по ожидаемым участникам, президентский рейтинг — предпочтения между кандидатами.</p></section>`;
}
const CATEGORIES={
  decisions:{label:'Решения',default:'policy',views:[['policy','Ваши законы и бюджет'],['ownership','Собственность']]},
  statistics:{label:'Статистика',default:'country',views:[['country','Паспорт страны'],['overview','Динамика'],['economy','Производство'],['fiscal','Бюджет'],['credit','Банки'],['external','Внешний мир'],['households','Население'],['infrastructure','Инфраструктура'],['services','Услуги']]},
  political:{label:'Политика',default:'government',views:[['government','Власть и полномочия'],['parties','Партии и коалиция'],['elections','Выборы'],['electorate','Динамика электората'],['constitution','Конституция']]},
  security:{label:'Безопасность',default:'security',views:[['security','Институты и кризисы']]}
};
function render() {
  const views={country,overview,economy,fiscal,credit,external,households,ownership:ownershipView,institutions:institutionsView,journal:journalView,compare:compareView,validation:validationView,method:methodology,policy:sidebar,electorate:electorateView,...extendedViews({state,n,pct,row,esc,queuedActions}),...politicalViews({state,n,pct,row,esc,date})};
  detectDecisionResult();
  const category=Object.keys(CATEGORIES).find(key=>CATEGORIES[key].views.some(([id])=>id===view))??'decisions',group=CATEGORIES[category];
  const initiative=unresolvedInitiatives(state)[0];
  if(initiative&&initiative.id!==announcedProposal){announcedProposal=initiative.id;proposalId=initiative.id;proposalOpen=true;trendMetric=null;}
  const campaign=campaignEvent(state);if(campaign&&!campaignFeedback&&campaign.id!==announcedCampaign){announcedCampaign=campaign.id;campaignOpen=true;campaignFeedback=null;}
  const budget=decisionBudget(state);
  const waiting=unresolvedInitiatives(state).length>0,stopped=state.politics.enabled&&!state.politics.executive.inOffice;
  app.innerHTML=`<div class="app-shell"><header class="topbar settings-bar"><button class="settings-toggle" data-action="settings-open" aria-label="Настройки" title="Настройки" aria-haspopup="dialog">⚙</button></header>
    <div class="workspace"><main class="main">${missionControl(budget,stopped,waiting)}
    ${stopped?`<div class="callout warning"><strong>Ваше правление завершено.</strong> ${esc(state.politics.executive.reason)} <button data-view="government">Итоговый отчёт</button></div>`:''}
    <nav class="vertical-navigation" aria-label="Разделы игры">${Object.entries(CATEGORIES).map(([key,c])=>`<section class="navigation-group"><button class="category-heading" data-category="${key}" aria-expanded="${openCategory===key}"><span>${c.label}${key==='decisions'&&waiting?' <span class="notification-dot" aria-label="Есть предложение"></span>':''}</span><span aria-hidden="true">${openCategory===key?'−':'+'}</span></button>${openCategory===key?`<div class="vertical-subsections">${c.views.map(([id,label])=>`<section class="navigation-subsection"><button data-view="${id}" class="${view===id?'active':''}" aria-expanded="${view===id}"><span>${label}</span><span aria-hidden="true">${view===id?'−':'+'}</span></button>${view===id?`<div id="view-content" class="subsection-content">${id==='overview'?cards():''}${views[id]()}</div>`:''}</section>`).join('')}</div>`:''}</section>`).join('')}</nav>
    </main></div>${settingsWindow()}${floatingWindows(views)}</div>`;
  for(const table of app.querySelectorAll?.('table')??[]){
    const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
    for(const tr of table.querySelectorAll('tbody tr'))for(const [i,td] of [...tr.children].entries())td.dataset.label=heads[i]??'';
  }
  bindUsage();bindFloatingWindows();
}

function updateDraft(key,val) {
  const field=POLICY_FIELDS.find(x=>x[0]===key);if(!field||!Number.isFinite(Number(val))) return;
  draft[key]=Math.max(field[2],Math.min(field[3],Number(val)));
  const range=app.querySelector(`[data-policy="${key}"]`),num=app.querySelector(`[data-policy-number="${key}"]`);
  if(range)range.value=draft[key];if(num&&document.activeElement!==num)num.value=draft[key];
  const out=document.getElementById('value-'+key);if(out)out.textContent=n(draft[key],field[4]<1?2:0);
  const cancel=document.getElementById('cancel-policy');if(cancel)cancel.disabled=pending().length===0;
  const rr=document.getElementById('real-rate');if(rr)rr.textContent=pct(realInterestRate(draftBaseRate()/100,state.expectedInflation)*100);
  const pn=document.getElementById('pending-note');if(pn)pn.textContent=pending().length?(state.politics.enabled?'Отпустите ползунок или завершите ввод — голосование пройдёт сразу.':`Изменено решений: ${pending().length}`):'Текущая политика сохранена';
  comparison=null;persist();
}
function commitChoice(key){
  if(!state.politics.enabled)return;
  const current=plannedPolicy(state);if(draft[key]===current[key])return;
  comparisonBase??=copy(state);
  try{executePolitical(state,{kind:'policyDecision',patch:{[key]:draft[key]},title:decisionName(key)});}
  catch(e){toast(e.message);}
  draft=plannedPolicy(state);comparison=null;persist();
}
function votePendingOperation(){
  if(!state.politics.enabled)return;
  const a=state.pendingActions.at(-1);if(!a)return;
  comparisonBase??=copy(state);
  executePolitical(state,{kind:'chooseLaw',patch:{},actions:[copy(a)],title:a.kind==='restructure'?'Обмен государственного долга':'Передача собственности'});
  draft=plannedPolicy(state);
}
function policyValue(key,value){
  if(value&&typeof value==='object')return value.kind==='restructure'?'Списание до '+pct(value.haircut*100)+'; срок '+value.extension+' мес.':actionName(value.kind)+' · до '+n(value.points??0,1)+' п.п.';
  const enumValues={'constitution.form':FORMS,'constitution.electoralSystem':ELECTORAL_SYSTEMS,'constitution.presidentSystem':PRESIDENT_SYSTEMS,'constitution.regime':REGIMES,'constitution.confidence':{constructive:'Конструктивный: требуется новый кабинет большинства',ordinary:'Обычный'},'constitution.playerRole':{president:'Президент',primeMinister:'Премьер-министр'}};
  if(enumValues[key])return enumValues[key][value]??value;
  if(['constitution.overrideFraction','constitution.constitutionalFraction'].includes(key))return pct(value*100)+' мест парламента';
  if(typeof value==='boolean')return value?'Включено':'Выключено';
  const choice=POLICY_CHOICES.find(f=>f[0]===key);if(choice)return choice[3].find(x=>x[0]===value)?.[1]??value;
  const field=POLICY_FIELDS.find(f=>f[0]===key);return typeof value==='number'?n(value,field?.[4]<1?2:0)+(field?' '+field[5]:''):String(value??'—');
}
function decisionResult(){
 if(resultExecutive){const d=resultExecutive;return `<h3>Решение принято</h3><p>${esc(decisionName(d.key))}: <b>${esc(policyValue(d.key,d.from))} → ${esc(policyValue(d.key,d.to))}</b></p><p>Изменение действует со следующего месяца.</p>`;}
 const b=state.politics.bills.find(b=>b.id===resultBillId);if(!b)return '';
 const accepted=['passed','enacted'].includes(b.status),failed=b.articles.filter(a=>a.vote&&!a.vote.passed),vote=b.finalVote??failed[0]?.vote;
 const reason=b.referendum&&!b.referendum.passed?'Парламент одобрил поправку, но референдум её отклонил.':failed.length?'Не все статьи набрали требуемое число голосов. Весь пакет отклонён.':b.finalVote&&!b.finalVote.passed?'Не набран порог в окончательном голосовании.':b.status==='vetoed'?'Президент наложил вето.':b.status==='declined'?'Исполнительная власть отказала в поддержке.':'';
 return `<h3 class="${accepted?'positive':'negative'}">${accepted?(b.byDecree?'Принято указом':'Решение принято'):'Решение не принято'}</h3><p><strong>${esc(b.title)}</strong></p>${reason?`<p>${reason}</p>`:''}${vote?`<div class="vote-totals"><span>За: <b>${vote.yes}</b></span><span>Против: <b>${vote.no}</b></span><span>Воздержались: <b>${vote.abstain}</b></span><span>Нужно: <b>${vote.required}</b>${!vote.passed?' · не хватает '+Math.max(0,vote.required-vote.yes):''}</span></div>`:''}${b.referendum?`<p>Референдум: за ${pct(b.referendum.yesShare)}. Требуется больше 50%.</p>`:''}<div class="decision-changes">${b.articles.map(a=>`<div><strong>${esc(a.key.startsWith('constitution.')?decisionName(a.key):a.label)}</strong><span>Было: ${esc(policyValue(a.key,a.before))}</span><span>Станет: ${esc(policyValue(a.key,a.value))}</span>${a.vote?`<small>За ${a.vote.yes} из требуемых ${a.vote.required} · ${a.vote.passed?'статья одобрена':'статья отклонена'}</small>`:''}</div>`).join('')}</div><p class="small muted">${accepted?'Изменения вступят в силу при расчёте следующего месяца.':'Отклонённые изменения не вступают в силу.'}</p>`;
}
function snapshotDecisions(){
 observedDecisionKeys=new Set((state.politics.bills??[]).filter(b=>b.decidedMonth!==undefined).map(b=>'bill:'+b.id+':'+b.decisionSequence));
 if(state.politics.lastDecision)observedDecisionKeys.add('executive:'+JSON.stringify(state.politics.lastDecision));
}
function detectDecisionResult(){
 for(const b of state.politics.bills??[]){if(b.decidedMonth===undefined)continue;const key='bill:'+b.id+':'+b.decisionSequence;if(observedDecisionKeys.has(key))continue;observedDecisionKeys.add(key);if(['vetoed','declined'].includes(b.status)){resultBillId=null;resultExecutive=null;proposalOpen=false;continue;}resultBillId=b.id;resultExecutive=null;proposalOpen=false;trendMetric=null;}
 const d=state.politics.lastDecision;if(d?.kind==='executive'){const key='executive:'+JSON.stringify(d);if(!observedDecisionKeys.has(key)){observedDecisionKeys.add(key);resultExecutive=copy(d);resultBillId=null;proposalOpen=false;trendMetric=null;}}
}
function bindUsage(){
 usage.context({seed:state.seed,startYear:state.startYear,month:state.month});
 for(const [id,c] of Object.entries(CATEGORIES)){usage.register('category:'+id,c.label,'category');for(const [key,label] of c.views)usage.register('view:'+key,label,'view');}
 for(const [id,info] of Object.entries(METRIC_INFO))usage.register('graph:'+id,info.label,'graph');
 for(const id of ['proposal','result','new','settings','campaign'])usage.register('window:'+id,({proposal:'Предложение партии',result:'Результат решения',new:'Новая игра',settings:'Настройки',campaign:'Предвыборное событие'})[id],'window');
 for(const label of ['Кредит','Налоги','Бюджет','Валюта','Структура','Инфраструктура','Услуги','Труд','Институты'])usage.register('policy:'+label,label,'policy');
 const current=view&&openCategory?'view:'+view:null;
 const changed=trackedView!==current;if(changed){if(trackedView)usage.close(trackedView);for(const x of usage.report().summary.targets)if(x.kind==='detail')usage.close(x.id);trackedView=current;}
 const windows=new Set([...(campaignOpen&&!proposalOpen&&!settingsOpen&&resultBillId===null&&!resultExecutive&&(campaignEvent(state)||campaignFeedback)?['window:campaign']:[]),...(settingsOpen?['window:settings']:[]),...(document.getElementById('new-dialog')?.open?['window:new']:[]),...(proposalOpen?['window:proposal']:[]),...(trendMetric?['graph:'+trendMetric]:[]),...(resultBillId!==null||resultExecutive?['window:result']:[])]);
 for(const id of trackedWindows)if(!windows.has(id))usage.close(id);
 for(const id of windows)if(!trackedWindows.has(id))usage.open(id,id.startsWith('graph:')?METRIC_INFO[id.slice(6)].label:id==='window:proposal'?'Предложение партии':id==='window:new'?'Новая игра':id==='window:settings'?'Настройки':id==='window:campaign'?'Предвыборное событие':'Результат решения',id.startsWith('graph:')?'graph':'window',id==='window:result'?'decision':'interface');
 trackedWindows=windows;
 const categoryId=openCategory?'category:'+openCategory:null;if(trackedCategory!==categoryId){if(trackedCategory)usage.close(trackedCategory);trackedCategory=categoryId;}
 const policyId=view==='policy'&&policyTab?'policy:'+policyTab:null;if(trackedPolicy!==policyId){if(trackedPolicy)usage.close(trackedPolicy);trackedPolicy=policyId;}
 if(!windows.size){if(categoryId)usage.open(categoryId,CATEGORIES[openCategory].label,'category','return');if(policyId)usage.open(policyId,policyTab,'policy','return');}else{if(categoryId)usage.close(categoryId);if(policyId)usage.close(policyId);}
 if(windows.size){for(const x of usage.report().summary.targets)if(x.kind==='detail')usage.close(x.id);if(trackedView)usage.close(trackedView);}
 else if(trackedView)usage.open(trackedView,Object.values(CATEGORIES).flatMap(x=>x.views).find(([id])=>id===view)?.[1]??view,'view',changed?'navigation':'return');
 sectionObserver?.disconnect();
 if(typeof IntersectionObserver==='function'){
  sectionObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting&&e.intersectionRect.height>=Math.min(80,e.boundingClientRect.height*.25)&&!trackedWindows.size)usage.event('observed',e.target.dataset.observationId);},{threshold:[0,.01,.025,.05,.1,.25,.5,1]});
  for(const [i,panel] of [...(app.querySelectorAll?.('#view-content .panel')??[])].entries()){
   const label=panel.querySelector('h2,h3')?.textContent?.trim()??'Блок '+(i+1),id='block:'+view+':'+i;panel.dataset.observationId=id;usage.register(id,label,'block');sectionObserver.observe(panel);
  }
 }
 usage.flush();
}
async function step(count) {
  if(busy)return;
  if(state.politics.enabled&&unresolvedInitiatives(state).length){proposalId=unresolvedInitiatives(state)[0].id;proposalOpen=true;trendMetric=null;render();return;}
  if(state.politics.enabled)count=1;
  busy=true;render();await new Promise(r=>setTimeout(r,0));
  try {if(state.politics.enabled)for(const key of pending())commitChoice(key);state=runMonths(state,count,state.politics.enabled?state.policy:draft);if(state.politics.enabled){draft=plannedPolicy(state);}comparison=null;comparisonBase=null;mobileOpen=false;persist();}
  catch(e){toast('Расчёт остановлен: '+e.message);console.error(e);}
  busy=false;render();
}
async function calculateCompare() {
  if(busy)return;busy=true;render();await new Promise(r=>setTimeout(r,0));
  try {
    const origin=compareSource==='checkpoint'&&checkpoint?checkpoint:comparisonBase??state;
    comparison=comparePolicies(origin,origin.policy,draft,compareMonths);
    toast(`Рассчитаны ${compareMonths} месяцев. Основной эксперимент остался на прежней дате.`);
  }catch(e){toast('Сравнение остановлено: '+e.message);console.error(e);}
  busy=false;render();
}
function exportCSV() {
  const fields=['month','population','births','deaths','naturalIncrease','totalFertilityRate','lifeExpectancy','elderlyShare','dependencyRatio','realGDPAnnualized','realGDPRolling','gdpUSDRolling','realGDPMonthly','nominalGDPMonthly','gdpPerCapitaReal','inflationYoY','inflationMonthly','unemployment','debtRatio','deficitRatio','exchangeRate','reservesUSD','realIncomeIndex','investment','capitalRatio','npl','giniDisposable','giniMarket','hdi','meanWageNominal','meanWageReal','meanWageUSD','medianEquivalentIncomeReal','relativePoverty','stateAssetShare','stateOutputShare','defaultEpisodes','debtInDefault','liquidityCoverage','leverageRatio','marketContestability','bankContestability','contractReliability','registrationDays','contractDelayDays','antitrustCapacity','courtCapacity','soeAuditCapacity','privateInfrastructureShare','corporateInfrastructureShare','infrastructureMaintenanceCoverage','concessionExposure','totalHealthAccess','totalEducationAccess','unionDensity','bargainingCoverage','strikeHours','judicialIndependence','mediaFreedom','electoralIntegrity','legislativeConstraint','civilFreedom','corruptionRisk','publicSupport','effectivePolicyRate','monetaryReserveCoverage','infrastructureFeeIndex','executiveApproval','presidentApproval','cabinetApproval','officialApproval','governmentPartyRating','presidentialCandidateRating','eligibleVoters','expectedTurnout','coalitionSeatShare','inOffice'];
  const lines=[fields.join(';'),...state.history.filter(x=>x.month>=0).map(x=>fields.map(k=>String(x[k]??'')).join(';'))];
  download('economy-monthly-data.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
}

app.addEventListener('click',async event=>{
  const target=event.target.closest('button,a');if(!target)return;
  usage.event('click',target.dataset.campaignChoice!==undefined?'campaign:'+target.dataset.campaignChoice:target.dataset.graph?'graph:'+target.dataset.graph:target.dataset.view?'view:'+target.dataset.view:target.dataset.category?'category:'+target.dataset.category:target.dataset.action?'action:'+target.dataset.action:target.dataset.politicalAction?'political:'+target.dataset.politicalAction:target.dataset.policyTab?'policy:'+target.dataset.policyTab:target.dataset.chart?'chart:'+target.dataset.chart:'link_or_control');
  if(target.dataset.action==='campaign-open'){campaignOpen=true;campaignFeedback=null;proposalOpen=false;render();return;}
  if(target.dataset.action==='campaign-close'){campaignOpen=false;campaignFeedback=null;render();return;}
  if(target.dataset.campaignChoice!==undefined){try{campaignFeedback=executePolitical(state,{kind:'campaignResponse',eventId:target.dataset.eventId,choice:Number(target.dataset.campaignChoice)});persist();render();}catch(e){toast(e.message);}return;}
  if(target.dataset.action==='settings-open'){settingsOpen=true;proposalOpen=false;trendMetric=null;resultBillId=null;resultExecutive=null;render();return;}
  if(target.dataset.action==='settings-close'){settingsOpen=false;render();return;}
  if(settingsOpen&&target.dataset.action){settingsOpen=false;render();}
  if(target.dataset.action==='result-close'){resultBillId=null;resultExecutive=null;render();return;}
  if(target.dataset.graph){resultBillId=null;resultExecutive=null;trendMetric=target.dataset.graph;proposalOpen=false;render();return;}
  if(target.dataset.action==='proposal-open'){const b=unresolvedInitiatives(state)[0];if(b){proposalId=b.id;proposalOpen=true;trendMetric=null;}render();return;}
  if(target.dataset.action==='proposal-close'){proposalOpen=false;render();return;}
  if(target.dataset.action==='trend-close'){trendMetric=null;render();return;}
  if(target.dataset.politicalAction){try{comparisonBase??=copy(state);handlePoliticalAction(state,target.dataset,id=>document.getElementById(id));draft=plannedPolicy(state);comparison=null;persist();render();}catch(e){toast(e.message);}return;}
  if(target.dataset.category){openCategory=openCategory===target.dataset.category?null:target.dataset.category;view=null;render();return;}
  if(target.dataset.view){event.preventDefault();if(!Object.values(CATEGORIES).some(c=>c.views.some(([id])=>id===target.dataset.view)))return;const id=target.dataset.view;openCategory=Object.keys(CATEGORIES).find(key=>CATEGORIES[key].views.some(([v])=>v===id));view=view===id?null:id;render();return;}
  if(target.dataset.policyTab){openCategory='decisions';view='policy';policyTab=policyTab===target.dataset.policyTab?null:target.dataset.policyTab;render();return;}
  if(target.dataset.chart){chartMetric=target.dataset.chart;render();return;}
  if(target.dataset.compareChart){compareMetric=target.dataset.compareChart;render();return;}
  if(target.dataset.journalPage!==undefined){journalPage=Number(target.dataset.journalPage);render();return;}
  if(target.dataset.cancelAction){state.pendingActions=state.pendingActions.filter(a=>a.id!==Number(target.dataset.cancelAction));comparison=null;persist();render();return;}
  if(target.dataset.shock){
    const presets={commodity:['commodityPrice',.70],energy:['energyPrice',1.30],demand:['foreignDemand',.85],weather:['weather',.80],supply:['importAvailability',.70]};
    const [key,multiplier]=presets[target.dataset.shock];scheduleShock(state,{key,multiplier,duration:12});comparison=null;persist();render();toast('Шок запланирован со следующего месяца.');return;
  }
  if(target.dataset.removeShock!==undefined){const i=Number(target.dataset.removeShock);if(state.shocks[i]?.start>state.month){state.shocks.splice(i,1);persist();comparison=null;render();}return;}
  switch(target.dataset.action) {
    case 'step':await step(1);break;
    case 'run3':await step(3);break;
    case 'run12':await step(12);break;
    case 'controls':mobileOpen=!mobileOpen;render();break;
    case 'compare-view':break;
    case 'compare':await calculateCompare();break;
    case 'cancel-policy':draft=state.politics.enabled?plannedPolicy(state):copy(state.policy);comparison=null;persist();render();break;
    case 'legacy-export':{const old=JSON.parse(legacySave);download('economy-original-previous-version.json',old.simulation);toast('Прежний эксперимент скачан без изменения его данных.');break;}
    case 'export':{const payload=JSON.parse(exportSimulation(state));payload.draftPolicy=copy(draft);payload.uiObservation=usage.report();download(`economy-${date(state.month,true)}.json`,JSON.stringify(payload,null,2));toast('Сохранены счета, параметры, внешние шоки и подготовленные решения.');break;}
    case 'import':document.getElementById('import-file').click();break;
    case 'csv':exportCSV();break;
    case 'usage-export':usage.event('export','ui-observation');download(`interface-${date(state.month,true)}.json`,JSON.stringify(usage.report(),null,2));break;
    case 'ownership-queue':try{assertDecisionAvailable(state,{kind:'chooseLaw'});scheduleOwnership(state,{sector:Number(document.getElementById('ownership-sector').value),kind:document.getElementById('ownership-kind').value,points:Number(document.getElementById('ownership-points').value),compensation:Number(document.getElementById('ownership-compensation').value)/100});votePendingOperation();persist();comparison=null;render();toast(state.politics.enabled?'Результат голосования показан сразу.':'Операция записана; исполнение со следующего месяца.');}catch(e){toast(e.message);}break;
    case 'network-queue':try{assertDecisionAvailable(state,{kind:'chooseLaw'});scheduleNetwork(state,{network:document.getElementById('network-id').value,kind:document.getElementById('network-kind').value,points:Number(document.getElementById('network-points').value)});votePendingOperation();persist();comparison=null;render();toast(state.politics.enabled?'Результат голосования показан сразу.':'Передача инфраструктуры запланирована.');}catch(e){toast(e.message);}break;
    case 'restructure-queue':try{assertDecisionAvailable(state,{kind:'chooseLaw'});scheduleRestructuring(state,{haircut:Number(document.getElementById('debt-haircut').value)/100,extension:Number(document.getElementById('debt-extension').value)});votePendingOperation();persist();comparison=null;render();toast(state.politics.enabled?'Голосование по обмену долга завершено.':'Обмен запланирован. Потеря приведённой стоимости будет считаться дефолтом.');}catch(e){toast(e.message);}break;
    case 'journal-export':download(`economy-decisions-${date(state.month,true)}.json`,JSON.stringify({format:'economy-decisions',version:VERSION,provenance:state.provenance,journal:state.journal,currentTurnPoliticalCommands:state.politics.turnCommands??[]},null,2));break;
    case 'replay':if(!busy){busy=true;render();await new Promise(r=>setTimeout(r,0));try{const replay=replayJournal(state);const errors=Object.entries(state.metrics).map(([k,v])=>Math.abs(v-replay.metrics[k])/Math.max(1,Math.abs(v)));toast(Math.max(...errors)<1e-10?'Журнал точно воспроизвёл текущие показатели.':'Журнал не воспроизвёл результат: проверьте версию и данные.');}catch(e){toast('Воспроизведение остановлено: '+e.message);}busy=false;render();}break;
    case 'new':if(trackedView)usage.close(trackedView);if(trackedCategory)usage.close(trackedCategory);if(trackedPolicy)usage.close(trackedPolicy);usage.open('window:new','Новая игра','window');document.getElementById('new-dialog').showModal();break;
    case 'checkpoint':
      checkpoint=copy(state);try{await storage.set(CHECKPOINT,JSON.stringify({format:'economy-model',version:VERSION,state:checkpoint}));toast('Точка сравнения сохранена.');}catch(e){toast('Точка сохранена только на время этой сессии. Скачайте файл.');}comparison=null;render();break;
    case 'restore':if(checkpoint){campaignOpen=false;campaignFeedback=null;announcedCampaign=null;proposalOpen=false;trendMetric=null;resultBillId=null;resultExecutive=null;announcedProposal=null;state=copy(checkpoint);enableInstantPolitics(state);if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.agendaSlots!==1)executePolitical(state,{kind:'setAgendaSlots',slots:1});if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.decisionLimit!==3)executePolitical(state,{kind:'setDecisionLimit',limit:3});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.dashboardMode)executePolitical(state,{kind:'setDashboardMode'});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.partyContinuity)executePolitical(state,{kind:'setPartyContinuity'});draft=state.politics.enabled?plannedPolicy(state):copy(state.policy);comparisonBase=null;comparison=null;snapshotDecisions();persist();render();toast('Эксперимент восстановлен из сохранённой точки.');}break;
  }
});
app.addEventListener('input',event=>{
  const e=event.target;
  if(e.dataset.policy)updateDraft(e.dataset.policy,e.value);
  if(e.dataset.policyNumber&&e.value!=='')updateDraft(e.dataset.policyNumber,e.value);
  if(e.hasAttribute?.('data-note')){state.pendingNote=e.value.slice(0,1000);persist();}
  const param=e.dataset.parameter??e.dataset.parameterNumber;
  if(param&&e.value!=='') {
    const field=PARAMETER_FIELDS.find(f=>f[0]===param);if(!field)return;
    const val=Math.max(field[2],Math.min(field[3],Number(e.value)));if(!Number.isFinite(val))return;
    state.parameters[param]=val;
    app.querySelector(`[data-parameter="${param}"]`).value=val;
    const num=app.querySelector(`[data-parameter-number="${param}"]`);if(num!==e)num.value=val;
    comparison=null;persist();
  }
});
app.addEventListener('change',event=>{
  const e=event.target;
  for(const key of ['electorateDimension','electorateMeasure','electorateParty'])if(e.dataset[key])usage.event('filter','electorate:'+key,{selection:key==='electorateParty'?String(e.value).slice(0,30):e.value});
  if(e.dataset.policyNumber||e.dataset.policyCheck||e.dataset.policyChoice)usage.event('change','policy-field:'+(e.dataset.policyNumber??e.dataset.policyCheck??e.dataset.policyChoice));
  if(e.dataset.electorateDimension){electorateDimension=e.value;render();return;}
  if(e.dataset.electorateMeasure){electorateMeasure=e.value;render();return;}
  if(e.dataset.electorateParty){electorateParty=e.value;render();return;}
  if(e.dataset.policyChoice){draft[e.dataset.policyChoice]=e.value;commitChoice(e.dataset.policyChoice);comparison=null;persist();render();return;}
  if(e.dataset.policy||e.dataset.policyNumber){const key=e.dataset.policy??e.dataset.policyNumber;if(e.value===''){draft[key]=(state.politics.enabled?plannedPolicy(state):state.policy)[key];render();return;}updateDraft(key,e.value);commitChoice(key);render();return;}
  if(e.dataset.policyCheck){draft[e.dataset.policyCheck]=e.checked;commitChoice(e.dataset.policyCheck);comparison=null;persist();render();}
  if(e.dataset.world&&e.value!=='') {
    const val=Math.max(Number(e.min),Math.min(Number(e.max),Number(e.value)));
    if(Number.isFinite(val)){state.world[e.dataset.world]=val;e.value=val;comparison=null;persist();}
  }
  if(e.hasAttribute('data-stochastic')){state.stochastic=e.checked;comparison=null;persist();}
  if(e.id==='compare-source'){compareSource=e.value;comparison=null;render();}
  if(e.id==='compare-months'){compareMonths=Number(e.value);comparison=null;render();}
});
app.addEventListener('keydown',event=>{
  const e=event.target;if(event.key!=='Enter'||!e.dataset?.policyNumber)return;
  event.preventDefault();if(e.value!==''){updateDraft(e.dataset.policyNumber,e.value);commitChoice(e.dataset.policyNumber);render();}
});
app.addEventListener('pointermove',event=>{
  const rect=event.target.closest('[data-chart-tip]');if(!rect)return;
  const tip=rect.closest('.chart-wrap').querySelector('.chart-tip');if(tip)tip.textContent=rect.dataset.chartTip;
});
const governmentSelect=document.getElementById('new-government'),countrySelect=document.getElementById('new-country');
governmentSelect.innerHTML=Object.entries(GOVERNMENT_PRESETS).map(([id,p])=>`<option value="${id}">${esc(p.label)}</option>`).join('');
countrySelect.innerHTML=Object.entries(COUNTRY_PRESETS).map(([id,p])=>`<option value="${id}">${esc(p.label)} · $${n(p.gdp,0)} / человек</option>`).join('');
document.getElementById('new-party').innerHTML=PARTY_FAMILIES.map(p=>`<option value="${p.id}" ${p.id==='liberal'?'selected':''}>${esc(partyDisplayName({id:'p1',family:p.id}))}</option>`).join('');
governmentSelect.value='presidential';countrySelect.value='middle';
function updateStartDescription(){
 document.getElementById('new-government-description').textContent=GOVERNMENT_PRESETS[governmentSelect.value].description;
 const c=COUNTRY_PRESETS[countrySelect.value];
 document.getElementById('new-country-description').textContent=`Стартовый ВВП — $${n(c.gdp,0)} на человека в ценах 2000 года. Рождаемость — ${n(c.fertility,1)} ребёнка на женщину. Возрастной состав задан профилем страны; далее население меняется каждый месяц. Это условный сценарий, а не копия реальной страны.`;
}
governmentSelect.addEventListener('change',updateStartDescription);countrySelect.addEventListener('change',updateStartDescription);updateStartDescription();
document.getElementById('new-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=new FormData(event.target);
  try{state=createSimulation(newGameOptions({government:form.get('government')??'presidential',country:form.get('country')??'middle',party:form.get('party')??'liberal',resource:form.get('resource')==='true'}));}catch(e){toast(e.message);return;}
  campaignOpen=false;campaignFeedback=null;announcedCampaign=null;proposalOpen=false;trendMetric=null;resultBillId=null;resultExecutive=null;announcedProposal=null;
  draft=state.politics.enabled?plannedPolicy(state):copy(state.policy);comparison=null;comparisonBase=null;view=state.politics.enabled?'policy':'country';checkpoint=null;mobileOpen=false;journalPage=0;
  try{await storage.set(CHECKPOINT,'');}catch(e){toast('Не удалось очистить прежнюю точку сравнения на устройстве.');}
  usage.close('window:new');snapshotDecisions();openCategory=state.politics.enabled?'decisions':'statistics';persist();document.getElementById('new-dialog').close();render();
});
document.querySelector('.dialog-close').addEventListener('click',()=>{usage.close('window:new');usage.flush();document.getElementById('new-dialog').close();bindUsage();});
document.getElementById('new-dialog').addEventListener('close',()=>{usage.close('window:new');bindUsage();});
document.getElementById('new-dialog').addEventListener('cancel',()=>{usage.close('window:new');usage.flush();bindUsage();});
document.getElementById('import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>100*1024*1024)throw new Error('Файл больше 100 МБ');const text=await file.text();const loaded=importSimulation(text);const loadedDraft=sanitizePolicy(JSON.parse(text).draftPolicy??loaded.policy);state=loaded;campaignOpen=false;campaignFeedback=null;announcedCampaign=null;proposalOpen=false;trendMetric=null;resultBillId=null;resultExecutive=null;announcedProposal=null;enableInstantPolitics(state);if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.agendaSlots!==1)executePolitical(state,{kind:'setAgendaSlots',slots:1});if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.decisionLimit!==3)executePolitical(state,{kind:'setDecisionLimit',limit:3});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.dashboardMode)executePolitical(state,{kind:'setDashboardMode'});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.partyContinuity)executePolitical(state,{kind:'setPartyContinuity'});draft=state.politics.enabled?plannedPolicy(state):loadedDraft;comparison=null;comparisonBase=null;view=state.politics.enabled?'policy':'country';openCategory=state.politics.enabled?'decisions':'statistics';journalPage=0;snapshotDecisions();persist();render();toast('Эксперимент восстановлен.');}
  catch(e){toast('Не удалось открыть сохранение: '+e.message);}event.target.value='';
});
app.addEventListener('toggle',event=>{const el=event.target;if(el.tagName!=='DETAILS')return;const label=el.querySelector('summary')?.textContent?.trim();if(label){const id='detail:'+String(view)+':'+label.slice(0,100);if(el.open)usage.open(id,label,'detail');else usage.close(id);usage.flush();}},true);
globalThis.addEventListener?.('pagehide',()=>{usage.closeAll();usage.flush();});
document.addEventListener?.('visibilitychange',()=>{usage.visibility(document.visibilityState!=='hidden');if(document.visibilityState!=='hidden'){trackedView=null;trackedWindows=new Set();bindUsage();}usage.flush();});
render();

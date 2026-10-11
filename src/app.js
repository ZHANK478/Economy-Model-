import {validation} from './validation-results.js';
import {createSimulation,advanceMonth,runMonths,comparePolicies,exportSimulation,importSimulation,accountBalances,scheduleShock,scheduleOwnership,scheduleRestructuring,replayJournal,copy,sanitizePolicy,realInterestRate} from './engine.js';
import {VERSION,POLICY_FIELDS,POLICY_CHECKS,PARAMETER_FIELDS,MODULES,SECTORS,BASE_POLICY,MODEL_PROFILES} from './config.js';
import {createBrowserStorage} from './storage.js';

const STORE='economy-model-v31',CHECKPOINT='economy-checkpoint-v31';
const storage=createBrowserStorage();
let legacySave=null;
try{legacySave=await storage.get('economy-model-v3')??localStorage.getItem('economy-model-v2')??localStorage.getItem('economy-model-v1');}catch{/* Do not overwrite inaccessible older data. */}
const app=document.getElementById('app');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(x,d=1)=>Number.isFinite(Number(x))?Number(x).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const signed=(x,d=1)=>(x>0?'+':'')+n(x,d);
const money=x=>n(x/1000,2);
const pct=x=>n(x,1)+'%';
const months=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const date=(month,short=false)=>short?`${String(month%12+1).padStart(2,'0')}.${2026+Math.floor(month/12)}`:`${months[month%12]} ${2026+Math.floor(month/12)}`;
const iconCheck='<span class="tick">✓</span>';
let state=createSimulation(),draft=copy(state.policy),checkpoint=null,comparison=null;
let view='country',policyTab='Кредит',chartMetric='gdpPerCapitaReal',compareMetric='gdpPerCapitaReal',compareMonths=24,compareSource='current',journalPage=0;
let mobileOpen=false,busy=false,toastTimer,saveStatus='Сохраняется на этом устройстве';
try {
  const saved=await storage.get(STORE);
  if(saved){const wrapper=JSON.parse(saved);state=importSimulation(wrapper.simulation);draft=sanitizePolicy(wrapper.draft);}
  const snap=await storage.get(CHECKPOINT);if(snap) checkpoint=importSimulation(snap);
} catch(e) {setTimeout(()=>toast('Не удалось прочитать сохранение. Открыты исходные условия.'),0);}

function toast(message) {
  const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);
}
function persist() {
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
const pending=()=>Object.keys(draft).filter(key=>draft[key]!==state.policy[key]);
const previous=()=>state.history.find(x=>x.month===state.month-1)??state.metrics;

const chartOptions=[['gdpPerCapitaReal','ВВП / человек'],['inflationYoY','Инфляция'],['unemployment','Безработица'],['debtRatio','Госдолг'],['realGDPAnnualized','Общий ВВП'],['population','Население'],['giniDisposable','Джини'],['hdi','ИЧР']];
const metricNames={gdpPerCapitaReal:'Реальный ВВП на человека',inflationYoY:'Инфляция за 12 месяцев',unemployment:'Безработица',debtRatio:'Госдолг / ВВП',exchangeRate:'Курс валюты',realGDPAnnualized:'Общий реальный ВВП, млн в базовых ценах · годовой темп',population:'Население, млн',giniDisposable:'Джини располагаемых доходов · 0–100',hdi:'ИЧР · модельная оценка'};
function chart(series,key,{compare=false}={}) {
  const data=series.map(x=>({...x,points:x.points.filter(p=>p.month>=0&&Number.isFinite(p[key]))}));
  const points=data.flatMap(x=>x.points);
  if(points.length<2||new Set(points.map(p=>p.month)).size<2) return '<div class="chart-empty"><div><strong>Первое решение — начало графика</strong><br>Измените политику и перейдите к следующему месяцу.</div></div>';
  const W=780,H=260,left=52,right=18,top=18,bottom=36;
  let lo=Math.min(...points.map(p=>p[key])),hi=Math.max(...points.map(p=>p[key]));
  const padding=Math.max((hi-lo)*.15,key==='hdi'?.005:key==='gdpPerCapitaReal'?50:key==='exchangeRate'?.02:.5);
  lo-=padding;hi+=padding;
  const from=Math.min(...points.map(p=>p.month)),to=Math.max(...points.map(p=>p.month));
  const x=m=>left+(m-from)/(to-from)*(W-left-right);
  const y=v=>top+(hi-v)/(hi-lo)*(H-top-bottom);
  let out=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(metricNames[key])}, помесячный график">`;
  for(let i=0;i<5;i++) {
    const val=lo+(hi-lo)*i/4,py=y(val);
    out+=`<line x1="${left}" y1="${py}" x2="${W-right}" y2="${py}" stroke="#e8ede3"/><text x="${left-9}" y="${py+4}" text-anchor="end" fill="#849083" font-size="10">${n(val,key==='hdi'?3:key==='gdpPerCapitaReal'?0:1)}</text>`;
  }
  if(!compare&&data[0].points.length>1) {
    const line=data[0].points.map(p=>`${x(p.month)},${y(p[key])}`).join(' ');
    out+=`<defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#86b095" stop-opacity=".24"/><stop offset="100%" stop-color="#86b095" stop-opacity="0"/></linearGradient></defs><polygon points="${x(from)},${H-bottom} ${line} ${x(to)},${H-bottom}" fill="url(#chart-fill)"/>`;
  }
  data.forEach((s,j)=>{
    const poly=s.points.map(p=>`${x(p.month)},${y(p[key])}`).join(' ');
    out+=`<polyline points="${poly}" fill="none" stroke="${j===0?'#347b62':'#bc8b47'}" stroke-width="2.4" ${j===0&&compare?'stroke-dasharray="5 4"':''} stroke-linecap="round" stroke-linejoin="round"/>`;
    const end=s.points.at(-1);if(end) out+=`<circle cx="${x(end.month)}" cy="${y(end[key])}" r="3.5" fill="${j===0?'#347b62':'#bc8b47'}" stroke="white" stroke-width="2"/>`;
  });
  for(let i=0;i<5;i++) {const month=Math.round(from+(to-from)*i/4);out+=`<text x="${x(month)}" y="${H-10}" fill="#849083" text-anchor="middle" font-size="10">${date(month,true)}</text>`;}
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
  return `<svg class="spark" viewBox="0 0 65 29" aria-hidden="true"><polyline points="${points}" fill="none" stroke="#609b75" stroke-width="1.4"/></svg>`;
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
  return '<div class="kpis">'+data.map(([key,name,value,unit,higher,pp])=>{
    const delta=m[key]-prev[key],color=state.month===0||Math.abs(delta)<.001?'neutral':((delta>0)===higher?'positive':'negative');
    const formatted=state.month===0?'Исходные условия':`${signed(delta,key==='exchangeRate'?3:1)} ${pp?'п.п.':''} за ход`;
    return `<div class="kpi"><div class="name">${name}</div><div class="value">${value} <span class="unit">${unit}</span></div><div class="change ${color}">${formatted}</div>${spark(key)}</div>`;
  }).join('')+'</div>';
}
function policyControls() {
  return POLICY_FIELDS.filter(x=>x[6]===policyTab).map(([key,name,min,max,step,unit,,help])=>`
    <div class="policy-control"><div class="control-title"><label for="policy-${key}">${name}</label><output class="control-value" id="value-${key}">${n(draft[key],step<1?2:0)}</output></div>
    <input id="policy-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${draft[key]}" data-policy="${key}" aria-label="${name}">
    <div class="control-meta"><span>${esc(unit)}</span><input type="number" class="number-entry" min="${min}" max="${max}" step="${step}" value="${draft[key]}" data-policy-number="${key}" aria-label="${name}, точное значение"></div>
    <div class="policy-help">${help}</div></div>`).join('');
}
function sidebar() {
  const changes=pending();
  return `<aside class="sidebar ${mobileOpen?'open':''}"><div class="sidebar-head"><div><span class="eyebrow">ВАША РОЛЬ · ГОСУДАРСТВО</span><h2>Экономическая политика</h2></div>${mobileOpen?'<button class="dark-button" data-action="controls" aria-label="Закрыть">×</button>':''}</div>
    <p class="small muted">Решения действуют со следующего месяца. Реакция экономики занимает время.</p>
    <div class="policy-tabs">${['Кредит','Налоги','Бюджет','Валюта','Структура'].map(t=>`<button data-policy-tab="${t}" class="${t===policyTab?'active':''}">${t}</button>`).join('')}</div>
    <div id="policy-controls">${policyControls()}</div>
    <div class="policy-checks">${POLICY_CHECKS.filter(f=>f[2]===policyTab).map(([key,label,,help])=>`<label class="check"><input type="checkbox" data-policy-check="${key}" ${draft[key]?'checked':''}> ${esc(label)}</label><p class="policy-help">${esc(help)}</p>`).join('')}</div>
    ${policyTab==='Структура'?'<p class="small muted">Здесь задаются правила и бюджеты. Фактические сроки, исполнение и управление — в разделе «Институты», их нельзя установить ползунком.</p>':''}
    <div class="policy-foot"><div class="policy-summary"><span>Ожидаемая реальная ставка</span><strong id="real-rate">${n(realInterestRate(draft.rate/100,state.expectedInflation)*100,1)}%</strong></div>
      <div id="pending-note" class="policy-pending">${changes.length?`Изменено решений: ${changes.length}`:'Текущая политика сохранена'}</div>
      <button class="primary wide" data-action="step" ${busy?'disabled':''}>${busy?'Вычисление…':'Следующий месяц'} <span aria-hidden="true">→</span></button>
      <div style="display:flex;gap:8px"><button class="secondary" data-action="run3" ${busy?'disabled':''}>+3 месяца</button><button class="secondary" data-action="run12" ${busy?'disabled':''}>+12 месяцев</button></div>
      <button class="secondary wide" data-action="compare-view">Сравнить с прежней политикой</button>
      <button class="secondary wide" data-action="cancel-policy" id="cancel-policy" ${changes.length?'':'disabled'}>Отменить изменения решений</button>
      <label class="field">Гипотеза или причина решения<textarea id="decision-note" data-note maxlength="1000" placeholder="Например: снизить инфляцию, сохранив занятость">${esc(state.pendingNote)}</textarea></label>
    </div></aside>`;
}
function row(label,value,meta='') {return `<div class="data-row"><div>${label}${meta?`<div class="meta">${meta}</div>`:''}</div><b>${value}</b></div>`;}
function bar(label,value,display,color='#89b899') {return `<div class="bar-row"><div class="bar-title"><span>${label}</span><b>${display}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,value))}%;background:${color}"></div></div></div>`;}
function country() {
  const m=state.metrics,annualPopulation=state.history.filter(r=>r.month>=state.month-11).reduce((v,r)=>v+r.population,0)/12;
  const development=m.hdi>=.8?'очень высокий':m.hdi>=.7?'высокий':m.hdi>=.55?'средний':'низкий';
  return `<section class="panel country-lead"><span class="eyebrow">ПАСПОРТ СТРАНЫ · ${date(state.month,true)}</span><h2>Вымышленная республика</h2><p>${state.resourceMode?'Страна с большой ролью сырьевого экспорта':'Страна с диверсифицированным экспортом'}, население ${n(m.population,2)} млн человек. Реальный выпуск на человека — ${n(m.gdpPerCapitaReal,0)} в ценах начала игры. Модельный уровень человеческого развития — ${development}.</p><p class="small muted">Это справочник о вашей стране, не официальный рейтинг. Денежные величины в базовых ценах, текущих долларах и по условному ППС различаются.</p></section>
    <div class="two-cols"><section class="panel"><h2>Экономика</h2>${row('ВВП · номинальный',money(m.gdpUSDRolling)+' млрд $','Последние 12 месяцев, каждый поток по курсу своего месяца')}${row('ВВП на человека · номинальный',n(m.gdpUSDRolling/annualPopulation,0)+' $ / год','Годовой ВВП / среднее население последних 12 месяцев')}${row('ВВП · реальный',money(m.realGDPRolling)+' млрд $ базы','Последние 12 месяцев, постоянные цены 2026 года')}${row('ВВП на человека · реальный',n(m.realGDPRolling/annualPopulation,0)+' $ базы / год')}${row('ВВП по условному ППС',money(m.realGDPRolling*state.parameters.pppConversionFactor)+' млрд','Условный коэффициент ППС, не обследование цен')}${row('Рост реального ВВП',pct(m.gdpGrowthYoY),'Последний месяц к тому же месяцу год назад')}${row('Инфляция',pct(m.inflationYoY),'Изменение потребительских цен за 12 месяцев')}${row('Безработица',pct(m.unemployment))}${row('Средняя зарплата · до налогов',n(m.meanWageNominal,0)+' ед. / месяц',n(m.meanWageUSD,0)+' $ по текущему курсу; фонд оплаты / занятые')}${row('Средняя реальная зарплата',n(m.meanWageReal,0)+' $ базы / месяц')}${row('Медианный эквивалентный доход',n(m.medianEquivalentIncomeReal,0)+' $ базы / месяц','После налогов и трансфертов; с поправкой на размер семьи')}</section>
    <section class="panel"><h2>Люди и качество жизни</h2>${row('Население',n(m.population,3)+' млн')}${row('Ожидаемая продолжительность жизни',n(m.lifeExpectancy,1)+' лет')}${row('Рождаемость',n(m.totalFertilityRate,2)+' детей / женщину')}${row('Доля населения 65+',pct(m.elderlyShare))}${row('Средние годы обучения взрослых',n(m.meanSchooling,1)+' лет')}${row('Ожидаемые годы обучения детей',n(m.expectedSchooling,1)+' лет')}${row('ИЧР · модельная оценка',n(m.hdi,3),'Формула UNDP; образование и ВНД по ППС — условные входы')}${row('Джини · после налогов и трансфертов',n(m.giniDisposable,1)+' / 100','Меньше — равномернее; расчёт по 10 группам за 12 месяцев')}${row('Джини · до перераспределения',n(m.giniMarket,1)+' / 100')}${row('Относительная бедность',pct(m.relativePoverty),'Доход ниже 50% медианного эквивалентного дохода')}${row('Фиксированный порог бедности',pct(m.absolutePoverty),'Ниже '+n(state.parameters.absolutePovertyRealMonthly,0)+' $ базы / человек / месяц; не международный порог')}${row('Доля доходов верхних 10%',pct(m.top10IncomeShare))}${row('Доля богатства верхних 10%',pct(m.top10WealthShare),'С учётом депозитов, долгов и долей предприятий')}</section></div>
    <section class="panel" style="margin-top:15px"><h2>Финансы и устройство экономики</h2><div class="two-cols"><div>${row('Государственный долг',pct(m.debtRatio)+' ВВП')}${row('Баланс бюджета',m.deficitRatio>0?'Дефицит '+pct(m.deficitRatio):'Профицит '+pct(-m.deficitRatio))}${row('Валютные резервы',money(m.reservesUSD)+' млрд $')}${row('Сырьевой фонд',money(m.fundUSD)+' млрд $')}${row('Эпизоды суверенного дефолта',n(m.defaultEpisodes??0,0),state.government.defaultActive?'Сейчас есть непогашенный дефолт':'Текущие платежи исполняются или проведён обмен')}</div><div>${row('Государственная доля активов предприятий',pct(m.stateAssetShare))}${row('Иностранная доля активов',pct(m.foreignAssetShare))}${row('Отечественная частная доля активов',pct(100-m.stateAssetShare-m.foreignAssetShare))}${row('Государственная доля выпуска',pct(m.stateOutputShare),'Взвешенная по добавленной стоимости, не по количеству предприятий')}${row('Профиль допущений',esc(MODEL_PROFILES[state.modelProfile].name))}</div></div><div class="callout" style="margin-top:15px">Джини — приближение по группам; различия внутри групп не наблюдаются. ИЧР использует правильную структуру индекса, но модельные данные. Площадь, столица и международное место не выдумываются.</div></section>`;
}
function ownershipView() {
  return `<section class="panel"><span class="eyebrow">ГОСУДАРСТВО КАК СОБСТВЕННИК</span><h2>Собственность и эффективность</h2><p class="small muted">Смена собственника не создаёт выпуск. Эффективность меняется через управление, конкуренцию, инвестиции и реорганизацию; знак эффекта не задан самим названием собственника.</p><div class="table-wrap"><table class="table"><thead><tr><th>Отрасль</th><th>Государство</th><th>Частные отечественные</th><th>Иностранные</th><th>Управление / 100</th><th>Эффективность, начало = 100</th></tr></thead><tbody>${state.firms.map(f=>`<tr><td>${esc(f.name)}</td><td>${pct(f.ownership.state*100)}</td><td>${pct(f.ownership.domestic*100)}</td><td>${pct(f.ownership.foreign*100)}</td><td>${n(f.governance*100,1)}</td><td>${n(f.managementEfficiency*100,1)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel"><h2>Запланировать операцию</h2><div class="world-grid"><label class="field">Отрасль<select id="ownership-sector">${state.firms.map((f,i)=>`<option value="${i}">${esc(f.name)}</option>`).join('')}</select></label><label class="field">Действие<select id="ownership-kind"><option value="purchase">Купить долю государству</option><option value="privatize">Продать отечественным инвесторам</option><option value="nationalize">Национализировать</option><option value="recapitalize">Внести капитал за новую долю</option></select></label><label class="field">Доля, процентных пунктов<input id="ownership-points" type="number" min="1" max="100" value="10"></label><label class="field">Компенсация при национализации, %<input id="ownership-compensation" type="number" min="0" max="100" value="100"></label></div><button data-action="ownership-queue">Запланировать со следующего месяца</button><p class="small muted" style="margin-top:12px">Оценка по чистым активам. Размер исполненной покупки ограничен финансированием; продажа — средствами покупателей. Рекапитализация означает долю в новом капитале, а не покупку у прежнего владельца. Неполная компенсация повышает риск собственности.</p>${queuedActions()}</section>`;
}
function queuedActions() {
  return state.pendingActions.length?`<div class="callout">Операции следующего месяца:<br>${state.pendingActions.map(a=>`${a.kind==='restructure'?'Реструктуризация долга':esc(state.firms[a.sector].name)+' · '+esc(actionName(a.kind))+' · '+n(a.points,0)+' п.п.'} <button data-cancel-action="${a.id}">Отменить</button>`).join('<br>')}</div>`:'';
}
const actionName=kind=>({purchase:'Покупка государственной доли',privatize:'Приватизация',nationalize:'Национализация',recapitalize:'Рекапитализация',restructure:'Обмен государственного долга',refinance:'Рефинансирование'})[kind]??kind;
const decisionName=key=>POLICY_FIELDS.find(f=>f[0]===key)?.[1]??POLICY_CHECKS.find(f=>f[0]===key)?.[1]??PARAMETER_FIELDS.find(f=>f[0]===key)?.[1]??key;
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
  const end=state.journal.length-journalPage*24,start=Math.max(0,end-24),entries=state.journal.slice(start,Math.max(0,end)).reverse();
  return `<section class="panel"><span class="eyebrow">ИСТОРИЯ · ПОЛНЫЕ ПРИМЕНЁННЫЕ РЕШЕНИЯ</span><h2>Журнал эксперимента</h2><p class="small muted">Каждый ход содержит всю политику, параметры, внешние условия, фактически выполненные операции и результаты. «+12 месяцев» записывает 12 отдельных ходов. Непроведённый черновик сохраняется отдельно в файле.</p><div class="section-actions"><button data-action="journal-export">Скачать журнал JSON</button><button data-action="replay" ${busy?'disabled':''}>Проверить воспроизведение</button><button data-journal-page="${Math.max(0,journalPage-1)}" ${journalPage===0?'disabled':''}>Более новые</button><button data-journal-page="${journalPage+1}" ${start===0?'disabled':''}>Более старые</button></div>${entries.length?entries.map(e=>`<details class="journal-entry"><summary><strong>${date(e.month,true)}</strong><span>${e.policyChanges.length} изменений политики · ${e.actions.length} операций · инфляция ${pct(e.outcome.inflationYoY)}</span></summary>${e.note?`<p>${esc(e.note)}</p>`:''}<p class="small">${e.policyChanges.map(c=>`${esc(decisionName(c.key))}: ${esc(c.from)} → ${esc(c.to)}`).join('<br>')||'Политика сохранена без изменений.'}</p>${e.parameterChanges.length?`<p class="small">Допущения: ${e.parameterChanges.map(c=>`${esc(decisionName(c.key))}: ${esc(c.from)} → ${esc(c.to)}`).join('; ')}</p>`:''}${e.actions.map(a=>`<p class="small">${esc(actionName(a.kind))}: ${a.sector!==undefined?esc(state.firms[a.sector].name):'государственный долг'} · ${a.cost!==undefined?n(a.cost,0)+' млн':n(a.haircut*100,0)+'% списание'}</p>`).join('')}<p class="small muted">${e.events.map(esc).join('<br>')||'Без дополнительных событий.'}</p><details class="method-details"><summary>Полные решения и условия этого месяца</summary><pre class="journal-json">${esc(JSON.stringify({policy:e.policy,parameters:e.parameters,world:e.world,shocks:e.shocks},null,2))}</pre></details></details>`).join(''):'<p class="muted">Первый месячный ход начнёт журнал.</p>'}<div class="callout" style="margin-top:15px">Версия ${VERSION}, seed ${state.seed}. Совпадение воспроизведения проверяет вычисления, но не доказывает причинность. Для отдельной гипотезы используйте одинаковые условия в A/B.</div></section>`;
}
function chartPanel() {
  return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">ДИНАМИКА ЭКОНОМИКИ</span><h2>${metricNames[chartMetric]}</h2><span class="muted small">Каждая точка — один месяц</span></div><div class="pill-group">${chartOptions.map(([key,label])=>`<button class="${chartMetric===key?'active':''}" data-chart="${key}">${label}</button>`).join('')}</div></div>
    <div class="chart-wrap">${chart([{name:'Экономика',points:state.history}],chartMetric)}</div><div class="chart-legend"><span><span class="legend-line"></span>Ваш эксперимент</span><span>${state.month} ${state.month===1?'месяц':'мес.'} · ${state.stochastic?'Внешние колебания включены':'Без случайных шоков'}</span></div></section>`;
}
function report() {
  if(state.month===0) return `<ol class="report-list"><li><div class="report-number">01</div><div><strong>Выберите экономическую гипотезу</strong><span>Например, увеличьте ставку с 8,25% до 12%. Остальные решения оставьте прежними.</span></div></li><li><div class="report-number">02</div><div><strong>Перейдите к следующему месяцу</strong><span>Сравните инфляцию, спрос, занятость и курс. Последствия накапливаются.</span></div></li><li><div class="report-number">03</div><div><strong>Сравните два пути</strong><span>Одинаковые исходные условия и внешние шоки, разная государственная политика.</span></div></li></ol>`;
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
    ${bar('Капитал банков / норматив',m.capitalRatio/state.policy.bankCapitalRequirement/2*100,pct(m.capitalRatio/state.policy.bankCapitalRequirement*100),m.capitalRatio<state.policy.bankCapitalRequirement?'#c69864':'#89b899')}
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
      <details class="method-details"><summary>Матрица межотраслевых затрат</summary><p>В документации приведены все коэффициенты. Сначала решается q = (I − A)⁻¹f, затем выпуск ограничивается мощностями, трудом, импортом и запасами.</p><a href="./docs/VALIDATION.md" target="_blank" rel="noopener">10 стратегий и результаты проверки</a><span class="separator"></span><a href="./docs/MODEL.md" target="_blank" rel="noopener">Открыть формулы модели</a></details></section></div>`;
}
function fiscal() {
  const m=state.metrics,f=state.lastReport.fiscal,a=accountBalances(state),g=state.government;
  const domesticRate=g.domesticBonds.length?g.domesticBonds.reduce((v,b)=>v+b.principal*b.rate,0)/a.domesticDebt*100:0;
  return `<section class="panel"><span class="eyebrow">ДОЛГОВАЯ УСТОЙЧИВОСТЬ</span><h2>${g.defaultActive?'Есть непогашенный дефолт':'Состояние государственных обязательств'}</h2><div class="two-cols"><div>${row('Эпизоды дефолта',String(g.defaults))}${row('Долг, затронутый неплатежом',money(m.debtInDefault??0)+' млрд')}${row('Просроченные платежи',money(g.arrears)+' млрд')}${row('Обслуживание долга / доходы',pct(m.debtServiceRevenue??0))}</div><div>${row('Условный риск потери финансирования',pct(m.refinancingRisk??0)+' / год','Логистический сценарный показатель; не эмпирическая вероятность дефолта')}${row('Ограничение доступа к внешнему рынку',state.month<g.excludedUntil?'До '+date(g.excludedUntil,true):'Нет')}${row('Дивиденды государственных долей',money(f.stateDividends??0)+' млрд')}${row('Отложенные убытки ЦБ',money(state.centralBank.deferredLoss)+' млрд','Уменьшают будущие перечисления ЦБ, не являются долгом казначейства')}</div></div><details class="method-details"><summary>Вынужденная реструктуризация и история дефолтов</summary><p>Неплатёж по купону или основному долгу — дефолт. Обмен с потерей приведённой стоимости также считается дефолтом. Высокий долг сам по себе не означает дефолт.</p><div class="section-actions"><label class="field">Списание номинала, %<input id="debt-haircut" type="number" min="0" max="70" value="30"></label><label class="field">Новый срок, месяцев<input id="debt-extension" type="number" min="12" max="120" value="60"></label><button data-action="restructure-queue">Запланировать обмен долга</button></div>${g.defaultEpisodes.map(e=>`<p>${date(e.start,true)} — ${e.end===null?'не разрешён':date(e.end,true)} · потери номинала ${money(e.faceLossLC)} млрд · потери приведённой стоимости ${money(e.npvLossLC)} млрд.</p>`).join('')||'<p>Дефолтов не было.</p>'}${queuedActions()}</details></section><div class="balance-strip"><div class="panel"><span class="eyebrow">ДОЛГ ГОСУДАРСТВА</span><div class="big">${money(a.totalGovernmentDebt)} млрд</div><span class="small muted">${pct(m.debtRatio)} ВВП за 12 месяцев</span></div><div class="panel"><span class="eyebrow">КАЗНАЧЕЙСТВО</span><div class="big">${money(g.cash)} млрд</div><span class="small muted">Средства на счёте</span></div><div class="panel"><span class="eyebrow">ПРОЦЕНТЫ ПО ДОЛГУ</span><div class="big">${money(m.interestExpense)} млрд</div><span class="small muted">За текущий месяц</span></div></div>
    <div class="two-cols"><section class="panel"><h2>Доходы бюджета</h2>${row('НДС',money(f.vat??0)+' млрд')}${row('Подоходный налог',money(f.incomeTax??0)+' млрд')}${row('Налог на прибыль',money(f.corporateTax??0)+' млрд')}${row('Пошлины',money(f.tariff??0)+' млрд')}${row('Сырьевая рента',money(f.royalty??0)+' млрд')}${row('Доход центрального банка',money(f.centralIncome??0)+' млрд')}${row('Всего налогов',money(m.taxRevenue)+' млрд')}${row('Собираемость прямых налогов',pct(state.institutions.taxCompliance*100))}</section>
    <section class="panel"><h2>Расходы и финансирование</h2>${row('Закупки и инвестиции',money(f.purchases??0)+' млрд')}${row('Пособия и пенсии',money(f.transfers??0)+' млрд')}${row('Поддержка семей',money(f.familyBenefits??0)+' млрд')}${row('Здравоохранение · внутри закупок',money(f.healthcare??0)+' млрд')}${row('Образование · внутри закупок',money(f.education??0)+' млрд')}${row('Администрирование · внутри закупок',money(f.institutionCost??0)+' млрд')}${row('Поддержка бизнеса',money(f.businessSupport??0)+' млрд')}${row('Обслуживание долга',money(f.interest??0)+' млрд')}${row('Спасение банков',money(f.bankRescue??0)+' млрд')}${row('Дефицит за месяц',money(state.government.lastDeficit)+' млрд')}${row('Новые внутренние займы',money(f.domesticIssued??0)+' млрд')}${row('Новые внешние займы',money(f.externalIssued??0)+' млрд $')}${row('Погашение основного долга',money((f.domesticRedeemed??0)+(f.externalRedeemed??0)*state.exchangeRate)+' млрд')}</section></div>
    <section class="panel" style="margin-top:15px"><h2>Сроки и валютный риск</h2><div class="mini-stats"><div class="mini-stat"><span>Средний внутренний купон</span><strong>${pct(domesticRate)}</strong></div><div class="mini-stat"><span>Внешний долг</span><strong>${money(a.externalDebtUSD)} млрд $</strong></div><div class="mini-stat"><span>Премия за риск новых займов</span><strong>${pct(m.sovereignSpread)}</strong></div></div><p class="small muted">Старые облигации сохраняют купон. Ставка влияет на бюджет при новых займах и рефинансировании. Дефицит на карточке — текущий месячный поток × 12 / ВВП последних 12 месяцев.</p></section>`;
}
function credit() {
  const m=state.metrics,b=state.bank,a=accountBalances(state);
  return `<section class="panel"><h2>Капитал и ликвидность — разные ограничения</h2><div class="two-cols"><div>${row('Капитал / все активы · leverage',pct(m.leverageRatio))}${row('Покрытие месячного стресс-оттока · модельное',pct(m.liquidityCoverage))}${row('Риск-взвешенные активы',money(a.riskWeightedAssets)+' млрд')}</div><div>${row('Государственная доля банков',pct(b.stateOwnership*100))}${row('Прибыль ЦБ за месяц',money(state.centralBank.lastProfit)+' млрд')}${row('Перечисление ЦБ в бюджет',money(state.centralBank.lastRemittance)+' млрд')}</div></div><p class="small muted">Внешние активы и открытая валютная позиция имеют отдельные веса риска. Покрытие ликвидности — упрощённый аналог, не полная реализация Basel LCR. Депозитная ставка ограничена доходностью портфеля и стоимостью фондирования.</p></section><div class="two-cols"><section class="panel"><h2>Передача ставки</h2>${row('Ключевая ставка',pct(state.policy.rate),'Применённое решение')}${row('Ожидания инфляции',pct(m.expectedInflation))}${row('Ожидаемая реальная ставка',pct(realInterestRate(state.policy.rate/100,state.expectedInflation)*100))}${row('Новые кредиты',pct(m.lendingRate),'Годовая эффективная ставка')}${row('Депозиты',pct(m.depositRate),'Годовая эффективная ставка')}${row('Кредитная доступность',pct(b.creditSupply*100))}${row('Выдано кредитов / овердрафтов',money(m.moneyCreated)+' млрд')}${row('Списано кредитов',money(m.creditLosses)+' млрд')}
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
  const differences=Object.entries(c.b.policy).filter(([key,val])=>val!==base.policy[key]);
  controls+=`<section class="panel"><div class="panel-head"><div><span class="eyebrow">РЕЗУЛЬТАТ · ${c.months} МЕСЯЦЕВ</span><h2>${metricNames[compareMetric]}</h2><span class="small muted">${date(c.originMonth,true)} → ${date(c.originMonth+c.months,true)}</span></div><div class="pill-group">${chartOptions.map(([key,label])=>`<button data-compare-chart="${key}" class="${compareMetric===key?'active':''}">${label}</button>`).join('')}</div></div><div class="chart-wrap">${chart([{name:'A',points:c.a.history.filter(x=>x.month>=c.originMonth)},{name:'B',points:c.b.history.filter(x=>x.month>=c.originMonth)}],compareMetric,{compare:true})}</div><div class="chart-legend"><span><span class="legend-line"></span>A · прежняя политика</span><span><span class="legend-line alt"></span>B · ваша гипотеза</span></div></section>`;
  const metrics=[['gdpPerCapitaReal','ВВП / человек, $ базы',0],['inflationYoY','Инфляция, %',1],['unemployment','Безработица, %',1],['realIncomeIndex','Реальный доход, индекс',1],['debtRatio','Госдолг / ВВП, %',1],['exchangeRate','Курс, ед. / $',3],['reservesUSD','Резервы, млн $',0],['investment','Инвестиции / месяц, млн базы',0],['giniDisposable','Джини располагаемых доходов, 0–100',1],['hdi','ИЧР модели',3],['stateAssetShare','Государственная доля активов, %',1],['defaultEpisodes','Эпизоды дефолта',0]];
  controls+=`<section class="panel"><h2>Результаты на конец горизонта</h2><div class="table-wrap"><table class="table"><thead><tr><th>Показатель</th><th>A</th><th>B</th><th>Разница B − A</th></tr></thead><tbody>${metrics.map(([key,label,d])=>`<tr><td>${label}</td><td>${n(a[key],d)}</td><td>${n(b[key],d)}</td><td>${signed(b[key]-a[key],d)}</td></tr>`).join('')}</tbody></table></div><p class="small muted" style="margin-top:12px">Изменённые решения: ${differences.map(([key,val])=>`${esc(POLICY_FIELDS.find(f=>f[0]===key)?.[1]??key)}: ${esc(base.policy[key])} → ${esc(val)}`).join('; ')||'политика одинакова; при наличии разовых операций ветвь B может отличаться'}.</p><p class="small muted">Вывод относится к допущениям этой модели. Для проверки устойчивости повторите эксперимент с другими коэффициентами.</p></section>`;
  return controls;
}
function validationView() {
  const table=games=>'<div class="table-wrap"><table class="table"><thead><tr><th>Стратегия</th><th>ВВП / человек</th><th>Инфляция</th><th>Долг / ВВП</th><th>Джини</th><th>ИЧР модели</th><th>Дефолты</th></tr></thead><tbody>'+games.map(x=>'<tr><td style="white-space:normal;max-width:260px"><strong>'+esc(x.name)+'</strong><div class="small muted">'+esc(x.description)+'</div></td><td>'+n(x.gdpPerCapitaReal,0)+'</td><td>'+pct(x.inflationYoY)+'</td><td>'+pct(x.debtRatio)+'</td><td>'+n(x.giniDisposable,1)+'</td><td>'+n(x.hdi,3)+'</td><td>'+x.defaults+'</td></tr>').join('')+'</tbody></table></div>';
  return '<section class="panel"><span class="eyebrow">МОДЕЛЬ '+validation.version+' · ПРОВЕРКА 30 ЛЕТ</span><h2>Десять стратегий: 360 месяцев</h2><p class="small muted">Одинаковые начальные условия, без случайных шоков. Стабилизация меняет ставку каждый месяц; остальные пакеты постоянны. Это результаты условной модели, не прогноз.</p>'+table(validation.main)+'<details class="method-details"><summary>Те же стратегии в сырьевой экономике</summary>'+table(validation.resource)+'</details><div class="section-actions"><a href="./docs/VALIDATION.md" target="_blank" rel="noopener">Полный отчёт и сравнение собственности</a><a href="./docs/strategies-monthly.csv" download>Месячные ряды CSV</a><a href="./docs/validation-results.json" download>Результаты JSON</a></div></section><section class="panel"><h2>Расширенная проверка</h2>'+row('Всего игр',n(validation.totalGames??0,0))+row('Повторы с общими шоками',n(validation.stochasticGames,0))+row('Сравнения собственности и профилей',n(validation.ownershipGameCount??0,0))+row('Кризисные сценарии',n(validation.crisisGameCount??0,0))+row('Проверки чувствительности',n(validation.sensitivityGames,0))+row('Пятидесятилетние игры',n(validation.longHorizonGames,0))+row('Точные воспроизведения журнала',n(validation.replayChecks??0,0))+row('Проверенные месячные переходы',n(validation.monthsChecked,0))+row('Максимальная относительная ошибка балансов',validation.maxRelativeFinancialAudit.toExponential(3))+'<p class="small muted">Правильность учёта не означает эмпирической точности. Коэффициенты условные, внутри групп доходы не различаются; ИЧР и ППС — модельные оценки.</p></section>';
}
function methodology() {
  const audit=state.lastReport.audit;
  return `<section class="panel"><span class="eyebrow">МОДЕЛЬ ${VERSION}</span><h2 style="margin-top:5px">Что именно вычисляется</h2><div class="callout warning"><strong>Исследовательская модель с условной калибровкой</strong>Балансовые тождества проверяются при каждом ходе. Поведенческие коэффициенты не оценены по данным конкретной страны; результат — следствие заданных допущений. Это не точный прогноз реальной экономики.</div>
    <div class="explain"><p>Открытая экономика: пять отраслей, десять групп семей, банки, отдельный баланс центрального банка, казначейство и внешний сектор. Месячный шаг, ограничения производства, собственность и согласованные финансовые операции.</p><p><a href="./docs/PARAMETERS.md" target="_blank" rel="noopener">Научные методы, единицы, источники и статус коэффициентов</a>. Джини рассчитан по группам; ИЧР использует модельное образование и условный ППС. Ни одна форма собственности не получает автоматического бонуса эффективности.</p><p><a href="./docs/INSTITUTIONS.md" target="_blank" rel="noopener">Институты: правила, услуги и спорные механизмы</a>. Качество не задаётся игроком. Институты меняют ограниченный уровень эффективности, а не дают постоянную надбавку к темпу роста. Нулевые коэффициенты позволяют проверить отсутствие предполагаемой отдачи; это не полноценная модель какой-либо экономической школы.</p>
      <div class="formula">ВВП = потребление + инвестиции + госзакупки + экспорт − импорт + изменение запасов</div>
      <ul><li><strong>Годовая эффективная ставка → месяц:</strong> <code>(1 + r)^(1/12) − 1</code>. Износ: <code>1 − (1 − δ)^(1/12)</code>. Купоны с номинальной годовой ставкой: <code>долг × купон / 12</code>.</li><li><strong>Инфляция за 12 месяцев:</strong> <code>ИПЦ[t] / ИПЦ[t−12] − 1</code>. Рост ВВП сравнивает месячный реальный выпуск с тем же месяцем прошлого года.</li><li><strong>Бюджет:</strong> доля известного номинального ВВП последних 12 месяцев делится на 12. Дополнительной индексации по ИПЦ нет. Проценты и погашение долга рассчитываются по каждой когорте.</li><li><strong>Долг / ВВП:</strong> накопленный долг делится на сумму номинального ВВП за последние 12 месяцев. Дефицит на главном экране — месячный поток, приведённый к годовому темпу.</li><li><strong>$6 000 на человека:</strong> начальная годовая величина при населении 10 млн и ВВП $60 млрд. Реальный показатель на карточке — текущий месячный выпуск × 12 / население, в ценах начала. Это годовой темп, а не сумма прошедшего года.</li><li><strong>Первые годовые сравнения:</strong> до января 2026 используется явная синтетическая история с ростом 3% и инфляцией 8%. После 12 ходов весь годовой расчёт опирается на ваши месяцы.</li><li><strong>Цены:</strong> операции месяца проходят по открывающим ценам. В конце месяца рассчитываются новые цены и ИПЦ; они действуют в следующем месяце. Разовый НДС не становится повторяющимся ценовым шоком.</li></ul></div>
    <div class="section-actions"><a href="./docs/VALIDATION.md" target="_blank" rel="noopener">10 стратегий и результаты проверки</a><span class="separator"></span><a href="./docs/MODEL.md" target="_blank" rel="noopener">Уравнения и ограничения</a><span class="separator"></span><a href="https://github.com/ZHANK478/Economy-Model-" target="_blank" rel="noopener">Исходный код</a></div></section>
    <section class="panel"><h2>Все 23 экономических блока</h2><div class="module-grid">${MODULES.map(([name,detail],i)=>`<div class="module-card"><span class="module-index">${String(i+1).padStart(2,'0')}</span><strong>${name}</strong><p>${detail}</p></div>`).join('')}</div></section>
    <section class="panel"><h2>Проверка учёта за последний месяц</h2><p class="small muted">Остатки тождеств, млн. Малые значения порядка 10⁻⁹ — погрешность вычислений.</p>${Object.keys(audit).length?Object.entries(audit).map(([key,val])=>row(({population:'Баланс населения (млн человек)',centralBank:'Баланс центрального банка',bankBalance:'Банковский баланс',nominalGDP:'ВВП: номинальное тождество',realGDP:'ВВП: реальное тождество',goods:'Баланс товаров',externalNFA:'Чистые внешние активы / текущий счёт',governmentCash:'Движение казначейского счёта',governmentDebt:'Движение госдолга'})[key]??key,`<span class="audit-code">${val.toExponential(3)}</span>`)).join(''):'<p class="small muted">Полный набор проверок появится после первого месяца.</p>'}</section>
    <section class="panel"><span class="eyebrow">УСТОЙЧИВОСТЬ ГИПОТЕЗ</span><h2 style="margin-top:5px">Изменить допущения</h2><p class="small muted">Это параметры исследователя, а не действия правительства. Они применяются к последующим ходам. Сравнение из сохранённой точки использует параметры этой точки.</p>${PARAMETER_FIELDS.map(([key,label,min,max,step])=>`<div class="parameter-control"><label for="param-${key}">${label}</label><input type="range" id="param-${key}" min="${min}" max="${max}" step="${step}" value="${state.parameters[key]}" data-parameter="${key}"><input type="number" min="${min}" max="${max}" step="${step}" value="${state.parameters[key]}" data-parameter-number="${key}" aria-label="${label}, значение"></div>`).join('')}</section>`;
}
function render() {
  const views={country,overview,economy,fiscal,credit,external,households,ownership:ownershipView,institutions:institutionsView,journal:journalView,compare:compareView,validation:validationView,method:methodology};
  const nav=[['country','Паспорт страны'],['overview','Обзор'],['economy','Производство'],['fiscal','Бюджет'],['credit','Банки'],['external','Внешний мир'],['households','Население'],['ownership','Собственность'],['institutions','Институты'],['journal','Журнал решений'],['compare','Гипотезы A / B'],['validation','Проверка: 30 лет'],['method','Модель']];
  app.innerHTML=`<div class="app-shell"><header class="topbar"><div class="brand"><span class="brandmark">M</span><span>МАКРОЭКОНОМИЧЕСКАЯ<br>ЛАБОРАТОРИЯ</span></div><div class="top-actions"><span class="badge"><span class="status-dot"></span><span id="save-status">${esc(saveStatus)}</span></span><button data-action="export">Сохранить файл</button><button data-action="import">Открыть</button><button data-action="new">Новая страна</button>${legacySave?'<button data-action="legacy-export">Скачать прежнее сохранение</button>':''}</div></header>
    <div class="workspace">${sidebar()}<main class="main"><div class="page-head"><div><span class="eyebrow">ВЫМЫШЛЕННАЯ СТРАНА · ${state.resourceMode?'СЫРЬЕВАЯ ЭКОНОМИКА':'ДИВЕРСИФИЦИРОВАННАЯ ЭКОНОМИКА'}</span><h1>Экономическая лаборатория</h1><p class="intro">Изменяйте политику. Наблюдайте последствия. Проверяйте гипотезы.</p></div><div class="datebox"><div class="label">${state.month===0?'НАЧАЛО ЭКСПЕРИМЕНТА':'ЗАВЕРШЁННЫЙ МЕСЯЦ'}</div><div class="month">${date(state.month)}</div><span class="badge">Ход ${state.month}</span></div></div>
    ${legacySave?'<div class="callout" style="margin-bottom:16px">Версия 3.1: институты теперь результат решений, а не выбранное качество. Новые уравнения требуют нового эксперимента; прежнее сохранение оставлено отдельно, скачайте его кнопкой вверху. Прошлая история не пересчитывается задним числом.</div>':''}${cards()}<nav class="view-tabs" aria-label="Разделы модели">${nav.map(([key,label])=>`<button data-view="${key}" class="${view===key?'active':''}" aria-current="${view===key?'page':'false'}">${label}</button>`).join('')}</nav>
    <div id="view-content">${views[view]()}</div><div class="section-actions" style="margin-top:20px"><button data-action="checkpoint">Сохранить точку ${checkpoint?'· '+date(checkpoint.month,true):''}</button>${checkpoint?'<button data-action="restore">Вернуться к точке</button>':''}<button data-action="csv">Скачать ряды CSV</button></div>
    <footer class="footer-note">Условная макроэкономическая модель · Все суммы в национальной валюте, если не указано иное.<br>Коэффициенты не оценены по статистике страны. <a href="#" data-view="method">Формулы, месячный учёт и ограничения →</a></footer></main></div>
    <div class="mobile-controls"><button data-action="controls">Политика ${pending().length?'· '+pending().length:''}</button><button class="primary" data-action="step" ${busy?'disabled':''}>${busy?'Вычисление…':'Следующий месяц →'}</button></div></div>`;
}
function updateDraft(key,val) {
  const field=POLICY_FIELDS.find(x=>x[0]===key);if(!field||!Number.isFinite(Number(val))) return;
  draft[key]=Math.max(field[2],Math.min(field[3],Number(val)));
  const range=app.querySelector(`[data-policy="${key}"]`),num=app.querySelector(`[data-policy-number="${key}"]`);
  if(range)range.value=draft[key];if(num&&document.activeElement!==num)num.value=draft[key];
  const out=document.getElementById('value-'+key);if(out)out.textContent=n(draft[key],field[4]<1?2:0);
  const cancel=document.getElementById('cancel-policy');if(cancel)cancel.disabled=pending().length===0;
  const rr=document.getElementById('real-rate');if(rr)rr.textContent=pct(realInterestRate(draft.rate/100,state.expectedInflation)*100);
  const pn=document.getElementById('pending-note');if(pn)pn.textContent=pending().length?`Изменено решений: ${pending().length}`:'Текущая политика сохранена';
  comparison=null;persist();
}
async function step(count) {
  if(busy)return;busy=true;render();await new Promise(r=>setTimeout(r,0));
  try {state=runMonths(state,count,draft);comparison=null;mobileOpen=false;persist();}
  catch(e){toast('Расчёт остановлен: '+e.message);console.error(e);}
  busy=false;render();
}
async function calculateCompare() {
  if(busy)return;busy=true;render();await new Promise(r=>setTimeout(r,0));
  try {
    const origin=compareSource==='checkpoint'&&checkpoint?checkpoint:state;
    comparison=comparePolicies(origin,origin.policy,draft,compareMonths);
    toast(`Рассчитаны ${compareMonths} месяцев. Основной эксперимент остался на прежней дате.`);
  }catch(e){toast('Сравнение остановлено: '+e.message);console.error(e);}
  busy=false;render();
}
function exportCSV() {
  const fields=['month','population','births','deaths','naturalIncrease','totalFertilityRate','lifeExpectancy','elderlyShare','dependencyRatio','realGDPAnnualized','realGDPRolling','gdpUSDRolling','realGDPMonthly','nominalGDPMonthly','gdpPerCapitaReal','inflationYoY','inflationMonthly','unemployment','debtRatio','deficitRatio','exchangeRate','reservesUSD','realIncomeIndex','investment','capitalRatio','npl','giniDisposable','giniMarket','hdi','meanWageNominal','meanWageReal','meanWageUSD','medianEquivalentIncomeReal','relativePoverty','stateAssetShare','stateOutputShare','defaultEpisodes','debtInDefault','liquidityCoverage','leverageRatio','marketContestability','bankContestability','contractReliability','registrationDays','contractDelayDays','antitrustCapacity','courtCapacity','soeAuditCapacity'];
  const lines=[fields.join(';'),...state.history.filter(x=>x.month>=0).map(x=>fields.map(k=>String(x[k]??'')).join(';'))];
  download('economy-monthly-data.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
}

app.addEventListener('click',async event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.dataset.view){event.preventDefault();view=target.dataset.view;render();return;}
  if(target.dataset.policyTab){policyTab=target.dataset.policyTab;render();return;}
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
    case 'compare-view':view='compare';mobileOpen=false;render();break;
    case 'compare':await calculateCompare();break;
    case 'cancel-policy':draft=copy(state.policy);comparison=null;persist();render();break;
    case 'legacy-export':{const old=JSON.parse(legacySave);download('economy-original-previous-version.json',old.simulation);toast('Прежний эксперимент скачан без изменения его данных.');break;}
    case 'export':{const payload=JSON.parse(exportSimulation(state));payload.draftPolicy=copy(draft);download(`economy-${date(state.month,true)}.json`,JSON.stringify(payload,null,2));toast('Сохранены счета, параметры, внешние шоки и подготовленные решения.');break;}
    case 'import':document.getElementById('import-file').click();break;
    case 'csv':exportCSV();break;
    case 'ownership-queue':try{scheduleOwnership(state,{sector:Number(document.getElementById('ownership-sector').value),kind:document.getElementById('ownership-kind').value,points:Number(document.getElementById('ownership-points').value),compensation:Number(document.getElementById('ownership-compensation').value)/100});persist();comparison=null;render();toast('Операция записана; исполнение со следующего месяца.');}catch(e){toast(e.message);}break;
    case 'restructure-queue':try{scheduleRestructuring(state,{haircut:Number(document.getElementById('debt-haircut').value)/100,extension:Number(document.getElementById('debt-extension').value)});persist();comparison=null;render();toast('Обмен запланирован. Потеря приведённой стоимости будет считаться дефолтом.');}catch(e){toast(e.message);}break;
    case 'journal-export':download(`economy-decisions-${date(state.month,true)}.json`,JSON.stringify({format:'economy-decisions',version:VERSION,provenance:state.provenance,journal:state.journal},null,2));break;
    case 'replay':if(!busy){busy=true;render();await new Promise(r=>setTimeout(r,0));try{const replay=replayJournal(state);const errors=Object.entries(state.metrics).map(([k,v])=>Math.abs(v-replay.metrics[k])/Math.max(1,Math.abs(v)));toast(Math.max(...errors)<1e-10?'Журнал точно воспроизвёл текущие показатели.':'Журнал не воспроизвёл результат: проверьте версию и данные.');}catch(e){toast('Воспроизведение остановлено: '+e.message);}busy=false;render();}break;
    case 'new':document.getElementById('new-dialog').showModal();break;
    case 'checkpoint':
      checkpoint=copy(state);try{await storage.set(CHECKPOINT,JSON.stringify({format:'economy-model',version:VERSION,state:checkpoint}));toast('Точка сравнения сохранена.');}catch(e){toast('Точка сохранена только на время этой сессии. Скачайте файл.');}comparison=null;render();break;
    case 'restore':if(checkpoint){state=copy(checkpoint);draft=copy(state.policy);comparison=null;persist();render();toast('Эксперимент восстановлен из сохранённой точки.');}break;
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
  if(e.dataset.policy||e.dataset.policyNumber){render();return;}
  if(e.dataset.policyCheck){draft[e.dataset.policyCheck]=e.checked;comparison=null;persist();render();}
  if(e.dataset.world&&e.value!=='') {
    const val=Math.max(Number(e.min),Math.min(Number(e.max),Number(e.value)));
    if(Number.isFinite(val)){state.world[e.dataset.world]=val;e.value=val;comparison=null;persist();}
  }
  if(e.hasAttribute('data-stochastic')){state.stochastic=e.checked;comparison=null;persist();}
  if(e.id==='compare-source'){compareSource=e.value;comparison=null;render();}
  if(e.id==='compare-months'){compareMonths=Number(e.value);comparison=null;render();}
});
app.addEventListener('pointermove',event=>{
  const rect=event.target.closest('[data-chart-tip]');if(!rect)return;
  const tip=rect.closest('.chart-wrap').querySelector('.chart-tip');if(tip)tip.textContent=rect.dataset.chartTip;
});
document.getElementById('new-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=new FormData(event.target);
  state=createSimulation({resourceMode:form.get('resource')==='true',seed:Number(form.get('seed')),stochastic:form.has('stochastic'),modelProfile:form.get('modelProfile')??'balanced'});
  draft=copy(state.policy);comparison=null;view='country';checkpoint=null;mobileOpen=false;journalPage=0;
  try{await storage.set(CHECKPOINT,'');}catch(e){toast('Не удалось очистить прежнюю точку сравнения на устройстве.');}
  persist();document.getElementById('new-dialog').close();render();
});
document.querySelector('.dialog-close').addEventListener('click',()=>document.getElementById('new-dialog').close());
document.getElementById('import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>20*1024*1024)throw new Error('Файл больше 20 МБ');const text=await file.text();const loaded=importSimulation(text);const loadedDraft=sanitizePolicy(JSON.parse(text).draftPolicy??loaded.policy);state=loaded;draft=loadedDraft;comparison=null;view='country';journalPage=0;persist();render();toast('Эксперимент восстановлен.');}
  catch(e){toast('Не удалось открыть сохранение: '+e.message);}event.target.value='';
});
render();

import {britishDefenseActive,britishFleet} from './british-defense.js';
import {pendingWorldDecisions,worldDecisionById} from './world-decisions.js';
import {activeLanguage} from './localization.js';
import {defenseStatus} from './defense.js';
import {POLICY_CHOICES,POLICY_FIELDS} from './config.js';
import {defenseEconomyActive,DEFENSE_ECONOMY_KEYS} from './defense-economy.js';
export function armyBudgetSummary(state,plannedPolicy=state.policy){
 const rate=plannedPolicy.militaryBudget??0,nextMonth=(state.economy?.revision>=6?state.metrics.nominalGDPAnnual/12:state.base.monthlyGDP*state.consumerPriceIndex/100)*rate/100;
 const paid=state.month>0?(state.lastReport.fiscal?.militaryPurchases??0):null,total=state.metrics.governmentSpending;
 return {rate,nextMonth,paid,spendingShare:paid!==null&&total>0?paid/total*100:null};
}
function britishDefenseView(state,plannedPolicy,{n,esc,canAct}){
 const en=activeLanguage()==='en';
 const fleet=britishFleet(state);
 const forces=state.defense;
 const pending=pendingWorldDecisions(state).filter(event=>event.defense);
 const budget=armyBudgetSummary(state,plannedPolicy);
 const berths=Array.from({length:fleet.groups},(_,index)=>{
   const status=index<fleet.used?'assigned':index<fleet.ready?'available':'maintenance';
   return `<span class="fleet-berth ${status}"></span>`;
 }).join('');
 const active=fleet.missions.map(entry=>{
   const event=worldDecisionById(entry.id);
   const title=en?event.defense.enLabel:event.defense.label;
   const months=Math.max(0,entry.start+entry.months-state.month);
   const stateText=entry.kind==='fleet'?`${entry.allocation}/${entry.demand} ${en?'groups':'групп'}`:
     (en?'Joint commitment':'Совместная миссия');
   return `<li><div><strong>${esc(title)}</strong><small>${stateText} · ${n(months,0)} ${en?'mo. left':'мес. осталось'}</small></div></li>`;
 }).join('');
 const priority=POLICY_CHOICES.find(([key])=>key==='defensePriority');
 const options=priority[3].map(([value,label])=>`<option value="${value}" ${plannedPolicy.defensePriority===value?'selected':''}>${esc(label)}</option>`).join('');
 const requests=pending.map(event=>`<li><div><strong>${esc(en?event.en:event.title)}</strong></div><button type="button" data-world-choice-open="${event.id}">${en?'Read the article':'Читать в газете'} <span aria-hidden="true">→</span></button></li>`).join('');
 return `<section class="army-panel fleet-desk" aria-labelledby="fleet-title">
  <header class="fleet-hero"><div><p>${en?'Defence':'Оборона'}</p><h2 id="fleet-title">${en?'Royal Navy':'Королевский флот'}</h2></div></header>
  <div class="fleet-overview">
   <div class="fleet-strength">
    <div class="fleet-strength-heading"><span>${en?'Available fleet groups':'Доступные группы флота'}</span><strong>${fleet.available}<small> / ${fleet.groups}</small></strong></div>
    <div class="fleet-berths" aria-hidden="true">${berths}</div>
    <div class="fleet-key"><span class="available">${en?'Available':'Свободны'}</span><span class="assigned">${en?'Assigned':'Выделены'}</span><span class="maintenance">${en?'Unavailable':'Недоступны'}</span></div>
   </div>
   <div class="fleet-budget"><span>${en?'Defence spending':'Расходы на оборону'}</span><strong>${budget.paid===null?'—':n(budget.paid,1)} <small>${en?'m / month':'млн / мес.'}</small></strong>
    <button type="button" data-action="army-budget">${en?'Defence budget':'Оборонный бюджет'} <span aria-hidden="true">→</span></button>
   </div>
  </div>
  ${forces?.enabled?`<section class="fleet-deployments defence-forces" aria-labelledby="defence-forces-title">
   <h3 id="defence-forces-title">${en?'Armed forces':'Вооружённые силы'}</h3>
   <dl>
    <div><dt>${en?'Active personnel':'Личный состав'}</dt><dd>${n(forces.active*1e6,0)}</dd></div>
    <div><dt>${en?'Reserve':'Резерв'}</dt><dd>${n(forces.reserve*1e6,0)}</dd></div>
    <div><dt>${en?'Readiness':'Боеготовность'}</dt><dd>${n(forces.readiness*100,0)}%</dd></div>
   </dl>
  </section>`:''}
  <section class="fleet-deployments"><h3>${en?'Commitments and requests':'Обязательства и запросы'}</h3>
  ${active||requests?`<ul>${requests}${active}</ul>`:`<p>${en?'No active missions or requests.':'Активных миссий и запросов нет.'}</p>`}</section>
  <details class="fleet-settings"><summary>${en?'Maintenance priorities':'Приоритеты содержания'}</summary>
   <label><span>${esc(priority[1])}</span> <select data-policy-choice="defensePriority" ${canAct?'':'disabled'}>${options}</select></label>
  </details>
 </section>`;
}

export function armyView(state,plannedPolicy,{n,esc=String,canAct=true}){
 if(britishDefenseActive(state))return britishDefenseView(state,plannedPolicy,{n,esc,canAct});
 const a=armyBudgetSummary(state,plannedPolicy),d=state.defense,locked=!canAct;
 const shield='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m24 4 17 6v13c0 11-17 20-17 20S7 34 7 23V10l17-6Z"/><path d="m24 13 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z"/></svg>';
 const conflict=d?.war??d?.crisis,neighbor=d?.neighbors.find(x=>x.id===conflict?.neighbor);
 const controls=d?.enabled?`<details class="army-orders"><summary>Приказы</summary><div class="army-order-controls">${POLICY_CHOICES.filter(x=>x[2]==='Армия'&&(defenseEconomyActive(state)||!DEFENSE_ECONOMY_KEYS.includes(x[0]))).map(([key,label,,choices])=>`<label class="army-choice"><span>${label}</span><select data-policy-choice="${key}" ${locked?'disabled':''}>${choices.map(([value,text])=>`<option value="${value}" ${plannedPolicy[key]===value?'selected':''}>${text}</option>`).join('')}</select></label>`).join('')}${defenseEconomyActive(state)?POLICY_FIELDS.filter(x=>['defensePersonnelTarget','defenseSalary'].includes(x[0])).map(([key,label,min,max,step,unit])=>`<div class="policy-control army-slider"><div class="control-title"><label for="policy-${key}">${esc(label)} · ${esc(unit)}</label><input class="control-value policy-value-entry" id="policy-${key}" type="text" inputmode="decimal" value="${n(plannedPolicy[key],step<1?1:0)}" data-policy-number="${key}" ${locked?'disabled':''} aria-label="${esc(label)}"></div><input type="range" min="${min}" max="${max}" step="${step}" value="${plannedPolicy[key]}" data-policy="${key}" ${locked?'disabled':''} aria-label="${esc(label)}"></div>`).join(''):''}<div class="army-diplomacy">${conflict?`<button data-defense-action="negotiate" ${locked||conflict.negotiation?'disabled':''}>${conflict.negotiation?'Переговоры начаты':'Начать переговоры'}</button>`:''}${!d.alliance.active&&!d.alliance.requested&&!d.war?`<button data-defense-action="alliance" ${locked?'disabled':''}>Запросить оборонный союз</button>`:''}${d.alliance.requested&&!d.alliance.active?'<span>Подготовка оборонного союза</span>':''}${d.alliance.active?`<button data-defense-action="leaveAlliance" ${locked?'disabled':''}>Выйти из союза</button>`:''}</div></div></details>`:'';
 return `<section class="army-panel"><header class="army-heading">${shield}<div><span class="army-heading-kicker">ОБОРОНА</span><h2>Армия</h2></div></header><div class="army-budget-grid army-core-stats"><article class="army-budget-card"><span>Личный состав</span><i class="army-card-mark" aria-hidden="true">✦</i><strong>${d?.enabled?n(d.active*1e6,0):'—'}<small>человек</small></strong>${d?.enabled?`<div>Резерв <b>${n(d.reserve*1e6,0)}</b></div>${defenseEconomyActive(state)?`<div>Средняя зарплата военных на руки <b>${d.economy.accounts?.people?n(d.economy.accounts.net/d.economy.accounts.people,0)+' / мес.':'—'}</b></div>`:''}`:''}</article><article class="army-budget-card"><span>Боеготовность</span><i class="army-card-mark" aria-hidden="true">◎</i><strong>${d?.enabled?n(d.readiness*100,0):'—'}<small>%</small></strong></article><article class="army-budget-card"><span>Военные расходы</span><i class="army-card-mark" aria-hidden="true">◈</i><strong>${a.paid===null?'—':n(a.paid,1)}<small>млн / месяц</small></strong><div>За 12 месяцев <b>${n(state.metrics.militaryExpenditureGDP??0,2)}% ВВП</b></div>${d?.enabled&&state.month>d.startedMonth&&d.funding<.8?`<div class="army-funding">Исполнение <b>${n(d.funding*100,0)}%</b></div>`:''}</article><article class="army-budget-card army-status ${d?.war?'at-war':d?.crisis?'at-risk':''}"><span>Обстановка</span><i class="army-card-mark" aria-hidden="true">✧</i><strong>${esc(defenseStatus(state))}</strong>${d?.alliance.active?'<div>Союз действует</div>':''}</article></div>${conflict?`<div class="army-conflict"><b>${esc(neighbor?.name??'Внешний конфликт')}</b><span>${d.war?'Контроль территории '+n((1-d.occupation)*100,0)+'%':'До истечения ультиматума '+Math.max(0,d.crisis.deadline-state.month)+' мес.'}</span>${d.totalKilled>0?`<span>Погибшие: ${n(d.totalKilled*1e6,0)}</span>`:''}</div>`:''}<button class="army-budget-link" data-action="army-budget">Военный бюджет <span aria-hidden="true">→</span></button>${controls}</section>`;
}

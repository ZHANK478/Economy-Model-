// Fiscal foundation only. No invented force size, readiness, combat bonuses or
// change in security-service loyalty. SIPRI's expenditure categories can later
// split this aggregate once personnel, equipment and supply stocks are modeled.
export function armyBudgetSummary(state,plannedPolicy=state.policy){
 const rate=plannedPolicy.militaryBudget??0;
 const nextMonth=state.base.monthlyGDP*state.consumerPriceIndex/100*rate/100;
 const paid=state.month>0?(state.lastReport.fiscal?.militaryPurchases??0):null;
 const total=state.metrics.governmentSpending;
 return {rate,nextMonth,paid,spendingShare:paid!==null&&total>0?paid/total*100:null};
}
export function armyView(state,plannedPolicy,{n}){
 const a=armyBudgetSummary(state,plannedPolicy);
 return `<section class="army-panel"><header class="army-heading"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m24 4 17 6v13c0 11-17 20-17 20S7 34 7 23V10l17-6Z"/><path d="m24 13 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z"/></svg><h2>Армия</h2></header><div class="army-budget-grid"><article class="army-budget-card"><span>Военный бюджет</span><strong>${n(a.rate,2)}<small>% опорного ВВП</small></strong><div>План на месяц <b>${n(a.nextMonth,1)} млн</b></div></article><article class="army-budget-card"><span>Расходы за месяц</span><strong>${a.paid===null?'—':n(a.paid,1)}<small>${a.paid===null?'':'млн'}</small></strong><div>Доля расходов бюджета <b>${a.spendingShare===null?'—':n(a.spendingShare,1)+'%'}</b></div></article></div><button class="army-budget-link" data-action="army-budget">Военный бюджет <span aria-hidden="true">→</span></button></section>`;
}

import {regimeActive,regimeCouncil} from './regime-dynamics.js';
const types={democracy:'Конкурентная демократия',hybrid:'Смешанный политический режим',personalist:'Личная власть',party:'Партийное правление',military:'Военный совет'};
export function regimePanel(s,{n,pct,row,esc,canAct=true}){
 if(!s.politics.enabled)return '';
 if(!regimeActive(s))return '<details class="panel method-details"><summary>Институты власти</summary><p class="small muted">Новая модель отношений элит, преемственности и общественных выступлений включится после следующего месяца. Прежняя история сохранится.</p></details>';
 const p=s.politics,r=p.regimeDynamics,c=regimeCouncil(s),closed=!s.policy.competitiveElections;
 const button=(action,label,enabled=true)=>`<button data-political-action="regimeAction" data-regime-action="${action}" ${!p.executive.inOffice||!canAct||!enabled?'disabled':''}>${label}</button>`;
 const events=r.notices.slice(-3).reverse();
 return `<details class="panel method-details regime-panel" ${r.successionCrisis>.2||r.electoralDispute>.15||r.nationalMobilization>.25?'open':''}><summary>Институты власти · ${esc(types[r.effectiveType])}</summary>
 ${row('Руководитель',esc(r.leader.name)+' · '+n(r.leader.ageMonths/12,0)+' лет')}
 ${row('Реальная опора власти',c.power>.35?(c.kind==='officers'?'Совет офицеров':'Руководящий совет партии'):closed?'Личный контроль руководителя':'Выборный мандат',c.power>.35?'Совет может отклонять решения о своих ресурсах и полномочиях.':'Решение и его исполнение зависят от разных институтов.')}
 ${row('Согласованность правящей коалиции',n(r.eliteCohesion*100,0)+' / 100')}
 ${row('Готовность передачи власти',n(r.successionReadiness*100,0)+' / 100',r.successor?'Согласуется: '+esc(r.successor.name):closed?'Имя преемника и признание процедуры — разные условия.':'Устойчивость процедуры зависит от качества выборов.')}
 ${r.successor?row('Согласуемый преемник',esc(r.successor.name)):''}
 ${r.successionCrisis>.05?row('Спор о преемственности',n(r.successionCrisis*100,0)+' / 100'):''}
 ${r.nationalMobilization>.05?row('Общенациональная мобилизация',n(r.nationalMobilization*100,0)+' / 100','Индекс активности, а не доля населения.'):''}
 <details class="method-details"><summary>Аппарат, общество и экономика</summary>
 ${row('Информация для управления',n(r.informationQuality*100,0)+' / 100','СМИ, расследования, жалобы и раскрытие контрактов.')}
 ${row('Способность служб безопасности',n(r.securityCapacity*100,0)+' / 100','Оплаченные реальные ресурсы с учётом населения; это не военная боеспособность.')}
 ${row('Местные выступления',n((r.last?.localMobilization??0)*100,0)+' / 100','Местные требования не равнозначны попытке смены власти.')}
 ${row('Потеря рабочего времени',pct(r.lostWorkFraction*100))}
 ${row('Риск в стоимости инвестиций',n((r.last?.uncertaintyPremium??0)*100,2)+' п.п.','Передача власти, спорные выборы и насилие; одинаковый механизм при любом режиме.')}
 <p class="small muted">Все индексы — состояния симуляции. Числовые масштабы открыты в сохранении; они не являются оценками вероятностей для конкретной страны.</p></details>
 ${closed?`<div class="section-actions">${button('successorAgreement','Согласовать преемника',!r.successor)}${button('handover','Передать руководство',r.leader.startedMonth+12<=s.month&&(Boolean(r.successor)||s.policy.successionProcedure==='council'))}</div>`:''}
 ${closed&&c.kind==='officers'&&r.militaryAutonomy>=.5&&r.personalControl<=.65?`<div class="section-actions">${r.transition&&r.transition.status!=='completed'?button('cancelTransition','Отменить пакт'):button('civilianTransition','Пакт о гражданском правлении',!r.transition&&s.month>=r.transitionCooldown)}</div>`:''}
 ${r.transition?row('Переход к гражданскому правлению',r.transition.status==='completed'?'Выборы назначены':r.transition.status==='stalled'?'Согласование остановилось':n(r.transition.progress*100,0)+'%','Пакт может застрять или быть отменён; исход выборов не предрешён.'):''}
 ${r.civilianDemand>.25?row('Требование совета офицеров','Обсудить гражданское правление'):''}
 ${events.length?`<details class="method-details"><summary>Последние события</summary>${events.map(x=>row('Событие',esc(x.text))).join('')}</details>`:''}
 </details>`;
}

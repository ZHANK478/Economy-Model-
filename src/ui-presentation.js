// Presentation only. Full explanations and all calculations remain in source/export.
export function compactGameCopy(root) {
  if(typeof root.querySelectorAll!=='function')return;
  root.querySelectorAll('.policy-help,.meta,.authority-tag,.eyebrow,.sidebar-head,.policy-foot').forEach(el=>el.remove());
  root.querySelectorAll('#view-content p').forEach(el=>{
    if(el.closest('.election-result')||el.classList.contains('law-outcome')||el.querySelector('button,input,select'))return;
    el.remove();
  });
  root.querySelectorAll('p.small.muted,.chart-empty>div').forEach(el=>el.remove());
  root.querySelectorAll('details').forEach(el=>{
    const label=el.querySelector(':scope>summary')?.textContent.trim()??'';
    if(/^(Почему|Формулы|Полная запись|Полные решения|Как исполняются)/.test(label))el.remove();
  });
  root.querySelectorAll('.callout').forEach(el=>{
    if(!el.querySelector('button')&&!el.closest('#result-dialog')&&/условн|коэффициент|модел|прогноз|ВВП повторно|мгновенно/.test(el.textContent))el.remove();
  });
  root.querySelectorAll('a[href*="docs/"]').forEach(el=>el.remove());
  root.querySelectorAll('.trend-popup>p,.settings-popup>p,.policy-panel>.callout').forEach(el=>el.remove());
  root.querySelectorAll('.law-outcome').forEach(el=>{if(el.textContent.startsWith('Закон принят'))el.textContent='Принято';});
  root.querySelectorAll('.method-details').forEach(el=>{if(!el.querySelector('button,input,select,table,.data-row'))el.remove();});
}

const STEPS = {
  government: [
    ['.strategy-window-head [data-strategy-close]', 'Возвращение на карту', 'Закройте этот раздел, чтобы открыть переговоры.'],
    ['.strategy-situation [data-view="government"]', 'Сформируйте правительство', 'Откройте переговоры о коалиции.'],
  ],
  coalition: [
    ['.coalition-negotiations [data-parliament="form"]:not(:disabled)', 'У вас есть большинство', 'Сформируйте кабинет, чтобы управлять страной.'],
    ['.opening-partner [data-parliament="accept"]:not(:disabled)', 'Договоритесь с партнёром', 'Места обеих партий складываются. Для кабинета нужно большинство.'],
    ['.parliament-parties [data-parliament="accept"]:not(:disabled)', 'Договоритесь с партнёром', 'Места обеих партий складываются. Для кабинета нужно большинство.'],
  ],
  decisions: [
    ['[data-policy-number="incomeTax"]:not(:disabled)', 'Измените подоходный налог', 'Введите новую ставку и нажмите Enter или передвиньте ползунок. Вы увидите результат голосования.'],
    ['[data-policy-tab="Налоги"]', 'Откройте налоги и пошлины', 'Здесь можно менять налоговые ставки.'],
    ['.strategy-game [data-decision-collection="treasury"]:not([aria-pressed="true"])', 'Откройте казну', 'В ней находятся налоги и бюджет.'],
    ['.atlas-decisions-toggle', 'Откройте решения', 'Отсюда меняют налоги, расходы и другие меры.'],
  ],
  turn: [
    ['[data-action="step"]:not(:disabled)', 'Завершите месяц', 'Игра рассчитает новые показатели.'],
  ],
  budget: [
    ['[data-monthly-budget]', 'Вот баланс за месяц', 'Здесь виден итог доходов и расходов.'],
  ],
};

export function mountOpeningGuide(app, esc) {
  let target, bubble;
  function position() {
    if (!target?.isConnected || !bubble?.isConnected) return;
    const rect = target.getBoundingClientRect();
    const width = bubble.offsetWidth, height = bubble.offsetHeight;
    const centre = rect.left + rect.width / 2;
    const left = Math.min(Math.max(12, centre - width / 2), window.innerWidth - width - 12);
    const above = rect.bottom + height + 12 > window.innerHeight && rect.top >= height + 12;
    const top = above ? rect.top - height - 10 : rect.bottom + 10;
    bubble.style.left = left + 'px';
    bubble.style.top = Math.max(8, Math.min(top, window.innerHeight - height - 8)) + 'px';
    bubble.style.setProperty('--guide-arrow', Math.max(13, Math.min(width - 13, centre - left)) + 'px');
    bubble.classList.toggle('above', above);
  }

  globalThis.addEventListener?.('resize', position);
  app.addEventListener('scroll', position, true);
  return step => {
    target?.classList.remove('opening-guide-target');
    bubble?.remove();
    target = bubble = null;
    if (!step || document.body.classList.contains('on-main-menu') || app.querySelector('dialog[open]')) return;

    for (const [selector, title, detail] of STEPS[step] ?? []) {
      const element = app.querySelector(selector);
      if (!element?.getClientRects?.().length) continue;
      target = element;
      bubble = document.createElement('aside');
      bubble.className = 'opening-guide';
      bubble.setAttribute('aria-label', 'Первый ход');
      bubble.innerHTML = `<strong>${esc(title)}</strong><p>${esc(detail)}</p><button type="button" data-action="guide-finish">${step === 'budget' ? 'Завершить обучение' : 'Пропустить обучение'}</button>`;
      target.classList.add('opening-guide-target');
      app.append(bubble);
      target.scrollIntoView({block:'nearest', inline:'nearest'});
      position();
      return;
    }
  };
}

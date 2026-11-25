export function mountSaveMenu({saves, onSave, onLoad, onImport, onExport, onError, esc, translate}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'campaign-saves';
  dialog.setAttribute('aria-labelledby', 'campaign-saves-title');
  document.body.append(dialog);
  let options, entries, confirming, working = false, error = '';

  function render() {
    const saving = options.mode === 'save';
    dialog.innerHTML = `<header class="popup-head"><h2 id="campaign-saves-title">${saving ? 'Сохранить игру' : 'Загрузить игру'}</h2><button data-close-button type="button" data-save-action="close" aria-label="Закрыть">×</button></header>
      ${saving ? `<form class="campaign-save-form"><label>Название сохранения<input name="name" maxlength="60" placeholder="Название (необязательно)" autofocus></label><button type="submit" class="primary">Сохранить</button></form>` :
    `<div class="campaign-save-list">${entries.map((entry, index) => `<div class="campaign-save-row">
        <div><strong${entry.automatic ? '' : ' data-locale-fixed'}>${esc(entry.name)}</strong><small>${entry.automatic ? '<span>Автосохранение</span> · ' : ''}${esc(entry.date)}</small></div>
        ${confirming === index ? `<p>Удалить это сохранение?</p><button type="button" data-save-action="delete" data-save-index="${index}">Удалить</button><button type="button" data-save-action="cancel">Отмена</button>` :
    `<button type="button" data-save-action="load" data-save-index="${index}">Загрузить</button><button type="button" data-save-action="confirm" data-save-index="${index}">Удалить</button>`}
      </div>`).join('') || '<p>Здесь появятся сохранённые партии.</p>'}</div>`}
      <p class="campaign-save-error" role="status">${esc(error)}</p>
      <footer>${saving ? '<button type="button" data-save-action="export">Скачать копию</button>' :
    `${options.resume ? '<button type="button" data-save-action="resume">Вернуться к партии</button>' : ''}<button type="button" data-save-action="import">Загрузить из файла</button>`}</footer>`;
  }

  async function run(action,kind) {
    if (working) return;
    working = true;
    dialog.setAttribute('aria-busy','true');
    error = '';
    try { await action(); }
    catch (cause) { if(kind)onError?.(kind,cause); error = translate(cause.message ?? String(cause)); if (dialog.open) {
      const message = dialog.querySelector('.campaign-save-error');
      if (message) message.textContent = error;
    } }
    finally { working = false; dialog.removeAttribute('aria-busy'); }
  }

  dialog.addEventListener('submit', event => {
    event.preventDefault();
    if (options.mode !== 'save') return;
    const name = new FormData(event.target).get('name');
    void run(async () => { await onSave(name); dialog.close(); },'save');
  });
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-save-action]');
    if (!button || working) return;
    const {saveAction, saveIndex} = button.dataset;
    const index = Number(saveIndex);
    const entry = entries[index];
    if (saveAction === 'close') dialog.close();
    if (saveAction === 'export' && options.mode === 'save') void run(onExport,'save');
    if (saveAction === 'import') { dialog.close(); onImport(); }
    if (saveAction === 'resume') { dialog.close(); options.resume(); }
    if (saveAction === 'cancel' || saveAction === 'confirm' && entry) {
      const focusIndex = confirming ?? index;
      confirming = saveAction === 'confirm' ? index : null;
      render();
      dialog.querySelector(`[data-save-action="${confirming === null ? 'confirm' : 'delete'}"][data-save-index="${focusIndex}"]`)?.focus();
    }
    if (saveAction === 'load' && entry) void run(async () => { await onLoad(await saves.load(entry.key)); dialog.close(); },'load');
    if (saveAction === 'delete' && entry && confirming === index) void run(async () => {
      await saves.remove(entry.key);
      entries = await saves.list();
      confirming = null;
      render();
      dialog.querySelector('[data-save-action="close"]')?.focus();
    });
  });
  dialog.addEventListener('cancel', event => { if (working) event.preventDefault(); });
  return {async open(next) {
    if (working) return;
    options = next;
    entries = [];
    confirming = null;
    error = '';
    if (options.mode === 'load') await run(async () => { entries = await saves.list(); },'load');
    render();
    if (!dialog.open) dialog.showModal();
  }};
}

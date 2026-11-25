import {activeLanguage} from './localization.js';

const service = {
  url: 'https://xrttculzgunlvzrlpffi.supabase.co/functions/v1/mandatewright-analytics',
  key: 'sb_publishable_1KYjjoRDhO7d4TfwVzQCQA_JMhnn6HF'
};
export const PLAYTEST_BUILD = '0.4.4';
const preference = 'mandatewright.stats.off';
const cohortKey = 'mandatewright.stats.start-day';
const dayMs = 86_400_000;
const cohortDays = 90;
const idleMs = 5 * 60_000;

export function createPlaytestAnalytics({
  endpoint = /(^|\.)itch\.zone$/i.test(globalThis.location?.hostname ?? '') ? service : null,
  storage, now = Date.now, send = fetch,
  visible = globalThis.document?.visibilityState !== 'hidden',
  privacySignal = globalThis.navigator?.globalPrivacyControl === true
} = {}){
  let optedOut = false;
  try {
    if (endpoint) {
      storage ??= globalThis.localStorage;
      optedOut = storage?.getItem(preference) === '1';
    }
  } catch {
    // Do not collect if the browser does not let us read its saved setting.
    optedOut = true;
  }

  let clock = now(), lastActivity = clock, playing = false, playMs = 0, bufferedMs = 0;
  let pending = Object.create(null), cohortCheckedDay;
  const seen = new Set();
  const enabled = () => Boolean(endpoint) && !optedOut && !privacySignal;

  function mark(name){
    if (!enabled() || !visible || seen.has(name)) return;
    seen.add(name);
    pending[name] = 1;
  }

  function markCohort(){
    if (!enabled() || !visible || !playing) return;
    const day = Math.floor(clock / dayMs);
    if (day === cohortCheckedDay) return;
    cohortCheckedDay = day;
    try {
      // Track only a date and two reported milestones on the device.
      // Each return is sent as a counter increment, with no linked record.
      const cohort = JSON.parse(storage?.getItem(cohortKey) ?? 'null');
      if (!cohort || !Number.isInteger(cohort.day) || cohort.day > day || day - cohort.day >= cohortDays) {
        storage.setItem(cohortKey,JSON.stringify({day,returns:0}));
        pending.newBrowser = 1;
        flush();
        return;
      }
      const elapsed = day - cohort.day;
      const bit = elapsed === 1 ? 1 : elapsed === 7 ? 2 : 0;
      if (bit && !(cohort.returns & bit)) {
        storage.setItem(cohortKey,JSON.stringify({day:cohort.day,returns:cohort.returns | bit}));
        pending[bit === 1 ? 'returnD1' : 'returnD7'] = 1;
        flush();
      }
    } catch {}
  }

  function update(){
    const t = now();
    if (enabled() && playing && visible) {
      const elapsed = Math.max(0, Math.min(t,lastActivity + idleMs) - clock);
      playMs += elapsed;
      bufferedMs += elapsed;
      if (playMs >= 5 * 60_000) mark('played5');
      if (playMs >= 15 * 60_000) mark('played15');
    }
    clock = t;
  }

  function flush(){
    if (!enabled()) return;
    const seconds = Math.floor(bufferedMs / 1000);
    if (seconds) {
      pending.seconds = seconds;
      bufferedMs -= seconds * 1000;
    }
    if (!Object.keys(pending).length) return;
    const body = JSON.stringify({build:PLAYTEST_BUILD, counters:pending});
    pending = Object.create(null);
    // Counter increments are intentionally not retried after uncertain delivery.
    void send(endpoint.url, {
      method:'POST', headers:{apikey:endpoint.key,'Content-Type':'application/json'},
      credentials:'omit', referrerPolicy:'no-referrer', keepalive:true, body
    }).catch(() => {});
  }

  function setOptOut(value){
    optedOut = value;
    pending = Object.create(null);
    bufferedMs = 0;
    playMs = 0;
    cohortCheckedDay = undefined;
    clock = lastActivity = now();
  }

  return {
    available: Boolean(endpoint) && !privacySignal,
    get enabled(){return enabled();},
    toggle(){
      setOptOut(!optedOut);
      try {
        if (optedOut) {
          storage?.setItem(preference,'1');
          storage?.removeItem(cohortKey);
        } else storage?.removeItem(preference);
      } catch {}
    },
    syncPreference(event){
      if (event.key === preference || event.key === null) setOptOut(event.newValue === '1');
    },
    interact(){
      update();
      lastActivity = clock;
      markCohort();
    },
    mark,
    play(value, resumed = false){
      update();
      playing = value;
      lastActivity = clock;
      if (playing) {
        mark('play');
        mark(resumed ? 'resume' : 'newGame');
        markCohort();
      }
      flush();
    },
    tick(){
      update();
      flush();
    },
    visibility(value){
      update();
      visible = value;
      if (!value) flush();
    }
  };
}

export function analyticsToggleLabel(analytics){
  const en = activeLanguage() === 'en';
  if (analytics.enabled) return en ? 'Turn off play statistics' : 'Отключить статистику игры';
  return en ? 'Turn on play statistics' : 'Включить статистику игры';
}

export function analyticsField(analytics){
  if (!analytics?.available) return '';
  const details = activeLanguage() === 'en'
    ? 'To improve Mandatewright, Supabase receives totals for game starts, returns, active time and milestones. The first play date stays in your browser to count returns. The game sends no player or device ID.'
    : 'Чтобы улучшать Mandatewright, мы считаем запуски, возвраты, активное время и игровые этапы через Supabase. Дата первой игры нужна для подсчёта возвратов и остаётся в браузере. Игра не отправляет код игрока или устройства.';
  return `<div data-locale-fixed><p class="small">${details}</p><button type="button" data-analytics-toggle>${analyticsToggleLabel(analytics)}</button></div>`;
}

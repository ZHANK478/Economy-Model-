import {activeLanguage} from './localization.js';

const service = {
  url: 'https://xrttculzgunlvzrlpffi.supabase.co/functions/v1/mandatewright-analytics',
  key: 'sb_publishable_1KYjjoRDhO7d4TfwVzQCQA_JMhnn6HF'
};
export const PLAYTEST_BUILD = '0.4.4';
const preference = 'mandatewright.analytics.v1';
const idleMs = 5 * 60_000;
const sessionGapMs = 30 * 60_000;
const flags = {
  menu:1, party:2, play:4, cabinet:8, vote:16, month1:32, month3:64, month12:128,
  election:256, nextCabinet:512, budget:1024, parliament:2048, map:4096, newspaper:8192, save:16384
};

export function createPlaytestAnalytics({
  endpoint = /(^|\.)itch\.zone$/i.test(globalThis.location?.hostname ?? '') ? service : null,
  storage, now = Date.now, uuid = () => crypto.randomUUID(), send = fetch,
  visible = globalThis.document?.visibilityState !== 'hidden'
} = {}){
  let token = '';
  try {
    if (endpoint) {
      storage ??= globalThis.localStorage;
      token = storage?.getItem(preference) ?? '';
    }
  } catch {}

  let visit, day, clock, lastActivity, milliseconds = 0, mask = 0, playing = false;
  let acknowledged, inFlight;
  const pending = new Map();

  function flush(){
    if (!token) return;
    if (mask) {
      const seconds = Math.floor(milliseconds / 1000);
      const value = JSON.stringify({token, visit, day, build:PLAYTEST_BUILD, seconds, flags:mask});
      const key = visit + day;
      if (value !== acknowledged) pending.set(key,value);
      if (pending.size > 8) pending.delete(pending.keys().next().value);
    }
    if (inFlight || !pending.size) return;
    const [key,value] = pending.entries().next().value;
    const consentToken = token;
    const flight = Promise.resolve().then(() => {
      if (token !== consentToken) return;
      return send(endpoint.url, {
        method:'POST', headers:{apikey:endpoint.key,'Content-Type':'application/json'},
        credentials:'omit', referrerPolicy:'no-referrer', keepalive:true, body:value
      });
    }).then(response => {
      if (!response?.ok || token !== consentToken) return;
      acknowledged = value;
      if (pending.get(key) === value) pending.delete(key);
      return true;
    }).catch(() => {}).then(sent => {
      if (inFlight !== flight) return;
      inFlight = undefined;
      if (sent && pending.size) flush();
    });
    inFlight = flight;
  }

  function start(t, newVisit){
    if (newVisit) {
      visit = uuid();
      lastActivity = t;
    }
    clock = t;
    day = new Date(t).toISOString().slice(0,10);
    milliseconds = 0;
    mask = newVisit ? flags.menu : 0;
  }

  function update(t){
    if (!visit) return;
    const midnight = Date.parse(day + 'T00:00:00Z') + 86_400_000;
    const until = Math.min(t, midnight);
    if (playing && visible) milliseconds += Math.max(0, Math.min(until,lastActivity + idleMs) - clock);
    clock = until;
    if (midnight > t) return;
    flush();
    start(t, false);
    if (playing && visible) {
      milliseconds = Math.max(0, Math.min(t,lastActivity + idleMs) - midnight);
      if (milliseconds) mask = flags.menu | flags.play;
    }
  }

  function interact(){
    if (!token || !visible) return;
    const t = now();
    update(t);
    if (!visit || t - lastActivity >= sessionGapMs) {
      flush();
      start(t, true);
    }
    lastActivity = t;
    mask |= flags.menu;
    if (playing) mask |= flags.play;
  }

  function mark(name){
    if (!token || !visible) return;
    if (!mask) interact();
    mask |= flags[name];
  }

  function play(value){
    if (token) update(now());
    playing = value;
    interact();
    flush();
  }

  function clearConsent(){
    token = '';
    visit = undefined;
    mask = 0;
    pending.clear();
    acknowledged = undefined;
    inFlight = undefined;
  }

  return {
    available: Boolean(endpoint),
    syncConsent(event){
      if ((event.key === preference || event.key === null) && !event.newValue) clearConsent();
    },
    get consent(){return Boolean(token);},
    setConsent(value){
      if (!endpoint) return false;
      try {
        if (value && !token) {
          const next = uuid();
          storage.setItem(preference,next);
          token = next;
          interact();
          flush();
        } else if (!value && token) {
          clearConsent();
          storage.removeItem(preference);
        }
      } catch {}
      return Boolean(token);
    },
    interact, mark, play,
    tick(){
      if (!token) return;
      update(now());
      flush();
    },
    visibility(value){
      if (!token) {
        visible = value;
        return;
      }
      update(now());
      visible = value;
      if (!value) flush();
    }
  };
}

export function analyticsField(analytics){
  if (!analytics.available) return '';
  const en = activeLanguage() === 'en';
  const title = en ? 'Share playtest statistics (optional)' : 'Делиться статистикой плейтеста (по желанию)';
  const details = en
    ? 'Sends play time and milestones with a random browser ID. You can turn this off in Settings.'
    : 'Передаёт время игры и пройденные этапы со случайным кодом браузера. Это можно отключить в настройках.';
  return `<div data-locale-fixed><label><input type="checkbox" data-analytics-consent ${analytics.consent?'checked':''}> ${title}</label><p class="small">${details}</p></div>`;
}

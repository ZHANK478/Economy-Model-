import {analyticsSections} from './analytics-diagnostics.js';
import {activeLanguage} from './localization.js';

const service = {
  url: 'https://xrttculzgunlvzrlpffi.supabase.co/functions/v1/mandatewright-analytics',
  key: 'sb_publishable_1KYjjoRDhO7d4TfwVzQCQA_JMhnn6HF'
};
export const PLAYTEST_BUILD = '0.4.4';
const preference = 'mandatewright.stats.off';
const funnelKey = 'mandatewright.stats.campaigns';
const stages = ['begin','party','launch','cabinet','vote','month1','month3','month12','election','nextCabinet'];
const cohortKey = 'mandatewright.stats.start-day';
const dayMs = 86_400_000;
const cohortDays = 90;
const idleMs = 5 * 60_000;

export function createPlaytestAnalytics({
  endpoint = /(^|\.)itch\.zone$/i.test(globalThis.location?.hostname ?? '') ? service : null,
  storage, now = Date.now, send = fetch, uuid = () => crypto.randomUUID(),
  testRun = new URLSearchParams(globalThis.location?.search).get('analytics') === 'test',
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
  let pending = Object.create(null), cohortCheckedDay, campaignId, section = 'startup', ready = false, lastDiagnostic = -Infinity;
  const outgoing = new Map();
  const campaignStash = Object.create(null);
  const seen = new Set();
  const enabled = () => Boolean(endpoint) && !optedOut && !privacySignal && !testRun;

  function count(name,value=1){
    if (!enabled() || !Number.isSafeInteger(value) || value < 1) return;
    pending[name] = (pending[name] ?? 0) + value;
  }

  function mark(name){
    if (!enabled() || !visible || seen.has(name)) return;
    seen.add(name);
    count(name);
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

  function sendBatch(entry){
    if (entry.sending || now() < entry.retryAt || !enabled()) return;
    entry.sending = true;
    entry.attempts++;
    const failed = () => {
      entry.sending = false;
      entry.retryAt = now() + 10_000 * 2 ** (entry.attempts-1);
      if (entry.attempts >= 4) outgoing.delete(entry.id);
    };
    void send(endpoint.url, {
      method:'POST', headers:{apikey:endpoint.key,'Content-Type':'application/json'},
      credentials:'omit', referrerPolicy:'no-referrer', keepalive:true, body:entry.body
    }).then(response => {
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429))
        outgoing.delete(entry.id);
      else failed();
    }).catch(failed);
  }

  function enqueue(counters,day,build=PLAYTEST_BUILD){
    for(const key of Object.keys(counters)){
      // Keep requests small even after unusually large offline simulation steps.
      counters[key]=Math.min(counters[key], key==='seconds'?3600:key==='load.ms'?600000:10000);
    }
    const entries=Object.entries(counters);
    for(let index=0;index<entries.length;index+=32){
      const id=uuid(), counters=Object.fromEntries(entries.slice(index,index+32));
      const body=JSON.stringify({build,batch:id,counters,...(day===undefined?{}:{day})});
      const entry={id,body,attempts:0,retryAt:0,sending:false};
      if(outgoing.size>=24)outgoing.delete(outgoing.keys().next().value);
      outgoing.set(id,entry);
      sendBatch(entry);
    }
  }

  function flush(){
    if (!enabled()) return;
    const seconds = Math.floor(bufferedMs / 1000);
    if (seconds) {
      count('seconds',seconds);
      bufferedMs -= seconds * 1000;
    }
    if (Object.keys(pending).length) {
      const counters=pending;
      pending=Object.create(null);
      enqueue(counters);
    }
    for(const entry of outgoing.values())sendBatch(entry);
  }

  function stage(name){
    if(!enabled()||!campaignId||!stages.includes(name))return;
    const currentDay=Math.floor(now()/dayMs);
    let campaigns=campaignStash;
    try{campaigns=Object.assign(Object.create(null),campaignStash,JSON.parse(storage?.getItem(funnelKey)??'null'));}catch{}
    let row=campaigns[campaignId];
    if(!row&&name!=='begin')return;
    row??={day:currentDay,build:PLAYTEST_BUILD,reached:0,sent:0};
    if(currentDay-row.day>=cohortDays||row.day>currentDay)return;
    row.reached|=1<<stages.indexOf(name);
    const increments={};
    while(row.sent<stages.length && (row.reached & (1<<row.sent))) {
      increments['funnel.'+stages[row.sent]]=1;
      row.sent++;
    }
    campaigns[campaignId]=row;
    campaignStash[campaignId]=row;
    const retained=Object.entries(campaigns).filter(([,item])=>currentDay-item.day<cohortDays);
    try{storage?.setItem(funnelKey,JSON.stringify(Object.fromEntries(retained.slice(-120))));}catch{}
    if(Object.keys(increments).length)enqueue(increments,row.day,row.build);
  }

  function setOptOut(value){
    optedOut = value;
    pending = Object.create(null);
    outgoing.clear();
    for(const id of Object.keys(campaignStash))delete campaignStash[id];
    bufferedMs = 0;
    playMs = 0;
    cohortCheckedDay = undefined;
    clock = lastActivity = now();
  }

  return {
    available: Boolean(endpoint) && !privacySignal && !testRun,
    get enabled(){return enabled();},
    toggle(){
      setOptOut(!optedOut);
      try {
        if (optedOut) {
          storage?.setItem(preference,'1');
          storage?.removeItem(cohortKey);
          storage?.removeItem(funnelKey);
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
    mark,count,stage,
    campaign(id){campaignId=id;},
    section(value){section=analyticsSections.includes(value)?value:'other';},
    failure(action,reason){count('failure.'+action+'.'+reason);},
    diagnostic(kind,reason,inSection=section){
      if(!enabled())return;
      count('error.'+(analyticsSections.includes(inSection)?inSection:'other')+'.'+kind+'.'+reason);
      const t=now();
      if(t-lastDiagnostic>=10_000){lastDiagnostic=t;flush();}
    },
    ready(ms){
      if(ready)return;
      ready=true;
      if(!Number.isFinite(ms)||ms<0)return;
      count('load.samples');
      count('load.ms',Math.max(1,Math.min(600000,Math.round(ms))));
      count('load.'+(ms<1000?'under1':ms<3000?'under3':ms<10000?'under10':'over10'));
      flush();
    },
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

export const playtestAnalytics=createPlaytestAnalytics();

export function analyticsToggleLabel(analytics){
  const en = activeLanguage() === 'en';
  if (analytics.enabled) return en ? 'Turn off play statistics' : 'Отключить статистику игры';
  return en ? 'Turn on play statistics' : 'Включить статистику игры';
}

export function analyticsField(analytics){
  if (!analytics?.available) return '';
  const details = activeLanguage() === 'en'
    ? 'To improve Mandatewright, Supabase receives totals for game starts, returns, active time, milestones, loading and game errors. The first play date and campaign progress stay in your browser to count returns and milestones. The game sends no player or device ID.'
    : 'Чтобы улучшать Mandatewright, мы считаем запуски, возвраты, активное время, прогресс, время загрузки и игровые ошибки через Supabase. Дата первой игры и отметки о прохождении кампании остаются в браузере. Игра не отправляет код игрока или устройства.';
  return `<div data-locale-fixed><p class="small">${details}</p><button type="button" data-analytics-toggle>${analyticsToggleLabel(analytics)}</button></div>`;
}

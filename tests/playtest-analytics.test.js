import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaytestAnalytics} from '../src/playtest-analytics.js';
import {installAnalyticsDiagnostics,decisionFailureReason} from '../src/analytics-diagnostics.js';
import {createGameplayObservation} from '../src/analytics-gameplay.js';

function fixture({stored = new Map(), privacySignal = false, testRun=false, response=()=>({ok:true})} = {}){
  const sent = [];
  let t = Date.parse('2026-11-25T12:00:00Z');
  const storage = {
    getItem:key => stored.get(key),
    setItem:(key,value) => stored.set(key,value),
    removeItem:key => stored.delete(key)
  };
  const analytics = createPlaytestAnalytics({
    endpoint:{url:'https://test.invalid',key:'test'}, storage, now:() => t, privacySignal, testRun,
    send:async (_,init) => {
      assert.equal(init.credentials,'omit');
      assert.equal(init.referrerPolicy,'no-referrer');
      sent.push(JSON.parse(init.body));
      return response();
    }
  });
  return {analytics,stored,sent,advance: ms => {t += ms;}};
}

test('default collection sends only counters and a build, and records milestones once per tab',() => {
  const {analytics,stored,sent,advance} = fixture();
  assert.equal(analytics.enabled,true);
  analytics.tick();
  assert.equal(sent.length,0);

  analytics.mark('menu');
  analytics.play(true);
  assert.deepEqual(Object.keys(sent[0]).sort(),['batch','build','counters']);
  assert.deepEqual(sent[0].counters,{menu:1,play:1,newGame:1,newBrowser:1});
  analytics.mark('vote');
  analytics.mark('vote');
  advance(125_000);
  analytics.visibility(false);
  assert.deepEqual(sent.at(-1).counters,{vote:1,seconds:125});
  advance(60 * 60_000);
  analytics.tick();
  assert.equal(sent.length,2);
  assert.deepEqual(JSON.parse([...stored.values()][0]),{day:Math.floor(Date.parse('2026-11-25') / 86400000),returns:0});
});

test('time pauses after five minutes idle and resumptions have a separate counter',() => {
  const {analytics,sent,advance} = fixture();
  analytics.play(true,true);
  assert.deepEqual(sent[0].counters,{play:1,resume:1,newBrowser:1});
  advance(8 * 60_000);
  analytics.tick();
  assert.deepEqual(sent[1].counters,{played5:1,seconds:300});
  analytics.interact();
  advance(15_000);
  analytics.tick();
  assert.deepEqual(sent[2].counters,{seconds:15});
});

test('opting out clears unsent counters and applies to future tabs',() => {
  const {analytics,stored,sent} = fixture();
  analytics.mark('menu');
  analytics.toggle();
  analytics.play(true);
  analytics.tick();
  assert.equal(sent.length,0);
  const next = fixture({stored});
  assert.equal(next.analytics.enabled,false);
  next.analytics.play(true);
  assert.equal(next.sent.length,0);
  assert.equal(fixture({privacySignal:true}).analytics.enabled,false);
});

test('browser returns contribute anonymous counters exactly once in each qualifying day',() => {
  const {analytics,stored,sent,advance} = fixture();
  analytics.play(true);
  advance(86400000);
  analytics.interact();
  assert.equal(sent.at(-1).counters.returnD1,1);
  const count = sent.length;
  analytics.interact();
  analytics.tick();
  assert.equal(sent.length,count);
  advance(6 * 86400000);
  analytics.interact();
  assert.equal(sent.at(-1).counters.returnD7,1);
  assert.deepEqual(Object.keys(sent.at(-1)).sort(),['batch','build','counters']);
  const other = fixture({stored});
  other.advance(7 * 86400000);
  other.analytics.play(true,true);
  assert.equal(other.sent[0].counters.returnD7,undefined);
});

test('one campaign follows a consistent funnel after reload and sends no campaign ID',() => {
  const first=fixture();
  first.analytics.campaign('campaign-A');
  for(const stage of ['begin','party','launch','month1'])first.analytics.stage(stage);
  assert.deepEqual(first.sent.flatMap(row=>Object.keys(row.counters)),['funnel.begin','funnel.party','funnel.launch']);
  const next=fixture({stored:first.stored});
  next.advance(86400000);
  next.analytics.campaign('campaign-A');
  for(const stage of ['begin','launch','cabinet','vote','month1'])next.analytics.stage(stage);
  assert.deepEqual(next.sent.flatMap(row=>Object.keys(row.counters)),['funnel.cabinet','funnel.vote','funnel.month1']);
  assert.ok(next.sent.every(row=>row.day===first.sent[0].day));
  assert.ok(next.sent.every(row=>!JSON.stringify(row).includes('campaign-A')));
});

test('retries reuse the same batch after a failed response and test runs send nothing',async () => {
  let calls=0;
  const f=fixture({response:()=>({ok:++calls>1,status:calls>1?204:503})});
  f.analytics.play(true);
  await new Promise(resolve=>setImmediate(resolve));
  f.advance(10001);
  f.analytics.tick();
  assert.deepEqual(f.sent[0],f.sent.at(-1));
  const excluded=fixture({testRun:true});
  excluded.analytics.play(true);
  excluded.analytics.ready(1800);
  excluded.analytics.diagnostic('js','TypeError');
  excluded.analytics.tick();
  assert.equal(excluded.sent.length,0);
});

test('diagnostics send categories and startup time with no private error details',() => {
  const f=fixture();
  const listeners={};
  const fakeWindow={addEventListener(type,listener){listeners[type]=listener;}};
  installAnalyticsDiagnostics(f.analytics,fakeWindow);
  f.analytics.section('budget');
  listeners.error({target:fakeWindow,error:new TypeError('secret-name at https://private.invalid')});
  assert.deepEqual(f.sent[0].counters,{'error.budget.js.TypeError':1});
  f.analytics.ready(2301);
  f.analytics.ready(2400);
  assert.deepEqual(f.sent[1].counters,{'load.samples':1,'load.ms':2301,'load.under3':1});
  assert.equal(f.sent.length,2);
  assert.equal(decisionFailureReason('Для нового кабинета нужно больше половины мест'),'majority');
  assert.equal(decisionFailureReason('Соперники могут собрать большинство без вас'),'rivalMajority');
});

test('balance tallies appearances once and keeps election losses and coalition exits distinct',()=>{
  const counts={},stages=[];
  const observer=createGameplayObservation({available:true,enabled:true,
    count:(metric,increase=1)=>{counts[metric]=(counts[metric]??0)+increase;},stage:value=>stages.push(value)});
  const base={month:0,government:{defaults:0},politics:{executor:{},executive:{playerParty:'a'},
    coalition:['a','b'],parliamentary:{phase:'government',history:[{month:0,leader:'a',members:['a','b']}]},bills:[],elections:[]}};
  observer.reset(base);
  const next=structuredClone(base);
  next.month=3;
  next.government.defaults=1;
  next.politics.coalition=['a'];
  next.politics.bills=[{id:1,status:'passed',decidedMonth:3,patch:{incomeTax:18},finalVote:{passed:true}}];
  observer.update(next);
  observer.update(next);
  assert.deepEqual(counts,{'balance.campaignMonths':3,'balance.defaults':1,'balance.coalitionBreakups':1,
    'reform.proposed.incomeTax':1,'reform.passed.incomeTax':1});
  assert.deepEqual(stages,['month1','month3','vote']);
  next.month=7;
  next.politics.elections.push({id:1,kind:'parliament',results:[{id:'a',seats:15},{id:'b',seats:25}]});
  next.politics.parliamentary.phase='forming';
  observer.update(next);
  assert.equal(counts['balance.electionLosses'],1);
  assert.equal(counts['balance.cabinetMonths'],7);
  assert.equal(counts['balance.coalitionBreakups'],1);
});

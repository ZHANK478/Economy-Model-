import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaytestAnalytics} from '../src/playtest-analytics.js';

function fixture({stored = new Map(), privacySignal = false} = {}){
  const sent = [];
  let t = Date.parse('2026-11-25T12:00:00Z');
  const storage = {
    getItem:key => stored.get(key),
    setItem:(key,value) => stored.set(key,value),
    removeItem:key => stored.delete(key)
  };
  const analytics = createPlaytestAnalytics({
    endpoint:{url:'https://test.invalid',key:'test'}, storage, now:() => t, privacySignal,
    send:async (_,init) => {
      assert.equal(init.credentials,'omit');
      assert.equal(init.referrerPolicy,'no-referrer');
      sent.push(JSON.parse(init.body));
      return {ok:true};
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
  assert.deepEqual(Object.keys(sent[0]).sort(),['build','counters']);
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
  assert.deepEqual(Object.keys(sent.at(-1)).sort(),['build','counters']);
  const other = fixture({stored});
  other.advance(7 * 86400000);
  other.analytics.play(true,true);
  assert.equal(other.sent[0].counters.returnD7,undefined);
});

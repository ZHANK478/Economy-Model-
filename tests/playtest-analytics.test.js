import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaytestAnalytics} from '../src/playtest-analytics.js';

function fixture(){
  const stored = new Map(), sent = [];
  let t = Date.parse('2026-11-25T12:00:00Z'), serial = 0;
  const storage = {
    getItem:key => stored.get(key),
    setItem:(key,value) => stored.set(key,value),
    removeItem:key => stored.delete(key)
  };
  const analytics = createPlaytestAnalytics({
    endpoint:{url:'https://test.invalid',key:'test'}, storage, now:() => t, uuid:() => String(++serial),
    send:async (_,init) => {
      assert.equal(init.credentials,'omit');
      assert.equal(init.referrerPolicy,'no-referrer');
      sent.push(JSON.parse(init.body));
      return {ok:true};
    }
  });
  return {analytics,stored,sent,advance: ms => {t += ms;}};
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('playtest summaries require consent, track active time, and stop after opt-out',async () => {
  const {analytics,stored,sent,advance} = fixture();
  analytics.play(true);
  analytics.mark('vote');
  analytics.tick();
  await settle();
  assert.equal(sent.length,0);
  assert.equal(stored.size,0);

  analytics.setConsent(true);
  await settle();
  analytics.mark('vote');
  advance(125_000);
  analytics.visibility(false);
  await settle();
  const first = sent.at(-1);
  assert.deepEqual(Object.keys(first).sort(),['build','day','flags','seconds','token','visit']);
  assert.equal(first.seconds,125);
  assert.equal(first.flags,21);
  advance(33 * 60_000);
  analytics.tick();
  analytics.visibility(true);
  analytics.interact();
  analytics.tick();
  await settle();
  const next = sent.at(-1);
  assert.notEqual(first.visit,next.visit);
  assert.equal(first.token,next.token);
  assert.equal(next.seconds,0);
  analytics.setConsent(false);
  analytics.mark('save');
  analytics.tick();
  await settle();
  assert.equal(stored.size,0);
  assert.equal(sent.at(-1),next);
});

test('an idle background tab does not create a return the next day',async () => {
  const {analytics,sent,advance} = fixture();
  analytics.setConsent(true);
  await settle();
  analytics.play(true);
  advance(30_000);
  analytics.visibility(false);
  await settle();
  const first = sent.at(-1);
  advance(24 * 60 * 60_000);
  analytics.tick();
  await settle();
  assert.equal(sent.at(-1),first);
  analytics.visibility(true);
  analytics.interact();
  analytics.tick();
  await settle();
  assert.notEqual(sent.at(-1).day,first.day);
  assert.notEqual(sent.at(-1).visit,first.visit);
});

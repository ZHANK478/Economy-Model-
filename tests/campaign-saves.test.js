import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignSaves} from '../src/campaign-saves.js';
import {createBrowserStorage} from '../src/storage.js';
import {autosaveSnapshot} from '../src/save-files.js';

test('named saves survive reopening and delete independently of the autosave and other slots', async () => {
  const records = new Map([['economy-model-v5', 'existing autosave']]);
  const disk = {
    get length() { return records.size; },
    key: index => [...records.keys()][index],
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: key => records.delete(key),
  };
  const storage = createBrowserStorage({localStorage:disk, indexedDB:null});
  let sequence = 0;
  const saves = campaignSaves(storage, {now:() => ++sequence, makeId:() => String(sequence)});
  const state = {month:1, journal:[{month:1, applied:true}], policy:{incomeTax:20}};
  await saves.save(' Первая партия ', '02.2000', autosaveSnapshot(state, {incomeTax:21}, {version:1, openingGuide:'budget'}, '5.0.0'));
  state.month = 2;
  state.journal.push({month:2});
  await saves.save('', '03.2000', autosaveSnapshot(state, state.policy, {}, '5.0.0'));
  const reopened = campaignSaves(createBrowserStorage({localStorage:disk, indexedDB:null}));
  const [latest, first] = await reopened.list();
  assert.equal(latest.name, '03.2000');
  assert.equal(first.name, 'Первая партия');
  const old = await reopened.load(first.key);
  assert.equal(old.state.month, 1);
  assert.deepEqual(old.state.journal, [{month:1, applied:true}]);
  assert.equal(old.draftPolicy.incomeTax, 21);
  assert.equal(old.newspaper.openingGuide, 'budget');
  await reopened.remove(first.key);
  assert.deepEqual(await reopened.list(), [latest]);
  await assert.rejects(reopened.load(first.key), /Сохранение не найдено/);
  assert.equal(await storage.get('economy-model-v5'), 'existing autosave');
});

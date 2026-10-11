import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserStorage} from '../src/storage.js';
const local=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
test('browser storage fallback reads previous local records and writes synchronously',async()=>{
  const disk=local(),storage=createBrowserStorage({localStorage:disk,indexedDB:null});disk.setItem('previous','old');assert.equal(await storage.get('previous'),'old');
  const pending=storage.set('current','new');assert.equal(disk.getItem('current'),'new');await pending;
});
test('IndexedDB path commits a long journal, keeps old local copy, and recovers it if a key is absent',async()=>{
  const disk=local(),databaseValues=new Map();disk.setItem('legacy','kept');
  const db={transaction(){const tx={objectStore(){return {
    put(value,key){databaseValues.set(key,value);queueMicrotask(()=>tx.oncomplete());},
    get(key){const request={result:databaseValues.get(key)};queueMicrotask(()=>request.onsuccess());return request;}
  };}};return tx;}};
  const indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request;}};
  const storage=createBrowserStorage({localStorage:disk,indexedDB}),longJournal='x'.repeat(6_000_000);
  assert.equal(await storage.set('journal',longJournal),'IndexedDB');assert.equal(await storage.get('journal'),longJournal);assert.equal(disk.getItem('journal'),null);assert.equal(await storage.get('legacy'),'kept');
  await storage.set('legacy','');assert.equal(await storage.get('legacy'),'');assert.equal(disk.getItem('legacy'),'kept');
});
test('unavailable primary storage can fall back, but quota failure is not reported as successful saving',async()=>{
  const disk=local(),indexedDB={open(){throw new Error('unavailable');}};
  const storage=createBrowserStorage({localStorage:disk,indexedDB});await storage.set('key','value');assert.equal(await storage.get('key'),'value');
  const unavailable=createBrowserStorage({localStorage:{setItem(){throw new Error('quota');},getItem(){return null;}},indexedDB:null});await assert.rejects(unavailable.set('key','value'),/quota/);
});

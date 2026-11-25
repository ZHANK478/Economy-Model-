import {createJournalStorage} from './journal-storage.js';
// Long journals exceed localStorage quotas. IndexedDB stays on this device;
// no accounts, server uploads, or deletion of previous saves are involved.
function browserStorage(name){
  try{return globalThis[name]??null;}catch{return null;}
}

export function createBrowserStorage({localStorage=browserStorage('localStorage'),indexedDB=browserStorage('indexedDB')}={}) {
  const readLocal=key=>{try{return localStorage?.getItem(key)??null;}catch{return null;}};
  const writeLocal=(key,value)=>{
    if(!localStorage)throw new Error('Хранилище браузера недоступно');
    localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
    return 'localStorage';
  };
  let database;
  const open=()=>{
    if(!indexedDB)return Promise.resolve(null);
    if(!database)database=new Promise((resolve,reject)=>{
      const request=indexedDB.open('economy-model-v3-data',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('saves'))request.result.createObjectStore('saves');};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Хранилище занято другой вкладкой'));
    }).catch(()=>null);
    return database;
  };
  const storage={
    async get(key){
      const db=await open();
      if(db)try{
        const value=await new Promise((resolve,reject)=>{const request=db.transaction('saves','readonly').objectStore('saves').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
        if(value!==undefined&&value!==null)return value;
      }catch{/* An existing local copy can still be recovered. */}
      return readLocal(key);
    },
    async set(key,value,requireIndexedDB=false){
      // Synchronous fallback also supports simple, non-browser UI tests.
      if(!indexedDB){if(requireIndexedDB)throw Error('IndexedDB недоступна');return writeLocal(key,value);}
      const db=await open();
      if(db)try{
        await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
        return 'IndexedDB';
      }catch{/* Use fallback only if the browser can actually store the value. */}
      if(requireIndexedDB)throw Error('Не удалось записать журнал в IndexedDB');
      return writeLocal(key,value);
    }
  };
  storage.listKeys = async prefix => {
    const db = await open();
    const keys = new Set();
    if (db) {
      const results = await new Promise((resolve,reject) => {
        const range = globalThis.IDBKeyRange?.bound(prefix, prefix + '\uffff');
        const request = db.transaction('saves','readonly').objectStore('saves').getAllKeys(range);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      for (const key of results) if (typeof key === 'string' && key.startsWith(prefix)) keys.add(key);
    }
    try {
      for (let i = 0; i < (localStorage?.length ?? 0); i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) keys.add(key);
      }
    } catch { if (!db) throw Error('Хранилище браузера недоступно'); }
    return [...keys];
  };
  storage.remove = async key => {
    if (readLocal(key) !== null) localStorage.removeItem(key);
    const db = await open();
    if (!db) return;
    await new Promise((resolve,reject) => {
      const tx = db.transaction('saves','readwrite');
      tx.objectStore('saves').delete(key);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  };
  const journal=createJournalStorage({read:key=>storage.get(key),put:(key,value,strict)=>storage.set(key,value,strict),available:async()=>Boolean(await open()),remove:async key=>{
    const db=await open();if(!db)return;await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  }});
  return {...storage,getSnapshot:journal.getSnapshot,setSnapshot:journal.setSnapshot,adoptJournal:journal.adoptJournal};
}

// First-run choices outlive campaigns. Keep the local copy for older clients
// and for browsers that block IndexedDB.
const preferenceStorage=createBrowserStorage();
export const readDevicePreference=key=>preferenceStorage.get(key);
export async function writeDevicePreference(key,value){
  try{globalThis.localStorage?.setItem(key,value);}catch{}
  try{await preferenceStorage.set(key,value);}catch{}
}

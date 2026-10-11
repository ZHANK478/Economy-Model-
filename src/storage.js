// Long journals exceed localStorage quotas. IndexedDB stays on this device;
// no accounts, server uploads, or deletion of previous saves are involved.
export function createBrowserStorage({localStorage=globalThis.localStorage,indexedDB=globalThis.indexedDB}={}) {
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
  return {
    async get(key){
      const db=await open();
      if(db)try{
        const value=await new Promise((resolve,reject)=>{const request=db.transaction('saves','readonly').objectStore('saves').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
        if(value!==undefined&&value!==null)return value;
      }catch{/* An existing local copy can still be recovered. */}
      return localStorage.getItem(key);
    },
    async set(key,value){
      // Synchronous fallback also supports simple, non-browser UI tests.
      if(!indexedDB){localStorage.setItem(key,value);return 'localStorage';}
      const db=await open();
      if(db)try{
        await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
        return 'IndexedDB';
      }catch{/* Use fallback only if the browser can actually store the value. */}
      localStorage.setItem(key,value);return 'localStorage';
    }
  };
}

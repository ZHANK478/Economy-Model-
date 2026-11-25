// Append immutable month records independently; publish the new head only when
// every referenced record is durable. A partial staging write keeps the old head.
const FORMAT='economy-journal-parts-1';
const recordKey=(key,generation,index)=>`${key}:journal:${generation}:${index}`;
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
export function createJournalStorage({read,put,remove,available,pause=yieldTask}){
 const baselines=new Map();
 const isHead=value=>value?.format===FORMAT;
 async function getSnapshot(key){
  const value=await read(key);if(value===null||value===undefined)return null;
  if(!isHead(value))return typeof value==='string'?JSON.parse(value):value;
  if(!Number.isInteger(value.length)||value.length<0||value.length>100000||typeof value.generation!=='string')throw Error('Повреждён указатель журнала');
  const wrapper=JSON.parse(value.liveText),entries=[];
  for(let i=0;i<value.length;i++){
   const text=await read(recordKey(key,value.generation,i));if(typeof text!=='string')throw Error('Не найдена запись журнала '+i);
   entries.push(JSON.parse(text));if(i%8===7)await pause();
  }
  wrapper.simulation.state.journal=entries;baselines.set(key,{generation:value.generation,entries});return wrapper;
 }
 function adoptJournal(key,entries){
  const prior=baselines.get(key);if(prior&&prior.entries.length===entries.length&&prior.entries.every((row,i)=>row.month===entries[i]?.month))prior.entries=entries.slice();
 }
 async function setSnapshot(key,{liveText,journal}){
  if(!await available()){
   const wrapper=JSON.parse(liveText);wrapper.simulation.state.journal=journal;await put(key,JSON.stringify(wrapper));return;
  }
  const prior=baselines.get(key),append=prior&&journal.length>=prior.entries.length&&prior.entries.every((row,i)=>row===journal[i]);
  const generation=append?prior.generation:(globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`),start=append?prior.entries.length:0;
  const staged=[];
  try{
   for(let i=start;i<journal.length;i++){
    await pause();const entry=recordKey(key,generation,i);await put(entry,JSON.stringify(journal[i]),true);staged.push(entry);
   }
   await put(key,{format:FORMAT,liveText,generation,length:journal.length},true);
  }catch(error){for(const entry of staged)try{await remove(entry);}catch{}throw error;}
  baselines.set(key,{generation,entries:journal.slice()});
  if(prior&&!append)for(let i=0;i<prior.entries.length;i++)try{await remove(recordKey(key,prior.generation,i));}catch{/* Old unreachable records can be reclaimed later. */}
 }
 return {getSnapshot,setSnapshot,adoptJournal,isHead};
}

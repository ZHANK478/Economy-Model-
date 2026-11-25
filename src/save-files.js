// Lossless file compression; the parsed envelope uses the existing validator.
export const MAX_SAVE_BYTES=256*1024*1024;
export const canCompress=()=>typeof globalThis.CompressionStream==='function';
export function autosaveText(state,draft,newspaper,version){
 return JSON.stringify({simulation:{format:'economy-model',version,state},draft,newspaper});
}
// Journal entries are immutable after a completed month. Capture live state
// now; retain only a shallow journal snapshot for incremental background IO.
export function autosaveSnapshot(state,draft,newspaper,version,leader,campaignId){
 return {liveText:JSON.stringify({simulation:{format:'economy-model',version,state:{...state,journal:[]}},draft,newspaper,...(leader?{leader}:{}),campaignId}),journal:state.journal.slice(),month:state.month};
}
export function autosaveEnvelope(wrapper){
 return typeof wrapper.simulation==='string'?JSON.parse(wrapper.simulation):wrapper.simulation;
}
export async function saveFile(payload,{compressed=false}={}){
 const text=JSON.stringify(payload); // One serialization; no whitespace copies.
 if(!compressed)return {blob:new Blob([text],{type:'application/json'}),extension:'.json'};
 if(!canCompress())throw new Error('Браузер не поддерживает сжатие. Скачайте JSON.');
 const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
 return {blob:await new Response(stream).blob(),extension:'.json.gz'};
}
export async function readSaveFile(file,{maxBytes=MAX_SAVE_BYTES}={}){
 const limit=maxBytes>=1024*1024?`${maxBytes/(1024*1024)} МБ`:`${maxBytes} байт`;
 if(file.size>maxBytes)throw new Error(`Файл больше ${limit}`);
 const header=new Uint8Array(await file.slice(0,2).arrayBuffer());
 const gzip=header[0]===0x1f&&header[1]===0x8b;
 if(!gzip)return JSON.parse(await file.text());
 if(typeof globalThis.DecompressionStream!=='function')throw new Error('Браузер не поддерживает сжатый файл. Откройте обычный JSON.');
 const reader=file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const chunks=[];let total=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw new Error(`После распаковки файл больше ${limit}`);chunks.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
 return JSON.parse(await new Blob(chunks).text());
}

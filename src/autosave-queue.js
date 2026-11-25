// Coalesce rapid changes and serialize writes. Capture runs after the UI has
// had a chance to paint; only durable completion is reported as saved.
export function createAutosaveQueue({capture,write,schedule=fn=>setTimeout(fn,40),onStatus=()=>{},onError=()=>{}}){
 let revision=0,savedRevision=0,pending=false,scheduled=false,inFlight=null;
 const arrange=()=>{if(scheduled||inFlight)return;scheduled=true;schedule(()=>{scheduled=false;void flush();});};
 async function flush(){
  while(pending||inFlight){
   if(inFlight){await inFlight;continue;}
   pending=false;const target=revision;onStatus('saving');
   inFlight=Promise.resolve().then(capture).then(async snapshot=>{await write(snapshot);savedRevision=target;onStatus(revision===target?'saved':'pending',snapshot);}).catch(error=>{onStatus('error');onError(error);}).finally(()=>{inFlight=null;});
   await inFlight;
  }
 }

 return {request(){revision++;pending=true;onStatus('pending');arrange();},flush,hasWork:()=>pending||inFlight!==null,isPending:()=>revision>savedRevision};
}

// Local interface observations, deliberately separate from simulation state.
export function createUIObservation({clock=()=>Date.now(),storage=null,key='economy-ui-observation-v1',maxEvents=20000}={}){
 let data;try{data=JSON.parse(storage?.getItem(key)??'null');}catch{}
 if(data?.format!=='economy-ui-observation'||!Array.isArray(data.events)||!data.targets||typeof data.targets!=='object')data={format:'economy-ui-observation',version:1,startedAt:new Date(clock()).toISOString(),events:[],targets:{},droppedEvents:0};
 const active=new Map();let context={},visible=true;
 const stamp=()=>({at:new Date(clock()).toISOString(),...context});
 function event(type,target,extra={}){if(type==='observed'&&data.targets[target])data.targets[target].observations=(data.targets[target].observations??0)+1;data.events.push({...stamp(),type,target,...extra});if(data.events.length>maxEvents){data.events.splice(0,data.events.length-maxEvents);data.droppedEvents++;}}
 function register(id,label,kind='section'){data.targets[id]??={label,kind,opens:0,visibleMs:0,lastOpenedAt:null};}
 function close(id){const start=active.get(id);if(start===undefined)return;const ms=Math.max(0,clock()-start);data.targets[id].visibleMs+=ms;active.delete(id);event('close',id,{durationMs:ms});}
 function open(id,label,kind='section',source='user'){register(id,label,kind);if(!visible||active.has(id))return;const resumed=source==='return'&&data.targets[id].opens>0;if(!resumed){data.targets[id].opens++;data.targets[id].lastOpenedAt=new Date(clock()).toISOString();}if(visible)active.set(id,clock());event(resumed?'resume':'open',id,{source});}
 function flush(){try{storage?.setItem(key,JSON.stringify(data));return true;}catch{return false;}}
 function report(){const now=clock(),targets=Object.entries(data.targets).map(([id,x])=>({...x,id,visibleMs:x.visibleMs+(active.has(id)?Math.max(0,now-active.get(id)):0)}));return {...JSON.parse(JSON.stringify(data)),exportedAt:new Date(now).toISOString(),context:{...context},summary:{targets,neverOpened:targets.filter(x=>x.kind!=='block'&&x.opens===0).map(x=>({id:x.id,label:x.label,kind:x.kind})),neverObserved:targets.filter(x=>x.kind==='block'&&!x.observations).map(x=>({id:x.id,label:x.label}))},limitations:['Открытие окна не доказывает прочтение. Время — длительность отображения при активной вкладке, не измерение внимания.','Секция observed появляется при попадании в видимую область; это не доказательство взгляда.','Никогда не открыто относится только к этому устройству и периоду наблюдения.','Журнал локальный, не отправляется на сервер. Старые действия до начала наблюдения не восстановлены.']};}
 return {register,open,close,event,flush,report,
  context(value){context={...value};},
  visibility(value){if(visible===value)return;for(const id of [...active.keys()])close(id);visible=value;event(value?'tab_visible':'tab_hidden',null);},
  closeAll(){for(const id of [...active.keys()])close(id);},
  session(){event('session_start',null);},
 };
}

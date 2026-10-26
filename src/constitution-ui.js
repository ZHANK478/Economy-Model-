import {constitutionFrom} from './political-config.js';
export const CHARTER_SECTIONS={
 form:{label:'Устройство власти',icon:'building',keys:['form']},
 elections:{label:'Выборы парламента',icon:'ballot',keys:['electoralSystem','seats','threshold','naturalizationYears','localResidentVote']},
 terms:{label:'Сроки власти',icon:'clock',keys:['parliamentTerm','presidentTerm','termLimit']},
 powers:{label:'Полномочия',icon:'shield',keys:['presidentialVeto','independentCB','dissolution','constitutionalReferendum','confidence']},
 emergency:{label:'Особые полномочия',icon:'shield',keys:[]}
};
const bounds={seats:[30,360,30],threshold:[0,15,1],naturalizationYears:[0,20,1],parliamentTerm:[12,84,12],presidentTerm:[12,84,12],termLimit:[0,4,1]};
export function resetConstitutionUI(ui){ui.section=null;ui.patch={};}
export function stageConstitution(state,ui,key,value){
 const section=CHARTER_SECTIONS[ui.section];if(!section?.keys.includes(key))return;
 const c=state.politics.constitution;
 if(bounds[key]){const [min,max]=bounds[key];value=Math.max(min,Math.min(max,Number(value)));}
 constitutionFrom({...c,[key]:value});
 if(value===c[key])delete ui.patch[key];else ui.patch[key]=value;
}
export function stepConstitution(state,ui,key,direction){
 if(!bounds[key])return;const value=ui.patch[key]??state.politics.constitution[key];
 stageConstitution(state,ui,key,value+Math.sign(direction)*bounds[key][2]);
}
export function constitutionPatch(state,ui){
 const keys=CHARTER_SECTIONS[ui.section]?.keys??[];
 const patch=Object.fromEntries(Object.entries(ui.patch).filter(([key,value])=>keys.includes(key)&&value!==state.politics.constitution[key]));
 constitutionFrom({...state.politics.constitution,...patch});return patch;
}
const icons={building:'<path d="m5 12 19-9 19 9H5Zm4 3v20m9-20v20m12-20v20m9-20v20M5 37h38M3 42h42"/>',ballot:'<path d="M8 24H4v19h40V24h-8M10 28h28M14 5l24 8-6 18-24-8 6-18Z"/><path d="m17 16 4 5 10-7"/>',clock:'<circle cx="24" cy="25" r="18"/><path d="M24 13v13l9 6M18 3h12"/>',shield:'<path d="m24 4 17 6v13c0 11-17 20-17 20S7 34 7 23V10l17-6Z"/><path d="m15 23 6 6 13-14"/>'};
const icon=id=>`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id]}</svg>`;
const shortForms={presidential:'Президентская',parliamentary:'Парламентская',semiPresidential:'Смешанная'};
const shortElections={pr:'По партийным спискам',plurality:'По округам',twoRound:'Округа · два тура',parallel:'Списки и округа',mmp:'Смешанная система'};
const duration=(months,n)=>months%12===0?n(months/12,0)+' г.':n(months,0)+' мес.';
export function constitutionBoard(state,ui,{esc,n,date,canVote=true}){
 const p=state.politics;if(!p.enabled)return '<section class="panel"><button data-action="new">Новая игра</button></section>';const c=p.constitution;
 const section=CHARTER_SECTIONS[ui.section],draft={...c,...ui.patch},locked=!p.executive.inOffice;
 const required=Math.ceil(p.totalSeats*c.constitutionalFraction-1e-9);
 const read={form:shortForms[c.form],elections:shortElections[c.electoralSystem],terms:duration(c.form==='parliamentary'?c.parliamentTerm:c.presidentTerm,n),powers:c.form==='parliamentary'?'Кабинет и парламент':c.presidentialVeto?'Право вето':'Без права вето'};
 const heading=`<header class="charter-heading"><div><span class="charter-kicker">Основной закон</span><h2>Конституция</h2></div><span class="charter-majority" title="Голоса для конституционной поправки">${required} голосов</span></header>`;
 if(!section)return `<section class="charter-board">${heading}<div class="charter-grid">${Object.entries(CHARTER_SECTIONS).filter(([id])=>id!=='emergency').map(([id,item],i)=>`<button class="charter-card" data-charter-section="${id}"><span class="charter-card-top"><span>Статья ${String(i+1).padStart(2,'0')}</span><b aria-hidden="true">↗</b></span>${icon(item.icon)}<strong>${item.label}</strong><span class="charter-current">${esc(read[id])}</span></button>`).join('')}</div><button class="charter-emergency" data-charter-section="emergency"><span>${p.emergency?'Чрезвычайное положение':'Особые полномочия'}</span><span aria-hidden="true">→</span></button></section>`;
 const choice=(key,label,choices)=>`<div class="charter-rule"><h3>${label}</h3><div class="charter-choices">${Object.entries(choices).map(([value,text])=>`<button data-charter-key="${key}" data-charter-value="${value}" class="${String(draft[key])===value?'selected':''}" aria-pressed="${String(draft[key])===value}" ${locked?'disabled':''}>${esc(text)}${String(c[key])===value?'<small>Действует</small>':''}</button>`).join('')}</div></div>`;
 const toggle=(key,label)=>choice(key,label,{true:'Да',false:'Нет'}).replace('class="charter-choices"','class="charter-choices charter-binary"');
 const counter=(key,label,unit,display)=>{const value=draft[key],[min,max]=bounds[key];return `<div class="charter-counter"><div><strong>${label}</strong>${value!==c[key]?`<small>Было: ${display?display(c[key]):n(c[key],0)+' '+unit}</small>`:''}</div><div class="charter-stepper"><button data-charter-step="${key}" data-direction="-1" aria-label="${label}: уменьшить" ${locked||value<=min?'disabled':''}>−</button><output aria-label="${label}">${display?display(value):n(value,0)}${display?'':`<small>${unit}</small>`}</output><button data-charter-step="${key}" data-direction="1" aria-label="${label}: увеличить" ${locked||value>=max?'disabled':''}>+</button></div></div>`;};
 let controls='';
 if(ui.section==='form')controls=choice('form','Форма правления',shortForms);
 if(ui.section==='elections')controls=choice('electoralSystem','Система выборов',shortElections)+counter('seats','Мест в парламенте','мест')+(['pr','parallel','mmp'].includes(draft.electoralSystem)?counter('threshold','Проходной порог','%'):'')+`<details class="charter-secondary"><summary>Избирательные права</summary>${counter('naturalizationYears','Проживание до гражданства','лет')}${toggle('localResidentVote','Местные выборы для постоянных жителей')}</details>`;
 if(ui.section==='terms')controls=(c.form!=='parliamentary'?counter('presidentTerm','Срок президента','мес.',v=>duration(v,n)):'')+counter('parliamentTerm','Срок парламента','мес.',v=>duration(v,n))+(c.form!=='parliamentary'?counter('termLimit','Предел президентских сроков','',v=>v===0?'Без предела':n(v,0)):'');
 if(ui.section==='powers')controls=(c.form!=='parliamentary'?toggle('presidentialVeto','Президентское вето'):'')+toggle('independentCB','Независимость центрального банка')+toggle('dissolution','Роспуск парламента')+toggle('constitutionalReferendum','Референдум для поправок')+(c.form!=='presidential'?choice('confidence','Вотум недоверия',{constructive:'С новым кабинетом',ordinary:'Обычный вотум'}):'');
 if(ui.section==='emergency')controls=`<div class="charter-emergency-state">${p.emergency?'До '+date(p.emergency.expires,true):'Не объявлено'}</div><div class="charter-crisis-actions">${!p.emergency?'<button data-political-action="emergency">Объявить ЧП</button>':`${!p.emergency.ratified?'<button data-political-action="ratifyEmergency">Ратифицировать</button>':''}<button data-political-action="endEmergency">Прекратить ЧП</button>`}<button class="charter-danger" data-political-action="constitutionalConflict">Обойти парламент</button></div>`;
 if(ui.section==='emergency'&&(locked||!canVote))controls=controls.replaceAll('<button ','<button disabled ');
 const changed=Object.keys(constitutionPatch(state,ui)).length;
 return `<section class="charter-board">${heading}<section class="charter-editor"><button class="charter-back" data-charter-back="true">← Все статьи</button><div class="charter-editor-title">${icon(section.icon)}<h3>${section.label}</h3></div>${controls}${ui.section!=='emergency'?`<button class="primary charter-submit" data-action="charter-vote" ${locked||!canVote||!changed?'disabled':''}>На голосование <span aria-hidden="true">→</span></button>`:''}</section></section>`;
}

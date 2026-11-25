import {SOCIAL_FACTION_TYPES} from './social-factions.js';
import {partyColor} from './game-charts.js';
import {partyDisplayName} from './political-config.js';
import {esc} from './atlas-interface.js';
import {characterList,characterRoster,COURT_ORIGINS} from './character-roster.js';

export const CONNECTION_TABS=[
  {id:'cabinet',label:'Кабинет',icon:'people'},
  {id:'factions',label:'Фракции',icon:'shield'},
  {id:'legislative',label:'Законодательная власть',icon:'building'},
  {id:'justice',label:'Судебная власть',icon:'gavel'}
];

const shapes={
  connections:'<circle cx="5" cy="6" r="2.6"/><circle cx="18" cy="5" r="2.6"/><circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="19" r="2.6"/><circle cx="19" cy="19" r="2.6"/>',
  people:'<circle cx="5" cy="5" r="2.4"/><circle cx="12" cy="4" r="2.7"/><circle cx="19" cy="5" r="2.4"/><path d="M2 9h6v6H7v7H4v-7H2zm6.5-1h7v8h-2v6h-3v-6h-2zm7.5 1h6v6h-2v7h-3v-7h-1z"/>',
  shield:'<path d="M12 2 21 5v7c0 5-4 8-9 10-5-2-9-5-9-10V5z"/>',
  building:'<path d="m12 2 10 6H2zm-9 8h18v2H3zm2 3h3v6H5zm5.5 0h3v6h-3zm5.5 0h3v6h-3zM2 20h20v2H2z"/>',
  gavel:'<path d="m8 3 4-3 7 7-3 4-2-2-2 2 8 8-2 2-8-8-2 2-4-4 4-4 2 2 2-2zm-5 16h11v3H3z"/>'
};
export const connectionsIcon=id=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${shapes[id]}</svg>`;

// Small parliamentary groups are combined for presentation, separately on each side.
export function parliamentaryGroups(state){
  const p=state.politics;
  const represented=p.parties.filter(party=>party.seats>0);
  const largest=represented.slice().sort((a,b)=>b.seats-a.seats)[0];
  const groups=[],minor=new Map();
  for(const party of represented){
    const government=p.coalition.includes(party.id);
    if(!party.independent&&(party.seats>=p.totalSeats*.05||party.id===p.executive.playerParty||party===largest)){
      groups.push({...party,name:partyDisplayName(party),color:partyColor(party),government,members:[party]});
    }else{
      let group=minor.get(government);
      if(!group){group={id:'independent-'+government,name:'Независимые',color:'#aaa58e',seats:0,government,independent:true,members:[]};minor.set(government,group);groups.push(group);}
      group.seats+=party.seats;group.members.push(party);
    }
  }
  return groups.sort((a,b)=>Number(b.government)-Number(a.government)||b.seats-a.seats);
}
const iconDot=party=>`<i class="connections-dot" style="background:${party.color}" aria-hidden="true"></i>`;
const seatLabel=count=>count%100>=11&&count%100<=14?'мест':count%10===1?'место':count%10>=2&&count%10<=4?'места':'мест';

function legislativePanel(state,roster){
  const p=state.politics,groups=parliamentaryGroups(state);
  const forming=p.parliamentary?.phase==='forming';
  const government=groups.filter(p=>p.government),opposition=groups.filter(p=>!p.government);
  const total=groups.reduce((sum,p)=>sum+p.seats,0),support=government.reduce((sum,p)=>sum+p.seats,0);
  const columns=18,rows=Math.ceil(Math.max(support,total-support)/columns),height=rows*8+54;
  const benches=(parties,offset)=>{
    let position=0;
    return parties.map(party=>Array.from({length:party.seats},()=>{
      const index=position++,x=offset+(index%columns)*8,y=32+Math.floor(index/columns)*8;
      return `<rect data-parliament-seat="true" x="${x}" y="${y}" width="5" height="5" rx="1" fill="${party.color}"><title>${esc(party.name)}</title></rect>`;
    }).join('')).join('');
  };
  const list=parties=>`<ul class="connections-party-list">${parties.map(p=>`<li>${iconDot(p)}<span>${esc(p.name)}${p.id===state.politics.executive.playerParty?' · ваша партия':''}</span><strong>${p.seats}</strong></li>`).join('')||'<li>Нет депутатов</li>'}</ul>`;
  return `<h3>Палата общин</h3><p class="connections-court-subtitle">Текущий состав · ${total} ${seatLabel(total)}</p>
    <figure class="connections-seats"><svg viewBox="0 0 360 ${height}" role="img" aria-label="Палата общин: ${total} мест, большинство ${Math.floor(p.totalSeats/2)+1}">
      <text x="88" y="16" text-anchor="middle" fill="currentColor" font-size="11">${forming?'Сторона игрока':'Правительство'}</text><text x="270" y="16" text-anchor="middle" fill="currentColor" font-size="11">Оппозиция</text>
      ${benches(government,16)}${benches(opposition,202)}</svg><figcaption>${total}</figcaption></figure>
    <p class="connections-court-subtitle">Большинство — ${Math.floor(p.totalSeats/2)+1} · ${forming?'Переговоры о кабинете':'Опора кабинета'} — ${support}</p>
    <div class="connections-group">${forming?'Сторона игрока':'Правительство / коалиция'}</div>${list(government)}
    <div class="connections-group">Оппозиция</div>${list(opposition)}
    ${groups.some(p=>p.independent)?'<p class="connections-court-subtitle">Независимые объединяют малые фракции с долей менее 5% мест.</p>':''}
    ${featured(roster.sections['party-leaders'],{affiliation:true})}`;
}

function factionsPanel(roster){
  const factions=roster.factions??[];
  return `<div class="connections-factions">${factions.map(faction=>`<article class="connections-faction">
    <h3 style="--faction-color:${faction.color}">${iconDot(faction)}${esc(faction.name)}</h3>
    <p class="connections-faction-type">${esc(SOCIAL_FACTION_TYPES[faction.type])}</p>
    <p>${esc(faction.summary)}</p><p>${esc(faction.influence)}</p>
    ${characterList([faction.representative])}
  </article>`).join('')}</div>`;
}

function featured(people,options){
  return people.length?`<h3 class="connections-featured">Видные деятели</h3>${characterList(people,options)}`:'';
}

function justicePanel(roster){
  const judges=roster.activeJudges??[];
  return `<h3>Палата лордов</h3>
    <p class="connections-court-subtitle">Апелляционный комитет · судебные лорды</p>
    <div class="connections-judges" aria-hidden="true">${judges.map(judge=>`<i style="background:${judge.color}"></i>`).join('')}</div>
    <ul class="connections-party-list" aria-label="Судебные юрисдикции">${COURT_ORIGINS.map(origin=>`<li>${iconDot(origin)}<span>${origin.label}</span><strong>${judges.filter(judge=>judge.originId===origin.id).length}</strong></li>`).join('')}</ul>
    ${featured(judges,{affiliation:true,showRole:false})}`;
}

export function connectionsPanel(active,state,roster=characterRoster(state)){
  const tabs=CONNECTION_TABS.map(({id,label,icon})=>`
    <button data-connections-tab="${id}" aria-pressed="${active===id}" aria-label="${label}" title="${label}">
      ${connectionsIcon(icon)}<span>${label}</span>
    </button>`).join('');
  const views={
    cabinet:()=>`${roster.proposedCabinet?'<p class="connections-court-subtitle">Идут переговоры о формировании правительства</p>':roster.caretaker?'<p class="connections-court-subtitle">Кабинет исполняет обязанности до назначения нового состава</p>':''}${characterList(roster.cabinet)}`,
    factions:()=>factionsPanel(roster),legislative:()=>legislativePanel(state,roster),justice:()=>justicePanel(roster),
  };
  return `<section class="connections-panel" aria-labelledby="connections-title">
    <header><h2 id="connections-title">Связи</h2>
      <button data-close-button data-strategy-close="true" aria-label="Закрыть связи">×</button>
    </header>
    <nav aria-label="Категории связей">${tabs}</nav>
    <div class="connections-content" aria-label="${CONNECTION_TABS.find(tab=>tab.id===active).label}">${views[active]()}</div>
  </section>`;
}

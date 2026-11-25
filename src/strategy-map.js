import {CODEX_COUNTRIES,CODEX_REGIONS} from './codex-locations.js';
import {countryFlagPath,EUROPEAN_UNION_ATLAS} from './foreign-country-dossier.js';
import {BRITISH_CITIES} from './city-dossier.js';
import {flag, atlasIcon, esc} from './atlas-interface.js';

const zoomControls = `<div class="atlas-zoom"><button data-atlas-zoom="out" aria-label="Отдалить карту">−</button><button data-atlas-zoom="reset" aria-label="Центрировать карту">⌖</button><button data-atlas-zoom="in" aria-label="Приблизить карту">+</button></div>`;

export function deskAtlas(s,world,dispatch,decorative=false,requests=[]){
 const title=world?'Мировая карта':'Карта Великобритании';
 const homePin=world&&!decorative&&s.scenario?.id==='uk-2000'?`<button class="atlas-paper-pin atlas-home-pin" hidden data-atlas-home="true" aria-label="Вернуться к Великобритании">
   ${flag(s)}<span class="atlas-pin-label" aria-hidden="true">Великобритания</span>
 </button>`:'';
 const eventPin=!world&&dispatch?`<button class="atlas-paper-pin atlas-event-pin" hidden ${dispatch.kind==='government'?'data-view="government" data-open-view="true"':'data-action="proposal-open"'} aria-label="${esc(dispatch.label)}">
   ${dispatch.kind==='government'?'<b aria-hidden="true">!</b>':atlasIcon('decisions')}<span class="atlas-pin-label" aria-hidden="true">${esc(dispatch.label)}</span>
 </button>`:'';
 const cityPins=!world&&!decorative?BRITISH_CITIES.map(city=>`<button type="button" class="atlas-city-pin" hidden data-atlas-city="${esc(city.id)}" aria-label="${esc(city.name)}" title="${esc(city.name)}"></button>`).join(''):'';
 const requestPins=!world&&!decorative?Object.values(Object.groupBy(requests,event=>{
   const {territoryId,city}=event.appeal;
   return (city?'city:':'region:')+territoryId;
 })).map(events=>{
   const {territoryId,city}=events[0].appeal;
   const area=(city?BRITISH_CITIES:CODEX_REGIONS).find(row=>row.id===territoryId);
   if(!area)return '';
   const label=area.name+' · обращения ('+events.length+')';
   return `<button type="button" class="atlas-paper-pin atlas-event-pin" hidden data-atlas-request="${esc(events[0].id)}"
     data-request-place="${esc(city?area.name:area.name.replace(/Мидленд$/,'Мидлендс'))}" data-request-kind="${city?'city':'region'}" aria-label="${esc(label)}">
     <b aria-hidden="true">!</b><span class="atlas-pin-label" aria-hidden="true">${esc(label)}</span></button>`;
 }).join(''):'';
 const foreignPlaces=world&&!decorative?CODEX_COUNTRIES.filter(country=>country.id!==s?.scenario?.countryId):[];
 if(world&&!decorative&&s?.scenario?.id==='uk-2000')foreignPlaces.push(EUROPEAN_UNION_ATLAS);
 const foreignPins=foreignPlaces.map(country=>
   `<button type="button" class="atlas-paper-pin atlas-foreign-pin" hidden data-atlas-foreign="${esc(country.id)}" aria-label="${esc(country.name)}" title="${esc(country.name)}"><img src="${countryFlagPath(country.id)}" alt=""></button>`).join('');
 const mode=world?'world':'national';
 return `<div class="atlas-viewport desk-atlas desk-atlas-${mode}" data-desk-atlas="${mode}" role="region" tabindex="0" aria-label="${title}">
   <div class="atlas-desk-objects" aria-hidden="true"><div class="atlas-desk-binder"></div><div class="atlas-desk-papers"></div></div>
   <svg class="atlas-geography" aria-hidden="true"></svg>
   <svg class="atlas-vectors" role="img" aria-label="${title}">
     <g class="atlas-map-symbols" aria-hidden="true"></g>
     <g class="atlas-map-lettering" aria-hidden="true" text-anchor="middle" dominant-baseline="central"></g>
   </svg>
   ${homePin}${foreignPins}${cityPins}${eventPin}${requestPins}
   <span class="atlas-map-status" role="status">Загрузка карты…</span>
 </div>`;
}

export function strategyMap(s,{zoom=1,panX=0,panY=0,world=false,dispatch=null,requests=[]}={}){
 const camera=`translate(${panX}px,${panY}px) scale(${zoom})`;
 if(world||s.scenario?.geography?.assetId==='uk-constituent-countries-v1')return deskAtlas(s,world,dispatch,false,requests);
 return `<div class="atlas-viewport" aria-label="Игровая карта"><svg class="strategy-atlas" viewBox="-180 -30 900 930" style="transform:${camera}" aria-label="Карта условной страны"><defs><pattern id="atlas-ocean" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M0 50H50V0" fill="none" stroke="#a2b6ba" stroke-width=".35" opacity=".25"/></pattern><pattern id="atlas-paper" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="4" r=".45" fill="#8d8d6b" opacity=".3"/></pattern><filter id="atlas-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#102e3a" flood-opacity=".35"/></filter></defs><rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#atlas-ocean)"/><g class="atlas-shores"><path class="atlas-land" d="M122 105L195 80 234 130 302 112 345 159 319 207 364 250 342 298 392 350 357 390 378 442 341 498 316 552 260 582 221 548 166 572 142 527 95 502 111 445 77 391 97 330 71 282 116 242 90 190Z"/></g><g class="atlas-text" pointer-events="none"><text x="230" y="340" text-anchor="middle" class="atlas-region-label">РЕСПУБЛИКА</text><text class="atlas-sea-label" x="-75" y="280" transform="rotate(-70 -75 280)">ЗАПАДНОЕ МОРЕ</text><text class="atlas-sea-label" x="490" y="470" transform="rotate(-80 490 470)">ВОСТОЧНОЕ МОРЕ</text></g></svg><div class="atlas-compass" aria-hidden="true"><span>С</span><svg viewBox="0 0 50 65"><path d="M25 3L35 48 25 40 15 48Z" fill="#d7c28e"/><path d="M25 3V40L15 48Z" fill="#41545b"/></svg></div>${zoomControls}<small class="atlas-attribution">Условная карта · без региональной симуляции</small></div>`;
}
export function strategyCountryPlaque(s,selected){
 const name=s.scenario?.name??'Республика',territory=s.scenario?.geography.territories.find(x=>x.id===selected);
 return `<div class="atlas-country-plaque"><span>${s.scenario?'СОЕДИНЁННОЕ КОРОЛЕВСТВО':'АБСТРАКТНАЯ СТРАНА'}</span><h1>${esc(name)}</h1><p>${territory&&territory.parent!==null?esc(territory.name):s.resourceMode?'Сырьевая экономика':'Диверсифицированная экономика'}</p>${territory?.parent?'<button data-territory="GBR">← Вся страна</button>':''}</div>`;
}

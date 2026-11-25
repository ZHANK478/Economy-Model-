import {electionResults} from './election-ui.js';
import {partyDisplayName} from './political-config.js';

export function cabinetMapNotice(state){
 const p=state.politics,leader=p.parties.find(party=>party.id===p.executive.primeMinisterParty);
 return {text:'Кабинет возглавила '+partyDisplayName(leader),attributes:'data-view="government"'};
}

export function electionMapNotice(state,n){
 const p=state.politics,e=p.elections.at(-1);
 if(e.kind==='president'){
  const winner=electionResults(e).find(row=>row.id===e.winner);
  return {text:'Избран президент · '+(e.winnerCandidate??winner?.candidateName??'')+
   (winner?' · '+n(winner.share,1)+'%':''),attributes:`data-action="election-open" data-election-id="${e.id}"`};
 }
 const own=e.results.find(row=>row.id===p.executive.playerParty);
 return {text:'Парламентские выборы · у вашей партии '+(own?.seats??0)+' из '+e.totalSeats+' мест',
  attributes:`data-action="election-open" data-election-id="${e.id}"`};
}

export function renderMapNotice(notice,esc){
 if(!notice)return '';
 return `<aside class="map-notice" aria-label="Новое событие">
  <button class="map-notice-link" data-open-map-notice ${notice.attributes}>${esc(notice.text)}</button>
  <button class="map-notice-close" data-action="map-notice-close" aria-label="Скрыть уведомление">×</button>
 </aside>`;
}

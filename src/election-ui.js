import {partyDisplayName} from './political-config.js';
// Acknowledgements are UI state only. Election records remain in the export.
export function pendingElectionNotice(state){
 const p=state.politics;if(!p.enabled)return null;
 const seen=new Set(p.electionNoticesSeen??[]);
 return p.elections.filter(e=>!e.initial&&!seen.has(e.id)).sort((a,b)=>a.month-b.month||a.id-b.id)[0]??null;
}
export function acknowledgeElection(state,id){
 const p=state.politics;if(!p.elections.some(e=>!e.initial&&e.id===id))return;
 p.electionNoticesSeen=[...new Set([...(p.electionNoticesSeen??[]),id])];
}
export function electionResults(e){
 const results=e.kind==='president'?(e.rounds.at(-1)?.results??e.results):e.results;
 const total=results.reduce((a,r)=>a+r.votes,0);
 return results.map(r=>({...e.results.find(x=>x.id===r.id),...r,share:total?r.votes/total*100:0})).sort((a,b)=>b.votes-a.votes);
}
export function electionHeadline(state,e){
 if(e.kind==='parliament')return 'Парламент избран';
 if(state.politics.executive.role!=='president')return 'Избран президент';
 if(e.winner!==state.politics.executive.playerParty)return 'Победил другой кандидат';
 const previous=state.politics.elections.filter(x=>x.kind==='president'&&!x.initial&&x.month<e.month).at(-1);
 const name=e.winnerCandidate??e.results.find(r=>r.id===e.winner)?.candidateName;
 const old=previous?.winnerCandidate??previous?.results.find(r=>r.id===previous.winner)?.candidateName;
 return old&&old!==name?'Ваш кандидат избран':'Вы переизбраны';
}
export function electionDialog(state,e,{n,esc,date}){
 const party=id=>state.politics.parties.find(x=>x.id===id);
 return `<dialog id="election-dialog" class="election-popup" aria-labelledby="election-heading"><div class="election-kicker">${e.kind==='president'?'Президентские':'Парламентские'} выборы · ${date(e.month,true)}</div><h2 id="election-heading">${esc(electionHeadline(state,e))}</h2><div class="election-candidates">${electionResults(e).map(r=>`<article class="election-candidate ${r.id===e.winner?'is-winner':''}" style="--party-color:${party(r.id)?.color??'#5079a5'}"><span class="candidate-party">${esc(partyDisplayName(party(r.id)))}</span>${e.kind==='president'?`<strong class="candidate-name">${esc(r.candidateName)}</strong>`:''}<b class="candidate-result">${e.kind==='president'?n(r.share,2)+'%':r.seats+'<small> / '+e.totalSeats+'</small>'}</b><span class="candidate-votes">${n(r.votes,0)} голосов</span></article>`).join('')}</div><div class="election-turnout">Явка ${n(e.turnout,1)}%</div><button class="primary wide" data-action="election-ack" data-election-id="${e.id}">Продолжить</button></dialog>`;
}
export function electionHome(state,{n,esc,date}){
 const p=state.politics;if(!p.enabled)return '';
 const calendar=[...(p.nextPresidentElection===null?[]:[{label:'Президент',month:p.nextPresidentElection}]),{label:'Парламент',month:Math.min(p.nextParliamentElection,p.scheduledParliament??Infinity)}].sort((a,b)=>a.month-b.month);
 const latest=p.elections.filter(e=>!e.initial).at(-1),own=latest?.results.find(r=>r.id===p.executive.playerParty);
 return `<section class="election-home" aria-label="Выборы"><div class="election-calendar">${calendar.map(c=>`<span><b>${c.label}</b><time>${date(c.month,true)}</time><small>${Math.max(0,c.month-state.month)} мес.</small></span>`).join('')}</div>${latest?`<button class="election-last" data-action="election-open" data-election-id="${latest.id}"><span>${latest.kind==='president'?esc(electionHeadline(state,latest)):'Парламент · '+(own?.seats??0)+' / '+latest.totalSeats}</span><b>${latest.kind==='president'?n(electionResults(latest).find(r=>r.id===latest.winner)?.share??0,2)+'%':date(latest.month,true)}</b><span aria-hidden="true">↗</span></button>`:''}</section>`;
}
export function politicalNews(state,{n,date}){
 const p=state.politics;if(!p.enabled)return [];
 const news=p.elections.filter(e=>!e.initial).map(e=>({month:e.month,text:e.kind==='president'?`Президентские выборы: ${e.winnerCandidate??''} · ${n(electionResults(e).find(r=>r.id===e.winner)?.share??0,2)}%`:`Парламентские выборы: ваша партия · ${e.results.find(r=>r.id===p.executive.playerParty)?.seats??0} / ${e.totalSeats} мест`}));
 for(const entry of state.journal??[])for(const text of entry.events??[])if(/импичмент|отстран|сменил кабинет|вотум|Предел сроков|вступил в должность|вышла из коалиции|Журналистское расследование|Правление завершено/.test(text))news.push({month:entry.month,text:text.replace(/\. Итоговый отчёт.*$/,'')});
 for(const [label,month] of [['Президентские',p.nextPresidentElection],['Парламентские',Math.min(p.nextParliamentElection,p.scheduledParliament??Infinity)]])if(month!==null&&month-state.month<=3)news.push({month:state.month,text:`${label} выборы · ${date(month,true)}`});
 return news.sort((a,b)=>b.month-a.month).slice(0,3);
}

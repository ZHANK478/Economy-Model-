import {activeLanguage,seatUnit,translateText} from './localization.js';
import {partyDisplayName} from './political-config.js';

export function campaignReadout(state,{n,esc,date}){
 const {politics,month}=state;
 const calendar=(state.startYear??2026)+Math.floor(month/12)+'-'+String(month%12+1).padStart(2,'0');
 const parties=politics.enabled?(politics.poll?.parties??[]).flatMap(result=>{
  const party=politics.parties.find(row=>row.id===result.id&&row.active);
  if(!party||!Number.isFinite(result.share))return [];
  return [{party,share:result.share}];
 }).sort((a,b)=>b.share-a.share):[];
 const playerId=politics.executive?.playerParty;
 const player=parties.find(row=>row.party.id===playerId);
 const rows=entries=>entries.map(({party,share})=>{
  const name=esc(partyDisplayName(party));
  const color=/^#[0-9a-f]{6}$/i.test(party.color)?party.color:'#bdaa77';
  const yours=party.id===playerId;
  return `<li${yours?' class="player-party"':''}><i style="--party-color:${color}" aria-hidden="true"></i><span title="${name}${yours?' · Ваша партия':''}">${name}</span><b title="Рейтинг в опросах">${n(share,1)}%</b></li>`;
 }).join('');
 return `<section class="campaign-readout" aria-label="Текущий месяц и поддержка партий">
   <time datetime="${calendar}">${esc(date(month))}</time>
   ${parties.length?`<div class="party-readout">
     ${player?`<ul aria-label="Рейтинг вашей партии в опросах">${rows([player])}</ul>`:''}
     ${parties.length>(player?1:0)?`<details><summary aria-label="Опрос партий" title="Опрос партий"><span aria-hidden="true">⌄</span></summary><ul aria-label="Опрос партий">${rows(parties)}</ul></details>`:''}
   </div>`:''}
 </section>`;
}
// Acknowledgements are UI state only. Election records remain in the export.
export function pendingElectionNotice(state,{includeOpening=false,currentOnly=false}={}){
 const p=state.politics;if(!p.enabled)return null;
 const seen=new Set(p.electionNoticesSeen??[]);
 return p.elections.filter(e=>(!e.initial||includeOpening)&&(!currentOnly||e.month===state.month)&&!seen.has(e.id)).sort((a,b)=>a.month-b.month||a.id-b.id)[0]??null;
}
export function acknowledgeElection(state,id,{includeOpening=false}={}){
 const p=state.politics;if(!p.elections.some(e=>(!e.initial||includeOpening)&&e.id===id))return;
 p.electionNoticesSeen=[...new Set([...(p.electionNoticesSeen??[]),id])];
}
export function electionResults(e){
 const results=e.kind==='president'?(e.rounds.at(-1)?.results??e.results):e.results;
 const total=results.reduce((a,r)=>a+r.votes,0);
 return results.map(r=>({...e.results.find(x=>x.id===r.id),...r,share:total?r.votes/total*100:0})).sort((a,b)=>b.votes-a.votes);
}
// Compare actual ballots of the same mandate; a poll is never a prior election.
export function electionComparison(state,e){
 const previous=state.politics.elections.filter(x=>x.kind===e.kind&&x.id!==e.id&&(x.month<e.month||x.month===e.month&&x.id<e.id)).sort((a,b)=>a.month-b.month||a.id-b.id).at(-1)??null;
 const old=previous?electionResults(previous):[];
 return {previous,rows:electionResults(e).map(row=>{const before=old.find(r=>r.id===row.id);return {...row,previous:before??null,shareChange:before?row.share-before.share:null,seatChange:before&&e.kind==='parliament'?row.seats-before.seats:null};})};
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
const guidedOpeningResult=(state,election)=>Boolean(election?.initial&&state.politics.guidedOpening);
export function electionDialog(state,e,{n,esc,date}){
 const opening=guidedOpeningResult(state,e),parliament=e.kind==='parliament',comparison=electionComparison(state,e);
 const previousOpening=guidedOpeningResult(state,comparison.previous);
 const party=id=>state.politics.parties.find(x=>x.id===id);
 const delta=(value,unit,d=2)=>{if(value===null)return '';const v=Number(value.toFixed(d)),tone=v>0?'gain':v<0?'loss':'flat';return `<span class="election-change ${tone}">${v>0?'↑ +':v<0?'↓ ':''}${n(v,d)} ${unit}</span>`;};
 const rows=opening?[...comparison.rows].sort((a,b)=>b.seats-a.seats):comparison.rows;
 const cards=rows.map(r=>{
  const previous=r.previous;
  const previousLine=previous ? 'Было '+(previousOpening?'':n(previous.share,2)+'%'+(parliament?' · ':''))
    +(parliament?previous.seats+' '+seatUnit(previous.seats,'ru'):'') : null;
  return `<article class="election-candidate ${r.id===e.winner?'is-winner':''}" style="--party-color:${party(r.id)?.color??'#5079a5'}">
    <span class="candidate-party">${esc(partyDisplayName(party(r.id)))}</span>
    ${parliament?'':`<strong class="candidate-name">${esc(r.candidateName)}</strong>`}
    <b class="candidate-result">${parliament?r.seats+'<small> / '+e.totalSeats+'</small>':n(r.share,2)+'%'}</b>
    ${parliament?delta(r.seatChange,seatUnit(Math.abs(r.seatChange??0),'ru'),0):''}
    ${opening?'':`${parliament?`<span class="candidate-vote-share">${n(r.share,2)}%</span>`:''}
      ${previousOpening?'':delta(r.shareChange,'п.п.')}<span class="candidate-votes">${n(r.votes,0)} голосов</span>`}
    ${previousLine?`<span class="candidate-previous">${esc(previousLine)}</span>`:comparison.previous?'<span class="candidate-previous">Первое участие</span>':''}
   </article>`;
 }).join('');
 const comparisonDate=comparison.previous?(comparison.previous.initial?'К стартовому составу · ':'К выборам · ')+date(comparison.previous.month,true):'Первое голосование';
 return `<dialog id="election-dialog" class="election-popup" aria-labelledby="election-heading">
  <div class="election-kicker">${parliament?'Парламентские':'Президентские'} выборы · ${date(e.month,true)}</div>
  <h2 id="election-heading">${esc(opening?'Стартовый состав Палаты общин':electionHeadline(state,e))}</h2>
  <div class="election-candidates">${cards}</div>
  ${opening?'':`<div class="election-comparison-period">${comparisonDate}</div><div class="election-turnout">Явка ${n(e.turnout,1)}%</div>`}
  <button class="primary wide" data-action="election-ack" data-election-id="${e.id}">Продолжить</button></dialog>`;
}
export function electionResultLinks(p){
 const latest=['parliament','president'].flatMap(kind=>{
  const election=p.elections.findLast(e=>e.kind===kind);
  return election?[election]:[];
 });
 return latest.length?`<div class="section-actions">${latest.map(e=>`<button data-action="election-open" data-election-id="${e.id}">${latest.length===1?'Итоги выборов':e.kind==='parliament'?'Итоги парламентских выборов':'Итоги президентских выборов'}</button>`).join('')}</div>`:'';
}
export function politicalNews(state,{n,date}){
 const p=state.politics;if(!p.enabled)return [];
 const news=p.elections.filter(e=>!e.initial).map(e=>({month:e.month,text:e.kind==='president'?`Президентские выборы: ${e.winnerCandidate??''} · ${n(electionResults(e).find(r=>r.id===e.winner)?.share??0,2)}%`:`Парламентские выборы: ваша партия · ${e.results.find(r=>r.id===p.executive.playerParty)?.seats??0} / ${e.totalSeats} мест`}));
 for(const e of p.parliamentary?.notices??[])news.push({month:e.month,text:e.title+': '+e.text});
 for(const entry of state.journal??[])for(const text of entry.events??[])if(/импичмент|отстран|сменил кабинет|вотум|Предел сроков|вступил в должность|вышла из коалиции|Журналистское расследование|Правление завершено|Смерть персонажа|Смена вашего персонажа|Смена лидера партии|Назначение в суд/.test(text))news.push({month:entry.month,text:text.replace(/\. Итоговый отчёт.*$/,'')});
 for(const [label,month] of [['Президентские',p.nextPresidentElection],['Парламентские',Math.min(p.nextParliamentElection,p.scheduledParliament??Infinity)]])if(month!==null&&month-state.month<=3)news.push({month:state.month,text:`${label} выборы · ${date(month,true)}`});
 return news.sort((a,b)=>b.month-a.month).slice(0,3);
}

export function electionStory(state,election,{english=activeLanguage()==='en'}={}){
 const name=id=>{
  const label=partyDisplayName(state.politics.parties.find(party=>party.id===id));
  return english?translateText(label):label;
 };
 const percent=value=>new Intl.NumberFormat(english?'en-GB':'ru-RU',{maximumFractionDigits:1}).format(value)+'%';
 if(election.kind==='president'){
  const elected=electionResults(election).find(result=>result.id===election.winner);
  const candidate=election.winnerCandidate??elected?.candidateName??name(election.winner);
  const text=elected?(english?`${candidate} won the presidential election with ${percent(elected.share)} of the vote.`:
    `По итогам голосования президентом избран кандидат ${candidate}. За него проголосовали ${percent(elected.share)} избирателей, пришедших на участки.`):null;
  return {title:english?'Presidential election results are in':'Объявлены итоги президентских выборов',text:[text].filter(Boolean)};
 }
 const rows=[...election.results].sort((a,b)=>b.seats-a.seats||b.votes-a.votes);
 const leader=rows[0],majority=Math.floor(election.totalSeats/2)+1,clear=leader.seats>=majority;
 const tied=rows[1]?.seats===leader.seats;
 const uk=state.scenario?.id==='uk-2000';
 const opening=guidedOpeningResult(state,election);
 const chamber=uk?'Палате общин':'парламенте';
 const title=opening?(english?'The opening Commons line-up':'Стартовый состав Палаты общин'):english?(clear?(uk?'One party takes a Commons majority':'One party takes a parliamentary majority'):
   (uk?'Election leaves the Commons without a majority':'Election leaves parliament without a majority')):
   clear?`Одна партия получила большинство в ${chamber}`:`Выборы оставили ${uk?'Палату общин':'парламент'} без большинства`;
 const seats=(row)=>`${row.seats}/${election.totalSeats}`;
 const lead=english?(tied?`${name(leader.id)} and ${name(rows[1].id)} finished level on ${leader.seats} seats each.`:
   `${name(leader.id)} took ${seats(leader)} seats${opening?'':' with '+percent(leader.share)+' of the vote'}.`):
   tied?`«${name(leader.id)}» и «${name(rows[1].id)}» разделили первое место. У каждой партии по ${leader.seats} ${seatUnit(leader.seats,'ru')}.`:
   `«${name(leader.id)}» получила ${leader.seats} из ${election.totalSeats} мест.${opening?'':' За партию отдали '+percent(leader.share)+' голосов.'}`;
 const own=rows.find(row=>row.id===state.politics.executive.playerParty);
 const context=english?`A majority takes ${majority} seats.${own&&own!==leader?` Your party took ${own.seats} seats${opening?'':' on '+percent(own.share)+' of the vote'}.`:''}`:
   `Для большинства нужно ${majority} ${seatUnit(majority,'ru')}.${own&&own!==leader?` У вашей партии ${own.seats} ${seatUnit(own.seats,'ru')}${opening?'':' и '+percent(own.share)+' голосов'}.`:''}`;
 const pactDistricts=election.pacts?.reduce((total,pact)=>total+pact.districts,0)??0;
 const pacts=pactDistricts?(english?
   `Parties stood aside for their allies in ${pactDistricts} constituencies under pre-election pacts.`:
   `Предвыборные соглашения затронули ${pactDistricts} ${districtUnit(pactDistricts)}. Там партии сняли кандидатов в пользу союзников.`):null;
 return {title,text:[lead,context,pacts].filter(Boolean)};
}

const districtForms = new Intl.PluralRules('ru-RU');
const districtUnit = count => ({one:'округ',few:'округа',many:'округов'})[districtForms.select(count)];
export function electoralPactDialog(state,agreement,{esc,date}){
 const partner=state.politics.parties.find(party=>agreement.parties.includes(party.id)&&party.id!==state.politics.executive.playerParty);
 const en=activeLanguage()==='en',name=esc(partyDisplayName(partner)),count=agreement.terms.length/2;
 return `<dialog id="electoral-pact-dialog" class="newspaper-popup press-reader" aria-labelledby="electoral-pact-heading">
  <article class="newspaper-sheet"><div class="election-kicker">${en?'Campaign':'Избирательная кампания'} · ${date(state.politics.electoralPact.due,true)}</div>
  <h2 id="electoral-pact-heading">${en?'A pre-election pact':'Предвыборное соглашение'}</h2>
  <p>${en?`${name} proposes standing aside for your candidates in ${count} constituencies. Your party would do the same in ${count} others.`:
  `«${name}» готова уступить вашим кандидатам ${count} ${districtUnit(count)}. Взамен ваша партия снимет столько же кандидатов там, где у партнёра больше шансов.`}</p>
  <footer><button type="button" data-pact-answer="accepted">${en?'Accept the pact':'Принять соглашение'}</button>
  <button type="button" data-pact-answer="rejected">${en?'Run separately':'Идти на выборы отдельно'}</button></footer></article></dialog>`;
}

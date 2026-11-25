import {activeLanguage,seatUnit,translateText} from './localization.js';
import {electionResultLinks} from './election-ui.js';
import {partyDisplayName,PARTY_DESCRIPTIONS} from './political-config.js';
import {coalitionCondition,cabinetSeats,compatibleCoalition,playerCabinetBlock,openingCoalitionPartner} from './parliamentary.js';
import {playerExecutive} from './parliamentary-state.js';
import {POLICY_FIELDS,POLICY_CHOICES} from './config.js';
function shortageText(count){
  const unit=seatUnit(count);
  return activeLanguage()==='en'?`You need ${count} more ${unit} for a majority.`:`Для большинства нужно ещё ${count} ${unit}.`;
}
export function parliamentBoard(s,{n,pct,esc,date,chart}){
 const p=s.politics,q=p.parliamentary,own=p.executive.playerParty,byId=id=>p.parties.find(x=>x.id===id),forming=q.phase==='forming',mine=playerExecutive(s),playing=p.executive.inOffice;
 const selected=q.negotiations.length?q.negotiations:mine?p.coalition:[own],draftSeats=cabinetSeats(s,selected),support=cabinetSeats(s),required=Math.floor(p.totalSeats/2)+1;
 const canPropose=playing&&(!mine||q.negotiations.length>0);
 const shortage=Math.max(0,required-draftSeats);
 const block=canPropose&&!shortage?playerCabinetBlock(s,selected):'';
 const leader=p.executive.primeMinisterParty;
 const cabinet=[leader,...p.coalition.filter(id=>id!==leader)].map(id=>partyDisplayName(byId(id))).join(' + ');
 const action=(name,label,extra='')=>`<button data-parliament="${name}" ${extra} ${playing?'':'disabled'}>${label}</button>`;
 const conditionText=c=>{if(!c)return 'Поддержка общей программы';const f=POLICY_FIELDS.find(x=>x[0]===c.key),choice=POLICY_CHOICES.find(x=>x[0]===c.key),value=choice?choice[3].find(x=>x[0]===c.value)?.[1]:typeof c.value==='boolean'?(c.value?'включить':'отключить'):n(c.value,f?.[4]<1?2:0)+(f?' '+f[5]:'');return `${c.label}: ${value}`;};
 const current=q.notices.at(-1),status=!playing?'Партия вне парламента':forming?'Формирование кабинета':mine?'Ваша партия у власти':'Ваша партия в оппозиции';
 const showNotice=current&&!forming&&!['Вы сформировали правительство','Сформирован новый кабинет'].includes(current.title);
 const guidance=shortage?shortageText(shortage):block;
 const partner=forming&&playing&&selected.length===1?openingCoalitionPartner(s):null;
 const opening=forming&&playing?`<div class="opening-negotiations">
   <div>${guidance?'Согласуйте условия партнёра. Как только наберёте большинство, нажмите «Сформировать кабинет».':'Мест уже хватает. Чтобы возглавить правительство, нажмите «Сформировать кабинет».'}</div>
   <small>Если переговоры закончатся без кабинета, правительство могут сформировать соперники.</small>
   ${partner?`<div class="opening-partner"><b>${esc(partyDisplayName(partner))} · ${partner.seats} ${seatUnit(partner.seats)}</b><div>${esc(conditionText(coalitionCondition(s,partner.id)))}</div>${action('accept','Согласовать условия',`data-party-id="${partner.id}"`)}</div>`:''}
 </div>`:'';
 const builder=canPropose?`<section class="coalition-negotiations">
   <div class="coalition-builder"><h3>${mine?'Обновить коалицию':'Ваш проект коалиции'}</h3><div class="coalition-tally"><strong>${draftSeats}</strong><span>из ${required} необходимых мест</span></div></div>
   ${guidance?`<div id="coalition-guidance" class="coalition-guidance">${esc(guidance)}</div>`:''}
   ${opening}
   ${action('form',mine?'Утвердить коалицию':'Сформировать кабинет',`class="primary" ${guidance?'aria-describedby="coalition-guidance" disabled':''}`)}
 </section>`:'';
 return `<section class="panel parliament-game"><div class="parliament-header"><div><span class="eyebrow">ПАРЛАМЕНТСКАЯ РЕСПУБЛИКА</span><h2>${esc(status)}</h2></div><span class="mandate-badge">${byId(own).seats}<small> / ${p.totalSeats} мест</small></span></div>${!playing?`<p>${esc(p.executive.reason)}</p><button data-action="new" class="primary">Новая игра</button>`:''}<div class="cabinet-reading"><span>${forming?'Переговоры до '+date(q.formationUntil,true):'Кабинет — '+esc(cabinet)}</span>${forming?'':`<b>${support} / ${p.totalSeats} мест</b>`}</div><div class="majority-track"><i style="width:${Math.min(100,100*support/p.totalSeats)}%"></i><span></span></div>${playing&&!mine&&q.factionControl===1?`<div class="faction-order"><span>Голоса вашей фракции</span><div>${[['accept','За'],['reject','Против'],['abstain','Воздержаться']].map(([vote,label])=>`<button data-faction-vote="${vote}" aria-pressed="${(q.oppositionVote??'reject')===vote}">${label}</button>`).join('')}</div><small>Для голосований без отдельного указания.</small></div>`:''}${builder}${chart()}${electionResultLinks(p)}${showNotice?`<article class="parliament-event"><span>${date(current.month,true)}</span><h3>${esc(current.title)}</h3><p>${esc(current.text)}</p></article>`:''}<div class="parliament-parties">${p.parties.filter(x=>x.active).sort((a,b)=>b.seats-a.seats).map(x=>{
 const agreement=q.draftAgreements.find(a=>a.partyId===x.id),c=agreement?.condition??q.agreements.find(a=>a.partyId===x.id)?.condition??coalitionCondition(s,x.id),selectedParty=selected.includes(x.id),incab=p.coalition.includes(x.id),warning=q.agreements.find(a=>a.partyId===x.id)?.warningSince!==undefined;
 const counter=coalitionCondition(s,x.id,{compromise:true}),hasCompromise=counter&&c&&counter.value!==c.value;
 const acceptable=selected.every(id=>id===x.id||compatibleCoalition(s,x,byId(id)));
 const canCompromise=hasCompromise&&compatibleCoalition(s,x,byId(own),'compromise');
 return `<article class="parliament-party ${selectedParty?'selected':''}" style="--party-color:${x.color}"><div class="party-card-top"><span class="party-emblem">${esc(x.family==='green'?'✦':x.family==='communist'?'★':translateText(partyDisplayName(x)).slice(0,1))}</span><b>${x.seats}<small> ${seatUnit(x.seats)}</small></b></div><h3>${esc(partyDisplayName(x))}</h3><p class="party-role">${x.id===own?'Ваша партия':incab?'В правительстве':selectedParty?'Условие согласовано':x.seats?'Оппозиция':'Следующая кампания'} · Опрос ${pct(p.poll.parties.find(r=>r.id===x.id)?.share??0)}</p><p class="party-brief">${esc(PARTY_DESCRIPTIONS[x.family]??'')}</p>${x.id!==own&&x.seats&&playing?`<div class="coalition-demand">${warning?'<b>Соглашение нарушено</b>':''}<span>${esc(conditionText(c))}</span>${!selectedParty&&canCompromise?`<small>Компромисс — ${esc(conditionText(counter))}</small>`:''}</div><div class="party-card-actions">${warning&&mine?action('accept','Пересмотреть',`data-party-id="${x.id}"`):''}${selectedParty?action('remove','Убрать',`data-party-id="${x.id}"`):acceptable?action('accept',warning?'Пересмотреть':'Принять условие',`data-party-id="${x.id}"`)+(canCompromise?action('compromise','Меньшая уступка',`data-party-id="${x.id}"`):''):'<span class="small muted">Программы несовместимы</span>'}</div>`:''}</article>`;
 }).join('')}</div>${playing&&mine&&p.constitution.dissolution?`<div class="section-actions">${p.scheduledParliament!==null?'Досрочные выборы · '+date(p.scheduledParliament,true):'<button data-political-action="dissolve">Досрочные выборы</button>'}</div>`:''}</section>`;
}

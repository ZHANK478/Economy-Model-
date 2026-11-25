import {networkTransferQuote,networkQuoteMessage} from './network-transfers.js';
// Interface only: ownership and network stocks are read from live simulation accounts.
export const OWNERSHIP_OPERATIONS=[['privatize','Приватизация','Госсектор','Частный сектор'],['purchase','Выкуп государством','Частный сектор','Государство'],['nationalize','Национализация','Частный сектор','Государство'],['foreignSale','Продать иностранным инвесторам','Госсектор','Иностранные инвесторы'],['cooperatize','Выкуп работниками','Предприятие','Кооператив'],['municipalize','Передать муниципалитету','Государство','Муниципалитет'],['recapitalize','Вложить капитал','Бюджет','Капитал предприятия']];
export const NETWORK_OPERATIONS=[['networkSale','Продать оператору','Госсектор','Частный оператор'],['networkPurchase','Выкупить государству','Частный оператор','Государство'],['networkMunicipalize','Передать муниципалитету','Государство','Муниципалитет']];
export function shareParts(values){const total=values.reduce((a,b)=>a+b,0);return values.map(v=>total>0?v/total:0);}
const icons={
 agriculture:'<path d="M17 72h94M35 72V37l21-16 21 16v35M46 72V53h20v19M82 72V38h18v34M89 38V21m-9 8h18M25 72V43m-7 6 7-7 7 7"/>',
 resources:'<path d="M17 72h94M37 72l14-53h21l14 53M47 37h29M42 54h38M51 19h21M61 19V9m-3 63V54h10v18M91 72V40h15v32"/>',
 industry:'<path d="M13 72h104M24 72V41l22-12v12l22-12v12h36v31M85 41V14h12v27M35 53h8m12 0h8m12 0h8m12 0h8M35 63h8m12 0h8m12 0h8m12 0h8"/>',
 construction:'<path d="M15 72h104M43 72V14h9v58M25 24h75V14H43M100 24v25m-7 0h14M62 72V49h38v23M72 59h7m9 0h4M43 33h9m-9 14h9m-9 14h9"/>',
 services:'<path d="M16 72h101M28 72V31h27v41M55 72V16h31v56M86 72V41h18v31M36 42h10m-10 12h10m18-25h12m-12 12h12m-12 12h12m-9 19V62h9v10"/>',
 roads:'<path d="M14 72h104M35 72l18-56h24l18 56M65 20v9m0 10v10m0 11v10M18 44h18m58 0h18M24 44V29m82 15V29"/>',
 rail:'<path d="M24 72l16-17m67 17L90 55M37 17h54v40H37zM44 24h40v17H44zM43 49h7m27 0h7M35 63h59M27 70h78M50 57v7m28-7v7"/>',
 grid:'<path d="M36 72l15-57h25l16 57M44 44h39M47 29h32M39 60h49M36 29h56M27 44h74M64 15V8M27 44v11m74-11v11M36 29v9m56-9v9M20 72h88"/>'
};
export function assetIllustration(id){return `<svg class="asset-art" viewBox="0 0 130 85" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${icons[id]??icons.industry}</g></svg>`;}
function ownershipShares(values,labels,n){
  const parts=shareParts(values);
  return `<div class="asset-share"><div class="asset-share-track" aria-hidden="true">${parts.map((v,i)=>`<span style="width:${v*100}%;background:var(--owner-${i})"></span>`).join('')}</div>
    <ul>${parts.map((v,i)=>v<=0?'':`<li><i style="background:var(--owner-${i})" aria-hidden="true"></i><span>${labels[i]} <b>${n(v*100,1)}%</b></span></li>`).join('')}</ul></div>`;
}

function assetDirectory(items,attribute,valueFor,esc){
  return `<ul class="asset-directory">${items.map((a,i)=>`<li><button ${attribute}="${valueFor(a,i)}"><span class="asset-seal">${assetIllustration(a.id)}</span><span>${esc(a.name)}</span></button></li>`).join('')}</ul>`;
}

function assetRecord(type,selected,shares,form,{esc,status=''}){
  return `<article class="asset-record">
    <button class="decision-back" data-asset-close="${type}"><span aria-hidden="true">←</span> ${type==='network'?'К сетям':'К отраслям'}</button>
    <header><span class="asset-seal">${assetIllustration(selected.id)}</span><h3 tabindex="-1">${esc(selected.name)}</h3></header>
    ${status}${shares}${form}
  </article>`;
}
function desk(type,assetId,ui,preview,political){
  const network=type==='network',ops=network?NETWORK_OPERATIONS:OWNERSHIP_OPERATIONS;
  const kind=network?ui.networkKind:ui.ownershipKind,op=ops.find(o=>o[0]===kind)??ops[0];
  const points=network?ui.networkPoints:ui.points,prefix=network?'network':'ownership',unit=network?'% фонда':'п.п.';
  const operations=choices=>`<div class="transfer-operations">${choices.map(([id,label])=>
    `<button data-asset-kind="${id}" data-asset-domain="${type}" class="${id===op[0]?'active':''}" aria-pressed="${id===op[0]}">${label}</button>`).join('')}</div>`;
  return `<section class="asset-desk" aria-label="Операции">
    <input id="${prefix}-${network?'id':'sector'}" type="hidden" value="${assetId}">
    <input id="${prefix}-kind" type="hidden" value="${op[0]}">
    ${operations(ops.slice(0,3))}
    ${network?'':`<details class="asset-more" ${ops.slice(3).includes(op)?'open':''}><summary>Другие операции</summary>${operations(ops.slice(3))}</details>`}
    <div class="transfer-route"><span>${op[2]}</span><span class="transfer-arrow" aria-hidden="true">→</span><span>${op[3]}</span></div>
    <div class="transfer-amount"><label for="${prefix}-points">Доля передачи</label><span><input id="${prefix}-points" type="number" min="1" max="100" step="1" value="${points}" data-asset-input="${network?'networkPoints':'points'}" aria-label="Доля передачи, ${unit}">${unit}</span></div>
    <input class="transfer-range" type="range" min="1" max="100" step="1" value="${points}" data-asset-input="${network?'networkPoints':'points'}" aria-label="Доля передачи, ползунок">
    ${network?'':`<div class="transfer-compensation" ${kind==='nationalize'?'':'hidden'}><label for="ownership-compensation">Компенсация</label><span><input id="ownership-compensation" type="number" min="0" max="100" step="1" value="${ui.compensation}" data-asset-input="compensation">%</span></div>`}
    ${preview}<button class="transfer-submit primary" data-action="${prefix}-queue">${political?'На голосование':'Запланировать передачу'} <span aria-hidden="true">→</span></button>
  </section>`;
}

export function ownershipBoard(state,ui,helpers){
  const {n,esc}=helpers,selected=ui.sector===null?null:state.firms[ui.sector];
  if(!selected)return `<h3 tabindex="-1">Собственность</h3>${assetDirectory(state.firms,'data-asset-sector',(_,i)=>i,esc)}`;
  const {state:publicShare,municipal,domestic,cooperative,foreign}=selected.ownership;
  const shares=ownershipShares([publicShare,municipal,domestic,cooperative,foreign],
    ['Государство','Муниципалитет','Частные владельцы','Кооперативы','Иностранные инвесторы'],n);
  const form=desk('ownership',ui.sector,ui,'',state.politics.enabled);
  return assetRecord('ownership',selected,shares,form,{esc});
}

export function infrastructureBoard(state,ui,helpers){
  const {n,esc}=helpers,selected=state.networks.find(a=>a.id===ui.network);
  if(!selected)return assetDirectory(state.networks,'data-network-asset',a=>a.id,esc);
  const shares=ownershipShares([selected.public,selected.municipal,selected.private,selected.concession],
    ['Государство','Муниципалитет','Частный оператор','Концессия'],n);
  const quote=state.foundation&&selected.operator?networkTransferQuote(state,{network:selected.id,kind:ui.networkKind,points:ui.networkPoints}):null;
  const preview=quote?`<p class="small transfer-preview" role="status">${esc(networkQuoteMessage(quote,ui.networkKind,n))}</p>`:'';
  const status=Number.isFinite(selected.maintenanceCoverage)?`<p class="asset-condition">Покрытие расходов на обслуживание общественных сетей · ${n(selected.maintenanceCoverage*100,0)}%</p>`:'';
  const form=desk('network',selected.id,ui,preview,state.politics.enabled);
  return assetRecord('network',selected,shares,form,{esc,status});
}

export function assetTransferOutcome(actions){
  const operations=actions.filter(action=>action.network||
    OWNERSHIP_OPERATIONS.some(([kind])=>kind===action.kind));
  if(!operations.length)return null;
  const completed=operations.filter(action=>!action.rejected&&
    (action.actualPoints>0||action.amount>0||action.cost>0)).length;
  return {kind:'assetTransfer',success:completed>0,
    title:completed===operations.length?'Выполнено':completed?'Выполнено частично':'Не выполнено'};
}

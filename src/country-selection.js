import {selectCampaignLeader} from './campaign-leader.js';
import {PARLIAMENTARY_CATALOG} from './parliamentary.js';
import {PARTY_DESCRIPTIONS,PARTY_LABELS} from './political-config.js';
import {esc} from './atlas-interface.js';

export function showCountrySelection(host,onChoose){
 const screen=document.createElement('section');
 screen.className='country-selection party-selection';
 screen.setAttribute('aria-label','Выбор партии');
 screen.innerHTML=`<button type="button" class="country-back" aria-label="Назад в главное меню">←</button>
 <section class="country-dossier" aria-labelledby="party-selection-title">
  <header><p>Великобритания · 2000</p><h2 id="party-selection-title">Выберите партию</h2></header>
  <div class="country-dossier-body"><p class="party-selection-note">Ваша партия получит больше мест, чем любая другая. Для кабинета понадобится союзник.</p>
   <fieldset class="campaign-parties"><legend>Ваша партия</legend>
    ${PARLIAMENTARY_CATALOG.map(({id,color})=>`<label><input type="radio" name="campaign-party" value="${id}"><span style="--party-color:${color}"><strong>${esc(PARTY_LABELS[id])}</strong><small>${esc(PARTY_DESCRIPTIONS[id])}</small></span></label>`).join('')}
   </fieldset>
  </div>
  <footer><button type="button" class="country-launch" disabled>Настроить внешность</button></footer>
 </section>`;
 const studio=host.querySelector('.menu-studio'),menuPanel=host.querySelector('.menu-content');
 studio.hidden=true;menuPanel.hidden=true;
 host.append(screen);
 const back=screen.querySelector('.country-back'),launch=screen.querySelector('.country-launch');
 let choosingLeader=false;
 function leave(){
  screen.remove();studio.hidden=false;menuPanel.hidden=false;
  host.querySelector('[data-menu="new"]').focus();
 }
 back.onclick=leave;
 screen.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!choosingLeader){event.preventDefault();leave();}
 });
 screen.addEventListener('change',event=>{
  if(event.target.name==='campaign-party')launch.disabled=false;
 });
 launch.onclick=async()=>{
  const party=screen.querySelector('input[name="campaign-party"]:checked')?.value;
  if(!party||choosingLeader)return;
  choosingLeader=true;launch.disabled=true;
  const leader=await selectCampaignLeader('uk-2000');
  choosingLeader=false;launch.disabled=false;
  if(leader===null){launch.focus();return;}
  leave();
  onChoose('uk-2000',leader,party);
 };
 back.focus();
 return {close:leave};
}

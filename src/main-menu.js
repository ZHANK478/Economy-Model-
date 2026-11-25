import {analyticsField, analyticsToggleLabel, PLAYTEST_BUILD} from './playtest-analytics.js';
import {interfaceSoundField} from './interface-audio.js';
import {activeLanguage,languageField} from './localization.js';
import {deskAtlas} from './strategy-map.js';
import {mountDeskAtlas} from './desk-atlas.js';
import {showCountrySelection} from './country-selection.js';
import {music, musicField, soundtrackLink} from './soundtrack.js';
const prototypeInfo = () => `<p>Mandatewright — прототип. Игра ещё разрабатывается.</p>
<p>Сейчас можно сыграть за Великобританию в 2000 году, собрать правительство, проводить законы и менять экономическую политику.</p>
<p>Кодекс пока служит справочником. Личные переговоры с персонажами и другие страны ещё в работе.</p>
<p>${soundtrackLink(activeLanguage())}</p>
<p><a href="./docs/THIRD-PARTY-NOTICES${activeLanguage()==='en'?'.en':''}.txt" target="_blank" rel="noopener">Источники и лицензии материалов</a></p>`;
// Presentation only. Simulation and save handling remain in app.js.
export function mountMainMenu({analytics,hasSave,onNew,onLoadSaves,onContinue,onLanguageChange}) {
 const root=document.createElement('section');root.id='main-menu';root.setAttribute('aria-label','Главное меню');
 root.innerHTML=`<div class="menu-map" aria-hidden="true">${deskAtlas(null,false,null,true)}</div><div class="menu-light" aria-hidden="true"></div><aside class="menu-content"><header><h1 lang="en">Mandatewright</h1></header><nav aria-label="Главное меню"><button data-menu="new">НОВАЯ ИГРА</button><button data-menu="load">ЗАГРУЗИТЬ</button><button data-menu="settings">НАСТРОЙКИ</button><button data-menu="about">ОБ ИГРЕ</button></nav><button type="button" class="menu-version" data-menu="development">Ранняя версия · ${PLAYTEST_BUILD}</button></aside><button class="menu-studio" data-menu="about" aria-label="Об игре"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 9h11v22H8zM22 9h10v22H22z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 13h3v14h-3zm14 0h2v14h-2z"/></svg><span lang="en">Mandatewright</span></button><dialog class="menu-options" aria-labelledby="menu-options-title"><button data-close-button type="button" class="menu-options-close" autofocus aria-label="Закрыть">×</button><h2 id="menu-options-title">Настройки</h2><div class="menu-options-body"></div></dialog>`;
 document.body.append(root);
 mountDeskAtlas(root.querySelector('.menu-map [data-desk-atlas]'), {}, {decorative:true});
 const app=document.getElementById('app');
 const hide=()=>{root.hidden=true;app.inert=false;document.body.classList.remove('on-main-menu');document.querySelector('.settings-toggle')?.focus();};
 const show=()=>{document.querySelectorAll('#app dialog[open]').forEach(dialog=>dialog.close());root.hidden=false;app.inert=true;document.body.classList.add('on-main-menu');music.setMood('menu');root.querySelector('[data-menu="new"]').focus();};
 const markReady=()=>{hasSave=true;hide();};
 const options=root.querySelector('dialog');
 const optionsBody=root.querySelector('.menu-options-body'),title=root.querySelector('#menu-options-title');
 function openPanel(heading,html){title.textContent=heading;optionsBody.innerHTML=html;if(!options.open)options.showModal();}
 const newGame=()=>showCountrySelection(root,onNew);
 root.addEventListener('click',event=>{
  const toggle=event.target.closest('[data-analytics-toggle]');
  if(toggle){
   analytics.toggle();
   toggle.textContent=analyticsToggleLabel(analytics);
   return;
  }
  const action=event.target.closest('[data-menu]')?.dataset.menu;
  if(action==='new'||action==='load')analytics.mark('menu');
  if(action==='new')newGame();
  if(action==='load')onLoadSaves(hasSave?()=>{hide();onContinue();}:undefined);
  if(action==='development'||action==='about')openPanel('Об игре',prototypeInfo()+analyticsField(analytics));
  if(action==='settings'){openPanel('Настройки',`${languageField()}${musicField()}${interfaceSoundField()}${analyticsField(analytics)}<label><input type="checkbox" id="menu-motion" ${root.classList.contains('still')?'checked':''}> Уменьшить движение карты</label><button data-menu="fullscreen">Полноэкранный режим</button>`);}
  if(action==='fullscreen'){
   const change=document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.();
   if(change)change.catch(()=>openPanel('Полноэкранный режим','<p>Браузер не разрешил полноэкранный режим.</p>'));
   else openPanel('Полноэкранный режим','<p>Этот браузер не поддерживает полноэкранный режим.</p>');
  }
 });
 root.addEventListener('change',async event=>{
  if(event.target.name==='campaign-party')analytics.mark('party');
  if(event.target.id==='menu-motion')root.classList.toggle('still',event.target.checked);
  if(Object.hasOwn(event.target.dataset,'gameLanguage'))await onLanguageChange(event.target);
 });
 root.querySelector('.menu-options-close').onclick=()=>options.close();
 show();openPanel('Об игре',prototypeInfo()+analyticsField(analytics));
 return {show,hide,markReady,newGame};
}

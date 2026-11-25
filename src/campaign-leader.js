import {activeLanguage} from './localization.js';
import {latinCharacterName} from './leader-names.js';
import {savedAppearance} from '../leader-editor/workshop-appearance.js';

export function savedCampaignLeader(value) {
  if (typeof value?.name !== 'string' || typeof value.portrait !== 'string'
      || value.portrait.length > 280_000
      || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value.portrait)) return null;
  const name = latinCharacterName(value.name.trim()).slice(0,48);
  const appearance=savedAppearance(value.appearance);
  return name ? {name,portrait:value.portrait,...(appearance?{appearance}:{})} : null;
}

export function selectCampaignLeader(scenario) {
  const dialog = document.createElement('dialog');
  dialog.className = 'campaign-leader-editor';
  dialog.setAttribute('aria-label','Персонализация персонажа');
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'campaign-leader-back';
  back.textContent = '← Назад к выбору страны';
  const editor = document.createElement('iframe');
  editor.title = 'Портретная мастерская';
  editor.src = './leader-editor/index.html?'+new URLSearchParams({scenario,lang:activeLanguage()});
  const skip=document.createElement('button');
  skip.type='button';
  skip.className='campaign-leader-back';
  skip.textContent='Начать без настройки портрета';
  const actions=document.createElement('div');
  actions.className='campaign-leader-actions';
  actions.append(back,skip);
  dialog.append(actions,editor);
  document.body.append(dialog);

  return new Promise(resolve=>{
    let leader = null;
    function receive(event) {
      if (event.source !== editor.contentWindow || event.origin !== location.origin) return;
      if (event.data?.type === 'cancel-campaign-leader') dialog.close();
      if (event.data?.type !== 'campaign-leader') return;
      leader = savedCampaignLeader(event.data.leader);
      if (leader) dialog.close();
    }
    back.onclick = () => dialog.close();
    skip.onclick = () => {leader=undefined;dialog.close();};
    dialog.addEventListener('close',()=>{
      window.removeEventListener('message',receive);
      dialog.remove();
      resolve(leader);
    },{once:true});
    window.addEventListener('message',receive);
    dialog.showModal();
  });
}

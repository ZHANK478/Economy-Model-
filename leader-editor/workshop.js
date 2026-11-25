import {startLocalization} from '../src/localization.js';
import {palette,presets,faceNames,faceFeatures,renderShape} from './workshop-appearance.js';
import {characterEthnicity,characterSkinTone} from '../src/character-demographics.js';
import {britishName,latinCharacterName} from '../src/leader-names.js';
import {createRenderer} from './workshop-renderer.js';
import {backdropNames,createBackdrops,randomMouthItem} from './workshop-backdrops.js';

await startLocalization(new URLSearchParams(location.search).get('lang'));

const $ = selector => document.querySelector(selector);
const portraitCanvas = $('#live-portrait');
const meshCanvas = document.createElement('canvas');
meshCanvas.width=portraitCanvas.width;
meshCanvas.height=portraitCanvas.height;
const modelDisplay=portraitCanvas.getContext('2d');
const backdrops=createBackdrops(meshCanvas.width,meshCanvas.height);
const status = $('#workshop-status');

const features = faceFeatures;
const options = {
  profile:['Мужской','Женский'],
  face:faceNames,
  age:['Молодой','Зрелый','Пожилой'],
  skin:['Светлая','Тёплая светлая','Смуглая','Тёмная'],
  hair:['Короткая укладка','Высокие виски','Волнистая укладка','Каре','Волны до плеч','Собранные волосы'],
  hairColor:['Тёмные','Каштановые','Русые','Седые','Соль с перцем'],
  beardStyle:['Гладко выбрит','Тонкие усы','Густые усы','Эспаньолка','Короткая борода'],
  suitStyle:['Однобортный','Двубортный','Костюм-тройка','Жакет с блузкой','Смокинг с шалевым воротником','Клубный блейзер','Клетчатая тройка'],
  suit:['Графитовый','Тёмно-синий','Табачный','Оливковый','Бордовый','Серо-бежевый'],
  neckwear:['Без галстука','Классический галстук','Галстук в полоску','Бабочка','Шейный платок'],
  tie:['Бордовый','Синий','Охристый','Зелёный','Сливовый','Слоновая кость'],
  glasses:['Без очков','Круглая оправа','Прямоугольная оправа'],
  backdrop:backdropNames,
  mouthItem:['Без аксессуара','Сигарета','Сигара','Курительная трубка'],
};
const labels = {
  profile:'Образ',face:'Тип лица',age:'Возраст',skin:'Тон кожи',hair:'Причёска',
  hairColor:'Цвет волос',beardStyle:'Усы и борода',suitStyle:'Крой одежды',
  suit:'Цвет костюма',neckwear:'Галстук и платок',tie:'Цвет галстука',
  glasses:'Очки',mouthItem:'Аксессуар во рту',backdrop:'Фон портрета',
};
const categories = [
  ['Лицо',['profile','face','age','skin']],
  ['Волосы',['hair','hairColor','beardStyle']],
  ['Одежда',['suitStyle','suit','neckwear','tie']],
  ['Аксессуары',['glasses','mouthItem']],
  ['Черты лица',features.map((_,i)=>'shape-'+i)],
  ['Фон',['backdrop']],
];
const scenario=new URLSearchParams(location.search).get('scenario')??'uk-2000';
const randomSkin=()=>characterSkinTone(characterEthnicity(Math.random(),scenario),Math.random());
const randomName=profile=>britishName(crypto.getRandomValues(new Uint32Array(1))[0],'workshop',profile);
const initialProfile=Number(Math.random()<.5);
const defaults = {
  name:randomName(initialProfile),shape:[...presets[0]],profile:initialProfile,face:0,age:1,skin:randomSkin(),hair:initialProfile*3,
  hairColor:1,beardStyle:0,suitStyle:initialProfile*3,suit:0,neckwear:initialProfile?4:1,tie:0,glasses:1,mouthItem:0,backdrop:0,
};
const shapeSteps = [-1,-.75,-.5,-.25,0,.25,.5,.75,1];

let renderer, frame, category=0;
let current = {...defaults,shape:[...defaults.shape]};
let generatedName=defaults.name;

function draw(character=current) {
  renderer.draw({...character,shape:renderShape(character)},palette(character));
  modelDisplay.drawImage(backdrops[character.backdrop],0,0);
  modelDisplay.drawImage(meshCanvas,0,0);
}

function scheduleDraw() {
  if (!renderer || frame) return;
  frame=requestAnimationFrame(()=>{
    frame=0;
    draw();
  });
}

function updateIdentity() {
  $('#character-name').value=current.name;
  $('#signature').textContent=current.name || '◆';
}

function choose(character) {
  current={...character,shape:[...character.shape]};
  generatedName=character.name;
  updateIdentity();
  renderRows();
  scheduleDraw();
}

function setOption(key,value) {
  current[key]=value;
  if (key==='face') current.shape=[...presets[value]];
  if (key==='profile') {
    current.hair=value ? 3 : 0;
    current.face=value ? 4 : 0;
    current.shape=[...presets[current.face]];
    current.beardStyle=0;
    current.suitStyle=value ? 3 : 0;
    current.neckwear=value ? 4 : 1;
    if (current.name===generatedName) current.name=generatedName=randomName(value);
    updateIdentity();
  }
  scheduleDraw();
}

function optionRow({label,value,prev,next}) {
  const row=document.createElement('div');
  row.className='row';
  const caption=document.createElement('span');
  caption.className='row-label';
  caption.textContent=label;
  const center=document.createElement('span');
  center.className='row-value';
  center.setAttribute('aria-live','polite');
  center.textContent=value;
  function arrow(direction,change) {
    const button=document.createElement('button');
    button.type='button';
    button.className='arrow';
    button.textContent=direction<0 ? '←' : '→';
    button.setAttribute('aria-label',(direction<0 ? 'Предыдущий вариант: ' : 'Следующий вариант: ')+label);
    button.addEventListener('click',()=>{
      change();
      renderRows();
      const updated=[...$('#appearance-controls').querySelectorAll('button')].find(item=>item.getAttribute('aria-label')===button.getAttribute('aria-label'));
      updated?.focus({preventScroll:true});
    });
    return button;
  }
  row.append(caption,arrow(-1,prev),center,arrow(1,next));
  return row;
}

function renderRows() {
  const container=$('#appearance-controls');
  container.replaceChildren();
  for (const key of categories[category][1]) {
    if (key.startsWith('shape-')) {
      const index=Number(key.slice(6)), value=current.shape[index];
      const change=step=>{
        const nearest=shapeSteps.reduce((best,v,i)=>Math.abs(v-value)<Math.abs(shapeSteps[best]-value)?i:best,4);
        current.shape[index]=shapeSteps[Math.min(8,Math.max(0,nearest+step))];
        current.face=-1;
        scheduleDraw();
      };
      container.append(optionRow({label:features[index],value:value===0?'Исходная':(value>0?'+':'')+Math.round(value*100)+'%',
        prev:()=>change(-1),next:()=>change(1)}));
      continue;
    }
    const choices=key==='hair'?(current.profile?[3,4,5]:[0,1,2]):options[key].map((_,i)=>i);
    const index=choices.indexOf(current[key]);
    const change=step=>setOption(key,choices[(Math.max(0,index)+step+choices.length)%choices.length]);
    container.append(optionRow({label:labels[key],value:options[key][current[key]]??'Настроено вручную',
      prev:()=>change(-1),next:()=>change(1)}));
  }
}

for (const [index,[name]] of categories.entries()) {
  const button=document.createElement('button');
  button.type='button';
  button.textContent=name;
  button.setAttribute('aria-pressed',String(index===0));
  button.addEventListener('click',()=>{
    category=index;
    for(const item of $('#categories').children) item.setAttribute('aria-pressed',String(item===button));
    renderRows();
  });
  $('#categories').append(button);
}

function randomCharacter(profile,face=Math.floor(Math.random()*presets.length)) {
  const random=max=>Math.floor(Math.random()*max);
  const age=random(3);
  const neckwear=profile ? [0,0,4,4,3][random(5)] : random(5);
  return {
    name:randomName(profile),profile,face,age,
    shape:presets[face].map(v=>Math.min(1,Math.max(-1,v+(Math.random()-.5)*.31))),
    skin:randomSkin(),hair:random(3)+3*profile,hairColor:age===2?3+random(2):random(4),
    beardStyle:profile?0:random(5),suitStyle:random(options.suitStyle.length),suit:random(6),
    neckwear,tie:random(6),glasses:random(3),mouthItem:randomMouthItem(),backdrop:random(backdropNames.length),
  };
}

function generateCabinet() {
  const faces=presets.map((_,index)=>index);
  const characters=Array.from({length:10},(_,i)=>
    randomCharacter(i%2,faces.splice(Math.floor(Math.random()*faces.length),1)[0]));
  const grid=$('#generated-portraits');
  grid.replaceChildren();
  for(const character of characters){
    draw(character);
    const thumb=document.createElement('canvas');
    thumb.width=160;
    thumb.height=200;
    thumb.getContext('2d').drawImage(portraitCanvas,0,0,160,200);
    const button=document.createElement('button');
    button.type='button';
    button.className='person generated-card';
    const title=document.createElement('span');
    title.textContent=character.name;
    button.append(thumb,title);
    button.addEventListener('click',()=>{
      choose(character);
      $('#character-gallery').close();
      status.textContent='Персонаж открыт для редактирования.';
    });
    grid.append(button);
  }
  draw();
  $('#gallery-title').textContent='Кабинет из 10 персонажей';
}

$('#character-name').addEventListener('input',event=>{
  current.name=latinCharacterName(event.target.value).slice(0,48);
  if(event.target.value!==current.name)event.target.value=current.name;
  $('#signature').textContent=current.name || '◆';
});
$('#random-one').addEventListener('click',()=>{
  choose(randomCharacter(current.profile));
  status.textContent='Создан случайный персонаж.';
});
$('#cabinet').addEventListener('click',()=>{
  if (!$('#generated-portraits').childElementCount) generateCabinet();
  $('#character-gallery').showModal();
});
$('#random-ten').addEventListener('click',generateCabinet);
$('#save').addEventListener('click',()=>{
  draw();
  const portrait=document.createElement('canvas');
  portrait.width=180;
  portrait.height=225;
  portrait.getContext('2d').drawImage(portraitCanvas,0,0,portrait.width,portrait.height);
  window.parent.postMessage({
    type:'campaign-leader',
    leader:{name:current.name.trim()||randomName(current.profile),portrait:portrait.toDataURL('image/png'),appearance:current},
  },location.origin);
});
$('#download').addEventListener('click',()=>{
  draw();
  const link=document.createElement('a');
  link.href=portraitCanvas.toDataURL('image/png');
  link.download=(current.name.trim().replace(/[<>:"/\\|?*]/g,'-')||'portrait')+'.png';
  document.body.append(link);
  link.click();
  link.remove();
});

choose(current);
try {
  const model=await createRenderer(meshCanvas);
  if (model.features.length!==features.length+2) throw Error('Версия модели не совпадает с редактором.');
  renderer=model;
  draw();
  $('#loading').hidden=true;
  for (const id of ['controls','download','random-one','cabinet','save']) $('#'+id).disabled=false;
} catch(error) {
  $('#loading').textContent=error.message||'Не удалось открыть редактор.';
}

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('#character-gallery').open)
    window.parent.postMessage({type:'cancel-campaign-leader'},location.origin);
});

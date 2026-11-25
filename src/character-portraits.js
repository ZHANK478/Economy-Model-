import {characterSkinTone} from './character-demographics.js';
import {hash} from './political-config.js';
import {palette,presets,renderShape} from '../leader-editor/workshop-appearance.js';

let rendererPromise, meshCanvas, portraitCanvas, context;
const images=new Map();

function appearance(person){
  if(person.appearance)return person.appearance;
  const pick=(key,size)=>Math.floor(hash(person.appearanceSeed,key)*size);
  const {profile}=person;
  const age=person.age>=60?2:person.age>=36?1:0;
  const shape=presets[pick('face',presets.length)].map((value,i)=>
    Math.min(1,Math.max(-1,value+(hash(person.appearanceSeed,'feature',i)-.5)*.34))
  );
  return {
    profile,age,shape,skin:person.skinTone??characterSkinTone(person.ethnicity,hash(person.appearanceSeed,'skin')),hair:3*profile+pick('hair',3),
    hairColor:age===2?3+pick('grey',2):pick('hairColor',5),
    beardStyle:profile?0:pick('beard',5),suitStyle:profile?3:pick('cut',3),
    suit:pick('suit',5),neckwear:profile?[0,4][pick('neckwear',2)]:1+pick('neckwear',2),
    tie:pick('tie',6),glasses:pick('glasses',3),mouthItem:0,
  };
}

async function loadRenderer(){
  const {createRenderer}=await import('../leader-editor/workshop-renderer.js');
  meshCanvas=document.createElement('canvas');
  portraitCanvas=document.createElement('canvas');
  for(const canvas of [meshCanvas,portraitCanvas]){
    canvas.width=160;
    canvas.height=200;
  }
  context=portraitCanvas.getContext('2d');
  return createRenderer(meshCanvas);
}

function renderPortrait(renderer,config){
  const backdrop=context.createRadialGradient(76,60,8,80,105,134);
  backdrop.addColorStop(0,'#717171');
  backdrop.addColorStop(1,'#414141');
  context.fillStyle=backdrop;
  context.fillRect(0,0,160,200);
  renderer.draw({...config,shape:renderShape(config)},palette(config));
  context.drawImage(meshCanvas,0,0);
  return portraitCanvas.toDataURL('image/webp',.87);
}

export async function fillCharacterPortraits(root,people){
  const portraits=[...root.querySelectorAll('[data-character-portrait]')];
  if(!portraits.length)return;
  try{
    const renderer=await (rendererPromise??=loadRenderer());
    for(const img of portraits){
      if(!img.isConnected)continue;
      const person=people.get(img.dataset.characterPortrait);
      if(!person)continue;
      const config=appearance(person);
      const key=JSON.stringify(config);
      if(!images.has(key)){
        if(images.size>=96)images.delete(images.keys().next().value);
        images.set(key,renderPortrait(renderer,config));
        await new Promise(requestAnimationFrame);
      }
      if(img.isConnected){img.src=images.get(key);img.hidden=false;}
    }
  }catch(error){
    console.warn('Не удалось отрисовать портреты персонажей',error);
  }
}

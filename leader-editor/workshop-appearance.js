const colors = {
  hairColor:[[.035,.026,.021],[.112,.057,.029],[.23,.15,.088],[.39,.37,.33],[.18,.163,.142]],
  skin:[[.51,.327,.235],[.46,.257,.157],[.30,.152,.084],[.18,.080,.037]],
  suit:[[.055,.054,.050],[.028,.044,.080],[.075,.046,.028],[.040,.064,.046],[.099,.028,.044],[.17,.145,.115]],
  tie:[[.22,.038,.034],[.039,.073,.132],[.185,.103,.031],[.071,.104,.048],[.119,.046,.123],[.66,.57,.42]],
};
export const faceFeatures=['Ширина челюсти','Скулы','Форма носа','Длина лица','Надбровья','Ширина рта',
  'Расстояние между глазами','Наклон глаз','Ширина подбородка','Выступ переносицы'];
const faceTypes=[
  ['Классическое',[0,0,0,0,0,0]],
  ['Квадратная челюсть',[.88,.31,-.24,-.37,.47,.32]],
  ['Узкое лицо',[-.78,-.59,.53,.37,.13,-.24]],
  ['Выраженные скулы',[.12,.88,-.19,-.10,-.17,.12]],
  ['Мягкие черты',[-.43,.17,-.57,-.42,-.45,.31]],
  ['Длинное лицо',[-.19,-.22,.71,.83,.54,-.36]],
  ['Круглое лицо',[.61,-.61,-.76,-.91,-.64,.31,.53,-.48,-.42,-.66]],
  ['Широкий подбородок',[.94,-.28,.17,-.19,.68,-.34,-.71,.28,.91,.38]],
  ['Лицо сердцем',[-.83,.80,-.26,-.24,-.49,.48,.71,.51,-.87,-.30]],
  ['Тяжёлые надбровья',[.47,.37,.41,.24,.98,.28,-.53,-.75,.66,.72]],
  ['Близко посаженные глаза',[-.31,-.12,.58,.72,.25,-.48,-.96,.39,-.45,.63]],
  ['Широко посаженные глаза',[.25,.72,-.49,-.52,-.49,.72,.94,-.22,.35,-.36]],
  ['Выступающая переносица',[-.48,.22,.95,.49,.32,-.49,-.22,.24,.44,.93]],
  ['Прямой подбородок',[.78,-.52,-.34,.59,-.39,.56,.38,-.69,.93,-.66]],
  ['Высокие скулы и узкий подбородок',[-.70,.98,.55,.77,.27,-.21,.56,.65,-.94,.55]],
  ['Широкое лицо и короткий нос',[.83,.56,-.88,-.82,.63,.77,.11,.61,.48,-.78]],
  ['Овальное лицо',[-.62,-.37,.28,.45,-.66,.06,.16,-.78,-.14,.34]],
  ['Узкая челюсть и широкий рот',[-.89,.54,-.49,.11,.51,.91,-.57,.78,-.71,-.26]],
];
export const faceNames=faceTypes.map(([name])=>name);
export const presets=faceTypes.map(([,shape])=>Array.from({length:faceFeatures.length},(_,i)=>shape[i]??0));

export function renderShape({shape,profile,age}){
  return [...shape.slice(0,6),profile,age*.5,...shape.slice(6)];
}

export function palette(character) {
  const skin=colors.skin[character.skin], hair=colors.hairColor[character.hairColor];
  const suit=colors.suit[character.suit], tie=colors.tie[character.tie];
  return {
    skin,hair,suit,tie,lip:skin.map((c,i)=>c*(character.profile?[.94,.56,.59]:[.81,.63,.61])[i]),
    brows:hair.map(c=>c*.64),beard:hair.map(c=>c*.85),beardGlint:hair.map(c=>c*1.13),
    crease:skin.map(c=>c*.80),vest:suit.map(c=>c*1.44+.023),
  };
}


const appearanceLimits={profile:1,age:2,skin:3,hair:5,hairColor:4,beardStyle:4,suitStyle:6,suit:5,neckwear:4,tie:5,glasses:2};

export function savedAppearance(value){
  if(!Array.isArray(value?.shape)||![6,faceFeatures.length].includes(value.shape.length)||value.shape.some(n=>!Number.isFinite(n)||Math.abs(n)>1))return null;
  const appearance={shape:[...value.shape],mouthItem:0};
  for(const [field,max] of Object.entries(appearanceLimits)){
    const index=value[field];
    if(!Number.isInteger(index)||index<0||index>max)return null;
    appearance[field]=index;
  }
  return appearance;
}

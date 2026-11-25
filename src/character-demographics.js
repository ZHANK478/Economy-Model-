import {hash} from './political-config.js';

// UK Census, April 2001, using counts to avoid rounding the published shares.
// These categories weight portrait generation. They do not drive game outcomes.
const populations={
  'uk-2000':{total:58789194,groups:[
    ['white',54153898],['mixed',677117],['asian',2331423],
    ['black',1148738],['chinese',247403],['other',230615],
  ]},
  // U.S. Census 2000, race alone and two or more races (rounded).
  usa:{total:1000,groups:[['white',751],['black',123],['asian',36],['mixed',24]]},
  // Statistics South Africa, Census 2001, national population groups.
  'south-africa':{total:1000,groups:[['black',790],['white',96],['mixed',89],['asian',25]]},
};
const portraitTones={
  white:[0,0,1,1,1,2],mixed:[0,1,1,2,2,3],asian:[1,1,2,2,2,3],
  black:[2,3,3,3],chinese:[0,1,1,1,2],other:[0,1,2,2,3],
};

export function characterEthnicity(draw,scenario='uk-2000'){
  const population=populations[scenario];
  if(!population)return null;
  let remaining=draw*population.total;
  for(const [group,count] of population.groups){
    remaining-=count;
    if(remaining<0)return group;
  }
  return 'other';
}

export function britishCharacterEthnicity(seed,id,parentId){
  const origin=parentId&&hash(seed,id,'shared-ancestry')<.8?parentId:id;
  return characterEthnicity(hash(seed,origin,'ancestry'));
}

export function characterSkinTone(ethnicity,draw){
  const tones=portraitTones[ethnicity]??[0,1,2,3];
  return tones[Math.floor(draw*tones.length)];
}

// Where the game's foreign profiles have no census calibration, keep their
// portrait palette broad and avoid pretending to have national population shares.
const foreignPortraitTones={
  russia:[0,1,1,2],china:[0,1,1,2],france:[0,1,1,2,2,3],germany:[0,1,1,2,2,3],
  iran:[1,1,2,2,3],india:[1,2,2,3,3],australia:[0,1,1,2,2,3],japan:[0,1,1,2],
  canada:[0,1,1,2,2,3],italy:[0,1,1,2,2,3],
};

export function foreignSkinTone(seed,id,country){
  const group=characterEthnicity(hash(seed,id,'ancestry'),country);
  const draw=hash(seed,id,'skin');
  const tones=foreignPortraitTones[country];
  return tones?tones[Math.floor(draw*tones.length)]:characterSkinTone(group,draw);
}

import {hash} from './political-config.js';
// Fictional British names: independently sampled first and family names.
// The saved salt keeps names stable through reload, export and journal replay.
export const FIRST_NAMES=['Oliver','George','Arthur','Noah','Harry','Leo','Oscar','Jack','Henry','Charlie','Freddie','Theodore','Thomas','William','Edward','James','Alexander','Daniel','Samuel','Joseph','Benjamin','Jacob','Lucas','Ethan','Alfie','Amelia','Olivia','Isla','Ava','Lily','Sophia','Grace','Freya','Florence','Emily','Ella','Charlotte','Alice','Rosie','Evelyn','Isabelle','Poppy','Matilda','Elizabeth','Victoria','Eleanor','Lucy','Harriet','Clara','Sophie'];
export const SURNAMES=['Smith','Jones','Taylor','Brown','Williams','Wilson','Johnson','Davies','Robinson','Wright','Thompson','Evans','Walker','White','Roberts','Green','Hall','Wood','Jackson','Clarke','Harris','Edwards','Turner','Martin','Cooper','Hill','Ward','Hughes','Moore','Clark','King','Harrison','Lewis','Baker','Lee','Allen','Morris','Scott','Watson','Davis','Parker','James','Bennett','Young','Phillips','Richardson','Mitchell','Bailey','Carter','Collins'];
export function leaderName(seed,key,used=new Set()){
 for(let attempt=0;attempt<2500;attempt++){
  const first=FIRST_NAMES[Math.floor(hash(seed,key,'first',attempt)*FIRST_NAMES.length)];
  const last=SURNAMES[Math.floor(hash(seed,key,'last',attempt)*SURNAMES.length)];
  const name=first+' '+last;if(!used.has(name))return name;
 }
 throw new Error('Исчерпаны сочетания имён');
}

const MEN=[...FIRST_NAMES.slice(0,25),'Andrew','Anthony','Bernard','Brian','Charles','Christopher','David','Douglas','Edmund','Francis','Gareth','Graham','Hugh','Ian','John','Kenneth','Malcolm','Martin','Michael','Nicholas','Patrick','Peter','Richard','Robert','Stephen'];
const WOMEN=[...FIRST_NAMES.slice(25),'Agnes','Angela','Anne','Audrey','Barbara','Beatrice','Bridget','Catherine','Christine','Diana','Dorothy','Edith','Fiona','Frances','Helen','Jane','Janet','Joan','Judith','Margaret','Mary','Moira','Patricia','Ruth','Susan'];
export const BRITISH_FIRST_NAMES=[...MEN,...WOMEN];
export const BRITISH_SURNAMES=[...SURNAMES,'Adams','Alexander','Anderson','Armstrong','Atkinson','Bell','Black','Booth','Brooks','Campbell','Chapman','Cook','Cox','Duncan','Ellis','Ferguson','Fisher','Fletcher','Ford','Foster','Fox','Fraser','Gibson','Gordon','Graham','Grant','Gray','Griffiths','Hamilton','Harper','Henderson','Holmes','Howard','Kennedy','Lawson','Marshall','McDonald','Murray','Owen','Palmer','Powell','Price','Reid','Russell','Shaw','Simpson','Stewart','Sutton','Webb','Whitmore'];

export function britishName(seed,key,profile,used=new Set()){
 const names=profile===1?WOMEN:MEN;
 for(let attempt=0;attempt<names.length*BRITISH_SURNAMES.length;attempt++){
  const first=names[Math.floor(hash(seed,key,'given',attempt)*names.length)];
  const last=BRITISH_SURNAMES[Math.floor(hash(seed,key,'surname',attempt)*BRITISH_SURNAMES.length)];
  const name=first+' '+last;
  if(!used.has(name))return name;
 }
 throw new Error('Исчерпаны сочетания британских имён');
}

export const britishNameProfile=name=>Number(WOMEN.includes(name?.split(' ')[0]));

const cyrillicLatin=['a','b','v','g','d','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','kh','ts','ch','sh','shch','','y','','e','yu','ya'];
const legacyNames=new Map([
 ['Эдвард Харпер','Edward Harper'],['Элеонора Харпер','Eleanor Harper'],
 ['Артур Беннетт','Arthur Bennett'],['Генри Уитмор','Henry Whitmore'],
 ['Джеймс Эллис','James Ellis'],['Роберт Грей','Robert Grey'],
 ['Маргарет Беннетт','Margaret Bennett'],['Эдит Уитмор','Edith Whitmore'],
 ['Элизабет Эллис','Elizabeth Ellis'],['Беатрис Грей','Beatrice Grey'],
]);
export function latinCharacterName(name){
 return legacyNames.get(name)??name.replace(/[а-яё]/giu,letter=>{
  const lower=letter.toLowerCase();
  const text=lower==='ё'?'yo':cyrillicLatin[lower.charCodeAt(0)-1072];
  return letter===lower?text:text.charAt(0).toUpperCase()+text.slice(1);
 });
}

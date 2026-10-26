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

import {hash} from './political-config.js';

const terms=[
  [1999,9,'Romano Prodi',1939,8,0],
  [2004,11,'José Manuel Barroso',1956,3,0],
  [2014,11,'Jean-Claude Juncker',1954,12,0],
  [2019,12,'Ursula von der Leyen',1958,10,1],
];

export function commissionPresident(s){
  if(s.scenario?.id!=='uk-2000')return null;
  const calendar=(s.startYear??2000)*12+s.month;
  const [year,month,name,birthYear,birthMonth,profile]=terms.findLast(([y,m])=>calendar>=y*12+m-1)??terms[0];
  const id='commission-president-'+year;
  return {id,name,profile,age:Math.floor((calendar-birthYear*12-birthMonth+1)/12),
    role:'Председатель Европейской комиссии',referenceId:'eu',affiliation:'Европейская комиссия',
    appearanceSeed:hash(s.seed,id,'portrait'),diedMonth:null,roles:[],history:[],relatives:[]};
}

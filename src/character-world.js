import {britishName,britishNameProfile} from './leader-names.js';
import {hash} from './political-config.js';
import {integerVotes} from './elections.js';

export const MINISTRIES={
  treasury:'Министр финансов',foreign:'Министр иностранных дел',home:'Министр внутренних дел',
  health:'Министр здравоохранения',education:'Министр образования',defence:'Министр обороны',
  agriculture:'Министр сельского хозяйства',justice:'Министр юстиции',
  labour:'Министр занятости и социальной защиты',industry:'Министр торговли и промышленности',
};
export const COURT_ORIGINS=[
  {id:'england-wales',label:'Англия и Уэльс',color:'#bd564d',seats:8},
  {id:'scotland',label:'Шотландия',color:'#d9ad51',seats:3},
  {id:'northern-ireland',label:'Северная Ирландия',color:'#5faecb',seats:1},
];

const portfolioKeys=Object.keys(MINISTRIES);
const originalPortfolios=portfolioKeys.filter(office=>office!=='labour'&&office!=='industry');
export const ministryTitle=(state,office)=>office==='justice'&&(state.startYear??2000)+Math.floor(state.month/12)<2007?
  'Лорд-канцлер':MINISTRIES[office];
const hasCharacters=s=>s.scenario?.id==='uk-2000'&&Boolean(s.politics?.parliamentary);
const represented=s=>s.politics.parties.filter(p=>p.seats>0&&!p.independent).sort((a,b)=>b.seats-a.seats);
export const characterAge=(person,month)=>Math.floor(((person.diedMonth??month)-person.birthMonth)/12);
export const currentCharacter=s=>s.characters?.people[s.characters.leaders[s.politics.executive.playerParty]];

export function characterPlayerIdentity(value){
  const name=typeof value?.name==='string'?value.name.trim().slice(0,48):'';
  return name?{name,profile:value.profile===1?1:0,age:[0,1,2].includes(value.age)?value.age:1}:null;
}

function newPerson(s,used,{name,profile,age,partyId=null,originId=null,relation=null}={}){
  const world=s.characters,id='person-'+world.nextId++;
  const roll=key=>hash(world.seed,id,key);
  profile??=name?britishNameProfile(name):Number(roll('profile')<.45);
  if(!name||used.has(name))name=britishName(world.seed,id,profile,used);
  used.add(name);
  age??=originId?58+Math.floor(roll('age')*14):34+Math.floor(roll('age')*27);
  const birthMonth=s.month-age*12-Math.floor(roll('birthday')*12);
  // Conditional survival from the character's current age, with mortality
  // increasing with age. This is a gameplay assumption, independent of GDP.
  const rate=Math.LN2/8,base=.005/rate,years=-Math.log1p(-roll('longevity'));
  const deathAge=55+Math.log(Math.exp(rate*((s.month-birthMonth)/12-55))+years/base)/rate;
  const deathMonth=Math.max(s.month+1,birthMonth+Math.min(106*12,Math.ceil(deathAge*12)));
  const wealth=Math.round((25+age*1.4)*Math.exp(roll('wealth')*2.9));
  return world.people[id]={id,name,profile,birthMonth,deathMonth,diedMonth:null,wealth,partyId,originId,relation,history:[]};
}

function createFamily(s,person,used){
  const make=(kind,age,profile)=>newPerson(s,used,{age,profile,relation:{kind,personId:person.id}});
  const roll=key=>hash(s.characters.seed,person.id,'family',key);
  const age=characterAge(person,s.month);
  if(roll('partner')<.82)make('partner',Math.max(21,age-7+Math.floor(roll('partner-age')*14)),1-person.profile);
  const adultChildren=age>=38?1+Math.floor(roll('children')*3):0;
  for(let i=0;i<adultChildren;i++)make('child',18+Math.floor(roll('child-age-'+i)*(age-36)));
  if(age<63||adultChildren===0)make('sibling',Math.max(18,age-7+Math.floor(roll('sibling-age')*15)));
}

function fillLeadership(s,used,initialPlayer,events){
  const {people,leaders,deputies}=s.characters;
  const own=s.politics.executive.playerParty;
  const playerParty=s.politics.parties.find(p=>p.id===own);
  const parties=represented(s);
  const governing=s.politics.parties.find(p=>p.id===s.politics.executive.primeMinisterParty);
  const oldPlayer=people[leaders[s.characters.playerParty]];
  if(s.characters.playerParty!==own&&oldPlayer?.diedMonth===null){
    delete leaders[s.characters.playerParty];
    leaders[own]=oldPlayer.id;
    oldPlayer.partyId=own;
  }
  s.characters.playerParty=own;
  if(governing&&!parties.includes(governing))parties.push(governing);
  if(playerParty){
    const index=parties.indexOf(playerParty);
    if(index>=0)parties.splice(index,1);
    parties.unshift(playerParty);
  }
  for(const party of parties){
    const previous=people[leaders[party.id]];
    if(previous&&previous.diedMonth===null)continue;
    const custom=party.id===own?initialPlayer:null;
    const person=newPerson(s,used,{name:custom?.name??(!previous?party.leader:null),
      profile:custom?.profile,age:custom?[34,48,65][custom.age]:undefined,partyId:party.id});
    leaders[party.id]=person.id;
    if(party.id===own){
      s.characters.originalPlayerId??=person.id;
      createFamily(s,person,used);
    }
    if(previous)events.push(`${party.id===own?'Смена вашего персонажа':'Смена лидера партии'}: ${person.name} возглавляет партию после смерти ${previous.name}.`);
  }
  for(const party of represented(s).filter(p=>p.deputies?.length).slice(0,3)){
    const key=party.id+'-'+party.deputies[0].id;
    if(!people[deputies[key]]||people[deputies[key]].diedMonth!==null){
      deputies[key]=newPerson(s,used,{partyId:party.id}).id;
    }
  }
}

function recordAppointment(s,person,office){
  person.history.push({office,from:s.month,to:null});
}

function endAppointment(s,person,office){
  const term=person?.history.findLast(item=>item.office===office&&item.to===null);
  if(term)term.to=s.month;
}

function updateCourt(s,used,events){
  const {people,judges}=s.characters;
  for(const origin of COURT_ORIGINS)for(let slot=0;slot<origin.seats;slot++){
    const key=origin.id+'-'+slot;
    const previous=people[judges[key]];
    if(previous?.diedMonth===null&&characterAge(previous,s.month)<75)continue;
    endAppointment(s,previous,'judge');
    const judge=newPerson(s,used,{originId:origin.id});
    judges[key]=judge.id;
    recordAppointment(s,judge,'judge');
    if(previous)events.push(`Назначение в суд: ${judge.name} занимает место ${previous.name}.`);
  }
}

function updateCabinet(s,used){
  const p=s.politics,q=p.parliamentary,w=s.characters;
  const forming=q.phase==='forming';
  if(forming&&!q.history.length&&!Object.keys(w.cabinet).length)return;
  const governing=p.parties.find(x=>x.id===p.executive.primeMinisterParty);
  if(!governing)return;
  const parties=[governing,...p.parties.filter(x=>x!==governing&&p.coalition.includes(x.id))];
  const offices=p.ministerialBriefings?portfolioKeys:originalPortfolios;
  const weights=parties.map(x=>x.cabinetPosts??0);
  const counts=weights.some(Boolean)?integerVotes(weights,offices.length):[offices.length];
  const quota=new Map(parties.map((party,i)=>[party.id,counts[i]??0]));
  const cabinet={premier:w.leaders[governing.id]};
  const taken=new Set([cabinet.premier]);
  const keep=(office,id)=>{cabinet[office]=id;taken.add(id);};
  for(const office of offices){
    const incumbent=w.people[w.cabinet[office]];
    if(incumbent?.diedMonth===null&&!taken.has(incumbent.id)&&(forming||quota.get(incumbent.partyId)>0)){
      keep(office,incumbent.id);
      quota.set(incumbent.partyId,(quota.get(incumbent.partyId)??0)-1);
    }
  }
  const vacancies=offices.filter(office=>!cabinet[office]);
  if(p.ministerialBriefings)vacancies.sort((a,b)=>
    hash(w.seed,'portfolio',governing.id,a)-hash(w.seed,'portfolio',governing.id,b));
  for(const office of vacancies){
    const outgoing=w.people[w.cabinet[office]];
    const partyId=forming&&outgoing?outgoing.partyId:parties.find(party=>quota.get(party.id)>0)?.id??governing.id;
    const party=p.parties.find(party=>party.id===partyId);
    const deputyId=party?.deputies?.[0]?.id;
    const deputy=w.people[w.deputies[partyId+'-'+deputyId]];
    const available=person=>person.partyId===partyId&&person.diedMonth===null&&!taken.has(person.id)&&person.id!==w.leaders[partyId];
    const former=Object.values(w.people).find(person=>available(person)&&person.history.some(term=>term.office===office));
    const member=former??(deputy&&available(deputy)?deputy:newPerson(s,used,{partyId}));
    keep(office,member.id);
    quota.set(partyId,(quota.get(partyId)??0)-1);
  }
  for(const [office,id] of Object.entries(cabinet)){
    if(w.cabinet[office]===id)continue;
    endAppointment(s,w.people[w.cabinet[office]],office);
    recordAppointment(s,w.people[id],office);
  }
  w.cabinet=cabinet;
}

export function synchronizeCharacters(s,events=[],initialPlayer=null){
  const world=s.characters;
  if(!world)return;
  for(const person of Object.values(world.people)){
    if(person.diedMonth===null&&person.deathMonth<=s.month){
      person.diedMonth=person.deathMonth;
      events.push(`Смерть персонажа: ${person.name} · ${characterAge(person,s.month)} лет.`);
    }
  }
  const used=new Set(Object.values(world.people).map(p=>p.name));
  fillLeadership(s,used,initialPlayer,events);
  updateCourt(s,used,events);
  updateCabinet(s,used);
}

export function initializeCharacters(s,identity=null){
  if(!hasCharacters(s)||s.characters)return;
  s.characters={version:1,seed:s.politics.characterSeed??s.politics.nameSeed??s.seed,
    nextId:1,originalPlayerId:null,playerParty:s.politics.executive.playerParty,people:{},leaders:{},deputies:{},judges:{},cabinet:{}};
  synchronizeCharacters(s,[],characterPlayerIdentity(identity));
}

export function validateCharacters(s){
  const w=s.characters;
  if(w===undefined)return;
  const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const valid=w&&w.version===1&&Number.isFinite(w.seed)&&Number.isSafeInteger(w.nextId)&&w.nextId>0
    &&[w.people,w.leaders,w.deputies,w.judges,w.cabinet].every(record);
  if(!valid)throw new Error('Повреждён реестр персонажей');
  const people=Object.values(w.people);
  const offices=new Set(['premier','judge',...portfolioKeys]);
  const month=x=>Number.isSafeInteger(x)&&x>=0&&x<=s.month;
  if(people.some(p=>!p||!/^person-[1-9]\d*$/.test(p.id)||w.people[p.id]!==p
    ||Number(p.id.slice(7))>=w.nextId||typeof p.name!=='string'||!p.name||p.name.length>64
    ||![0,1].includes(p.profile)||!Number.isSafeInteger(p.birthMonth)||p.birthMonth>s.month
    ||!Number.isSafeInteger(p.deathMonth)||p.deathMonth<=p.birthMonth
    ||(p.diedMonth===null?p.deathMonth<=s.month:!month(p.diedMonth)||p.diedMonth!==p.deathMonth)
    ||!Number.isSafeInteger(p.wealth)||p.wealth<0
    ||(p.relation&&(!['partner','child','sibling'].includes(p.relation.kind)||!Object.hasOwn(w.people,p.relation.personId)))
    ||!Array.isArray(p.history)||p.history.some(term=>!term||!offices.has(term.office)||!month(term.from)
      ||term.to!==null&&(!month(term.to)||term.to<term.from)))
    ||[w.leaders,w.deputies,w.judges,w.cabinet].some(map=>Object.values(map).some(id=>!Object.hasOwn(w.people,id)))
    ||(w.originalPlayerId!==null&&!Object.hasOwn(w.people,w.originalPlayerId))){
    throw new Error('Повреждены данные персонажей или назначений');
  }
}

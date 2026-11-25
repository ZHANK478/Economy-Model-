import {commissionPresident} from './european-commission.js';
import {UK_CODEX_PEOPLE} from './codex-uk-reference.js';
import {codexOrganizations,organizationRepresentative} from './codex-organizations.js';
import {CODEX_COUNTRIES,foreignLeader} from './codex-locations.js';
import {britishName,latinCharacterName} from './leader-names.js';
import {britishCharacterEthnicity} from './character-demographics.js';
import {characterWealth} from './character-wealth.js';
import {SOCIAL_FACTIONS} from './social-factions.js';
import {characterAge,COURT_ORIGINS,currentCharacter,MINISTRIES,ministryTitle} from './character-world.js';
import {hash,partyDisplayName} from './political-config.js';
import {partyColor} from './game-charts.js';
import {esc} from './atlas-interface.js';

export {COURT_ORIGINS};
const PREMIER='Премьер-министр';
const relativeTitle=person=>({
  partner:person.profile?'Супруга':'Супруг',child:person.profile?'Дочь':'Сын',sibling:person.profile?'Сестра':'Брат',
})[person.relation?.kind];

function britishOfficial(seed,id,profile,age,wealthRole,used,parentId){
  const name=britishName(seed,id,profile,used);
  used.add(name);
  return {id,profile,name,age,diedMonth:null,ethnicity:britishCharacterEthnicity(seed,id,parentId),
    wealth:characterWealth(seed,id,wealthRole,age),appearanceSeed:hash(seed,id,'portrait'),
    roles:[],section:null,relatives:[],history:[]};
}

const britishOffices={
  'uk-speaker':['Спикер Палаты общин','parliament'],
  'uk-chief-whip':['Главный парламентский организатор правительства','parliament'],
  'uk-bank-governor':['Управляющий Банком Англии','state-figures'],
  'uk-auditor':['Генеральный контролёр и аудитор','state-figures'],
};

export function britishOfficeHolder(state,id,used=new Set()){
  const [role,section]=britishOffices[id];
  const seed=state.characters?.seed??state.seed;
  const person=britishOfficial(seed,id,Number(hash(seed,id,'profile')<.5),
    45+Math.floor(hash(seed,id,'age')*17),'official',used);
  const party=id==='uk-chief-whip'?state.politics.parties.find(p=>p.id===state.politics.executive.primeMinisterParty):null;
  return {...person,role,section,affiliation:party?partyDisplayName(party):'Беспартийная должность'};
}

export function personBriefing(person,role,affiliation){
  if(!person)return '';
  return `<div class="person-briefing">${characterPortrait(person)}<div><strong>${esc(person.name)}</strong>
    <small>${esc(role??person.role??'')}</small><small>${esc(affiliation??person.affiliation??'Беспартийный')}</small></div></div>`;
}

function britishCourt(seed){
  const used=new Set();
  const id='uk-monarch';
  const profile=Number(hash(seed,id,'profile')<.5);
  const age=49+Math.floor(hash(seed,id,'age')*23);
  const monarch=britishOfficial(seed,id,profile,age,'monarch',used);
  monarch.name=monarch.name.split(' ')[0];
  monarch.role=profile?'Королева Великобритании':'Король Великобритании';
  const consort=britishOfficial(seed,'uk-consort',1-profile,age-3,'consort',used);
  consort.role=profile?'Принц-консорт':'Королева-консорт';
  const heirProfile=Number(hash(seed,'uk-heir','profile')<.5);
  const heir=britishOfficial(seed,'uk-heir',heirProfile,age-24,'heir',used,id);
  heir.role=heirProfile?'Первая в очереди на престол':'Первый в очереди на престол';
  const secretaryId='uk-royal-secretary';
  const secretary=britishOfficial(seed,secretaryId,Number(hash(seed,secretaryId,'profile')<.5),
    45+Math.floor(hash(seed,secretaryId,'age')*18),'official',used);
  secretary.role='Личный секретарь монарха';
  return [monarch,consort,heir,secretary];
}

export function territorialCharacter(state,person){
  const party=state.politics.parties.find(p=>p.id===person.partyId);
  const role=person.city?'Мэр':'Глава региона';
  const diedMonth=person.deathMonth<=state.month?person.deathMonth:null;
  return {...person,role,roles:[role],section:'state-figures',diedMonth,
    age:Math.floor(((diedMonth??state.month)-person.birthMonth)/12),
    affiliation:party?partyDisplayName(party):null,color:party?(party.color??partyColor(party)):null,
    ethnicity:britishCharacterEthnicity(state.seed,person.id),
    appearanceSeed:hash(state.seed,person.id,'portrait'),
    wealth:characterWealth(state.seed,person.id,'politician',Math.floor((person.from-person.birthMonth)/12)),
    relatives:[],history:[{title:role,from:person.from,to:person.to}]};
}

export function characterRoster(state,player,{includeOrganizations=false}={}){
  const sections={family:[],cabinet:[],'party-leaders':[],parliament:[],'state-figures':[],'social-factions':[],business:[],'foreign-leaders':[],judiciary:[],'former-premiers':[],'other-characters':[]};
  const people=new Map(),world=state?.characters;
  function addForeignLeaders(seed){
    const president=commissionPresident(state);
    if(president){people.set(president.id,president);add('foreign-leaders',president.id,president.role);}
    for(const country of CODEX_COUNTRIES){
      if(country.id===state.scenario?.countryId)continue;
      const person=foreignLeader(country,seed);
      people.set(person.id,person);
      add('foreign-leaders',person.id,country.role);
    }
  }
  for(const office of Object.values(state?.territorialGovernment?.offices??{})){
    const person=state.territorialGovernment.people[office.personId];
    if(person)people.set(person.id,territorialCharacter(state,person));
  }
  if(!world){
    if(includeOrganizations&&state)addForeignLeaders(state.seed);
    const organizations=includeOrganizations&&state?codexOrganizations(state):[];
    return {sections,people,cabinet:[],proposedCabinet:false,caretaker:false,organizations,organizationSeed:state?.seed};
  }
  const politics=state.politics,forming=politics.parliamentary.phase==='forming';
  const proposedCabinet=forming&&!Object.keys(world.cabinet).length;
  const primeMinister=world.cabinet.premier;
  const parties=new Map(politics.parties.map(p=>[p.id,p]));
  const origins=new Map(COURT_ORIGINS.map(o=>[o.id,o]));
  const playerId=currentCharacter(state)?.id;
  const deputyIds=new Set(Object.values(world.deputies));
  for(const person of Object.values(world.people)){
    const party=parties.get(person.partyId),origin=origins.get(person.originId);
    const judgeTitle='Судья';
    const age=characterAge(person,state.month);
    const wealthRole=person.relation?.kind??(person.originId?'judge':'politician');
    // Fixed campaign reference age keeps the same wealth between appointments and after reload.
    const wealthAge=Math.max(18,Math.floor(-person.birthMonth/12));
    const parentId=person.relation?.kind==='child'||person.relation?.kind==='sibling'?person.relation.personId:null;
    people.set(person.id,{...person,name:latinCharacterName(person.name),age,roles:[],section:null,judgeTitle,
      wealth:characterWealth(world.seed,person.id,wealthRole,wealthAge),
      ethnicity:britishCharacterEthnicity(world.seed,person.id,parentId),
      affiliation:origin?.label??(party?partyDisplayName(party):null),color:origin?.color??(party?partyColor(party):null),
      appearanceSeed:hash(world.seed,person.id,'portrait'),
      appearance:person.id===world.originalPlayerId?player?.appearance:undefined,
      history:person.history.map(term=>({...term,title:term.office==='judge'?judgeTitle:term.office==='premier'?PREMIER:MINISTRIES[term.office]})),
    });
  }
  function add(section,id,role){
    const person=people.get(id);
    if(!person)return;
    person.section??=section;
    if(!person.roles.includes(role))person.roles.push(role);
    sections[section].push({...person,role});
  }
  if(proposedCabinet)add('cabinet',playerId,'Кандидат на пост премьер-министра');
  else{
    add('cabinet',primeMinister,forming?'Исполняет обязанности премьер-министра':PREMIER);
    for(const office of Object.keys(MINISTRIES))add('cabinet',world.cabinet[office],ministryTitle(state,office));
  }
  const cabinet=sections.cabinet.slice();
  const represented=politics.parties.filter(p=>p.seats>0&&!p.independent).sort((a,b)=>b.seats-a.seats);
  for(const party of represented)add('party-leaders',world.leaders[party.id],'Лидер партии');
  for(const party of represented){
    const deputy=people.get(world.deputies[party.id+'-'+party.deputies?.[0]?.id]);
    if(deputy?.section==='cabinet')deputy.roles.push('Депутат Палаты общин');
  }
  const factionNames=new Set();
  const factions=(SOCIAL_FACTIONS[state.scenario?.id]??[]).map(faction=>{
    const id='faction-'+faction.id;
    const profile=Number(hash(world.seed,id,'profile')<.45);
    const name=britishName(world.seed,id,profile,factionNames);
    factionNames.add(name);
    const age=45+Math.floor(hash(world.seed,id,'age')*18);
    people.set(id,{id,name,profile,age,diedMonth:null,ethnicity:britishCharacterEthnicity(world.seed,id),
      wealth:characterWealth(world.seed,id,'civic',age),roles:[],section:null,
      appearanceSeed:hash(world.seed,id,'portrait'),factionId:faction.id,affiliation:faction.name,color:faction.color,
      relatives:[],history:[]});
    add('social-factions',id,faction.role);
    return {...faction,representative:sections['social-factions'].at(-1)};
  });
  for(const id of Object.values(world.judges))add('judiciary',id,people.get(id)?.judgeTitle);
  const relatives=new Map();
  for(const person of people.values()){
    if(!person.relation)continue;
    add('family',person.id,relativeTitle(person));
    const related=relatives.get(person.relation.personId)??[];
    related.push(person.id);
    relatives.set(person.relation.personId,related);
  }
  for(const person of people.values()){
    person.relatives=(relatives.get(person.id)??[]).map(id=>people.get(id));
    person.relatedPerson=people.get(person.relation?.personId);
    if(person.history.some(term=>term.office==='premier'&&term.to!==null)&&person.id!==primeMinister){
      add('former-premiers',person.id,'Бывший премьер-министр');
    }
    if(person.section)continue;
    const last=person.history.at(-1);
    if(last)add(last.office==='judge'?'judiciary':'cabinet',person.id,'Должность в прошлом · '+last.title);
    else if(deputyIds.has(person.id))people.delete(person.id);
    else add('other-characters',person.id,person.diedMonth===null?'Вне действующего состава':'Бывший участник кампании');
  }
  if(includeOrganizations){
    if(state.scenario?.id==='uk-2000'){
      const [monarch,consort,heir,secretary]=britishCourt(world.seed);
      monarch.relatives=[consort,heir];
      consort.relatedPerson=heir.relatedPerson=monarch;
      for(const person of [monarch,consort,heir,secretary]){
        people.set(person.id,person);
        add('state-figures',person.id,person.role);
      }
      for(const id of Object.keys(britishOffices)){
        const person=britishOfficeHolder(state,id);
        people.set(id,person);
        add(person.section,id,person.role);
      }
      for(const person of UK_CODEX_PEOPLE){
        people.set(person.id,{...person,roles:[],history:[],relatives:[]});
        add(person.section,person.id,person.role);
      }
    }
    addForeignLeaders(world.seed);
  }
  const organizations=includeOrganizations?codexOrganizations(state):[];
  for(const organization of organizations){
    const party=organization.section==='parties';
    const leader=people.get(organization.leaderId);
    if(leader){
      leader.organizationId=organization.id;
      organization.representative=leader;
      continue;
    }
    if(party&&organization.archived)continue;
    const person=organizationRepresentative(organization,world);
    people.set(person.id,person);
    add(party?'party-leaders':'business',person.id,party?'Лидер партии':organization.archived?'Бывший генеральный директор':'Генеральный директор');
    organization.representative=person;
    if(organization.publisher){
      const {id,profile,name}=organization.publisher;
      if(!people.has(id)){
        const age=46+Math.floor(hash(world.seed,id,'age')*21);
        people.set(id,{id,profile,name,age,diedMonth:null,appearanceSeed:hash(world.seed,id,'portrait'),
          wealth:characterWealth(world.seed,id,'ownerDirector',age),history:[],relatives:[],roles:[]});
        add('business',id,'Совладелец издательства');
      }
      organization.publisher=people.get(id);
    }
  }
  return {sections,people,cabinet,factions,organizations,organizationSeed:world.seed,proposedCabinet,caretaker:forming&&!proposedCabinet,
    activeJudges:Object.values(world.judges).map(id=>people.get(id))};
}

export const characterLink=(person,label=person.name)=>`<button type="button" class="character-link" data-codex-person="${esc(person.id)}">${esc(label)}</button>`;

export function characterPortrait(person,large=false){
  return `<span class="character-portrait${large?' character-portrait-large':''}" aria-hidden="true"><img data-character-portrait="${esc(person.id)}" alt="" hidden>${!large&&person.color?`<i style="--character-color:${person.color}"></i>`:''}</span>`;
}

export function characterList(people,{affiliation=false,showRole=true}={}){
  const entries=people.map(person=>{
    const role=showRole?`<span>${esc(person.role)}</span>`:'';
    const organization=affiliation&&person.affiliation?`<span>${esc(person.affiliation)}</span>`:'';
    return `<li><button type="button" class="character-portrait-button" data-character-card="${esc(person.id)}" aria-label="Карточка персонажа ${esc(person.name)}">${characterPortrait(person)}</button><div>${characterLink(person)}${role}${organization}</div></li>`;
  }).join('');
  return `<ul class="connections-cabinet">${entries}</ul>`;
}

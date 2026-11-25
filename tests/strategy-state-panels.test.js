import {WORLD_CODEX_ARTICLES} from '../src/codex-world-reference.js';
import {newGameOptions} from '../src/start-presets.js';
import {characterWealth,directorWealth} from '../src/character-wealth.js';
import {characterEthnicity,britishCharacterEthnicity,characterSkinTone} from '../src/character-demographics.js';
import {CODEX_REFERENCE_IMAGES} from '../src/codex-reference-images.js';
import {UK_CODEX_ARTICLES} from '../src/codex-uk-reference.js';
import {existsSync} from 'node:fs';
import {CODEX_COUNTRIES,CODEX_REGIONS,foreignLeaderId} from '../src/codex-locations.js';
import {organizationEmblem} from "../src/codex-organizations.js";
import {sectorCompanies} from "../src/enterprise-market.js";
import {BRITISH_CITIES,cityDossier,regionDossier,selectRegionSituation} from '../src/city-dossier.js';
import {atlasEntries} from '../src/desk-atlas.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionsPanel,parliamentaryGroups} from '../src/connections.js';
import {overviewEntries,overviewPanel} from '../src/overview-panel.js';
import {advanceMonth,createSimulation,exportSimulation,importSimulation,replayJournal} from '../src/engine.js';
import {scenarioOptions} from '../src/country-scenarios.js';
import {characterRoster,COURT_ORIGINS} from '../src/character-roster.js';
import {BRITISH_FIRST_NAMES,BRITISH_SURNAMES} from '../src/leader-names.js';
import {currentCharacter,synchronizeCharacters} from '../src/character-world.js';
import {executePolitical} from '../src/political-system.js';
import {installCabinet} from '../src/parliamentary.js';
import {characterCard,codexPanel} from '../src/codex-panel.js';

test('Commons seats, coalition and minor groups always reflect the live parliament',()=>{
 const state={politics:{totalSeats:100,coalition:['a','c'],executive:{playerParty:'a'},parliamentary:{phase:'government'},parties:[
  {id:'a',family:'socialDemocrat',seats:52},{id:'b',family:'conservative',seats:42},
  {id:'c',family:'green',seats:3},{id:'d',family:'regional',seats:3}
 ]}};
 const before=JSON.stringify(state),groups=parliamentaryGroups(state);
 assert.equal(groups.reduce((sum,p)=>sum+p.seats,0),100);
 assert.deepEqual(groups.filter(p=>p.independent).map(p=>[p.government,p.seats]),[[true,3],[false,3]]);
 const html=connectionsPanel('legislative',state);
 assert.equal((html.match(/data-parliament-seat=/g)||[]).length,100);
 assert.match(html,/Опора кабинета — 55/);assert.doesNotMatch(html,/1997|Лейбористы|418/);
 state.politics.coalition=['b'];assert.match(connectionsPanel('legislative',state),/Опора кабинета — 42/);
 state.politics.coalition=['a','c'];assert.equal(JSON.stringify(state),before);
});
const player={name:'Eleanor Harper',profile:1,age:1};
const start=(characterSeed=123)=> {
 const options=scenarioOptions();
 return createSimulation({...options,characterPlayer:player,politicalOptions:{...options.politicalOptions,characterSeed}});
};
function formCabinet(state){
 executePolitical(state,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
 executePolitical(state,{kind:'formCabinet'});
}

test('British characters, family and cabinet survive export and journal replay',()=>{
 assert.equal(new Set(BRITISH_FIRST_NAMES).size,100);
 assert.equal(new Set(BRITISH_SURNAMES).size,100);
 const state=start(),initial=characterRoster(state);
 assert.deepEqual(initial.cabinet.map(person=>person.role),['Кандидат на пост премьер-министра']);
 assert.ok(initial.sections.family.length>=1);
 assert.notDeepEqual(characterRoster(start(456)).sections.family,initial.sections.family);
 const protagonist=currentCharacter(state);
 assert.equal(protagonist.name,player.name);
 assert.equal(protagonist.profile,player.profile);
 assert.ok(initial.sections.family.every(person=>person.relation.personId===protagonist.id));
 const family=initial.sections.family[0];
 assert.match(characterCard(family,2000),/Состояние.*тыс. £/s);
 const article=codexPanel('characters','family',{roster:initial,personId:family.id});
 assert.match(article,/Родство/);
 assert.doesNotMatch(article,/Состояние|тыс\. £/);

 formCabinet(state);
 const roster=characterRoster(state);
 assert.equal(roster.cabinet.length,9);
 assert.equal(roster.sections.parliament.length,0);
 assert.ok(roster.cabinet.some(member=>roster.people.get(member.id).roles.includes('Депутат Палаты общин')));
 const restored=importSimulation(exportSimulation(state));
 assert.deepEqual(restored.characters,state.characters);
 assert.deepEqual(replayJournal(restored).characters,state.characters);
 const advanced=advanceMonth(restored);
 assert.deepEqual(replayJournal(advanced).characters,advanced.characters);
 assert.equal(new Set([...roster.people.values()].map(person=>person.name)).size,roster.people.size);
 for(const origin of COURT_ORIGINS){
  const judges=roster.activeJudges.filter(person=>person.affiliation===origin.label);
  assert.equal(judges.length,origin.seats);
  assert.ok(judges.every(person=>person.color===origin.color));
  assert.match(characterCard(judges[0],2000),/<li>Судья<\/li>/);
 }
 const legislature=connectionsPanel('legislative',state,roster);
 assert.match(legislature,/<span>Лидер партии<\/span><span>Социал-демократическая партия<\/span>/);
 assert.doesNotMatch(legislature,/Депутат Палаты общин|Лидер партии ·/);
 assert.doesNotMatch(connectionsPanel('cabinet',state,roster),/Премьер-министр ·|Министр финансов ·/);
 assert.match(connectionsPanel('justice',state,roster),/<span>Англия и Уэльс<\/span>/);
 const factions=connectionsPanel('factions',state,roster);
 assert.equal(roster.factions.length,3);
 assert.doesNotMatch(factions,/Либертарианская партия|Оппозиция/);
 for(const faction of roster.factions){
  assert.match(factions,new RegExp(faction.name));
  assert.ok(roster.people.has(faction.representative.id));
 }
 for(const [tab,people] of [['cabinet',roster.cabinet],['justice',roster.activeJudges]]){
  const html=connectionsPanel(tab,state,roster);
  for(const person of people)assert.ok(html.includes(`data-character-card="${person.id}"`));
 }
});

test('changes of coalition retain portfolios where possible and reuse former ministers',()=>{
 const s=start();
 formCabinet(s);
 const {characters:w}=s,own=s.politics.executive.playerParty;
 const cabinet={...w.cabinet},court={...w.judges};
 const former=Object.entries(cabinet).filter(([,id])=>w.people[id].partyId==='p11');
 s.month++;
 installCabinet(s,own,[own]);
 synchronizeCharacters(s);
 for(const [office,id] of former){
  assert.notEqual(w.cabinet[office],id);
  assert.equal(w.people[id].history.at(-1).to,s.month);
 }
 for(const [office,id] of Object.entries(cabinet))if(w.people[id].partyId===own)assert.equal(w.cabinet[office],id);
 assert.deepEqual(w.judges,court);
 s.month++;
 installCabinet(s,own,[own,'p11']);
 synchronizeCharacters(s);
 for(const [office,id] of former)assert.equal(w.cabinet[office],id);
});

test('a death closes an appointment and brings a new judge or player character',()=>{
 const state=start();
 formCabinet(state);
 const original=currentCharacter(state);
 const [slot,judgeId]=Object.entries(state.characters.judges)[0];
 const ministerId=state.characters.cabinet.treasury;
 const people=state.characters.people;
 for(const person of [original,people[judgeId],people[ministerId]])person.deathMonth=state.month+1;
 const next=advanceMonth(state);
 const successor=currentCharacter(next);
 assert.notEqual(successor.id,original.id);
 assert.equal(next.characters.cabinet.premier,successor.id);
 assert.notEqual(next.characters.cabinet.treasury,ministerId);
 assert.notEqual(next.characters.judges[slot],judgeId);
 assert.equal(next.characters.people[next.characters.judges[slot]].originId,people[judgeId].originId);
 const oldJudge=next.characters.people[judgeId];
 assert.equal(oldJudge.diedMonth,1);
 assert.equal(oldJudge.history[0].to,1);
 assert.equal(oldJudge.wealth,people[judgeId].wealth);
 assert.ok(characterRoster(next).sections.family.some(person=>person.relation.personId===successor.id));
 assert.ok(next.lastReport.events.some(event=>event.includes('Смена вашего персонажа')));
 const restored=importSimulation(exportSimulation(next));
 assert.equal(restored.characters.people[judgeId].diedMonth,1);
 const archive=characterRoster(restored,player,{includeOrganizations:true}).sections['former-premiers'];
 assert.ok(archive.some(person=>person.id===original.id));
 assert.ok(!archive.some(person=>person.id===successor.id));
});

test('old campaigns initialize characters from the saved month and replay after migration',()=>{
 const state=start();
 formCabinet(state);
 const saved=advanceMonth(state);
 const old=JSON.parse(exportSimulation(saved));
 delete old.state.characters;
 delete old.state.provenance.characterPlayer;
 old.leader={name:player.name,appearance:player};
 const migrated=importSimulation(JSON.stringify(old));
 assert.equal(currentCharacter(migrated).name,player.name);
 assert.equal(migrated.characters.people[migrated.characters.cabinet.premier].history[0].from,1);
 const advanced=advanceMonth(migrated);
 assert.deepEqual(replayJournal(advanced).characters,advanced.characters);
});

test('the overview reads enacted policies without exposing numerical values',()=>{
 const s=createSimulation(scenarioOptions());
 s.policy.corporateTax=41;
 assert.match(overviewEntries(s,'economy','policy')[0].label,/Высокая/);
 for(const category of ['defense','law','economy','welfare','decrees','diplomacy']){
  for(const mode of ['policy','situations']){
   const text=overviewPanel(category,mode,2,s).replace(/<[^>]*>/g,'');
   assert.doesNotMatch(text,/undefined|Демонстрационные|[0-9%]/);
  }
 }
 assert.ok(overviewEntries(s,'economy','situations').length>3);
 assert.ok(overviewEntries(s,'defense','situations').length<3);
});

test('every British city dossier has a national marker, city accounts and a Codex entry',()=>{
 const state=start();
 const entries=atlasEntries('national',false);
 assert.equal(BRITISH_CITIES.length,13);
 for(const city of BRITISH_CITIES){
  assert.ok(entries.some(entry=>entry.code==='GBR'&&entry.name===city.name&&['regional-city','capital'].includes(entry.mark)));
  const dossier=cityDossier(state,city,{kind:'government',label:'Сформировать правительство'});
  assert.match(dossier,/Номинальный ВВП за месяц.*млрд £/);
  assert.match(dossier,/Место по населению<\/dt><dd>\d+ из 13/);
  assert.match(dossier,/class="city-vignette"/);
  if(city.id==='TLI')assert.match(dossier,/14,83 млрд £/);
  assert.equal(dossier.includes('class="city-parliament-link"'),city.id==='TLI');
  assert.equal(dossier.includes('data-region-section="situation"'),city.id==='TLI');
  assert.ok(dossier.includes('data-codex-city="'+city.id+'"'));
  assert.ok(codexPanel('locations','cities',{scenarioId:'uk-2000',cityId:city.id}).includes(city.description));
 }
});

test('London keeps access to Parliament after formation and uses the Greater London situation',()=>{
 const state=start();
 const london=BRITISH_CITIES.find(city=>city.id==='TLI');
 const greaterLondon=CODEX_REGIONS.find(region=>region.id==='TLI');
 formCabinet(state);
 assert.equal(state.politics.parliamentary.phase,'government');
 const dossier=cityDossier(state,london),region=regionDossier(state,greaterLondon);
 assert.match(dossier,/class="city-parliament-link" data-view="government" data-open-view="true"/);
 assert.match(dossier,/aria-label="Ситуация в Лондоне"/);
 const items=html=>[...html.matchAll(/data-region-situation-item="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(items(dossier),items(region));
 assert.ok(items(dossier).includes('unemployment'));
 const nodes=new Map(),panel={dataset:{situationTerritory:'TLI'},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{setAttribute(){}});return nodes.get(selector);}};
 const button={dataset:{regionSituationItem:'unemployment'},closest:()=>panel,setAttribute(){}};
 selectRegionSituation(button,state);
 assert.match(nodes.get('.overview-card:last-child p').textContent,/%/);
});

test('the Codex covers all British regions and links foreign countries to fictional leaders',()=>{
 const state=start();
 const roster=characterRoster(state,player,{includeOrganizations:true});
 assert.deepEqual(CODEX_REGIONS.map(r=>r.id),state.regional.regions.map(r=>r.id));
 for(const region of CODEX_REGIONS){
  const article=codexPanel('locations','regions',{locationId:region.id,roster,scenarioId:state.scenario.id});
  assert.ok(article.includes(region.description));
  assert.ok(existsSync(new URL('../assets/codex-regions/'+region.id+'.webp',import.meta.url)));
 }
 assert.equal(CODEX_COUNTRIES.length,12);
 assert.equal(roster.sections['foreign-leaders'].length,CODEX_COUNTRIES.length+1);
 assert.equal(roster.people.get('commission-president-1999')?.name,'Romano Prodi');
 for(const country of CODEX_COUNTRIES){
  const person=roster.people.get(foreignLeaderId(country));
  assert.equal(person.affiliation,country.name);
  const article=codexPanel('locations','countries',{locationId:country.id,roster});
  assert.ok(article.includes('data-codex-person="'+person.id+'"'));
  assert.ok(article.includes('codex-flags/'+country.id+'.svg'));
  assert.ok(existsSync(new URL('../assets/codex-flags/'+country.id+'.svg',import.meta.url)));
  assert.match(article,/Глава государства/);
  assert.doesNotMatch(article,/В этой кампании|Британи/);
  const bio=codexPanel('characters','foreign-leaders',{personId:person.id,roster});
  assert.match(bio,/К статье о стране/);
  assert.doesNotMatch(bio,/Вымышленный лидер/);
  assert.doesNotMatch(characterCard(person,2000),/NaN|Состояние/);
 }
 assert.deepEqual(characterRoster(state,player,{includeOrganizations:true}).sections['foreign-leaders'],roster.sections['foreign-leaders']);
});

test('British Codex includes historical articles, parliamentary biographies and existing faction representatives',()=>{
 const state=start();
 const roster=characterRoster(state,player,{includeOrganizations:true});
 for(const entry of [...UK_CODEX_ARTICLES,...WORLD_CODEX_ARTICLES]){
  const article=codexPanel(entry.category,entry.section,{locationId:entry.id,roster,scenarioId:state.scenario.id});
  assert.ok(article.includes('data-codex-reference="'+entry.id+'"'));
  assert.ok(article.includes(entry.description));
  const image=CODEX_REFERENCE_IMAGES[entry.id];
  if(entry.section==='landmarks')assert.ok(image,entry.name);
  if(image){
   const path='assets/codex-reference/'+image[0]+'.webp';
   assert.ok(article.includes(path));
   assert.ok(existsSync(new URL('../'+path,import.meta.url)));
  }
  if(entry.section==='ideologies'){
   assert.match(article,/class="codex-ideology-emblem /);
   assert.doesNotMatch(article,/organization-flag|<figcaption/);
  }
 }
 assert.deepEqual(roster.sections['former-premiers'].map(p=>p.name),['Margaret Thatcher','John Major','Tony Blair']);
 assert.deepEqual(roster.sections.parliament.map(p=>p.id),['uk-speaker','uk-chief-whip']);
 for(const person of roster.people.values())assert.doesNotMatch(person.name,/[А-Яа-яЁё]/);
 for(const person of roster.sections.parliament){
  const article=codexPanel('characters','parliament',{personId:person.id,roster});
  assert.ok(article.includes(person.role));
  assert.match(article,/Возраст ·|data-character-portrait/);
 }
 for(const person of roster.sections['former-premiers']){
  const article=codexPanel('characters','former-premiers',{personId:person.id,roster});
  assert.ok(article.includes(person.bio));
  assert.doesNotMatch(article,/Состояние|data-character-portrait/);
 }
 const connections=characterRoster(state,player);
 for(const faction of roster.factions){
  const existing=connections.factions.find(item=>item.id===faction.id);
  assert.equal(existing.representative.name,faction.representative.name);
  const article=codexPanel('organizations','factions',{organizationId:faction.id,roster});
  assert.ok(article.includes('data-codex-person="'+existing.representative.id+'"'));
  assert.ok(codexPanel('characters','social-factions',{personId:existing.representative.id,roster}).includes('data-codex-organization="'+faction.id+'"'));
 }
});

test('world articles are reusable and national articles only appear in their own scenario',()=>{
 const abstract=createSimulation(newGameOptions());
 const roster=characterRoster(abstract,player,{includeOrganizations:true});
 assert.equal(roster.sections['foreign-leaders'].length,CODEX_COUNTRIES.length);
 assert.equal(roster.sections['state-figures'].length,0);
 for(const scenarioId of [undefined,'ru-2000']){
  for(const entry of WORLD_CODEX_ARTICLES){
   const article=codexPanel(entry.category,entry.section,{scenarioId,roster,locationId:entry.id});
   assert.ok(article.includes(entry.description));
   assert.doesNotMatch(article,/codex-scenario-context|январь 2000|Палата общин/);
  }
  for(const entry of UK_CODEX_ARTICLES){
   const article=codexPanel(entry.category,entry.section,{scenarioId,roster,locationId:entry.id});
   assert.ok(!article.includes(entry.description));
   assert.ok(!article.includes('data-codex-reference="'+entry.id+'"'));
  }
  const locations=codexPanel('locations','cities',{scenarioId,roster,cityId:'TLI'});
  assert.doesNotMatch(locations,/data-codex-city|data-codex-section="regions"|Лондон/);
 }
 const un=WORLD_CODEX_ARTICLES.find(entry=>entry.id==='un');
 const ukArticle=codexPanel('organizations','intergovernmental',{scenarioId:'uk-2000',locationId:un.id});
 assert.ok(ukArticle.includes(un.description));
 assert.match(ukArticle,/codex-scenario-context.*Соединённое Королевство · январь 2000.*постоянный член/s);
 const abstractParty=roster.organizations.find(entry=>entry.section==='parties');
 const partyArticle=codexPanel('organizations','parties',{roster,organizationId:abstractParty.id});
 assert.doesNotMatch(partyArticle,/британской|Палате общин/);
});

test('the British monarch is a stable generated Codex character with a matching title',()=>{
 const profiles=new Set();
 for(const seed of [123,10000]){
  const state=start(seed);
  const roster=characterRoster(state,player,{includeOrganizations:true});
  const monarch=roster.people.get('uk-monarch');
  profiles.add(monarch.profile);
  assert.equal(monarch.role,monarch.profile?'Королева Великобритании':'Король Великобритании');
  const consort=roster.people.get('uk-consort');
  assert.equal(consort.role,monarch.profile?'Принц-консорт':'Королева-консорт');
  assert.deepEqual(monarch.relatives.map(person=>person.id),['uk-consort','uk-heir']);
  assert.ok(roster.people.has('uk-royal-secretary'));
  assert.ok(roster.sections['state-figures'].some(person=>person.id===monarch.id));
  const article=codexPanel('characters','state-figures',{personId:monarch.id,roster});
  assert.ok(article.includes(monarch.role));
  assert.match(article,/data-character-portrait="uk-monarch"/);
  assert.doesNotMatch(article,/Состояние/);
  assert.match(characterCard(monarch,2000),/Состояние/);
  const loaded=importSimulation(exportSimulation(state));
  assert.deepEqual(characterRoster(loaded,player,{includeOrganizations:true}).people.get(monarch.id),monarch);
 }
 assert.equal(profiles.size,2);
});

test('character wealth differs by role with overlapping outcomes',()=>{
 const sample=Array.from({length:2000},(_,seed)=>[
  characterWealth(seed,'child','child',24),
  characterWealth(seed,'judge','judge',60),
  directorWealth(seed,'director',52,.7),
 ]);
 const median=index=>sample.map(row=>row[index]).sort((a,b)=>a-b)[sample.length/2];
 assert.ok(median(0)<median(1));
 assert.ok(median(1)<median(2));
 const reversals=sample.filter(([child,,director])=>child>director).length;
 assert.ok(reversals>0&&reversals<sample.length*.05);
});

test('national portrait weights are independent of role and match the British census over many draws',()=>{
 const total=20000;
 const counts={};
 for(let seed=0;seed<total;seed++){
  const group=britishCharacterEthnicity(seed,'person-1');
  counts[group]=(counts[group]??0)+1;
  assert.ok([0,1,2,3].includes(characterSkinTone(group,seed/total)));
 }
 assert.ok(Math.abs(counts.white/total-.921)<.01);
 assert.ok(Math.abs(counts.black/total-.020)<.005);
 assert.ok(Math.abs(counts.asian/total-.040)<.007);
 assert.equal(characterEthnicity(.5,'abstract'),null);
 assert.equal(characterEthnicity(.5,'south-africa'),'black');
 assert.equal(characterEthnicity(.8,'usa'),'black');
});

test('the Codex follows live organizations and keeps their identity in the archive',()=>{
 const state=start();
 const roster=()=>characterRoster(state,player,{includeOrganizations:true});
 const initial=roster();
 const party=initial.organizations.find(entry=>entry.id==='party-p4');
 const company=initial.organizations.find(entry=>entry.id==='company-industry-1');
 assert.equal(party.representative.id,state.characters.leaders.p4);
 assert.equal(initial.organizations.some(entry=>entry.id==='party-p3'),false);
 assert.equal(initial.organizations.some(entry=>entry.id==='company-agriculture-company-1'),false);
 assert.equal(characterRoster(state).organizations.length,0);
 const article=(section,entry,registry)=>codexPanel('organizations',section,{
  roster:registry,organizationId:entry.id,scenarioId:state.scenario.id,
 });
 const partyArticle=article('parties',party,initial);
 assert.match(partyArticle,/organization-flag.*Палате общин.*Лидер партии/s);
 assert.doesNotMatch(partyArticle,/<(?:dl|table)\b|Программа|Гражданские свободы/);
 const companyArticle=article('corporations',company,initial);
 assert.match(companyArticle,/Northmere Engineering.*organization-logo.*основана в 1948 году.*Генеральный директор/s);
 assert.doesNotMatch(companyArticle,/<(?:dl|table)\b|Собственность|Выручка|Занятость|Статус|Услуги ·|Завод «Север»/);
 const companies=initial.organizations.filter(entry=>entry.section==='corporations');
 assert.equal(new Set(companies.map(entry=>entry.name)).size,companies.length);
 assert.match(article('corporations',companies.find(entry=>entry.recordId==='bank-1'),initial),/заметная часть вкладов и кредитов/);
 assert.ok(companies.every(entry=>/^[A-Za-z &]+$/.test(entry.name)));
 assert.ok(companies.some(entry=>entry.recordId==='bank-1'));
 assert.ok(companies.some(entry=>entry.recordId==='network-rail'));
 assert.ok(!companies.some(entry=>entry.recordId==='fund-pension'));
 const person=codexPanel('characters','business',{roster:initial,personId:company.representative.id});
 assert.match(person,/data-codex-organization="company-industry-1"/);

 state.month=1;
 state.social.pensionFund.cash=state.metrics.nominalGDPAnnual*.006;
 const oldParty=state.politics.parties.find(record=>record.id==='p4');
 Object.assign(oldParty,{active:false,seats:0,retiredMonth:1});
 state.politics.parties.push({...oldParty,id:'p40',name:'Новая партия',parentIds:['p4'],active:true,foundedMonth:1,retiredMonth:undefined});
 const oldCompany=sectorCompanies(state,2)[0];
 Object.assign(oldCompany,{active:false,bankruptcies:1,last:{month:1,bankruptMonth:1}});
 sectorCompanies(state,2).push({...oldCompany,id:'industry-42',name:'Новое предприятие',active:true,bankruptcies:0,last:null,foundedMonth:1});
 sectorCompanies(state,2).push({...oldCompany,id:'industry-43',active:true,workers:0,lastRevenue:1});
 sectorCompanies(state,2).push({...oldCompany,id:'industry-44',active:true,ownership:{state:.8,domestic:.2}});
 const next=roster();
 assert.ok(next.organizations.some(entry=>entry.recordId==='fund-pension'));
 assert.ok(!next.organizations.some(entry=>['industry-43','industry-44'].includes(entry.recordId)));
 const archivedParty=next.organizations.find(entry=>entry.id===party.id);
 const archivedCompany=next.organizations.find(entry=>entry.id===company.id);
 assert.equal(archivedParty.archived,true);
 assert.equal(archivedCompany.archived,true);
 assert.equal(archivedCompany.description,company.description);
 assert.equal(archivedCompany.representative.name,company.representative.name);
 assert.equal(organizationEmblem(archivedCompany,next.organizationSeed),organizationEmblem(company,initial.organizationSeed));
 assert.equal(organizationEmblem(archivedParty,next.organizationSeed),organizationEmblem(party,initial.organizationSeed));
 assert.ok(next.organizations.some(entry=>entry.id==='party-p40'&&!entry.archived&&entry.status==='Вне парламента'));
 const entrant=next.organizations.find(entry=>entry.id==='company-industry-42');
 assert.equal(entrant.archived,false);
 assert.match(entrant.name,/^[A-Za-z &]+$/);
 assert.match(article('corporations',entrant,next),/основана в 2000 году/);
 assert.equal(roster().organizations.find(entry=>entry.id===entrant.id).description,entrant.description);
 assert.match(article('corporations',archivedCompany,next),/<details class="organization-archive" open><summary>Архив<\/summary>/);
});

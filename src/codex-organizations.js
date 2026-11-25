import {pressCompanies,pressControl,pressControlLabel,publisher} from './press-market.js';
import {codexMarket} from './codex-market.js';
import {hash,partyDisplayName} from './political-config.js';
import {partyColor} from './game-charts.js';
import {britishCharacterEthnicity} from './character-demographics.js';
import {characterWealth} from './character-wealth.js';
import {britishName,britishNameProfile,latinCharacterName} from './leader-names.js';
import {codexCompanyProfile} from './codex-company-profiles.js';

const byName=(a,b)=>a.name.localeCompare(b.name,'ru');

export function codexOrganizations(state){
  const politics=state.politics;
  const parties=politics?.parties??[];
  const merged=new Set(parties.filter(p=>p.parentIds?.length>1).flatMap(p=>p.parentIds));
  const partyNames=new Map(parties.map(p=>[p.id,p.parentIds?.length?p.name:partyDisplayName(p)]));
  const entries=parties.filter(p=>!p.independent&&(p.active||p.retiredMonth!=null||merged.has(p.id))).map(p=>({
    id:'party-'+p.id,recordId:p.id,section:'parties',name:partyNames.get(p.id),
    color:partyColor(p),family:p.family,archived:!p.active,merged:merged.has(p.id),
    status:!p.active?(merged.has(p.id)?'Объединилась с другой партией':'Выбыла из политической борьбы'):
      !(p.seats>0)?'Вне парламента':
      politics.coalition?.includes(p.id)?(politics.parliamentary?.phase==='forming'?'Участвует в формировании правительства':'В правительстве'):
      politics.parliamentary?.phase==='forming'?'Представлена в парламенте':'В оппозиции',
    seats:p.seats,foundedMonth:p.foundedMonth,endedMonth:p.retiredMonth,
    parents:p.parentIds?.map(id=>partyNames.get(id)).filter(Boolean)??[],
    leaderId:state.characters?.leaders?.[p.id],leaderName:p.leader,
  }));
  for(const actor of codexMarket(state)){
    entries.push({...actor,...codexCompanyProfile(actor,actor.sector,state.seed),
      id:'company-'+actor.id,recordId:actor.id,section:'corporations',archived:!!actor.archived});
  }
  for(const company of pressCompanies(state)){
    entries.push({id:'company-'+company.id,recordId:company.id,section:'corporations',name:company.name,
      sector:'press',specialty:'press',color:'#bdab7c',archived:!company.active,scale:0,openingYear:(state.startYear??2000)+Math.floor(company.foundedMonth/12),
      domesticOwnership:company.ownership.domestic,
      description:'Издательство выпускает одноимённую газету. '+pressControlLabel(pressControl(company))+'.',
      publisher:company.active?publisher(state,company):null});
  }
  return entries.sort((a,b)=>Number(a.archived)-Number(b.archived)||(b.seats??b.scale??0)-(a.seats??a.scale??0)||byName(a,b));
}

export function organizationRepresentative(organization,world){
  const party=organization.section==='parties';
  const id='head-'+organization.id;
  const roll=key=>hash(world.seed,id,key);
  const profile=party&&organization.leaderName?britishNameProfile(organization.leaderName):Number(roll('profile')<.45);
  const name=party&&organization.leaderName?latinCharacterName(organization.leaderName):britishName(world.seed,id,profile);
  const age=40+Math.floor(roll('age')*25);
  return {id,name,profile,age,diedMonth:null,appearanceSeed:roll('portrait'),ethnicity:britishCharacterEthnicity(world.seed,id),
    wealth:party?characterWealth(world.seed,id,'politician',age):characterWealth(world.seed,id,'director',age),affiliation:organization.name,color:organization.color,
    organizationId:organization.id,history:[],relatives:[],roles:[]};
}

const partyLayouts=[
  '<path fill="#10151145" d="M0 0h30v72H0z"/>',
  '<path fill="#10151155" d="M0 47h112v25H0z"/>',
  '<path fill="#10151155" d="M0 0h112v11H0zm0 61h112v11H0z"/>',
  '<path fill="#10151155" d="M0 0h20l72 72H72z"/>',
  '<path fill="#10151145" d="M0 0h112L0 72z"/>',
  '<path fill="#10151155" d="M0 24h112v24H0z"/>',
];
// Original drawings of generic political motifs, independent of party branding.
const partyMarks={
  rose:'M18 19c-7 0-12-5-12-10 0-3 2-5 5-5 1-3 5-4 7-1 3-3 6-2 8 1 3 0 5 2 5 5 0 5-5 10-11 10v6c4-4 8-5 12-5-2 6-7 8-12 8v7h-4v-8C11 26 7 23 5 20c5 0 9 2 11 4v-5zm-5-10c1 4 7 6 10 1-4 2-7 1-10-1z',
  torch:'M14 19C9 15 11 9 16 5c0 4 2 5 3 5 3-3 3-6 3-9 9 8 8 15 2 18zM9 21h18l-3 4H12zm6 6h6l-1 8h-4z',
  oak:'M17 34v-9C7 27 2 20 6 16c-4-4 0-9 5-8-1-7 6-9 8-3 4-6 10-4 9 3 6 0 9 6 4 9 3 6-3 11-11 8v9z',
  leaf:'M5 28C-1 14 12 6 31 4c2 18-10 28-23 26l16-17L5 32 3 30z',
  wheat:'M16 34V17C8 17 4 11 5 6c6 1 10 4 11 9V9c0-4 1-7 3-9 3 3 3 8 0 12v8c2-5 7-8 13-8-1 7-6 11-13 11v4c3-3 6-4 10-4-1 5-5 8-10 8v3z',
  hammerSickle:'M22 3c12 3 16 13 12 23-4 9-16 12-25 6l-5 4-3-4 6-6 2 1c6 5 14 4 18-2 5-7 3-16-5-22zM6 12l9-8 6 5-4 4 13 13-3 3-13-13-4 4z',
  shield:'M18 2l14 5v10c0 8-7 13-14 17C11 30 4 25 4 17V7zm0 6L9 11v6c0 5 4 9 9 12 5-3 9-7 9-12v-6z',
  compass:'M18 1l4 13 13 4-13 4-4 13-4-13-13-4 13-4zm0 12-5 5 5 5 5-5z',
  star:'M18 1l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z',
  columns:'M2 8h32v4H2zm4 7h4v14H6zm10 0h4v14h-4zm10 0h4v14h-4zM3 31h30v4H3zM4 6 18 0l14 6z',
};
const familyMarks={
  socialist:'rose',socialDemocrat:'rose',liberal:'torch',conservative:'oak',national:'shield',
  green:'leaf',agrarian:'wheat',regional:'compass',communist:'hammerSickle',
  authoritarianLeft:'star',libertarian:'torch',centerRight:'columns',centerLeft:'rose',
};
const companyMarks={
  press:'M9 11h42v33H9zm4 4v25h34V15zm4 4h26v3H17zm0 7h11v10H17zm15 0h11v3H32zm0 7h11v3H32z',
  bank:'M9 17 32 6l23 11v5H9zm6 9h6v14h-6zm14 0h6v14h-6zm14 0h6v14h-6zM9 43h46v4H9z',
  rail:'M23 9h5l-7 34h-5zm13 0h5l7 34h-5zM23 14h18v4H23zm-3 10h24v4H20zm-2 10h28v4H18z',
  roads:'M24 9h16l15 34H9zm6 5v6h4v-6zm0 9v7h4v-7zm0 10v7h4v-7z',
  grid:'M35 8 16 30h14l-4 15 22-23H34z',
  pension:'M12 16h40v28H12zm7 6v16h26V22zm8 4h10v8H27z',
  investment:'M10 38h44v5H10zm4-4 12-13 9 6L49 12l4 4-18 19-9-6-7 8z',
  insurance:'M32 8 51 16v11c0 8-9 15-19 19-10-4-19-11-19-19V16zm0 8-12 5v6c0 5 6 10 12 13 6-3 12-8 12-13v-6z',
  health:'M26 10h12v12h12v12H38v12H26V34H14V22h12z',
  farming:'M30 44V24C18 22 13 16 12 10c12 0 18 4 20 12 4-8 10-12 20-12-2 7-7 13-17 15v19z',
  energy:'M24 45C10 38 16 26 27 19l2 7c5-5 8-11 8-17 17 14 18 28 5 36-2-10-5-12-10-15-5 4-7 8-8 15z',

  engineering:'M10 42h12l9-18 9 18h12L36 10H26z',
  metals:'M10 42 26 10h10L20 42zm15 0 16-32h10L35 42zm15 0 12-24 5 10-7 14z',
  electrical:'M39 7 17 30h13l-8 16 25-25H33z',
  materials:'M12 29 31 10l19 19-19 15zm6 0 13 9 13-9-13-12z',
  civil:'M7 38h50v5H7z M11 32c5-4 6-15 11-15s7 15 10 15 5-15 10-15 6 11 11 15v3H11z',
  building:'M8 29 23 14l15 15v13h-7V31h-5v11H13V29zm28-6 9-9 13 13v15h-9V29z',
  contracting:'M10 42V18l14-7v31zm18 0V9l13 7v26zm17 0V18l10 5v19z',
  logistics:'M7 15h35l12 11-12 11H7l12-11zm9 5 6 6-6 6h23l6-6-6-6z',
  retail:'M11 18h40v7H11zm3 10h34v15H14zm5 3v7h7v-7zm12 0v12h11V31z',
  systems:'M13 15h11v11H13zm14 0h11v11H27zm14 0h11v11H41zM20 29h11v11H20zm14 0h11v11H34z',
  advisory:'M11 41 31 12l21 29H41L31 25l-9 16zm16 0 4-7 5 7z',
  property:'M11 41V24l10-8v25zm14 0V12h13v29zm17 0V16l10 8v17z',
};
const corporateLayouts=[
  '<path d="M8 47h48" stroke="currentColor" stroke-width="1"/>',
  '<path d="M4 43V10h12m32 0h12v33" fill="none" stroke="currentColor" stroke-width="1"/>',
  '<path d="M4 42h11m34 0h11" stroke="currentColor" stroke-width="2"/>',
];

export function ideologyEmblem(family,label){
  const mark=familyMarks[family];
  return `<svg class="codex-ideology-emblem ${mark}" viewBox="-2 -2 40 40" role="img" aria-label="${label}"><path fill="currentColor" fill-rule="evenodd" d="${partyMarks[mark]}"/></svg>`;
}

export function organizationEmblem(organization,seed){
  const color=organization.color;
  const roll=key=>hash(seed,organization.id,key);
  if(organization.section==='parties'){
    const layout=partyLayouts[Math.floor(roll('layout')*partyLayouts.length)];
    const mark=partyMarks[familyMarks[organization.family]??'compass'];
    return `<svg class="organization-emblem organization-flag" viewBox="0 0 112 72" aria-hidden="true"><path fill="${color}" d="M0 0h112v72H0z"/>${layout}<path fill="#eee2bb" fill-rule="evenodd" transform="translate(38 18)" d="${mark}"/></svg>`;
  }
  const mark=companyMarks[organization.specialty];
  const decoration=corporateLayouts[Math.floor(roll('layout')*corporateLayouts.length)];
  const initials=organization.name.split(' ').filter(word=>word!=='&').slice(0,2).map(word=>word[0]).join('');
  return `<svg class="organization-emblem organization-logo" viewBox="0 0 64 68" aria-hidden="true" style="color:${color}"><path fill="currentColor" fill-rule="evenodd" d="${mark}"/>${decoration}<text x="32" y="63" text-anchor="middle" fill="currentColor" font-family="Georgia,serif" font-weight="bold" font-size="14" letter-spacing="3">${initials}</text></svg>`;
}

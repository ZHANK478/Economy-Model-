import {pendingElectoralPact} from './electoral-pacts.js';
import {ministerialBriefings} from './ministerial-briefings.js';
import {ministryTitle} from './character-world.js';
import {pendingWorldDecisions,worldDecisionAnnouncements,worldDecisionNews} from './world-decisions.js';
import {historicalNews} from './historical-world.js';
import {interfaceSoundField} from './interface-audio.js';
import {campaignMusicMood, music, musicField} from './soundtrack.js';
import {autosavePeriod,campaignSaves} from './campaign-saves.js';
import {mountSaveMenu} from './save-menu.js';
import {mountOpeningGuide} from './opening-guide.js';
import {activeLanguage,interfaceLocale,languageField,setGameLanguage,translateText} from './localization.js';
import {cabinetMapNotice,electionMapNotice,renderMapNotice} from './map-notice.js';
import {formatGDPPercent,gdpSliderShare} from './gdp-slider.js';
import {territorialActive,territorialFiscalReformed,territorialRules} from './territorial-government.js';
import {partnerMarketsActive} from './trade-partners.js';
import {codexContent} from './codex-content.js';
import {atlasCurrency,atlasDomesticAmount,compactAtlasMoney} from './atlas-statistics.js';
import {BRITISH_CITIES,cityDossier,regionDossier,toggleCityStatus,toggleRegionSection,selectRegionSituation,selectTerritorialProgramme} from './city-dossier.js';
import {europeanUnionDossier,foreignCountryDossier} from './foreign-country-dossier.js';
import {CODEX_COUNTRIES,CODEX_REGIONS} from './codex-locations.js';
import {codexPanel,CODEX_CATEGORIES,characterCard} from './codex-panel.js';
import {britishOfficeHolder,characterRoster,personBriefing,territorialCharacter} from './character-roster.js';
import {latinCharacterName} from './leader-names.js';
import {currentCharacter} from './character-world.js';
import {fillCharacterPortraits} from './character-portraits.js';
let codexCategory='organizations',codexSection=null,codexPerson=null,codexReturnTab=null,characterCardId=null;
import {scenarioDiplomacyPanel} from './scenario-diplomacy-ui.js';
import {diplomacyActive,scenarioOrganizations} from './scenario-diplomacy.js';
import {overviewPanel,overviewIcon,overviewCategories,overviewEntries} from './overview-panel.js';
let overviewCategory='defense',overviewMode='policy',overviewItem=0;
import {connectionsPanel,connectionsIcon,CONNECTION_TABS} from './connections.js';
let connectionsTab='cabinet';
import {atlasControls,countryDossier,atlasIcon} from './atlas-interface.js';
import {mountMainMenu} from './main-menu.js';
import {savedCampaignLeader} from './campaign-leader.js';
import {strategyMap} from './strategy-map.js';
import {mountDeskAtlas} from './desk-atlas.js';
import {calculateTurn} from './turn-calculation.js';
let deskCameras={},disposeDeskAtlas;
let atlasWorld=false,atlasDossier=null,atlasCity=null,atlasRegion=null,atlasForeign=null,focusRegion=null,focusCity=null,focusForeign=null,atlasStatsExpanded=false;
let codexLocation=null,codexCity=null,codexOrganization=null,returnToCity=false;
const cityById=id=>BRITISH_CITIES.find(city=>city.id===id);
let strategyPanelOpen=false,atlasZoom=1,atlasPanX=0,atlasPanY=0;
import {scenarioOptions} from './country-scenarios.js';
import {countryMapView} from './country-map.js';
let mapTerritory='GBR',mapExpanded=true;
import {createAutosaveQueue} from './autosave-queue.js';
import {findReusableBill} from './legislation.js';
import {livelihoodView} from './livelihoods.js';
import {serviceIndustriesView} from './service-industries.js';
import {goodsPriceView} from './goods-prices.js';
import {regimePanel} from './regime-ui.js';
import {networkTransferQuote,networkQuoteMessage} from './network-transfers.js';
import {formatNumber} from './number-format.js';
import {socialActive,SOCIAL_KEYS} from './social-protection.js';
import {consumptionPanel,consumptionContent} from './consumption-ui.js';
import {startChoices,startFamilies} from './start-ui.js';
import {parliamentary,playerExecutive} from './parliamentary-state.js';
import {cabinetSeats} from './parliamentary.js';
import {pressEnabled,pressTitle} from './press-market.js';
import {pressDialog,updatePress,defaultPressPaper,unreadPressCount,readPressPaper,latestPressHeadline,electionNewspaper} from './press-ui.js';
import {nextTerritorialRequest,territorialRequestFunding,territorialRequestQuote,territorialRequests} from './territorial-requests.js';
import {availableTerritorialProgrammeCash,TERRITORIAL_PROGRAMS} from './territorial-programs.js';
import {resultNotice,policyNumber} from './presidential-decisions.js';
import {pendingDefenseNotice,acknowledgeDefenseNotice} from './defense.js';
import {armyView} from './army-ui.js';
import {constitutionalConflictResult,constitutionBoard,resetConstitutionUI,stageConstitution,stepConstitution,constitutionPatch,CHARTER_SECTIONS,charterTitle} from './constitution-ui.js';
import {campaignReadout,acknowledgeElection,electionDialog,pendingElectionNotice,electoralPactDialog} from './election-ui.js';
import {assetTransferOutcome,ownershipBoard,infrastructureBoard} from './asset-views.js';
import {compactGameCopy} from './ui-presentation.js';
import {productionPie} from './game-charts.js';
import {savedWorldEvents} from './world-events.js';
import {campaignEvent} from './campaign-events.js';
import {GOVERNMENT_PRESETS,COUNTRY_PRESETS,newGameOptions} from './start-presets.js';
import {validation} from './validation-results.js';
import {politicalValidation} from './political-validation-results.js';
import {extendedValidation} from './extended-validation-results.js';
import {createSimulation,comparePolicies,simulationEnvelope,importSimulationData,accountBalances,scheduleShock,scheduleOwnership,scheduleNetwork,scheduleRestructuring,replayJournal,copy,sanitizePolicy,realInterestRate,inputMatrix} from './engine.js';
import {VERSION,POLICY_FIELDS,POLICY_CHECKS,POLICY_CHOICES,PARAMETER_FIELDS,MODULES,SECTORS,MODEL_PROFILES} from './config.js';
import {createBrowserStorage,readDevicePreference,writeDevicePreference} from './storage.js';
import {autosaveSnapshot,autosaveEnvelope,saveFile,readSaveFile} from './save-files.js';
import {extendedViews} from './extended-views.js';
import {politicalViews,handlePoliticalAction} from './political-views.js';
import {METRIC_INFO,comparableGDP,wageBreakdown,budgetBalance,metricSeries,currentMetric,monthlyMetricChange,GROUP_DIMENSIONS,electorateSeries} from './dashboard-data.js';
import {PARTY_FAMILIES,partyDisplayName,FORMS,ELECTORAL_SYSTEMS,PRESIDENT_SYSTEMS,REGIMES} from './political-config.js';
import {createUIObservation} from './ui-observation.js';
import {presidentialStanding} from './political-reporting.js';
import {unresolvedInitiatives} from './political-agenda.js';
import {policyAuthority,executePolitical,enableLocalGovernment,enablePartyPrograms,enableInstantPolitics,enableElectionExperience,enableAccountability,enableStablePreferences,enableFactionControl,enablePoliticalDynamics,enableOppositionCompetition,enablePresidentialDecisions,enableDefense,plannedPolicy,decisionBudget,assertDecisionAvailable} from './political-system.js';

const STORE='economy-model-v5',CHECKPOINT='economy-checkpoint-v5';
const storage=createBrowserStorage();
const saves=campaignSaves(storage);
let legacySave=null;
try{legacySave=await storage.get('economy-model-v4')??await storage.get('economy-model-v31')??await storage.get('economy-model-v3')??localStorage.getItem('economy-model-v2')??localStorage.getItem('economy-model-v1');}catch{/* Do not overwrite inaccessible older data. */}
const app=document.getElementById('app');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const showOpeningGuide=mountOpeningGuide(app,esc);
const n=formatNumber;
const signed=(x,d=1)=>(x>0?'+':'')+n(x,d);
const money=x=>n(x/1000,2);
const pct=x=>n(x,1)+'%';
const monthNames=new Intl.DateTimeFormat(interfaceLocale(),{month:'long',timeZone:'UTC'});
const months=Array.from({length:12},(_,month)=>monthNames.format(new Date(Date.UTC(2000,month,1))));
const date=(month,short=false)=>short?`${String(month%12+1).padStart(2,'0')}.${(state.startYear??2026)+Math.floor(month/12)}`:`${months[month%12]} ${(state.startYear??2026)+Math.floor(month/12)}`;
const iconCheck='<span class="tick">✓</span>';
let consumptionOpen=false,consumptionGroup=2,consumptionTimer=null;
let hasExistingSave=false, campaignLeader=null, campaignId=crypto.randomUUID();
const GUIDE_COMPLETE='whips-opening-guide-complete';
let guideComplete=await readDevicePreference(GUIDE_COMPLETE)==='1';
function gameOptions(options){
 return {...options,territorialGovernment:true,londonMayorRevision:1,politicalOptions:{...options.politicalOptions,politicalDynamicsRevision:1,historicalWorld:1,...(options.scenario?.id==='uk-2000'?{ministerialBriefings:1}:{})}};
}
let state=createSimulation(gameOptions(newGameOptions())),draft=copy(state.policy),checkpoint=null,comparison=null;
let view='policy',policyTab=null,decisionCollection='treasury',chartMetric='gdpPerCapitaReal',compareMetric='gdpPerCapitaReal',compareMonths=24,compareSource='current';
let comparisonBase=null;
let worldNewsOpen=false,campaignOpen=false,announcedCampaign=null,campaignFeedback=null,settingsOpen=false,proposalOpen=false,proposalId=null,announcedProposal=null,trendMetric=null,electorateDimension='age',electorateMeasure='party',electorateParty=null;
let openCategory='decisions',resultBillId=null,resultExecutive=null,observedDecisionKeys=new Set(),trackedView=null,trackedCategory=null,trackedPolicy=null,trackedWindows=new Set(),sectionObserver=null;
let usageStorage=null;try{usageStorage=globalThis.localStorage;}catch{}
const usage=createUIObservation({storage:usageStorage});
const constitutionUI={section:null,patch:{}};
const assetUI={sector:null,network:null,ownershipKind:'privatize',networkKind:'networkSale',points:10,networkPoints:10,compensation:100};
let territorialRequestId=null,openedWorldDecision=null;
let electionOpenId=null,trackedCharter=null,pressState={},checkpointPress=null;
function enableBriefingOffices(){
  if(state.scenario?.id==='uk-2000'&&state.characters&&state.politics.executive.inOffice&&!state.politics.ministerialBriefings)
    executePolitical(state,{kind:'enableMinisterialBriefings'});
}
const guideStage=()=>guideComplete?null:pressState.openingGuide;
function completeGuide(){
  guideComplete=true;
  return writeDevicePreference(GUIDE_COMPLETE,'1');
}
function setGuide(stage){
  pressState.version=1;
  pressState.openingGuide=stage;
}
let mobileOpen=false,busy=false,toastTimer,saveStatus='Партия ещё не сохранена';
try {
  const saved=await storage.getSnapshot(STORE);
  if(saved){const wrapper=saved;state=importSimulationData({...autosaveEnvelope(wrapper),leader:wrapper.leader});hasExistingSave=true;campaignId=wrapper.campaignId??'legacy-active';campaignLeader=savedCampaignLeader(wrapper.leader);storage.adoptJournal(STORE,state.journal);saveStatus='Сохранено на этом устройстве';draft=sanitizePolicy(wrapper.draft);if(wrapper.newspaper?.version===1)pressState=wrapper.newspaper;if(pressState.openingGuide==='done'&&!guideComplete)await completeGuide();}
  const snap=await storage.get(CHECKPOINT);if(snap){const data=JSON.parse(snap);checkpoint=importSimulationData(data);checkpointPress=data.newspaper??null;}
} catch(e) {setTimeout(()=>toast('Не удалось прочитать сохранение. Открыты исходные условия.'),0);}
if(!state.politics.enabled){view='country';openCategory='statistics';}
let scenarioOrganization=null,confirmScenarioExit=false;
function enableTerritorialGovernment(state){
  if(!state.politics.enabled)return;
  if(state.territorialGovernment?.offices['TLI:region'])executePolitical(state,{kind:'unifyLondonMayor'});
  if(!state.politics.executive.inOffice)return;
  if(!territorialActive(state)){
    executePolitical(state,{kind:'activateTerritorialGovernment',londonMayorRevision:1});
  }
  if(!territorialFiscalReformed(state))executePolitical(state,{kind:'reformTerritorialFiscal'});
}
function enableBritishScenario(state){
  if(state.scenario?.id==='uk-2000'&&state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.electoralPactRevision)
    executePolitical(state,{kind:'enableElectoralPacts'});
  if(state.politics.guidedOpening&&state.month===0&&!state.politics.openingPollRevision)
    executePolitical(state,{kind:'alignOpeningPoll'});
  if(state.politics.governmentGoals&&!state.politics.governmentProgrammeRetired)
    executePolitical(state,{kind:'retireGovernmentProgramme'});
  if(!state.politics.enabled||!state.politics.executive.inOffice||!scenarioOrganizations(state).length)return;
  if(!diplomacyActive(state))executePolitical(state,{kind:'activateScenarioDiplomacy'});
  if(state.economy&&!partnerMarketsActive(state))executePolitical(state,{kind:'enablePartnerTrade'});
  if(state.economy&&!pressEnabled(state))executePolitical(state,{kind:'enablePressMarket'});
}
if(state.politics.enabled){const edits=Object.fromEntries(Object.entries(draft).filter(([key,value])=>value!==state.policy[key]));enableInstantPolitics(state);enableElectionExperience(state);enableAccountability(state);enableStablePreferences(state);enableFactionControl(state);enablePoliticalDynamics(state);enableOppositionCompetition(state);enablePartyPrograms(state);enableLocalGovernment(state);enableTerritorialGovernment(state);enablePresidentialDecisions(state);enableDefense(state);enableBritishScenario(state);enableBriefingOffices();if(state.politics.enabled&&state.politics.executive.inOffice&&(!state.politics.livingWorld||state.stochastic))executePolitical(state,{kind:'setLivingWorld'});if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.agendaSlots!==1)executePolitical(state,{kind:'setAgendaSlots',slots:1});if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.decisionLimit!==3)executePolitical(state,{kind:'setDecisionLimit',limit:3});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.dashboardMode)executePolitical(state,{kind:'setDashboardMode'});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.partyContinuity)executePolitical(state,{kind:'setPartyContinuity'});draft={...plannedPolicy(state),...edits};}

snapshotDecisions();
usage.context({seed:state.seed,startYear:state.startYear,month:state.month});usage.session();usage.visibility(document.visibilityState!=='hidden');usage.event('viewport',null,{width:globalThis.innerWidth??null,height:globalThis.innerHeight??null});

// Navigation always returns to the section chooser; simulation state is untouched.
let mapNotice=null,mapNoticeTimer;
function clearMapNotice(){
  clearTimeout(mapNoticeTimer);
  mapNotice=null;
  app.querySelector('.map-notice')?.remove();
}
function showMapNotice(notice){
  clearMapNotice();
  mapNotice=notice;
  mapNoticeTimer=setTimeout(clearMapNotice,10000);
}
function resetSectionNavigation(){characterCardId=null;consumptionOpen=false;if(consumptionTimer)clearTimeout(consumptionTimer);policyTab=null;decisionCollection='treasury';assetUI.sector=null;assetUI.network=null;resetConstitutionUI(constitutionUI);}
function toast(message,duration=4500) {
  const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),duration);
}
const captureCampaign=()=>autosaveSnapshot(state,draft,pressState,VERSION,campaignLeader,campaignId);
let savedAutoPeriod=autosavePeriod(state.month),requestedAutoPeriod=savedAutoPeriod,queuedAutosave;
function updateSaveStatus(message){
  saveStatus=message;
  for(const id of ['save-status','save-hud']){
    const element=document.getElementById(id);
    if(element)element.textContent=translateText(message);
  }
}
const autosave=createAutosaveQueue({
 capture:()=>queuedAutosave,
 write:({id,name,date,snapshot})=>saves.saveAutomatic(id,name,date,snapshot),
 onStatus:(status,saved)=>{
  if(status==='saved'){
    savedAutoPeriod=autosavePeriod(saved.snapshot.month);
    requestedAutoPeriod=Math.max(requestedAutoPeriod,savedAutoPeriod);
    updateSaveStatus('Автосохранено · '+saved.date);
  }else if(status==='error'){
    requestedAutoPeriod=savedAutoPeriod;
    updateSaveStatus('Автосохранение недоступно.');
  }
 },
 onError:()=>toast(translateText('Автосохранение недоступно. Откройте «Сохранить игру» и скачайте копию.'))
});
export function flushAutosave(){return autosave.flush();}
function scheduleCampaignAutosave(){
  const period=autosavePeriod(state.month);
  if(period<=requestedAutoPeriod)return;
  const party=state.politics.parties?.find(p=>p.id===state.politics.executive.playerParty);
  queuedAutosave={id:campaignId,name:party?partyDisplayName(party):'Государство',date:date(state.month,true),snapshot:captureCampaign()};
  requestedAutoPeriod=period;
  autosave.request();
}
function resetCampaignAutosave(status){
  savedAutoPeriod=requestedAutoPeriod=autosavePeriod(state.month);
  updateSaveStatus(status);
}
function download(filename,content,type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportCampaign(compressed=false) {
  usage.event('export','complete-game');
  try {
    const payload=simulationEnvelope(state);
    payload.draftPolicy=copy(draft);
    payload.newspaper=copy(pressState);
    if(campaignLeader)payload.leader=campaignLeader;
    payload.monthlyStatistics=state.history;
    payload.uiObservation=usage.report();
    payload.checkpoint=checkpoint??null;
    payload.previousSave=legacySave?JSON.parse(legacySave):null;
    const packed=await saveFile(payload,{compressed});
    download(`economy-${date(state.month,true)}${packed.extension}`,packed.blob);
  } catch(error) {
    throw new Error('Не удалось подготовить файл: '+error.message,{cause:error});
  }
}
const pending=()=>{const baseline=state.politics.enabled?plannedPolicy(state):state.policy;return Object.keys(draft).filter(key=>draft[key]!==baseline[key]);};
const previous=()=>state.history.find(x=>x.month===state.month-1)??state.metrics;

const chartOptions=[['gdpPerCapitaReal','ВВП / человек'],['inflationYoY','Инфляция'],['unemployment','Безработица'],['debtRatio','Госдолг'],['realGDPAnnualized','Общий ВВП'],['population','Население'],['giniDisposable','Джини'],['hdi','ИЧР']];
const metricNames={gdpPerCapitaReal:'Реальный ВВП на человека',inflationYoY:'Инфляция за 12 месяцев',unemployment:'Безработица',debtRatio:'Госдолг / ВВП',exchangeRate:'Курс валюты',realGDPAnnualized:'Общий реальный ВВП, млн в базовых ценах · годовой темп',population:'Население, млн',giniDisposable:'Джини располагаемых доходов · 0–100',hdi:'ИЧР · модельная оценка'};
function chart(series,key,{compare=false,compact=false,multi=false,valueLabel,highlightLatest=false}={}) {
  const data=series.map(x=>({...x,points:x.points.filter(p=>p.month>=0&&Number.isFinite(p[key]))}));
  const points=data.flatMap(x=>x.points);
  if(points.length<2||new Set(points.map(p=>p.month)).size<2) return '<div class="chart-empty">—</div>';
  const narrow=Number.isFinite(globalThis.innerWidth)&&globalThis.innerWidth<=600;
  const W=narrow?360:compact?420:780,H=compact||narrow?220:260,left=valueLabel?76:52,right=18,top=18,bottom=36;
  const show=valueLabel??(v=>n(v,key==='hdi'?3:key==='gdpPerCapitaReal'?0:1));
  let lo=Math.min(...points.map(p=>p[key])),hi=Math.max(...points.map(p=>p[key]));
  const padding=Math.max((hi-lo)*.15,key==='hdi'?.005:key==='gdpPerCapitaReal'?50:key==='exchangeRate'?.02:.5);
  lo-=padding;hi+=padding;
  const from=Math.min(...points.map(p=>p.month)),to=Math.max(...points.map(p=>p.month));
  const x=m=>left+(m-from)/(to-from)*(W-left-right);
  const y=v=>top+(hi-v)/(hi-lo)*(H-top-bottom);
  let out=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc((METRIC_INFO[key]?.label??metricNames[key]??'Поддержка избирателей'))}, помесячный график">`;
  for(let i=0;i<5;i++) {
    const val=lo+(hi-lo)*i/4,py=y(val);
    out+=`<line x1="${left}" y1="${py}" x2="${W-right}" y2="${py}" stroke="#e8effb"/><text x="${left-9}" y="${py+4}" text-anchor="end" fill="#456794" font-size="10">${esc(show(val))}</text>`;
  }
  if(!compare&&data[0].points.length>1) {
    const line=data[0].points.map(p=>`${x(p.month)},${y(p[key])}`).join(' ');
    out+=`<defs><linearGradient id="chart-fill-${key}-${highlightLatest?'atlas':compact?'small':'large'}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#456794" stop-opacity=".24"/><stop offset="100%" stop-color="#456794" stop-opacity="0"/></linearGradient></defs><polygon points="${x(from)},${H-bottom} ${line} ${x(to)},${H-bottom}" fill="url(#chart-fill-${key}-${highlightLatest?'atlas':compact?'small':'large'})"/>`;
  }
  data.forEach((s,j)=>{
    const poly=s.points.map(p=>`${x(p.month)},${y(p[key])}`).join(' ');
    out+=`<polyline points="${poly}" fill="none" stroke="${j%2===0?'#174ca1':'#c52b39'}" stroke-width="2.4" ${j>1?`stroke-dasharray="${[3,7,2,5][(j-2)%4]} ${[3,3,6,6][(j-2)%4]}"`:''} ${j===0&&compare&&!multi?'stroke-dasharray="5 4"':''} stroke-linecap="round" stroke-linejoin="round"/>`;
    const end=s.points.at(-1),before=s.points.at(-2);
    if(highlightLatest&&before&&end.month===before.month+1)out+=`<line class="atlas-chart-latest" x1="${x(before.month)}" y1="${y(before[key])}" x2="${x(end.month)}" y2="${y(end[key])}" stroke="#9a6329" stroke-width="4" stroke-linecap="round"/>`;
    if(end) out+=`<circle cx="${x(end.month)}" cy="${y(end[key])}" r="3.5" fill="${j%2===0?'#174ca1':'#c52b39'}" stroke="white" stroke-width="2"/>`;
  });
  const ticks=new Set(Array.from({length:5},(_,i)=>Math.round(from+(to-from)*i/4)));
  for(const month of ticks)out+=`<text x="${x(month)}" y="${H-10}" fill="#456794" text-anchor="middle" font-size="10">${date(month,true)}</text>`;
  const first=data[0].points;
  const byMonth=data.map(ds=>new Map(ds.points.map(point=>[point.month,point])));
  first.forEach((p,i)=>{
    const next=first[i+1],before=first[i-1];const width=Math.max(6,((next?x(next.month):W-right)-(before?x(before.month):left))/2);
    const values=data.map((ds,j)=>{const v=byMonth[j].get(p.month);return v?`${ds.name}: ${show(v[key])}`:'';}).filter(Boolean).join(' · ');
    out+=`<rect data-chart-tip="${esc(date(p.month)+' · '+values)}" x="${x(p.month)-width/2}" y="${top}" width="${width}" height="${H-top-bottom}" fill="transparent"><title>${esc(date(p.month)+' · '+values)}</title></rect>`;
  });
  return out+'</svg><div class="chart-tip"></div>';
}
const CHANGE_HIGHER=new Set(['budgetBalance','gdpGrowthYoY','gdpPerCapitaRolling','gdpPerCapitaReal','realGDPRolling','realGDPAnnualized','realIncomeIndex','meanWageReal','meanWageNominal','hdi','lifeExpectancy','reservesUSD','governmentPartyRating','presidentialVoteShare']);
const CHANGE_LOWER=new Set(['unemployment','inflationYoY','debtRatio','giniDisposable','giniMarket']);
const CHANGE_POINTS=new Set(['gdpGrowthYoY','inflationYoY','unemployment','debtRatio','governmentPartyRating','presidentialVoteShare']);
function monthlyChange(key){
 const delta=monthlyMetricChange(state,key),digits=METRIC_INFO[key]?.digits??1;
 if(delta===null)return `<span class="change neutral" data-change="${key}">${state.month===0?'Начало':'—'}</span>`;
 const changed=Number(delta.toFixed(digits))!==0;
 const color=!changed?'neutral':CHANGE_HIGHER.has(key)?(delta>0?'positive':'negative'):CHANGE_LOWER.has(key)?(delta<0?'positive':'negative'):'neutral';
 const arrow=!changed?'':delta>0?'↑ ':'↓ ';
 return `<span class="change ${color}" data-change="${key}">${arrow}${changed?signed(delta,digits):n(0,digits)}${CHANGE_POINTS.has(key)?' п.п.':''} </span>`;
}
function spark(key) {
  const pts=metricSeries(state,key).slice(-18);if(pts.length<2) return '';
  const values=pts.map(p=>p[key]),lo=Math.min(...values),hi=Math.max(...values),range=Math.max(hi-lo,.001);
  const points=values.map((v,i)=>`${i/(values.length-1)*65},${26-(v-lo)/range*23}`).join(' ');
  return `<svg class="spark" viewBox="0 0 65 29" aria-hidden="true"><polyline points="${points}" fill="none" stroke="#456794" stroke-width="1.4"/></svg>`;
}
function cards() {
  const m=state.metrics,prev=previous();
  const data=[
    ['gdpPerCapitaReal','Реальный ВВП / человек',n(m.gdpPerCapitaReal,0),'$ базы',true,false],
    ['realGDPAnnualized','Общий реальный ВВП',money(m.realGDPAnnualized),'млрд $ базы / год',true,false],
    ['population','Население',n(m.population,3),'млн человек',true,false],
    ['inflationYoY','Инфляция за 12 месяцев',n(m.inflationYoY,1),'%',false,true],
    ['unemployment','Безработица',n(m.unemployment,1),'%',false,true],
    ['realIncomeIndex','Реальные доходы',n(m.realIncomeIndex,1),'индекс',true,false],
    ['gdpGrowthYoY','Рост реального ВВП',(m.gdpGrowthYoYDefined===0?'—':signed(m.gdpGrowthYoY,1)),'% г/г',true,true],
    ['exchangeRate','Национальная валюта',n(m.exchangeRate,3),'ед. / $',false,false],
    ['deficitRatio','Дефицит бюджета',signed(m.deficitRatio,1),'% ВВП',false,true],
    ['debtRatio','Государственный долг',n(m.debtRatio,1),'% ВВП',false,true],
    ['giniDisposable','Джини доходов',n(m.giniDisposable,1),'из 100',false,false],
    ['hdi','ИЧР · модельная оценка',n(m.hdi,3),'из 1',true,false]
  ];
  const allCards=data.map(([key,name,value,unit,higher,pp])=>{
    const delta=m[key]-prev[key],color=state.month===0||Math.abs(delta)<.001?'neutral':((delta>0)===higher?'positive':'negative');
    const formatted=state.month===0?'Исходные условия':`${signed(delta,key==='exchangeRate'?3:1)} ${pp?'п.п.':''} за ход`;
    return `<div class="kpi"><div class="name">${name}</div><div class="value">${value} <span class="unit">${unit}</span></div><div class="change ${color}">${formatted}</div>${spark(key)}</div>`;
  });
  return '<div class="kpis">'+allCards.slice(0,6).join('')+'</div><details class="more-indicators"><summary>Ещё показатели страны</summary><div class="kpis">'+allCards.slice(6).join('')+'</div></details>';
}
const DECISION_COLLECTIONS=[
  {id:'treasury',label:'Казна',art:2,topics:[
    ['Бюджет','Бюджет'],['Налоги','Налоги и пошлины'],['Кредит','Банки и кредит'],['Валюта','Валюта']
  ]},
  {id:'economy',label:'Хозяйство',art:1,topics:[
    ['Структура','Предприятия и конкуренция'],['Энергетика','Топливо и электричество'],
    ['Инфраструктура','Инфраструктура','infrastructure'],['Собственность','Собственность','ownership']
  ]},
  {id:'society',label:'Общество',art:9,topics:[
    ['Услуги','Образование и здравоохранение'],['Труд','Труд и миграция'],
    ['Жильё','Жильё',null,true],['Пенсии','Пенсии',null,true],['Безработица','Пособия по безработице',null,true]
  ]},
  {id:'government',label:'Управление',art:6,topics:[
    ['Институты','Суды и управление'],['СМИ','Правила для СМИ']
  ]}
];
const DECISION_TOPICS=DECISION_COLLECTIONS.flatMap(collection=>collection.topics);
const DECISION_TOPIC_BY_FIELD={
  publicInvestment:'Инфраструктура',minimumWage:'Труд',migrationOpenness:'Труд',
  fuelPricing:'Энергетика',fuelTariff:'Энергетика',energyPricing:'Энергетика',energyTariff:'Энергетика',
  courtBudget:'Институты',taxAdministrationBudget:'Налоги',openProcurement:'Бюджет',
  freeMedia:'СМИ',censorshipScope:'СМИ',education:'Услуги',healthcare:'Услуги'
};
const decisionTopic=(key,group)=>DECISION_TOPIC_BY_FIELD[key]??group;
const decisionFieldLabel=(key,name)=>key==='publicInvestment'?'Строительство инфраструктуры':key==='militaryBudget'?'Военный бюджет':name;
const policyPermitted=key=>(socialActive(state)||!SOCIAL_KEYS.includes(key))&&
  (!parliamentary(state)||playerExecutive(state)||policyAuthority(state,key)!=='executive');

function policyControls(topic) {
 const locked=state.politics.enabled&&decisionBudget(state).optionalRemaining===0;
 const centralRates=state.territorialGovernment?.fiscal?.centralRates;
 const mergedTaxNotice=topic==='Налоги'&&Object.values(centralRates??{}).some(rate=>rate>0)?
   `<p class="small muted">Действующие ставки после централизации · НДС ${pct(state.policy.vat+centralRates.vat)}, доходы ${pct(state.policy.incomeTax+centralRates.incomeTax)}, прибыль ${pct(state.policy.corporateTax+centralRates.corporateTax)}.</p>`:'';
 const territorialTransfers=['regionalBudgetTransfers','cityBudgetTransfers'];
 const showTerritorialTransfers=territorialFiscalReformed(state)&&territorialRules(state).spending==='local';
 const applicable=key=>policyPermitted(key)&&(showTerritorialTransfers||!territorialTransfers.includes(key))&&policyAuthority(state,key)!=='treaty'&&!(key==='rate'&&draft.monetaryRegime!=='discretion')&&!(key==='inflationTarget'&&!['discretion','rule'].includes(draft.monetaryRegime))&&!(key==='energyTariff'&&draft.energyPricing==='market')&&!(key==='fuelTariff'&&draft.fuelPricing==='market')&&!(key==='fxIntervention'&&['currencyBoard','dollarized'].includes(draft.monetaryRegime))&&!(key==='infrastructureFeeCap'&&draft.infrastructurePricing!=='capped');
 return mergedTaxNotice+(state.politics.enabled&&state.politics.constitution.independentCB&&topic==='Кредит'?`<div class="cb-rate">Ставка ЦБ <b>${pct(state.monetary.effectiveRate)}</b></div>`:'')+(topic==='Налоги'&&policyAuthority(state,'tariff')==='treaty'?'<p class="small muted">Внешний тариф определяется общей торговой политикой ЕС.</p>':'')+POLICY_CHOICES.filter(x=>decisionTopic(x[0],x[2])===topic&&policyPermitted(x[0])).map(([key,label,,choices])=>`<label class="field policy-choice">${esc(label)}<select data-policy-choice="${key}" ${locked?'disabled':''}>${choices.map(([value,name])=>`<option value="${value}" ${draft[key]===value?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`).join('')+POLICY_FIELDS.filter(x=>((state.economy?.revision??0)>=6?x[0]!=='taxEnforcement':!['researchBudget','taxAdministrationBudget'].includes(x[0]))&&decisionTopic(x[0],x[6])===topic&&applicable(x[0])&&policyAuthority(state,x[0])!=='centralBank').map(([key,name,min,max,step,unit])=>`<div class="policy-control"><div class="control-title"><label for="policy-${key}">${key==='transfers'&&!socialActive(state)?'Пособия и пенсии':esc(decisionFieldLabel(key,name))}<small>${esc(unit)}</small></label><input class="control-value policy-value-entry" id="policy-${key}" type="text" inputmode="decimal" value="${n(draft[key],step<1?2:0)}" data-policy-number="${key}" ${locked?'disabled':''} style="width:${Math.max(4,n(min,step<1?2:0).length,n(max,step<1?2:0).length)}ch" aria-label="${name}, точное значение, ${esc(unit)}"></div><input type="range" id="range-${key}" min="${min}" max="${max}" step="${step}" value="${draft[key]}" data-policy="${key}" ${locked?'disabled':''} aria-label="${name}"></div>`).join('');
}
function draftBaseRate(){
  if(state.politics.enabled)return state.monetary.effectiveRate;
  const regime=draft.monetaryRegime;
  return regime==='discretion'?draft.rate:regime==='rule'?Math.max(0,Math.min(40,state.parameters.neutralRealRate*100+draft.inflationTarget+1.5*(state.metrics.inflationYoY-draft.inflationTarget)+.5*state.metrics.outputGap)):['currencyBoard','dollarized'].includes(regime)?state.world.globalRate:Math.max(0,Math.min(40,state.world.globalRate+state.expectedInflation*100-2+Math.max(0,25-state.metrics.bankLiquidity)*.08));
}
function decisionSettings(topic) {
  const locked=state.politics.enabled&&decisionBudget(state).optionalRemaining===0;
  const checks=POLICY_CHECKS.filter(([key,,group])=>decisionTopic(key,group)===topic&&policyPermitted(key)&&
    (key!=='liquiditySupport'||['discretion','rule'].includes(draft.monetaryRegime)));
  const controls=policyControls(topic);
  const regime=topic==='Институты'?regimePanel(state,{n,pct,row,esc,canAct:decisionBudget(state).optionalRemaining>0}):'';
  return `<div class="decision-settings">${controls}${checks.length?`<div class="policy-checks">${checks.map(([key,label])=>`<label class="check"><input type="checkbox" data-policy-check="${key}" ${locked?'disabled':''} ${draft[key]?'checked':''}>${esc(label)}</label>`).join('')}</div>`:''}${regime}${!controls&&!checks.length&&!regime?'<p>Сейчас здесь нет доступных решений.</p>':''}</div>`;
}

const decisionsBack=()=>'<button class="decision-back" data-view="policy" data-open-view="true"><span aria-hidden="true">←</span> Все решения</button>';
function decisionIndex(){
  const collection=DECISION_COLLECTIONS.find(item=>item.id===decisionCollection)??DECISION_COLLECTIONS[0];
  const artStyle=state.scenario?.id==='uk-2000'
    ?`style="--decision-image:url('./assets/codex-reference/${({treasury:'bank-of-england',economy:'ironbridge',government:'westminster'})[collection.id]??'greenwich'}.webp')"`:'';
  const tabs=DECISION_COLLECTIONS.map(({id,label})=>`<button data-decision-collection="${id}" aria-pressed="${collection.id===id}">${label}</button>`).join('');
  const topics=collection.topics.filter(([, , , social])=>!social||socialActive(state));
  return `<div class="decision-index">
    <nav class="decision-bookmarks" aria-label="Разделы решений">${tabs}</nav>
    <div class="decision-folio">
      <nav class="decision-topics" aria-label="Темы раздела «${collection.label}»">
        ${topics.map(([id,label,destination])=>`<button ${destination?`data-view="${destination}" data-open-view="true"`:`data-policy-tab="${id}"`}>${label}</button>`).join('')}
      </nav>
      <div class="decision-art ${artStyle?'decision-art-uk':'decision-art-world'}" aria-hidden="true" ${artStyle}></div>
    </div>
  </div>`;
}
function sidebar() {
  if(!policyTab)return decisionIndex();
  const label=DECISION_TOPICS.find(([id])=>id===policyTab)?.[1]??policyTab;
  return `<section class="decision-page">${decisionsBack()}<h3 tabindex="-1">${esc(label)}</h3>${decisionSettings(policyTab)}</section>`;
}
const ROW_GRAPHS={'ВВП · номинальный':'gdpUSDRolling','ВВП · реальный':'realGDPRolling','Инфляция':'inflationYoY','Безработица':'unemployment','Население':'population','Средняя зарплата · до налогов':'meanWageNominal','Средняя реальная зарплата':'meanWageReal','ИЧР · модельная оценка':'hdi','Джини · после налогов и трансфертов':'giniDisposable','Джини · до перераспределения':'giniMarket','Ожидаемая продолжительность жизни':'lifeExpectancy','Рождаемость':'totalFertilityRate','Государственный долг':'debtRatio','Валютные резервы':'reservesUSD'};
const graphButton=key=>`<button class="graph-button" data-graph="${key}" aria-label="Динамика: ${esc(METRIC_INFO[key]?.label??key)}" title="Открыть график"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18M6 15l5-5 4 3 5-8" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>`;
function row(label,value,meta='') {return `<div class="data-row"><div>${label}${meta?`<div class="meta">${meta}</div>`:''}</div><div class="row-value"><b>${value}</b>${ROW_GRAPHS[label]?graphButton(ROW_GRAPHS[label]):''}${ROW_GRAPHS[label]?monthlyChange(ROW_GRAPHS[label]):''}</div></div>`;}
function bar(label,value,display,color='#a8bce0') {return `<div class="bar-row"><div class="bar-title"><span>${label}</span><b>${display}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,value))}%;background:${color}"></div></div></div>`;}
function country(){
 const m=state.metrics,gdp=comparableGDP(state),baseYear=state.startYear??2000,wage=wageBreakdown(state);
 const tiles=[['realGDPRolling','Общий ВВП',money(gdp.total),'млрд $ / год'],['gdpPerCapitaRolling','ВВП на человека',n(gdp.perCapita,0),'$ / год'],['population','Население',n(m.population,2),'млн'],['unemployment','Безработица',n(m.unemployment,1),'%'],['realIncomeIndex','Реальные доходы',n(m.realIncomeIndex,1),'начало = 100'],['meanWageReal','Реальная зарплата',n(m.meanWageReal,0),'$ базы / месяц'],['giniDisposable','Индекс Джини',n(m.giniDisposable,1),'/ 100'],['hdi','ИЧР',n(m.hdi,3),'/ 1'],['debtRatio','Государственный долг',n(m.debtRatio,1),'% ВВП']];
 const revenue=state.month?m.governmentSpending-state.government.lastDeficit:null;
 const banks=m.capitalRatio<state.policy.bankCapitalRequirement||m.liquidityCoverage<100||m.npl>10?'Требуют внимания':'Без критических сигналов';
 return `<section class="country-summary"><h2>Страна</h2><p class="small muted">${state.resourceMode?'Сырьевая':'Диверсифицированная'} экономика · ВВП и реальная зарплата в ценах ${baseYear} года</p><article class="country-reserves"><div class="country-reserves-main"><div class="country-reserves-label">Валютные резервы ${graphButton('reservesUSD')}</div><strong>${Number.isFinite(m.reservesUSD)?n(m.reservesUSD,1):'—'} <small>млн $</small></strong>${monthlyChange('reservesUSD')}</div><div class="country-reserves-cover"><span>Резервы / месячный импорт</span><strong>${Number.isFinite(m.reserveMonths)?n(m.reserveMonths,1):'—'} <small>мес.</small></strong></div></article><div class="country-grid">${tiles.map(([key,label,value,unit])=>`<article class="kpi country-stat"><div class="name">${label} ${graphButton(key)}</div><div class="value">${value} <span class="unit">${unit}</span></div>${monthlyChange(key)}${spark(key)}</article>`).join('')}</div></section>
 <details class="panel country-detail"><summary>Экономика и финансы</summary>${wage.estimated?'<div class="small muted">Стартовая оценка зарплат</div>':''}${row('Зарплата до налогов',wage.gross===null?'—':n(wage.gross,0)+' ед. / месяц','На одного занятого · текущие цены'+(wage.estimated?' · стартовая оценка':''))}${row('Зарплата на руки',wage.net===null?'—':n(wage.net,0)+' ед. / месяц','После подоходного налога · на одного занятого')}${row(socialActive(state)?'Налоги и пенсионные взносы':'Подоходный налог с зарплат',wage.taxRate===null?'—':pct(wage.taxRate),'Фактическая доля удержаний в фонде зарплат')}${row('Доходы бюджета',revenue===null?'—':money(revenue)+' млрд / месяц')}${row('Расходы бюджета',state.month?money(m.governmentSpending)+' млрд / месяц':'—')}${row('Ставка новых кредитов',pct(m.lendingRate)+' годовых')}${row('Доступность кредитов',pct(state.bank.creditSupply*100))}${row('Банки',banks)}${row('Курс валюты',n(m.exchangeRate,3)+' ед. / $')}${row('Резервы / импорт',n(m.reserveMonths,1)+' мес.')}${worldConditions()}<details class="country-subdetail"><summary>Структура производства</summary>${productionComposition()}${serviceIndustriesView(state,{n})}</details></details>
 <details class="panel country-detail"><summary>Общество</summary>${row('Продолжительность жизни',n(m.lifeExpectancy,1)+' лет')}${row('Доступность медицины',pct(m.totalHealthAccess))}${row('Доступность образования',pct(m.totalEducationAccess))}${row('Доля 65+',pct(m.elderlyShare))}${row('Относительная бедность',pct(m.relativePoverty))}<details class="country-subdetail"><summary>Возрастная пирамида</summary>${populationPyramid()}</details></details>
${goodsPriceView(state,{n})}
${consumptionPanel(state,{open:consumptionOpen,selected:consumptionGroup,n,esc})}
`;
}
function productionComposition(){
 const va=state.lastReport.gdp?.sectorValueAdded??state.firms.map((f,j)=>f.production*(f.price-inputMatrix(state).reduce((v,row,i)=>v+row[j]*state.firms[i].price,0)-f.importCoefficient*state.exchangeRate*state.worldPriceIndex/100));
 return productionPie(state.firms.map((f,i)=>({label:f.name,value:va[i]})),{percent:share=>pct(share*100)})+livelihoodView(state,{n,pct})+`<details class="country-subdetail"><summary>Занятость по отраслям</summary>${state.firms.map(f=>row(esc(f.name),n(f.workers*1000,0)+' тыс.')).join('')}</details>`;
}
function countryDetails() {
  const m=state.metrics,annualPopulation=state.history.filter(r=>r.month>=state.month-11).reduce((v,r)=>v+r.population,0)/12;
  const development=m.hdi>=.8?'очень высокий':m.hdi>=.7?'высокий':m.hdi>=.55?'средний':'низкий';
  return `<section class="panel country-lead"><span class="eyebrow">ПАСПОРТ СТРАНЫ · ${date(state.month,true)}</span><h2>Вымышленная республика</h2><p>${state.resourceMode?'Страна с большой ролью сырьевого экспорта':'Страна с диверсифицированным экспортом'}, население ${n(m.population,2)} млн человек. Реальный выпуск на человека — ${n(m.gdpPerCapitaReal,0)} в ценах начала игры. Модельный уровень человеческого развития — ${development}.</p><p class="small muted">Это справочник о вашей стране, не официальный рейтинг. Денежные величины в базовых ценах, текущих долларах и по условному ППС различаются.</p></section>
    <div class="two-cols"><section class="panel"><h2>Экономика</h2>${row('ВВП · номинальный',money(m.gdpUSDRolling)+' млрд $','Последние 12 месяцев, каждый поток по курсу своего месяца')}${row('ВВП на человека · номинальный',n(m.gdpUSDRolling/annualPopulation,0)+' $ / год','Годовой ВВП / среднее население последних 12 месяцев')}${row('ВВП · реальный',money(m.realGDPRolling)+' млрд $ базы','Последние 12 месяцев, постоянные цены ${state.startYear??2026} года')}${row('ВВП на человека · реальный',n(m.realGDPRolling/annualPopulation,0)+' $ базы / год')}${row('ВВП по условному ППС',money(m.realGDPRolling*state.parameters.pppConversionFactor)+' млрд','Условный коэффициент ППС, не обследование цен')}${row('Рост реального ВВП',(m.gdpGrowthYoYDefined===0?'—':pct(m.gdpGrowthYoY)),'Последний месяц к тому же месяцу год назад')}${row('Инфляция',pct(m.inflationYoY),'Изменение потребительских цен за 12 месяцев')}${row('Безработица',pct(m.unemployment))}${row('Средняя зарплата · до налогов',n(m.meanWageNominal,0)+' ед. / месяц',n(m.meanWageUSD,0)+' $ по текущему курсу; фонд оплаты / занятые')}${row('Средняя реальная зарплата',n(m.meanWageReal,0)+' $ базы / месяц')}${row('Медианный эквивалентный доход',n(m.medianEquivalentIncomeReal,0)+' $ базы / месяц','После налогов и трансфертов; с поправкой на размер семьи')}</section>
    <section class="panel"><h2>Люди и качество жизни</h2>${row('Население',n(m.population,3)+' млн')}${row('Ожидаемая продолжительность жизни',n(m.lifeExpectancy,1)+' лет')}${row('Рождаемость',n(m.totalFertilityRate,2)+' детей / женщину')}${row('Доля населения 65+',pct(m.elderlyShare))}${row('Средние годы обучения взрослых',n(m.meanSchooling,1)+' лет')}${row('Ожидаемые годы обучения детей',n(m.expectedSchooling,1)+' лет')}${row('ИЧР · модельная оценка',n(m.hdi,3),'Образование и ВНД по ППС — оценки модели')}${row('Джини · после налогов и трансфертов',n(m.giniDisposable,1)+' / 100','Меньше — равномернее; расчёт по 10 группам за 12 месяцев')}${row('Джини · до перераспределения',n(m.giniMarket,1)+' / 100')}${row('Относительная бедность',pct(m.relativePoverty),'Доход ниже 50% медианного эквивалентного дохода')}${row('Фиксированный порог бедности',pct(m.absolutePoverty),'Ниже '+n(state.parameters.absolutePovertyRealMonthly,0)+' $ базы / человек / месяц; не международный порог')}${row('Доля доходов верхних 10%',pct(m.top10IncomeShare))}${row('Доля богатства верхних 10%',pct(m.top10WealthShare),'С учётом депозитов, долгов и долей предприятий')}</section></div>
    <section class="panel" style="margin-top:15px"><h2>Финансы и устройство экономики</h2><div class="two-cols"><div>${row('Баланс бюджета',m.deficitRatio>0?'Дефицит '+pct(m.deficitRatio):'Профицит '+pct(-m.deficitRatio))}${row('Валютные резервы',money(m.reservesUSD)+' млрд $')}${row('Сырьевой фонд',money(m.fundUSD)+' млрд $')}${row('Эпизоды суверенного дефолта',n(m.defaultEpisodes??0,0),state.government.defaultActive?'Сейчас есть непогашенный дефолт':'Текущие платежи исполняются или проведён обмен')}</div><div>${row('Государственная доля активов предприятий',pct(m.stateAssetShare))}${row('Иностранная доля активов',pct(m.foreignAssetShare))}${row('Отечественная частная доля активов',pct(100-m.stateAssetShare-m.foreignAssetShare))}${row('Государственная доля выпуска',pct(m.stateOutputShare),'Взвешенная по добавленной стоимости, не по количеству предприятий')}${row('Профиль допущений',esc(MODEL_PROFILES[state.modelProfile].name))}</div></div><div class="callout" style="margin-top:15px">Джини — приближение по группам; различия внутри групп не наблюдаются. ИЧР использует правильную структуру индекса, но модельные данные. Площадь, столица и международное место не выдумываются.</div></section>`;
}
function ownershipView(){
  return `<section class="decision-page">${decisionsBack()}${ownershipBoard(state,assetUI,{n,esc})}${queuedActions(a=>a.sector!=null)}</section>`;
}
function infrastructureView(){
  const networks=infrastructureBoard(state,assetUI,{n,esc});
  const content=assetUI.network===null?`<h3 tabindex="-1">Инфраструктура</h3><h4>Сети</h4>${networks}<h4>Строительство и правила</h4>${decisionSettings('Инфраструктура')}`:networks;
  return `<section class="decision-page">${decisionsBack()}${content}${queuedActions(a=>Boolean(a.network))}</section>`;
}
function queuedActions(include=()=>true) {
  const actions=state.pendingActions.filter(include);
  return actions.length?`<section class="queued-operations"><h4>Операции следующего месяца</h4><ul>${actions.map(a=>`<li><span>${a.kind==='restructure'?'Реструктуризация долга':esc(a.network?state.networks.find(net=>net.id===a.network)?.name:state.firms[a.sector]?.name)+' · '+esc(actionName(a.kind))+' · '+n(a.points,0)+(a.network?'% фонда':' п.п.')}</span> <button data-cancel-action="${a.id}">Отменить</button></li>`).join('')}</ul></section>`:'';
}
const actionName=kind=>({purchase:'Покупка государственной доли',privatize:'Приватизация',nationalize:'Национализация',recapitalize:'Рекапитализация',foreignSale:'Продажа иностранному инвестору',cooperatize:'Выкуп работниками',municipalize:'Передача муниципалитетам',networkSale:'Продажа фонда оператору',networkPurchase:'Выкуп фонда государством',networkMunicipalize:'Передача фонда муниципалитетам',restructure:'Обмен государственного долга',refinance:'Рефинансирование'})[kind]??kind;
const reasonName=key=>({'judicial-review':'судебный контроль: неполная компенсация','cooperative-entry':'кооперативная форма запрещена','infrastructure-entry':'вход операторов закрыт','investor-return':'ожидаемая доходность ниже требуемой',parliament:'недостаточно парламентской поддержки'})[key]??key;
const CONSTITUTION_LABELS={form:'Форма правления',playerRole:'Должность игрока',regime:'Исходный режим',electoralSystem:'Выборы парламента',presidentSystem:'Выборы президента',seats:'Число депутатов',threshold:'Избирательный порог',parliamentTerm:'Срок парламента',presidentTerm:'Срок президента',parliamentOffset:'Календарь парламента',confidence:'Вотум недоверия',independentCB:'Независимость центрального банка',presidentialVeto:'Вето президента',overrideFraction:'Порог преодоления вето',constitutionalFraction:'Порог конституционной поправки',constitutionalReferendum:'Обязательный референдум',dissolution:'Право роспуска парламента',termLimit:'Предел личных президентских сроков',budgetContinuity:'Продолжение бюджета',naturalizationYears:'Проживание до гражданства',localResidentVote:'Местное голосование жителей',emergencyMonths:'Срок чрезвычайного положения',territorialTax:'Сбор территориальных налогов',territorialSpending:'Распоряжение территориальными расходами',territorialProperty:'Муниципальное имущество',territorialBorrowing:'Местные займы'};
const decisionName=key=>CONSTITUTION_LABELS[key.replace('constitution.','')]??POLICY_FIELDS.find(f=>f[0]===key)?.[1]??POLICY_CHECKS.find(f=>f[0]===key)?.[1]??POLICY_CHOICES.find(f=>f[0]===key)?.[1]??PARAMETER_FIELDS.find(f=>f[0]===key)?.[1]??key;
function institutionsView() {
  const m=state.metrics,f=state.lastReport.fiscal,i=state.institutions;
  const serviceRows=[['antitrust','Регистрация и надзор','antitrustBudget','antitrustCapacity'],['courts','Суды и реестр','courtBudget','courtCapacity'],['soeAudits','Аудит госпредприятий','soeAuditBudget','soeAuditCapacity']];
  return `<section class="panel"><span class="eyebrow">РЕШЕНИЯ ≠ РЕЗУЛЬТАТЫ</span><h2>Как исполняются ваши правила</h2><p>Вы устанавливаете бюджеты, процедуры и правила назначения. Ниже — получившиеся результаты. Расходы не покупают качество мгновенно: имеют значение оплаченные услуги, накопленная способность исполнения и правовые последствия ваших действий.</p><div class="callout warning">Это условные показатели модели, не официальные индексы. Здесь пять агрегированных отраслей и один сводный банк: число конкурентов, HHI и рыночную концентрацию мы не наблюдаем.</div></section>
    <div class="two-cols"><section class="panel"><h2>Доступ и договоры</h2>${row('Обязательные процедуры',n(state.policy.registrationProcedures,0),'Ваше действующее правовое решение')}${row('Фактический срок регистрации',n(m.registrationDays,1)+' дней','Условная оценка: процедуры × время их исполнения')}${row('Срок исполнения договоров',n(m.contractDelayDays,0)+' дней','Условная оценка, не статистика судов')}${row('Надёжность исполнения',n(m.contractReliability,1)+' / 100','Результат судебной способности и риска изъятия')}${row('Риск изъятия без компенсации',n(i.ownershipRisk*100,1)+' / 100')}${row('Доступность конкуренции',n(m.marketContestability,1)+' / 100','Агрегированный proxy; не HHI и не число фирм')}</section>
    <section class="panel"><h2>Банки и управление</h2>${row('Возможность входа / смены банка',n(m.bankContestability,1)+' / 100','Результат правил, доверия, рисков и состояния банков')}${row('Депозитная ставка',pct(m.depositRate)+' / год','Ограничена доходностью активов и стоимостью фондирования')}${row('Разница кредитной и депозитной ставок',n(m.lendingRate-m.depositRate,1)+' п.п.','Это не чистая прибыль банка: есть риски и расходы')}${row('Аудиторская способность',n(m.soeAuditCapacity,1)+' / 100','Оплаченные услуги относительно размера государственного портфеля')}${row('Независимые проверки',state.policy.independentSoeAudit?'Включены':'Не предусмотрены')}${row('Управление предприятиями','По отраслям','В разделе «Собственность»; одинаковый собственник не гарантирует одинаковую эффективность')}</section></div>
    <section class="panel"><h2>Обещанный бюджет и оплаченные услуги</h2><p class="small muted">Млн национальной валюты за последний месяц. Уже входят в государственные закупки; не добавляются к ВВП повторно. Способность накапливается примерно за два года; качество управления — ещё медленнее.</p><div class="table-wrap"><table class="table"><thead><tr><th>Направление</th><th>Годовая доля ВВП</th><th>План месяца</th><th>Оплачено</th><th>Накопленная способность / 100</th></tr></thead><tbody>${serviceRows.map(([key,label,budget,capacity])=>`<tr><td>${label}</td><td>${n(state.policy[budget],3)}%</td><td>${n(f.institutionRequested?.[key]??0,2)}</td><td>${n(f[key]??0,2)}</td><td>${n(i[capacity]*100,1)}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Недостаток финансирования и производства уменьшает фактическое исполнение. Увеличение средств имеет убывающую отдачу и не гарантирует успех.</p></section>
    <section class="panel"><h2>Можно ли «всё хорошее» включить сразу?</h2><p>Можно принять несколько полезных правил одновременно. Модель не выдумывает штраф за защиту собственности или отмену ненужного барьера. Но принятие правила не равно исполнению, а большие бюджеты требуют ресурсов и финансирования. Отдача ограничена и зависит от допущений.</p><p>В разделе «Модель» можно обнулить отдачу бюджетных программ и институциональные эффекты. Сами расходы при этом остаются расходами.</p></section>`;
}
function chartPanel() {
  return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">ДИНАМИКА ЭКОНОМИКИ</span><h2>${metricNames[chartMetric]}</h2><span class="muted small">Каждая точка — один месяц</span></div><div class="pill-group">${chartOptions.map(([key,label])=>`<button class="${chartMetric===key?'active':''}" data-chart="${key}">${label}</button>`).join('')}</div></div>
    <div class="chart-wrap">${chart([{name:'Экономика',points:state.history}],chartMetric)}</div><div class="chart-legend"><span><span class="legend-line"></span>Ваш эксперимент</span><span>${state.month} ${state.month===1?'месяц':'мес.'} · ${state.politics.livingWorld?'Мировые события включены':'Без мировых событий'}</span></div></section>`;
}
function report() {
  if(state.month===0) return `<ol class="report-list"><li><div class="report-number">01</div><div><strong>Выберите экономическую гипотезу</strong><span>Например, предложите изменение налога и проведите закон в разделе «Власть и законы». В лаборатории решения применяются напрямую.</span></div></li><li><div class="report-number">02</div><div><strong>Перейдите к следующему месяцу</strong><span>Сравните инфляцию, спрос, занятость и курс. Последствия накапливаются.</span></div></li><li><div class="report-number">03</div><div><strong>Сравните два пути</strong><span>Одинаковые исходные условия и внешние шоки, разная государственная политика.</span></div></li></ol>`;
  const r=state.lastReport,m=state.metrics;
  const items=[
    [`Выпуск: ${signed(r.changes.gdp,1)}% за месяц`,`Потребление ${n(m.consumption,0)}, инвестиции ${n(m.investment,0)}, госзакупки ${n(m.governmentPurchases,0)} млн в базовых ценах.`],
    [`Цены: ${signed(m.inflationMonthly,2)}% за месяц`,`За 12 месяцев ${pct(m.inflationYoY)}. Ожидания: ${pct(m.expectedInflation)}; кредитная ставка: ${pct(m.lendingRate)}.`],
    [`Валюта: ${signed(r.changes.exchange,2)}% к доллару`,`Текущий счёт: ${signed(r.external.currentAccountUSD,0)} млн $. Резервов на ${n(m.reserveMonths,1)} месяца импорта.`]
  ];
  return '<ol class="report-list">'+items.map(([title,body],i)=>`<li><div class="report-number">0${i+1}</div><div><strong>${title}</strong><span>${body}</span></div></li>`).join('')+'</ol>';
}
function overview() {
  const m=state.metrics;
  return `<section class="panel" style="margin-bottom:20px"><h2>Общий ВВП страны</h2><div class="two-cols"><div>${row('Реальный ВВП · последние 12 месяцев',money(m.realGDPRolling)+' млрд $ базы')}${row('Реальный ВВП · текущий годовой темп',money(m.realGDPAnnualized)+' млрд $ базы','Последний месячный выпуск × 12')}</div><div>${row('Номинальный ВВП · последние 12 месяцев',money(m.nominalGDPAnnual)+' млрд нац. валюты')}${row('ВВП в долларах · последние 12 месяцев',money(m.gdpUSDRolling)+' млрд $','Каждый месячный поток пересчитан по курсу своего месяца')}</div></div></section>`+chartPanel()+`<div class="two-cols"><section class="panel"><div class="panel-head"><h2>Отчёт за месяц</h2><span class="eyebrow">${date(state.month,true)}</span></div>${report()}</section>
    <section class="panel"><div class="panel-head"><h2>Устойчивость</h2><span class="badge">${state.resourceMode?'Сырьевой экспорт':'Диверсификация'}</span></div>
    ${bar('Резервы / месяцы импорта',m.reserveMonths/12*100,n(m.reserveMonths,1)+' мес.')}
    ${bar('Капитал банков / норматив',m.capitalRatio/state.policy.bankCapitalRequirement/2*100,pct(m.capitalRatio/state.policy.bankCapitalRequirement*100),m.capitalRatio<state.policy.bankCapitalRequirement?'#c52b39':'#a8bce0')}
    ${bar('Исполнение конечных заказов',m.fulfillment,pct(m.fulfillment))}
    ${bar('Доверие к политике',m.confidence,n(m.confidence,0)+' / 100')}
    <div class="audit-ok" style="margin-top:20px">${iconCheck} Балансы сходятся · погрешность ${n(m.auditError,8)} млн</div></section></div>
    ${state.lastReport.events.length?`<div class="callout warning" style="margin-top:15px"><strong>События и ограничения</strong>${state.lastReport.events.slice(0,5).map(esc).join('<br>')}</div>`:''}`;
}
function economy(){
 const m=state.metrics,r=state.lastReport;
 const va=r.gdp?.sectorValueAdded??state.firms.map((f,j)=>f.production*(f.price-inputMatrix(state).reduce((v,row,i)=>v+row[j]*state.firms[i].price,0)-f.importCoefficient*state.exchangeRate*state.worldPriceIndex/100));
 const total=va.reduce((a,b)=>a+b,0);
 return `<section class="panel"><h2>Структура производства</h2><div class="table-wrap"><table class="table"><thead><tr><th>Отрасль</th><th>Доля экономики</th><th>Занятость</th></tr></thead><tbody>${state.firms.map((f,i)=>`<tr><td>${esc(f.name)}</td><td>${pct(total?va[i]/total*100:0)}</td><td>${n(f.workers*1000,0)} тыс.</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><h2>ВВП по расходам</h2>${row('Потребление',money(r.gdp?.consumption??m.consumption)+' млрд')}${row('Инвестиции',money(r.gdp?.investment??m.investment)+' млрд')}${row('Государственные закупки',money(r.gdp?.government??m.governmentPurchases)+' млрд')}${row('Экспорт',money(r.gdp?.exports??m.exports)+' млрд')}${row('− Импорт',money(r.gdp?.imports??m.imports)+' млрд')}${row('Изменение запасов',money(r.gdp?.inventories??0)+' млрд')}${row('ВВП за месяц',money(m.nominalGDPMonthly)+' млрд')}</section>`;
}
function worldConditions(){
 const events=[state.lastReport.worldNews,...savedWorldEvents(state)].filter(Boolean);
 const m=state.metrics;
 const totals=m.worldPopulation===undefined?'':row('ВВП мира',money(m.worldGDPNominal)+' млрд $')+row('Население мира',n(m.worldPopulation/1000,2)+' млрд');
 const growth=state.economy?row(totals?'Реальный рост ВВП мира':'Базовый рост мировой экономики',signed(m.worldGrowth,1)+'% за год'):'';

 return totals+growth+(events.length?events.map(e=>`<div class="callout"><strong>${esc(e.title)}</strong>${esc(e.text)}<p>${signed((e.multiplier-1)*100,0)}% к обычному уровню · ${e.start>state.month?'начало через '+(e.start-state.month)+' мес.; длительность '+e.duration+' мес.':'осталось '+(e.start+e.duration-state.month)+' мес.'}</p></div>`).join(''):'<p class="small muted">Сейчас нет мировых событий, меняющих условия торговли.</p>');
}
function external(){
 const m=state.metrics,e=state.lastReport.external??{};
 return `<section class="panel"><h2>Внешние счета</h2>${row('Курс валюты',n(m.exchangeRate,3)+' ед. / $')}${row('Экспорт',money(e.exportsUSD??0)+' млрд $')}${row('Импорт',money(e.importsUSD??0)+' млрд $')}${row('Текущий счёт',money(m.currentAccountUSD)+' млрд $')}${row('Валютные резервы',money(m.reservesUSD)+' млрд $')}${row('Резервы / импорт',n(m.reserveMonths,1)+' мес.')}${row('Стабилизационный фонд',money(m.fundUSD)+' млрд $')}${worldConditions()}</section>`;
}
function populationPyramid(){
 const bands=Array.from({length:11},(_,i)=>({label:i===10?'100+':`${i*10}–${i*10+9}`,female:state.demography.female.slice(i*120,i===10?1201:(i+1)*120).reduce((a,b)=>a+b,0),male:state.demography.male.slice(i*120,i===10?1201:(i+1)*120).reduce((a,b)=>a+b,0)})).reverse();
 const max=Math.max(...bands.flatMap(b=>[b.female,b.male]),.000001),width=v=>v/max*140;
 return `<svg class="population-pyramid" viewBox="0 0 360 400" role="img" aria-label="Возрастная пирамида: женщины слева, мужчины справа"><text x="85" y="20" text-anchor="middle">Женщины</text><text x="275" y="20" text-anchor="middle">Мужчины</text>${bands.map((b,i)=>{const y=35+i*30;return `<text x="180" y="${y+17}" text-anchor="middle">${b.label}</text><rect x="${155-width(b.female)}" y="${y}" width="${width(b.female)}" height="23" fill="#c52b39"><title>Женщины ${b.label}: ${n(b.female*1e6,0)}</title></rect><rect x="205" y="${y}" width="${width(b.male)}" height="23" fill="#174ca1"><title>Мужчины ${b.label}: ${n(b.male*1e6,0)}</title></rect>`;}).join('')}<text x="15" y="385">${n(max/state.population*100,1)}%</text><text x="155" y="385" text-anchor="end">0</text><text x="205" y="385">0</text><text x="345" y="385" text-anchor="end">${n(max/state.population*100,1)}%</text></svg>`;
}
function households(){
 const m=state.metrics;
 return `<section class="panel"><h2>Возрастная пирамида</h2>${populationPyramid()}</section><section class="panel"><h2>Население</h2>${row('Жителей',n(state.population,3)+' млн')}${row('Рождения / смерти за месяц',n(m.births*1e6,0)+' / '+n(m.deaths*1e6,0))}${row('Доля 65+',pct(m.elderlyShare))}${row('Продолжительность жизни',n(m.lifeExpectancy,1)+' лет')}</section><section class="panel"><h2>Доходы и неравенство</h2>${row('Средняя зарплата',n(m.meanWageUSD,0)+' $ / месяц')}${row('Реальные доходы',n(m.realIncomeIndex,1),'Индекс, начало = 100')}${row('Индекс Джини',n(m.giniDisposable,1)+' / 100')}${row('Доходы богатейших 10%',pct(m.top10IncomeShare))}${row('Относительная бедность',pct(m.relativePoverty))}</section>`;
}
function economyDetails() {
  const m=state.metrics,r=state.lastReport;
  return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">РЕАЛЬНЫЙ СЕКТОР</span><h2>Производство и мощности</h2></div><span class="muted small">Объёмы: млн в базовых ценах</span></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Отрасль</th><th>Выпуск</th><th>Загрузка</th><th>Работники, тыс.</th><th>Запасы</th><th>Цены, индекс</th></tr></thead><tbody>${state.firms.map((f,i)=>`<tr><td><span class="sector-color" style="background:${SECTORS[i].color}"></span>${esc(f.name)}</td><td>${n(f.production,0)}</td><td>${pct(f.utilization*100)}</td><td>${n(f.workers*1000,0)}</td><td>${n(f.inventory,0)}</td><td>${n(f.price*100,1)}</td></tr>`).join('')}</tbody></table></div></section>
    <div class="two-cols"><section class="panel"><h2>ВВП по расходам</h2><p class="small muted">Млрд национальной валюты за месяц. Трансферты не прибавляются к ВВП.</p>
      ${row('Потребление',money(r.gdp?.consumption??m.consumption)+' млрд')}${row('Инвестиции',money(r.gdp?.investment??m.investment)+' млрд')}${row('Государственные закупки',money(r.gdp?.government??m.governmentPurchases)+' млрд')}${row('Экспорт',money(r.gdp?.exports??m.exports)+' млрд')}${row('− Импорт',money(r.gdp?.imports??m.imports)+' млрд')}${row('Изменение запасов',money(r.gdp?.inventories??0)+' млрд')}${row('Номинальный ВВП',money(m.nominalGDPMonthly)+' млрд')}
    </section><section class="panel"><h2>Будущий выпуск</h2>${row('ВВП: разрыв с потенциалом',signed(m.outputGap,1)+'%')}${row('Производительность',n(m.productivity,1),'Индекс начала = 100')}${row('Инфраструктура',n(m.infrastructure,1),'Реальный запас с учётом износа')}${row('Квалификация',n(m.skills,1))}${row('Введено капитала за месяц',money(m.investmentCompleted)+' млрд базы')}${row('Проекты в очереди',String(state.projects.length),'Вложения уже оплачены; ввод ещё впереди')}
      </section></div>`;
}
function fiscal() {
  const m=state.metrics,f=state.lastReport.fiscal,a=accountBalances(state),g=state.government;
  const domesticRate=g.domesticBonds.length?g.domesticBonds.reduce((v,b)=>v+b.principal*b.rate,0)/a.domesticDebt*100:0;
  return `<section class="panel"><span class="eyebrow">ДОЛГОВАЯ УСТОЙЧИВОСТЬ</span><h2>${g.defaultActive?'Есть непогашенный дефолт':'Состояние государственных обязательств'}</h2><div class="two-cols"><div>${row('Эпизоды дефолта',String(g.defaults))}${row('Долг, затронутый неплатежом',money(m.debtInDefault??0)+' млрд')}${row('Просроченные платежи',money(g.arrears)+' млрд')}${row('Обслуживание долга / доходы',pct(m.debtServiceRevenue??0))}</div><div>${row('Условный риск потери финансирования',pct(m.refinancingRisk??0)+' / год','Логистический сценарный показатель; не эмпирическая вероятность дефолта')}${row('Ограничение доступа к внешнему рынку',state.month<g.excludedUntil?'До '+date(g.excludedUntil,true):'Нет')}${row('Дивиденды государственных долей',money(f.stateDividends??0)+' млрд')}${row('Отложенные убытки ЦБ',money(state.centralBank.deferredLoss)+' млрд','Уменьшают будущие перечисления ЦБ, не являются долгом казначейства')}</div></div><details class="method-details"><summary>Вынужденная реструктуризация и история дефолтов</summary><p>Неплатёж по купону или основному долгу — дефолт. Обмен с потерей приведённой стоимости также считается дефолтом. Высокий долг сам по себе не означает дефолт.</p><div class="section-actions"><label class="field">Списание номинала, %<input id="debt-haircut" type="number" min="0" max="70" value="30"></label><label class="field">Новый срок, месяцев<input id="debt-extension" type="number" min="12" max="120" value="60"></label><button data-action="restructure-queue">${state.politics.enabled?'Голосовать по обмену долга':'Запланировать обмен долга'}</button></div>${g.defaultEpisodes.map(e=>`<p>${date(e.start,true)} — ${e.end===null?'не разрешён':date(e.end,true)} · потери номинала ${money(e.faceLossLC)} млрд · потери приведённой стоимости ${money(e.npvLossLC)} млрд.</p>`).join('')||'<p>Дефолтов не было.</p>'}${queuedActions()}</details></section><div class="balance-strip"><div class="panel"><span class="eyebrow">ДОЛГ ГОСУДАРСТВА</span><div class="big">${money(a.totalGovernmentDebt)} млрд</div><span class="small muted">${pct(m.debtRatio)} ВВП за 12 месяцев</span></div><div class="panel"><span class="eyebrow">КАЗНАЧЕЙСТВО</span><div class="big">${money(g.cash)} млрд</div><span class="small muted">Средства на счёте</span></div><div class="panel"><span class="eyebrow">ПРОЦЕНТЫ ПО ДОЛГУ</span><div class="big">${money(m.interestExpense)} млрд</div><span class="small muted">За текущий месяц</span></div></div>
    <div class="two-cols"><section class="panel"><h2>Доходы бюджета</h2>${row('НДС',money(f.vat??0)+' млрд')}${row('Подоходный налог',money(f.incomeTax??0)+' млрд')}${row('Налог на прибыль',money(f.corporateTax??0)+' млрд')}${row('Пошлины',money(f.tariff??0)+' млрд')}${row('Сырьевая рента',money(f.royalty??0)+' млрд')}${row('Доход центрального банка',money(f.centralIncome??0)+' млрд')}${row('Всего налогов',money(m.taxRevenue)+' млрд')}${row('Собираемость прямых налогов',pct(state.institutions.taxCompliance*100))}</section>
    <section class="panel"><h2>Расходы и финансирование</h2>${row('Закупки и инвестиции',money(f.purchases??0)+' млрд')}${row('Пособия и пенсии',money(f.transfers??0)+' млрд')}${row('Поддержка семей',money(f.familyBenefits??0)+' млрд')}${row('Здравоохранение · внутри закупок',money(f.healthcare??0)+' млрд')}${row('Образование · внутри закупок',money(f.education??0)+' млрд')}${row('Администрирование · внутри закупок',money(f.institutionCost??0)+' млрд')}${row('Поддержка бизнеса',money(f.businessSupport??0)+' млрд')}${row('Выплаты по гарантиям концессий',money(f.concessionGuarantees??0)+' млрд')}${row('Обслуживание фонда · внутри закупок',money(f.infrastructureMaintenance??0)+' млрд')}${row('Покупки существующей инфраструктуры',money(f.networkPurchases??0)+' млрд')}${row('Продажи существующей инфраструктуры',money(f.networkSales??0)+' млрд')}${row('Обслуживание долга',money(f.interest??0)+' млрд')}${row('Спасение банков',money(f.bankRescue??0)+' млрд')}${row('Дефицит за месяц',money(state.government.lastDeficit)+' млрд')}${row('Новые внутренние займы',money(f.domesticIssued??0)+' млрд')}${row('Новые внешние займы',money(f.externalIssued??0)+' млрд $')}${row('Погашение основного долга',money((f.domesticRedeemed??0)+(f.externalRedeemed??0)*state.exchangeRate)+' млрд')}</section></div>
    <section class="panel" style="margin-top:15px"><h2>Сроки и валютный риск</h2><div class="mini-stats"><div class="mini-stat"><span>Средний внутренний купон</span><strong>${pct(domesticRate)}</strong></div><div class="mini-stat"><span>Внешний долг</span><strong>${money(a.externalDebtUSD)} млрд $</strong></div><div class="mini-stat"><span>Премия за риск новых займов</span><strong>${pct(m.sovereignSpread)}</strong></div></div><p class="small muted">Старые облигации сохраняют купон. Ставка влияет на бюджет при новых займах и рефинансировании. Дефицит на карточке — текущий месячный поток × 12 / ВВП последних 12 месяцев.</p></section>`;
}
function credit(){
 const m=state.metrics,a=accountBalances(state);
 return `<section class="panel"><h2>Банковская система</h2>${row('Кредиты частному сектору',money(a.privateLoans)+' млрд')}${row('Депозиты',money(a.deposits)+' млрд')}${row('Ставка новых кредитов',pct(m.lendingRate)+' годовых')}${row('Ставка депозитов',pct(m.depositRate)+' годовых')}${row('Доступность кредитов',pct(state.bank.creditSupply*100))}${row('Проблемные кредиты',pct(m.npl))}${row('Капитал / рискованные активы',pct(m.capitalRatio),'Минимум: '+pct(state.policy.bankCapitalRequirement))}${row('Покрытие стресс-оттока ликвидностью',pct(m.liquidityCoverage))}</section>`;
}
function creditDetails() {
  const m=state.metrics,b=state.bank,a=accountBalances(state);
  return `<section class="panel"><h2>Капитал и ликвидность — разные ограничения</h2><div class="two-cols"><div>${row('Капитал / все активы · leverage',pct(m.leverageRatio))}${row('Покрытие месячного стресс-оттока · модельное',pct(m.liquidityCoverage))}${row('Риск-взвешенные активы',money(a.riskWeightedAssets)+' млрд')}</div><div>${row('Государственная доля банков',pct(b.stateOwnership*100))}${row('Прибыль ЦБ за месяц',money(state.centralBank.lastProfit)+' млрд')}${row('Перечисление ЦБ в бюджет',money(state.centralBank.lastRemittance)+' млрд')}</div></div><p class="small muted">Внешние активы и открытая валютная позиция имеют отдельные веса риска. Покрытие ликвидности — упрощённый аналог, не полная реализация Basel LCR. Депозитная ставка ограничена доходностью портфеля и стоимостью фондирования.</p></section><div class="two-cols"><section class="panel"><h2>Передача ставки</h2>${row('Денежный режим',esc(POLICY_CHOICES.find(x=>x[0]==='monetaryRegime')[3].find(([value])=>value===state.policy.monetaryRegime)?.[1]))}${row('Действующая базовая ставка',pct(m.effectivePolicyRate),'Решение ЦБ, процентное правило или внешний ориентир')}${row('Ожидания инфляции',pct(m.expectedInflation))}${row('Ожидаемая реальная ставка',pct(realInterestRate(m.effectivePolicyRate/100,state.expectedInflation)*100))}${row('Новые кредиты',pct(m.lendingRate),'Годовая эффективная ставка')}${row('Депозиты',pct(m.depositRate),'Годовая эффективная ставка')}${row('Кредитная доступность',pct(b.creditSupply*100))}${row('Выдано кредитов / овердрафтов',money(m.moneyCreated)+' млрд')}${row('Списано кредитов',money(m.creditLosses)+' млрд')}
    <div class="callout" style="margin-top:15px">Ставки старых кредитов пересматриваются частично. Выдача кредита создаёт депозит; погашение уменьшает оба. Списание уменьшает актив и капитал банка.</div></section>
    <section class="panel"><h2>Баланс банков</h2>${row('Активы за вычетом внешнего фондирования',money(a.bankAssets)+' млрд')}${row('Кредиты частному сектору',money(a.privateLoans)+' млрд')}${row('Депозиты',money(a.deposits)+' млрд')}${row('Капитал',money(a.bankEquity)+' млрд')}${row('Капитал / рискованные активы',pct(m.capitalRatio))}${row('Проблемные кредиты',pct(m.npl))}${row('Ликвидность / депозиты',pct(m.bankLiquidity))}${row('Заём у центрального банка',money(b.centralBorrowing)+' млрд')}${row('Чистые внешние активы',money(b.foreignAssetsUSD)+' млрд $')}
    <div class="audit-ok" style="margin-top:15px">${iconCheck} Активы = депозиты + заём ЦБ + капитал</div></section></div>
    <section class="panel" style="margin-top:15px"><h2>Долговая нагрузка</h2><div class="table-wrap"><table class="table"><thead><tr><th>Заёмщик</th><th>Долг, млн</th><th>Валютная часть, млн $</th><th>Средняя ставка</th><th>Проценты / месяц</th></tr></thead><tbody>${[...state.households,...state.firms].map(a=>`<tr><td>${esc(a.name)}</td><td>${n(a.loanLC+a.loanFX*state.exchangeRate,0)}</td><td>${n(a.loanFX,0)}</td><td>${pct(a.averageRate*100)}</td><td>${n(a.interestPaid??0,0)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function externalDetails() {
  const m=state.metrics,e=state.lastReport.external??{};
  const worldFields=[['commodityPrice','Мировая цена сырья',25,250,5,'Индекс, старт = 100'],['energyPrice','Цена импортной энергии',25,250,5,'Индекс, старт = 100'],['foreignDemand','Внешний спрос',40,180,5,'Индекс, старт = 100'],['globalRate','Зарубежная ставка',0,15,.25,'% годовых'],['weather','Урожайность',40,150,5,'Индекс, нормальная = 100'],['importAvailability','Доступность компонентов',10,120,5,'Индекс, старт = 100']];
  return `<div class="two-cols"><section class="panel"><h2>Внешние счета</h2>${row('Курс валюты',n(m.exchangeRate,3)+' ед. / $')}${row('Реальный курс',n(m.realExchangeRate,1),'Индекс начала = 100; рост означает реальное обесценение')}${row('Экспорт',money(e.exportsUSD??0)+' млрд $')}${row('Импорт',money(e.importsUSD??0)+' млрд $')}${row('Текущий счёт',money(m.currentAccountUSD)+' млрд $')}${row('Прямые инвестиции',money(e.inflowUSD??0)+' млрд $')}${row('Вывод сбережений за рубеж',money(e.flightUSD??0)+' млрд $')}${row('Переводы мигрантов',money(e.remittancesUSD??0)+' млрд $')}</section>
    <section class="panel"><h2>Резервы и сырьё</h2>${row('Валютные резервы',money(m.reservesUSD)+' млрд $')}${row('Резервы / импорт',n(m.reserveMonths,1)+' мес.')}${row('Стабилизационный фонд',money(m.fundUSD)+' млрд $')}${row('Валютная интервенция',n(state.policy.fxIntervention,0)+' млн $ / мес.')}${row('Сценарий',state.resourceMode?'Сырьевая экономика':'Диверсифицированная экономика')}
    <p class="small muted" style="margin-top:15px">Сырьевая структура выбирается в начале эксперимента: она меняет экспорт, размещение капитала и бюджетную ренту.</p><button data-action="new">Изменить структуру и начать заново</button></section></div>
    <section class="panel" style="margin-top:15px"><span class="eyebrow">УСЛОВИЯ ЭКСПЕРИМЕНТА · НЕ ГОСУДАРСТВЕННЫЕ РЫЧАГИ</span><h2 style="margin-top:5px">Внешний мир</h2><p class="small muted">Установите условия для проверки гипотезы. При сравнении A/B обе экономики получают одни и те же значения и шоки.</p>
    <div class="world-grid">${worldFields.map(([key,label,min,max,step,unit])=>`<label class="field">${label}<input type="number" data-world="${key}" value="${state.world[key]}" min="${min}" max="${max}" step="${step}"><span class="small muted">${unit}</span></label>`).join('')}</div>
    <div class="section-actions" style="margin-top:18px"><label class="check" style="margin:0"><input type="checkbox" data-stochastic ${state.stochastic?'checked':''}> Случайные внешние колебания · seed ${state.seed}</label></div>
    <h3 style="margin-top:20px">Запланировать шок на ближайшие 12 месяцев</h3><div class="shock-list"><button data-shock="commodity">Сырьё −30%</button><button data-shock="energy">Энергия +30%</button><button data-shock="demand">Внешний спрос −15%</button><button data-shock="weather">Неурожай −20%</button><button data-shock="supply">Компоненты −30%</button></div>
    ${state.shocks.length?`<div class="timeline-note">${state.shocks.map((x,i)=>`${esc(x.key)} × ${n(x.multiplier,2)} · ${date(x.start,true)}–${date(x.start+x.duration-1,true)} <button class="small secondary" data-remove-shock="${i}" ${state.month>=x.start?'disabled':''}>Удалить</button>`).join('<br>')}</div>`:''}</section>`;
}
function householdsDetails() {
  const m=state.metrics;
  return `<section class="panel"><h2>Демография: возраст и пол</h2><p class="small muted">Рождения рассчитаны по возрасту женщин; переход в рабочую силу — с 18 лет. Услуги здравоохранения и реальная поддержка семей влияют с задержкой. Все исходные возрастные нормы условные.</p><div class="table-wrap"><table class="table"><thead><tr><th>Возраст</th><th>Женщины, тыс.</th><th>Мужчины, тыс.</th></tr></thead><tbody>${Array.from({length:11},(_,i)=>{const from=i*120,to=i===10?1201:from+120;return `<tr><td>${i===10?'100+':`${i*10}–${i*10+9}`}</td><td>${n(state.demography.female.slice(from,to).reduce((a,b)=>a+b,0)*1000,1)}</td><td>${n(state.demography.male.slice(from,to).reduce((a,b)=>a+b,0)*1000,1)}</td></tr>`;}).join('')}</tbody></table></div></section><section class="panel" style="margin-top:20px"><span class="eyebrow">ЛЮДИ И ДОХОДЫ</span><h2 style="margin-top:5px">Десять групп домохозяйств</h2><p class="small muted">Доход и расходы — млн национальной валюты за месяц. Потребление — объём в базовых ценах.</p><div class="table-wrap"><table class="table"><thead><tr><th>Группа</th><th>Население, млн</th><th>Доход</th><th>Потребление</th><th>Депозиты</th><th>Долг</th><th>Склонность к потреблению</th></tr></thead><tbody>${state.households.map(h=>`<tr><td>${esc(h.name)}</td><td>${n(state.population*h.population,2)}</td><td>${n(h.income,0)}</td><td>${n(h.consumption,0)}</td><td>${n(h.cash,0)}</td><td>${n(h.loanLC+h.loanFX*state.exchangeRate,0)}</td><td>${pct(h.mpc*100)}</td></tr>`).join('')}</tbody></table></div></section>
    <div class="two-cols"><section class="panel"><h2>Рынок труда</h2>${row('Население',n(state.population,3)+' млн')}${row('Дети / трудоспособные / пожилые',state.ageCohorts.map(x=>n(x,2)).join(' / ')+' млн')}${row('Рождения',n(m.births*1000000,0)+' человек / мес.')}${row('Смерти',n(m.deaths*1000000,0)+' человек / мес.')}${row('Естественный прирост',signed(m.naturalIncrease*1000000,0)+' человек / мес.')}${row('Суммарная рождаемость',n(m.totalFertilityRate,2)+' детей на женщину','Периодный показатель, не число детей в каждой семье')}${row('Периодная ожидаемая продолжительность жизни',n(m.lifeExpectancy,1)+' лет','По текущей возрастной смертности; это не средний возраст')}${row('Доля 65+',pct(m.elderlyShare))}${row('Демографическая нагрузка',n(m.dependencyRatio,1)+' на 100 трудоспособных')}${row('Рабочая сила',n(m.laborForce,3)+' млн')}${row('Занятость',n(m.employment,3)+' млн')}${row('Безработица',pct(m.unemployment))}${row('Миграционный прирост',signed(m.migration*1000000,0)+' человек / мес.')}${row('Участие в рынке труда',pct(state.participation*100))}</section>
    <section class="panel"><h2>Покупательная способность</h2>${row('Реальный доход на человека',n(m.realIncomeIndex,1),'Индекс исходного состояния = 100')}${row('Потребительские цены',n(state.consumerPriceIndex,1),'Индекс исходного состояния = 100')}${row('Продовольственная инфляция',pct(m.foodInflation),'За 12 месяцев')}${row('Энергетическая инфляция',pct(m.energyInflation),'За 12 месяцев')}${row('Базовая инфляция',pct(m.coreInflation),'Промышленность, строительство и услуги')}${row('Теневая экономика',pct(m.informality))}</section></div>`;
}
function compareView() {
  const changed=pending();
  let controls=`<section class="panel"><span class="eyebrow">ПРОВЕРКА ГИПОТЕЗ</span><h2 style="margin-top:5px">Одна страна. Два решения.</h2><p class="small muted">A сохраняет политику исходной точки и не исполняет разовые операции. B применяет ваши ползунки и очередь операций выбранной точки. Внешние условия одинаковые.</p><div class="section-actions"><span class="toolbar-label">Начало</span><select id="compare-source" aria-label="Исходная точка"><option value="current" ${compareSource==='current'?'selected':''}>Текущий месяц</option><option value="checkpoint" ${compareSource==='checkpoint'?'selected':''} ${!checkpoint?'disabled':''}>Сохранённая точка ${checkpoint?'· '+date(checkpoint.month,true):''}</option></select><span class="toolbar-label">Горизонт</span><select id="compare-months" aria-label="Горизонт сравнения">${[6,12,24,60,120,360].map(v=>`<option value="${v}" ${compareMonths===v?'selected':''}>${v} месяцев</option>`).join('')}</select><button class="primary" data-action="compare" ${busy?'disabled':''}>${busy?'Вычисление…':'Рассчитать A / B'}</button></div><div class="small muted">${changed.length?`${changed.length} изменений относительно текущей политики.`:'Измените политику или запланируйте операцию с собственностью / долгом.'}</div></section>`;
  if(!comparison) return controls+`<section class="panel comparison-empty"><span class="eyebrow">КОНТРОЛЬНЫЙ ЭКСПЕРИМЕНТ</span><h2>Отделите эффект политики</h2><p>Создайте точку сравнения, измените ставку или бюджет и посмотрите на обе траектории. Основное время не продвигается.</p><button data-action="checkpoint">Сохранить текущую точку</button></section>`;
  const c=comparison,a=c.a.metrics,b=c.b.metrics;
  const base=c.a;
  if(c.politicalProtocol)controls+=`<div class="callout"><strong>Сравнение с принятием законов</strong>В обеих ветвях простой сценарный политик пытается провести новые собственные проекты через статьи, парламент и подпись. Принятие не гарантировано. A дошла до ${date(c.a.month,true)}, B — до ${date(c.b.month,true)}.${c.a.month!==c.b.month?' Разные даты завершения не позволяют трактовать разницу показателей как чистый эффект одного инструмента.':''}</div>`;
  const differences=Object.entries(c.b.policy).filter(([key,val])=>val!==base.policy[key]);
  controls+=`<section class="panel"><div class="panel-head"><div><span class="eyebrow">РЕЗУЛЬТАТ · ${c.months} МЕСЯЦЕВ</span><h2>${metricNames[compareMetric]}</h2><span class="small muted">${date(c.originMonth,true)} → ${date(c.originMonth+c.months,true)}</span></div><div class="pill-group">${chartOptions.map(([key,label])=>`<button data-compare-chart="${key}" class="${compareMetric===key?'active':''}">${label}</button>`).join('')}</div></div><div class="chart-wrap">${chart([{name:'A',points:c.a.history.filter(x=>x.month>=c.originMonth)},{name:'B',points:c.b.history.filter(x=>x.month>=c.originMonth)}],compareMetric,{compare:true})}</div><div class="chart-legend"><span><span class="legend-line"></span>A · прежняя политика</span><span><span class="legend-line alt"></span>B · ваша гипотеза</span></div></section>`;
  const president=state.politics.enabled&&state.politics.executive.role==='president',standing=president?presidentialStanding(state):null;
  const metrics=[['gdpPerCapitaReal','ВВП / человек, $ базы',0],['inflationYoY','Инфляция, %',1],['unemployment','Безработица, %',1],['realIncomeIndex','Реальный доход, индекс',1],['debtRatio','Госдолг / ВВП, %',1],['exchangeRate','Курс, ед. / $',3],['reservesUSD','Резервы, млн $',0],['investment','Инвестиции / месяц, млн базы',0],['giniDisposable','Джини располагаемых доходов, 0–100',1],['hdi','ИЧР модели',3],['stateAssetShare','Государственная доля активов, %',1],['defaultEpisodes','Эпизоды дефолта',0]];
  controls+=`<section class="panel"><h2>Результаты на конец горизонта</h2><div class="table-wrap"><table class="table"><thead><tr><th>Показатель</th><th>A</th><th>B</th><th>Разница B − A</th></tr></thead><tbody>${metrics.map(([key,label,d])=>`<tr><td>${label}</td><td>${n(a[key],d)}</td><td>${n(b[key],d)}</td><td>${signed(b[key]-a[key],d)}</td></tr>`).join('')}</tbody></table></div><p class="small muted" style="margin-top:12px">Изменённые решения: ${differences.map(([key,val])=>`${esc(POLICY_FIELDS.find(f=>f[0]===key)?.[1]??key)}: ${esc(base.policy[key])} → ${esc(val)}`).join('; ')||'политика одинакова; при наличии разовых операций ветвь B может отличаться'}.</p><p class="small muted">Вывод относится к допущениям этой модели. Для проверки устойчивости повторите эксперимент с другими коэффициентами.</p></section>`;
  return controls;
}
function politicalValidationView(){
  const v=politicalValidation;
  return `<section class="panel"><span class="eyebrow">ПОЛИТИЧЕСКАЯ МОДЕЛЬ ${v.version}</span><h2>Институты: десять стратегий</h2>${row('Партии с горизонтом 30 лет',n(v.totalGames,0))}${row('Выполненные месячные ходы',n(v.monthsChecked,0))}${row('Достигли 360 месяцев',n(v.completed30Years,0))}${row('Завершились раньше',n(v.endedEarly,0),'Поражение, предел сроков или смена исполнительной власти завершают игру законно')}${row('Точные воспроизведения',n(v.replayChecks,0))}<p class="small muted">Сценарная проверка синтетической модели. Раннее завершение не подменяется продолжением за другого правителя. Ниже отдельно приведены экономические эксперименты лабораторного режима.</p></section>`;
}
function validationView() {
  const table=games=>'<div class="table-wrap"><table class="table"><thead><tr><th>Стратегия</th><th>ВВП / человек</th><th>Инфляция</th><th>Долг / ВВП</th><th>Джини</th><th>ИЧР модели</th><th>Дефолты</th></tr></thead><tbody>'+games.map(x=>'<tr><td style="white-space:normal;max-width:260px"><strong>'+esc(x.name)+'</strong><div class="small muted">'+esc(x.description)+'</div></td><td>'+n(x.gdpPerCapitaReal,0)+'</td><td>'+pct(x.inflationYoY)+'</td><td>'+pct(x.debtRatio)+'</td><td>'+n(x.giniDisposable,1)+'</td><td>'+n(x.hdi,3)+'</td><td>'+x.defaults+'</td></tr>').join('')+'</tbody></table></div>';
  return politicalValidationView()+'<section class="panel"><span class="eyebrow">ЛАБОРАТОРНЫЙ РЕЖИМ · МОДЕЛЬ '+validation.version+' · ПРОВЕРКА 30 ЛЕТ</span><h2>Десять стратегий: 360 месяцев</h2><p class="small muted">Одинаковые начальные условия, без случайных шоков. Стабилизация меняет ставку каждый месяц; остальные пакеты постоянны. Это результаты условной модели, не прогноз.</p>'+table(validation.main)+'<details class="method-details"><summary>Те же стратегии в сырьевой экономике</summary>'+table(validation.resource)+'</details></section><section class="panel"><h2>Расширенная проверка</h2>'+row('Всего игр',n(validation.totalGames??0,0))+row('Повторы с общими шоками',n(validation.stochasticGames,0))+row('Сравнения собственности и профилей',n(validation.ownershipGameCount??0,0))+row('Кризисные сценарии',n(validation.crisisGameCount??0,0))+row('Проверки чувствительности',n(validation.sensitivityGames,0))+row('Пятидесятилетние игры',n(validation.longHorizonGames,0))+row('Точные воспроизведения журнала',n(validation.replayChecks??0,0))+row('Проверенные месячные переходы',n(validation.monthsChecked,0))+row('Максимальная относительная ошибка балансов',validation.maxRelativeFinancialAudit.toExponential(3))+'<p class="small muted">Правильность учёта не означает эмпирической точности. Коэффициенты условные, внутри групп доходы не различаются; ИЧР и ППС — модельные оценки.</p></section><section class="panel"><h2>Новые механики: 12 пакетов по 30 лет</h2><p class="small muted">Диверсифицированная страна, общий seed 11 и одинаковые шоки. Пакеты меняют несколько решений; это не чистая оценка эффекта собственности.</p>'+table(extendedValidation.games.filter(g=>g.age==='young'&&g.seed===11&&!g.resourceMode))+row('Дополнительные партии',n(extendedValidation.totalGames,0))+row('Дополнительные месячные переходы',n(extendedValidation.monthsChecked,0))+row('Воспроизведения новых сценариев',n(extendedValidation.replayChecks,0))+'</section>';
}
function methodology() {
  const audit=state.lastReport.audit;
  return `<section class="panel"><span class="eyebrow">МОДЕЛЬ ${VERSION}</span><h2 style="margin-top:5px">Что именно вычисляется</h2><div class="callout warning"><strong>Исследовательская модель с условной калибровкой</strong>Балансовые тождества проверяются при каждом ходе. Поведенческие коэффициенты не оценены по данным конкретной страны; результат — следствие заданных допущений. Это не точный прогноз реальной экономики.</div>
    <div class="explain"><p>Открытая экономика: пять отраслей, десять групп семей, банки, отдельный баланс центрального банка, казначейство и внешний сектор. Месячный шаг, ограничения производства, собственность и согласованные финансовые операции.</p><p>Джини рассчитан по группам; ИЧР использует модельное образование и условный ППС. Ни одна форма собственности не получает автоматического бонуса эффективности.</p><p>Качество не задаётся игроком. Институты меняют ограниченный уровень эффективности, а не дают постоянную надбавку к темпу роста. Нулевые коэффициенты позволяют проверить отсутствие предполагаемой отдачи; это не полноценная модель какой-либо экономической школы.</p>
      <div class="formula">ВВП = потребление + инвестиции + госзакупки + экспорт − импорт + изменение запасов</div>
      <ul><li><strong>Годовая эффективная ставка → месяц:</strong> <code>(1 + r)^(1/12) − 1</code>. Износ: <code>1 − (1 − δ)^(1/12)</code>. Купоны с номинальной годовой ставкой: <code>долг × купон / 12</code>.</li><li><strong>Инфляция за 12 месяцев:</strong> <code>ИПЦ[t] / ИПЦ[t−12] − 1</code>. Рост ВВП сравнивает месячный реальный выпуск с тем же месяцем прошлого года.</li><li><strong>Бюджет:</strong> доля известного номинального ВВП последних 12 месяцев делится на 12. Дополнительной индексации по ИПЦ нет. Проценты и погашение долга рассчитываются по каждой когорте.</li><li><strong>Долг / ВВП:</strong> накопленный долг делится на сумму номинального ВВП за последние 12 месяцев. Дефицит на главном экране — месячный поток, приведённый к годовому темпу.</li><li><strong>$6 000 на человека:</strong> начальная годовая величина при населении 10 млн и ВВП $60 млрд. Реальный показатель на карточке — текущий месячный выпуск × 12 / население, в ценах начала. Это годовой темп, а не сумма прошедшего года.</li><li><strong>Первые годовые сравнения:</strong> до января ${state.startYear??2026} используется явная синтетическая история с ростом 3% и инфляцией 8%. После 12 ходов весь годовой расчёт опирается на ваши месяцы.</li><li><strong>Цены:</strong> операции месяца проходят по открывающим ценам. В конце месяца рассчитываются новые цены и ИПЦ; они действуют в следующем месяце. Разовый НДС не становится повторяющимся ценовым шоком. Частные медицинские, образовательные услуги и плата за инфраструктуру освобождены от НДС в этой модели.</li></ul></div>
    </section>
    <section class="panel"><h2>Все ${MODULES.length} экономических блоков</h2><div class="module-grid">${MODULES.map(([name,detail],i)=>`<div class="module-card"><span class="module-index">${String(i+1).padStart(2,'0')}</span><strong>${name}</strong><p>${detail}</p></div>`).join('')}</div></section>
    <section class="panel"><h2>Проверка учёта за последний месяц</h2><p class="small muted">Остатки тождеств, млн. Малые значения порядка 10⁻⁹ — погрешность вычислений.</p>${Object.keys(audit).length?Object.entries(audit).map(([key,val])=>row(({population:'Баланс населения (млн человек)',centralBank:'Баланс центрального банка',bankBalance:'Банковский баланс',nominalGDP:'ВВП: номинальное тождество',realGDP:'ВВП: реальное тождество',goods:'Баланс товаров',externalNFA:'Чистые внешние активы / текущий счёт',governmentCash:'Движение казначейского счёта',governmentDebt:'Движение госдолга'})[key]??key,`<span class="audit-code">${val.toExponential(3)}</span>`)).join(''):'<p class="small muted">Полный набор проверок появится после первого месяца.</p>'}</section>
    <section class="panel"><span class="eyebrow">УСТОЙЧИВОСТЬ ГИПОТЕЗ</span><h2 style="margin-top:5px">Изменить допущения</h2><p class="small muted">Это параметры исследователя, а не действия правительства. Они применяются к последующим ходам. Сравнение из сохранённой точки использует параметры этой точки.</p>${PARAMETER_FIELDS.map(([key,label,min,max,step])=>`<div class="parameter-control"><label for="param-${key}">${label}</label><input type="range" id="param-${key}" min="${min}" max="${max}" step="${step}" value="${state.parameters[key]}" data-parameter="${key}"><input type="number" min="${min}" max="${max}" step="${step}" value="${state.parameters[key]}" data-parameter-number="${key}" aria-label="${label}, значение"></div>`).join('')}</section>`;
}

function missionControl(budget,stopped,waiting){
 const m=state.metrics,balance=currentMetric(state,'budgetBalance'),hasPresident=state.politics.enabled&&state.politics.constitution.form!=='parliamentary',standing=hasPresident?presidentialStanding(state):null;
 let metrics=[['gdpPerCapitaRolling','ВВП на душу',n(currentMetric(state,'gdpPerCapitaRolling'),0),'$'],['unemployment','Безработица',n(m.unemployment,1),'%'],['budgetBalance','Бюджет',balance===null?'—':signed(balance,0),'млн'],['gdpGrowthYoY','Рост',(m.gdpGrowthYoYDefined===0?'—':signed(m.gdpGrowthYoY,1)),'%'],['inflationYoY','Инфляция',n(m.inflationYoY,1),'%'],['presidentialVoteShare','Президент',standing?n(standing.share,1):'—','%'],['governmentPartyRating','Парламент',state.politics.enabled?n(m.governmentPartyRating,1):'—','%']];
 if(state.politics.executive.role==='primeMinister')metrics=metrics.filter(x=>x[0]!=='presidentialVoteShare').map(x=>x[0]==='governmentPartyRating'?[x[0],'Ваша партия',x[2],x[3]]:x);
 if(parliamentary(state))metrics.push(['cabinetSeats','Опора кабинета',cabinetSeats(state)+' / '+state.politics.totalSeats,'']);
 const own=state.politics.parties?.find(p=>p.id===state.politics.executive.playerParty);
 return `<section class="mission-control game-hud"><div class="hud-date"><strong>${date(state.month)}</strong><small>${parliamentary(state)?(state.politics.parliamentary.phase==='forming'?'Переговоры':playerExecutive(state)?'Правительство':'Оппозиция'):state.politics.executive.role==='primeMinister'?'Премьер':'Президент'} · ${esc(state.politics.executive.role==='president'?(state.politics.executive.presidentName??own?.candidateName??'Президент'):(own?partyDisplayName(own):'Государство'))}</small><small id="save-hud" role="status">${esc(saveStatus)}</small></div><div class="hud-metrics">${metrics.map(([key,label,value,unit])=>`<article class="hud-metric" aria-label="${key==='budgetBalance'?'Баланс бюджета за месяц':key==='presidentialVoteShare'?'Рейтинг президента':key==='governmentPartyRating'?'Парламентский рейтинг':label}"><div><span>${label}</span>${key==='cabinetSeats'||key==='presidentialVoteShare'&&!hasPresident?'':graphButton(key)}</div><strong>${value}<small>${value==='—'?'':unit}</small></strong>${key==='cabinetSeats'?'':value==='—'?'<span class="change neutral">—</span>':monthlyChange(key)}</article>`).join('')}</div><button class="settings-toggle" data-action="settings-open" aria-label="Меню игры">⚙</button></section><div class="turn-dock"><button type="button" class="army-shortcut" data-category="army" aria-expanded="${strategyPanelOpen&&openCategory==='army'}">${atlasIcon('army')} Армия</button><span class="decision-counter">${budget.used} / ${budget.limit||3}</span><button class="month-button" aria-label="Следующий месяц" data-action="step" ${busy||stopped?'disabled':''}>${busy?'Расчёт…':stopped?'Завершено':'Конец месяца'}<span aria-hidden="true">→</span></button></div>`;
}
let selectedPaper=null,selectedIssue=null;
function closeNewspaper(){worldNewsOpen=false;}
function closeHistoricalNews(id){
  pressState.seenHistoricalNews=[...new Set([...(pressState.seenHistoricalNews??[]),id])];
  usage.flush();
}
function closeWorldDecision(key){
  pressState.seenWorldDecisions=[...new Set([...(pressState.seenWorldDecisions??[]),key])];
  openedWorldDecision=null;
  usage.flush();
}
function worldDecisionDialog(event,{result=false}={}){
  const english=activeLanguage()==='en',executive=playerExecutive(state);
  const ownVote=(vote,ru,en,choice)=>`<button type="button" data-world-decision="${esc(event.id)}" data-world-answer="${choice}" data-world-ballot="${vote}">${english?en:ru}</button>`;
  let actions='';
  if(!result){
    if(executive){
      actions=Object.entries(event.options).map(([id,option])=>`<button type="button" data-world-decision="${esc(event.id)}" data-world-answer="${id}" ${id===event.motion?'data-world-ballot="accept"':''}>${esc(english?option.en:option.ru)}</button>`).join('');
    }else if(event.motion){
      actions=ownVote('accept','Фракция — за','Instruct your party to vote for','motion')+
        ownVote('reject','Фракция — против','Instruct your party to vote against','motion')+
        ownVote('abstain','Фракция воздержится','Instruct your party to abstain','motion');
    }
  }
  const title=english?(event.enTitle??event.en):event.title;
  const description=english?event.enText:event.text;
  return `<dialog id="world-decision-dialog" data-decision-key="${esc(event.id)}" class="newspaper-popup territorial-request-dialog" aria-labelledby="world-decision-heading">
    <article class="newspaper-sheet">
      <button type="button" data-close-button data-world-decision-close="${esc(event.id)}" aria-label="Закрыть событие">×</button>
      <h2 id="world-decision-heading" tabindex="-1" autofocus>${esc(title)}</h2>
      <p>${esc(description)}</p>
      ${!result&&!executive?`<p>${english?event.motion?'The cabinet is putting the motion to Parliament. You control your own party’s vote.':'The cabinet will decide.':event.motion?'Кабинет выносит предложение в парламент. Вы определяете голос своей фракции.':'Решение принимает кабинет.'}</p>`:''}
      ${actions?`<div class="world-decision-actions">${actions}</div>`:''}
    </article>
  </dialog>`;
}
function historicalNewsDialog(event){
  const english=activeLanguage()==='en';
  return `<dialog id="historical-news-dialog" data-historical-id="${esc(event.id)}" class="newspaper-popup territorial-request-dialog" aria-labelledby="historical-news-heading">
    <article class="newspaper-sheet">
      <button type="button" data-close-button data-action="historical-news-close" data-historical-id="${esc(event.id)}" aria-label="Закрыть событие">×</button>
      <header class="newspaper-masthead"><div><span>${english?'World news':'Мировые новости'}</span><time>${date(event.start,true)}</time></div></header>
      <h2 id="historical-news-heading" tabindex="-1" autofocus>${esc(english?event.enTitle:event.title)}</h2>
      <p>${esc(english?event.enText:event.text)}</p>
    </article>
  </dialog>`;
}
function settingsWindow(){
 if(!settingsOpen||pendingDefenseNotice(state)||electionOpenId!==null)return '';
 return `<dialog id="settings-dialog" class="settings-popup" aria-labelledby="settings-heading">
   <header class="popup-head"><h2 id="settings-heading">Меню игры</h2><button type="button" data-close-button data-action="settings-close" aria-label="Закрыть">×</button></header>
   <div class="game-menu-actions">
     <button type="button" data-action="settings-close">Вернуться в игру</button>
     <button type="button" data-action="save-game">Сохранить игру</button>
     <button type="button" data-action="load-game">Загрузить игру</button>
     ${languageField()}
     ${musicField()}${interfaceSoundField()}
     <button type="button" data-action="main-menu">Выйти в главное меню</button>
   </div>
   <p class="game-menu-status" role="status" id="save-status">${esc(saveStatus)}</p>
 </dialog>`;
}
function floatingWindows(views,requests,briefing){
  const proposal=proposalOpen&&state.politics.bills.find(b=>b.id===proposalId);
  const election=state.politics.elections?.find(e=>e.id===electionOpenId);
  if(election)return electionDialog(state,election,{n,esc,date});
  if(!settingsOpen&&!characterCardId&&!worldNewsOpen&&document.getElementById('main-menu')?.hidden){
    const news=pendingElectionNotice(state,{includeOpening:state.scenario?.id==='uk-2000',currentOnly:true});
    if(news)return electionNewspaper(state,news,{esc,date});
    const pact=pendingElectoralPact(state);
    if(pact)return electoralPactDialog(state,pact,{esc,date});
  }
  const defenseNotice=pendingDefenseNotice(state);
  if(defenseNotice)return `<dialog id="defense-dialog" class="election-popup defense-notice" aria-labelledby="defense-notice-heading"><div class="election-kicker">Безопасность · ${date(defenseNotice.month,true)}</div><h2 id="defense-notice-heading">${esc(defenseNotice.title)}</h2><div class="defense-notice-body">${esc(defenseNotice.text)}</div><button class="primary wide" data-action="defense-notice-army">К армии</button><button class="wide" data-action="defense-notice-close">Закрыть</button></dialog>`;
  if(!settingsOpen&&!characterCardId&&!worldNewsOpen){
    const seen=pressState.seenWorldDecisions??[];
    const answer=worldDecisionNews(state).find(item=>item.start===state.month&&!seen.includes(item.id));
    if(answer)return worldDecisionDialog(answer,{result:true});
    const pending=pendingWorldDecisions(state);
    const event=pending.find(item=>item.id===openedWorldDecision)??pending.find(item=>!seen.includes(item.id));
    if(event)return worldDecisionDialog(event);
  }
  if(briefing?.id==='parliament'&&!settingsOpen&&!characterCardId&&!worldNewsOpen&&resultBillId===null&&!resultExecutive)
    return ministerialBriefingDialog(briefing);
  const headline=historicalNews(state).find(event=>event.start===state.month&&!(pressState.seenHistoricalNews??[]).includes(event.id));
  if(headline&&!settingsOpen&&!characterCardId)return historicalNewsDialog(headline);
  let out=proposal?`<dialog id="proposal-dialog" class="proposal-popup" aria-labelledby="proposal-heading"><div class="popup-head"><h2 id="proposal-heading">Предложения партий</h2><button data-close-button data-action="proposal-close" aria-label="Закрыть предложение">×</button></div>${proposalSpeaker(proposal)}${views.proposal(proposal.id)}<button class="wide" data-action="proposal-close">${proposal.executiveResponse?'Готово':'Рассмотреть позже'}</button></dialog>`:'';
  if(trendMetric==='atlasGDP'){
    const currency=atlasCurrency(state);
    const display=(value,axis=false)=>compactAtlasMoney(atlasDomesticAmount(state,value),currency,{chart:axis});
    const series=metricSeries(state,'realGDPRolling');
    const last=series.at(-1),previous=series.at(-2);
    const delta=previous&&last.month===previous.month+1?last.realGDPRolling-previous.realGDPRolling:null;
    out+=`<dialog id="trend-dialog" class="trend-popup atlas-gdp-dialog" aria-labelledby="trend-heading"><div class="popup-head"><h2 id="trend-heading">Реальный ВВП с начала кампании</h2><button data-close-button data-action="trend-close" aria-label="Закрыть график">×</button></div>
      <div class="small muted">ВВП за последние 12 месяцев, в ценах начала кампании.</div>
      ${series.length>1?`<div class="chart-wrap">${chart([{name:'ВВП',points:series}],'realGDPRolling',{valueLabel:value=>display(value,true),highlightLatest:true})}</div>`:'<div class="atlas-gdp-empty">Линия появится после первого хода.</div>'}
      <div class="trend-values"><span>Сейчас <b>${display(last?.realGDPRolling)}</b></span>${delta!==null?`<span>За последний ход <b>${delta>0?'+':''}${display(delta)}</b></span>`:''}</div>
    </dialog>`;
  }
  if(trendMetric&&METRIC_INFO[trendMetric]){
    const info=METRIC_INFO[trendMetric],series=metricSeries(state,trendMetric),last=series.at(-1),first=series[0];
    out+=`<dialog id="trend-dialog" class="trend-popup" aria-labelledby="trend-heading"><div class="popup-head"><h2 id="trend-heading">${esc(info.label)}</h2><button data-close-button data-action="trend-close" aria-label="Закрыть график">×</button></div><p class="small muted">${esc(info.unit)} · каждая точка — месяц</p><div class="chart-wrap">${chart([{name:'Ваша страна',points:series}],trendMetric,{compact:true})}</div>${last?`<div class="trend-values"><span>Сейчас <b>${n(last[trendMetric],info.digits)}</b></span>${first&&last.month!==first.month?`<span>С начала <b>${signed(last[trendMetric]-first[trendMetric],info.digits)}</b></span>`:''}</div>`:''}${trendMetric==='budgetBalance'?'<p class="small muted">Плюс — профицит, минус — дефицит. Налоги, неналоговые доходы и все бюджетные расходы, включая проценты. Заимствования относятся к финансированию, а не к доходам. Баланс отличается от остатка денег казначейства.</p>':''}<button class="wide" data-action="trend-close">Закрыть</button></dialog>`;
  }
  if(resultBillId!==null||resultExecutive)out+=`<dialog id="result-dialog" class="result-popup" aria-labelledby="result-heading"><button data-close-button class="ballot-close" data-action="result-close" aria-label="Закрыть результат">×</button>${decisionResult()}</dialog>`;
  if(campaignOpen&&!worldNewsOpen&&!proposal&&!settingsOpen&&resultBillId===null&&!resultExecutive){const e=campaignEvent(state);if(e||campaignFeedback)out+=`<dialog id="campaign-dialog" aria-labelledby="campaign-heading"><div class="popup-head"><h2 id="campaign-heading">${esc(campaignFeedback?'Ответ опубликован':e.title)}</h2><button data-close-button data-action="campaign-close" aria-label="Закрыть событие">×</button></div>${campaignFeedback?`<p>${esc(campaignFeedback)}</p><button class="wide" data-action="campaign-close">Готово</button>`:`<p>${esc(e.text)}</p><p class="small muted">До ${e.kind==='president'?'президентских':'парламентских'} выборов ${e.remaining} мес.</p><div class="settings-actions">${e.choices.map((c,i)=>`<button data-campaign-choice="${i}" data-event-id="${esc(e.id)}"><strong>${esc(c.label)}</strong>${c.hint?`<span style="display:block" class="small muted">${esc(c.hint)}</span>`:''}</button>`).join('')}</div><button class="wide" data-action="campaign-close">Позже</button>`}</dialog>`;}
  if(worldNewsOpen&&!proposal&&!settingsOpen&&resultBillId===null&&!resultExecutive)
    out+=pressDialog(state,selectedPaper,pressState,{esc,date,issueId:selectedIssue});
  if(!proposal&&!settingsOpen&&!worldNewsOpen&&!campaignOpen&&!trendMetric&&!characterCardId&&resultBillId===null&&!resultExecutive){
    const request=requests.find(event=>event.id===territorialRequestId)??nextTerritorialRequest(requests,pressState);
    if(request&&(!briefing?.request?.id||request.id!==briefing.request.id||territorialRequestId))out+=territorialRequestDialog(request);
    else if(briefing)out+=ministerialBriefingDialog(briefing);
  }
  return out;
}
function bindFloatingWindows(){
  if(document.body.classList.contains('on-main-menu'))return;
  for(const [id,close] of [['defense-dialog',()=>{const n=pendingDefenseNotice(state);if(n)acknowledgeDefenseNotice(state,n.id);usage.flush();}],['election-headline-dialog',dialog=>acknowledgeElection(state,Number(dialog.dataset.electionId),{includeOpening:true})],['electoral-pact-dialog',null],['election-dialog',()=>{const e=state.politics.elections.find(e=>e.id===electionOpenId);if(e)acknowledgeElection(state,e.id,{includeOpening:true});electionOpenId=null;usage.flush();}],['world-news-dialog',closeNewspaper],['ministerial-briefing-dialog',dialog=>answerMinisterialBriefing(dialog.dataset.briefingId,'close',false)],['world-decision-dialog',dialog=>closeWorldDecision(dialog.dataset.decisionKey)],['historical-news-dialog',dialog=>closeHistoricalNews(dialog.dataset.historicalId)],['territorial-request-dialog',dialog=>closeTerritorialRequest(dialog.dataset.requestId)],['campaign-dialog',()=>{campaignOpen=false;}],['settings-dialog',()=>{settingsOpen=false;}],['proposal-dialog',()=>{proposalOpen=false;}],['trend-dialog',()=>{trendMetric=null;}],['result-dialog',()=>{resultBillId=null;resultExecutive=null;}]]){
    const dialog=document.getElementById(id);if(!dialog)continue;
    if(!dialog.open)dialog.showModal();
    dialog.addEventListener('cancel',event=>{event.preventDefault();if(close){close(dialog);render();}});
  }
}
function electorateView(){
  const p=state.politics;if(!p.enabled)return '<section class="panel"><h2>Электорат</h2><p>Доступен в политической игре.</p></section>';
  const id=p.parties.some(x=>x.active&&x.id===electorateParty)?electorateParty:p.executive.playerParty,groups=p.poll.groups?.filter(g=>g.dimension===electorateDimension)??[],series=electorateSeries(state,electorateDimension,electorateMeasure,id),label=electorateMeasure==='party'?'Поддержка партии':electorateMeasure==='candidate'?'Рейтинг кандидата':electorateMeasure==='presidentApproval'?'Одобрение президента':'Одобрение исполнительной власти';
  const past=p.partyHistory.filter(h=>h.groups).at(-2),oldValue=g=>{const old=past?.groups.find(x=>x.dimension===electorateDimension&&x.id===g.id);return electorateMeasure==='party'?old?.parties[id]:electorateMeasure==='candidate'?old?.candidates[id]:electorateMeasure==='presidentApproval'?old?.presidentApproval:old?.approval;},value=g=>electorateMeasure==='party'?g.parties[id]:electorateMeasure==='candidate'?g.candidates[id]:electorateMeasure==='presidentApproval'?g.presidentApproval:g.approval;
  return `<section class="panel"><h2>Как меняется поддержка избирателей</h2><p class="small muted">Сравните группы и их реакцию на экономический опыт, политику и события. Разделение по группам не означает, что все люди в группе думают одинаково.</p><div class="electorate-filters"><label class="field">Группы<select data-electorate-dimension="true">${Object.entries(GROUP_DIMENSIONS).map(([key,text])=>`<option value="${key}" ${key===electorateDimension?'selected':''}>${text}</option>`).join('')}</select></label><label class="field">Показатель<select data-electorate-measure="true">${[['party','Парламентский рейтинг партии'],['candidate','Президентский рейтинг кандидата']].map(([key,text])=>`<option value="${key}" ${key===electorateMeasure?'selected':''}>${text}</option>`).join('')}</select></label><label class="field">Партия<select data-electorate-party="true">${p.parties.filter(x=>x.active).map(x=>`<option value="${x.id}" ${x.id===id?'selected':''}>${esc(partyDisplayName(x))}</option>`).join('')}</select></label></div><h3>${label} · %</h3>${groups.length?`<div class="chart-wrap electorate-chart">${chart(series,'value',{compare:true,multi:true})}</div><div class="group-legend">${series.map((g,i)=>`<span><i style="border-color:${i%2===0?'#174ca1':'#c52b39'};border-style:${i>1?'dashed':'solid'}"></i>${esc(g.name)}</span>`).join('')}</div><div class="table-wrap"><table class="table"><thead><tr><th>Группа</th><th>Избиратели</th><th>Поддержка сейчас</th><th>Изменение, п.п.</th></tr></thead><tbody>${groups.map(g=>`<tr><td>${esc(g.label)}</td><td>${n(g.eligible*1e6,0)}</td><td>${Number.isFinite(value(g))?pct(value(g)):g.eligible>0?'Нет наблюдения':'Нет избирателей'}</td><td>${Number.isFinite(value(g))&&Number.isFinite(oldValue(g))?signed(value(g)-oldValue(g),1):'Начало наблюдения'}</td></tr>`).join('')}</tbody></table></div>`:'<p>Подробное наблюдение начнётся со следующего расчёта месяца.</p>'}<p class="small muted">${p.partyHistory.find(h=>h.groups)?'Групповые ряды записываются с '+date(p.partyHistory.find(h=>h.groups).month,true)+'.':'История групп ещё не записана.'} Пропуски в старой истории не заполняются вымышленными значениями. Опросы — модельные предпочтения, а не голоса состоявшихся выборов. Поддержка партий взвешивается по ожидаемым участникам, президентский рейтинг — предпочтения между кандидатами.</p></section>`;
}
const CATEGORIES={
  overview:{label:'Обзор',views:[]},
  codex:{label:'Кодекс',views:[]},
  scenario:{label:'Решения сценария',views:[]},
  decisions:{label:'Решения',default:'policy',views:[['policy','Решения'],['ownership','Собственность'],['infrastructure','Инфраструктура']]},
  notes:{label:'Законы страны',default:'constitution',views:[['constitution','Законы страны']]},
  statistics:{label:'Статистика',default:'country',views:[['country','Страна']]},
  political:{label:'Политика',default:'government',views:[['government','Парламент']]},
  army:{label:'Армия',default:'army',views:[['army','Армия']]}
};
function render({returnToMap=false}={}) {
  if(document.getElementById('main-menu')?.hidden) music.setMood(campaignMusicMood(state));
  const views={army:()=>armyView(state,plannedPolicy(state),{n,esc,canAct:state.politics.executive.inOffice&&playerExecutive(state)&&decisionBudget(state).optionalRemaining>0}),country,overview,economy,fiscal,credit,external,households,ownership:ownershipView,institutions:institutionsView,compare:compareView,validation:validationView,method:methodology,policy:sidebar,electorate:electorateView,...extendedViews({state,n,pct,row,esc,queuedActions}),...politicalViews({state,n,pct,row,esc,date}),infrastructure:infrastructureView,constitution:()=>constitutionBoard(state,constitutionUI,{n,esc,date,canVote:decisionBudget(state).optionalRemaining>0,blockedReason:decisionBudget(state).remaining===0?'Все 3 решения месяца использованы.':'Последнее решение оставлено для предложения партии.'})};
  detectDecisionResult();
  if(['elections','electorate'].includes(view))view='government';
  if(updatePress(state,pressState))usage.flush();
  if(openCategory&&CATEGORIES[openCategory].views.length===1)view=CATEGORIES[openCategory].default;
  const category=Object.keys(CATEGORIES).find(key=>CATEGORIES[key].views.some(([id])=>id===view))??'decisions',group=CATEGORIES[category];
  const initiative=unresolvedInitiatives(state)[0];
  if(initiative&&initiative.id!==announcedProposal){announcedProposal=initiative.id;proposalId=initiative.id;proposalOpen=!returnToMap;trendMetric=null;}
  const campaign=campaignEvent(state);if(campaign&&!campaignFeedback&&campaign.id!==announcedCampaign){announcedCampaign=campaign.id;campaignOpen=!returnToMap;campaignFeedback=null;}
  const budget=decisionBudget(state);
  const waiting=unresolvedInitiatives(state).length>0,stopped=Boolean(state.defense?.sovereigntyLost)||state.politics.enabled&&!state.politics.executive.inOffice;
  const dispatch=parliamentary(state)&&state.politics.parliamentary.phase==='forming'
    ?{kind:'government',label:'Сформировать правительство'}
    :waiting?{kind:'proposal',label:'Предложение партии'}:null;
  const britishConnections=state.scenario?.id==='uk-2000';
  const overviewOpen=britishConnections&&strategyPanelOpen&&openCategory==='overview';
  const unreadNews=unreadPressCount(state,pressState);
  const requests=territorialRequests(state,pressState);
  const briefing=pressState.lastMinisterialMonth===state.month?null:ministerialBriefings(state,pressState,requests)[0];

  const navigationLabel=key=>key==='notes'?charterTitle(state):CATEGORIES[key].label;
  const navigationKeys=britishConnections?['overview','statistics','political','codex','notes']:['notes','statistics','political','codex'];
  const selectedCity=cityById(atlasCity);
  const selectedRegion=CODEX_REGIONS.find(region=>region.id===atlasRegion);
  const foreignCountry=CODEX_COUNTRIES.find(country=>country.id===atlasForeign);
  const connectionsOpen=britishConnections&&strategyPanelOpen&&openCategory==='statistics';
  const scenarioOpen=strategyPanelOpen&&openCategory==='scenario';
  const codexOpen=strategyPanelOpen&&openCategory==='codex';
  const protagonist=currentCharacter(state);
  const savedPortrait=campaignLeader&&(!protagonist||protagonist.id===state.characters.originalPlayerId);
  const roster=connectionsOpen||codexOpen||foreignCountry||selectedCity||selectedRegion||briefing||proposalOpen||requests.length||characterCardId||(protagonist&&!savedPortrait)?characterRoster(state,campaignLeader,{includeOrganizations:codexOpen||Boolean(foreignCountry)||Boolean(briefing)}):null;
  const cardPerson=roster?.people.get(characterCardId);
  const portraitName=protagonist?latinCharacterName(protagonist.name):campaignLeader?.name;
  const portrait=portraitName?`<img ${savedPortrait?`src="${campaignLeader.portrait}"`:`data-character-portrait="${protagonist.id}" hidden`} width="180" height="225" alt="Портрет персонажа ${esc(portraitName)}">`:'';
  const hudPortrait=protagonist?`<button type="button" class="campaign-leader-portrait" data-character-card="${protagonist.id}" title="${esc(portraitName)}" aria-label="Карточка вашего персонажа">${portrait}</button>`
    :portrait?`<div class="campaign-leader-portrait">${portrait}</div>`:'';
  disposeDeskAtlas?.();disposeDeskAtlas=undefined;
  app.innerHTML=`<div class="app-shell strategy-game ${hudPortrait?'has-campaign-leader':''} ${overviewOpen?'overview-open':''} ${connectionsOpen?'connections-open':''} ${codexOpen?'codex-open':''} ${strategyPanelOpen?'strategy-panel-open':''}">
    <div class="workspace"><main class="main">${missionControl(budget,stopped,waiting)}${campaignReadout(state,{n,esc,date})}${strategyMap(state,{zoom:atlasZoom,panX:atlasPanX,panY:atlasPanY,world:atlasWorld,dispatch,requests})}${atlasControls(state,{world:atlasWorld,decisions:budget.used,newsCount:unreadNews,statsExpanded:atlasStatsExpanded,scenarioOpen,decisionsOpen:strategyPanelOpen&&openCategory==='decisions'})}${atlasForeign==='eu'?europeanUnionDossier(state):foreignCountry?foreignCountryDossier(state,foreignCountry,roster):selectedCity?cityDossier(state,selectedCity,dispatch,requests):selectedRegion?regionDossier(state,selectedRegion,requests):atlasDossier?countryDossier(state,atlasDossier,{n,date}):''}${hudPortrait}<div class="strategy-situation">${pendingWorldDecisions(state).map(event=>`<button type="button" data-world-choice-open="${esc(event.id)}"><i>!</i> ${esc(activeLanguage()==='en'?event.en:event.title)}</button>`).join('')}${dispatch?`<button ${dispatch.kind==='government'?'data-view="government"':'data-action="proposal-open"'}><i>!</i> ${dispatch.label} <span>→</span></button>`:'<span>Управление страной</span>'}</div>${renderMapNotice(mapNotice,esc)}
    ${stopped?`<div class="callout warning"><strong>Ваше правление завершено.</strong> ${esc(state.politics.executive.reason)} <button data-view="government">Итоговый отчёт</button></div>`:''}
    <div class="cabinet-layout"><div class="cabinet-work"><nav class="main-navigation" aria-label="Основные экраны">${navigationKeys.map(key=>key==='overview'?`<button data-category="overview" class="overview-button ${overviewOpen?'active':''}" aria-label="Обзор" title="Обзор" aria-expanded="${overviewOpen}">${overviewIcon}<span>Обзор</span></button>`:britishConnections&&key==='statistics'?`<button data-category="statistics" aria-label="Связи" title="Связи" class="connections-button ${connectionsOpen?'active':''}" aria-expanded="${connectionsOpen}">${connectionsIcon('connections')}<span>Связи</span></button>`:`<button data-category="${key}" aria-label="${navigationLabel(key)}" title="${navigationLabel(key)}" class="${openCategory===key?'active':''}" aria-current="${openCategory===key?'page':'false'}">${atlasIcon(key)}<span>${navigationLabel(key)}</span></button>`).join('')}</nav>
    ${scenarioOpen?scenarioDiplomacyPanel(state,scenarioOrganization,stopped?'Правление завершено.':!playerExecutive(state)?'Сначала сформируйте правительство.':budget.optionalRemaining<=0?'Нет свободных решений в этом месяце.':'',confirmScenarioExit):codexOpen?codexPanel(codexCategory,codexSection,{roster,personId:codexPerson,returnTab:codexReturnTab,startYear:state.startYear,scenarioId:state.scenario?.id,cityId:codexCity,returnCity:returnToCity,organizationId:codexOrganization,locationId:codexLocation,regionalAccounts:state.regional,regionalStatus:state.regionalStatus}):overviewOpen?overviewPanel(overviewCategory,overviewMode,overviewItem,state):connectionsOpen?connectionsPanel(connectionsTab,state,roster):strategyPanelOpen&&openCategory?`<section class="screen-content" ${openCategory==='decisions'?'data-decisions-window':''} aria-label="Окно управления"><header class="strategy-window-head"><h2 tabindex="-1">${navigationLabel(openCategory)}</h2><button data-close-button data-strategy-close="true" aria-label="Закрыть окно управления">×</button></header><div id="view-content">${views[view??CATEGORIES[openCategory].default]()}</div></section>`:''}
    </div></div></main></div>${settingsWindow()}${floatingWindows(views,requests,briefing)}${cardPerson?characterCard(cardPerson,state.startYear):''}</div>`;
  for(const table of app.querySelectorAll?.('table')??[]){
    const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
    for(const tr of table.querySelectorAll('tbody tr'))for(const [i,td] of [...tr.children].entries())td.dataset.label=translateText(heads[i]??'');
  }
  for(const el of (app.querySelectorAll?.('[data-territory]')??[])){const select=()=>{mapTerritory=el.dataset.territory;render();};el.addEventListener('click',select);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});}
  app.querySelector?.('[data-map-toggle]')?.addEventListener('click',()=>{mapExpanded=!mapExpanded;render();});
  const viewport=app.querySelector?.('.atlas-viewport');
  if(viewport?.dataset?.deskAtlas){disposeDeskAtlas=mountDeskAtlas(viewport,deskCameras,{focusCity,focusForeign,focusRegion,activeRegion:atlasRegion,onRegion:openRegionDossier});focusCity=focusForeign=focusRegion=null;}
  else if(viewport?.addEventListener){let drag=null;viewport.addEventListener('wheel',e=>{e.preventDefault();atlasZoom=Math.max(.65,Math.min(2.5,atlasZoom+(e.deltaY<0?.1:-.1)));const svg=viewport.querySelector('.strategy-atlas');if(svg)svg.style.transform=`translate(${atlasPanX}px,${atlasPanY}px) scale(${atlasZoom})`;},{passive:false});viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest?.('button,a,[data-atlas-home]'))return;drag={x:e.clientX,y:e.clientY,px:atlasPanX,py:atlasPanY,territory:e.target.closest?.('[data-territory]')?.dataset.territory};viewport.setPointerCapture?.(e.pointerId);});viewport.addEventListener('pointermove',e=>{if(!drag)return;atlasPanX=drag.px+e.clientX-drag.x;atlasPanY=drag.py+e.clientY-drag.y;const svg=viewport.querySelector('.strategy-atlas');if(svg)svg.style.transform=`translate(${atlasPanX}px,${atlasPanY}px) scale(${atlasZoom})`;});viewport.addEventListener('pointerup',e=>{const was=drag;drag=null;if(!was)return;if(Math.hypot(e.clientX-was.x,e.clientY-was.y)>6)e.stopPropagation();else if(was.territory){mapTerritory=was.territory;render();}});}
  if(roster)void fillCharacterPortraits(app,roster.people);
  const card=app.querySelector('#character-card');
  if(card){
    card.showModal();
    card.addEventListener('cancel',event=>{event.preventDefault();closeCharacterCard();});
  }
  compactGameCopy(app);
  bindUsage();bindFloatingWindows();
  let stage=guideStage();
  if(stage==='government'){
    if(state.politics.parliamentary?.phase!=='forming')stage='decisions';
    else if(strategyPanelOpen&&openCategory==='political')stage='coalition';
  }
  if(stage==='decisions'&&!budget.optionalRemaining)stage='turn';
  showOpeningGuide(stage);
}

function updateDraft(key,val) {
  const field=POLICY_FIELDS.find(x=>x[0]===key);if(!field)return false;
  const value=policyNumber(val,field[2],field[3],field[4]);if(value===null)return false;
  draft[key]=value;
  const range=app.querySelector(`[data-policy="${key}"]`),num=app.querySelector(`[data-policy-number="${key}"]`);
  if(range)range.value=draft[key];if(num&&document.activeElement!==num)num.value=n(draft[key],field[4]<1?2:0);
  const out=document.getElementById('value-'+key);if(out)out.textContent=n(draft[key],field[4]<1?2:0);
  const cancel=document.getElementById('cancel-policy');if(cancel)cancel.disabled=pending().length===0;
  const rr=document.getElementById('real-rate');if(rr)rr.textContent=pct(realInterestRate(draftBaseRate()/100,state.expectedInflation)*100);
  const pn=document.getElementById('pending-note');if(pn)pn.textContent=pending().length?(state.politics.enabled?'Изменено':`Изменено решений: ${pending().length}`):'Текущая политика сохранена';
  comparison=null;usage.flush();return true;
}
function commitChoice(key){
  if(!state.politics.enabled)return;
  const current=plannedPolicy(state);if(draft[key]===current[key])return;
  const previous=findReusableBill(state,{[key]:draft[key]});
  if(previous?.decidedMonth!==undefined){resultBillId=previous.id;resultExecutive=null;proposalOpen=false;trendMetric=null;draft=plannedPolicy(state);toast('Это предложение уже рассмотрено. Показан прежний результат; решение не потрачено.',3500);return;}
  comparisonBase??=copy(state);
  try{
    executePolitical(state,{kind:'policyDecision',patch:{[key]:draft[key]},title:decisionName(key),deferReferendum:true});
    if(guideStage()==='decisions')setGuide('turn');
  }
  catch(e){toast(e.message);}
  draft=plannedPolicy(state);comparison=null;usage.flush();
}
function votePendingOperation(){
  if(!state.politics.enabled)return;
  const a=state.pendingActions.at(-1);if(!a)return;
  comparisonBase??=copy(state);
  executePolitical(state,{kind:'chooseLaw',patch:{},actions:[copy(a)],title:a.kind==='restructure'?'Обмен государственного долга':a.enterpriseId?'Передача · '+(pressTitle(a.enterpriseId)?.name??state.enterpriseMarket?.companies.find(c=>c.id===a.enterpriseId)?.name??'предприятие'):'Передача собственности'});
  draft=plannedPolicy(state);
}
function policyValue(key,value){
  if(value&&typeof value==='object')return value.kind==='restructure'?'Списание до '+pct(value.haircut*100)+'; срок '+value.extension+' мес.':actionName(value.kind)+' · до '+n(value.points??0,1)+' п.п.';
  const enumValues={'constitution.form':FORMS,'constitution.electoralSystem':ELECTORAL_SYSTEMS,'constitution.presidentSystem':PRESIDENT_SYSTEMS,'constitution.regime':REGIMES,'constitution.confidence':{constructive:'Конструктивный: требуется новый кабинет большинства',ordinary:'Обычный'},'constitution.playerRole':{president:'Президент',primeMinister:'Премьер-министр'}};
  if(key==='constitution.territorialProperty')return value==='local'?'Местная собственность':'Государственная собственность';
  if(key==='constitution.territorialBorrowing')return value==='local'?'Местные облигации разрешены':'Только государство';
  if(['constitution.territorialTax','constitution.territorialSpending'].includes(key))return value==='local'?'Местные власти':value==='central'?'Правительство':'Правило сценария';
  if(enumValues[key])return enumValues[key][value]??value;
  if(['constitution.overrideFraction','constitution.constitutionalFraction'].includes(key))return pct(value*100)+' мест парламента';
  if(typeof value==='boolean')return value?'Включено':'Выключено';
  const choice=POLICY_CHOICES.find(f=>f[0]===key);if(choice)return choice[3].find(x=>x[0]===value)?.[1]??value;
  const field=POLICY_FIELDS.find(f=>f[0]===key);return typeof value==='number'?n(value,field?.[4]<1?2:0)+(field?' '+field[5]:''):String(value??'—');
}
function decisionResult(){
 if(resultExecutive?.kind==='assetTransfer'){
  const {title,success}=resultExecutive;
  const caption=activeLanguage()==='en'?{'Выполнено':'Completed','Выполнено частично':'Partly completed','Не выполнено':'Not completed'}[title]:title;
  return `<div class="ballot-result ${success?'ballot-accepted':'ballot-rejected'}"><div class="ballot-emblem" aria-hidden="true">${success?'✓':'×'}</div><h2 id="result-heading">${caption}</h2></div>`;
 }
 if(['formCabinet','constitutionalConflict','dissolve','referendum'].includes(resultExecutive?.kind)){
  const r=resultExecutive;
  return `<div class="ballot-result ${r.success?'ballot-accepted':'ballot-rejected'}"><div class="ballot-emblem" aria-hidden="true">${r.success?'✓':'×'}</div><h2 id="result-heading">${esc(r.title)}</h2></div><div class="conflict-outcome">${r.details.map(text=>`<p>${esc(text)}</p>`).join('')}${r.consequences?`<p>${esc(r.consequences)}</p>`:''}${r.votes?`<div class="ballot-counts"><div><span>За:</span><b>${n(r.votes.yesVotes,0)}</b></div><div><span>Против:</span><b>${n(r.votes.noVotes,0)}</b></div></div>`:''}</div><button class="wide" data-action="result-close">Понятно</button>`;
 }

 const b=state.politics.bills.find(b=>b.id===resultBillId);
 if(b?.regimeReview?.accepted===false)return `<div class="ballot-result ballot-rejected"><div class="ballot-emblem" aria-hidden="true">×</div><h2 id="result-heading">Совет отклонил пакет</h2><p>${b.regimeReview.kind==='officers'?'Совет офицеров':'Руководящий совет партии'} не согласовал изменение своих ресурсов или полномочий.</p><p class="small">Поддержка ${n(b.regimeReview.support*100,0)} / 100 · необходимо ${n(b.regimeReview.required*100,0)}.</p></div>`;
 const override=b?.vetoOverridden===true&&b.overrideVote?.passed===true;
 const vote=(override?b.overrideVote:null)??b?.finalVote??b?.articles.find(a=>a.vote&&!a.vote.passed)?.vote;
 const threshold=vote?.total>0&&vote.required>Math.floor(vote.total/2)+1
  ? `<p class="small ballot-threshold">Требуется минимум ${n(vote.required,0)} голосов из ${n(vote.total,0)} (≈${n(vote.required/vote.total*100,2)}%).</p>`
  : '';
 if(b?.status==='referendum')return `<div class="ballot-result"><h2 id="result-heading">Нужен референдум</h2></div><div>Парламент одобрил поправку. Осталось голосование граждан.</div>${threshold}<button class="primary wide" data-political-action="referendum" data-bill-id="${b.id}" ${decisionBudget(state).optionalRemaining<=0?'aria-disabled="true" data-blocked-reason="Нет свободных решений. Продолжите в следующем месяце."':''}>Провести референдум</button><button class="wide" data-action="result-close">Позже</button>`;
 const accepted=Boolean(resultExecutive)||Boolean(b&&['passed','enacted'].includes(b.status));
 return `<div class="ballot-result ${accepted?'ballot-accepted':'ballot-rejected'}"><div class="ballot-emblem" aria-hidden="true">${accepted?'✓':'×'}</div><h2 id="result-heading">${override?'Вето преодолено':accepted?'Принято':'Отклонено'}</h2>${b?.playerVote?`<p class="small">Ваша фракция: ${b.playerVote==='accept'?'за':b.playerVote==='reject'?'против':'воздержалась'}</p>`:''}${vote?`<div class="ballot-counts"><div><span>За:</span><b>${vote.yes}</b></div><div><span>Против:</span><b>${vote.no}</b></div></div>`:''}${threshold}</div>`;
}
function snapshotDecisions(){
 observedDecisionKeys=new Set((state.politics.bills??[]).filter(b=>b.decidedMonth!==undefined).map(b=>'bill:'+b.id+':'+b.decisionSequence));
 if(state.politics.lastDecision)observedDecisionKeys.add('executive:'+JSON.stringify(state.politics.lastDecision));
}
function detectDecisionResult(){
 for(const b of state.politics.bills??[]){if(b.decidedMonth===undefined)continue;const key='bill:'+b.id+':'+b.decisionSequence;if(observedDecisionKeys.has(key))continue;observedDecisionKeys.add(key);if(b.cabinetAgreement)continue;if(resultNotice(b)===null){resultBillId=null;resultExecutive=null;proposalOpen=false;continue;}resultBillId=b.id;resultExecutive=null;proposalOpen=false;trendMetric=null;}
 const d=state.politics.lastDecision;if(d?.kind==='executive'){const key='executive:'+JSON.stringify(d);if(!observedDecisionKeys.has(key)){observedDecisionKeys.add(key);resultExecutive=copy(d);resultBillId=null;proposalOpen=false;trendMetric=null;}}
}
function bindUsage(){
 usage.context({seed:state.seed,startYear:state.startYear,month:state.month});
 for(const [id,c] of Object.entries(CATEGORIES)){usage.register('category:'+id,c.label,'category');for(const [key,label] of c.views)usage.register('view:'+key,label,'view');}
 for(const [id,info] of Object.entries(METRIC_INFO))usage.register('graph:'+id,info.label,'graph');
 for(const id of ['proposal','result','new','settings','campaign','world-news','election','defense'])usage.register('window:'+id,({proposal:'Предложение партии',result:'Результат решения',new:'Новая игра',settings:'Настройки',campaign:'Предвыборное событие','world-news':'Мировая новость',election:'Итоги выборов',defense:'Военное событие'})[id],'window');
 for(const label of ['Кредит','Налоги','Бюджет','Валюта','Структура','Инфраструктура','Услуги','Труд','Институты'])usage.register('policy:'+label,label,'policy');
 const current=view&&openCategory?'view:'+view:null;
 const changed=trackedView!==current;if(changed){if(trackedView)usage.close(trackedView);for(const x of usage.report().summary.targets)if(x.kind==='detail')usage.close(x.id);trackedView=current;}
 const windows=electionOpenId!==null?new Set(['window:election']):pendingDefenseNotice(state)?new Set(['window:defense']):new Set([...(worldNewsOpen&&!proposalOpen&&!settingsOpen&&resultBillId===null&&!resultExecutive?['window:world-news']:[]),...(campaignOpen&&!worldNewsOpen&&!proposalOpen&&!settingsOpen&&resultBillId===null&&!resultExecutive&&(campaignEvent(state)||campaignFeedback)?['window:campaign']:[]),...(settingsOpen?['window:settings']:[]),...(document.getElementById('new-dialog')?.open?['window:new']:[]),...(proposalOpen?['window:proposal']:[]),...(trendMetric?['graph:'+trendMetric]:[]),...(resultBillId!==null||resultExecutive?['window:result']:[])]);
 for(const id of trackedWindows)if(!windows.has(id))usage.close(id);
 for(const id of windows)if(!trackedWindows.has(id))usage.open(id,id.startsWith('graph:')?(METRIC_INFO[id.slice(6)]?.label??'Реальный ВВП'):id==='window:proposal'?'Предложение партии':id==='window:new'?'Новая игра':id==='window:settings'?'Настройки':id==='window:campaign'?'Предвыборное событие':id==='window:world-news'?'Мировая новость':id==='window:election'?'Итоги выборов':id==='window:defense'?'Военное событие':'Результат решения',id.startsWith('graph:')?'graph':'window',id==='window:result'?'decision':'interface');
 trackedWindows=windows;
 const charterId=view==='constitution'&&openCategory==='political'&&constitutionUI.section?'constitution:'+constitutionUI.section:null;
 if(trackedCharter!==charterId){if(trackedCharter)usage.close(trackedCharter);trackedCharter=charterId;}
 if(charterId){if(windows.size)usage.close(charterId);else usage.open(charterId,CHARTER_SECTIONS[constitutionUI.section].label,'constitution','navigation');}
 const categoryId=openCategory?'category:'+openCategory:null;if(trackedCategory!==categoryId){if(trackedCategory)usage.close(trackedCategory);trackedCategory=categoryId;}
 const policyId=view==='policy'&&policyTab?'policy:'+policyTab:null;if(trackedPolicy!==policyId){if(trackedPolicy)usage.close(trackedPolicy);trackedPolicy=policyId;}
 if(!windows.size){if(categoryId)usage.open(categoryId,CATEGORIES[openCategory].label,'category','return');if(policyId)usage.open(policyId,policyTab,'policy','return');}else{if(categoryId)usage.close(categoryId);if(policyId)usage.close(policyId);}
 if(windows.size){for(const x of usage.report().summary.targets)if(x.kind==='detail')usage.close(x.id);if(trackedView)usage.close(trackedView);}
 else if(trackedView)usage.open(trackedView,Object.values(CATEGORIES).flatMap(x=>x.views).find(([id])=>id===view)?.[1]??view,'view',changed?'navigation':'return');
 sectionObserver?.disconnect();
 if(typeof IntersectionObserver==='function'){
  sectionObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting&&e.intersectionRect.height>=Math.min(80,e.boundingClientRect.height*.25)&&!trackedWindows.size)usage.event('observed',e.target.dataset.observationId);},{threshold:[0,.01,.025,.05,.1,.25,.5,1]});
  for(const [i,panel] of [...(app.querySelectorAll?.('#view-content .panel')??[])].entries()){
   const label=panel.querySelector('h2,h3')?.textContent?.trim()??'Блок '+(i+1),id='block:'+view+':'+i;panel.dataset.observationId=id;usage.register(id,label,'block');sectionObserver.observe(panel);
  }
 }
 usage.flush();
}
async function step(count) {
  if(busy)return;
  if(state.politics.enabled&&unresolvedInitiatives(state).length){proposalId=unresolvedInitiatives(state)[0].id;proposalOpen=true;trendMetric=null;render();return;}
  if(state.politics.enabled)count=1;
  busy=true;
  const button=app.querySelector('[data-action="step"]');
  if(button){button.disabled=true;button.innerHTML='Расчёт…<span aria-hidden="true">→</span>';}
  await new Promise(r=>setTimeout(r,0));
  let returnToMap=false;
  try {
    if(state.politics.enabled)for(const key of pending())commitChoice(key);
    const origin=state;
    const next=await calculateTurn(origin,count,origin.politics.enabled?origin.policy:draft);
    if(state!==origin)return;
    state=next;
    if (state.month > origin.month && ['government','decisions','turn'].includes(guideStage())) {
      setGuide('budget');
      strategyPanelOpen=false;
      atlasForeign=atlasCity=atlasRegion=atlasDossier=null;
      returnToMap=true;
    }
    if(state.politics.enabled)draft=plannedPolicy(state);
    comparison=null;comparisonBase=null;mobileOpen=false;
    const transfer=assetTransferOutcome(state.journal.slice(-count).flatMap(entry=>entry.actions??[]));
    if(transfer){resultBillId=null;resultExecutive=transfer;}
    const newEdition=updatePress(state,pressState);
    const newElection=state.politics.elections?.at(-1)?.id!==origin.politics.elections?.at(-1)?.id;
    const newCabinet=state.politics.parliamentary?.history.at(-1)?.month!==origin.politics.parliamentary?.history.at(-1)?.month;
    const headline=newEdition?latestPressHeadline(state,pressState):null;
    const notice=newCabinet?cabinetMapNotice(state):newElection?electionMapNotice(state,n):headline?{
      text:(activeLanguage()==='en'?[...historicalNews(state),...worldDecisionAnnouncements(state),...worldDecisionNews(state)].find(event=>event.id===headline.issue.id)?.enTitle:null)??headline.issue.title,attributes:`data-strategy-news="true" data-press-headline="${esc(headline.paper.id)}" data-headline-issue="${esc(headline.issue.id)}"`
    }:null;
    if(notice){
      returnToMap=true;
      showMapNotice(notice);
      strategyPanelOpen=false;atlasForeign=atlasCity=atlasRegion=atlasDossier=null;
      proposalOpen=campaignOpen=false;trendMetric=null;
    }
    usage.flush();
    if(state.month>origin.month)scheduleCampaignAutosave();
  }catch(e){toast('Расчёт остановлен: '+e.message);console.error(e);}
  finally{busy=false;render({returnToMap});}
}
async function calculateCompare() {
  if(busy)return;busy=true;render();await new Promise(r=>setTimeout(r,0));
  try {
    const origin=compareSource==='checkpoint'&&checkpoint?checkpoint:comparisonBase??state;
    comparison=comparePolicies(origin,origin.policy,draft,compareMonths);
    toast(`Рассчитаны ${compareMonths} месяцев. Основной эксперимент остался на прежней дате.`);
  }catch(e){toast('Сравнение остановлено: '+e.message);console.error(e);}
  busy=false;render();
}
function exportCSV() {
  const fields=['month','population','births','deaths','naturalIncrease','totalFertilityRate','lifeExpectancy','elderlyShare','dependencyRatio','realGDPAnnualized','realGDPRolling','gdpUSDRolling','realGDPMonthly','nominalGDPMonthly','gdpPerCapitaReal','inflationYoY','inflationMonthly','unemployment','debtRatio','deficitRatio','exchangeRate','reservesUSD','realIncomeIndex','investment','capitalRatio','npl','giniDisposable','giniMarket','hdi','meanWageNominal','meanWageReal','meanWageUSD','medianEquivalentIncomeReal','relativePoverty','stateAssetShare','stateOutputShare','defaultEpisodes','debtInDefault','liquidityCoverage','leverageRatio','marketContestability','bankContestability','contractReliability','registrationDays','contractDelayDays','antitrustCapacity','courtCapacity','soeAuditCapacity','privateInfrastructureShare','corporateInfrastructureShare','infrastructureMaintenanceCoverage','concessionExposure','totalHealthAccess','totalEducationAccess','unionDensity','bargainingCoverage','strikeHours','judicialIndependence','mediaFreedom','electoralIntegrity','legislativeConstraint','civilFreedom','corruptionRisk','publicSupport','effectivePolicyRate','monetaryReserveCoverage','infrastructureFeeIndex','executiveApproval','presidentApproval','cabinetApproval','officialApproval','governmentPartyRating','presidentialVoteShare','eligibleVoters','expectedTurnout','coalitionSeatShare','inOffice'];
  const lines=[fields.join(';'),...state.history.filter(x=>x.month>=0).map(x=>fields.map(k=>String(x[k]??'')).join(';'))];
  download('economy-monthly-data.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
}

function openRegionDossier(regionId){
  if(busy||atlasWorld||state.scenario?.id!=='uk-2000')return;
  atlasCity=atlasForeign=atlasDossier=null;
  atlasRegion=regionId;
  strategyPanelOpen=false;
  render();
  app.querySelector('[data-atlas-dismiss]')?.focus();
}

function closeTerritorialRequest(id,resolve=false){
  const key=resolve?'resolvedTerritorialRequests':'seenTerritorialRequests';
  const recorded=pressState[key]??[];
  if(!recorded.includes(id))pressState[key]=[...recorded,id].slice(-512);
  territorialRequestId=null;
  usage.flush();
}

function territorialFundingBlock(funding){
  if(!funding)return 'Эта программа недоступна для выбранной территории.';
  if(funding.alreadyFunded)return '';
  if(!playerExecutive(state))return 'Финансирование утверждает действующее правительство.';
  if(decisionBudget(state).optionalRemaining<=0)return 'Нет свободных решений в этом месяце.';
  if(!funding.recurring&&funding.amount>availableTerritorialProgrammeCash(state))
    return 'В казначействе недостаточно свободных средств.';
  return '';
}

function proposalSpeaker(bill){
  const member=state.characters?.people[state.characters.leaders[bill.sponsor]];
  const party=state.politics.parties.find(item=>item.id===bill.sponsor);
  return member?personBriefing(member,'Лидер партии',party?partyDisplayName(party):null):'';
}

function briefingPerson(briefing){
  if(briefing.office.startsWith('uk-'))return britishOfficeHolder(state,briefing.office);
  const member=state.characters.people[state.characters.cabinet[briefing.office]];
  if(!member)return null;
  const party=state.politics.parties.find(item=>item.id===member.partyId);
  return {...member,role:ministryTitle(state,briefing.office),affiliation:party?partyDisplayName(party):null};
}

function ministerialBriefingDialog(briefing){
  const en=activeLanguage()==='en',person=briefingPerson(briefing);
  const proposal=briefing.proposal;
  const funding=briefing.request?territorialRequestFunding(state,briefing.request):null;
  const action=(id,ru,english,primary=false)=>`<button type="button" data-briefing-id="${briefing.id}" data-briefing-action="${id}" ${primary?'class="primary"':''}>${en?english:ru}</button>`;
  const destination=briefing.id==='parliament'?'bill':briefing.id==='foreign'?'foreign':proposal?'review':briefing.id==='funding'?'budget':briefing.id==='credit'?'credit':'review';
  const canApply=proposal&&playerExecutive(state)&&policyPermitted(proposal.key)&&decisionBudget(state).optionalRemaining>0&&plannedPolicy(state)[proposal.key]!==proposal.value;
  const amount=funding?compactAtlasMoney(atlasDomesticAmount(state,funding.amount),atlasCurrency(state)):null;
  const area=funding?CODEX_REGIONS.find(region=>region.id===funding.office.territoryId)?.name??cityById(funding.office.territoryId)?.name:null;
  return `<dialog class="newspaper-popup territorial-request-dialog" id="ministerial-briefing-dialog" data-briefing-id="${briefing.id}" aria-labelledby="ministerial-briefing-title"><article class="newspaper-sheet">
    <button type="button" data-close-button data-briefing-id="${briefing.id}" data-briefing-action="close" aria-label="Закрыть обращение">×</button>
    ${personBriefing(person)}
    <h2 id="ministerial-briefing-title" tabindex="-1" autofocus>${esc(en?briefing.en:briefing.title)}</h2>
    <p>${esc(en?briefing.enText:briefing.text)}</p>
    ${proposal?`<p>${esc(decisionName(proposal.key))} · ${esc(policyValue(proposal.key,plannedPolicy(state)[proposal.key]))} → ${esc(policyValue(proposal.key,proposal.value))}</p>`:''}
    ${funding?`<p>${en?'We can also fund retraining once for':'Можно также разово выделить на переобучение'} ${esc(amount)}${area?' · '+esc(area):''}.</p>`:''}
    <div class="world-decision-actions">
      ${canApply?action('apply',policyAuthority(state,proposal.key)==='law'?'Вынести на голосование':'Принять меру',policyAuthority(state,proposal.key)==='law'?'Put to a vote':'Approve the measure',true):''}
      ${funding&&!territorialFundingBlock(funding)?action('grant','Утвердить разовую помощь','Approve the one-off grant',true):''}
      ${destination!=='review'||proposal?action(destination,briefing.billId?'Открыть предложение':'Открыть раздел',briefing.billId?'Open the proposal':'Open the relevant screen'):''}
      ${proposal||funding?action('decline','Отклонить','Decline'):action('close','Закрыть','Close')}
    </div>
  </article></dialog>`;
}

function answerMinisterialBriefing(id,action,refresh=true){
  const requests=territorialRequests(state,pressState);
  const briefing=ministerialBriefings(state,pressState,requests).find(item=>item.id===id);
  if(!briefing||pressState.lastMinisterialMonth===state.month)return;
  const {proposal}=briefing;
  let outcome=action==='decline'?'declined':null;
  try{
    if(action==='apply'&&proposal&&playerExecutive(state)&&policyPermitted(proposal.key)){
      const bill=executePolitical(state,{kind:'policyDecision',patch:{[proposal.key]:proposal.value},title:decisionName(proposal.key),deferReferendum:true});
      draft=plannedPolicy(state);
      outcome=bill?.status==='rejected'||bill?.status==='vetoed'?'rejected':bill?.status==='referendum'||bill?.status==='awaitingSignature'?'pending':'approved';
    }else if(action==='grant'&&briefing.request){
      const funding=territorialRequestFunding(state,briefing.request),reason=territorialFundingBlock(funding);
      if(reason||funding.recurring)throw new Error(reason||'Доступна только разовая помощь.');
      executePolitical(state,{kind:'territorialProgramme',officeId:funding.officeId,programme:funding.programme,amount:funding.amount});
      if(briefing.request.id)closeTerritorialRequest(briefing.request.id,true);
      outcome='approved';
    }else if(action==='bill'&&briefing.billId){
      proposalId=briefing.billId;proposalOpen=true;
    }else if(action==='foreign'||action==='budget'||action==='credit'||action==='review'){
      resetSectionNavigation();atlasForeign=atlasRegion=atlasCity=atlasDossier=null;
      strategyPanelOpen=true;
      const topic=proposal?decisionTopic(proposal.key,POLICY_FIELDS.find(field=>field[0]===proposal.key)?.[6]):action==='credit'?'Кредит':'Бюджет';
      const collection=DECISION_COLLECTIONS.find(entry=>entry.topics.some(([key])=>key===topic));
      if(action==='foreign'){openCategory='scenario';view=null;}
      else if(proposal?.key==='defensePriority'){openCategory='army';view='army';}
      else if(collection){openCategory='decisions';view='policy';decisionCollection=collection.id;policyTab=topic;}
    }
  }catch(error){toast(error.message);return;}
  pressState.version=1;
  (pressState.ministerialContact??={})[id]=state.month;
  pressState.lastMinisterialMonth=state.month;
  if(outcome){
    const person=briefingPerson(briefing);
    (pressState.ministerialResults??=[]).push({id:'briefing:'+id+':'+state.month,month:state.month,
      title:briefing.title,en:briefing.en,person:person?.name,outcome});
    pressState.ministerialResults=pressState.ministerialResults.slice(-24);
  }
  usage.flush();
  if(refresh)render();
}

function territorialRequestDialog(request){
  const funding=territorialRequestFunding(state,request);
  const reason=territorialFundingBlock(funding);
  const amount=funding?n(atlasDomesticAmount(state,funding.amount),2)+' млн '+atlasCurrency(state):'';
  const speaker=funding?.person?territorialCharacter(state,funding.person):null;
  return `<dialog id="territorial-request-dialog" class="newspaper-popup territorial-request-dialog" data-request-id="${esc(request.id)}" aria-labelledby="territorial-request-heading">
    <article class="newspaper-sheet">
      <button type="button" data-close-button data-request-close aria-label="Закрыть запрос">×</button>
      ${speaker?personBriefing(speaker):'<strong>Запрос местных властей</strong>'}
      <h2 id="territorial-request-heading" tabindex="-1" autofocus>${esc(request.title)}</h2>
      <blockquote>${esc(territorialRequestQuote(request))}</blockquote>
      ${funding?`<p class="request-funding"><strong>${esc(TERRITORIAL_PROGRAMS[funding.programme])}</strong><br>
        ${funding.alreadyFunded?'Запрошенная доля уже выделена.':funding.recurring?`<span>Ежемесячно</span> · <b>${esc(formatGDPPercent(funding.share))}</b> <span>(сейчас около</span> ${esc(amount)})`:`<span>Разово в следующем месяце</span> · <b>${esc(amount)}</b>`}
      </p>`:''}
      ${reason?`<p>${esc(reason)}</p>`:''}
      <div class="request-actions">
        <button type="button" data-request-dismiss>Отклонить</button>
        <button type="button" class="primary" data-request-accept ${reason?'disabled':''}>${funding?.alreadyFunded?'Готово':'Согласиться'}</button>
      </div>
    </article>
  </dialog>`;
}

function answerTerritorialRequest(target){
  const id=target.closest('#territorial-request-dialog')?.dataset.requestId;
  const request=territorialRequests(state,pressState).find(event=>event.id===id);
  if(!request){territorialRequestId=null;render();return;}
  if(target.hasAttribute('data-request-accept')){
    const funding=territorialRequestFunding(state,request);
    const reason=territorialFundingBlock(funding);
    if(reason){toast(reason);render();return;}
    try{
      if(!funding.alreadyFunded){
        const {officeId,programme,recurring}=funding;
        executePolitical(state,{kind:'territorialProgramme',officeId,programme,
          ...(recurring?{share:funding.share,recurring:true}:{amount:funding.amount})});
      }
    }catch(e){toast(e.message);return;}
    toast('Финансирование утверждено.');
  }
  closeTerritorialRequest(id,!target.hasAttribute('data-request-close'));
  render();
}

function openRegion(regionId){
  if(!codexContent(state.scenario?.id).regions.some(region=>region.id===regionId))return;
  atlasCity=atlasRegion=atlasForeign=atlasDossier=null;
  codexCategory='locations';
  codexSection='regions';
  codexLocation=regionId;
  codexPerson=codexCity=codexOrganization=codexReturnTab=null;
  returnToCity=false;
  openCategory='codex';
  strategyPanelOpen=true;
  render();
  app.querySelector('.codex-article h3')?.focus();
}

function closeAtlasDossier(){
  focusCity=atlasCity;
  focusForeign=atlasForeign;
  focusRegion=atlasRegion;
  atlasForeign=atlasCity=atlasRegion=atlasDossier=null;
  render();
}
function closeCharacterCard(){
  const id=characterCardId;
  characterCardId=null;
  render();
  app.querySelector(`[data-character-card="${id}"]`)?.focus();
}
app.addEventListener('click',async event=>{
  if(busy)return;
  const target=event.target.closest('button,a');if(!target)return;
  usage.event('click',target.dataset.campaignChoice!==undefined?'campaign:'+target.dataset.campaignChoice:target.dataset.graph?'graph:'+target.dataset.graph:target.dataset.view?'view:'+target.dataset.view:target.dataset.category?'category:'+target.dataset.category:target.dataset.action?'action:'+target.dataset.action:target.dataset.politicalAction?'political:'+target.dataset.politicalAction:target.dataset.policyTab?'policy:'+target.dataset.policyTab:target.dataset.chart?'chart:'+target.dataset.chart:'link_or_control');
  if(target.hasAttribute('data-atlas-summary')){
    atlasStatsExpanded=!atlasStatsExpanded;
    render();app.querySelector('[data-atlas-summary]')?.focus();return;
  }
  if(target.hasAttribute('data-atlas-gdp')){
    resultBillId=null;resultExecutive=null;proposalOpen=false;trendMetric='atlasGDP';
    render();return;
  }
  if(target.dataset.territorialAppointment){
    try{executePolitical(state,{kind:'appointTerritorialLeader',officeId:target.dataset.territorialAppointment});usage.flush();render();}catch(e){toast(e.message);}
    return;
  }
  if(target.dataset.requestClose!==undefined||target.dataset.requestAccept!==undefined||target.dataset.requestDismiss!==undefined){
    answerTerritorialRequest(target);return;
  }
  if(target.dataset.atlasRequest||target.dataset.requestOpen){
    territorialRequestId=target.dataset.atlasRequest??target.dataset.requestOpen;
    render();return;
  }
  if(target.dataset.territorialChoice){selectTerritorialProgramme(target);return;}
  if(target.dataset.regionSection){toggleRegionSection(target);return;}
  if(target.dataset.regionSituationItem){selectRegionSituation(target,state);return;}
  if(target.dataset.cityStatus){toggleCityStatus(target);return;}
  if(target.dataset.atlasDismiss){
    if(atlasCity||atlasForeign||atlasRegion)closeAtlasDossier();
    else{atlasDossier=null;render();app.querySelector('[data-atlas-dossier]')?.focus();}
    return;
  }
  if(cityById(target.dataset.atlasCity)){
    atlasCity=target.dataset.atlasCity;
    atlasRegion=atlasForeign=atlasDossier=null;strategyPanelOpen=false;
    render();app.querySelector('[data-atlas-dismiss]')?.focus();return;
  }
  const foreignId=target.dataset.atlasForeign;
  if(atlasWorld&&(CODEX_COUNTRIES.some(country=>country.id===foreignId)
    ||(foreignId==='eu'&&state.scenario?.id==='uk-2000'))){
    atlasForeign=foreignId;
    atlasCity=atlasRegion=atlasDossier=null;strategyPanelOpen=false;
    render();app.querySelector('[data-atlas-dismiss]')?.focus();return;
  }
  if(target.dataset.codexReference){
    const entry=codexContent(state.scenario?.id).articles.find(item=>item.id===target.dataset.codexReference);
    if(!entry)return;
    codexCategory=entry.category;
    codexSection=entry.section;codexLocation=entry.id;
    codexPerson=codexCity=codexOrganization=codexReturnTab=null;returnToCity=false;
    atlasForeign=null;openCategory='codex';strategyPanelOpen=true;
    render();app.querySelector('.codex-article h3')?.focus();return;
  }
  if(target.dataset.codexLocation){
    const section=target.dataset.codexLocation;
    if(section==='regions'){openRegion(target.dataset.locationId);return;}
    const records=section==='countries'?CODEX_COUNTRIES:[];
    if(!records.some(item=>item.id===target.dataset.locationId))return;
    atlasForeign=null;
    codexCategory='locations';codexSection=section;codexLocation=target.dataset.locationId;
    codexPerson=codexCity=codexOrganization=codexReturnTab=null;returnToCity=false;
    openCategory='codex';strategyPanelOpen=true;
    render();app.querySelector('.codex-article h3')?.focus();return;
  }
  if(codexContent(state.scenario?.id).cities.some(city=>city.id===target.dataset.codexCity)){
    returnToCity=Boolean(atlasCity)||returnToCity;
    codexCity=target.dataset.codexCity;atlasCity=null;
    codexCategory='locations';codexSection='cities';codexLocation=codexPerson=codexOrganization=codexReturnTab=null;
    openCategory='codex';strategyPanelOpen=true;
    render();app.querySelector('.codex-article h3')?.focus();return;
  }
  if(target.dataset.codexCityBack&&codexCity){
    atlasCity=codexCity;returnToCity=false;strategyPanelOpen=false;
    render();app.querySelector('[data-atlas-dismiss]')?.focus();return;
  }
  if(target.dataset.atlasDossier){atlasCity=atlasRegion=atlasForeign=null;atlasDossier=target.dataset.atlasDossier;strategyPanelOpen=false;render();app.querySelector('[data-atlas-dismiss]')?.focus();return;}
  if(target.dataset.atlasWorld||target.dataset.atlasHome){atlasCity=atlasRegion=atlasForeign=null;if(target.dataset.atlasHome)delete deskCameras.national;atlasWorld=target.dataset.atlasHome?false:!atlasWorld;atlasZoom=1;atlasPanX=atlasPanY=0;render();return;}
  if(target.dataset.overviewCategory||target.dataset.overviewMode||target.dataset.overviewItem!==undefined){
    if(overviewCategories.includes(target.dataset.overviewCategory)){
      overviewCategory=target.dataset.overviewCategory;
      overviewItem=0;
    }else if(['policy','situations'].includes(target.dataset.overviewMode)){
      overviewMode=target.dataset.overviewMode;
      overviewItem=0;
    }else if(overviewEntries(state,overviewCategory,overviewMode).some(item=>item.id===target.dataset.overviewItem)){
      overviewItem=target.dataset.overviewItem;
    }
    const key=['overviewCategory','overviewMode','overviewItem'].find(key=>target.dataset[key]!==undefined);
    const attribute=key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase());
    render();
    app.querySelector(`[data-${attribute}][aria-pressed="true"]`)?.focus();
    return;
  }
  if(CONNECTION_TABS.some(tab=>tab.id===target.dataset.connectionsTab)){
    connectionsTab=target.dataset.connectionsTab;
    render();
    app.querySelector('[data-connections-tab][aria-pressed="true"]')?.focus();
    return;
  }
  if(target.dataset.codexOrganization){
    const roster=characterRoster(state,campaignLeader,{includeOrganizations:true});
    const id=target.dataset.codexOrganization;
    const entry=roster.organizations?.find(item=>item.id===id);
    const faction=roster.factions?.find(item=>item.id===id);
    if(!entry&&!faction)return;
    codexOrganization=id;
    codexCategory='organizations';codexSection=entry?.section??'factions';
    codexLocation=codexPerson=codexCity=codexReturnTab=null;returnToCity=false;
    render();app.querySelector('.codex-article h3')?.focus();return;
  }
  if(target.dataset.characterCardClose){closeCharacterCard();return;}
  if(target.dataset.characterCard){
    if(!characterRoster(state,campaignLeader,{includeOrganizations:openCategory==='codex'}).people.has(target.dataset.characterCard))return;
    characterCardId=target.dataset.characterCard;
    render();return;
  }
  if(target.dataset.codexPerson){
    const roster=characterRoster(state,campaignLeader,{includeOrganizations:openCategory==='codex'||openCategory==='scenario'||Boolean(atlasForeign)});
    const person=roster.people.get(target.dataset.codexPerson);
    if(!person)return;
    atlasForeign=null;
    characterCardId=null;
    const fromConnections=state.scenario?.id==='uk-2000'&&strategyPanelOpen&&openCategory==='statistics';
    if(fromConnections)codexReturnTab=connectionsTab;
    openCategory='codex';strategyPanelOpen=true;
    codexCategory='characters';codexPerson=person.id;codexLocation=codexCity=codexOrganization=null;returnToCity=false;
    if(fromConnections||!roster.sections[codexSection]?.some(row=>row.id===person.id))codexSection=person.section;
    render();app.querySelector('.codex-article h3')?.focus();return;
  }
  if(target.dataset.codexBack&&codexReturnTab){
    connectionsTab=codexReturnTab;codexReturnTab=null;openCategory='statistics';
    render();[...app.querySelectorAll('[data-codex-person]')]
      .find(button=>button.dataset.codexPerson===codexPerson)?.focus();return;
  }
  if(CODEX_CATEGORIES.some(category=>category.id===target.dataset.codexCategory)){
    codexCategory=target.dataset.codexCategory;codexSection=null;codexPerson=codexLocation=codexCity=codexOrganization=null;returnToCity=false;
    render();app.querySelector('[data-codex-category][aria-pressed="true"]')?.focus();return;
  }
  if(CODEX_CATEGORIES.find(category=>category.id===codexCategory)?.sections.some(section=>section.id===target.dataset.codexSection)){
    codexSection=codexSection===target.dataset.codexSection?null:target.dataset.codexSection;codexPerson=codexLocation=codexCity=codexOrganization=null;returnToCity=false;
    const sectionId=target.dataset.codexSection;
    render();app.querySelector(`[data-codex-section="${sectionId}"]`)?.focus();return;
  }
  if(target.dataset.category==='codex'){codexLocation=codexCity=codexOrganization=null;returnToCity=false;codexCategory='organizations';codexSection=null;codexPerson=null;codexReturnTab=null;}
  if(target.dataset.category==='statistics')connectionsTab='cabinet';
  if(target.dataset.category==='scenario'){scenarioOrganization=null;confirmScenarioExit=false;}
  if(target.hasAttribute('data-scenario-eu')){
    atlasForeign=atlasCity=atlasRegion=atlasDossier=null;
    openCategory='scenario';strategyPanelOpen=true;scenarioOrganization='eu';confirmScenarioExit=false;
    render();app.querySelector('.scenario-back')?.focus();return;
  }
  if(target.dataset.scenarioPilot){
    try{
      executePolitical(state,{kind:'startScenarioPilot',pilot:target.dataset.scenarioPilot,choice:target.dataset.pilotChoice});
      usage.flush();render();(app.querySelector('[data-diplomacy-share] input:not(:disabled)')??app.querySelector('.scenario-back'))?.focus();
    }catch(error){toast(error.message);}
    return;
  }
  if(target.dataset.scenarioOrganization!==undefined){
    const previous=scenarioOrganization;
    scenarioOrganization=target.dataset.scenarioOrganization||null;confirmScenarioExit=false;
    render();
    app.querySelector(scenarioOrganization?'.scenario-back':`[data-scenario-organization="${previous}"]`)?.focus();
    return;
  }
  if(target.dataset.scenarioExitPreview){
    confirmScenarioExit=target.dataset.scenarioExitPreview==='open';
    render();app.querySelector(confirmScenarioExit?'[data-scenario-exit]:not(:disabled)':'[data-scenario-exit-preview="open"]')?.focus();return;
  }
  if(target.dataset.scenarioExit!==undefined){
    try{
      executePolitical(state,{kind:'notifyEUWithdrawal'});confirmScenarioExit=false;
      usage.flush();render();app.querySelector('.scenario-back')?.focus();
    }catch(error){toast(error.message);}
    return;
  }

  if(target.dataset.strategyClose){
    const opener=openCategory==='scenario'?'.atlas-scenario-decisions':openCategory==='decisions'?'.atlas-decisions-toggle':null;
    strategyPanelOpen=false;
    render();
    if(opener)app.querySelector(opener)?.focus();
    return;
  }
  if(target.dataset.briefingAction){answerMinisterialBriefing(target.dataset.briefingId,target.dataset.briefingAction);return;}
  if(target.dataset.worldChoiceOpen){
    openedWorldDecision=target.dataset.worldChoiceOpen;
    render();return;
  }
  if(target.dataset.worldDecisionClose){
    closeWorldDecision(target.dataset.worldDecisionClose);
    render();return;
  }
  if(target.dataset.worldDecision){
    try{
      executePolitical(state,{kind:'answerWorldDecision',eventId:target.dataset.worldDecision,
        choice:target.dataset.worldAnswer,vote:target.dataset.worldBallot});
      closeWorldDecision(target.dataset.worldDecision);
      render();
    }catch(error){toast(error.message);}
    return;
  }
  if(target.dataset.action==='historical-news-close'){closeHistoricalNews(target.dataset.historicalId);render();return;}
  if(target.dataset.action==='map-notice-close'){clearMapNotice();return;}
  if(target.dataset.openMapNotice!==undefined)clearMapNotice();
  if(target.dataset.strategyNews){
    atlasForeign=atlasCity=atlasRegion=atlasDossier=null;strategyPanelOpen=false;
    selectedPaper=target.dataset.pressHeadline??defaultPressPaper(state,pressState);selectedIssue=target.dataset.headlineIssue??null;
    if(readPressPaper(pressState,selectedPaper))usage.flush();
    worldNewsOpen=true;settingsOpen=false;proposalOpen=false;campaignOpen=false;trendMetric=null;
    resultBillId=null;resultExecutive=null;render();return;
  }
  if(target.dataset.atlasZoom){atlasZoom=target.dataset.atlasZoom==='reset'?1:Math.max(.65,Math.min(2.5,atlasZoom+(target.dataset.atlasZoom==='in'?.2:-.2)));if(target.dataset.atlasZoom==='reset'){atlasPanX=0;atlasPanY=0;}render();return;}
  if(target.dataset.category&&!strategyPanelOpen)openCategory=null;
  if(target.dataset.category||target.dataset.view){atlasForeign=atlasCity=atlasRegion=atlasDossier=null;strategyPanelOpen=true;}
  if(target.dataset.blockedReason){toast(target.dataset.blockedReason,3000);return;}
  if(target.dataset.charterSection){resetConstitutionUI(constitutionUI);constitutionUI.section=target.dataset.charterSection;usage.event('select','constitution:'+constitutionUI.section);render();return;}
  if(target.dataset.charterBack){resetConstitutionUI(constitutionUI);render();return;}
  if(target.dataset.charterKey){try{const raw=target.dataset.charterValue;stageConstitution(state,constitutionUI,target.dataset.charterKey,raw==='true'?true:raw==='false'?false:raw);render();}catch(e){toast(e.message);}return;}
  if(target.dataset.charterStep){stepConstitution(state,constitutionUI,target.dataset.charterStep,Number(target.dataset.direction));render();return;}
  if(target.dataset.action==='charter-vote'){try{const amendment=constitutionPatch(state,constitutionUI);const patch=constitutionUI.section==='territories'&&Object.hasOwn(constitutionUI.patch,'localElections')?{localElections:constitutionUI.patch.localElections}:{};if(!Object.keys(amendment).length&&!Object.keys(patch).length)return;comparisonBase??=copy(state);executePolitical(state,{kind:'chooseLaw',patch,constitutionPatch:amendment,title:CHARTER_SECTIONS[constitutionUI.section].label,deferReferendum:true});resetConstitutionUI(constitutionUI);draft=plannedPolicy(state);comparison=null;usage.flush();render();}catch(e){toast(e.message);}return;}
  if(target.dataset.action==='defense-notice-close'||target.dataset.action==='defense-notice-army'){const notice=pendingDefenseNotice(state);if(notice)acknowledgeDefenseNotice(state,notice.id);if(target.dataset.action==='defense-notice-army'){resetSectionNavigation();openCategory='army';view='army';strategyPanelOpen=true;}usage.flush();render();return;}
  if(target.dataset.defenseAction){try{executePolitical(state,{kind:'defenseResponse',action:target.dataset.defenseAction});draft=plannedPolicy(state);usage.flush();render();}catch(e){toast(e.message);}return;}
  if(target.dataset.assetSector!==undefined){assetUI.sector=Number(target.dataset.assetSector);usage.event('select','asset:sector:'+assetUI.sector);render();app.querySelector('.asset-record h3')?.focus();return;}
  if(target.dataset.networkAsset){assetUI.network=target.dataset.networkAsset;usage.event('select','asset:network:'+assetUI.network);render();app.querySelector('.asset-record h3')?.focus();return;}
  if(target.dataset.assetClose){
    const kind=target.dataset.assetClose==='network'?'network':'sector';
    const selection=assetUI[kind];
    assetUI[kind]=null;render();
    app.querySelector(`[${kind==='network'?'data-network-asset':'data-asset-sector'}="${selection}"]`)?.focus();
    return;
  }
  if(target.dataset.assetKind){assetUI[target.dataset.assetDomain==='network'?'networkKind':'ownershipKind']=target.dataset.assetKind;render();return;}
  if(target.dataset.pactAnswer){
    try{executePolitical(state,{kind:'answerElectoralPact',choice:target.dataset.pactAnswer});usage.flush();render();}
    catch(error){toast(translateText(error.message));}
    return;
  }
  if(target.dataset.action==='election-ack'){acknowledgeElection(state,Number(target.dataset.electionId),{includeOpening:true});electionOpenId=null;usage.flush();render();return;}
  if(target.dataset.action==='election-open'){
    electionOpenId=Number(target.dataset.electionId);acknowledgeElection(state,electionOpenId,{includeOpening:true});render();return;
  }
  if(target.dataset.action==='world-news-close'){closeNewspaper();render();app.querySelector('[data-strategy-news]')?.focus();return;}
  if(target.dataset.pressPaper&&pressTitle(target.dataset.pressPaper)){
    selectedPaper=target.dataset.pressPaper;selectedIssue=null;
    if(readPressPaper(pressState,selectedPaper))usage.flush();
    render();app.querySelector('.press-tabs [aria-pressed="true"]')?.focus();return;
  }
  if(target.dataset.pressIssue){selectedIssue=target.dataset.pressIssue;render();app.querySelector('#world-news-heading')?.focus();return;}
  if(target.dataset.action==='campaign-open'){campaignOpen=true;campaignFeedback=null;proposalOpen=false;render();return;}
  if(target.dataset.action==='campaign-close'){campaignOpen=false;campaignFeedback=null;render();return;}
  if(target.dataset.campaignChoice!==undefined){try{campaignFeedback=executePolitical(state,{kind:'campaignResponse',eventId:target.dataset.eventId,choice:Number(target.dataset.campaignChoice)});usage.flush();render();}catch(e){toast(e.message);}return;}
  if(target.dataset.action==='settings-open'){settingsOpen=true;proposalOpen=false;trendMetric=null;resultBillId=null;resultExecutive=null;render();return;}
  if(target.dataset.action==='guide-finish'){setGuide('done');const completion=completeGuide();showOpeningGuide(null);usage.flush();await completion;return;}
  if(target.dataset.action==='save-game')return saveMenu.open({mode:'save'});
  if(target.dataset.action==='load-game')return saveMenu.open({mode:'load'});
  if(target.dataset.action==='settings-close'){
    settingsOpen=false;render();
    app.querySelector('.settings-toggle')?.focus();
    return;
  }
  if(settingsOpen&&target.dataset.action){settingsOpen=false;render();}
  if(target.dataset.action==='result-close'){resultBillId=null;resultExecutive=null;render();return;}
  if(target.dataset.graph){resultBillId=null;resultExecutive=null;trendMetric=target.dataset.graph;proposalOpen=false;render();return;}
  if(target.dataset.action==='proposal-open'){const b=unresolvedInitiatives(state)[0];if(b){proposalId=b.id;proposalOpen=true;trendMetric=null;}render();return;}
  if(target.dataset.action==='proposal-close'){proposalOpen=false;render();return;}
  if(target.dataset.action==='trend-close'){const atlas=trendMetric==='atlasGDP';trendMetric=null;render();if(atlas)app.querySelector('[data-atlas-gdp]')?.focus();return;}
  if(target.dataset.action==='consumption-toggle'){consumptionOpen=!consumptionOpen;if(consumptionTimer)clearTimeout(consumptionTimer);render();return;}
  if(target.dataset.incomeGroup!==undefined){
   const next=Number(target.dataset.incomeGroup);if(!Number.isInteger(next)||next<0||next>4||next===consumptionGroup)return;
   consumptionGroup=next;if(consumptionTimer)clearTimeout(consumptionTimer);
   for(const button of app.querySelectorAll?.('[data-income-group]')??[])button.setAttribute('aria-pressed',String(Number(button.dataset.incomeGroup)===next));
   const stage=document.getElementById('consumption-stage');if(!stage)return;
   stage.classList.remove('entering');stage.classList.add('leaving');
   const replace=()=>{stage.innerHTML=consumptionContent(state,consumptionGroup,{n,esc});stage.classList.remove('leaving');stage.classList.add('entering');consumptionTimer=null;};
   if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)replace();else consumptionTimer=setTimeout(replace,160);return;
  }
  if(target.dataset.factionVote){try{executePolitical(state,{kind:'setFactionVote',vote:target.dataset.factionVote});usage.flush();render();}catch(e){toast(e.message);}return;}
  if(target.dataset.parliament){try{
    executePolitical(state,target.dataset.parliament==='form'?{kind:'formCabinet'}:{kind:'negotiateCoalition',partyId:target.dataset.partyId,mode:target.dataset.parliament});if(target.dataset.parliament==='form'){if(guideStage()==='government')setGuide('decisions');snapshotDecisions();resultBillId=null;proposalOpen=false;resultExecutive=null;strategyPanelOpen=false;showMapNotice(cabinetMapNotice(state));}draft=plannedPolicy(state);usage.flush();render();if(target.dataset.parliament!=='form')toast(target.dataset.parliament==='remove'?'Партия убрана из проекта коалиции.':'Условие принято.',3000);}catch(e){toast(e.message);}return;}
  if(target.dataset.politicalAction){try{comparisonBase??=copy(state);handlePoliticalAction(state,target.dataset,id=>document.getElementById(id));if(target.dataset.politicalAction==='constitutionalConflict'){resultExecutive=constitutionalConflictResult(state);resultBillId=null;proposalOpen=false;trendMetric=null;}
 if(target.dataset.politicalAction==='dissolve'){resultExecutive={kind:'dissolve',success:true,title:'Выборы назначены',details:['Досрочные парламентские выборы · '+date(state.politics.scheduledParliament,true)]};resultBillId=null;proposalOpen=false;trendMetric=null;}
 if(target.dataset.politicalAction==='referendum'){const b=state.politics.bills.find(b=>b.id===Number(target.dataset.billId)),r=b?.referendum;if(r){resultExecutive={kind:'referendum',success:r.passed,title:r.passed?'Поправка одобрена':'Поправка отклонена',details:[r.passed?'Вступит в силу со следующего месяца.':'Конституция остаётся прежней.'],votes:copy(r)};resultBillId=null;proposalOpen=false;trendMetric=null;}}
 draft=plannedPolicy(state);comparison=null;usage.flush();render();}catch(e){toast(e.message);}return;}
  if(target.dataset.action==='army-budget'){resetSectionNavigation();openCategory='decisions';view='policy';policyTab='Бюджет';render();return;}
  if(target.dataset.category){
    resetSectionNavigation();
    openCategory=openCategory===target.dataset.category?null:target.dataset.category;
    strategyPanelOpen=Boolean(openCategory);
    view=openCategory==='decisions'||(openCategory&&CATEGORIES[openCategory].views.length===1)?CATEGORIES[openCategory].default:null;
    render();
    if(target.dataset.category==='decisions')
      app.querySelector(openCategory?'.strategy-window-head h2':'.atlas-decisions-toggle')?.focus();
    return;
  }
  if(target.dataset.decisionCollection&&DECISION_COLLECTIONS.some(item=>item.id===target.dataset.decisionCollection)){
    decisionCollection=target.dataset.decisionCollection;
    render();app.querySelector('[data-decision-collection][aria-pressed="true"]')?.focus();return;
  }
  if(target.dataset.view){
    event.preventDefault();
    const id=target.dataset.view;
    const category=Object.keys(CATEGORIES).find(key=>CATEGORIES[key].views.some(([destination])=>destination===id));
    if(!category)return;
    const collection=openCategory==='decisions'&&category==='decisions'?decisionCollection:null;
    resetSectionNavigation();
    if(collection)decisionCollection=collection;
    openCategory=category;view=id;render();
    if(target.dataset.openView)(app.querySelector('.decision-page h3')??app.querySelector('[data-decision-collection][aria-pressed="true"]')??app.querySelector('.strategy-window-head h2'))?.focus();
    return;
  }
  if(target.dataset.policyTab){
    const collection=DECISION_COLLECTIONS.find(item=>item.topics.some(([id,,destination])=>id===target.dataset.policyTab&&!destination));
    if(!collection)return;
    decisionCollection=collection.id;openCategory='decisions';view='policy';policyTab=target.dataset.policyTab;
    render();app.querySelector('.decision-page h3')?.focus();return;
  }
  if(target.dataset.chart){chartMetric=target.dataset.chart;render();return;}
  if(target.dataset.compareChart){compareMetric=target.dataset.compareChart;render();return;}
  if(target.dataset.cancelAction){state.pendingActions=state.pendingActions.filter(a=>a.id!==Number(target.dataset.cancelAction));comparison=null;usage.flush();render();return;}
  if(target.dataset.shock){
    const presets={commodity:['commodityPrice',.70],energy:['energyPrice',1.30],demand:['foreignDemand',.85],weather:['weather',.80],supply:['importAvailability',.70]};
    const [key,multiplier]=presets[target.dataset.shock];scheduleShock(state,{key,multiplier,duration:12});comparison=null;usage.flush();render();toast('Шок запланирован со следующего месяца.');return;
  }
  if(target.dataset.removeShock!==undefined){const i=Number(target.dataset.removeShock);if(state.shocks[i]?.start>state.month){state.shocks.splice(i,1);usage.flush();comparison=null;render();}return;}
  switch(target.dataset.action) {
    case 'step':await step(1);break;
    case 'run3':await step(3);break;
    case 'run12':await step(12);break;
    case 'controls':mobileOpen=!mobileOpen;render();break;
    case 'compare-view':break;
    case 'compare':await calculateCompare();break;
    case 'cancel-policy':draft=state.politics.enabled?plannedPolicy(state):copy(state.policy);comparison=null;usage.flush();render();break;
    case 'legacy-export':{const old=JSON.parse(legacySave);download('economy-original-previous-version.json',old.simulation);toast('Прежний эксперимент скачан без изменения его данных.');break;}
    case 'export':
    case 'export-compact':
      try{await exportCampaign(target.dataset.action==='export-compact');toast('Файл сохранения подготовлен.');}
      catch(error){toast(error.message);}
      break;
    case 'import':document.getElementById('import-file').click();break;
    case 'csv':exportCSV();break;
    case 'usage-export':usage.event('export','ui-observation');download(`interface-${date(state.month,true)}.json`,JSON.stringify(usage.report(),null,2));break;
    case 'ownership-queue':try{assertDecisionAvailable(state,{kind:'chooseLaw'});scheduleOwnership(state,{sector:Number(document.getElementById('ownership-sector').value),kind:document.getElementById('ownership-kind').value,points:Number(document.getElementById('ownership-points').value),compensation:Number(document.getElementById('ownership-compensation').value)/100});votePendingOperation();usage.flush();comparison=null;render();toast('Рассмотрено.');}catch(e){toast(e.message);}break;
    case 'network-queue':try{assertDecisionAvailable(state,{kind:'chooseLaw'});scheduleNetwork(state,{network:document.getElementById('network-id').value,kind:document.getElementById('network-kind').value,points:Number(document.getElementById('network-points').value)});votePendingOperation();usage.flush();comparison=null;render();toast('Рассмотрено.');}catch(e){toast(e.message);}break;
    case 'restructure-queue':try{assertDecisionAvailable(state,{kind:'chooseLaw'});scheduleRestructuring(state,{haircut:Number(document.getElementById('debt-haircut').value)/100,extension:Number(document.getElementById('debt-extension').value)});votePendingOperation();usage.flush();comparison=null;render();toast(state.politics.enabled?'Голосование по обмену долга завершено.':'Обмен запланирован. Потеря приведённой стоимости будет считаться дефолтом.');}catch(e){toast(e.message);}break;
    case 'journal-export':download(`economy-decisions-${date(state.month,true)}.json`,JSON.stringify({format:'economy-decisions',version:VERSION,provenance:state.provenance,journal:state.journal,currentTurnPoliticalCommands:state.politics.turnCommands??[]},null,2));break;
    case 'replay':if(!busy){busy=true;render();await new Promise(r=>setTimeout(r,0));try{const replay=replayJournal(state);const errors=Object.entries(state.metrics).map(([k,v])=>Math.abs(v-replay.metrics[k])/Math.max(1,Math.abs(v)));toast(Math.max(...errors)<1e-10?'Журнал точно воспроизвёл текущие показатели.':'Журнал не воспроизвёл результат: проверьте версию и данные.');}catch(e){toast('Воспроизведение остановлено: '+e.message);}busy=false;render();}break;
    case 'main-menu':mainMenu.show();break;
    case 'new':if(trackedView)usage.close(trackedView);if(trackedCategory)usage.close(trackedCategory);if(trackedPolicy)usage.close(trackedPolicy);mainMenu.show();mainMenu.newGame();break;
    case 'checkpoint':
      checkpoint=copy(state);checkpointPress=copy(pressState);try{await storage.set(CHECKPOINT,JSON.stringify({format:'economy-model',version:VERSION,state:checkpoint,newspaper:checkpointPress}));toast('Точка сравнения сохранена.');}catch(e){toast('Точка сохранена только на время этой сессии. Скачайте файл.');}comparison=null;render();break;
    case 'restore':if(checkpoint){clearMapNotice();resetSectionNavigation();electionOpenId=null;territorialRequestId=null;openedWorldDecision=null;worldNewsOpen=false;selectedPaper=selectedIssue=null;pressState=copy(checkpointPress??{});campaignOpen=false;campaignFeedback=null;announcedCampaign=null;proposalOpen=false;trendMetric=null;resultBillId=null;resultExecutive=null;announcedProposal=null;state=copy(checkpoint);enableInstantPolitics(state);enableElectionExperience(state);enableAccountability(state);enableStablePreferences(state);enableFactionControl(state);enablePoliticalDynamics(state);enableOppositionCompetition(state);enablePartyPrograms(state);enableLocalGovernment(state);enableTerritorialGovernment(state);enablePresidentialDecisions(state);enableDefense(state);enableBritishScenario(state);enableBriefingOffices();if(state.politics.enabled&&state.politics.executive.inOffice&&(!state.politics.livingWorld||state.stochastic))executePolitical(state,{kind:'setLivingWorld'});if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.agendaSlots!==1)executePolitical(state,{kind:'setAgendaSlots',slots:1});if(state.politics.enabled&&state.politics.executive.inOffice&&state.politics.decisionLimit!==3)executePolitical(state,{kind:'setDecisionLimit',limit:3});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.dashboardMode)executePolitical(state,{kind:'setDashboardMode'});if(state.politics.enabled&&state.politics.executive.inOffice&&!state.politics.partyContinuity)executePolitical(state,{kind:'setPartyContinuity'});draft=state.politics.enabled?plannedPolicy(state):copy(state.policy);comparisonBase=null;comparison=null;snapshotDecisions();usage.flush();render();toast('Эксперимент восстановлен из сохранённой точки.');}break;
  }
});
app.addEventListener('focusin',event=>{if(event.target.dataset?.policyNumber)event.target.select?.();});
app.addEventListener('input',event=>{
  if(busy)return;
  const e=event.target;
  if(e.dataset.assetInput){const key=e.dataset.assetInput,value=Number(e.value);if(!['points','networkPoints','compensation'].includes(key)||e.value===''||!Number.isFinite(value))return;assetUI[key]=Math.max(key==='compensation'?0:1,Math.min(100,value));for(const input of app.querySelectorAll?.(`[data-asset-input="${key}"]`)??[])if(input!==e)input.value=assetUI[key];if(key==='networkPoints'&&state.foundation){const preview=app.querySelector?.('.transfer-preview');if(preview)preview.textContent=networkQuoteMessage(networkTransferQuote(state,{network:assetUI.network,kind:assetUI.networkKind,points:assetUI.networkPoints}),assetUI.networkKind,n);}return;}

  if(e.dataset.policy)updateDraft(e.dataset.policy,e.value);
  if(e.dataset.policyNumber&&e.value!=='')updateDraft(e.dataset.policyNumber,e.value);
  if(e.hasAttribute?.('data-note')){state.pendingNote=e.value.slice(0,1000);usage.flush();}
  const param=e.dataset.parameter??e.dataset.parameterNumber;
  if(param&&e.value!=='') {
    const field=PARAMETER_FIELDS.find(f=>f[0]===param);if(!field)return;
    const val=Math.max(field[2],Math.min(field[3],Number(e.value)));if(!Number.isFinite(val))return;
    state.parameters[param]=val;
    app.querySelector(`[data-parameter="${param}"]`).value=val;
    const num=app.querySelector(`[data-parameter-number="${param}"]`);if(num!==e)num.value=val;
    comparison=null;usage.flush();
  }
});
app.addEventListener('input',event=>{
  const slider=event.target;
  if(slider.dataset.gdpSlider===undefined)return;
  slider.dataset.edited='true';
  const value=formatGDPPercent(gdpSliderShare(slider));
  slider.closest('label').querySelector('output').value=value;
  slider.setAttribute('aria-valuetext',value);
});
function commitDiplomacySlider(slider,form){
  if(busy||slider.disabled||!slider.dataset.edited)return;
  delete slider.dataset.edited;
  delete slider.dataset.keyboardEdit;
  try{
    executePolitical(state,{kind:'setDiplomacyShare',organization:form.dataset.diplomacyShare,share:gdpSliderShare(slider)/100,budgeted:true});
    usage.flush();render();
    app.querySelector('[data-diplomacy-share] input:not(:disabled)')?.focus();
  }catch(e){toast(e.message);render();}
}
app.addEventListener('submit',event=>{
  const form=event.target.closest('[data-territorial-programme]');
  if(!form)return;
  event.preventDefault();
  if(busy)return;
  const share=gdpSliderShare(form.querySelector('[data-gdp-slider]'));
  const programme=form.dataset.programme;
  try{
    executePolitical(state,{kind:'territorialProgramme',officeId:form.dataset.territorialProgramme,programme,share,recurring:true});
    usage.flush();render();
    const tab=app.querySelector('[data-region-section="decisions"]');
    const choice=app.querySelector(`[data-territorial-choice="${programme}"]`);
    if(tab)toggleRegionSection(tab);
    if(choice){selectTerritorialProgramme(choice);choice.focus();}
  }catch(e){toast(e.message);}
});
async function changeInterfaceLanguage(select){
  if(select.value===activeLanguage())return;
  select.disabled=true;
  try{
    await setGameLanguage(select.value);
    const focusInGame=select.closest('#settings-dialog');
    render();
    if(focusInGame)app.querySelector('[data-game-language]')?.focus();
  }catch(error){
    select.value=activeLanguage();
    toast('Не удалось изменить язык.');
  }finally{
    select.disabled=false;
  }
}
app.addEventListener('change',event=>{
  if(event.target.dataset?.gameLanguage!==undefined)return changeInterfaceLanguage(event.target);
  if(busy)return;
  const e=event.target;
  if(e.dataset.gdpSlider!==undefined){
    const form=e.closest('[data-diplomacy-share]');
    if(form&&!e.dataset.keyboardEdit)commitDiplomacySlider(e,form);
    return;
  }
  for(const key of ['electorateDimension','electorateMeasure','electorateParty'])if(e.dataset[key])usage.event('filter','electorate:'+key,{selection:key==='electorateParty'?String(e.value).slice(0,30):e.value});
  if(e.dataset.policyNumber||e.dataset.policyCheck||e.dataset.policyChoice)usage.event('change','policy-field:'+(e.dataset.policyNumber??e.dataset.policyCheck??e.dataset.policyChoice));
  if(e.dataset.electorateDimension){electorateDimension=e.value;render();return;}
  if(e.dataset.electorateMeasure){electorateMeasure=e.value;render();return;}
  if(e.dataset.electorateParty){electorateParty=e.value;render();return;}
  if(e.dataset.policyChoice){draft[e.dataset.policyChoice]=e.value;commitChoice(e.dataset.policyChoice);comparison=null;usage.flush();render();return;}
  if(e.dataset.policy||e.dataset.policyNumber){const key=e.dataset.policy??e.dataset.policyNumber;if(e.value===''){draft[key]=(state.politics.enabled?plannedPolicy(state):state.policy)[key];render();return;}if(updateDraft(key,e.value))commitChoice(key);else draft[key]=(state.politics.enabled?plannedPolicy(state):state.policy)[key];render();return;}
  if(e.dataset.policyCheck){draft[e.dataset.policyCheck]=e.checked;commitChoice(e.dataset.policyCheck);comparison=null;usage.flush();render();}
  if(e.dataset.world&&e.value!=='') {
    const val=Math.max(Number(e.min),Math.min(Number(e.max),Number(e.value)));
    if(Number.isFinite(val)){state.world[e.dataset.world]=val;e.value=val;comparison=null;usage.flush();}
  }
  if(e.hasAttribute('data-stochastic')){state.stochastic=e.checked;comparison=null;usage.flush();}
  if(e.id==='compare-source'){compareSource=e.value;comparison=null;render();}
  if(e.id==='compare-months'){compareMonths=Number(e.value);comparison=null;render();}
});
app.addEventListener('keydown',event=>{
  if(busy)return;
  const e=event.target;
  if(e.dataset?.gdpSlider!==undefined&&e.closest('[data-diplomacy-share]')){
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))e.dataset.keyboardEdit='true';
    if(event.key==='Enter'){event.preventDefault();commitDiplomacySlider(e,e.closest('[data-diplomacy-share]'));}
    return;
  }
  if(event.key!=='Enter'||event.isComposing)return;
  if((resultBillId!==null||resultExecutive)&&electionOpenId===null&&!pendingDefenseNotice(state)&&!settingsOpen){event.preventDefault();event.stopPropagation?.();if(!event.repeat){resultBillId=null;resultExecutive=null;render();}return;}
  if(event.repeat||!e.dataset?.policyNumber)return;
  event.preventDefault();if(e.value!==''){if(updateDraft(e.dataset.policyNumber,e.value))commitChoice(e.dataset.policyNumber);else draft[e.dataset.policyNumber]=(state.politics.enabled?plannedPolicy(state):state.policy)[e.dataset.policyNumber];render();}
});
app.addEventListener('pointermove',event=>{
  const rect=event.target.closest('[data-chart-tip]');if(!rect)return;
  const tip=rect.closest('.chart-wrap').querySelector('.chart-tip');if(tip)tip.textContent=rect.dataset.chartTip;
});
let startStep=0, pendingLeader=null, launchingCampaign=false;
const governmentSelect=document.getElementById('new-government'),countrySelect=document.getElementById('new-country');
governmentSelect.innerHTML=Object.entries(GOVERNMENT_PRESETS).map(([id,p])=>`<option value="${id}">${esc(p.label)}</option>`).join('');
countrySelect.innerHTML=Object.entries(COUNTRY_PRESETS).map(([id,p])=>`<option value="${id}">${esc(p.label)} · $${n(p.gdp,0)} / человек</option>`).join('');
document.getElementById('new-party').innerHTML=PARTY_FAMILIES.map(p=>`<option value="${p.id}" ${p.id==='liberal'?'selected':''}>${esc(partyDisplayName({id:'p1',family:p.id}))}</option>`).join('');
governmentSelect.value='presidential';countrySelect.value='middle';document.getElementById('new-resource').value='true';
function updateStartDescription(){
 const partySelect=document.getElementById('new-party'),oldParty=partySelect.value;
 const two=GOVERNMENT_PRESETS[governmentSelect.value].constitution.form==='presidential';
 const families=startFamilies(governmentSelect.value);
 partySelect.innerHTML=families.map(p=>`<option value="${p.id}">${esc(partyDisplayName({id:'p1',family:p.id}))}</option>`).join('');
 partySelect.value=families.some(p=>p.id===oldParty)?oldParty:'liberal';
 document.getElementById('new-government-description').textContent=GOVERNMENT_PRESETS[governmentSelect.value].description;
 const c=COUNTRY_PRESETS[countrySelect.value];document.getElementById('new-country-description').textContent=`$${n(c.gdp,0)}`;
 document.getElementById('new-choice-content').innerHTML=startChoices({step:startStep,government:governmentSelect.value,country:countrySelect.value,party:partySelect.value,resource:document.getElementById('new-resource').value||'true'});
}
governmentSelect.addEventListener('change',updateStartDescription);countrySelect.addEventListener('change',updateStartDescription);updateStartDescription();
const newGameForm=document.getElementById('new-form');
function launchConfiguredCampaign(formElement){
  const form=new FormData(formElement);
  return launchCampaign(newGameOptions({government:form.get('government')??'presidential',country:form.get('country')??'middle',party:form.get('party')??'liberal',resource:form.get('resource')==='true'}),pendingLeader);
}
newGameForm.addEventListener('click',event=>{
  const target=event.target.closest?.('button[type="submit"],[data-start-key],[data-start-step]');
  if(!target)return;
  if(target.type==='submit'){
    event.preventDefault();
    return launchConfiguredCampaign(newGameForm);
  }
  if(target.dataset.startStep!==undefined)startStep=Math.max(0,Math.min(2,Number(target.dataset.startStep)));
  else document.getElementById('new-'+target.dataset.startKey).value=target.dataset.startValue;
  updateStartDescription();
});
newGameForm.addEventListener('submit',event=>{
  event.preventDefault();
  return launchConfiguredCampaign(event.target);
});
async function launchCampaign(options,leader){
  if(launchingCampaign)return;
  const britain=options.scenario?.id==='uk-2000';
  if(britain){
    const [characterSeed]=crypto.getRandomValues(new Uint32Array(1));
    options={...options,characterPlayer:{...leader,...leader?.appearance},politicalOptions:{...options.politicalOptions,characterSeed,guidedOpening:1,openingPollRevision:1}};
  }
  let candidate;
  try{
    candidate=createSimulation(gameOptions(options));
    enableTerritorialGovernment(candidate);enableBritishScenario(candidate);
  }catch(e){toast(e.message);return;}
  launchingCampaign=true;
  await autosave.flush();
  state=candidate;
  campaignId=crypto.randomUUID();
  resetCampaignAutosave('Партия ещё не сохранена');
  clearMapNotice();
  campaignLeader=leader;
  pendingLeader=null;
  deskCameras={};atlasWorld=false;atlasForeign=atlasCity=atlasRegion=atlasDossier=null;atlasStatsExpanded=false;strategyPanelOpen=false;atlasZoom=1;atlasPanX=0;atlasPanY=0;mapTerritory='GBR';mapExpanded=true;resetSectionNavigation();electionOpenId=null;territorialRequestId=null;openedWorldDecision=null;worldNewsOpen=false;selectedPaper=selectedIssue=null;pressState={};campaignOpen=false;campaignFeedback=null;announcedCampaign=null;proposalOpen=false;trendMetric=null;resultBillId=null;resultExecutive=null;announcedProposal=null;
  draft=state.politics.enabled?plannedPolicy(state):copy(state.policy);comparison=null;comparisonBase=null;view=parliamentary(state)?'government':state.politics.enabled?'policy':'country';
  const hadCheckpoint=Boolean(checkpoint);
  checkpoint=checkpointPress=null;mobileOpen=false;
  if(hadCheckpoint)try{await storage.set(CHECKPOINT,'');}catch(e){toast('Не удалось очистить прежнюю точку сравнения на устройстве.');}
  usage.close('window:new');snapshotDecisions();openCategory=parliamentary(state)?'political':state.politics.enabled?'decisions':'statistics';
  if(!guideComplete&&await readDevicePreference(GUIDE_COMPLETE)==='1')guideComplete=true;
  if(britain&&!guideComplete)setGuide('government');
  launchingCampaign=false;
  usage.flush();document.getElementById('new-dialog').close();mainMenu.markReady();render();
}
document.querySelector('.dialog-close').addEventListener('click',()=>{usage.close('window:new');usage.flush();document.getElementById('new-dialog').close();bindUsage();});
document.getElementById('new-dialog').addEventListener('close',()=>{pendingLeader=null;usage.close('window:new');bindUsage();});
document.getElementById('new-dialog').addEventListener('cancel',()=>{usage.close('window:new');usage.flush();bindUsage();});
async function loadCampaign(payload,fromFile=false){
  const loaded=importSimulationData(payload);
  const loadedDraft=sanitizePolicy(payload.draftPolicy??loaded.policy);
  await autosave.flush();
  clearMapNotice();
  state=loaded;
  campaignId=fromFile?crypto.randomUUID():payload.campaignId??crypto.randomUUID();
  resetCampaignAutosave(fromFile?'Партия ещё не сохранена':'Сохранено · '+date(state.month,true));
  checkpoint=checkpointPress=null;
  campaignLeader=savedCampaignLeader(payload.leader);
  deskCameras={};
  atlasWorld=false;
  atlasForeign=atlasCity=atlasRegion=atlasDossier=null;
  atlasStatsExpanded=strategyPanelOpen=settingsOpen=false;
  resetSectionNavigation();
  electionOpenId=null;
  worldNewsOpen=false;
  selectedPaper=selectedIssue=null;
  territorialRequestId=openedWorldDecision=null;
  pressState=payload.newspaper?.version===1?payload.newspaper:{};
  if(!fromFile&&pressState.openingGuide==='done'&&!guideComplete)await completeGuide();
  campaignOpen=false;
  campaignFeedback=announcedCampaign=null;
  proposalOpen=false;
  trendMetric=resultBillId=resultExecutive=announcedProposal=null;
  enableInstantPolitics(state);
  enableElectionExperience(state);
  enableAccountability(state);
  enableStablePreferences(state);
  enableFactionControl(state);
  enablePoliticalDynamics(state);
  enableOppositionCompetition(state);
  enablePartyPrograms(state);
  enableLocalGovernment(state);
  enableTerritorialGovernment(state);
  enablePresidentialDecisions(state);
  enableDefense(state);
  enableBritishScenario(state);
  enableBriefingOffices();
  if(state.politics.enabled&&state.politics.executive.inOffice){
    if(state.politics.historicalWorldStart===undefined)executePolitical(state,{kind:'enableHistoricalWorld'});
    if(state.politics.agendaSlots!==1)executePolitical(state,{kind:'setAgendaSlots',slots:1});
    if(state.politics.decisionLimit!==3)executePolitical(state,{kind:'setDecisionLimit',limit:3});
    if(!state.politics.dashboardMode)executePolitical(state,{kind:'setDashboardMode'});
    if(!state.politics.partyContinuity)executePolitical(state,{kind:'setPartyContinuity'});
  }
  draft=state.politics.enabled&&!payload.draftPolicy?plannedPolicy(state):loadedDraft;
  comparison=comparisonBase=null;
  view=state.politics.enabled?'policy':'country';
  openCategory=state.politics.enabled?'decisions':'statistics';
  snapshotDecisions();
  usage.flush();
  mainMenu.markReady();
  render();
  toast('Игра загружена.');
}
document.getElementById('import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{await loadCampaign(await readSaveFile(file),true);}
  catch(e){toast('Не удалось открыть сохранение: '+e.message);}
  event.target.value='';
});
app.addEventListener('toggle',event=>{const el=event.target;if(el.tagName!=='DETAILS')return;const label=el.querySelector('summary')?.textContent?.trim();if(label){const id='detail:'+String(view)+':'+label.slice(0,100);if(el.open)usage.open(id,label,'detail');else usage.close(id);usage.flush();}},true);
globalThis.addEventListener?.('pagehide',()=>{usage.closeAll();usage.flush();void autosave.flush();});
globalThis.addEventListener?.('beforeunload',event=>{if(autosave.hasWork()){event.preventDefault();event.returnValue='';}});
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='hidden')void autosave.flush();usage.visibility(document.visibilityState!=='hidden');if(document.visibilityState!=='hidden'){trackedView=null;trackedWindows=new Set();bindUsage();}usage.flush();});
render();

document.addEventListener?.('keydown',event=>{if(event.key==='Escape'&&(strategyPanelOpen||atlasDossier||atlasCity||atlasForeign||atlasRegion)&&!document.querySelector?.('dialog[open]')){if(atlasCity||atlasForeign||atlasRegion){closeAtlasDossier();return;}const opener=strategyPanelOpen&&openCategory==='decisions'?'.atlas-decisions-toggle':'[data-atlas-dossier]';atlasDossier=null;strategyPanelOpen=false;render();app.querySelector(opener)?.focus();}});

const saveMenu=mountSaveMenu({
  saves,esc,translate:translateText,
  onSave:async name=>{
    const savedDate=date(state.month,true);
    await saves.save(name,savedDate,captureCampaign());
    updateSaveStatus('Сохранено · '+savedDate);
    settingsOpen=false;
    render();
    toast('Игра сохранена.');
  },
  onLoad:loadCampaign,
  onExport:exportCampaign,
  onImport:()=>document.getElementById('import-file').click()
});
const mainMenu=mountMainMenu({hasSave:hasExistingSave,onContinue:()=>render(),onLoadSaves:resume=>saveMenu.open({mode:'load',resume}),onLanguageChange:changeInterfaceLanguage,onNew:(country,leader,party)=>{
  if(country==='uk-2000'){
    const [nameSeed]=crypto.getRandomValues(new Uint32Array(1));
    return launchCampaign(scenarioOptions(country,{party,nameSeed}),leader);
  }
  pendingLeader=leader;
  startStep=0;
  updateStartDescription();
  usage.open('window:new','Новая игра','window');
  document.getElementById('new-dialog').showModal();
}});

document.addEventListener?.('keydown',e=>{if((!atlasDossier&&!atlasCity&&!atlasForeign&&!atlasRegion)||e.key!=='Tab')return;const items=[...app.querySelectorAll('.atlas-dossier button, .atlas-dossier summary')].filter(button=>button.getClientRects().length>0);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});

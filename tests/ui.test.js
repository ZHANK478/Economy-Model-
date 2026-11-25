// Template and delegated-handler checks; not real-browser layout verification.
import test from 'node:test';
import assert from 'node:assert/strict';
class Element {
 constructor(){this.innerHTML='';this.textContent='';this.listeners={};this.value='';this.dataset={};this.disabled=false;this.classList={add(){},remove(){},contains(){return false;}};}
 hasAttribute(name){
  if(!name.startsWith('data-'))return false;
  const key=name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
  return Object.hasOwn(this.dataset,key);
 }
 addEventListener(name,fn){this.listeners[name]=fn;}querySelector(){return new Element();}querySelectorAll(){return [];}setAttribute(){}focus(){}showModal(){}close(){}click(){}remove(){}
}
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},saved=new Map();
const legacy=JSON.stringify({simulation:JSON.stringify({version:'3.0.0',state:{month:101}}),draft:{}});saved.set('economy-model-v3',legacy);
globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
globalThis.document={getElementById:node,querySelector:s=>node(s),activeElement:null,body:{append(){},classList:{add(){},remove(){},contains(){return false;}}},querySelectorAll:()=>[],createElement:()=>new Element()};
let lastBlob;URL.createObjectURL=b=>{lastBlob=b;return 'blob:test';};URL.revokeObjectURL=()=>{};
test('decision navigation, result modals and separate interface exports preserve game behavior',async(t)=>{
 t.mock.method(Math,'random',()=>7/4294967296);
 const ui=await import('../src/app.js');const app=node('app');
 const click=async data=>{
  const target=new Element();target.dataset=data;
  await app.listeners.click({target:{closest:()=>target},preventDefault(){}});
  await ui.flushAutosave();
 };
 const game=async()=>{await click({action:'export'});return JSON.parse(await lastBlob.text()).state;};
 assert.ok(app.innerHTML.includes('data-action="settings-open"'));assert.ok(!app.innerHTML.includes('data-action="export"'));assert.ok(!app.innerHTML.includes('brandmark'));assert.ok(!app.innerHTML.includes('Сохранения и выгрузка'));
 assert.ok(!app.innerHTML.includes('При отказе:'));assert.ok(!app.innerHTML.includes('Решение расходует'));assert.ok(!app.innerHTML.includes('одна попытка для партии'));
 await click({action:'settings-open'});
 assert.ok(app.innerHTML.includes('id="settings-dialog"'));
 assert.match(app.innerHTML, /<h2 id="settings-heading">Меню игры<\/h2>/);
 assert.deepEqual([...app.innerHTML.match(/<dialog id="settings-dialog"[\s\S]*?<\/dialog>/)[0].matchAll(/data-action="([^"]+)"/g)].map(match=>match[1]),['settings-close','settings-close','save-game','load-game','main-menu']);
 await click({action:'settings-close'});assert.ok(!app.innerHTML.includes('id="settings-dialog"'));await click({action:'proposal-open'});
 assert.ok(!app.innerHTML.includes('Рабочий стол'));assert.ok(!app.innerHTML.includes('Изменить статью и голосовать снова'));
 assert.ok(!app.innerHTML.includes('class="screen-content"'));
 await click({category:'decisions'});
 assert.ok(app.innerHTML.includes('class="decision-index"'));assert.ok(!app.innerHTML.includes('category-tabs'));
 assert.ok(app.innerHTML.includes('ВВП на душу'));assert.ok(app.innerHTML.includes('Безработица'));assert.ok(app.innerHTML.includes('data-change="gdpPerCapitaRolling"'));assert.ok(!app.innerHTML.includes('Партии и коалиция'));assert.ok(!app.innerHTML.includes('Власть и полномочия'));assert.ok(app.innerHTML.includes('Рейтинг президента'));assert.ok(app.innerHTML.includes('январь 2000'));
 assert.ok(app.innerHTML.includes('id="proposal-dialog"'));const id=app.innerHTML.match(/data-bill-card="(\d+)"/)[1];
 await click({action:'proposal-close'});await click({category:'statistics'});
 assert.ok(app.innerHTML.includes('country-grid'));for(const category of ['statistics','political','army','notes','codex'])assert.ok(app.innerHTML.includes(`data-category="${category}"`));assert.ok(!app.innerHTML.includes('ВВП · номинальный'));assert.ok(!app.innerHTML.includes('ВВП по условному ППС'));assert.equal((app.innerHTML.match(/class="kpi country-stat"/g)??[]).length,9);
 await click({category:'statistics'});assert.ok(!app.innerHTML.includes('country-grid'));await click({category:'statistics'});
 await click({view:'country'});await click({action:'step'});assert.ok(app.innerHTML.includes('январь 2000'));assert.ok(app.innerHTML.includes('Возрастная пирамида'));assert.ok(app.innerHTML.includes('id="proposal-dialog"'));
 await click({politicalAction:'adopt',billId:id});assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(!app.innerHTML.includes('id="proposal-dialog"'));
 assert.ok(app.innerHTML.includes('Принято'));assert.ok(app.innerHTML.includes('ballot-counts'));assert.ok(!app.innerHTML.includes('Воздержались:'));assert.ok(!app.innerHTML.includes('Станет:'));const beforeEnter=(await game());app.listeners.keydown({key:'Enter',repeat:true,target:{dataset:{}},preventDefault(){}});await ui.flushAutosave();assert.ok(app.innerHTML.includes('id="result-dialog"'));app.listeners.keydown({key:'Enter',target:{dataset:{}},preventDefault(){}});assert.equal((await game()).month,beforeEnter.month);assert.equal((await game()).politics.turnCommands.length,beforeEnter.politics.turnCommands.length);assert.ok(!app.innerHTML.includes('id="result-dialog"'));assert.ok(!app.innerHTML.includes('data-bill-card='));
 await click({view:'policy'});await click({policyTab:'Структура'});assert.ok(app.innerHTML.includes('type="range"'));assert.ok(app.innerHTML.includes('data-policy-number='));assert.ok(app.innerHTML.includes('policy-value-entry'));assert.ok(!app.innerHTML.includes('class="control-meta"'));assert.ok(!app.innerHTML.includes('class="number-entry"'));
 assert.ok(!app.innerHTML.includes('data-policy-check="openProcurement"'));await click({policyTab:'Бюджет'});assert.ok(app.innerHTML.includes('data-policy-check="openProcurement"'));
 app.listeners.change({target:{dataset:{policyCheck:'openProcurement'},checked:true,hasAttribute:()=>false}});await ui.flushAutosave();
 assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(app.innerHTML.includes('За:'));assert.ok(!app.innerHTML.includes('ballot-threshold'));assert.equal((await game()).month,0);
 await click({action:'result-close'});assert.ok(!app.innerHTML.includes('decision-feedback'));assert.ok(!app.innerHTML.includes('За:'));
 app.listeners.keydown({key:'Enter',target:{dataset:{policyNumber:'incomeTax'},value:'16'},preventDefault(){}});await ui.flushAutosave();
 assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok((await game()).politics.bills.some(b=>b.patch.incomeTax===16));await click({action:'result-close'});
 const count=(await game()).politics.bills.length;assert.ok(app.innerHTML.includes('3 / 3'));
 app.listeners.change({target:{dataset:{policyChoice:'monetaryRegime'},value:'dollarized'}});await ui.flushAutosave();assert.equal((await game()).politics.bills.length,count);
 await click({action:'step'});assert.equal((await game()).month,1);assert.equal((await game()).journal.length,1);assert.ok(app.innerHTML.includes('за месяц'));assert.ok(app.innerHTML.includes('data-change="unemployment"'));
 const views=['army','government','policy','country','ownership','infrastructure','elections','government','constitution','electorate'];
 for(const view of views){if(app.innerHTML.includes(`data-view="${view}" class="active"`))await click({view});await click({view});assert.ok(app.innerHTML.includes('Баланс бюджета за месяц'));assert.ok(app.innerHTML.includes('Следующий месяц'));assert.ok(!app.innerHTML.includes('NaN'));assert.ok(!app.innerHTML.includes('undefined'));}
 app.listeners.change({target:{dataset:{policyCheck:'protectedJudges'},checked:false,hasAttribute:()=>false}});await ui.flushAutosave();assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(app.innerHTML.includes('Отклонено'));assert.match(app.innerHTML,/Требуется минимум 80 голосов из 120 \(≈66,67%\)\./);assert.ok(!app.innerHTML.includes('Не все статьи'));assert.ok(!app.innerHTML.includes('Воздержались:'));assert.ok(!app.innerHTML.includes('decision-changes'));await click({action:'result-close'});
 await click({view:'infrastructure'});assert.ok(app.innerHTML.includes('data-policy-number="publicInvestment"'));
 await click({networkAsset:'roads'});assert.ok(app.innerHTML.includes('Передать муниципалитету'));
 node('network-id').value='roads';node('network-kind').value='networkSale';node('network-points').value='10';await click({action:'network-queue'});assert.ok(app.innerHTML.includes('id="result-dialog"'));await click({action:'result-close'});
 await click({graph:'budgetBalance'});assert.ok(app.innerHTML.includes('id="trend-dialog"'));await click({action:'trend-close'});
 await click({view:'government'});assert.ok(!app.innerHTML.includes('Ваша партия: программа'));assert.ok(!app.innerHTML.includes('Партийные семьи и история'));assert.ok(app.innerHTML.includes('<h2>Парламент</h2>'));assert.ok(!app.innerHTML.includes('Коалици'));assert.ok(!app.innerHTML.includes('coalitionOffer'));assert.ok(app.innerHTML.includes('parliament-chart'));assert.ok(!app.innerHTML.includes('seat-strip'));
 await click({view:'country'});await click({action:'consumption-toggle'});assert.ok(app.innerHTML.includes('data-income-group="4"'));await click({incomeGroup:'4'});await new Promise(r=>setTimeout(r,190));assert.ok(node('consumption-stage').innerHTML.includes('Высокие доходы'));await click({action:'consumption-toggle'});assert.ok(app.innerHTML.includes('Экономика и финансы'));assert.ok(!app.innerHTML.includes('Долговая нагрузка'));assert.ok(!app.innerHTML.includes('Передача ставки'));
 await click({action:'usage-export'});const report=JSON.parse(await lastBlob.text());assert.equal(report.format,'economy-ui-observation');assert.ok(report.summary.targets.some(x=>x.id==='view:country'&&x.opens>0));assert.ok(report.events.some(x=>x.target==='window:result'));assert.ok(report.summary.neverOpened.some(x=>x.id==='graph:giniDisposable'));
 await click({action:'export'});const payload=JSON.parse(await lastBlob.text());assert.ok(payload.uiObservation);assert.deepEqual(payload.monthlyStatistics,payload.state.history);assert.equal(payload.state.journal.length,1);assert.ok(payload.previousSave);assert.ok(!payload.state.uiObservation);assert.equal(payload.state.month,1);
 await click({action:'journal-export'});const journal=JSON.parse(await lastBlob.text());assert.equal(journal.format,'economy-decisions');assert.equal(journal.journal.length,1);
 await click({action:'checkpoint'});assert.ok(saved.has('economy-checkpoint-v5'));await click({action:'step'});await click({action:'restore'});assert.equal((await game()).month,1);assert.ok(!app.innerHTML.includes('id="result-dialog"'));
 for(const hidden of ['journal','compare','validation','method','labor','politics','institutions','overview','economy','fiscal','credit','external','households','services','security']){const before=app.innerHTML;await click({view:hidden});assert.equal(app.innerHTML,before);}
 const NativeFormData=globalThis.FormData;
 try{
  globalThis.FormData=class {constructor(target){this.target=target;}get(key){return this.target[key]??null;}};
  node('new-government').value='parliamentary';node('new-government').listeners.change();assert.ok(node('new-government-description').textContent.includes('кабинет'));
  node('new-country').value='rich';node('new-country').listeners.change();assert.ok(node('new-country-description').textContent.includes('25'));
  await node('new-form').listeners.submit({preventDefault(){},target:{government:'parliamentary',country:'rich',party:'socialist',resource:'false'}});await ui.flushAutosave();
  assert.equal((await game()).metrics.gdpPerCapitaReal,25000);assert.equal((await game()).politics.constitution.playerRole,'primeMinister');assert.equal((await game()).demography.fertility,1.89);assert.equal((await game()).resourceMode,false);assert.equal((await game()).month,0);assert.ok(!app.innerHTML.includes('Рейтинг президента'));await click({category:'political'});assert.ok(app.innerHTML.includes('parliament-game'));assert.ok(app.innerHTML.includes('Опора кабинета'));
  await node('new-form').listeners.submit({preventDefault(){},target:{government:'presidential',country:'middle',party:'liberal',resource:'true'}});await ui.flushAutosave();
  const vetoId=app.innerHTML.match(/data-bill-card="(\d+)"/)[1],beforeUsed=(await game()).politics.bills.find(b=>b.id===Number(vetoId));
  assert.ok(beforeUsed);await click({politicalAction:'reject',billId:vetoId});
  const vetoed=(await game()).politics.bills.find(b=>b.id===Number(vetoId));
  if(vetoed.vetoOverridden){assert.ok(vetoed.overrideVote.passed);assert.ok(vetoed.overrideVote.yes>=vetoed.overrideVote.required);assert.ok(app.innerHTML.includes('Вето преодолено'));await click({action:'result-close'});}else{assert.ok(!app.innerHTML.includes('id="result-dialog"'));assert.ok(['vetoed','declined'].includes(vetoed.status));}
  assert.ok(!app.innerHTML.includes('id="proposal-dialog"'));assert.ok(app.innerHTML.includes('1 / 3'));
  await click({view:'constitution'});assert.ok(!app.innerHTML.includes('Голосовать за свободные институты'));assert.ok(!app.innerHTML.includes('Голосовать за ограничения'));assert.ok(!app.innerHTML.includes('Эти оценки вычисляются'));
  // A return to Decisions must show every topic, regardless of the previous drill-down.
  await click({category:'decisions'});await click({policyTab:'Кредит'});
  assert.ok(!app.innerHTML.includes('data-policy-tab="Налоги"'));
  await click({category:'statistics'});await click({category:'decisions'});
  for(const label of ['Кредит','Налоги','Бюджет','Валюта'])assert.ok(app.innerHTML.includes(`data-policy-tab="${label}"`));
  assert.ok(!app.innerHTML.includes('data-policy-tab="Структура"'));
  await click({decisionCollection:'economy'});
  assert.ok(app.innerHTML.includes('data-policy-tab="Структура"'));
  assert.ok(app.innerHTML.includes('data-view="infrastructure"'));
  assert.ok(!app.innerHTML.includes('data-policy-tab="Бюджет"'));
  await click({policyTab:'Кредит'});await click({category:'decisions'});await click({category:'decisions'});
  assert.ok(app.innerHTML.includes('data-policy-tab="Налоги"'));
  await click({policyTab:'СМИ'});assert.ok(app.innerHTML.includes('data-policy-check="freeMedia"'));
  await click({view:'policy',openView:'true'});
  assert.ok(app.innerHTML.includes('data-policy-tab="СМИ"'));
  assert.ok(app.innerHTML.includes('Статистика'));assert.ok(app.innerHTML.includes('data-category="army"'));
  await click({category:'army'});assert.ok(app.innerHTML.includes('Военный бюджет'));await click({action:'army-budget'});
  assert.ok(app.innerHTML.includes('data-policy-number="militaryBudget"'));
  await click({category:'political'});assert.ok(app.innerHTML.includes('government-summary'));assert.ok(!app.innerHTML.includes('charter-grid'));
  await click({category:'notes'});await click({charterSection:'terms'});
  await click({category:'statistics'});await click({category:'notes'});
  assert.ok(!app.innerHTML.includes('charter-editor'));assert.ok(app.innerHTML.includes('charter-grid'));
  // Only the chosen article goes to the existing constitutional vote.
  assert.ok(app.innerHTML.includes('charter-grid'));assert.ok(!app.innerHTML.includes('<table'));
  await click({charterSection:'terms'});await click({charterStep:'parliamentTerm',direction:'1'});
  const usedBeforeCharter=(await game()).politics.turnCommands.length;
  await click({action:'charter-vote'});
  assert.equal((await game()).politics.turnCommands.length,usedBeforeCharter+1);
  assert.deepEqual((await game()).politics.turnCommands.at(-1).constitutionPatch,{parliamentTerm:60});
  assert.ok(app.innerHTML.includes('id="result-dialog"'));await click({action:'result-close'});
  await click({charterSection:'powers'});await click({charterKey:'independentCB',charterValue:'false'});
  await click({view:'government'});await click({view:'constitution'});
  assert.ok(app.innerHTML.includes('charter-grid'));assert.ok(!app.innerHTML.includes('charter-editor'));
  await node('new-form').listeners.submit({preventDefault(){},target:{government:'personalist',country:'poor',party:'conservative',resource:'true'}});await ui.flushAutosave();
  assert.equal((await game()).metrics.gdpPerCapitaReal,500);assert.equal((await game()).politics.constitution.regime,'personalist');assert.equal((await game()).demography.fertility,3.279);
 }finally{globalThis.FormData=NativeFormData;}
 const {createSimulation,exportSimulation}=await import('../src/engine.js');
 const campaignSave=createSimulation({politicalMode:true,politicalOptions:{constitution:{parliamentOffset:12},decisionLimit:3,dashboardMode:true,partyContinuity:true}});
 node('import-file').files=[new Blob([exportSimulation(campaignSave)])];
 await node('import-file').listeners.change({target:node('import-file')});await click({action:'proposal-close'});
 assert.ok(app.innerHTML.includes('id="campaign-dialog"'));assert.ok(!app.innerHTML.includes('Одобрение власти'));assert.ok(app.innerHTML.includes('Парламентский рейтинг'));
 const eventId=app.innerHTML.match(/data-event-id="([^"]+)"/)[1];
 await click({campaignChoice:'0',eventId});assert.equal((await game()).politics.campaignResponses.length,1);assert.ok(app.innerHTML.includes('Ответ опубликован'));
 await click({action:'campaign-close'});assert.ok(!app.innerHTML.includes('id="campaign-dialog"'));
 await click({view:'country'});assert.ok(!app.innerHTML.includes('Матрица межотраслевых затрат'));assert.ok(!app.innerHTML.includes('Открыть формулы модели'));
 await click({view:'country'});assert.ok(!app.innerHTML.includes('data-world='));assert.ok(!app.innerHTML.includes('data-shock='));assert.ok(!app.innerHTML.includes('data-stochastic'));assert.ok(!app.innerHTML.includes('УСЛОВИЯ ЭКСПЕРИМЕНТА'));
 await click({view:'country'});assert.ok(app.innerHTML.includes('population-pyramid'));assert.ok(!app.innerHTML.includes('Десять групп домохозяйств'));
 await click({view:'country'});assert.ok(app.innerHTML.includes('Структура производства'));assert.ok(app.innerHTML.includes('production-pie'));assert.ok(!app.innerHTML.includes('Будущий выпуск'));
 const {scenarioOptions}=await import('../src/country-scenarios.js');
 const {advanceMonth}=await import('../src/engine.js');
 const options=scenarioOptions();
 let beforeNews=createSimulation({...options,politicalOptions:{...options.politicalOptions,historicalWorld:1}});
 beforeNews=advanceMonth(beforeNews,beforeNews.policy);
 node('import-file').files=[new Blob([exportSimulation(beforeNews)])];await node('import-file').listeners.change({target:node('import-file')});
 const pendingId=app.innerHTML.match(/data-bill-card="(\d+)"/)?.[1];if(pendingId)await click({politicalAction:'reject',billId:pendingId});
 await click({action:'result-close'});await click({action:'proposal-close'});await click({action:'step'});
 assert.equal((await game()).month,2);
 assert.ok(app.innerHTML.includes('id="historical-news-dialog"'));
 assert.ok(app.innerHTML.includes('Лопнул пузырь доткомов'));
 await click({action:'historical-news-close',historicalId:'history:dotcom'});
 assert.ok(!app.innerHTML.includes('id="historical-news-dialog"'));
 await click({strategyNews:'true',pressHeadline:'press-dispatch',headlineIssue:'history:dotcom'});
 assert.ok(app.innerHTML.includes('id="world-news-dialog"'));
 assert.ok(app.innerHTML.includes('Лопнул пузырь доткомов'));
 await click({action:'world-news-close'});
 assert.ok(!app.innerHTML.includes('id="world-news-dialog"'));
 const {executePolitical}=await import('../src/engine.js');
 let iraq=createSimulation({...options,startYear:2003,politicalOptions:{...options.politicalOptions,historicalWorld:1}});
 executePolitical(iraq,{kind:'negotiateCoalition',partyId:'p11',mode:'accept'});
 executePolitical(iraq,{kind:'formCabinet'});
 iraq=advanceMonth(advanceMonth(iraq));
 node('import-file').files=[new Blob([exportSimulation(iraq)])];
 await node('import-file').listeners.change({target:node('import-file')});
 assert.ok(app.innerHTML.includes('id="world-decision-dialog"'));
 assert.ok(app.innerHTML.includes('Вынести участие на голосование'));
 await click({worldDecision:'iraq',worldAnswer:'join',worldBallot:'accept'});
 assert.ok(app.innerHTML.includes('Британия вступает в коалицию'));
 assert.ok(app.innerHTML.includes('Голосование: за'));
 assert.equal((await game()).politics.worldDecisions.iraq.vote.passed,true);
 await click({worldDecisionClose:'decision:iraq'});

 const autoKeys=()=>[...saved.keys()].filter(key=>key.startsWith('whips-campaign-auto:'));
 const readAuto=key=>JSON.parse(saved.get(key)).snapshot.month;
 const playTo=async month=>{
   for(let tries=0;tries<30;tries++){
     const current=(await game()).month;
     if(current===month)return;
     const initiative=app.innerHTML.match(/data-bill-card="(\d+)"/)?.[1];
     if(initiative)await click({politicalAction:'reject',billId:initiative});
     await click({action:'step'});
   }
   assert.fail('Could not advance the campaign to month '+month);
 };
 assert.equal(autoKeys().length,0);
 await playTo(5);
 assert.equal(autoKeys().length,0);
 await playTo(6);
 const [firstAuto]=autoKeys();
 assert.equal(readAuto(firstAuto),6);
 await playTo(12);
 assert.deepEqual(autoKeys(),[firstAuto]);
 assert.equal(readAuto(firstAuto),12);
 node('import-file').files=[new Blob([exportSimulation(beforeNews)])];
 await node('import-file').listeners.change({target:node('import-file')});
 assert.deepEqual(autoKeys(),[firstAuto]);
 await playTo(12);
 assert.equal(autoKeys().length,2);
 assert.equal(readAuto(firstAuto),12);
 assert.equal(saved.get('economy-model-v3'),legacy);
 node('main-menu').hidden=true;
 node('import-file').files=[new Blob([exportSimulation(createSimulation(options))])];
 await node('import-file').listeners.change({target:node('import-file')});
 assert.match(app.innerHTML,/id="election-headline-dialog"/);
 const openingId=app.innerHTML.match(/id="election-headline-dialog" data-election-id="(\d+)"/)[1];
 await click({action:'election-open',electionId:openingId});
 assert.match(app.innerHTML,/id="election-dialog"/);
 await click({action:'election-ack',electionId:openingId});
 assert.doesNotMatch(app.innerHTML,/id="election-headline-dialog"/);
 await click({strategyNews:'true',pressHeadline:'press-chronicle',headlineIssue:'election:parliament:0'});
 assert.match(app.innerHTML,/id="world-news-dialog"/);
 assert.match(app.innerHTML,/Полные результаты/);
});


test('asset settlement summaries report only the overall result',async()=>{
  const {assetTransferOutcome}=await import('../src/asset-views.js');
  assert.equal(assetTransferOutcome([{kind:'restructure',amount:3}]),null);
  assert.equal(assetTransferOutcome([{kind:'privatize',actualPoints:8}]).title,'Выполнено');
  assert.equal(assetTransferOutcome([{kind:'nationalize',actualPoints:0,rejected:true}]).title,'Не выполнено');
  const mixed=assetTransferOutcome([{kind:'privatize',actualPoints:8},{network:'road',amount:0,cost:0}]);
  assert.deepEqual(mixed,{kind:'assetTransfer',success:true,title:'Выполнено частично'});
});

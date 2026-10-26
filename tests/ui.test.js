// Template and delegated-handler checks; not real-browser layout verification.
import test from 'node:test';
import assert from 'node:assert/strict';
class Element {
 constructor(){this.innerHTML='';this.textContent='';this.listeners={};this.value='';this.dataset={};this.disabled=false;this.classList={add(){},remove(){}};}
 addEventListener(name,fn){this.listeners[name]=fn;}querySelector(){return new Element();}showModal(){}close(){}click(){}remove(){}
}
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},saved=new Map();
const legacy=JSON.stringify({simulation:JSON.stringify({version:'3.0.0',state:{month:101}}),draft:{}});saved.set('economy-model-v3',legacy);
globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
globalThis.document={getElementById:node,querySelector:s=>node(s),activeElement:null,body:{append(){}},createElement:()=>new Element()};
let lastBlob;URL.createObjectURL=b=>{lastBlob=b;return 'blob:test';};URL.revokeObjectURL=()=>{};
test('vertical disclosure, result modals and separate interface exports preserve game behavior',async()=>{
 await import('../src/app.js');const app=node('app');
 const click=async data=>app.listeners.click({target:{closest:()=>({dataset:data})},preventDefault(){}});
 const game=()=>JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state;
 assert.ok(app.innerHTML.includes('data-action="settings-open"'));assert.ok(!app.innerHTML.includes('data-action="export"'));assert.ok(!app.innerHTML.includes('brandmark'));assert.ok(!app.innerHTML.includes('Сохранения и выгрузка'));
 assert.ok(!app.innerHTML.includes('При отказе:'));assert.ok(!app.innerHTML.includes('Решение расходует'));assert.ok(!app.innerHTML.includes('одна попытка для партии'));
 await click({action:'settings-open'});assert.ok(app.innerHTML.includes('id="settings-dialog"'));assert.ok(app.innerHTML.includes('Скачать JSON'));assert.ok(!app.innerHTML.includes('всё в одном файле'));assert.equal((app.innerHTML.match(/data-action="export"/g)??[]).length,1);assert.ok(!app.innerHTML.includes('data-action="usage-export"'));assert.ok(!app.innerHTML.includes('data-action="csv"'));assert.ok(!app.innerHTML.includes('data-action="journal-export"'));await click({action:'settings-close'});assert.ok(!app.innerHTML.includes('id="settings-dialog"'));await click({action:'proposal-open'});
 assert.ok(!app.innerHTML.includes('Рабочий стол'));assert.ok(!app.innerHTML.includes('Изменить статью и голосовать снова'));
 assert.ok(app.innerHTML.includes('vertical-navigation'));assert.ok(!app.innerHTML.includes('category-tabs'));
 assert.ok(app.innerHTML.includes('ВВП на душу'));assert.ok(app.innerHTML.includes('Безработица'));assert.ok(app.innerHTML.includes('data-change="gdpPerCapitaRolling"'));assert.ok(!app.innerHTML.includes('Партии и коалиция'));assert.ok(!app.innerHTML.includes('Власть и полномочия'));assert.ok(app.innerHTML.includes('Рейтинг президента'));assert.ok(app.innerHTML.includes('январь 2000'));
 assert.ok(app.innerHTML.includes('id="proposal-dialog"'));const id=app.innerHTML.match(/data-bill-card="(\d+)"/)[1];
 await click({action:'proposal-close'});await click({category:'statistics'});
 assert.ok(app.innerHTML.includes('country-grid'));assert.equal((app.innerHTML.match(/data-category=/g)??[]).length,3);assert.ok(!app.innerHTML.includes('ВВП · номинальный'));assert.ok(!app.innerHTML.includes('ВВП по условному ППС'));assert.equal((app.innerHTML.match(/class="kpi country-stat"/g)??[]).length,9);
 await click({category:'statistics'});assert.ok(!app.innerHTML.includes('country-grid'));await click({category:'statistics'});
 await click({view:'country'});await click({action:'step'});assert.ok(app.innerHTML.includes('январь 2000'));assert.ok(app.innerHTML.includes('Возрастная пирамида'));assert.ok(app.innerHTML.includes('id="proposal-dialog"'));
 await click({politicalAction:'adopt',billId:id});assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(!app.innerHTML.includes('id="proposal-dialog"'));
 assert.ok(app.innerHTML.includes('Принято'));assert.ok(app.innerHTML.includes('ballot-counts'));assert.ok(!app.innerHTML.includes('Воздержались:'));assert.ok(!app.innerHTML.includes('Станет:'));await click({action:'result-close'});assert.ok(!app.innerHTML.includes('id="result-dialog"'));assert.ok(!app.innerHTML.includes('data-bill-card='));
 await click({view:'policy'});await click({policyTab:'Структура'});assert.ok(app.innerHTML.includes('type="range"'));assert.ok(app.innerHTML.includes('data-policy-number='));
 app.listeners.change({target:{dataset:{policyCheck:'openProcurement'},checked:true,hasAttribute:()=>false}});
 assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(app.innerHTML.includes('За:'));assert.equal(game().month,0);
 await click({action:'result-close'});assert.ok(!app.innerHTML.includes('decision-feedback'));assert.ok(!app.innerHTML.includes('За:'));
 app.listeners.keydown({key:'Enter',target:{dataset:{policyNumber:'incomeTax'},value:'16'},preventDefault(){}});
 assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(game().politics.bills.some(b=>b.patch.incomeTax===16));await click({action:'result-close'});
 const count=game().politics.bills.length;assert.ok(app.innerHTML.includes('3 / 3'));
 app.listeners.change({target:{dataset:{policyChoice:'monetaryRegime'},value:'dollarized'}});assert.equal(game().politics.bills.length,count);
 await click({action:'step'});assert.equal(game().month,1);assert.equal(game().journal.length,1);assert.ok(app.innerHTML.includes('за месяц'));assert.ok(app.innerHTML.includes('data-change="unemployment"'));
 const views=['government','policy','country','ownership','infrastructure','elections','government','constitution','electorate'];
 for(const view of views){if(app.innerHTML.includes(`data-view="${view}" class="active"`))await click({view});await click({view});assert.ok(app.innerHTML.includes('Баланс бюджета за месяц'));assert.ok(app.innerHTML.includes('Следующий месяц'));assert.ok(!app.innerHTML.includes('NaN'));assert.ok(!app.innerHTML.includes('undefined'));}
 app.listeners.change({target:{dataset:{policyCheck:'protectedJudges'},checked:false,hasAttribute:()=>false}});assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(app.innerHTML.includes('Отклонено'));assert.ok(!app.innerHTML.includes('Не все статьи'));assert.ok(!app.innerHTML.includes('Воздержались:'));assert.ok(!app.innerHTML.includes('decision-changes'));await click({action:'result-close'});
 await click({view:'infrastructure'});node('network-id').value='roads';node('network-kind').value='networkSale';node('network-points').value='10';await click({action:'network-queue'});assert.ok(app.innerHTML.includes('id="result-dialog"'));await click({action:'result-close'});
 await click({graph:'budgetBalance'});assert.ok(app.innerHTML.includes('id="trend-dialog"'));await click({action:'trend-close'});
 await click({view:'government'});assert.ok(!app.innerHTML.includes('Ваша партия: программа'));assert.ok(!app.innerHTML.includes('Партийные семьи и история'));assert.ok(app.innerHTML.includes('<h2>Парламент</h2>'));assert.ok(!app.innerHTML.includes('Коалици'));assert.ok(!app.innerHTML.includes('coalitionOffer'));assert.ok(app.innerHTML.includes('parliament-chart'));assert.ok(!app.innerHTML.includes('seat-strip'));
 await click({view:'country'});assert.ok(app.innerHTML.includes('Экономика и финансы'));assert.ok(!app.innerHTML.includes('Долговая нагрузка'));assert.ok(!app.innerHTML.includes('Передача ставки'));
 await click({action:'usage-export'});const report=JSON.parse(await lastBlob.text());assert.equal(report.format,'economy-ui-observation');assert.ok(report.summary.targets.some(x=>x.id==='view:country'&&x.opens>0));assert.ok(report.events.some(x=>x.target==='window:result'));assert.ok(report.summary.neverOpened.some(x=>x.id==='graph:giniDisposable'));
 await click({action:'export'});const payload=JSON.parse(await lastBlob.text());assert.ok(payload.uiObservation);assert.deepEqual(payload.monthlyStatistics,payload.state.history);assert.equal(payload.state.journal.length,1);assert.ok(payload.previousSave);assert.ok(!payload.state.uiObservation);assert.equal(payload.state.month,1);
 await click({action:'journal-export'});const journal=JSON.parse(await lastBlob.text());assert.equal(journal.format,'economy-decisions');assert.equal(journal.journal.length,1);
 await click({action:'checkpoint'});assert.ok(saved.has('economy-checkpoint-v5'));await click({action:'step'});await click({action:'restore'});assert.equal(game().month,1);assert.ok(!app.innerHTML.includes('id="result-dialog"'));
 for(const hidden of ['journal','compare','validation','method','labor','politics','institutions','overview','economy','fiscal','credit','external','households','services','security']){const before=app.innerHTML;await click({view:hidden});assert.equal(app.innerHTML,before);}
 const NativeFormData=globalThis.FormData;
 try{
  globalThis.FormData=class {constructor(target){this.target=target;}get(key){return this.target[key]??null;}};
  node('new-government').value='parliamentary';node('new-government').listeners.change();assert.ok(node('new-government-description').textContent.includes('кабинет'));
  node('new-country').value='rich';node('new-country').listeners.change();assert.ok(node('new-country-description').textContent.includes('25'));
  await node('new-form').listeners.submit({preventDefault(){},target:{government:'parliamentary',country:'rich',party:'socialist',resource:'false'}});
  assert.equal(game().metrics.gdpPerCapitaReal,25000);assert.equal(game().politics.constitution.playerRole,'primeMinister');assert.equal(game().demography.fertility,1.89);assert.equal(game().resourceMode,false);assert.equal(game().month,0);
  await node('new-form').listeners.submit({preventDefault(){},target:{government:'presidential',country:'middle',party:'liberal',resource:'true'}});
  const vetoId=app.innerHTML.match(/data-bill-card="(\d+)"/)[1],beforeUsed=game().politics.bills.find(b=>b.id===Number(vetoId));
  assert.ok(beforeUsed);await click({politicalAction:'reject',billId:vetoId});
  assert.ok(!app.innerHTML.includes('id="result-dialog"'));assert.ok(!app.innerHTML.includes('id="proposal-dialog"'));
  assert.ok(['vetoed','declined'].includes(game().politics.bills.find(b=>b.id===Number(vetoId)).status));assert.ok(app.innerHTML.includes('1 / 3'));
  await click({view:'constitution'});assert.ok(!app.innerHTML.includes('Голосовать за свободные институты'));assert.ok(!app.innerHTML.includes('Голосовать за ограничения'));assert.ok(!app.innerHTML.includes('Эти оценки вычисляются'));
  // A return to Decisions must show every topic, regardless of the previous drill-down.
  await click({category:'decisions'});await click({policyTab:'Кредит'});
  assert.ok(!app.innerHTML.includes('data-policy-tab="Налоги"'));
  await click({category:'statistics'});await click({category:'decisions'});
  for(const label of ['Кредит','Налоги','Бюджет','Валюта','Структура'])assert.ok(app.innerHTML.includes(`data-policy-tab="${label}"`));
  await click({policyTab:'Кредит'});await click({category:'decisions'});await click({category:'decisions'});
  assert.ok(app.innerHTML.includes('data-policy-tab="Налоги"'));
  await click({policyTab:'Кредит'});await click({view:'policy'});await click({view:'policy'});
  assert.ok(app.innerHTML.includes('data-policy-tab="Бюджет"'));
  // Only the chosen article goes to the existing constitutional vote.
  await click({category:'political'});await click({view:'constitution'});
  assert.ok(app.innerHTML.includes('charter-grid'));assert.ok(!app.innerHTML.includes('<table'));
  await click({charterSection:'terms'});await click({charterStep:'parliamentTerm',direction:'1'});
  const usedBeforeCharter=game().politics.turnCommands.length;
  await click({action:'charter-vote'});
  assert.equal(game().politics.turnCommands.length,usedBeforeCharter+1);
  assert.deepEqual(game().politics.turnCommands.at(-1).constitutionPatch,{parliamentTerm:60});
  assert.ok(app.innerHTML.includes('id="result-dialog"'));await click({action:'result-close'});
  await click({charterSection:'powers'});await click({charterKey:'independentCB',charterValue:'false'});
  await click({view:'government'});await click({view:'constitution'});
  assert.ok(app.innerHTML.includes('charter-grid'));assert.ok(!app.innerHTML.includes('charter-editor'));
  await node('new-form').listeners.submit({preventDefault(){},target:{government:'personalist',country:'poor',party:'conservative',resource:'true'}});
  assert.equal(game().metrics.gdpPerCapitaReal,500);assert.equal(game().politics.constitution.regime,'personalist');assert.equal(game().demography.fertility,3.279);
 }finally{globalThis.FormData=NativeFormData;}
 const {createSimulation,exportSimulation}=await import('../src/engine.js');
 const campaignSave=createSimulation({politicalMode:true,politicalOptions:{constitution:{parliamentOffset:12},decisionLimit:3,dashboardMode:true,partyContinuity:true}});
 node('import-file').files=[{size:1000,text:async()=>exportSimulation(campaignSave)}];
 await node('import-file').listeners.change({target:node('import-file')});await click({action:'proposal-close'});
 assert.ok(app.innerHTML.includes('id="campaign-dialog"'));assert.ok(!app.innerHTML.includes('Одобрение власти'));assert.ok(app.innerHTML.includes('Парламентский рейтинг'));
 const eventId=app.innerHTML.match(/data-event-id="([^"]+)"/)[1];
 await click({campaignChoice:'0',eventId});assert.equal(game().politics.campaignResponses.length,1);assert.ok(app.innerHTML.includes('Ответ опубликован'));
 await click({action:'campaign-close'});assert.ok(!app.innerHTML.includes('id="campaign-dialog"'));
 await click({view:'country'});assert.ok(!app.innerHTML.includes('Матрица межотраслевых затрат'));assert.ok(!app.innerHTML.includes('Открыть формулы модели'));
 await click({view:'country'});assert.ok(!app.innerHTML.includes('data-world='));assert.ok(!app.innerHTML.includes('data-shock='));assert.ok(!app.innerHTML.includes('data-stochastic'));assert.ok(!app.innerHTML.includes('УСЛОВИЯ ЭКСПЕРИМЕНТА'));
 await click({view:'country'});assert.ok(app.innerHTML.includes('population-pyramid'));assert.ok(!app.innerHTML.includes('Десять групп домохозяйств'));
 await click({view:'country'});assert.ok(app.innerHTML.includes('Структура производства'));assert.ok(app.innerHTML.includes('production-pie'));assert.ok(!app.innerHTML.includes('Будущий выпуск'));
 const {worldEvent}=await import('../src/world-events.js');let beforeNews=createSimulation({seed:42,politicalMode:true,politicalOptions:{livingWorld:true,constitution:{parliamentOffset:84,presidentTerm:84}}});
 const onset=Array.from({length:30},(_,i)=>worldEvent({...beforeNews,month:i+1})).find(Boolean).start;
 const {advanceMonth}=await import('../src/engine.js');for(let i=0;i<onset-1;i++)beforeNews=advanceMonth(beforeNews,beforeNews.policy);
 node('import-file').files=[{size:1000,text:async()=>exportSimulation(beforeNews)}];await node('import-file').listeners.change({target:node('import-file')});
 const pendingId=app.innerHTML.match(/data-bill-card="(\d+)"/)?.[1];if(pendingId)await click({politicalAction:'reject',billId:pendingId});await click({action:'step'});await click({action:'proposal-close'});
 await click({action:'result-close'});assert.equal(game().month,onset);assert.ok(app.innerHTML.includes('id="world-news-dialog"'));await click({action:'world-news-close'});assert.ok(!app.innerHTML.includes('id="world-news-dialog"'));
 assert.equal(saved.get('economy-model-v3'),legacy);
});

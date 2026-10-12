// Template/handler smoke test only. This is not layout or real-browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
  constructor(){this.innerHTML='';this.textContent='';this.listeners={};this.value='';this.dataset={};this.disabled=false;this.classList={add(){},remove(){}};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  querySelector(){return new Element();}
  showModal(){} close(){}
}
const nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
const saved=new Map();
const legacy=JSON.stringify({simulation:JSON.stringify({version:'3.0.0',state:{month:101}}),draft:{}});
saved.set('economy-model-v3',legacy);
globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
globalThis.document={getElementById:node,querySelector:selector=>node(selector),activeElement:null};

test('all views render and month, policy, comparison and checkpoint handlers execute without a browser',async()=>{
  await import('../src/app.js');
  const app=node('app');
  const click=async data=>app.listeners.click({target:{closest:()=>({dataset:data})},preventDefault(){}});
  const views=['security','government','policy','country','overview','economy','fiscal','credit','external','households','ownership','institutions','infrastructure','services','labor','politics','elections','parties','constitution','electorate',];
  assert.ok(app.innerHTML.includes('Следующий месяц'));assert.ok(app.innerHTML.includes('mission-control'));assert.ok(app.innerHTML.includes('Баланс бюджета за месяц'));assert.ok(app.innerHTML.includes('id="proposal-dialog"'));
  assert.ok(app.innerHTML.includes('Предложения партий'));assert.ok(app.innerHTML.includes('Было'));assert.ok(app.innerHTML.includes('Станет'));
  assert.ok(!app.innerHTML.includes('На следующий месяц:'));assert.ok(app.innerHTML.includes('data-category="decisions"'));assert.ok(app.innerHTML.includes('data-category="security"'));assert.ok(!app.innerHTML.includes('kpis'));assert.equal((app.innerHTML.match(/data-bill-card=/g)||[]).length,1);
  await click({action:'proposal-close'});await click({view:'households'});await click({action:'step'});assert.ok(app.innerHTML.includes('Ход 0'));assert.ok(app.innerHTML.includes('id="proposal-dialog"'));assert.ok(app.innerHTML.includes('Демография: возраст и пол'));
  const first=app.innerHTML.match(/data-bill-card="(\d+)"/)[1];await click({politicalAction:'adopt',billId:first});await click({action:'proposal-close'});
  await click({category:'security'});assert.ok(app.innerHTML.includes('Чрезвычайные полномочия и конфликт'));assert.ok(!app.innerHTML.includes('Предложения партий'));assert.ok(!app.innerHTML.includes('data-policy="rate"'));
  await click({category:'political'});assert.ok(app.innerHTML.includes('Поддержка кабинета'));assert.ok(!app.innerHTML.includes('Предложения партий'));
  await click({category:'statistics'});assert.ok(app.innerHTML.includes('ПАСПОРТ СТРАНЫ'));assert.ok(!app.innerHTML.includes('Предложения партий'));
  await click({view:'country'});
  assert.ok(app.innerHTML.includes('Население'));
  assert.ok(app.innerHTML.includes('ПАСПОРТ СТРАНЫ'));assert.ok(app.innerHTML.includes('Джини'));assert.ok(app.innerHTML.includes('ИЧР'));
  await click({view:'ownership'});assert.ok(app.innerHTML.includes('Национализировать'));
  await click({view:'institutions'});assert.ok(app.innerHTML.includes('Оплачено'));assert.ok(app.innerHTML.includes('не официальные индексы'));
  await click({view:'policy'});await click({policyTab:'Структура'});assert.ok(app.innerHTML.includes('Обязательные процедуры'));assert.ok(app.innerHTML.includes('data-policy-check="meritAppointments"'));
  assert.ok(!app.innerHTML.includes('id="policy-competition"'));assert.ok(!app.innerHTML.includes('id="policy-ruleOfLaw"'));
  app.listeners.change({target:{dataset:{policyCheck:'openProcurement'},checked:true,hasAttribute:()=>false}});
  const immediate=JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state;
  assert.equal(immediate.month,0);assert.equal(immediate.politics.pendingCommands.length,0);assert.ok(immediate.politics.rollCalls.length>0);
  assert.ok(app.innerHTML.includes('За:'));assert.ok(immediate.politics.bills.some(b=>b.patch.openProcurement===true&&b.decidedMonth===0));
  app.listeners.keydown({key:'Enter',target:{dataset:{policyNumber:'incomeTax'},value:'16'},preventDefault(){}});
  const keyed=JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state;assert.equal(keyed.month,0);assert.ok(keyed.politics.bills.some(b=>b.patch.incomeTax===16&&b.decidedMonth===0));
  app.listeners.change({target:{dataset:{policyNumber:'incomeTax'},value:''}});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state.politics.bills.length,keyed.politics.bills.length);
  for(const hidden of ['journal','compare','validation','method'])assert.ok(!app.innerHTML.includes('data-view="'+hidden+'"'));
  const beforeBlocked=JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state;assert.ok(app.innerHTML.includes('3 / 3'));
  app.listeners.change({target:{dataset:{policyChoice:'monetaryRegime'},value:'dollarized'}});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state.politics.bills.length,beforeBlocked.politics.bills.length);
  await click({view:'households'});assert.ok(app.innerHTML.includes('Рождения'));assert.ok(app.innerHTML.includes('Продолжительность')||app.innerHTML.includes('продолжительность'));

  await click({view:'policy'});await click({policyTab:'Кредит'});
  assert.ok(app.innerHTML.includes('За:'));
  await click({view:'parties'});assert.ok(app.innerHTML.includes('Либеральная партия'));assert.ok(app.innerHTML.includes('Голоса на последних выборах'));assert.ok(!app.innerHTML.includes('Свобода и развитие'));
  await click({view:'elections'});assert.ok(app.innerHTML.includes('Одобрение президента'));assert.ok(app.innerHTML.includes('Ваш кандидат'));assert.ok(app.innerHTML.includes('Почему рейтинг и голоса различаются'));
  for(const view of views){await click({view});assert.ok(app.innerHTML.includes('Баланс бюджета за месяц'));assert.ok(app.innerHTML.includes('Следующий месяц'));assert.ok(app.innerHTML.includes('Экономическая лаборатория'));assert.ok(!app.innerHTML.includes('NaN'));}
  app.listeners.input({target:{dataset:{policy:'rate'},value:'15'}});
  await click({action:'step'});
  const persisted=JSON.parse(saved.get('economy-model-v5'));
  const state=JSON.parse(persisted.simulation).state;
  assert.equal(state.month,1);assert.equal(state.policy.rate,8.25);
  const procurement=state.politics.bills.find(b=>b.patch.openProcurement===true);assert.equal(state.policy.openProcurement,procurement.status==='enacted');assert.equal(saved.get('economy-model-v3'),legacy);
  for(const view of views){await click({view});assert.ok(!app.innerHTML.includes('NaN'));assert.ok(!app.innerHTML.includes('undefined'));}
  assert.equal(state.journal.length,1);assert.equal(state.journal[0].requestedPolicy.rate,8.25);assert.equal(state.journal[0].policy.rate,8.25);assert.ok(state.journal[0].turnPoliticalCommands.length>=1);
  await click({view:'infrastructure'});node('network-id').value='roads';node('network-kind').value='networkSale';node('network-points').value='10';
  await click({action:'network-queue'});assert.ok(app.innerHTML.includes('За:'));
  const operation=JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state;assert.equal(operation.pendingActions.length,0);assert.equal(operation.month,1);
  assert.ok(operation.politics.bills.some(b=>b.actions.some(a=>a.network==='roads')&&b.decidedMonth===1));
  await click({action:'checkpoint'});assert.ok(saved.has('economy-checkpoint-v5'));
  app.listeners.input({target:{dataset:{policy:'rate'},value:'11'}});
  const current=app.innerHTML;await click({view:'compare'});assert.equal(app.innerHTML,current);
  assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state.month,1);
  await click({view:'infrastructure'});await click({action:'run3'});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state.month,2);assert.ok(app.innerHTML.includes('data-view="infrastructure" class="active"'));
  let latest=JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state;
  while(!latest.politics.bills.some(b=>b.monthlyInitiative&&b.month===latest.month&&b.status==='draft')){await click({action:'step'});latest=JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state;assert.ok(latest.month<=4);}
  const second=latest.politics.bills.find(b=>b.monthlyInitiative&&b.month===latest.month&&b.status==='draft');assert.ok(app.innerHTML.includes('id="proposal-dialog"'));await click({politicalAction:'reject',billId:String(second.id)});await click({action:'proposal-close'});await click({action:'step'});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state.month,latest.month+1);
  await click({graph:'budgetBalance'});assert.ok(app.innerHTML.includes('id="trend-dialog"'));assert.ok(app.innerHTML.includes('Плюс — профицит'));await click({action:'trend-close'});
  await click({view:'electorate'});assert.ok(app.innerHTML.includes('Как меняется поддержка'));app.listeners.change({target:{dataset:{electorateDimension:'true'},value:'income'}});assert.ok(app.innerHTML.includes('Низкие доходы'));app.listeners.change({target:{dataset:{electorateMeasure:'true'},value:'candidate'}});assert.ok(app.innerHTML.includes('Поддержка кандидата'));
  await click({action:'restore'});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v5')).simulation).state.month,1);
  assert.equal(saved.get('economy-model-v3'),legacy);
});

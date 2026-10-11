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
  const views=['country','overview','economy','fiscal','credit','external','households','ownership','institutions','journal','compare','validation','method'];
  assert.ok(app.innerHTML.includes('Следующий месяц'));
  assert.ok(app.innerHTML.includes('Общий реальный ВВП'));
  assert.ok(app.innerHTML.includes('Население'));
  assert.ok(app.innerHTML.includes('Паспорт страны'));assert.ok(app.innerHTML.includes('Джини'));assert.ok(app.innerHTML.includes('ИЧР'));
  await click({view:'ownership'});assert.ok(app.innerHTML.includes('Национализировать'));
  await click({view:'institutions'});assert.ok(app.innerHTML.includes('Оплачено'));assert.ok(app.innerHTML.includes('не официальные индексы'));
  await click({policyTab:'Структура'});assert.ok(app.innerHTML.includes('Обязательные процедуры'));assert.ok(app.innerHTML.includes('data-policy-check="meritAppointments"'));
  assert.ok(!app.innerHTML.includes('id="policy-competition"'));assert.ok(!app.innerHTML.includes('id="policy-ruleOfLaw"'));
  app.listeners.change({target:{dataset:{policyCheck:'openProcurement'},checked:true,hasAttribute:()=>false}});
  await click({view:'journal'});assert.ok(app.innerHTML.includes('Скачать журнал'));
  await click({view:'households'});assert.ok(app.innerHTML.includes('Рождения'));assert.ok(app.innerHTML.includes('Продолжительность')||app.innerHTML.includes('продолжительность'));
  await click({view:'validation'});assert.ok(app.innerHTML.includes('360 месяцев'));assert.ok(app.innerHTML.includes('Денежная стабилизация'));
  for(const view of views){await click({view});assert.ok(app.innerHTML.includes('Экономическая лаборатория'));assert.ok(!app.innerHTML.includes('NaN'));}
  app.listeners.input({target:{dataset:{policy:'rate'},value:'15'}});
  await click({action:'step'});
  const persisted=JSON.parse(saved.get('economy-model-v31'));
  const state=JSON.parse(persisted.simulation).state;
  assert.equal(state.month,1);assert.equal(state.policy.rate,15);
  assert.equal(state.policy.openProcurement,true);assert.equal(saved.get('economy-model-v3'),legacy);
  for(const view of views){await click({view});assert.ok(!app.innerHTML.includes('NaN'));assert.ok(!app.innerHTML.includes('undefined'));}
  assert.equal(state.journal.length,1);assert.equal(state.journal[0].policy.rate,15);
  await click({action:'checkpoint'});assert.ok(saved.has('economy-checkpoint-v31'));
  app.listeners.input({target:{dataset:{policy:'rate'},value:'11'}});
  await click({view:'compare'});await click({action:'compare'});
  assert.ok(app.innerHTML.includes('Результаты на конец горизонта'));
  assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v31')).simulation).state.month,1);
  await click({action:'run3'});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v31')).simulation).state.month,4);
  await click({action:'restore'});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v31')).simulation).state.month,1);
  assert.equal(saved.get('economy-model-v3'),legacy);
});

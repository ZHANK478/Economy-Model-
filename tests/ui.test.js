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
globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
globalThis.document={getElementById:node,querySelector:selector=>node(selector),activeElement:null};

test('all views render and month, policy, comparison and checkpoint handlers execute without a browser',async()=>{
  await import('../src/app.js');
  const app=node('app');
  const click=async data=>app.listeners.click({target:{closest:()=>({dataset:data})},preventDefault(){}});
  const views=['overview','economy','fiscal','credit','external','households','compare','method'];
  assert.ok(app.innerHTML.includes('Следующий месяц'));
  for(const view of views){await click({view});assert.ok(app.innerHTML.includes('Экономическая лаборатория'));assert.ok(!app.innerHTML.includes('NaN'));}
  app.listeners.input({target:{dataset:{policy:'rate'},value:'15'}});
  await click({action:'step'});
  const persisted=JSON.parse(saved.get('economy-model-v1'));
  const state=JSON.parse(persisted.simulation).state;
  assert.equal(state.month,1);assert.equal(state.policy.rate,15);
  for(const view of views){await click({view});assert.ok(!app.innerHTML.includes('NaN'));assert.ok(!app.innerHTML.includes('undefined'));}
  await click({action:'checkpoint'});assert.ok(saved.has('economy-checkpoint-v1'));
  app.listeners.input({target:{dataset:{policy:'rate'},value:'11'}});
  await click({view:'compare'});await click({action:'compare'});
  assert.ok(app.innerHTML.includes('Результаты на конец горизонта'));
  assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v1')).simulation).state.month,1);
  await click({action:'run3'});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v1')).simulation).state.month,4);
  await click({action:'restore'});assert.equal(JSON.parse(JSON.parse(saved.get('economy-model-v1')).simulation).state.month,1);
});

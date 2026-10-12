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
 assert.ok(app.innerHTML.includes('vertical-navigation'));assert.ok(!app.innerHTML.includes('category-tabs'));
 assert.ok(app.innerHTML.includes('Рейтинг президента'));assert.ok(app.innerHTML.includes('январь 2000'));
 assert.ok(app.innerHTML.includes('id="proposal-dialog"'));const id=app.innerHTML.match(/data-bill-card="(\d+)"/)[1];
 await click({action:'proposal-close'});await click({category:'statistics'});
 assert.ok(!app.innerHTML.includes('ПАСПОРТ СТРАНЫ'));assert.ok(app.innerHTML.includes('Паспорт страны'));
 await click({view:'country'});assert.ok(app.innerHTML.includes('ПАСПОРТ СТРАНЫ'));await click({view:'country'});assert.ok(!app.innerHTML.includes('ПАСПОРТ СТРАНЫ'));
 await click({view:'households'});await click({action:'step'});assert.ok(app.innerHTML.includes('Ход 0'));assert.ok(app.innerHTML.includes('Демография: возраст и пол'));assert.ok(app.innerHTML.includes('id="proposal-dialog"'));
 await click({politicalAction:'adopt',billId:id});assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(!app.innerHTML.includes('id="proposal-dialog"'));
 await click({action:'result-close'});assert.ok(!app.innerHTML.includes('id="result-dialog"'));assert.ok(!app.innerHTML.includes('data-bill-card='));
 await click({view:'policy'});await click({policyTab:'Структура'});assert.ok(!app.innerHTML.includes('type="range"'));assert.ok(app.innerHTML.includes('data-policy-number='));
 app.listeners.change({target:{dataset:{policyCheck:'openProcurement'},checked:true,hasAttribute:()=>false}});
 assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(app.innerHTML.includes('За:'));assert.equal(game().month,0);
 await click({action:'result-close'});assert.ok(!app.innerHTML.includes('decision-feedback'));assert.ok(!app.innerHTML.includes('За:'));
 app.listeners.keydown({key:'Enter',target:{dataset:{policyNumber:'incomeTax'},value:'16'},preventDefault(){}});
 assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(game().politics.bills.some(b=>b.patch.incomeTax===16));await click({action:'result-close'});
 const count=game().politics.bills.length;assert.ok(app.innerHTML.includes('3 / 3'));
 app.listeners.change({target:{dataset:{policyChoice:'monetaryRegime'},value:'dollarized'}});assert.equal(game().politics.bills.length,count);
 await click({action:'step'});assert.equal(game().month,1);assert.equal(game().journal.length,1);
 const views=['security','government','policy','country','overview','economy','fiscal','credit','external','households','ownership','institutions','infrastructure','services','labor','politics','elections','parties','constitution','electorate'];
 for(const view of views){if(app.innerHTML.includes(`data-view="${view}" class="active"`))await click({view});await click({view});assert.ok(app.innerHTML.includes('Баланс бюджета за месяц'));assert.ok(app.innerHTML.includes('Следующий месяц'));assert.ok(!app.innerHTML.includes('NaN'));assert.ok(!app.innerHTML.includes('undefined'));}
 app.listeners.change({target:{dataset:{policyCheck:'protectedJudges'},checked:false,hasAttribute:()=>false}});assert.ok(app.innerHTML.includes('id="result-dialog"'));assert.ok(app.innerHTML.includes('Не все статьи'));assert.ok(app.innerHTML.includes('<b>80</b>'));await click({action:'result-close'});
 await click({view:'infrastructure'});node('network-id').value='roads';node('network-kind').value='networkSale';node('network-points').value='10';await click({action:'network-queue'});assert.ok(app.innerHTML.includes('id="result-dialog"'));await click({action:'result-close'});
 await click({graph:'budgetBalance'});assert.ok(app.innerHTML.includes('id="trend-dialog"'));await click({action:'trend-close'});
 await click({action:'usage-export'});const report=JSON.parse(await lastBlob.text());assert.equal(report.format,'economy-ui-observation');assert.ok(report.summary.targets.some(x=>x.id==='view:country'&&x.opens>0));assert.ok(report.events.some(x=>x.target==='window:result'));assert.ok(report.summary.neverOpened.some(x=>x.id==='graph:giniDisposable'));
 await click({action:'export'});const payload=JSON.parse(await lastBlob.text());assert.ok(payload.uiObservation);assert.ok(!payload.state.uiObservation);assert.equal(payload.state.month,1);
 await click({action:'journal-export'});const journal=JSON.parse(await lastBlob.text());assert.equal(journal.format,'economy-decisions');assert.equal(journal.journal.length,1);
 await click({action:'checkpoint'});assert.ok(saved.has('economy-checkpoint-v5'));await click({action:'step'});await click({action:'restore'});assert.equal(game().month,1);assert.ok(!app.innerHTML.includes('id="result-dialog"'));
 for(const hidden of ['journal','compare','validation','method']){const before=app.innerHTML;await click({view:hidden});assert.equal(app.innerHTML,before);}
 assert.equal(saved.get('economy-model-v3'),legacy);
});

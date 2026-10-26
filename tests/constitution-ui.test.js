import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,copy} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {constitutionBoard,stageConstitution,stepConstitution,constitutionPatch,resetConstitutionUI} from '../src/constitution-ui.js';
const helpers={esc:String,n:(v,d=0)=>Number(v).toFixed(d),date:m=>String(m)};
test('constitution opens as four articles without administrative tables or hidden coefficients',()=>{
 const s=createSimulation(newGameOptions()),ui={section:null,patch:{}};
 const html=constitutionBoard(s,ui,helpers);
 assert.equal((html.match(/class="charter-card"/g)??[]).length,4);
 assert.ok(!html.includes('<table'));assert.ok(!html.includes('world-grid'));assert.ok(!html.includes('Коррупционный риск'));
 assert.ok(html.includes('80 голосов'));assert.ok(html.includes('data-charter-section="powers"'));
});
test('editing an article changes no simulation data and submits only scoped valid amendments',()=>{
 const s=createSimulation(newGameOptions()),before=copy(s),ui={section:'terms',patch:{}};
 stepConstitution(s,ui,'parliamentTerm',1);stageConstitution(s,ui,'independentCB',false);
 assert.deepEqual(constitutionPatch(s,ui),{parliamentTerm:60});assert.deepEqual(s,before);
 stageConstitution(s,ui,'parliamentTerm',48);assert.deepEqual(constitutionPatch(s,ui),{});
 stageConstitution(s,ui,'parliamentTerm',120);assert.deepEqual(constitutionPatch(s,ui),{parliamentTerm:84});
 resetConstitutionUI(ui);assert.deepEqual(ui,{section:null,patch:{}});
 ui.section='powers';stageConstitution(s,ui,'independentCB',false);assert.deepEqual(constitutionPatch(s,ui),{independentCB:false});
 assert.match(constitutionBoard(s,ui,{...helpers,canVote:false}),/data-action="charter-vote" disabled/);
});
test('parliamentary terms do not display presidential terms, and no-op articles cannot be voted on',()=>{
 const s=createSimulation(newGameOptions({government:'parliamentary'})),ui={section:'terms',patch:{}};
 const html=constitutionBoard(s,ui,helpers);
 assert.ok(html.includes('Срок парламента'));assert.ok(!html.includes('Срок президента'));assert.ok(!html.includes('Предел президентских'));
 assert.match(html,/data-action="charter-vote" disabled/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CODEX_COUNTRIES,CODEX_REGIONS} from '../src/codex-locations.js';
import {atlasEntries} from '../src/desk-atlas.js';
import {DESK_ATLASES} from '../src/desk-atlas-data.js';
import {atlasFrame, atlasProjection, defaultAtlasCamera, panAtlas, zoomAtlas} from '../src/atlas-camera.js';
import {atlasRectsOverlap, layoutAtlasAnnotations} from '../src/atlas-map-layout.js';

const close = (actual, expected) => actual.forEach((value,i) => assert.ok(Math.abs(value-expected[i])<1e-7));
const measure = ({lines,size,spacing}) => Math.max(...lines.map(line=>line.length*(size*.59+spacing)));
const options = {obstacles:[], measure, hasEvent:false, world:true};

test('atlas zoom preserves the geographic point under the cursor and supports close views', () => {
  const projection = atlasProjection(DESK_ATLASES.world,'world',1028,595);
  const camera = defaultAtlasCamera(projection);
  const anchor = [510,240];
  const point = atlasFrame(camera,projection).unproject(...anchor);
  const zoomed = zoomAtlas(camera,projection,8,anchor);
  assert.equal(zoomed.zoom,8);
  close(atlasFrame(zoomed,projection).project(...point),anchor);
  const panned = panAtlas(zoomed,projection,-120,60);
  close(atlasFrame(panned,projection).project(...point),[390,300]);
  const edge = panAtlas(panned,projection,1e6,1e6);
  assert.ok(edge.x>=projection.atlas.margin && edge.y>=projection.atlas.margin);
});

test('new country names appear when zooming and all displayed labels are separate', () => {
  const atlas = DESK_ATLASES.world;
  const projection = atlasProjection(atlas,'world',1366,650);
  const entries = atlas.labels.slice().sort((a,b)=>b.priority-a.priority);
  const base = defaultAtlasCamera(projection);
  const france = atlas.labels.find(entry=>entry.kind==='country' && entry.name==='Франция');
  const belgium = atlas.labels.find(entry=>entry.kind==='country' && entry.name==='Бельгия');
  const far = layoutAtlasAnnotations(entries, atlas, atlasFrame(base,projection), options);
  const near = layoutAtlasAnnotations(entries, atlas, atlasFrame({x:france.x,y:france.y,zoom:24},projection), options);
  assert.equal(far.labels.some(item=>item.entry===belgium),false);
  assert.ok(near.labels.some(item=>item.entry===france));
  assert.ok(near.labels.some(item=>item.entry===belgium));
  for (const {labels,markers} of [far,near]) {
    for (const [i, a] of labels.entries()) {
      assert.ok(labels.slice(i+1).every(b=>!atlasRectsOverlap(a.box,b.box)));
      assert.ok(markers.every(marker=>!atlasRectsOverlap(a.box,marker.box)));
    }
  }
});

test('all Codex capitals have distinct world pins and London keeps its event position', () => {
  const world = atlasEntries('world',false);
  const foreign = world.filter(item=>item.mark==='foreign-capital');
  assert.equal(world.find(item=>item.mark==='home').name,'Лондон');
  assert.equal(world.find(item=>item.name==='Бразилиа').mark,'star');
  assert.equal(foreign.length,CODEX_COUNTRIES.length);
  for (const country of CODEX_COUNTRIES) {
    assert.equal(foreign.find(item=>item.countryId===country.id)?.name,country.capital);
    assert.ok(readFileSync(new URL('../assets/codex-flags/'+country.id+'.svg',import.meta.url),'utf8').includes('<svg'));
  }
  for (const [width,height] of [[1366,650],[1024,768],[390,844]]) {
    const projection=atlasProjection(DESK_ATLASES.world,'world',width,height);
    const {markers}=layoutAtlasAnnotations(world,projection.atlas,atlasFrame(defaultAtlasCamera(projection),projection),options);
    assert.equal(markers.filter(item=>item.mark==='foreign-capital').length,foreign.length);
    for (const [index,marker] of markers.entries()) {
      assert.ok(markers.slice(index+1).every(other=>!atlasRectsOverlap(marker.box,other.box)));
    }
  }
  const atlas = DESK_ATLASES.national;
  const projection = atlasProjection(atlas,'national',1366,650);
  const frame = atlasFrame(defaultAtlasCamera(projection),projection);
  const {markers,event} = layoutAtlasAnnotations(atlasEntries('national',false),atlas,frame,{
    ...options,world:false,hasEvent:true,
  });
  const london = markers.find(item=>item.entry.name==='Лондон');
  close([london.x,london.y],frame.project(london.entry.x,london.entry.y));
  assert.equal(event.x,london.x);
  assert.ok(event.y<london.y);
});

test('the national artwork uses a black outline and a distinct land frontier', () => {
  const svg = readFileSync(new URL('../assets/britain-play.svg',import.meta.url),'utf8');
  assert.match(svg, /stroke="#191816" stroke-width="\.825"[^>]+data-uk-outline/);
  assert.match(svg, /stroke="#69844e" stroke-width="2\.4"[^>]+data-irish-frontier/);
  assert.match(svg, /stroke="#736344" stroke-width="\.34"/);
  const world = readFileSync(new URL('../assets/world-desk.svg',import.meta.url),'utf8');
  assert.match(world, /stroke-width="\.335"[^>]+data-country="GBR"/);
  assert.doesNotMatch(svg, /<image\b/);
});

test('each British region has exactly one map hit area keyed to its Codex entry', () => {
  const svg = readFileSync(new URL('../assets/britain-play.svg',import.meta.url),'utf8');
  const mappedRegions = [...svg.matchAll(/data-atlas-region="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(mappedRegions.sort(),CODEX_REGIONS.map(region=>region.id).sort());
});

test('national zoom cannot go beyond the supplied desk overview', () => {
  for (const [width,height] of [[1366,638],[1024,768],[390,844]]) {
    const projection=atlasProjection(DESK_ATLASES.national,'national',width,height);
    const base=defaultAtlasCamera(projection);
    const far=zoomAtlas(base,projection,.001,[width*.2,height*.8]);
    assert.equal(far.zoom,base.zoom);
    close([far.x,far.y],[base.x,base.y]);
    const near=zoomAtlas(base,projection,2,[width/2,height/2]);
    assert.ok(near.zoom>base.zoom);
  }
  const projection=atlasProjection(DESK_ATLASES.national,'national',1366,638);
  const frame=atlasFrame(defaultAtlasCamera(projection),projection);
  close(frame.project(782.21,712.64),[630,400]);
});

test('foreign dossiers show country-level opening figures and share British membership emblems',async()=>{
  const {countryDossier}=await import('../src/atlas-interface.js');
  const {foreignCountryDossier,FOREIGN_COUNTRY_MAP}=await import('../src/foreign-country-dossier.js');
  const state={scenario:{id:'uk-2000'},population:59,politics:{},metrics:{realGDPAnnualized:1600000},history:[]};
  const home=countryDossier(state,'general',{n:String,date:()=>2000});
  const emblem=(html,organization)=>html.match(new RegExp('aria-label="'+organization+': [^"]*">(.*?</svg>)'))?.[1];
  for(const country of CODEX_COUNTRIES){
    const foreign=foreignCountryDossier(state,country);
    for(const label of ['Отношения','Оборона','Лидер','Правительство','Столица','Официальные языки','Население','Номинальный ВВП','Место в мировом ВВП']){
      assert.ok(foreign.includes('<dt>'+label+'</dt>'),country.id+' '+label);
    }
    for(const organization of ['ООН','НАТО','ЕС','Содружество']){
      const symbol=emblem(foreign,organization);
      if(symbol)assert.equal(symbol,emblem(home,organization));
    }
    assert.ok(FOREIGN_COUNTRY_MAP[country.id].population>0);
    assert.ok(FOREIGN_COUNTRY_MAP[country.id].gdp>0);
  }
});

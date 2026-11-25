import {CODEX_COUNTRIES,CODEX_REGIONS} from './codex-locations.js';
import {FOREIGN_COUNTRY_MAP} from './foreign-country-dossier.js';
import {esc} from './atlas-interface.js';
import {DESK_ATLASES} from './desk-atlas-data.js';
import {mountAtlasTraffic} from './atlas-traffic.js';
import {playInterfaceSound} from './interface-audio.js';
import {atlasFrame, atlasProjection, boundAtlasCamera, defaultAtlasCamera, panAtlas, zoomAtlas} from './atlas-camera.js';
import {BRITISH_CITIES} from './city-dossier.js';
import {ATLAS_SANS_FACE, layoutAtlasAnnotations} from './atlas-map-layout.js';

const regionalCities = new Set(BRITISH_CITIES.filter(city => city.id !== 'TLI').map(city => city.name));

const foreignCapitals = new Map(CODEX_COUNTRIES.map(country=>[
  FOREIGN_COUNTRY_MAP[country.id].code,country,
]));

export function atlasEntries(mode, decorative, europeanUnion=false) {
  return DESK_ATLASES[mode].labels.map(entry => {
    if (decorative) return {...entry, mark:undefined};
    if (mode === 'world' && entry.kind === 'city') {
      if(europeanUnion&&entry.code==='BEL'&&entry.name==='Брюссель'){
        return {...entry,countryId:'eu',mark:'foreign-capital',markerMin:0,priority:108};
      }
      const country = foreignCapitals.get(entry.code);
      if (country?.capital === entry.name) return {...entry, countryId:country.id, mark:'foreign-capital', markerMin:1, priority:105};
    }
    if (mode !== 'national' || entry.code !== 'GBR' || entry.kind !== 'city' || entry.mark === 'capital') return entry;
    if (regionalCities.has(entry.name)) return {...entry, mark:'regional-city', markerMin:0, priority:102};
    return {...entry, mark:'dot'};
  }).sort((a,b) => b.priority-a.priority);
}

const maps = new Map();
const overscan = 96;
let nextLabelId = 0;
let atlasFonts;
let measure;

function loadAtlasFonts() {
  atlasFonts ??= Promise.allSettled([500, 800].map(weight =>
    document.fonts.load(weight+' 16px '+ATLAS_SANS_FACE, 'ФРАНЦИЯ СЕВЕРНОЕ МОРЕ')
  ));
  return atlasFonts;
}
const star = 'M0-3.3 .9-1.1 3.2-1 1.5.6 2.1 3 0 1.6-2.1 3-1.5.6-3.2-1-.9-1.1Z';
const markArt = {
  'regional-city': '<use href="#town" transform="scale(.59)"/>',
  dot: '<circle r="2.15" fill="#362a1f" stroke="#eadbb5" stroke-width=".7"/>',
  star: `<circle r="4.4" fill="#f0e3bc" stroke="#493928" stroke-width="1"/><path d="${star}" fill="#493928"/>`,
};
const obstacleSelector = [
  '.atlas-country-seal', '.reference-home', '.reference-resources', '.atlas-summary', '.atlas-world-switch',
  '.atlas-scenario-decisions', '.atlas-news-button', '.main-navigation', '.strategy-situation button', '.turn-dock',
  '.campaign-readout', '.map-notice', '.atlas-attribution', '.screen-content', '.news-rail', '.atlas-dossier', '.codex-panel', '.connections-panel',
].join(',');

function loadVectorSheet(asset) {
  if (!maps.has(asset)) {
    const pending = fetch(new URL('../assets/'+asset, import.meta.url))
      .then(response => {
        if (!response.ok) throw new Error('Atlas asset '+response.status);
        return response.text();
      })
      .then(text => {
        const sheet = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        if (sheet.localName !== 'svg') throw new Error('Invalid atlas SVG');
        const plane = document.createElementNS(sheet.namespaceURI, 'g');
        plane.append(...sheet.children);
        return plane;
      })
      .catch(error => {
        maps.delete(asset);
        throw error;
      });
    maps.set(asset, pending);
  }
  return maps.get(asset);
}

function textMeasurer() {
  const context = document.createElement('canvas').getContext('2d');
  const widths = new Map();
  return ({lines, weight, size, family, spacing}) => Math.max(...lines.map(line => {
    const font = `${weight} 100px ${family}`;
    const key = font+' '+line;
    if (!widths.has(key)) {
      context.font = font;
      widths.set(key, context.measureText(line).width);
    }
    return widths.get(key)*size/100 + Array.from(line).length*spacing;
  }));
}

function labelMarkup({entry,style,span,sag}, id) {
  const half = span/2 + 4;
  const edge = (-sag/2).toFixed(2);
  const baseline = sag ? `<defs><path id="${id}" d="M${(-half).toFixed(2)} ${edge} Q0 ${(1.5*sag).toFixed(2)} ${half.toFixed(2)} ${edge}"/></defs>` : '';
  const lines = sag ? `<textPath href="#${id}" startOffset="50%">${esc(style.lines[0])}</textPath>` :
    style.lines.map((line,i) => `<tspan x="0" y="${((i-(style.lines.length-1)/2)*style.lineHeight).toFixed(2)}">${esc(line)}</tspan>`).join('');
  return `${baseline}<text class="atlas-type-${entry.kind}" font-family="${esc(style.family)}" font-size="${style.size}" font-weight="${style.weight}" letter-spacing="${style.spacing.toFixed(2)}" data-map-label="${esc(entry.name)}">${lines}</text>`;
}

function syncAnnotations(layer, nodes, items, update) {
  const visible = new Set();
  for (const item of items) {
    visible.add(item.entry);
    let record = nodes.get(item.entry);
    if (!record) {
      const node = document.createElementNS(layer.namespaceURI, 'g');
      record = {node};
      nodes.set(item.entry, record);
      layer.append(node);
    }
    const suffix = update(record, item);
    record.node.setAttribute('transform', `translate(${item.x.toFixed(2)} ${item.y.toFixed(2)}) ${suffix}`);
  }
  for (const [entry, record] of nodes) {
    if (visible.has(entry)) continue;
    record.node.remove();
    nodes.delete(entry);
  }
}

function updateLabel(record, item) {
  record.id ??= `atlas-type-baseline-${++nextLabelId}`;
  const {size, spacing} = item.style;
  if (record.size !== size || record.spacing !== spacing || record.sag !== item.sag) {
    record.node.innerHTML = labelMarkup(item, record.id);
    Object.assign(record, {size, spacing, sag:item.sag});
  }
  return `rotate(${item.style.angle})`;
}

function updateMarker(record, {entry, mark, scale}) {
  if (record.mark !== mark) {
    record.node.setAttribute('class', 'atlas-city-mark');
    record.node.dataset.mapCity = entry.name;
    record.node.dataset.mark = mark;
    record.node.innerHTML = markArt[mark] ?? `<use href="#${mark}"/>`;
    record.mark = mark;
  }
  return `scale(${scale})`;
}

function positionPin(button, position, size) {
  if (!button) return;
  button.hidden = !position;
  if (!position) return;
  button.style.transform = `translate(${position.x}px,${position.y}px) translate(-50%, -50%)`;
  button.style.width = button.style.height = size+'px';
}

/** Keep camera state across the game's HUD renders, scoped to this map mode. */
export function mountDeskAtlas(viewport, cameras, {decorative=false,focusCity=null,focusForeign=null,focusRegion=null,activeRegion=null,onRegion=null}={}) {
  const mode = viewport.dataset.deskAtlas;
  const atlas = DESK_ATLASES[mode];
  if (!atlas) return () => {};
  const vector = viewport.querySelector('.atlas-vectors');
  const geography = viewport.querySelector('.atlas-geography');
  const symbols = viewport.querySelector('.atlas-map-symbols');
  const lettering = viewport.querySelector('.atlas-map-lettering');
  const desk = viewport.querySelector('.atlas-desk-objects');
  const home = viewport.querySelector('[data-atlas-home]');
  const foreignPins = [...viewport.querySelectorAll('[data-atlas-foreign]')];
  const cityPins = [...viewport.querySelectorAll('[data-atlas-city]')].map(pin=>[pin,pin.title]);
  const event = viewport.querySelector('.atlas-event-pin:not([data-atlas-request])');
  const requestPins = [...viewport.querySelectorAll('[data-atlas-request]')];
  const status = viewport.querySelector('.atlas-map-status');
  const hud = decorative ? [] : [...viewport.closest('.strategy-game').querySelectorAll(obstacleSelector)];
  // Menu uses the same national labels and framing, with every marker removed.
  const entries = atlasEntries(mode, decorative, foreignPins.some(pin=>pin.dataset.atlasForeign==='eu'));
  measure ??= textMeasurer();
  const controller = new AbortController();
  const {signal} = controller;
  const traffic = !decorative && viewport.ownerDocument.documentElement.dataset.platform !== 'android'
    ? mountAtlasTraffic(vector, mode, atlas.traffic, signal)
    : null;
  const pointers = new Map();
  let regionPress = null, selectedRegion = null;
  const markerNodes = new Map(), labelNodes = new Map();
  let projection, plane, geographyFrame, frameRequest = 0;

  function paint() {
    frameRequest = 0;
    const {clientWidth:width,clientHeight:height} = viewport;
    if (!width || !height) return;
    if (!projection || projection.width !== width || projection.height !== height) {
      projection = atlasProjection(atlas, mode, width, height);
      vector.setAttribute('viewBox', `0 0 ${width} ${height}`);
      geography.setAttribute('viewBox', `${-overscan} ${-overscan} ${width+2*overscan} ${height+2*overscan}`);
      Object.assign(geography.style, {
        left:`${-overscan}px`, top:`${-overscan}px`,
        width:`${width+2*overscan}px`, height:`${height+2*overscan}px`,
      });
      geographyFrame = null;
      desk.style.width = projection.desk.width+'px';
      desk.style.height = projection.desk.height+'px';
      cameras[mode] = cameras[mode] ? boundAtlasCamera(cameras[mode], projection) : defaultAtlasCamera(projection);
    }
    const camera = cameras[mode];
    const frame = atlasFrame(camera, projection);
    const {scale,e,f} = frame;
    const {left,top} = viewport.getBoundingClientRect();
    const obstacles = hud.flatMap(element => {
      const r = element.getBoundingClientRect();
      return r.width && r.height ? [{left:r.left-left-5,top:r.top-top-5,right:r.right-left+5,bottom:r.bottom-top+5}] : [];
    });
    desk.style.transform = `translate(${e+projection.desk.x*scale}px,${f+projection.desk.y*scale}px) scale(${scale})`;
    if (!plane) return;
    traffic?.(frame);

    // During a drag the compositor can shift the already painted sheet.
    // Repaint at native resolution when the padded area or zoom changes.
    if (geographyFrame?.scale !== scale || Math.abs(e-geographyFrame.e) > overscan || Math.abs(f-geographyFrame.f) > overscan) {
      plane.setAttribute('transform', 'matrix('+frame.matrix.join(' ')+')');
      geographyFrame = frame;
    }
    geography.style.transform = `translate(${e-geographyFrame.e}px,${f-geographyFrame.f}px)`;
    const requests = requestPins.map(pin=>({id:pin.dataset.atlasRequest,kind:pin.dataset.requestKind,name:pin.dataset.requestPlace}));
    const visible = layoutAtlasAnnotations(entries, atlas, frame, {obstacles, measure, hasEvent:!!event, requests, world:mode==='world'});
    syncAnnotations(symbols, markerNodes, visible.markers.filter(marker => !['home','foreign-capital'].includes(marker.mark)), updateMarker);
    syncAnnotations(lettering, labelNodes, visible.labels, updateLabel);
    const britishCapital = visible.markers.find(marker => marker.mark === 'home');
    positionPin(home, britishCapital, britishCapital?.scale*34);
    for (const pin of foreignPins) {
      const id = pin.dataset.atlasForeign;
      const marker = visible.markers.find(item=>item.entry.countryId===id);
      positionPin(pin,marker,marker?.scale*34);
      if (marker && id===focusForeign) {
        pin.focus({preventScroll:true});
        focusForeign=null;
      }
    }
    for(const [pin,name] of cityPins){
      const marker=visible.markers.find(item=>item.entry.code==='GBR'&&item.entry.kind==='city'&&item.entry.name===name);
      positionPin(pin,marker,marker?.mark==='capital'?40:26);
      if(marker&&pin.dataset.atlasCity===focusCity){pin.focus({preventScroll:true});focusCity=null;}
    }
    positionPin(event, visible.event, 34);
    for(const pin of requestPins)positionPin(pin,visible.requestPositions.get(pin.dataset.atlasRequest),30);
  }

  function schedule() {
    if (!frameRequest) frameRequest = requestAnimationFrame(paint);
  }
  const resize = new ResizeObserver(schedule);
  resize.observe(viewport);
  const campaignReadout = hud.find(element=>element.classList.contains('campaign-readout'));
  if(campaignReadout)resize.observe(campaignReadout);
  schedule();
  Promise.all([loadVectorSheet(atlas.asset), loadAtlasFonts()]).then(([sheet]) => {
    if (signal.aborted) return;
    // A cached sheet is a template: menu and game need separate SVG nodes.
    plane = sheet.cloneNode(true);
    if (!decorative && mode === 'national') {
      geography.removeAttribute('aria-hidden');
      geography.setAttribute('role','group');
      geography.setAttribute('aria-label','Регионы Великобритании');
      for (const region of CODEX_REGIONS) {
        const path = plane.querySelector('[data-atlas-region="'+region.id+'"]');
        if (!path) continue;
        path.setAttribute('role','button');
        path.setAttribute('tabindex','0');
        path.setAttribute('aria-label',region.name);
        path.setAttribute('aria-pressed',String(region.id===activeRegion));
        if(region.id===activeRegion)selectedRegion=path;
      }
    }
    geography.append(plane);
    if(focusRegion)plane.querySelector('[data-atlas-region="'+focusRegion+'"]')?.focus({preventScroll:true});
    status.hidden = true;
    schedule();
  }).catch(error => {
    if (signal.aborted) return;
    console.error(error);
    status.textContent = 'Не удалось загрузить карту';
  });

  if (decorative) return () => {
    controller.abort();
    resize.disconnect();
    cancelAnimationFrame(frameRequest);
  };

  function zoom(factor, anchor = [projection.width/2, projection.height/2]) {
    cameras[mode] = zoomAtlas(cameras[mode], projection, factor, anchor);
    schedule();
  }
  function pan(dx,dy) {
    cameras[mode] = panAtlas(cameras[mode], projection, dx,dy);
    schedule();
  }
  function command(action) {
    if (action === 'reset') {
      cameras[mode] = defaultAtlasCamera(projection);
      schedule();
    } else zoom(action === 'in' ? 1.35 : 1/1.35);
  }
  const coords = e => {
    const box = viewport.getBoundingClientRect();
    return [e.clientX-box.left, e.clientY-box.top];
  };
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    if (!projection) return;
    const pixels = e.deltaY*(e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? projection.height : 1);
    zoom(Math.exp(-Math.max(-180, Math.min(180,pixels))*.0025),coords(e));
  }, {passive:false,signal});
  function selectRegion(path) {
    playInterfaceSound('map');
    selectedRegion?.setAttribute('aria-pressed','false');
    path.setAttribute('aria-pressed','true');
    selectedRegion = path;
    onRegion?.(path.dataset.atlasRegion);
  }
  viewport.addEventListener('pointerdown', e => {
    if (!projection || e.button !== 0 || e.target.closest('button,a') || pointers.size >= 2) return;
    const region = e.target.closest('[data-atlas-region][role="button"]');
    regionPress = !pointers.size && region ? {id:e.pointerId,region,x:e.clientX,y:e.clientY} : null;
    if (region) e.preventDefault();
    pointers.set(e.pointerId,coords(e));
    viewport.setPointerCapture(e.pointerId);
  }, {signal});
  viewport.addEventListener('pointermove', e => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    if (regionPress?.id === e.pointerId && Math.hypot(e.clientX-regionPress.x,e.clientY-regionPress.y)<=6) return;
    regionPress = null;
    const current = coords(e);
    pointers.set(e.pointerId,current);
    const dx = current[0]-previous[0], dy = current[1]-previous[1];
    if (pointers.size === 1) {
      pan(dx,dy);
    } else {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const length = ([x,y]) => Math.hypot(x-other[0],y-other[1]);
      pan(dx/2,dy/2);
      if (length(previous)>8) zoom(length(current)/length(previous),[(current[0]+other[0])/2,(current[1]+other[1])/2]);
    }
  }, {signal});
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    viewport.addEventListener(type, e => {
      pointers.delete(e.pointerId);
      if (regionPress?.id !== e.pointerId) return;
      const press = regionPress;
      regionPress = null;
      if (type === 'pointerup' && Math.hypot(e.clientX-press.x,e.clientY-press.y)<=6)
        selectRegion(press.region);
    }, {signal});
  }
  viewport.addEventListener('keydown', e => {
    const region = e.target.closest('[data-atlas-region][role="button"]');
    if (region && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      selectRegion(region);
      return;
    }
    if (!projection || e.target !== viewport) return;
    const arrows = {ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]};
    const actions = {'+':'in','=':'in','-':'out','0':'reset','Home':'reset'};
    if (arrows[e.key]) pan(...arrows[e.key]);
    else if (actions[e.key]) command(actions[e.key]);
    else return;
    e.preventDefault();
  }, {signal});

  return () => {
    controller.abort();
    resize.disconnect();
    cancelAnimationFrame(frameRequest);
  };
}

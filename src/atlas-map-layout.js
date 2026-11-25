import {translateText} from './localization.js';

const ATLAS_SERIF = 'Georgia, "Times New Roman", serif';
export const ATLAS_SANS_FACE = 'AtlasLettering';
const ATLAS_SANS = ATLAS_SANS_FACE + ', Arial, sans-serif';

const LABEL_ANGLES = {
  'Великобритания':-24, 'Ирландия':-18, 'Шотландия':-24, 'Уэльс':-20,
  'Норвегия':-26, 'Швеция':-23, 'Япония':-24,
  'Северное море':-24, 'Ирландское море':-31, 'Атлантический океан':-19,
};

const MARK_BOXES = {
  dot: [-3,-3,3,3], star: [-5,-5,5,5], town: [-17,-17,17,14],
  civic: [-19,-21,19,16], capital: [-26,-38,26,21], seal: [-15,-15,15,17],
  home: [-17,-17,17,17], 'foreign-capital': [-17,-17,17,17], 'regional-city': [-11,-10,10,9],
};

export function atlasLabelText(entry, detail, proportion=1, world=false) {
  const {kind} = entry;
  const ocean = kind === 'water' && world;
  const capitalized = kind === 'country' || kind === 'region' || ocean || (kind === 'water' && entry.size >= 16);
  const translatedName = translateText(entry.name);
  const name = capitalized ? translatedName.toUpperCase() : translatedName;
  const lines = [name];
  if (kind !== 'city' && name.length >= (kind === 'country' ? 17 : kind === 'water' && !world ? 22 : 17) && name.includes(' ')) {
    const words = name.split(' ');
    const index = words.slice(0,-1).map((_,i) => i+1).reduce((best,i) => {
      const difference = n => Math.abs(words.slice(0,n).join(' ').length - words.slice(n).join(' ').length);
      return difference(i) < difference(best) ? i : best;
    }, 1);
    lines.splice(0, 1, words.slice(0,index).join(' '), words.slice(index).join(' '));
  }
  const growth = 1 + .11*Math.min(2.5, Math.log2(Math.max(1, detail)));
  const size = Math.round(10*Math.max(11.4, proportion*entry.size*growth))/10;
  const display = proportion >= .87 && size >= 16;
  const spacing = kind === 'country' ? size*(display ? .30 : .13)
    : kind === 'region' ? size*(display ? .26 : .15)
    : capitalized ? size*.23 : kind === 'water' ? size*.1 : size*.025;
  const weight = kind === 'country' ? 800 : ocean ? 500 : kind === 'city' && entry.priority >= 103 ? 700 : 400;
  const family = kind === 'country' || ocean ? ATLAS_SANS : ATLAS_SERIF;
  const angle = LABEL_ANGLES[entry.name] ?? (world ? -10 : -14);
  const arc = display && lines.length === 1 && kind !== 'city' && name.length >= 5;
  return {lines, size, spacing, weight, family, angle, arc, lineHeight: size*1.22};
}

function rect(x, y, width, height) {
  return {left:x-width/2, top:y-height/2, right:x+width/2, bottom:y+height/2};
}

export function atlasRectsOverlap(a,b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function markerBox(mark, x, y, scale) {
  const [l,t,r,b] = MARK_BOXES[mark.startsWith('seal-') ? 'seal' : mark];
  const padding = mark === 'regional-city' ? 0 : 2;
  return {left:x+l*scale-padding, top:y+t*scale-padding, right:x+r*scale+padding, bottom:y+b*scale+padding};
}

export function layoutAtlasAnnotations(entries, atlas, frame, options) {
  const {obstacles, measure, hasEvent, requests=[], world} = options;
  const {detail, width, height} = frame;
  const [mapWidth,mapHeight] = atlas.size;
  const occupied = [...obstacles];
  const markers = [], labels = [], positions = new Map();
  const requestPositions = new Map();
  let event = null;
  const unit = Math.min(1, width/760+.30);
  const symbolScale = unit * (world ? (detail < 2.2 ? .77 : 1) : .83+.12*Math.min(2, Math.log2(Math.max(1,detail))));

  function fits(box) {
    if (box.left < 4 || box.top < 4 || box.right > width-4 || box.bottom > height-4) return false;
    if (occupied.some(other => atlasRectsOverlap(box, other))) return false;
    const {margin} = atlas;
    return [[box.left,box.top], [box.left,box.bottom], [box.right,box.top], [box.right,box.bottom]].every(([x,y]) => {
      const [u,v] = frame.unproject(x,y);
      return u >= margin && u <= mapWidth-margin && v >= margin && v <= mapHeight-margin;
    });
  }

  for (const entry of entries) {
    if (!entry.mark || detail < (entry.markerMin ?? entry.min)) continue;
    let [x,y] = frame.project(entry.x,entry.y);
    let mark = entry.mark;
    let scale = mark === 'foreign-capital' ? symbolScale*Math.min(1,width/550+.14) : symbolScale;
    let box = markerBox(mark,x,y,scale);
    if (mark === 'regional-city' && !fits(box)) {
      scale *= .73;
      box = markerBox(mark,x,y,scale);
    }
    if (mark === 'foreign-capital' && !fits(box)) {
      scale *= .84;
      box = markerBox(mark,x,y,scale);
      if (!fits(box) && x>=4 && x<=width-4 && y>=4 && y<=height-4) {
        const offsets = [24,37,49].flatMap(distance=>
          [[0,-1],[1,0],[0,1],[-1,0],[.7,-.7],[.7,.7],[-.7,.7],[-.7,-.7]]
            .map(([dx,dy])=>[x+distance*dx,y+distance*dy]));
        const point = offsets.find(([u,v])=>fits(markerBox(mark,u,v,scale)));
        if (point) {
          [x,y] = point;
          box = markerBox(mark,x,y,scale);
        }
      }
    }
    if (mark !== 'home' && mark !== 'foreign-capital' && !fits(box)) {
      mark = 'dot';
      scale = symbolScale;
      box = markerBox(mark,x,y,scale);
    }
    if (!fits(box)) continue;
    const marker = {entry, mark, x, y, box, scale};
    markers.push(marker);
    occupied.push(box);
    positions.set(entry, marker);
    if (hasEvent && mark==='capital') {
      const centerY=box.top-20;
      const eventBox=rect(x,centerY,36,38);
      if (fits(eventBox)) {
        event={x,y:centerY};
        occupied.push(eventBox);
      }
    }
  }

  for(const request of requests){
    const entry=entries.find(row=>row.kind===request.kind&&row.name===request.name&&
      (row.kind!=='city'||row.code==='GBR'));
    if(!entry)continue;
    const [x,y]=frame.project(entry.x,entry.y);
    const marker=positions.get(entry);
    const anchor=marker?.box.top??y;
    const candidates=request.kind==='city'?
      [[x,anchor-18],[x+30,y],[x-30,y],[x,y+26]]:
      [[x,y],...(entry.slots??[]).map(([u,v])=>frame.project(u,v)),[x-24,y],[x+24,y],[x,y+24]];
    const point=candidates.find(([u,v])=>fits(rect(u,v,34,36)));
    if(point){
      const [u,v]=point;
      requestPositions.set(request.id,{x:u,y:v});
      occupied.push(rect(u,v,34,36));
    }
  }

  for (const entry of entries) {
    if (detail < entry.min || detail > (entry.max ?? Infinity)) continue;
    const marker = positions.get(entry);
    if (entry.mark && !marker) continue;
    const [x,y] = marker ? [marker.x,marker.y] : frame.project(entry.x,entry.y);
    const onScreen = (u,v) => u >= 0 && u <= width && v >= 0 && v <= height;
    const anchors = entry.slots?.flatMap(([u,v,w,h]) => {
      const [px,py] = frame.project(u,v);
      return onScreen(px,py) ? [{x:px,y:py,width:w*frame.scale,height:h*frame.scale}] : [];
    });
    if (anchors ? !anchors.length : !onScreen(x,y)) continue;
    const sizes = anchors ? [1,.87,.73,.59] : [1];
    const widthRoom = world ? 1.65 : entry.kind === 'region' ? 1.45 : 1.30;
    const heightRoom = world || entry.kind === 'region' ? 1.55 : 1.22;
    for (const proportion of sizes) {
      const style = atlasLabelText(entry, detail, proportion, world);
      const span = measure(style);
      const sag = style.arc ? Math.min(8, span*.045) : 0;
      const radians = Math.abs(style.angle)*Math.PI/180;
      const cos = Math.cos(radians), sin = Math.sin(radians);
      const textWidth = span+8;
      const textHeight = style.lineHeight*style.lines.length+7;
      const boxWidth = textWidth*cos+(textHeight+sag)*sin;
      const boxHeight = textWidth*sin+(textHeight+sag)*cos;
      let slots = anchors ? anchors
        .filter(point => textWidth <= point.width*widthRoom && textHeight <= point.height*heightRoom)
        .map(point => [point.x,point.y]) : [[x,y]];
      if (marker) {
        const {left,top,right,bottom} = marker.box;
        const sideY = (top+bottom)/2;
        const nextToRight = [right+boxWidth/2+1, sideY];
        const nextToLeft = [left-boxWidth/2-1, sideY];
        const below = [x,bottom+boxHeight/2+1];
        const above = [x,top-boxHeight/2-1];
        slots = entry.mark === 'capital' ? [below,nextToRight,nextToLeft,above] :
          [nextToRight,nextToLeft,below,above];
      }
      const place = slots.find(([px,py]) => fits(rect(px,py,boxWidth,boxHeight)));
      if (place) {
        const [px,py] = place;
        const box = rect(px,py,boxWidth,boxHeight);
        labels.push({entry, x:px, y:py, style, span, sag, box});
        occupied.push(box);
        break;
      }
    }
  }
  return {markers, labels, event, requestPositions};
}

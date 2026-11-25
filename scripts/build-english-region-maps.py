"""Draw English Codex map insets from the existing atlas geometry and labels."""
import json
import re
import subprocess
from io import BytesIO
from pathlib import Path
import xml.etree.ElementTree as ET

import cairosvg
from PIL import Image
from svgpathtools import parse_path

ROOT = Path(__file__).resolve().parents[1]
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
WIDTH, HEIGHT = 720, 432
TOP = 64

def tag(name):
    return f'{{{SVG}}}{name}'

def atlas_labels():
    source = """
import {DESK_ATLASES} from './src/desk-atlas-data.js';
import {CODEX_REGIONS} from './src/codex-locations.js';
import {UK_REGIONS_2000} from './src/uk-regional-calibration.js';
import en from './src/localization-en.js';
import {createTranslator} from './src/localization.js';
const translate = createTranslator(en);
const names = CODEX_REGIONS.map(({id,name}) => [id, translate(name)]);
const capitals = Object.fromEntries(UK_REGIONS_2000.map(region => [region.id,translate(region.city.name)]));
const keyCities = new Set(Object.values(capitals));
const cities = DESK_ATLASES.national.labels
  .filter(label => label.kind === 'city' && label.code === 'GBR')
  .map(({name,x,y,priority}) => ({name:translate(name),x,y,priority}))
  .filter(city => city.priority >= 80 || keyCities.has(city.name));
console.log(JSON.stringify({names,cities,capitals}));
"""
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',source],cwd=ROOT))

def svg_text(root, x, y, title, size, outlined=False):
    attributes = dict(x=str(round(x,1)), y=str(round(y,1)), fill='#241e16',
                      **{'font-family':'Georgia, DejaVu Serif, serif', 'font-size':str(size)})
    if outlined:
        outline = ET.SubElement(root,tag('text'),{**attributes,'stroke':'#f5e4ba','stroke-width':'4',
                                                   'stroke-linejoin':'round'})
        outline.text = title
    ET.SubElement(root,tag('text'),attributes).text = title

def render():
    atlas = ET.parse(ROOT/'assets/britain-play.svg').getroot()
    layout = atlas_labels()
    layers = [child for child in atlas if child.tag == tag('g') and child.get('clip-path')]
    definitions = atlas.find(tag('defs'))
    areas = {node.get('data-atlas-region'):node for node in atlas.iter(tag('path')) if node.get('data-atlas-region')}
    output = ROOT/'assets/codex-regions'
    for key, title in layout['names']:
        area = areas[key]
        x0,x1,y0,y1 = parse_path(area.get('d')).bbox()
        scale = min(WIDTH/max(106,(x1-x0)*1.28), (HEIGHT-TOP)/max(55,(y1-y0)*1.28))
        w,h = WIDTH/scale,(HEIGHT-TOP)/scale
        left,top=(x0+x1-w)/2,(y0+y1-h)/2
        svg = ET.Element(tag('svg'),{'viewBox':f'0 0 {WIDTH} {HEIGHT}', 'width':str(WIDTH),'height':str(HEIGHT)})
        ET.SubElement(svg,tag('rect'),{'width':str(WIDTH),'height':str(HEIGHT),'fill':'#c3b37e'})
        crop = ET.SubElement(svg,tag('svg'),{'y':str(TOP),'width':str(WIDTH),'height':str(HEIGHT-TOP),
                                           'viewBox':f'{left} {top} {w} {h}'})
        crop.append(definitions)
        for layer in layers:
            crop.append(layer)
        ET.SubElement(crop,tag('path'),{'d':area.get('d'),'fill':'#f8dd8d','fill-opacity':'.35',
                                       'stroke':'#604c24','stroke-width':str(3/scale)})
        placed = []
        for city in sorted(layout['cities'], key=lambda city:(city['name'] != layout['capitals'][key], -city['priority'])):
            if len(placed) == 5:
                break
            name = city['name'].strip()
            if not name or re.search('[А-Яа-яЁё]',name):
                continue
            name = name[0].upper() + name[1:]
            x,y = (city['x']-left)*scale, TOP + (city['y']-top)*scale
            length = max(38,len(name)*12)
            tx = x + 12 if x + 12 + length < WIDTH-14 else x - 12 - length
            box = (tx-8, y-22, tx+length+7, y+14)
            if not (28 < x < WIDTH-28 and TOP+28 < y < HEIGHT-17 and 10 < tx < WIDTH-25):
                continue
            if any(box[0]<a[2] and box[2]>a[0] and box[1]<a[3] and box[3]>a[1] for a in placed):
                continue
            ET.SubElement(svg,tag('circle'),{'cx':str(x),'cy':str(y),'r':'4.4','fill':'#241e16',
                                            'stroke':'#f8e7bd','stroke-width':'1.5'})
            svg_text(svg,tx,y+6,name,23,outlined=True)
            placed.append(box)
        ET.SubElement(svg,tag('path'),{'d':f'M0 {TOP}H{WIDTH}','stroke':'#655332','stroke-width':'2'})
        svg_text(svg,21,41,title,34)
        image = Image.open(BytesIO(cairosvg.svg2png(bytestring=ET.tostring(svg)))).convert('RGB')
        image.save(output/(key+'-en.webp'),'WEBP',quality=88,method=6)
        print(key,title,len(placed),flush=True)

if __name__ == '__main__':
    render()

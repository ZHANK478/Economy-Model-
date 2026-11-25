"""Natural Earth 1:110m, public domain. Overview geography, not simulation actors."""
import json,html
from pathlib import Path
r=Path(__file__).resolve().parents[1]
f=json.loads((r/'research/world-map-geography.json').read_text())['features']
colors=['#c5b477','#b1ba8a','#bf9988','#d3bb7d','#b29b9c','#9fac8c']
out=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 720"><rect width="1440" height="720" fill="#a1af98"/><g fill="none" stroke="#63765e" stroke-opacity=".18">']
for x in range(0,1441,120):out.append(f'<path d="M{x} 0V720"/>')
for y in range(0,721,120):out.append(f'<path d="M0 {y}H1440"/>')
out.append('</g>')
for i,a in enumerate(f):
 p=a['properties'];name=p['ADMIN'];g=a['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
 for poly in polys:
  d=''.join(' '.join(('M' if j==0 else 'L')+f'{(lon+180)*4:.1f},{(90-lat)*4:.1f}' for j,(lon,lat) in enumerate(ring))+'Z' for ring in poly)
  out.append(f'<path fill="{"#dfb857" if name=="United Kingdom" else colors[i%len(colors)]}" stroke="#6c664d" stroke-width=".65" fill-rule="evenodd" d="{d}"><title>{html.escape(name)}</title></path>')
for x,y,t in [(210,370,'ТИХИЙ ОКЕАН'),(545,350,'АТЛАНТИЧЕСКИЙ ОКЕАН'),(1020,530,'ИНДИЙСКИЙ ОКЕАН'),(360,180,'СЕВЕРНАЯ АМЕРИКА'),(820,390,'АФРИКА'),(1100,170,'АЗИЯ')]:out.append(f'<text x="{x}" y="{y}" text-anchor="middle" fill="#3d4c38" font-family="Georgia" font-size="10" letter-spacing="3">{t}</text>')
out.append('</svg>');(r/'assets/world-atlas.svg').write_text(''.join(out))

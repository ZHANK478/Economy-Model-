"""Build the menu atlas from Natural Earth 1:50m (public domain).
Geometry/projection/camera are independent of country lettering and palette.
"""
import json, math, html, base64
from fontTools.ttLib import TTFont
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def merc(lat):return math.log(math.tan(math.pi/4+math.radians(max(-80,min(80,lat)))/2))
def xy(lon,lat):return (lon+38)*25,100+(merc(64)-merc(lat))*1450
PALETTE={
'United Kingdom':'#dcba65','Ireland':'#a8b67c','France':'#cc8c70','Germany':'#b98993','Belgium':'#dfc174','Netherlands':'#afc18a','Luxembourg':'#a4b5ad',
'Norway':'#b5aa71','Sweden':'#ddc98a','Finland':'#a5b995','Denmark':'#b6c889','Iceland':'#b5ad89','Spain':'#d0ab68','Portugal':'#ab947a','Italy':'#b9ba8a',
'Switzerland':'#c5a77c','Austria':'#ba969a','Poland':'#d3af75','Czechia':'#9eaf85','Czech Republic':'#9eaf85','Slovakia':'#c0c18a','Hungary':'#c5b66d',
'Romania':'#d0a583','Bulgaria':'#adc88c','Greece':'#adab84','Croatia':'#9db4a3','Slovenia':'#c6bd92','Serbia':'#b99b7d','Bosnia and Herzegovina':'#b2b98b',
'Montenegro':'#a4a0ad','Albania':'#cbb17c','North Macedonia':'#c5a5a4','Kosovo':'#a0b2a7','Lithuania':'#c6bb86','Latvia':'#b69aad','Estonia':'#a3b9a8',
'Belarus':'#acbb88','Ukraine':'#ddbe70','Moldova':'#bc9b8d','Russia':'#bc9985','Turkey':'#bea173','Cyprus':'#b3b281','Malta':'#c5b075',
'Andorra':'#b2b987','Liechtenstein':'#b8c399','Monaco':'#aabb90','San Marino':'#b1a18d','Vatican':'#d4b273','Georgia':'#baa38c','Azerbaijan':'#abbb92','Armenia':'#bdac77'}
PALETTE.update({'Jersey':'#b7b985','Guernsey':'#c2ae7b','Isle of Man':'#bba66e','Tunisia':'#b9b17b','Syria':'#be9a7a','Republic of Serbia':'#b99b7d','Morocco':'#c2ad7d','Lebanon':'#a6b58a','Iraq':'#c6b17c','Iran':'#c2a291','Aland':'#a5b995','Greenland':'#b9b78e','Faroe Islands':'#aab28a','Northern Cyprus':'#c5b193','Algeria':'#d0ba86'})
features=json.loads((ROOT/'research/menu-map-geography.json').read_text())['features']
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="400 0 1600 900" role="img" aria-label="Политическая карта Европы"><defs><pattern id="grid" width="125" height="100" patternUnits="userSpaceOnUse"><path d="M125 0H0V100" fill="none" stroke="#617460" stroke-opacity=".14" stroke-width=".6"/></pattern><filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect x="-500" y="-500" width="3500" height="2500" fill="#a1af98"/><rect x="-500" y="-500" width="3500" height="2500" fill="url(#grid)"/>']
# Embed the licensed subset: SVG backgrounds cannot rely on page fonts.
font_css=''.join('@font-face{font-family:AtlasLettering;font-style:normal;font-weight:'+str(w)+';src:url(data:font/woff;base64,'+base64.b64encode((ROOT/f'assets/fonts/Atlas-{w}.woff').read_bytes()).decode()+') format("woff");}' for w in [500,650])
svg.append('<style>'+font_css+'</style>')
font=TTFont(ROOT/'assets/fonts/Atlas-650.woff');cmap=font.getBestCmap();metrics=font['hmtx'].metrics;upem=font['head'].unitsPerEm

def label_width(text,size,tracking):
 return sum(metrics[cmap[ord(c)]][0] for c in text)/upem*size+max(0,len(text)-1)*tracking

for f in features:
 n=f['properties']['ADMIN'];assert n in PALETTE,n
 svg.append(f'<g data-country="{html.escape(n)}" fill="{PALETTE[n]}" stroke="#685f47" stroke-width=".85" stroke-linejoin="round">')
 g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
 for poly in polys:
  rings=[]
  for ring in poly:
   rings.append(' '.join(('M' if i==0 else 'L')+f'{xy(lon,lat)[0]:.2f},{xy(lon,lat)[1]:.2f}' for i,(lon,lat) in enumerate(ring))+'Z')
  svg.append('<path fill-rule="evenodd" d="'+''.join(rings)+'"/>')
 svg.append('</g>')
# Each label has its own center, tracking, baseline arch and slight orientation.
# Country lettering is spaced geometric semibold, never stretched to a guessed width.
# lon, lat, text, font size, tracking, arch height, rotation
labels=[
 (-2.1,53.9,'ВЕЛИКОБРИТАНИЯ',10.5,3.15,3,-3),
 (-8.2,53.7,'ИРЛАНДИЯ',10.5,3.5,2,1),
 (2.5,46.7,'ФРАНЦИЯ',15,7,4,-2),
 (10.6,50.4,'ГЕРМАНИЯ',14,5.8,3,-2),
 (9.1,61.6,'НОРВЕГИЯ',11.5,3.5,4,-4),
 (16.5,61.2,'ШВЕЦИЯ',14,5.5,3,3),
 (26,64,'ФИНЛЯНДИЯ',11.5,3.5,2,2),
 (19,51.7,'ПОЛЬША',14,5,3,-2),
 (28.5,53.6,'БЕЛАРУСЬ',11.5,3.8,2,1),
 (31,49,'УКРАИНА',15,7,3,0),
 (25.2,57,'ЛАТВИЯ',9,2.7,1,0),
 (24,55.4,'ЛИТВА',9,2.5,1,0),
 (25.5,58.7,'ЭСТОНИЯ',9,2.3,1,0),
 (14.7,48.8,'ЧЕХИЯ',9.5,2.5,1,0),
 (10,47.1,'АВСТРИЯ',9,2.3,1,-2),
 (19.3,47.1,'ВЕНГРИЯ',9,2.5,1,0),
 (25,45.8,'РУМЫНИЯ',12,4,2,-2),
 (25,42.7,'БОЛГАРИЯ',10.5,2.8,1,0),
 (13,43,'ИТАЛИЯ',12,4.5,2,-5),
 (-3.5,40.5,'ИСПАНИЯ',14,6,4,2),
 (-8,39.5,'ПОРТУГАЛИЯ',8.5,1.8,1,-3),
 (37,59,'РОССИЯ',17,9,5,2),
 (35,39,'ТУРЦИЯ',13,5,2,0),
 (-18,64,'ИСЛАНДИЯ',10.5,3,2,-2),
 (5.7,53.05,'НИДЕРЛАНДЫ',8,1.8,1,0),
 (4.9,50.05,'БЕЛЬГИЯ',8,2,1,0),
 (10.1,56.4,'ДАНИЯ',9,2.5,1,0),
 (8.2,46.45,'ШВЕЙЦАРИЯ',7.5,1.7,1,0),
 (19.2,48.65,'СЛОВАКИЯ',8,1.8,1,0)
]
for i,(lon,lat,name,size,tracking,arch,angle) in enumerate(labels):
 x,y=xy(lon,lat);width=label_width(name,size,tracking)+24
 svg.append(f'<defs><path id="country-name-{i}" d="M{x-width/2:.1f},{y:.1f} Q{x:.1f},{y-2*arch:.1f} {x+width/2:.1f},{y:.1f}"/></defs><g transform="rotate({angle} {x:.1f} {y:.1f})"><text fill="#14180f" font-family="AtlasLettering" font-weight="650" font-size="{size}" letter-spacing="{tracking}" text-anchor="middle"><textPath href="#country-name-{i}" startOffset="50%">{name}</textPath></text></g>')
for lon,lat,name,dx,dy,anchor in [(-.12,51.5,'Лондон',7,4,'start'),(-3.19,55.95,'Эдинбург',7,-4,'start'),(-6.26,53.35,'Дублин',-7,9,'end'),(2.35,48.86,'Париж',7,4,'start'),(4.9,52.37,'Амстердам',-7,-9,'end'),(4.35,50.85,'Брюссель',-6,15,'end'),(10.75,59.91,'Осло',6,4,'start'),(18.07,59.33,'Стокгольм',7,4,'start'),(21.01,52.23,'Варшава',7,5,'start'),(13.4,52.52,'Берлин',-7,-7,'end'),(24.94,60.17,'Хельсинки',7,-7,'start')]:
 x,y=xy(lon,lat);svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.2" fill="#393c2a"/><text x="{x+dx:.1f}" y="{y+dy:.1f}" text-anchor="{anchor}" fill="#3c402d" font-family="Georgia,serif" font-size="11">{name}</text>')
# Seas use lighter, widely spaced sans capitals on two quiet horizontal lines.
# Deliberately distinct from the black country names and tiny serif city labels.
waters=[(-13.1,56.8,['АТЛАНТИЧЕСКИЙ','ОКЕАН'],9.5,3),
        (1.5,58.1,['СЕВЕРНОЕ','МОРЕ'],11,3.5),
        (18.5,56.4,['БАЛТИЙСКОЕ','МОРЕ'],9.5,2.7)]
for lon,lat,lines,size,tracking in waters:
 x,y=xy(lon,lat)
 svg.append(f'<text fill="#3b563d" font-family="AtlasLettering" font-weight="500" font-size="{size}" letter-spacing="{tracking}" text-anchor="middle">')
 for line_i,line in enumerate(lines):
  svg.append(f'<tspan x="{x:.1f}" y="{y+line_i*(size+7):.1f}">{line}</tspan>')
 svg.append('</text>')
svg.append('<rect x="400" y="0" width="1600" height="900" filter="url(#paper)" opacity=".055" style="mix-blend-mode:multiply"/></svg>')
(ROOT/'assets/menu-backdrop.svg').write_text(''.join(svg))
print(f'Built atlas: {len(features)} countries; every country has an explicit color; {len(labels)} curved horizontal names.')

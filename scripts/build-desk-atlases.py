"""Build both gameplay sheets from retained Natural Earth and ONS geometry.

Run from any directory with Python 3. The vectors and projected label/marker
coordinates are generated together from the retained geographic data.
"""
from collections import defaultdict
import json
import math
from pathlib import Path

from atlas_map_details import (
    COUNTRY_COLORS, COUNTRY_NAMES, LOCHS, NATIONAL_COUNTRY_CENTERS, NATIONAL_WATER,
    NEIGHBOR_INKS, REGION_CENTERS, REGION_COLORS, REGION_ITL_IDS, REGION_NAMES, RIVERS, SEA_LINKS,
    SECONDARY_ROADS, TRUNK_ROADS, WORLD_SEALS, WORLD_WATER,
)

ROOT = Path(__file__).resolve().parents[1]
NATIONAL_SIZE = (1440, 1000)
WORLD_SIZE = (1536, 790)
MARGIN = 39
TILT = {"national": (-14, .96), "world": (-10, .96)}
# Decorative traffic waypoints in longitude/latitude, in travel order.
TRAFFIC_ROUTES = {
    "national": {
        "ship": [
            [(-6.5, 49.55), (-4.85, 49.65), (-3.3, 49.77), (-2, 50.05), (-0.6, 50.27), (0.48, 50.57), (1.1, 50.81), (1.56, 51.08), (2.15, 51.38), (3.3, 51.87), (4, 52.48)],
            [(4.15, 52.9), (4.5, 53.8), (4.2, 54.8), (3.75, 55.85), (3.15, 56.9), (2.35, 57.9)],
            [(-8.1, 50.35), (-6.65, 51.1), (-6.0, 51.8), (-5.72, 52.35), (-5.32, 52.95), (-5.1, 53.52), (-5.25, 54.1)],
        ],
        "plane": [
            [(-0.46, 51.47), (1.8, 50.58), (4.2, 50.28), (6.8, 50.2), (8.57, 50.04)],
            [(4.77, 52.31), (2.01, 52.5), (-0.7, 53.05), (-3.3, 53.73), (-6.27, 53.42)],
            [(-3.37, 55.95), (-1.1, 54.55), (-0.25, 52.6), (0.65, 50.95), (2.55, 49.01)],
        ],
    },
    "world": {
        "ship": [
            [(-66, 39), (-59, 42), (-51, 44), (-40, 46.5), (-30, 47.5), (-20, 47), (-12, 46.5), (-8, 46)],
            [(147, 33), (153, 35), (160, 37), (168, 40), (176, 42)],
        ],
        "plane": [
            [(-74.17, 40.69), (-64, 46), (-53, 50), (-40, 53), (-27, 54.5), (-13, 54), (-0.46, 51.47)],
            [(103.99, 1.36), (109, 7), (115, 13), (123, 19), (130, 26), (139.78, 35.55)],
            [(151.17, -33.95), (145, -34.6), (138, -33), (129, -32), (115.97, -31.94)],
        ],
    },
}

PALETTE = ('#c6bf89', '#b7b47c', '#dcb878', '#bc9285', '#bcab79', '#ce986f', '#a3af80', '#b2aa96')

INKS = '''
<linearGradient id="paper" x2="0" y2="100%">
  <stop stop-color="#ead9a9"/><stop offset="1" stop-color="#d8bc87"/>
</linearGradient>
<linearGradient id="sea" x2="0" y2="100%">
  <stop stop-color="#b3bea0"/><stop offset="1" stop-color="#9aa98e"/>
</linearGradient>
<radialGradient id="ink-light" cx="59%" cy="25%" r="79%">
  <stop stop-color="#fff3be" stop-opacity=".22"/><stop offset=".67" stop-color="#fff3be" stop-opacity="0"/>
  <stop offset="1" stop-color="#513c19" stop-opacity=".15"/>
</radialGradient>
<linearGradient id="brass" x1="0" y1="0" x2=".78" y2="1" gradientUnits="objectBoundingBox">
  <stop stop-color="#fff2c6"/><stop offset=".26" stop-color="#dbc38b"/>
  <stop offset=".49" stop-color="#9c7544"/><stop offset=".69" stop-color="#f4d991"/>
  <stop offset="1" stop-color="#9d7649"/>
</linearGradient>
<linearGradient id="relief" x2="0" y2="100%">
  <stop stop-color="#bda778"/><stop offset="1" stop-color="#665134"/>
</linearGradient>
<filter id="piece-shadow" x="-50%" y="-80%" width="200%" height="260%">
  <feGaussianBlur stdDeviation="3.1"/>
</filter>
'''

def read_json(name):
    return json.loads((ROOT / 'research' / name).read_text())


def mercator_latitude(phi):
    return math.tan(math.pi / 4 + phi / 2)


# Lambert conformal conic with two standard parallels around the printed area.
phi1, phi2 = map(math.radians, (49, 61))
cone = math.log(math.cos(phi1) / math.cos(phi2)) / math.log(mercator_latitude(phi2) / mercator_latitude(phi1))
cone_scale = math.cos(phi1) * mercator_latitude(phi1) ** cone / cone
cone_origin = cone_scale / mercator_latitude(math.radians(54.3)) ** cone


def national_xy(lon, lat):
    radius = cone_scale / mercator_latitude(math.radians(max(-89, min(89, lat)))) ** cone
    angle = cone * math.radians(lon + 3.3)
    return 650 + 3840 * radius * math.sin(angle), 529 + 3840 * (radius * math.cos(angle) - cone_origin)


def world_xy(lon, lat):
    # Equal Earth, spherical forward projection (Šavrič, Patterson, Jenny).
    a1, a2, a3, a4 = 1.340264, -.081106, .000893, .003796
    theta = math.asin(math.sqrt(3) / 2 * math.sin(math.radians(lat)))
    derivative = a1 + 3 * a2 * theta**2 + 7 * a3 * theta**6 + 9 * a4 * theta**8
    x = 2 * math.sqrt(3) * math.radians(lon) * math.cos(theta) / (3 * derivative)
    y = a1 * theta + a2 * theta**3 + a3 * theta**7 + a4 * theta**9
    return 768 + 266 * x, 396 - 266 * y


def path(points, close=False):
    rounded = [(round(x, 2), round(y, 2)) for x, y in points]
    unique = [f'{x:g},{y:g}' for i, (x, y) in enumerate(rounded) if i == 0 or (x, y) != rounded[i-1]]
    return 'M' + ' '.join(unique) + ('Z' if close else '')


def polygons(feature):
    geometry = feature['geometry']
    return geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]


def feature_path(feature, xy, size):
    width, height = size
    rings = []
    for polygon in polygons(feature):
        exterior = [xy(*p) for p in polygon[0]]
        xs, ys = zip(*exterior)
        if max(xs) < 0 or min(xs) > width or max(ys) < 0 or min(ys) > height:
            continue
        rings.append(path(exterior, True))
        rings.extend(path((xy(*p) for p in ring), True) for ring in polygon[1:])
    return ''.join(rings)


def border_colors(features):
    # Prefer different inks on shared land borders.
    colors = dict(COUNTRY_COLORS)
    points = defaultdict(set)
    for feature in features:
        name = feature['properties']['ADMIN']
        for polygon in polygons(feature):
            for point in polygon[0]:
                points[tuple(point)].add(name)
    neighbors = defaultdict(set)
    for names in points.values():
        for name in names:
            neighbors[name].update(names - {name})
    for feature in features:
        name = feature['properties']['ADMIN']
        if name not in colors:
            used = {colors[n] for n in neighbors[name] if n in colors}
            first = sum(map(ord, name)) % len(PALETTE)
            choices = PALETTE[first:] + PALETTE[:first]
            colors[name] = next((color for color in choices if color not in used), choices[0])
    return colors


def blend(source, target, ratio):
    channels = [round((1 - ratio) * int(source[i:i+2], 16) + ratio * int(target[i:i+2], 16))
                for i in (1, 3, 5)]
    return '#' + ''.join(f'{c:02x}' for c in channels)


def countries(features, xy, size, national=False, ireland=None):
    colors = border_colors(features)
    shapes, definitions, edges = [], [], []
    for index, feature in enumerate(features):
        name = feature['properties']['ADMIN']
        shape = ireland if ireland and name == 'Ireland' else feature_path(feature, xy, size)
        if not shape:
            continue
        color = colors[name]
        code = feature['properties']['ADM0_A3']
        if national:
            ident = f'neighbor-{index}'
            fill = blend(color, '#cbc9b5', .69)
            ink = NEIGHBOR_INKS.get(name, blend(color, '#493d2a', .54))
            definitions.extend([f'<path id="{ident}" d="{shape}" fill-rule="evenodd" vector-effect="non-scaling-stroke"/>',
                                f'<clipPath id="clip-{ident}"><use href="#{ident}" clip-rule="evenodd"/></clipPath>'])
            shapes.append(f'<use href="#{ident}" fill="{fill}" data-country="{code}"/>')
            edges.append(f'<use href="#{ident}" fill="none" stroke="{ink}" stroke-width="2.9" clip-path="url(#clip-{ident})"/>')
        else:
            width = '.335' if code == 'GBR' else '.67'
            shapes.append(f'<path d="{shape}" fill="{color}" stroke="#685740" stroke-width="{width}" '
                          f'vector-effect="non-scaling-stroke" data-country="{code}"/>')
    return '<g fill-rule="evenodd" stroke-linejoin="round"><defs>' + ''.join(definitions) + '</defs>' + ''.join(shapes + edges) + '</g>'


def simplify_arc(points, tolerance=.48):
    """Keep topology vertices shared between the regional and national lines."""
    if len(points) < 4:
        return points
    keep = {0, len(points) - 1}
    spans = [(0, len(points) - 1)]
    while spans:
        start, end = spans.pop()
        ax, ay = points[start]
        bx, by = points[end]
        dx, dy = bx - ax, by - ay
        length_squared = dx * dx + dy * dy
        distance_limit, split = tolerance ** 2, None
        for i in range(start + 1, end):
            x, y = points[i][0] - ax, points[i][1] - ay
            u = max(0, min(1, (x * dx + y * dy) / length_squared)) if length_squared else 0
            distance = (x - u * dx) ** 2 + (y - u * dy) ** 2
            if distance > distance_limit:
                distance_limit, split = distance, i
        if split is not None:
            keep.add(split)
            spans.extend(((start, split), (split, end)))
    if points[0] == points[-1] and len(keep) < 4:
        return points
    return [points[i] for i in sorted(keep)]


def uk_topology():
    source = read_json('uk-display-topology.json')
    scale, translate = source['transform']['scale'], source['transform']['translate']
    arcs = []
    for arc in source['arcs']:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append(national_xy(x * scale[0] + translate[0], y * scale[1] + translate[1]))
        arcs.append(simplify_arc(points, .12))

    def shape(geometry):
        geometry_arcs = geometry['arcs']
        polys = geometry_arcs if geometry['type'] == 'MultiPolygon' else [geometry_arcs]
        return [[[
            point for index in ring for point in (arcs[index] if index >= 0 else reversed(arcs[~index]))
        ] for ring in polygon] for polygon in polys]

    regions = {g['properties']['areacd']: shape(g) for g in source['objects']['rgn']['geometries']}
    constituents = {g['properties']['areacd']: shape(g) for g in source['objects']['ctry']['geometries']}
    return regions, constituents, shape(source['objects']['uk']['geometries'][0])


def shape_path(polys):
    return ''.join(path(ring, True) for polygon in polys for ring in polygon)


def irish_frontier(features, ni_polygons):
    """Stitch the two source layers along the same Northern Ireland land edge."""
    ireland = next(f for f in features if f['properties']['ADMIN'] == 'Ireland')
    britain = next(f for f in features if f['properties']['ADMIN'] == 'United Kingdom')
    uk_points = {tuple(point) for p in polygons(britain) for point in p[0]}
    main = max(polygons(ireland), key=lambda p: len(p[0]))
    coast = main[0][:-1]
    start = next(i for i, p in enumerate(coast) if tuple(p) in uk_points and tuple(coast[i-1]) not in uk_points)
    coast = coast[start:] + coast[:start]
    end = next(i for i, p in enumerate(coast) if tuple(p) not in uk_points)
    joint = [national_xy(*p) for p in coast[:end]]
    ni_ring = max((p[0] for p in ni_polygons), key=len)[:-1]

    def distance(p, q):
        return (p[0]-q[0])**2 + (p[1]-q[1])**2

    first = min(range(len(ni_ring)), key=lambda i: distance(ni_ring[i], joint[0]))
    last = min(range(len(ni_ring)), key=lambda i: distance(ni_ring[i], joint[-1]))
    assert distance(ni_ring[first], joint[0]) < 16 and distance(ni_ring[last], joint[-1]) < 16
    low, high = sorted((first, last))
    arcs = [ni_ring[low:high+1], ni_ring[high:] + ni_ring[:low+1]]
    samples = joint[::max(1, len(joint)//16)]
    shared = min(arcs, key=lambda arc: sum(min(distance(p, q) for q in arc) for p in samples))
    if distance(shared[-1], joint[0]) < distance(shared[0], joint[0]):
        shared.reverse()
    new_main = [shared + [national_xy(*p) for p in coast[end:]]]
    new_main.extend([national_xy(*p) for p in ring] for ring in main[1:])
    other = [[[national_xy(*p) for p in ring] for ring in polygon]
             for polygon in polygons(ireland) if polygon is not main]
    return shape_path([new_main] + other), path(shared)


def grid(xy, meridians, parallels, lon_min, lon_max, lat_min, lat_max, step):
    paths = [path(xy(lon, lat) for lat in range(lat_min, lat_max + 1, step)) for lon in meridians]
    paths.extend(path(xy(lon, lat) for lon in range(lon_min, lon_max + 1, step)) for lat in parallels)
    return '<path d="' + ''.join(paths) + '" fill="none" stroke="#536552" stroke-opacity=".32" stroke-width=".65" vector-effect="non-scaling-stroke"/>'


def sheet_start(size, title, fittings):
    width, height = size
    rect = f'x="{MARGIN}" y="{MARGIN}" width="{width - 2*MARGIN}" height="{height - 2*MARGIN}"'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">'
            f'<title>{title}</title><defs>{INKS}{fittings}'
            f'<clipPath id="print"><rect {rect}/></clipPath></defs>'
            f'<rect x="1" y="7" width="{width}" height="{height}" fill="#25180e" opacity=".34"/>'
            f'<rect y="3" width="{width}" height="{height}" fill="#aa8d59"/>'
            f'<rect width="{width}" height="{height}" fill="url(#paper)"/>'
            f'<g clip-path="url(#print)"><rect {rect} fill="url(#sea)"/>')


def sheet_end(size, columns, rows, imprint):
    width, height = size
    marks = []
    for i, letter in enumerate(columns):
        x = MARGIN + (i + .5) * (width - 2*MARGIN) / len(columns)
        marks.append(f'<text x="{x:.1f}" y="23" text-anchor="middle">{letter}</text>')
    for i in range(rows):
        y = MARGIN + (i + .5) * (height - 2*MARGIN) / rows
        marks.append(f'<text x="18" y="{y:.1f}" text-anchor="middle">{i+1}</text>')
    return (
        f'<rect width="{width}" height="{height}" fill="url(#ink-light)"/></g>'
        f'<rect x="29" y="29" width="{width-58}" height="{height-58}" fill="none" stroke="#44341e" stroke-width="2.4"/>'
        f'<rect x="36" y="36" width="{width-72}" height="{height-72}" fill="none" stroke="#5d4c2f" stroke-width="1"/>'
        f'<g fill="#40321e" font-family="Georgia, serif" font-size="12">{"".join(marks)}</g>'
        f'<text fill="#55462d" font-family="Georgia, serif" font-size="12" letter-spacing="1" x="40" y="{height-11}">{imprint}</text></svg>'
    )


STAR = '<path d="M0-3.3.9-1.1 3.2-1 1.5.6 2.1 3 0 1.6-2.1 3-1.5.6-3.2-1-.9-1.1Z"/>'


def block(x, y, width, depth, height):
    """An isometric building with the same light direction as the plinth."""
    far_x, far_y = x + depth * .68, y - depth * .53
    right, top, back_top = x + width, y - height, far_y - height
    return (
        f'<path fill="#c5ae7d" d="M{x:g},{y:g}H{right:g}V{top:g}H{x:g}Z"/>'
        f'<path fill="#725c3d" d="M{right:g},{y:g} {far_x+width:g},{far_y:g} '
        f'{far_x+width:g},{back_top:g} {right:g},{top:g}Z"/>'
        f'<path fill="#efe1b5" d="M{x:g},{top:g}H{right:g}L{far_x+width:g},{back_top:g}H{far_x:g}Z"/>'
    )


def miniatures():
    pieces = ['''
<g id="plinth">
  <ellipse cx="-3" cy="7" rx="19" ry="9.7" fill="#302a1e" opacity=".68" filter="url(#piece-shadow)"/>
  <ellipse cy="3.7" rx="17.7" ry="10.7" fill="#493923" stroke="#776344" stroke-width="1"/>
  <ellipse cy="1.5" rx="17.6" ry="10.4" fill="url(#brass)" stroke="#5b462d" stroke-width=".75"/>
  <ellipse rx="16.3" ry="9.5" fill="url(#brass)" stroke="#f9e8b6" stroke-width=".9"/>
  <ellipse rx="13.3" ry="7.1" fill="#6f5938" stroke="#8c7043" stroke-width=".8"/>
  <path d="M-13.5 3.5Q-5 13 10 6.1" fill="none" stroke="#f7e6ae" stroke-width=".8"/>
</g>
''']
    for name, scale, buildings, trim in [
        ('town', .9, [(-13, 0, 7, 6, 6), (0, 0, 8, 7, 11), (-6, 4, 8, 7, 8), (3, 5, 7, 5, 5)],
         '<path d="M-3 .8h1.1m2 0h1.1M6-7v3M8-7v3" fill="none" stroke="#5b4932" stroke-width=".9"/>'),
        ('civic', 1.04, [(-13, 1, 7, 7, 7), (-6, 2, 14, 8, 9), (-2, 4, 6, 7, 15), (7, 3, 4, 6, 7)],
         '<path d="M-3-11 1.5-16 6-11Z" fill="#e6d5a9"/><path d="M-.5-7v4m2-4v4m2-4v4" fill="none" stroke="#4f402b" stroke-width=".65" vector-effect="non-scaling-stroke"/>'),
        ('capital', 1.43, [(-13, 1, 9, 7, 8), (-11, 4, 19, 7, 9), (-7, 3, 4, 6, 14), (6, 1, 5.8, 4.2, 18)],
         '<path d="M6-17 10-25 14-19 11.8-17Z" fill="#e7d5a3"/><circle cx="8.9" cy="-13.8" r="1.55" fill="#f6e6b3"/><path d="M-9-1v3m3-3v3m3-3v3m3-3v3m3-3v3" fill="none" stroke="#615039" stroke-width="1"/>'),
    ]:
        pieces.append(f'<g id="{name}" transform="scale({scale})"><use href="#plinth"/>'
                      '<g stroke="#544229" stroke-width=".5" stroke-linejoin="round">'
                      + ''.join(block(*building) for building in buildings) + trim + '</g></g>')
    return ''.join(pieces)


def generalized_lines(lines):
    return ''.join(path(national_xy(*p) for p in line) for line in lines)


def national_network():
    secondary = generalized_lines(SECONDARY_ROADS)
    trunk = generalized_lines(TRUNK_ROADS)
    rivers = generalized_lines(RIVERS)
    lochs = ''.join(path((national_xy(*p) for p in polygon), True) for polygon in LOCHS)
    sea_links = []
    for start, end, bend in SEA_LINKS:
        a, b = national_xy(*start), national_xy(*end)
        sea_links.append(f'M{a[0]:.1f},{a[1]:.1f}Q{(a[0]+b[0])/2:.1f},{(a[1]+b[1])/2+bend:.1f} {b[0]:.1f},{b[1]:.1f}')
    return (
        f'<path d="{"".join(sea_links)}" fill="none" stroke="#58624d" stroke-width="1" vector-effect="non-scaling-stroke" '
        f'stroke-dasharray="1 5" stroke-linecap="round" opacity=".69"/>'
        f'<path d="{lochs}" fill="#91aa90" stroke="#5e8070" stroke-width=".58" vector-effect="non-scaling-stroke"/>'
        f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">'
        f'<path d="{rivers}" stroke="#557d69" stroke-width="1.6" vector-effect="non-scaling-stroke"/>'
        f'<path d="{rivers}" stroke="#8db4a1" stroke-width=".78" vector-effect="non-scaling-stroke"/>'
        f'<path d="{secondary}" stroke="#695237" stroke-width="1.45" vector-effect="non-scaling-stroke"/>'
        f'<path d="{secondary}" stroke="#ecd6a0" stroke-width=".58" vector-effect="non-scaling-stroke"/>'
        f'<path d="{trunk}" stroke="#edc486" stroke-width="2.55" vector-effect="non-scaling-stroke"/>'
        f'<path d="{trunk}" stroke="#913d26" stroke-width="1.38" vector-effect="non-scaling-stroke"/>'
        f'</g>'
    )


def national_sheet(features, regions, constituents, outline):
    ireland, frontier = irish_frontier(features, constituents['N92000002'])
    neighbors = [f for f in features if f['properties']['ADMIN'] != 'United Kingdom']
    out = [sheet_start(NATIONAL_SIZE, 'Британские острова и соседние страны', miniatures()),
           countries(neighbors, national_xy, NATIONAL_SIZE, national=True, ireland=ireland),
           f'<path d="{frontier}" fill="none" stroke="{NEIGHBOR_INKS["Ireland"]}" stroke-width="2.4" '
           'vector-effect="non-scaling-stroke" data-irish-frontier="true"/>',
           '<g fill-rule="evenodd" stroke="#736344" stroke-width=".34" stroke-linejoin="round">']
    out.extend(f'<path fill="{REGION_COLORS[code]}" d="{shape_path(region)}" vector-effect="non-scaling-stroke" data-atlas-region="{REGION_ITL_IDS[code]}"/>'
               for code, region in regions.items())
    out.extend(['</g>',
                grid(national_xy, range(-24, 25, 4), range(46, 67, 2), -28, 30, 45, 68, 1),
                national_network(),
                f'<path d="{shape_path(outline)}" fill="none" stroke="#191816" stroke-width=".825" '
                'stroke-linejoin="round" vector-effect="non-scaling-stroke" data-uk-outline="true"/>',
                sheet_end(NATIONAL_SIZE, 'ABCDEF', 5, 'ЛИСТ I · БРИТАНСКИЕ ОСТРОВА')])
    return ''.join(out)


SEAL_INSETS = {
    'usa': '<circle r="12" fill="#dbcba3"/><path d="M-11-5h22M-12 0h24M-11 5h22M-8 9H8" stroke="#a2503c" stroke-width="2.4"/><path d="M-11 .5Q-12-7-7-10h8V.5Z" fill="#4e6272"/>',
    'brazil': '<circle r="12" fill="#4d7356"/><path d="M-10 0 0-7.5 10 0 0 7.5Z" fill="#ddbd68"/><circle r="4.3" fill="#365069"/><path d="m-3.9-1.4 7.8 2.8" stroke="#e5d8ab" stroke-width="1"/>',
    'russia': '<circle r="12" fill="#dccea8"/><path d="M-11.3-3.8h22.6a12 12 0 0 1 0 7.6h-22.6a12 12 0 0 1 0-7.6Z" fill="#4f6880"/><path d="M-11.3 3.8h22.6a12 12 0 0 1-22.6 0Z" fill="#a55140"/>',
    'india': '<circle r="12" fill="#e6d5ad"/><path d="M-11.3-4a12 12 0 0 1 22.6 0Z" fill="#d5964f"/><path d="M-11.3 4h22.6a12 12 0 0 1-22.6 0Z" fill="#587c5d"/><circle r="3.4" fill="none" stroke="#3e536c" stroke-width="1.2"/><path d="M-3 0h6M0-3v6m-2-5 4 4m-4 0 4-4" stroke="#3e536c" stroke-width=".65"/>',
    'china': f'<circle r="12" fill="#a34b3b"/><g fill="#e5c579" transform="translate(-3 -2) scale(1.7)">{STAR}</g><path d="M4-6v2m3 0v2m.5 2v2M4 3v2" stroke="#e5c579" stroke-width="1.4"/>',
    'australia': f'<circle r="12" fill="#41586e"/><path d="m-9-5 9 6m-7-9 7 0m-5-1v10" stroke="#d5c5a7" stroke-width="1.3"/><g fill="#eee0b6" transform="translate(5 3) scale(.65)">{STAR}</g><g fill="#eee0b6" transform="translate(-4 6) scale(.68)">{STAR}</g>',
}


def world_seals():
    return ''.join(
        f'<g id="seal-{name}"><ellipse cx="-2" cy="4" rx="14" ry="12" fill="#292216" opacity=".5" filter="url(#piece-shadow)"/>'
        '<circle cy="2" r="13.9" fill="#57452a"/>'
        '<circle r="13.8" fill="url(#brass)" stroke="#5d482d" stroke-width="1.1"/>'
        '<circle r="11.9" fill="none" stroke="#f1d9a4" stroke-width=".8"/>'
        f'<g transform="scale(.82)">{inset}</g></g>'
        for name, inset in SEAL_INSETS.items()
    )


def world_sheet(features):
    return ''.join([sheet_start(WORLD_SIZE, 'Политическая карта мира', world_seals()),
                    countries(features, world_xy, WORLD_SIZE),
                    grid(world_xy, range(-180, 181, 30), range(-60, 61, 30), -180, 180, -90, 90, 2),
                    sheet_end(WORLD_SIZE, 'ABCDEFGH', 4, 'ЛИСТ II · ПОЛИТИЧЕСКАЯ КАРТА МИРА')])


def bounds(ring):
    xs, ys = zip(*ring)
    return min(xs), min(ys), max(xs), max(ys)


def contains(ring, point):
    x, y = point
    inside = False
    for (a, b), (c, d) in zip(ring, ring[1:]):
        if (b > y) != (d > y) and x < (c - a) * (y - b) / (d - b) + a:
            inside = not inside
    return inside


def interior_point(polys, preferred):
    if any(contains(p[0], preferred) and not any(contains(h, preferred) for h in p[1:]) for p in polys):
        return preferred
    largest = max(polys, key=lambda p: abs(sum(x1*y2-x2*y1 for (x1,y1),(x2,y2) in zip(p[0],p[0][1:]))))
    x1, y1, x2, y2 = bounds(largest[0])
    center = ((x1+x2)/2, (y1+y2)/2)
    # Use the nearest interior sample to the center for off-land source anchors.
    candidates = [((x1+(x2-x1)*(i+.5)/9), (y1+(y2-y1)*(j+.5)/9))
                  for i in range(9) for j in range(9)]
    usable = [p for p in candidates if contains(largest[0], p) and not any(contains(h, p) for h in largest[1:])]
    return min(usable, key=lambda p: (p[0]-center[0])**2+(p[1]-center[1])**2) if usable else preferred


def label(name, point, kind, min_zoom, size, priority, **options):
    return {'name': name, 'x': round(point[0], 2), 'y': round(point[1], 2), 'kind': kind,
            'min': min_zoom, 'size': size, 'priority': priority, **options}


def country_slots(polys, preferred, national):
    """Find interior slots with space for upright typography on the tilted sheet."""
    angle, squash = TILT['national' if national else 'world']
    cos, sin = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    sheet_width, sheet_height = NATIONAL_SIZE if national else WORLD_SIZE

    def rotate(x, y):
        return cos*x-sin*y, squash*(sin*x+cos*y)

    def unrotate(x, y):
        return cos*x+sin*y/squash, -sin*x+cos*y/squash

    def inner_span(rings, x, y):
        crossings = sorted((c-a)*(y-b)/(d-b)+a
                           for ring in rings for (a,b),(c,d) in zip(ring,ring[1:])
                           if (b>y) != (d>y))
        for left, right in zip(crossings[::2], crossings[1::2]):
            if left < x < right:
                return 2*min(x-left, right-x)
        return 0

    def area(poly):
        return abs(sum(x1*y2-x2*y1 for (x1,y1),(x2,y2) in zip(poly[0],poly[0][1:])))

    primary = rotate(*preferred)
    alternatives = []
    first = None
    for poly in sorted(polys,key=area,reverse=True)[:2]:
        rings = [[rotate(*p) for p in simplify_arc(ring,.14)] for ring in poly]
        vertical = [[(y,x) for x,y in ring] for ring in rings]
        x1,y1,x2,y2 = bounds(rings[0])
        candidates = [primary] + [(x1+(i+.5)*(x2-x1)/7,y1+(j+.5)*(y2-y1)/7) for i in range(7) for j in range(7)]
        for screen_x,screen_y in candidates:
            x,y = unrotate(screen_x,screen_y)
            if not (MARGIN < x < sheet_width-MARGIN and MARGIN < y < sheet_height-MARGIN):
                continue
            width = inner_span(rings,screen_x,screen_y)
            height = inner_span(vertical,screen_y,screen_x)
            if not width or not height:
                continue
            slot = [round(x,2),round(y,2),round(width*.83,2),round(height*.8,2)]
            if (screen_x,screen_y) == primary:
                first = slot
            else:
                alternatives.append((min(width/3.2,height),slot))
    slots = [first] if first else []
    for _, candidate in sorted(alternatives, key=lambda item: -item[0]):
        separation = min(50, max(1, min(candidate[2],candidate[3])*.62))
        if all(math.hypot(other[0]-candidate[0], other[1]-candidate[1]) >= separation for other in slots):
            slots.append(candidate)
        if len(slots) >= 6:
            break
    return slots


def country_labels(features, national=False):
    xy = national_xy if national else world_xy
    for f in features:
        p = f['properties']
        code = p['ADM0_A3']
        if national and code not in NATIONAL_COUNTRY_CENTERS:
            continue
        name = COUNTRY_NAMES.get(code) or p['NAME_RU'] or p['ADMIN']
        lon, lat = NATIONAL_COUNTRY_CENTERS[code] if national else (p['LABEL_X'], p['LABEL_Y'])
        territory = [[[xy(*q) for q in ring] for ring in poly] for poly in polygons(f)]
        point = interior_point(territory, xy(lon, max(-90, min(90, lat))))
        if national:
            min_zoom, size, priority = (.66, 16, 75) if code in ('IRL', 'FRA', 'DEU') else (.85, 13, 70)
        else:
            rank = max(1.5, p['MIN_LABEL'])
            min_zoom = round(1 + (rank-1.7)**2 * .66, 2) if rank > 1.7 else 1
            size = 18 if rank <= 1.8 else 14.5 if rank <= 3 else 12
            priority = 110 - rank*7
        slots = country_slots(territory, point, national)
        if slots:
            yield label(name, point, 'country', min_zoom, size, priority, slots=slots)


def region_labels(regions, constituents):
    for code, name in REGION_NAMES.items():
        main = code in constituents
        shape = constituents[code] if main else regions[code]
        point = interior_point(shape, national_xy(*REGION_CENTERS[code]))
        zoom = 0 if main else 1.36 if code != 'E12000007' else 2.65
        options = {'max': 1.66} if code == 'E92000001' else {}
        slots = country_slots(shape, point, True)
        if slots and code != 'N92000002':
            options['slots'] = slots
        size = 11.5 if code == 'N92000002' else 18 if main else 13.8
        yield label(name, point, 'region', zoom, size, 106 if main else 87, **options)


def city_labels(places, national=False):
    xy = national_xy if national else world_xy
    big_uk = {'Aberdeen', 'Birmingham', 'Bristol', 'Glasgow', 'Inverness',
              'Leeds', 'Liverpool', 'Manchester', 'Newcastle', 'Norwich', 'Plymouth'}
    for name, lon, lat, country, original, feature, population in places:
        capital = feature == 'Admin-0 capital'
        opts = {}
        if national:
            if original == 'London':
                kind, zoom, size, priority = 'capital', 0, 17, 110
            elif country == 'GBR' and feature == 'Admin-0 region capital':
                kind, zoom, size, priority = 'civic', .76, 14, 103
            elif country == 'GBR' and original in big_uk:
                kind, zoom, size, priority = 'town', .91, 13.8, 92 + min(6, population/500000)
            elif capital:
                kind, zoom, size, priority = 'star', .84, 13.4, 80
            else:
                kind, zoom, size, priority = 'dot', 1.22 if population >= 220000 else 1.9 if population >= 65000 else 2.55, 12.6, 48 + min(19, population/32000)
        elif capital and country in WORLD_SEALS:
            kind, zoom, size, priority = f'seal-{WORLD_SEALS[country]}', 1.95, 13.7, 99
            opts['markerMin'] = 1
        elif capital and country == 'GBR':
            kind, zoom, size, priority = 'home', 1.8, 14.5, 110
            opts['markerMin'] = 1
        elif capital:
            kind, zoom, size, priority = 'star', 2.15 if population >= 1200000 else 3.1, 13, 63 + min(22, population/1100000)
        else:
            kind, zoom, size, priority = 'dot', 5.3, 12, 48 + min(10, population/1700000)
        yield label(name, xy(lon, lat), 'city', zoom, size, round(priority, 1),
                    mark=kind, code=country, **opts)


def water_labels(entries, xy):
    return [label(name, xy(lon, lat), 'water', zoom, size, 35 if size < 15 else 53)
            for lon, lat, name, zoom, size in entries]


def main():
    local = read_json('desk-britain-geography.json')['features']
    world = read_json('desk-world-geography.json')['features']
    places = read_json('desk-atlas-places.json')
    regions, constituents, outline = uk_topology()
    (ROOT / 'assets/britain-play.svg').write_text(national_sheet(local, regions, constituents, outline), encoding='utf-8')
    (ROOT / 'assets/world-desk.svg').write_text(world_sheet(world), encoding='utf-8')
    atlases = {
        'national': {'asset': 'britain-play.svg', 'size': NATIONAL_SIZE, 'margin': MARGIN,
                     'focus': [858.6332270572871, 639.1859133640905], 'tilt': TILT['national'],
                     'labels': [*region_labels(regions, constituents), *country_labels(local, national=True),
                                *city_labels(places['national'], national=True), *water_labels(NATIONAL_WATER, national_xy)]},
        'world': {'asset': 'world-desk.svg', 'size': WORLD_SIZE, 'margin': MARGIN,
                  'focus': [WORLD_SIZE[0]/2, WORLD_SIZE[1]/2], 'tilt': TILT['world'],
                  'labels': [*country_labels(world), *city_labels(places['world']), *water_labels(WORLD_WATER, world_xy)]},
    }
    out = ['// Generated by scripts/build-desk-atlases.py. Points share each sheet’s geographic projection.',
           'export const DESK_ATLASES = {']
    for mode, atlas in atlases.items():
        labels = atlas.pop('labels')
        project = national_xy if mode == 'national' else world_xy
        atlas['traffic'] = {
            kind: [[[round(axis, 2) for axis in project(*point)] for point in route]
                   for route in paths]
            for kind, paths in TRAFFIC_ROUTES[mode].items()
        }
        out.append(f'  {mode}: {{')
        out.extend(f'    {key}: {json.dumps(val, ensure_ascii=False)},' for key, val in atlas.items())
        out.append('    labels: [')
        out.extend('      '+json.dumps(entry, ensure_ascii=False, separators=(',', ':'))+',' for entry in labels)
        out.extend(['    ],', '  },'])
    out.extend(['};', ''])
    (ROOT / 'src/desk-atlas-data.js').write_text(chr(10).join(out), encoding='utf-8')


if __name__ == '__main__':
    main()

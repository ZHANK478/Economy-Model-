"""Generate the wardrobe extension and optionally export its static GLB bust garments."""
import argparse
import base64
import copy
import gzip
import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'leader-editor' / 'assets' / 'rig3d'
SOURCE = json.loads(gzip.decompress((ROOT / 'portrait-v2.json.gz').read_bytes()))['meshes']


def vectors(record, field):
    return list(struct.iter_unpack('<3f', base64.b64decode(record[field])))


def indices(group):
    data = base64.b64decode(group['indices'])
    return struct.unpack('<' + 'H' * (len(data) // 2), data)


def encode(kind, values):
    return base64.b64encode(struct.pack('<' + kind * len(values), *values)).decode()


def select(style, *extra):
    return [copy.deepcopy(mesh) for mesh in SOURCE if mesh['variant'] == ['suitStyle', style]] + list(extra)


JACKET = next(mesh for mesh in SOURCE if mesh['name'] == 'Tailored jacket')
NECKBAND = next(mesh for mesh in SOURCE if mesh['name'] == 'Shirt neckband')
TORSO = vectors(JACKET, 'positions')
TRIANGLES = [tuple(TORSO[i] for i in tri) for tri in
             struct.iter_unpack('<3H', base64.b64decode(JACKET['groups'][0]['indices']))]
PROFILE = list(struct.iter_unpack('<3h', base64.b64decode(JACKET['morphs']['6'][0])))
PROFILE_MAP = dict(zip(TORSO, PROFILE))


def front(x, z):
    """Project accessories onto the existing jacket facing the camera."""
    result = None
    for a, b, c in TRIANGLES:
        if not min(a[0], b[0], c[0]) <= x <= max(a[0], b[0], c[0]):
            continue
        if not min(a[2], b[2], c[2]) <= z <= max(a[2], b[2], c[2]):
            continue
        det = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
        if abs(det) < 1e-8:
            continue
        u = ((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det
        v = ((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det
        w = 1-u-v
        if min(u, v, w) < -1e-5:
            continue
        y = u*a[1]+v*b[1]+w*c[1]
        if result is None or y < result[0]:
            delta = [round(u*pa+v*pb+w*pc) for pa, pb, pc in
                     zip(PROFILE_MAP[a], PROFILE_MAP[b], PROFILE_MAP[c])]
            result = (y, delta)
    return result


def surface(name, points, tris, color, role=None, spec=.04, lift=.025):
    samples = [front(x, z) for x, z in points]
    positions = [(x, sample[0]-lift, z) for (x, z), sample in zip(points, samples)]
    return dict(name=name, variant=None, positions=encode('f', sum(positions, ())),
                normals=encode('f', (0, -1, 0)*len(points)),
                morphs={'6': [encode('h', sum((d for _, d in samples), [])), encode('h', [0]*3*len(points))]},
                groups=[dict(indices=encode('H', tris), color=color, role=role, spec=spec)])


def shawl(side):
    rows = [(-.085,.39,.44),(-.20,.45,.58),(-.35,.45,.65),(-.55,.40,.63),
            (-.79,.31,.56),(-1.02,.22,.45),(-1.30,.14,.32),(-1.45,.13,.25)]
    points = [(side*x, z) for z, inner, outer in rows for x in (inner, outer)]
    triangles = []
    for i in range(0, len(points)-2, 2):
        triangles += [i,i+1,i+2,i+1,i+3,i+2] if side < 0 else [i,i+2,i+1,i+1,i+2,i+3]
    return surface('Shawl lapel', points, triangles, [.027,.025,.027], spec=.11, lift=.12)


def square():
    return surface('Linen pocket square', [(.71,-.61),(.79,-.53),(.86,-.60),(.93,-.55),(.99,-.64),(.71,-.66)],
                   [0,5,1,1,5,2,2,5,4,2,4,3], [.64,.55,.38], lift=.036)


def make_variants():
    dinner = [mesh for mesh in select(0) if 'Lapel' not in mesh['name']] + [shawl(-1),shawl(1)]
    blazer = select(0, square())
    blazer += [copy.deepcopy(mesh) for mesh in SOURCE if mesh['name'] in ['Jacket button.002','Jacket button.004']]
    windowpane = select(2)
    for style, meshes in enumerate((dinner, blazer, windowpane), 4):
        for mesh in meshes:
            mesh['variant'] = ['suitStyle',style]
    return [dinner,blazer,windowpane]


def windowpane_png():
    size=64
    rows=[]
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            stripe=max(0,1-min(abs(x-size//2),abs(y-size//2))/2.5)
            row.extend((round(217+38*stripe),round(218+31*stripe),round(222+22*stripe)))
        rows.append(row)
    def chunk(tag, payload):
        return struct.pack('>I',len(payload))+tag+payload+struct.pack('>I',zlib.crc32(tag+payload))
    return (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+
            chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b''))


def export_glb(path, records, cloth, checked=False):
    """Write standard glTF 2.0 with a female-profile fit morph on supported parts."""
    doc = dict(asset=dict(version='2.0',generator='Republic portrait wardrobe'),scene=0,
               scenes=[dict(nodes=[])],nodes=[],meshes=[],materials=[],buffers=[],
               bufferViews=[],accessors=[])
    data = bytearray()

    def accessor(raw, kind, count, target, component=5126, bounds=None):
        data.extend(b'\0' * (-len(data) % 4))
        v=len(doc['bufferViews'])
        doc['bufferViews'].append(dict(buffer=0,byteOffset=len(data),byteLength=len(raw),target=target))
        data.extend(raw)
        field=dict(bufferView=v,componentType=component,count=count,type=kind)
        if bounds:
            field.update(min=[min(axis) for axis in zip(*bounds)], max=[max(axis) for axis in zip(*bounds)])
        doc['accessors'].append(field)
        return len(doc['accessors'])-1

    if checked:
        png=windowpane_png()
        doc['bufferViews'].append(dict(buffer=0,byteOffset=0,byteLength=len(png)))
        data.extend(png)
        doc.update(images=[dict(bufferView=0,mimeType='image/png')],textures=[dict(source=0)])

    for record in records:
        positions=vectors(record,'positions')
        count=len(positions)
        attrs=dict(POSITION=accessor(base64.b64decode(record['positions']),'VEC3',count,34962,bounds=positions),
                   NORMAL=accessor(base64.b64decode(record['normals']),'VEC3',count,34962))
        check_material=checked and any(group['role'] in ('suit','vest') for group in record['groups'])
        if check_material:
            uv=[value for x,_,z in positions for value in (x*4.2,z*4.5)]
            attrs['TEXCOORD_0']=accessor(struct.pack('<'+'f'*len(uv),*uv),'VEC2',count,34962)
        target=None
        if '6' in record['morphs']:
            pos=base64.b64decode(record['morphs']['6'][0])
            delta=struct.unpack('<'+'h'*(len(pos)//2),pos)
            offset=struct.pack('<'+'f'*len(delta),*(v/30000 for v in delta))
            target=dict(POSITION=accessor(offset,'VEC3',count,34962))
        primitives=[]
        for group in record['groups']:
            color=cloth if group['role']=='suit' else [x*1.38+.023 for x in cloth] if group['role']=='vest' else group['color']
            doc['materials'].append(dict(doubleSided=True,pbrMetallicRoughness=dict(baseColorFactor=[*color,1],metallicFactor=0,roughnessFactor=.65)))
            if check_material and group['role'] in ('suit','vest'):
                material=doc['materials'][-1]['pbrMetallicRoughness']
                material['baseColorTexture']=dict(index=0)
                material['baseColorFactor']=[*(x*1.26 for x in color),1]
            primitives.append(dict(attributes=attrs,indices=accessor(base64.b64decode(group['indices']),'SCALAR',len(indices(group)),34963,5123),material=len(doc['materials'])-1))
            if target:
                primitives[-1]['targets']=[target]
        mesh=dict(name=record['name'],primitives=primitives)
        if target:
            mesh.update(weights=[0],extras=dict(targetNames=['Portrait profile fit']))
        doc['scenes'][0]['nodes'].append(len(doc['nodes']))
        doc['nodes'].append(dict(mesh=len(doc['meshes']),name=record['name'],rotation=[-.707106781,0,0,.707106781]))
        doc['meshes'].append(mesh)
    data.extend(b'\0' * (-len(data)%4))
    doc['buffers']=[dict(byteLength=len(data))]
    header=json.dumps(doc,separators=(',',':')).encode()
    header+=b' '*(-len(header)%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(header)+len(data))+struct.pack('<I4s',len(header),b'JSON')+header+
                     struct.pack('<I4s',len(data),b'BIN\0')+data)


def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('--glb-directory',type=Path)
    options=cli.parse_args()
    styles=make_variants()
    (ROOT/'wardrobe.json').write_text(json.dumps(sum(styles,[]),separators=(',',':'))+'\n')
    if options.glb_directory:
        options.glb_directory.mkdir(parents=True,exist_ok=True)
        for meshes, name, color in zip(styles, ['shawl-tuxedo','club-blazer','windowpane-three-piece'],
                                       [[.036,.031,.032],[.034,.063,.118],[.13,.083,.047]]):
            export_glb(options.glb_directory/f'{name}.glb',[JACKET,NECKBAND,*meshes],color,checked=name=='windowpane-three-piece')


if __name__ == '__main__':
    main()

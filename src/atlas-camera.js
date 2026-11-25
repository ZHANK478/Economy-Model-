const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function atlasProjection(atlas, mode, width, height) {
  // Rotate the coordinate plane and foreshorten it, keeping the SVG at the
  // viewport's actual resolution instead of enlarging a composited image.
  const [degrees, squash] = atlas.tilt;
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const a = cos, b = sin * squash, c = -sin, d = cos * squash;
  const [mapWidth, mapHeight] = atlas.size;
  const desk = {
    x: Math.min(0, a*mapWidth) + Math.min(0, c*mapHeight),
    y: Math.min(0, b*mapWidth) + Math.min(0, d*mapHeight),
    width: Math.abs(a*mapWidth) + Math.abs(c*mapHeight),
    height: Math.abs(b*mapWidth) + Math.abs(d*mapHeight),
  };
  const fit = Math.min(
    (width - Math.min(94, width*.12)) / desk.width,
    (height - Math.min(76, height*.12)) / desk.height
  );
  // National overview matches the supplied 1366 × 638 desk framing.
  const minZoom = mode === 'world' ? 1 : Math.max(1, .94*Math.min(width/1366, height/638)/fit);
  const defaultZoom = minZoom;
  return {
    a, b, c, d, desk, width, height, fit, defaultZoom, minZoom, atlas,
    maxZoom: mode === 'world' ? 24 : defaultZoom*6,
  };
}

function unrotate(projection, x, y) {
  const {a,b,c,d} = projection;
  const determinant = a*d - b*c;
  return [(d*x - c*y)/determinant, (a*y - b*x)/determinant];
}

export function boundAtlasCamera(camera, projection) {
  const {width, height, fit, maxZoom, atlas, a, b, c, d} = projection;
  const zoom = clamp(camera.zoom, projection.minZoom, maxZoom);
  const scale = fit * zoom;
  const [mapWidth, mapHeight] = atlas.size;
  const determinant = a*d - b*c;
  // A portion of the map stays in view at each edge, including at low zoom.
  const marginX = Math.min(mapWidth/2, atlas.margin + (.25/scale)*(Math.abs(d*width)+Math.abs(c*height))/determinant);
  const marginY = Math.min(mapHeight/2, atlas.margin + (.25/scale)*(Math.abs(b*width)+Math.abs(a*height))/determinant);
  return {zoom, x: clamp(camera.x, marginX, mapWidth-marginX), y: clamp(camera.y, marginY, mapHeight-marginY)};
}

export function defaultAtlasCamera(projection) {
  const [x,y] = projection.atlas.focus;
  return boundAtlasCamera({x, y, zoom: projection.defaultZoom}, projection);
}

export function atlasFrame(camera, projection) {
  const {a,b,c,d,width,height,fit,defaultZoom} = projection;
  const scale = fit * camera.zoom;
  const e = width/2 - scale*(a*camera.x+c*camera.y);
  const f = height/2 - scale*(b*camera.x+d*camera.y);
  return {
    width, height, scale, e, f, detail: camera.zoom/defaultZoom,
    matrix: [a*scale,b*scale,c*scale,d*scale,e,f],
    project: (x,y) => [scale*(a*x+c*y)+e, scale*(b*x+d*y)+f],
    unproject: (x,y) => unrotate(projection, (x-e)/scale, (y-f)/scale),
  };
}

export function panAtlas(camera, projection, dx, dy) {
  const scale = projection.fit * camera.zoom;
  const [x,y] = unrotate(projection, dx/scale, dy/scale);
  return boundAtlasCamera({x: camera.x-x, y: camera.y-y, zoom: camera.zoom}, projection);
}

export function zoomAtlas(camera, projection, factor, anchor) {
  const zoom = clamp(camera.zoom*factor, projection.minZoom, projection.maxZoom);
  if (zoom === camera.zoom) return camera;
  const [dx,dy] = unrotate(projection, anchor[0]-projection.width/2, anchor[1]-projection.height/2);
  const offset = (1/camera.zoom - 1/zoom)/projection.fit;
  return boundAtlasCamera({x: camera.x+dx*offset, y: camera.y+dy*offset, zoom}, projection);
}

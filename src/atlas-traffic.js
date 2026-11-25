const svgNamespace = 'http://www.w3.org/2000/svg';
const clocks = new Map();

// Small, muted silhouettes facing right in their local coordinates.
const sprites = {
  ship: {
    path: 'M-4.6-1.1H1L2-2.1H3V-1.1L4.6 0 3.2 1.4H-3.8Z',
    ink: '#414c46', opacity: .54, duration: 23500, gap: 9000, delay: 2200, stagger: 16250,
  },
  plane: {
    path: 'M-5-.4H-.8L-2.1-4.2H-.8L1.7-.7H4.2Q6 0 4.2.7H1.7L-.8 4.2H-2.1L-.8.4H-5L-6 2H-6.9L-6.2 0-6.9-2H-6Z',
    ink: '#605643', opacity: .44, duration: 11200, gap: 16900, delay: 7100, stagger: 8500,
  },
};

function makeTrack(layer, kind, routes, lane) {
  const icon = layer.ownerDocument.createElementNS(svgNamespace, 'path');
  const sprite = sprites[kind];
  icon.setAttribute('d', sprite.path);
  icon.setAttribute('fill', sprite.ink);
  icon.dataset.atlasVehicle = kind;
  icon.style.display = 'none';
  layer.append(icon);

  const paths = routes.map(points => {
    let length = 0;
    const legs = points.slice(1).map(([x, y], index) => {
      const [fromX, fromY] = points[index];
      const dx = x - fromX, dy = y - fromY;
      const span = Math.hypot(dx, dy);
      const leg = {x: fromX, y: fromY, dx, dy, span, start: length};
      length += span;
      return leg;
    });
    return {legs, length};
  });
  return {...sprite, icon, paths, delay: sprite.delay + lane * sprite.stagger};
}

function move(track, elapsed, frame) {
  const {icon, delay, duration, gap, paths, opacity} = track;
  if (elapsed < delay) return delay - elapsed;
  const cycle = duration + gap;
  const trip = Math.floor((elapsed - delay) / cycle);
  const time = (elapsed - delay) % cycle;
  if (time >= duration) {
    icon.style.display = 'none';
    return cycle - time;
  }

  const {legs, length} = paths[trip % paths.length];
  const distance = length * time / duration;
  const leg = legs.find(({start, span}) => distance < start + span) ?? legs.at(-1);
  const progress = (distance - leg.start) / leg.span;
  const [x, y] = frame.project(leg.x + leg.dx * progress, leg.y + leg.dy * progress);
  const [endX, endY] = frame.project(leg.x + leg.dx, leg.y + leg.dy);
  const [startX, startY] = frame.project(leg.x, leg.y);
  const heading = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

  icon.style.display = '';
  icon.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${heading.toFixed(1)})`);
  icon.setAttribute('opacity', (opacity * Math.min(1, time / 1500, (duration - time) / 1500)).toFixed(2));
  return 42;
}

export function mountAtlasTraffic(vector, mode, routes, signal) {
  const doc = vector.ownerDocument;
  const reduceMotion = doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
  const layer = doc.createElementNS(svgNamespace, 'g');
  layer.setAttribute('class', 'atlas-traffic');
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('pointer-events', 'none');
  vector.prepend(layer);
  // Each lane keeps the original cadence. Stagger them so trips can overlap.
  // Split routes so the two vehicles of each kind can pass independently.
  const tracks = Object.entries(routes).flatMap(([kind, paths]) => [0, 1].map(lane =>
    makeTrack(layer, kind, paths.filter((_, index) => index % 2 === lane), lane)
  ));
  let frame, timer;

  function draw() {
    clearTimeout(timer);
    if (!frame || doc.hidden || reduceMotion.matches || doc.body.classList.contains('on-main-menu')) {
      layer.style.display = 'none';
      return;
    }
    layer.style.display = '';
    const now = performance.now();
    if (!clocks.has(mode)) clocks.set(mode, now);
    const elapsed = now - clocks.get(mode);
    const interval = Math.min(...tracks.map(track => move(track, elapsed, frame)));
    timer = setTimeout(draw, interval);
  }

  doc.addEventListener('visibilitychange', draw, {signal});
  reduceMotion.addEventListener('change', draw, {signal});
  signal.addEventListener('abort', () => clearTimeout(timer), {once: true});
  return nextFrame => {
    frame = nextFrame;
    draw();
  };
}

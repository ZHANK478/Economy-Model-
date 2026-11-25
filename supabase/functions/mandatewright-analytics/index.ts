const publishableKeys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'));
const legacyAnon = Deno.env.get('SUPABASE_ANON_KEY');
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const secret = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const backend = Deno.env.get('SUPABASE_URL');
const allowedOrigin = /^https:\/\/(?:[a-z0-9-]+\.)*itch\.zone$/i;
const milestones = new Set([
  'menu','play','newGame','resume','newBrowser','returnD1','returnD7','played5','played15','party','cabinet','vote',
  'month1','month3','month12','election','nextCabinet','budget','parliament','map','newspaper','save'
]);

Deno.serve(async request => {
  const origin = request.headers.get('origin') ?? '';
  if (!allowedOrigin.test(origin)) return new Response(null, {status: 403});

  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  };
  const respond = (status: number) => new Response(null, {status, headers});
  if (request.method === 'OPTIONS') return respond(204);
  if (request.method !== 'POST') return respond(405);

  const key = request.headers.get('apikey');
  if (!key || (!publishableKeys.includes(key) && key !== legacyAnon)) return respond(401);
  if (!backend || !secret) return respond(503);
  if (!request.body) return respond(400);

  let payload;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  try {
    let bytes = 0;
    let body = '';
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024) {
        void reader.cancel();
        return respond(413);
      }
      body += decoder.decode(value, {stream: true});
    }
    payload = JSON.parse(body + decoder.decode());
  } catch {
    return respond(400);
  }

  if (!payload || typeof payload !== 'object' || Object.keys(payload).length !== 2) return respond(400);
  const {build, counters} = payload;
  if (typeof build !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(build) ||
      !counters || typeof counters !== 'object' || Array.isArray(counters)) return respond(400);
  const entries = Object.entries(counters);
  if (!entries.length || entries.some(([metric,value]) => metric === 'seconds'
      ? typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 3600
      : !milestones.has(metric) || value !== 1)) return respond(400);

  try {
    const result = await fetch(backend + '/rest/v1/rpc/increment_mandatewright_counters', {
      method: 'POST',
      headers: {apikey: secret, 'Content-Type': 'application/json', ...(!secret.startsWith('sb_secret_') ? {Authorization: 'Bearer ' + secret} : {})},
      body: JSON.stringify({version:build, counters})
    });
    return respond(result.ok ? 204 : 503);
  } catch {
    return respond(503);
  }
});

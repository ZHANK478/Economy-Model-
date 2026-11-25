const publishableKeys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'));
const legacyAnon = Deno.env.get('SUPABASE_ANON_KEY');
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const secret = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const backend = Deno.env.get('SUPABASE_URL');
const allowedOrigin = /^https:\/\/(?:[a-z0-9-]+\.)*itch\.zone$/i;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fields = ['token', 'visit', 'day', 'build', 'seconds', 'flags'];

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

  if (!payload || typeof payload !== 'object' ||
      Object.keys(payload).length !== fields.length || !fields.every(field => Object.hasOwn(payload, field))) return respond(400);
  const {token, visit, day, build, seconds, flags} = payload;
  if (typeof token !== 'string' || !uuid.test(token) || typeof visit !== 'string' || !uuid.test(visit) ||
      typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      typeof build !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(build) ||
      !Number.isInteger(seconds) || seconds < 0 || seconds > 86400 ||
      !Number.isInteger(flags) || flags < 1 || flags > 32767 || (flags & 1) === 0) return respond(400);

  const suppliedDate = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(+suppliedDate) || suppliedDate.toISOString().slice(0, 10) !== day ||
      Math.abs(Date.now() - +suppliedDate) > 172800000) return respond(400);

  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  const browser = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  try {
    const result = await fetch(backend + '/rest/v1/rpc/record_mandatewright_session', {
      method: 'POST',
      headers: {apikey: secret, 'Content-Type': 'application/json', ...(!secret.startsWith('sb_secret_') ? {Authorization: 'Bearer ' + secret} : {})},
      body: JSON.stringify({browser, session_id: visit, utc_day: day, version: build, seconds, flags})
    });
    return respond(result.ok ? 204 : 503);
  } catch {
    return respond(503);
  }
});

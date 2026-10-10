// Runtime checks for VA-024 (CSRF enforcement) and VA-025 (HttpOnly cookies).
// usage: BASE_URL=http://localhost:3002 npm run test:csrf
const BASE = process.env.BASE_URL || process.argv[2] || 'http://localhost:3002';
const ORIGIN = new URL(BASE).origin;
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

const setCookies = (res) => res.headers.getSetCookie?.() ?? [];
const cookieVal = (res, name) => {
  const c = setCookies(res).find((s) => s.startsWith(`${name}=`));
  return c ? decodeURIComponent(c.split(';')[0].slice(name.length + 1)) : null;
};

// 1. First page load issues an HttpOnly secret and hands the same value to the page.
const home = await fetch(`${BASE}/`, { redirect: 'manual' });
const html = await home.text();
const secret = cookieVal(home, 'csrf_secret');
ok(home.status === 200, 'GET / → 200', home.status);
ok(!!secret && secret.length >= 40, 'csrf_secret issued on first visit');
ok(setCookies(home).every((c) => /;\s*httponly/i.test(c)), 'every Set-Cookie on / is HttpOnly', JSON.stringify(setCookies(home)));
ok(setCookies(home).some((c) => /^csrf_secret=.*samesite=strict/i.test(c)), 'csrf_secret is SameSite=Strict');
ok(!!secret && html.includes(secret), 'page receives the token matching the cookie');
ok(!/<meta name="csrf-token"/.test(html), 'token not rendered as a <head> element');
ok(!setCookies(home).some((c) => c.startsWith('csrf_token=')), 'no readable csrf_token cookie issued');

const jar = `csrf_secret=${secret}`;

// 2. Existing cookie is reused, not rotated, and /api/csrf-token returns it in JSON only.
const again = await fetch(`${BASE}/`, { headers: { cookie: jar } });
const againHtml = await again.text();
ok(!cookieVal(again, 'csrf_secret'), 'existing csrf_secret not re-issued');
ok(againHtml.includes(secret), 'page reuses existing token');
const tokRes = await fetch(`${BASE}/api/csrf-token`, { headers: { cookie: jar } });
const tokBody = await tokRes.json();
ok(tokRes.status === 200 && tokBody.csrfToken === secret, '/api/csrf-token returns current token');
ok(setCookies(tokRes).every((c) => /;\s*httponly/i.test(c)), '/api/csrf-token sets no readable cookie', JSON.stringify(setCookies(tokRes)));
ok(/no-store/.test(tokRes.headers.get('cache-control') || ''), '/api/csrf-token is no-store');
const freshTok = await fetch(`${BASE}/api/csrf-token`);
const freshBody = await freshTok.json();
ok(!!freshBody.csrfToken && cookieVal(freshTok, 'csrf_secret') === freshBody.csrfToken, '/api/csrf-token without cookie issues matching pair');

// 3. Legacy readable mirror cookie is expired with an HttpOnly Set-Cookie.
const legacy = await fetch(`${BASE}/`, { headers: { cookie: `${jar}; csrf_token=${secret}` } });
await legacy.text();
const legacySet = setCookies(legacy).find((c) => c.startsWith('csrf_token='));
ok(!!legacySet && /max-age=0/i.test(legacySet) && /httponly/i.test(legacySet), 'legacy csrf_token cookie expired (HttpOnly)', legacySet);

// 4. Every state-changing endpoint: missing / wrong / cookie-less token → 403; valid → passes CSRF.
const endpoints = [
  ['POST', '/api/auth/login', { phoneNumber: '0900000001', password: 'x' }],
  ['POST', '/api/auth/logout', {}],
  ['POST', '/api/auth/refresh', {}],
  ['POST', '/api/auth/session', {}],
  ['POST', '/api/auth/change-password', {}],
  ['POST', '/api/auth/forgot-password', {}],
  ['POST', '/api/payment/pending-order', {}],
  ['POST', '/api/payment/complete', { id: 'x' }],
  ['POST', '/api/payment/nib/initiate', {}],
  ['POST', '/api/debug/log-token', {}],
  ['POST', '/api/super-admin/auth/login', { phoneNumber: '0900000001', password: 'x' }],
  ['POST', '/api/super-admin/auth/logout', {}],
  ['POST', '/api/super-admin/auth/change-password', {}],
  ['POST', '/api/super-admin/upload', {}],
  ['POST', '/api/upload', {}],
  ['DELETE', '/api/auth/session', undefined],
  ['PUT', '/api/auth/anything', {}],
];
const send = (method, path, body, headers) =>
  fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const isCsrf403 = async (res) => res.status === 403 && (await res.clone().json().catch(() => ({}))).message === 'Invalid CSRF token.';

for (const [method, path, body] of endpoints) {
  const r1 = await send(method, path, body, { cookie: jar });
  ok(await isCsrf403(r1), `${method} ${path}: no header → 403`, r1.status);
  const r2 = await send(method, path, body, { cookie: jar, 'x-csrf-token': secret.slice(0, -1) + (secret.endsWith('A') ? 'B' : 'A') });
  ok(await isCsrf403(r2), `${method} ${path}: wrong token → 403`, r2.status);
  const r3 = await send(method, path, body, { 'x-csrf-token': secret });
  ok(await isCsrf403(r3), `${method} ${path}: header but no cookie → 403`, r3.status);
  const r4 = await send(method, path, body, { cookie: 'csrf_secret=', 'x-csrf-token': '' });
  ok(await isCsrf403(r4), `${method} ${path}: empty cookie+header → 403`, r4.status);
  const r5 = await send(method, path, body, { cookie: jar, 'x-csrf-token': secret });
  ok(!(await isCsrf403(r5)), `${method} ${path}: valid token passes CSRF`, `${r5.status}`);
}

// 5. Server Actions are covered too.
const action = (headers) => fetch(`${BASE}/`, { method: 'POST', redirect: 'manual', headers: { 'next-action': '0'.repeat(40), 'content-type': 'text/plain;charset=UTF-8', origin: ORIGIN, ...headers }, body: '[]' });
ok(await isCsrf403(await action({ cookie: jar })), 'Server Action without token → 403');
ok(await isCsrf403(await action({ cookie: jar, 'x-csrf-token': 'forged' })), 'Server Action with forged token → 403');
const goodAction = await action({ cookie: jar, 'x-csrf-token': secret });
ok(!(await isCsrf403(goodAction)), 'Server Action with valid token passes CSRF', goodAction.status);

// 5b. RSC navigation/prefetch requests (tester's evidence: GET /super-admin/branches?_rsc=…
//     with csrf_secret emptied) are held to the same rule.
// Session presence is what matters here (the token value is checked later by the page itself).
const session = 'super_admin_token=x.y.z; auth_token=x.y.z';
const scripted = (path, cookie, extra = {}, dest = 'empty') =>
  fetch(`${BASE}${path}`, { redirect: 'manual', headers: { accept: '*/*', 'sec-fetch-dest': dest, rsc: '1', ...(cookie ? { cookie } : {}), ...extra } });
for (const path of ['/super-admin/branches?_rsc=oymon', '/dashboard?_rsc=x', '/?_rsc=x', '/api/super-admin/auth/me', '/api/auth/me']) {
  ok(await isCsrf403(await scripted(path, `csrf_secret=; ${session}`)), `scripted GET ${path}: empty csrf_secret → 403`);
  ok(await isCsrf403(await scripted(path, session)), `scripted GET ${path}: no csrf_secret → 403`);
  ok(await isCsrf403(await scripted(path, `${jar}; ${session}`, { 'x-csrf-token': 'forged' })), `scripted GET ${path}: wrong token → 403`);
  ok(await isCsrf403(await scripted(path, `${jar}; ${session}`)), `scripted GET ${path}: cookie but no header → 403`);
  const good = await scripted(path, `${jar}; ${session}`, { 'x-csrf-token': secret });
  ok(!(await isCsrf403(good)), `scripted GET ${path}: valid token passes CSRF`, good.status);
}
// Same request without Sec-Fetch headers (older clients / proxies): Accept decides.
const noSecFetch = await fetch(`${BASE}/super-admin/branches?_rsc=oymon`, { redirect: 'manual', headers: { accept: '*/*', rsc: '1', cookie: `csrf_secret=; ${session}` } });
ok(await isCsrf403(noSecFetch), 'scripted GET without Sec-Fetch-Dest, Accept */* → 403');

// Must stay token-free: first visits, top-level page loads, subresources, anonymous reads.
const firstVisit = await fetch(`${BASE}/super-admin/login`, { redirect: 'manual' });
ok(firstVisit.status === 200, 'document GET without any cookie still loads (first visit)', firstVisit.status);
const docLoad = await scripted('/super-admin/login', `csrf_secret=; ${session}`, { accept: 'text/html,application/xhtml+xml' }, 'document');
ok(!(await isCsrf403(docLoad)), 'top-level page load with session but no token is not CSRF-gated', docLoad.status);
const docNoSecFetch = await fetch(`${BASE}/super-admin/login`, { redirect: 'manual', headers: { accept: 'text/html', cookie: session } });
ok(!(await isCsrf403(docNoSecFetch)), 'page load without Sec-Fetch headers (Accept text/html) not CSRF-gated', docNoSecFetch.status);
const img = await scripted('/images/favicon.ico', session, { accept: 'image/*' }, 'image');
ok(!(await isCsrf403(img)), 'static image with session not CSRF-gated', img.status);
const anon = await scripted('/api/events/public', null);
ok(anon.status === 200, 'anonymous scripted read not CSRF-gated', anon.status);
const tokenEndpoint = await scripted('/api/csrf-token', session);
ok(tokenEndpoint.status === 200, '/api/csrf-token reachable without a token (bootstrap)', tokenEndpoint.status);

// 6. Origin check still precedes CSRF; safe methods are unaffected.
const cross = await send('POST', '/api/payment/pending-order', {}, { cookie: jar, 'x-csrf-token': secret, origin: 'https://evil.example' });
ok(cross.status === 403 && (await cross.json()).message === 'Cross-origin request rejected.', 'cross-origin POST with valid token still rejected');
const getEvents = await fetch(`${BASE}/api/events/public`);
ok(getEvents.status === 200, 'GET /api/events/public unaffected (safe method)', getEvents.status);

// 7. Bootstrap header cannot be injected by the client.
const injected = `attacker${Date.now()}`;
const inj = await fetch(`${BASE}/`, { headers: { cookie: jar, 'x-csrf-bootstrap': injected } });
ok(!(await inj.text()).includes(injected), 'client-supplied x-csrf-bootstrap ignored');

// 8. Server-to-server payment callback (outside /api) is not blocked by CSRF.
const cb = await fetch(`${BASE}/portal/payment-callback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
ok(!(await isCsrf403(cb)), 'POST /portal/payment-callback not CSRF-gated (own token check)', cb.status);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

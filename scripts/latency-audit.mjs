// Sequential per-endpoint latency audit (under the 300 req/min limit).
const BASE = process.env.BASE ?? 'http://127.0.0.1:3099';
const rand = () => Math.random().toString(36).slice(2, 8);
async function req(method, path, body, token, extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t = performance.now();
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, ms: performance.now() - t, json: text ? JSON.parse(text) : null, bytes: text.length };
}
const mysql = await import('mysql2/promise');
const pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.DB_PORT), user: 'root', password: process.env.DB_PASSWORD ?? '', database: 'cafe' });
const reg = await req('POST', '/v1/public/registrations', { company: { company_code: 'L' + rand().toUpperCase(), company_name: 'Latency Cafe' }, owner: {} });
const [[row]] = await pool.query('SELECT otp_code FROM company_registration WHERE id = ?', [reg.json.registration_id]);
const v = await req('POST', `/v1/public/registrations/${reg.json.registration_id}/verify`, { code: row.otp_code });
const username = 'lat_' + rand();
await req('POST', `/v1/public/registrations/${reg.json.registration_id}/admin`, { registration_token: v.json.registration_token, user: { user_name: 'Lat', employee_code: 'E' + rand(), username, password: 'LatSecret1' } });
const login = await req('POST', '/v1/auth/login', { input: username, password: 'LatSecret1' });
console.log('login', login.status, login.ms.toFixed(0) + 'ms');
const token = login.json.access_token, uid = login.json.profile.id;
// seed: 30 groups x 4 variants, 15 tables
const variants = [];
for (let g = 0; g < 20; g++) {
  const gid = crypto.randomUUID();
  await req('PUT', `/v1/items/${gid}`, { data: { item_code: 'G' + g, item_name: 'Group ' + g, base_rate: 0, has_variants: true, is_taxable: true, is_active: true }, create_default_variant: true }, token);
  for (let k = 0; k < 3; k++) { const vid = crypto.randomUUID(); await req('PUT', `/v1/variants/${vid}`, { item_id: gid, variant_name: `V${g}-${k}`, base_rate: 50 + k, is_active: true, is_available: true }, token); variants.push({ gid, vid }); }
}
const tables = [];
for (let t = 0; t < 10; t++) tables.push((await req('POST', '/v1/tables', { table_number: 'T' + t, seating_capacity: 4 }, token)).json.id);
// timed writes
const kotMs = [], billMs = [];
let sessionId, lastTable;
for (let i = 0; i < 15; i++) {
  const t = tables[i % 10], x = variants[i];
  const r = await req('POST', '/v1/orders/kot', { table_id: t, cart: [{ item_id: x.gid, variant_id: x.vid, item_name: 'x', rate: 50, qty: 2, gst_rate: 5, is_taxable: true }] }, token, { 'Idempotency-Key': crypto.randomUUID() });
  kotMs.push(r.ms); if (r.status !== 200) console.log('kot fail', r.status, JSON.stringify(r.json)); sessionId = r.json.sessionId; lastTable = t;
}
for (let i = 0; i < 15; i++) {
  const x = variants[30 + i];
  const r = await req('POST', '/v1/bills', { subtotal: 100, discount_amount: 0, total_amount: 105, payment_mode: 'cash', bill_type: 'takeaway', bill_items: [{ item_id: x.gid, variant_id: x.vid, item_name: 'x', rate: 50, qty: 2, gst_rate: 5, is_taxable: true }] }, token, { 'Idempotency-Key': crypto.randomUUID() });
  billMs.push(r.ms); if (r.status !== 200) console.log('bill fail', r.status, JSON.stringify(r.json));
}
const stats = (a) => { const s = [...a].sort((x, y) => x - y); return `min ${s[0].toFixed(0)} p50 ${s[Math.floor(s.length / 2)].toFixed(0)} max ${s[s.length - 1].toFixed(0)} ms`; };
console.log('POST /orders/kot (20)', stats(kotMs));
console.log('POST /bills (20)', stats(billMs));
const gets = [['/v1/items?order=display'], ['/v1/items?order=name'], ['/v1/tables'], ['/v1/kots'], ['/v1/bills'], ['/v1/company'], [`/v1/users?company_id=${login.json.profile.company_id}`], [`/v1/tables/${lastTable}/order-summary`], [`/v1/sessions/${sessionId}/covers`], [`/v1/sessions/${sessionId}/cover-totals`], [`/v1/sessions/${sessionId}/items`], ['/v1/auth/session'], ['/v1/inventory/materials'], ['/v1/inventory/stock'], ['/v1/company/hsn']];
for (const [p] of gets) {
  const ms = []; let last;
  for (let i = 0; i < 6; i++) { last = await req('GET', p, undefined, token); ms.push(last.ms); }
  console.log(`GET ${p.replace(/[0-9a-f-]{36}/g, ':id').padEnd(34)} ${last.status} ${String(last.bytes).padStart(7)}B  ${stats(ms)}`);
}
process.exit(0);

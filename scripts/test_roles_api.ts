/**
 * Roles API smoke test — registers a throwaway company, verifies CRUD.
 * Run: npx tsx scripts/test_roles_api.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const BASE = 'http://localhost:3099';
const rand = () => Math.random().toString(36).slice(2, 8);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'cafe',
});

let token = '';

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// ── 1. Register company ───────────────────────────────────────────────────────
const reg = await req('POST', '/v1/public/registrations', {
  company: { company_name: 'Roles Test Co', company_code: 'RTC' + rand() },
  owner: { owner_email: `roles_${rand()}@test.com` },
});
if (reg.status !== 200) { console.error('register failed:', reg.json); process.exit(1); }
const regId: string = reg.json.registration_id;
const companyId: string = reg.json.company_id;

// Fetch OTP directly from DB (no email/push in test env)
const [otpRows] = await conn.query('SELECT otp_code FROM company_registration WHERE id = ?', [regId]) as any;
const otp: string = otpRows[0].otp_code;

// ── 2. Verify OTP ─────────────────────────────────────────────────────────────
const verify = await req('POST', `/v1/public/registrations/${regId}/verify`, { code: otp });
if (verify.status !== 200) { console.error('verify failed:', verify.json); process.exit(1); }
const regToken: string = verify.json.registration_token;
console.log('✓ Company registered & OTP verified | company:', companyId);

// ── 3. Setup admin ────────────────────────────────────────────────────────────
const adminUsername = 'roles_admin_' + rand();
const setup = await req('POST', `/v1/public/registrations/${regId}/admin`, {
  registration_token: regToken,
  user: { user_name: 'Roles Admin', employee_code: 'RA1', username: adminUsername, password: 'RolesTest@1' },
});
if (setup.status !== 200) { console.error('setup admin failed:', setup.json); process.exit(1); }
console.log('✓ Admin created:', adminUsername);

// ── 4. Login ──────────────────────────────────────────────────────────────────
const login = await req('POST', '/v1/auth/login', { input: adminUsername, password: 'RolesTest@1' });
if (login.status !== 200) { console.error('login failed:', login.json); process.exit(1); }
token = login.json.access_token;
console.log('✓ Login OK');

// ── 5. GET /v1/roles — seeded system roles ────────────────────────────────────
const list = await req('GET', `/v1/roles?company_id=${companyId}`);
if (list.status !== 200) { console.error('list roles failed:', list.json); process.exit(1); }
const roleNames: string[] = list.json.map((r: any) => r.role_name).sort();
const missing = ['admin', 'kitchen_master', 'manager', 'staff'].filter(r => !roleNames.includes(r));
if (missing.length) { console.error('missing system roles:', missing); process.exit(1); }
console.log('✓ GET /v1/roles — system roles present:', roleNames.join(', '));

// ── 6. GET /v1/roles/by-name ──────────────────────────────────────────────────
const byName = await req('GET', `/v1/roles/by-name?company_id=${companyId}&role_name=staff`);
if (byName.status !== 200) { console.error('by-name failed:', byName.json); process.exit(1); }
const staffCCB = byName.json.can_create_bill === 1 || byName.json.can_create_bill === true;
if (!staffCCB) { console.error('staff.can_create_bill should be true, got:', byName.json.can_create_bill); process.exit(1); }
console.log('✓ GET /v1/roles/by-name (staff) — can_create_bill:', byName.json.can_create_bill);

// ── 7. POST /v1/roles — create custom role ────────────────────────────────────
const create = await req('POST', '/v1/roles', {
  company_id: companyId,
  role_name: 'test_custom',
  display_name: 'Test Custom',
  description: 'API test',
  is_active: true,
  can_create_bill: true,
  can_view_reports: true,
});
if (create.status !== 200) { console.error('create failed:', create.json); process.exit(1); }
const newId: string = create.json.id;
console.log('✓ POST /v1/roles — custom role created id:', newId);

// ── 8. Verify it appears in list ──────────────────────────────────────────────
const list2 = await req('GET', `/v1/roles?company_id=${companyId}`);
const found = list2.json?.find((r: any) => r.role_name === 'test_custom');
if (!found) { console.error('custom role not in list'); process.exit(1); }
console.log('✓ Custom role visible in list');

// ── 9. DELETE custom role ─────────────────────────────────────────────────────
const del = await req('DELETE', `/v1/roles/${newId}`);
if (del.status !== 200 || !del.json.ok) { console.error('delete failed:', del.json); process.exit(1); }
console.log('✓ DELETE /v1/roles/:id — ok');

// ── 10. System role delete blocked ───────────────────────────────────────────
const adminRole = list.json.find((r: any) => r.role_name === 'admin');
const delSystem = await req('DELETE', `/v1/roles/${adminRole.id}`);
if (delSystem.status !== 422) { console.error(`system role delete should 422, got: ${delSystem.status}`); process.exit(1); }
console.log('✓ System role delete blocked with 422');

// ── Cleanup ───────────────────────────────────────────────────────────────────
await conn.execute('DELETE FROM company_master WHERE id = ?', [companyId]);
await conn.end();
console.log('✓ Test company cleaned up');

console.log('\n✅ ALL ROLES API TESTS PASSED');

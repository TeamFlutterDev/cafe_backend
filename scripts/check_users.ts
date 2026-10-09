import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'cafe',
  });

  const [profiles] = await conn.query(
    'SELECT id, company_id, username, user_name, user_role, user_active FROM user_profiles LIMIT 20'
  );
  console.log('=== USER_PROFILES ===');
  console.log(JSON.stringify(profiles, null, 2));

  const [companies] = await conn.query('SELECT id, company_name FROM company_master LIMIT 10');
  console.log('=== COMPANIES ===');
  console.log(JSON.stringify(companies, null, 2));

  await conn.end();
}

main().catch(console.error);

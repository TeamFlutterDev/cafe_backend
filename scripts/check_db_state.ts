import mysql from 'mysql2/promise';
import 'dotenv/config';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'cafe',
});

const [users] = await conn.query(
  "SELECT username, user_role, company_id FROM user_profiles WHERE user_role = 'admin' LIMIT 5"
);
console.log('Admin users:', JSON.stringify(users, null, 2));

await conn.end();

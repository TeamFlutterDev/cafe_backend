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

  const [rows] = await conn.query(
    `SELECT cr.id, cr.company_name, cr.otp_code, cr.status, cr.expires_at, cr.created_at
     FROM company_registration cr
     ORDER BY cr.created_at DESC LIMIT 5`
  );
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
}

main().catch(console.error);

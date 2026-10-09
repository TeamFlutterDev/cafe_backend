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

  const [tables] = await conn.query('SHOW TABLES');
  console.log('Tables in DB:', JSON.stringify(tables, null, 2));

  const [migrations] = await conn.query('SELECT * FROM schema_migrations');
  console.log('Applied migrations:', JSON.stringify(migrations, null, 2));

  await conn.end();
}

main().catch(console.error);

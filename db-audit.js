const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.qsmzosovturydvgonhme:pGM3b8SN9wGLwvQe@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    await client.connect();
    
    const userCount = await client.query('SELECT COUNT(*) FROM "User"');
    const gameCount = await client.query('SELECT COUNT(*) FROM "Game"');
    const games = await client.query('SELECT id, title, "organizerId" FROM "Game" LIMIT 5');
    const users = await client.query('SELECT id, email, name FROM "User" LIMIT 5');

    console.log('--- DATABASE AUDIT (qsmzosovturydvgonhme) ---');
    console.log('User Count:', userCount.rows[0].count);
    console.log('Game Count:', gameCount.rows[0].count);
    console.log('Recent Users:', users.rows);
    console.log('Recent Games:', games.rows);

  } catch (err) {
    console.error('AUDIT ERROR:', err.message);
  } finally {
    await client.end();
  }
}

run();

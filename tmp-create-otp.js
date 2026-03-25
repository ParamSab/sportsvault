process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.qsmzosovturydvgonhme:pGM3b8SN9wGLwvQe@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Connecting to Supabase (via AWS-0 Pooler, Port 6543, SSL Bypass)...');
    await client.connect();
    console.log('Connected!');
    
    console.log('Creating OtpCode table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "OtpCode" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "OtpCode_email_idx" ON "OtpCode"(email);
    `);
    
    console.log('SUCCESS: OtpCode table is now live on the new database!');
  } catch (err) {
    console.error('DATABASE ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

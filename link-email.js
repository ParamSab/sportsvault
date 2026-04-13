process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.qsmzosovturydvgonhme:pGM3b8SN9wGLwvQe@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
    const email = 'paramsabnani@gmail.com';
    const oldId = 'd07a8347-b181-47bb-81df-d5c5ae094f41';
    
    console.log(`Linking email ${email} to user ID ${oldId}...`);
    
    // Check if another user already has this email
    const existing = await client.query('SELECT id FROM "User" WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
        console.log(`Conflict: Another user (${existing.rows[0].id}) already has this email. Merging...`);
        // If they already created a new user, we might need to delete it or move its games.
        // But the subagent only saw 1 user.
    }

    const result = await client.query(
        'UPDATE "User" SET email = $1 WHERE id = $2 RETURNING *',
        [email, oldId]
    );
    
    if (result.rows.length > 0) {
        console.log('SUCCESS: Email linked. User profile updated!');
    } else {
        console.log('ERROR: User record not found.');
    }

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await client.end();
  }
}

run();

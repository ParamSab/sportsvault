// Migration script to backfill email for phone‑only users
// Adjust the mapping logic as needed (e.g., load from CSV)
import { prisma } from '@/lib/prisma';

async function migrate() {
  // Example: fetch all users without email
  const users = await prisma.user.findMany({ where: { email: null, phone: { not: null } } });
  console.log(`Found ${users.length} users without email`);

  // TODO: Replace this placeholder with actual mapping source
  // For demonstration, we will just log the users; you can update the email field manually or via a CSV.
  for (const user of users) {
    console.log(`User ID: ${user.id}, Phone: ${user.phone}`);
    // Example of setting email if you have a mapping function getEmailFromPhone
    // const email = getEmailFromPhone(user.phone);
    // if (email) {
    //   await prisma.user.update({ where: { id: user.id }, data: { email } });
    //   console.log(`Updated user ${user.id} with email ${email}`);
    // }
  }
  console.log('Migration completed');
}

migrate().catch((e) => {
  console.error('Migration error:', e);
  process.exit(1);
});

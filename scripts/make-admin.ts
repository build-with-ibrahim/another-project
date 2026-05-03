const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run make-admin -- <email>');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xzzobwtshbvgbylhqsux.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6em9id3RzaGJ2Z2J5bGhxc3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTk0MjgsImV4cCI6MjA5MzM3NTQyOH0.rm-mjdLbcx4EYB8Nx2bXsyqZPZuYZ9roL0uGcVwedGA';

async function main() {
  // Find user by email
  const findRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const users = await findRes.json() as { id: number; email: string }[];
  if (!users || users.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const user = users[0];

  // Update is_admin to true
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ is_admin: true }),
    }
  );

  if (!updateRes.ok) {
    const text = await updateRes.text();
    console.error('Failed to update user:', text);
    process.exit(1);
  }

  console.log(`User ${user.email} (id=${user.id}) is now an admin.`);
  console.log('They will need to log out and back in for the change to take effect.');
}

main().catch(e => { console.error(e); process.exit(1); });

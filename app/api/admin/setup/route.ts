import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Bootstrap endpoint — sets the first registered user as admin if no admins exist yet.
 * POST /api/admin/setup
 * Once an admin exists, this endpoint returns 409 and does nothing.
 */
export async function POST() {
  try {
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('is_admin', true)
      .limit(1)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'An admin already exists. Use the make-admin script to add more.' },
        { status: 409 }
      );
    }

    const { data: firstUser } = await supabase
      .from('users')
      .select('id,email')
      .order('id', { ascending: true })
      .limit(1)
      .single();

    if (!firstUser) {
      return NextResponse.json({ error: 'No users registered yet.' }, { status: 404 });
    }

    await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', firstUser.id);

    return NextResponse.json({
      success: true,
      message: `User ${firstUser.email} (id=${firstUser.id}) is now an admin. Log out and back in for the change to take effect.`,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

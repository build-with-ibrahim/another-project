import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  const { data } = await supabase.from('users').select('is_admin').eq('id', session.userId).single();
  if (!data?.is_admin) return null;
  return session;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  if (Number(id) === session.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  // Delete related records first to avoid FK constraint issues
  await supabase.from('schedules').delete().eq('user_id', id);
  await supabase.from('attendance').delete().eq('user_id', id);

  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

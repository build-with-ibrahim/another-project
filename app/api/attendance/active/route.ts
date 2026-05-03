import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminCheck } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.userId)
      .single();

    if (!adminCheck || adminCheck.is_admin !== true) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: attendanceRows } = await supabase
      .from('attendance')
      .select('id, user_id, check_in, scheduled_start, is_matched')
      .eq('date', today)
      .is('check_out', null);

    if (!attendanceRows || attendanceRows.length === 0) {
      return NextResponse.json({ active: [] });
    }

    const userIds = attendanceRows.map(r => r.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds);

    const userMap: Record<number, { name: string; email: string }> = {};
    (users || []).forEach(u => { userMap[u.id] = { name: u.name, email: u.email }; });

    const active = attendanceRows.map(row => ({
      id: row.id,
      name: userMap[row.user_id]?.name ?? 'Unknown',
      email: userMap[row.user_id]?.email ?? '',
      check_in: row.check_in,
      scheduled_start: row.scheduled_start,
      is_matched: row.is_matched,
    }));

    return NextResponse.json({ active });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

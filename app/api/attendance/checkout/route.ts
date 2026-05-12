import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];

  const { data: record } = await supabase
    .from('attendance')
    .select('id,check_out')
    .eq('user_id', session.userId)
    .eq('date', today)
    .single();

  if (!record) {
    return NextResponse.json({ error: 'Not checked in today' }, { status: 400 });
  }
  if (record.check_out) {
    return NextResponse.json({ error: 'Already checked out' }, { status: 409 });
  }

  const checkOutISO = new Date().toISOString();
  const { error } = await supabase
    .from('attendance')
    .update({ check_out: checkOutISO })
    .eq('user_id', session.userId)
    .eq('date', today);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to check out' }, { status: 500 });
  }

  return NextResponse.json({ success: true, check_out: checkOutISO });
}

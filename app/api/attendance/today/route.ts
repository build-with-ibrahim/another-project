import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];
  const { data: record } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', session.userId)
    .eq('date', today)
    .single();

  return NextResponse.json({ record: record || null, today });
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: user } = await supabase
    .from('users')
    .select('id,name,email,is_admin,hourly_rate,legacy_hours,legacy_earnings,already_paid')
    .eq('id', session.userId)
    .single();

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(user);
}

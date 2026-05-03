import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function getWeekBounds(): { monday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay();
  const diffMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffMon);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    monday: monday.toISOString().split('T')[0],
    sunday: sunday.toISOString().split('T')[0],
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userRecord } = await supabase
    .from('users')
    .select('hourly_rate')
    .eq('id', session.userId)
    .single();

  const RATE = userRecord?.hourly_rate ?? 200;

  const { monday, sunday } = getWeekBounds();

  const { data: records } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', session.userId)
    .gte('date', monday)
    .lte('date', sunday)
    .order('date', { ascending: true });

  let totalHours = 0;
  const days = (records || []).map(r => {
    let hours = 0;
    if (r.check_in && r.check_out) {
      hours = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / (1000 * 60 * 60);
    } else if (r.check_in) {
      hours = (Date.now() - new Date(r.check_in).getTime()) / (1000 * 60 * 60);
    }
    totalHours += hours;
    return {
      ...r,
      hours: Math.round(hours * 100) / 100,
      earnings: Math.round(hours * RATE * 100) / 100,
    };
  });

  return NextResponse.json({
    days,
    totalHours: Math.round(totalHours * 100) / 100,
    totalEarnings: Math.round(totalHours * RATE * 100) / 100,
    weekStart: monday,
    weekEnd: sunday,
  });
}

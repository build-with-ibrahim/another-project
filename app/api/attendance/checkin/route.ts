import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Check if already checked in
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('user_id', session.userId)
    .eq('date', today)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Already checked in today' }, { status: 409 });
  }

  // Get today's schedule
  const weekStart = getWeekStart();
  const { data: schedule } = await supabase
    .from('schedules')
    .select('days_schedule')
    .eq('user_id', session.userId)
    .eq('week_start', weekStart)
    .single();

  let scheduledStart: string | null = null;
  let isMatched: boolean | null = null;

  if (schedule?.days_schedule) {
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dayEntry = (schedule.days_schedule as { day: string; start_time: string; hours: number }[])
      .find(d => d.day === dayName);

    if (dayEntry) {
      scheduledStart = dayEntry.start_time;
      const [sh, sm] = scheduledStart.split(':').map(Number);
      const scheduledMinutes = sh * 60 + sm;
      const actualMinutes = now.getHours() * 60 + now.getMinutes();
      isMatched = Math.abs(actualMinutes - scheduledMinutes) <= 15;
    }
  }

  const checkInISO = now.toISOString();
  const { error } = await supabase
    .from('attendance')
    .insert({ user_id: session.userId, date: today, check_in: checkInISO, scheduled_start: scheduledStart, is_matched: isMatched });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }

  return NextResponse.json({ success: true, check_in: checkInISO, scheduled_start: scheduledStart, is_matched: isMatched });
}

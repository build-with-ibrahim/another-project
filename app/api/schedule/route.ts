import { NextRequest, NextResponse } from 'next/server';
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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekStart = getWeekStart();
  const { data: schedule } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', session.userId)
    .eq('week_start', weekStart)
    .single();

  if (!schedule) return NextResponse.json({ schedule: null, weekStart });

  return NextResponse.json({ schedule, weekStart });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { days_schedule } = body;
  if (!days_schedule || !Array.isArray(days_schedule) || days_schedule.length === 0) {
    return NextResponse.json({ error: 'days_schedule array required' }, { status: 400 });
  }

  const weekStart = getWeekStart();

  // Check if locked
  const { data: existing } = await supabase
    .from('schedules')
    .select('locked_until')
    .eq('user_id', session.userId)
    .eq('week_start', weekStart)
    .single();

  if (existing && Date.now() < new Date(existing.locked_until).getTime()) {
    return NextResponse.json({ error: 'Schedule is locked', locked_until: existing.locked_until }, { status: 423 });
  }

  const locked_until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('schedules')
    .upsert(
      { user_id: session.userId, week_start: weekStart, days_schedule, locked_until },
      { onConflict: 'user_id,week_start' }
    );

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
  }

  return NextResponse.json({ success: true, locked_until });
}

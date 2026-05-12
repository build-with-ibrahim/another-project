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

async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  const { data } = await supabase.from('users').select('is_admin').eq('id', session.userId).single();
  if (!data?.is_admin) return null;
  return session;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const weekStart = getWeekStart();

  const { data: schedule } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', id)
    .eq('week_start', weekStart)
    .single();

  return NextResponse.json({ schedule: schedule ?? null, weekStart });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { days_schedule } = body;

  if (!days_schedule || !Array.isArray(days_schedule) || days_schedule.length === 0) {
    return NextResponse.json({ error: 'days_schedule array required' }, { status: 400 });
  }

  const weekStart = getWeekStart();
  const locked_until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('schedules')
    .upsert(
      { user_id: id, week_start: weekStart, days_schedule, locked_until },
      { onConflict: 'user_id,week_start' }
    );

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
  }

  return NextResponse.json({ success: true, locked_until });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const employeeId = parseInt(id, 10);
  if (isNaN(employeeId)) {
    return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 });
  }

  let body: { hourly_rate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const hourly_rate = Number(body.hourly_rate);
  if (!isFinite(hourly_rate) || hourly_rate <= 0) {
    return NextResponse.json({ error: 'hourly_rate must be a positive number' }, { status: 400 });
  }

  const { error } = await supabase
    .from('users')
    .update({ hourly_rate })
    .eq('id', employeeId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update rate' }, { status: 500 });
  }

  return NextResponse.json({ success: true, hourly_rate });
}

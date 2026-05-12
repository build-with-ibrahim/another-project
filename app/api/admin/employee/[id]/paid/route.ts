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

  let body: { already_paid?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const already_paid = Number(body.already_paid);
  if (!isFinite(already_paid) || already_paid < 0) {
    return NextResponse.json({ error: 'already_paid must be a non-negative number' }, { status: 400 });
  }

  const { error } = await supabase
    .from('users')
    .update({ already_paid })
    .eq('id', employeeId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update already_paid' }, { status: 500 });
  }

  return NextResponse.json({ success: true, already_paid });
}

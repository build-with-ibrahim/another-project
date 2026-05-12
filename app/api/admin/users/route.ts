import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  const { data } = await supabase.from('users').select('is_admin').eq('id', session.userId).single();
  if (!data?.is_admin) return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
  }

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .insert({ name, email, password_hash })
    .select('id, name, email, is_admin, hourly_rate, legacy_hours, legacy_earnings, already_paid')
    .single();

  if (error || !data) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: data });
}

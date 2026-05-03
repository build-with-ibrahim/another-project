import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminCheck } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.userId)
      .single();

    if (!adminCheck || adminCheck.is_admin !== true) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const weekStart = getMondayOfCurrentWeek();

    const { data: users } = await supabase
      .from('users')
      .select('id,name,email,is_admin')
      .order('id', { ascending: true });

    if (!users) return NextResponse.json({ employees: [] });

    // Fetch schedules and attendance for all users in parallel
    const employeeData = await Promise.all(
      users.map(async user => {
        const { data: schedule } = await supabase
          .from('schedules')
          .select('days_schedule,locked_until')
          .eq('user_id', user.id)
          .eq('week_start', weekStart)
          .single();

        const { data: attendanceRows } = await supabase
          .from('attendance')
          .select('date,check_in,check_out,is_matched')
          .eq('user_id', user.id)
          .gte('date', weekStart)
          .order('date', { ascending: true });

        let totalHoursThisWeek = 0;
        let totalEarningsThisWeek = 0;

        const weekAttendance = (attendanceRows || []).map(row => {
          let hours = 0;
          if (row.check_in && row.check_out) {
            hours = (new Date(row.check_out).getTime() - new Date(row.check_in).getTime()) / 3600000;
          }
          const earnings = hours * 200;
          totalHoursThisWeek += hours;
          totalEarningsThisWeek += earnings;
          return { ...row, hours, earnings };
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          is_admin: user.is_admin,
          schedule: schedule || null,
          scheduleSetThisWeek: !!schedule,
          weekAttendance,
          totalHoursThisWeek,
          totalEarningsThisWeek,
        };
      })
    );

    return NextResponse.json({ employees: employeeData });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

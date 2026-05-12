import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

function getMondayStr(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

function getSundayStr(mondayStr: string): string {
  const d = new Date(mondayStr);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

export async function GET() {
  try {
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

    const weekStart = getMondayStr();
    const weekEnd = getSundayStr(weekStart);
    const today = new Date().toISOString().split('T')[0];

    const { data: users } = await supabase
      .from('users')
      .select('id, name, email, is_admin, hourly_rate, legacy_hours, legacy_earnings, already_paid')
      .order('id', { ascending: true });

    if (!users) return NextResponse.json({ totalEmployees: 0, activeNow: 0, missingSchedule: [], totalHoursThisWeek: 0, totalEarningsThisWeek: 0, employees: [] });

    // Fetch today's active attendance (no check_out)
    const { data: todayActive } = await supabase
      .from('attendance')
      .select('user_id, check_in')
      .eq('date', today)
      .is('check_out', null);

    const activeSet = new Set((todayActive || []).map(r => r.user_id));

    const employeeData = await Promise.all(
      users.map(async user => {
        const { data: schedule } = await supabase
          .from('schedules')
          .select('days_schedule, locked_until')
          .eq('user_id', user.id)
          .eq('week_start', weekStart)
          .single();

        const { data: todayRecord } = await supabase
          .from('attendance')
          .select('check_in, check_out')
          .eq('user_id', user.id)
          .eq('date', today)
          .single();

        const { data: attendanceRows } = await supabase
          .from('attendance')
          .select('date, check_in, check_out, is_matched')
          .eq('user_id', user.id)
          .gte('date', weekStart)
          .lte('date', weekEnd)
          .order('date', { ascending: true });

        let totalHoursThisWeek = 0;
        let totalEarningsThisWeek = 0;

        const weekAttendance = (attendanceRows || []).map(row => {
          let hours = 0;
          if (row.check_in && row.check_out) {
            hours = (new Date(row.check_out).getTime() - new Date(row.check_in).getTime()) / 3600000;
          }
          const earnings = hours * (user.hourly_rate ?? 200);
          totalHoursThisWeek += hours;
          totalEarningsThisWeek += earnings;
          return { date: row.date, check_in: row.check_in, check_out: row.check_out, hours, earnings, is_matched: row.is_matched };
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          is_admin: user.is_admin,
          hourly_rate: user.hourly_rate ?? 200,
          legacy_hours: user.legacy_hours ?? 0,
          legacy_earnings: user.legacy_earnings ?? 0,
          already_paid: user.already_paid ?? 0,
          checkedInToday: !!todayRecord?.check_in,
          checkInTime: todayRecord?.check_in ?? null,
          checkOutTime: todayRecord?.check_out ?? null,
          hasScheduleThisWeek: !!schedule,
          schedule: schedule ?? null,
          weekAttendance,
          totalHoursThisWeek,
          totalEarningsThisWeek,
        };
      })
    );

    const activeNow = (todayActive || []).length;
    const missingSchedule = employeeData.filter(e => !e.hasScheduleThisWeek).map(e => e.name);
    const totalHoursThisWeek = employeeData.reduce((s, e) => s + e.totalHoursThisWeek, 0);
    const totalEarningsThisWeek = employeeData.reduce((s, e) => s + e.totalEarningsThisWeek, 0);

    return NextResponse.json({
      totalEmployees: users.length,
      activeNow,
      missingSchedule,
      totalHoursThisWeek,
      totalEarningsThisWeek,
      employees: employeeData,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

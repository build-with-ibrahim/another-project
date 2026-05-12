'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DaySchedule {
  day: string;
  start_time: string;
  hours: number;
}

interface AttendanceRecord {
  id: number;
  date: string;
  check_in: string;
  check_out: string | null;
  scheduled_start: string | null;
  is_matched: boolean | null;
  hours: number;
  earnings: number;
}

interface WeekData {
  days: AttendanceRecord[];
  totalHours: number;
  totalEarnings: number;
  weekStart: string;
  weekEnd: string;
}

interface TodayData {
  record: {
    check_in: string;
    check_out: string | null;
    scheduled_start: string | null;
    is_matched: boolean | null;
  } | null;
  today: string;
}

interface ScheduleData {
  schedule: {
    days_schedule: DaySchedule[];
    locked_until: string;
  } | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  hourly_rate: number;
  legacy_hours: number;
  legacy_earnings: number;
  already_paid: number;
}

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name.split(' ')[0]}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function fmtDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FULL_WEEK_HOURS = 40;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [now, setNow] = useState(new Date());
  const [today, setToday] = useState<TodayData | null>(null);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [mismatchBanner, setMismatchBanner] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [todayRes, weekRes, scheduleRes, meRes] = await Promise.all([
      fetch('/api/attendance/today'),
      fetch('/api/attendance/week'),
      fetch('/api/schedule'),
      fetch('/api/auth/me'),
    ]);
    if (meRes.status === 401) { router.push('/'); return; }
    const [todayData, weekDataRes, scheduleData, userData] = await Promise.all([
      todayRes.json(), weekRes.json(), scheduleRes.json(), meRes.json(),
    ]);
    setToday(todayData);
    setWeekData(weekDataRes);
    setSchedule(scheduleData);
    setUser(userData);
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const i = setInterval(async () => {
      const res = await fetch('/api/attendance/week');
      setWeekData(await res.json());
    }, 60000);
    return () => clearInterval(i);
  }, []);

  async function handleCheckIn() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/checkin', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { alert(data.error); }
      else {
        if (data.is_matched === false && data.scheduled_start) {
          const scheduledFmt = data.scheduled_start;
          const checkedFmt = fmtTime(data.check_in);
          // calc diff
          const [sh, sm] = scheduledFmt.split(':').map(Number);
          const ci = new Date(data.check_in);
          const diffMins = (ci.getHours() * 60 + ci.getMinutes()) - (sh * 60 + sm);
          setMismatchBanner(`You checked in at ${checkedFmt} but were scheduled for ${scheduledFmt} (${diffMins > 0 ? diffMins + ' min late' : 'early'})`);
        }
        await fetchData();
      }
    } finally { setActionLoading(false); }
  }

  async function handleCheckOut() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { alert(data.error); }
      else { await fetchData(); }
    } finally { setActionLoading(false); }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const todaySchedule = (() => {
    if (!schedule?.schedule) return null;
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    return schedule.schedule.days_schedule.find(d => d.day === dayName) || null;
  })();

  const hasCheckedIn = !!today?.record?.check_in;
  const hasCheckedOut = !!today?.record?.check_out;

  const workingDuration = (() => {
    if (!hasCheckedIn || !today?.record?.check_in) return null;
    if (hasCheckedOut && today?.record?.check_out) {
      return (new Date(today.record.check_out).getTime() - new Date(today.record.check_in).getTime());
    }
    return now.getTime() - new Date(today.record.check_in).getTime();
  })();

  const progressPct = Math.min(100, ((weekData?.totalHours ?? 0) / FULL_WEEK_HOURS) * 100);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Employee Tracker</span>
          </div>
          <span className="text-sm text-gray-600 hidden sm:block font-medium">
            {user ? getGreeting(user.name) : ''}
          </span>
          <div className="flex items-center gap-3">
            {user?.is_admin && (
              <Link href="/admin" className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors">
                Admin
              </Link>
            )}
            <button onClick={handleLogout} className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 font-medium rounded-lg px-3 py-1.5 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Schedule warning banner */}
        {!schedule?.schedule && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
            <span className="text-red-500 text-lg mt-0.5">⚠️</span>
            <span className="text-sm font-medium flex-1">
              You haven&apos;t set your schedule for this week.{' '}
              <Link href="/schedule" className="underline font-semibold">Set it now →</Link>
            </span>
          </div>
        )}

        {/* Mismatch banner */}
        {mismatchBanner && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-500 text-lg mt-0.5">⚠️</span>
            <span className="text-sm font-medium flex-1">{mismatchBanner}</span>
            <button className="text-amber-400 hover:text-amber-600" onClick={() => setMismatchBanner('')}>✕</button>
          </div>
        )}

        {/* Hero check-in/out card */}
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            {/* Date */}
            <p className="text-gray-500 text-sm font-medium">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {/* Live clock */}
            <p className="text-5xl font-bold tabular-nums mt-1 tracking-tight text-gray-900">
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </p>

            {/* Scheduled arrival */}
            <p className={`text-sm mt-3 font-medium ${todaySchedule ? 'text-indigo-600' : 'text-red-500'}`}>
              {todaySchedule
                ? `Scheduled arrival: ${todaySchedule.start_time} · ${todaySchedule.hours}h`
                : 'No schedule set for today'}
            </p>

            {/* Big action button */}
            <div className="mt-6">
              {!hasCheckedIn && (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold text-lg tracking-wide transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-3"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {actionLoading ? 'Checking in…' : 'TAP TO CHECK IN'}
                </button>
              )}

              {hasCheckedIn && !hasCheckedOut && (
                <div>
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold text-lg tracking-wide transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {actionLoading ? 'Checking out…' : 'TAP TO CHECK OUT'}
                  </button>
                  {workingDuration !== null && (
                    <p className="text-green-600 font-semibold text-sm mt-3">
                      ⏱ Working for {fmtDuration(workingDuration)}
                    </p>
                  )}
                </div>
              )}

              {hasCheckedIn && hasCheckedOut && (
                <div className="bg-blue-50 rounded-2xl p-5">
                  <p className="text-blue-700 font-bold text-lg">Done for Today ✓</p>
                  <div className="flex justify-center gap-6 mt-3 text-sm text-gray-600">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">In</p>
                      <p className="font-bold text-gray-800">{fmtTime(today!.record!.check_in)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Out</p>
                      <p className="font-bold text-gray-800">{fmtTime(today!.record!.check_out)}</p>
                    </div>
                    {workingDuration !== null && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Total</p>
                        <p className="font-bold text-gray-800">{(workingDuration / 3600000).toFixed(1)}h</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Earnings card */}
        <div className="bg-linear-to-br from-indigo-600 to-indigo-800 rounded-2xl shadow-lg shadow-indigo-200 p-6 text-white">
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-3">This Week&apos;s Earnings</p>
          <p className="text-5xl font-bold tabular-nums">₹{weekData?.totalEarnings.toFixed(0) ?? '0'}</p>
          <p className="text-indigo-200 text-sm mt-1">{weekData?.totalHours.toFixed(1) ?? '0'} hours worked · Rate: ₹{user?.hourly_rate ?? 200}/hr</p>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-indigo-300 mb-1.5">
              <span>{(weekData?.totalHours ?? 0).toFixed(1)}h worked</span>
              <span>{FULL_WEEK_HOURS}h full week</span>
            </div>
            <div className="h-2 rounded-full bg-indigo-900/50">
              <div
                className="h-2 rounded-full bg-indigo-300 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Weekly breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">This Week&apos;s Breakdown</h2>
            <Link href="/schedule" className="text-xs text-indigo-600 font-semibold hover:underline">
              Edit schedule →
            </Link>
          </div>
          {!weekData?.days.length ? (
            <p className="text-sm text-gray-400 py-4 text-center">No attendance records this week.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-96">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="pb-2 text-left font-semibold px-2">Day</th>
                    <th className="pb-2 text-left font-semibold px-2">Date</th>
                    <th className="pb-2 text-left font-semibold px-2">In</th>
                    <th className="pb-2 text-left font-semibold px-2">Out</th>
                    <th className="pb-2 text-right font-semibold px-2">Hours</th>
                    <th className="pb-2 text-right font-semibold px-2">₹</th>
                  </tr>
                </thead>
                <tbody>
                  {weekData.days.map((d, i) => (
                    <tr key={d.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="py-2.5 px-2 text-gray-700 font-medium">
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                      </td>
                      <td className="py-2.5 px-2 text-gray-500">{fmtDateShort(d.date)}</td>
                      <td className="py-2.5 px-2 text-gray-600">{d.check_in ? fmtTime(d.check_in) : '—'}</td>
                      <td className="py-2.5 px-2 text-gray-600">
                        {d.check_out ? fmtTime(d.check_out) : d.check_in ? (
                          <span className="text-amber-500 font-medium">Active</span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-gray-800">{d.hours > 0 ? `${d.hours.toFixed(1)}h` : '—'}</td>
                      <td className="py-2.5 px-2 text-right font-semibold text-indigo-600">{d.earnings > 0 ? `₹${d.earnings.toFixed(0)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={4} className="pt-2 px-2 text-xs font-bold text-gray-500 uppercase">Total</td>
                    <td className="pt-2 px-2 text-right font-bold text-gray-900">{weekData.totalHours.toFixed(1)}h</td>
                    <td className="pt-2 px-2 text-right font-bold text-indigo-700">₹{weekData.totalEarnings.toFixed(0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Previous Payroll Record */}
        {user && (user.legacy_hours > 0 || user.legacy_earnings > 0 || user.already_paid > 0) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-bold text-gray-900 mb-3">Previous Payroll Record</h2>
            <div className="divide-y divide-gray-100">
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Total Hours Worked</span>
                <span className="text-sm font-semibold text-gray-800">{(user.legacy_hours ?? 0).toFixed(2)} hrs</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Total Earnings</span>
                <span className="text-sm font-semibold text-gray-800">₹{(user.legacy_earnings ?? 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Already Paid</span>
                <span className="text-sm font-semibold text-gray-800">₹{(user.already_paid ?? 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm font-semibold text-gray-700">Balance Due</span>
                {(() => {
                  const balance = (user.legacy_earnings ?? 0) - (user.already_paid ?? 0);
                  return (
                    <span className={`text-sm font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{balance.toFixed(0)}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/schedule" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:border-indigo-200 hover:shadow-md transition-all group">
            <p className="text-2xl mb-2">📅</p>
            <p className="font-bold text-gray-900 text-sm group-hover:text-indigo-700 transition-colors">Update Schedule →</p>
            <p className="text-xs text-gray-400 mt-0.5">Set your working days & hours</p>
          </Link>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 opacity-60">
            <p className="text-2xl mb-2">📊</p>
            <p className="font-bold text-gray-900 text-sm">Your History →</p>
            <p className="text-xs text-gray-400 mt-0.5">Coming soon</p>
          </div>
        </div>
      </main>
    </div>
  );
}

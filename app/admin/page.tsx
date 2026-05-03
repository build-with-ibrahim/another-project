'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DaySchedule {
  day: string;
  start_time: string;
  hours: number;
}

interface WeekAttendanceEntry {
  date: string;
  check_in: string | null;
  check_out: string | null;
  hours: number;
  earnings: number;
  is_matched: boolean | null;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  checkedInToday: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  hasScheduleThisWeek: boolean;
  schedule: { days_schedule: DaySchedule[]; locked_until: string } | null;
  weekAttendance: WeekAttendanceEntry[];
  totalHoursThisWeek: number;
  totalEarningsThisWeek: number;
  hourly_rate: number;
  legacy_hours: number;
  legacy_earnings: number;
  already_paid: number;
}

interface Overview {
  totalEmployees: number;
  activeNow: number;
  missingSchedule: string[];
  totalHoursThisWeek: number;
  totalEarningsThisWeek: number;
  employees: Employee[];
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs === 0) return `${mins}m ago`;
  return `${hrs}h ${remMins}m ago`;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: 'green' | 'amber' | 'indigo' | 'default' }) {
  const colorClass = {
    green: 'border-green-200 bg-green-50',
    amber: 'border-amber-200 bg-amber-50',
    indigo: 'border-indigo-200 bg-indigo-600',
    default: 'border-gray-100 bg-white',
  }[color ?? 'default'];
  const valClass = {
    green: 'text-green-700',
    amber: 'text-amber-700',
    indigo: 'text-white',
    default: 'text-gray-900',
  }[color ?? 'default'];
  const labelClass = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    indigo: 'text-indigo-200',
    default: 'text-gray-500',
  }[color ?? 'default'];

  return (
    <div className={`rounded-xl border shadow-sm p-5 ${colorClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${labelClass}`}>{label}</p>
      <p className={`text-3xl font-bold ${valClass}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${labelClass}`}>{sub}</p>}
    </div>
  );
}

function EmployeeCard({ emp, defaultOpen, onRateUpdate, onPaidUpdate }: { emp: Employee; defaultOpen: boolean; onRateUpdate: (id: number, rate: number) => void; onPaidUpdate: (id: number, paid: number) => void }) {
  const [open, setOpen] = useState(defaultOpen);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(emp.hourly_rate));
  const [rateSaving, setRateSaving] = useState(false);
  const [rateStatus, setRateStatus] = useState<'saved' | 'error' | null>(null);
  const [editingPaid, setEditingPaid] = useState(false);
  const [paidInput, setPaidInput] = useState(String(emp.already_paid));
  const [paidSaving, setPaidSaving] = useState(false);
  const [paidStatus, setPaidStatus] = useState<'saved' | 'error' | null>(null);

  async function handleSaveRate() {
    const newRate = Number(rateInput);
    if (!isFinite(newRate) || newRate <= 0) { setRateStatus('error'); return; }
    setRateSaving(true);
    setRateStatus(null);
    try {
      const res = await fetch(`/api/admin/employee/${emp.id}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourly_rate: newRate }),
      });
      if (res.ok) {
        onRateUpdate(emp.id, newRate);
        setEditingRate(false);
        setRateStatus('saved');
        setTimeout(() => setRateStatus(null), 2000);
      } else {
        setRateStatus('error');
      }
    } catch {
      setRateStatus('error');
    } finally {
      setRateSaving(false);
    }
  }

  async function handleSavePaid() {
    const newPaid = Number(paidInput);
    if (!isFinite(newPaid) || newPaid < 0) { setPaidStatus('error'); return; }
    setPaidSaving(true);
    setPaidStatus(null);
    try {
      const res = await fetch(`/api/admin/employee/${emp.id}/paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ already_paid: newPaid }),
      });
      if (res.ok) {
        onPaidUpdate(emp.id, newPaid);
        setEditingPaid(false);
        setPaidStatus('saved');
        setTimeout(() => setPaidStatus(null), 2000);
      } else {
        setPaidStatus('error');
      }
    } catch {
      setPaidStatus('error');
    } finally {
      setPaidSaving(false);
    }
  }

  const statusBadge = (() => {
    if (emp.checkOutTime) return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">Done for today</span>;
    if (emp.checkedInToday) return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">Checked In</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Not In</span>;
  })();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
            {emp.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-900 text-sm">{emp.name}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${emp.is_admin ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                {emp.is_admin ? 'Admin' : 'Employee'}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate">{emp.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {statusBadge}
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-6 py-4 space-y-4">
          {/* Schedule row */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Schedule This Week</p>
            {!emp.hasScheduleThisWeek || !emp.schedule ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-700">
                No schedule this week
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {emp.schedule.days_schedule.map(d => (
                  <span key={d.day} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                    {d.day.slice(0, 3)} · {d.start_time} · {d.hours}h
                  </span>
                ))}
                <span className="text-xs text-gray-400 ml-1">
                  Locked until {new Date(emp.schedule.locked_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Pay Rate */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pay Rate:</span>
            {!editingRate ? (
              <>
                <span className="text-sm font-semibold text-gray-800">₹{emp.hourly_rate}/hr</span>
                <button
                  onClick={() => { setRateInput(String(emp.hourly_rate)); setEditingRate(true); setRateStatus(null); }}
                  className="text-gray-400 hover:text-indigo-600 transition-colors text-base leading-none"
                  title="Edit rate"
                >
                  ✏️
                </button>
                {rateStatus === 'saved' && <span className="text-xs text-green-600 font-semibold">Saved ✓</span>}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                  className="w-20 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <span className="text-xs text-gray-500">/hr</span>
                <button
                  onClick={handleSaveRate}
                  disabled={rateSaving}
                  className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {rateSaving ? '…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingRate(false); setRateStatus(null); }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  Cancel
                </button>
                {rateStatus === 'error' && <span className="text-xs text-red-600 font-semibold">Failed to save</span>}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{emp.totalHoursThisWeek.toFixed(1)}h</p>
              <p className="text-xs text-gray-400 mt-0.5">Hours this week</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-indigo-700">₹{emp.totalEarningsThisWeek.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Earnings this week</p>
            </div>
          </div>

          {/* Payroll Summary */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Payroll Summary</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Total Hours</p>
                <p className="text-base font-bold text-gray-900">{emp.legacy_hours.toFixed(2)} hrs</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Total Earned</p>
                <p className="text-base font-bold text-gray-900">₹{emp.legacy_earnings.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Balance Due</p>
                <p className="text-base font-bold text-gray-900">₹{(emp.legacy_earnings - emp.already_paid).toFixed(0)}</p>
              </div>
            </div>
            {emp.already_paid > 0 && (
              <div className="mt-2 text-center">
                <span className="text-xs font-semibold text-green-600">Already Paid: ₹{emp.already_paid.toFixed(0)}</span>
              </div>
            )}
            {/* Edit Already Paid */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Already Paid:</span>
              {!editingPaid ? (
                <>
                  <span className="text-sm font-semibold text-gray-800">₹{emp.already_paid.toFixed(0)}</span>
                  <button
                    onClick={() => { setPaidInput(String(emp.already_paid)); setEditingPaid(true); setPaidStatus(null); }}
                    className="text-gray-400 hover:text-indigo-600 transition-colors text-base leading-none"
                    title="Edit already paid"
                  >
                    ✏️
                  </button>
                  {paidStatus === 'saved' && <span className="text-xs text-green-600 font-semibold">Saved ✓</span>}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={paidInput}
                    onChange={e => setPaidInput(e.target.value)}
                    className="w-24 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    onClick={handleSavePaid}
                    disabled={paidSaving}
                    className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {paidSaving ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingPaid(false); setPaidStatus(null); }}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1"
                  >
                    Cancel
                  </button>
                  {paidStatus === 'error' && <span className="text-xs text-red-600 font-semibold">Failed to save</span>}
                </div>
              )}
            </div>
          </div>

          {/* Attendance table */}
          {emp.weekAttendance.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">This Week&apos;s Attendance</p>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm min-w-125">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">Day</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Check In</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Check Out</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Hours</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Earnings</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {emp.weekAttendance.map(row => (
                      <tr key={row.date} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 text-gray-700 font-medium whitespace-nowrap">
                          {new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDateShort(row.date)}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtTime(row.check_in)}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtTime(row.check_out)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{row.hours > 0 ? `${row.hours.toFixed(1)}h` : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-indigo-600">{row.earnings > 0 ? `₹${row.earnings.toFixed(0)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          {row.is_matched === true ? (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 text-xs font-semibold px-2 py-0.5 rounded-full">On time</span>
                          ) : row.is_matched === false ? (
                            <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 text-xs font-semibold px-2 py-0.5 rounded-full">Late</span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-500 uppercase">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{emp.totalHoursThisWeek.toFixed(1)}h</td>
                      <td className="px-3 py-2 text-right font-bold text-indigo-700">₹{emp.totalEarningsThisWeek.toFixed(0)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  function handleRateUpdate(employeeId: number, newRate: number) {
    setOverview(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.map(e =>
          e.id === employeeId ? { ...e, hourly_rate: newRate } : e
        ),
      };
    });
  }

  function handlePaidUpdate(employeeId: number, newPaid: number) {
    setOverview(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.map(e =>
          e.id === employeeId ? { ...e, already_paid: newPaid } : e
        ),
      };
    });
  }

  const fetchData = useCallback(async () => {
    const [overviewRes, meRes] = await Promise.all([
      fetch('/api/admin/overview'),
      fetch('/api/auth/me'),
    ]);
    if (overviewRes.status === 401) { router.push('/'); return; }
    if (overviewRes.status === 403) { setAccessDenied(true); setLoading(false); return; }
    const [overviewData, meData] = await Promise.all([overviewRes.json(), meRes.json()]);
    setOverview(overviewData);
    setUserEmail(meData?.email ?? '');
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-4xl mb-4">🚫</p>
          <p className="text-gray-700 text-lg font-semibold">Access Denied</p>
          <p className="text-gray-400 text-sm mt-1">You are not an admin.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-indigo-600 text-sm font-medium hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const { totalEmployees, activeNow, missingSchedule, totalHoursThisWeek, totalEarningsThisWeek, employees } = overview;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Employee Tracker — Admin</span>
          </div>
          <div className="flex items-center gap-3">
            {userEmail && <span className="text-xs text-gray-500 hidden sm:block">{userEmail}</span>}
            <button
              onClick={handleLogout}
              className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 font-medium rounded-lg px-3 py-1.5 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Full team overview</p>
        </div>

        {/* Section 1: Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Employees" value={totalEmployees} />
          <StatCard
            label="Active Right Now"
            value={`${activeNow} 🟢`}
            sub={activeNow === 1 ? '1 person in office' : `${activeNow} people in office`}
            color="green"
          />
          <StatCard
            label="Missing Schedule"
            value={`${missingSchedule.length} ⚠️`}
            sub={missingSchedule.length > 0 ? missingSchedule.slice(0, 2).join(', ') + (missingSchedule.length > 2 ? ` +${missingSchedule.length - 2}` : '') : 'All schedules set'}
            color={missingSchedule.length > 0 ? 'amber' : 'default'}
          />
          <StatCard
            label="Team Earnings This Week"
            value={`₹${totalEarningsThisWeek.toFixed(0)}`}
            sub={`${totalHoursThisWeek.toFixed(1)} hours total`}
            color="indigo"
          />
        </div>

        {/* Section 2: Currently in office */}
        {activeNow > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-3">🟢 Currently In Office</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {employees
                .filter(e => e.checkedInToday && !e.checkOutTime)
                .map(emp => (
                  <div key={emp.id} className="border-l-4 border-green-400 bg-white rounded-xl shadow-sm px-4 py-3 min-w-45 shrink-0">
                    <p className="font-bold text-gray-900 text-sm">{emp.name}</p>
                    {emp.checkInTime && (
                      <>
                        <p className="text-xs text-gray-500 mt-0.5">In at {fmtTime(emp.checkInTime)}</p>
                        <p className="text-xs text-green-600 font-semibold mt-0.5">{timeAgo(emp.checkInTime)}</p>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Section 3: Missing schedule banner */}
        {missingSchedule.length > 0 && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-500 text-lg mt-0.5">⚠️</span>
            <p className="text-sm text-amber-900 font-medium">
              {missingSchedule.length === 1
                ? `${missingSchedule[0]} hasn't updated their schedule for this week.`
                : missingSchedule.length <= 3
                ? `${missingSchedule.join(', ')} haven't updated their schedule for this week.`
                : `${missingSchedule.slice(0, 2).join(', ')}, and ${missingSchedule.length - 2} others haven't updated their schedule for this week.`}
            </p>
          </div>
        )}

        {/* Section 4: All employees */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4">All Employees</h2>
          {employees.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">No employees found.</p>
          )}
          {employees.map((emp, i) => (
            <EmployeeCard key={emp.id} emp={emp} defaultOpen={i < 3} onRateUpdate={handleRateUpdate} onPaidUpdate={handlePaidUpdate} />
          ))}
        </div>
      </main>
    </div>
  );
}

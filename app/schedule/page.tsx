'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

interface DaySchedule {
  day: string;
  start_time: string;
  hours: number;
}

interface Schedule {
  days_schedule: DaySchedule[];
  locked_until: string;
}

function getWeekRange(weekStart: string): string {
  if (!weekStart) return '';
  const mon = new Date(weekStart + 'T00:00:00');
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function getDaysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// A day is within the 24-hour restriction if its local midnight is less than now + 24h
function isDayWithin24h(weekStart: string, dayName: string): boolean {
  if (!weekStart) return false;
  const idx = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(dayName);
  const d = new Date(weekStart + 'T00:00:00'); // local midnight of Monday
  d.setDate(d.getDate() + idx);               // local midnight of target day
  return d.getTime() < Date.now() + 24 * 60 * 60 * 1000;
}

export default function SchedulePage() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state: selected days + per-day configs
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [dayConfigs, setDayConfigs] = useState<Record<string, { start_time: string; hours: number }>>({});

  const fetchSchedule = useCallback(async () => {
    const res = await fetch('/api/schedule');
    if (res.status === 401) { router.push('/'); return; }
    const data = await res.json();
    setSchedule(data.schedule);
    setWeekStart(data.weekStart);
    if (data.schedule) {
      const days = (data.schedule.days_schedule as DaySchedule[]).map(d => d.day);
      setSelectedDays(days);
      const configs: Record<string, { start_time: string; hours: number }> = {};
      (data.schedule.days_schedule as DaySchedule[]).forEach(d => {
        configs[d.day] = { start_time: d.start_time, hours: d.hours };
      });
      setDayConfigs(configs);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const isLocked = schedule ? Date.now() < new Date(schedule.locked_until).getTime() : false;

  function toggleDay(day: string) {
    if (isLocked) return;
    if (isDayWithin24h(weekStart, day)) return;
    setSelectedDays(prev => {
      if (prev.includes(day)) return prev.filter(d => d !== day);
      if (!dayConfigs[day]) {
        setDayConfigs(c => ({ ...c, [day]: { start_time: '09:00', hours: 8 } }));
      }
      return [...prev, day];
    });
  }

  function updateDayConfig(day: string, field: 'start_time' | 'hours', value: string | number) {
    setDayConfigs(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    setRowErrors(prev => { const n = { ...prev }; delete n[day]; return n; });
  }

  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const canSave = selectedDays.length > 0 && selectedDays.every(d => dayConfigs[d]?.start_time && (dayConfigs[d]?.hours ?? 0) > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Inline validation
    const errors: Record<string, string> = {};
    selectedDays.forEach(d => {
      if (!dayConfigs[d]?.start_time) errors[d] = 'Start time required';
      else if ((dayConfigs[d]?.hours ?? 0) <= 0) errors[d] = 'Hours must be > 0';
    });
    setRowErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const days_schedule: DaySchedule[] = DAYS
        .filter(d => selectedDays.includes(d))
        .map(d => ({ day: d, start_time: dayConfigs[d].start_time, hours: dayConfigs[d].hours || 8 }));

      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_schedule }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
      } else {
        const dayAbbrs = days_schedule.map(d => DAY_SHORT[d.day]).join(', ');
        setSuccess(`Schedule saved! See you ${dayAbbrs}`);
        await fetchSchedule();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-50 to-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <div className="text-center">
            <h1 className="font-bold text-gray-900">Weekly Schedule</h1>
            {weekStart && <p className="text-xs text-gray-400 mt-0.5">{getWeekRange(weekStart)}</p>}
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Banners */}
        {!schedule && !isLocked && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
            <span className="text-red-500 text-lg mt-0.5">⚠</span>
            <div>
              <p className="font-semibold text-sm">Schedule not set for this week</p>
              <p className="text-xs text-red-600 mt-0.5">Please update before starting work</p>
            </div>
          </div>
        )}

        {isLocked && schedule && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-semibold text-sm">Schedule Locked</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Updates available in {getDaysUntil(schedule.locked_until)} day{getDaysUntil(schedule.locked_until) !== 1 ? 's' : ''}
                {' '}(until {new Date(schedule.locked_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
              </p>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6">
            {isLocked ? 'Current Schedule' : (schedule ? 'Update Schedule' : 'Set Your Schedule')}
          </h2>

          {success && (
            <div className="mb-5 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm font-medium flex items-center gap-2">
              <span>✓</span> {success}
            </div>
          )}
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
          )}

          {/* Day Pill Selector */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">Working Days</p>
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map(day => {
                const selected = selectedDays.includes(day);
                const restricted = !isLocked && isDayWithin24h(weekStart, day);
                const disabled = isLocked || restricted;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    disabled={disabled}
                    title={restricted ? 'Cannot select days within 24 hours' : undefined}
                    className={`relative flex flex-col items-center justify-center py-3 rounded-xl border-2 text-xs font-semibold transition-all duration-150 ${
                      selected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                        : isLocked
                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-default'
                        : restricted
                        ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer'
                    }`}
                  >
                    <span className="text-sm font-bold">{DAY_SHORT[day]}</span>
                    {selected && (
                      <span className="absolute top-1 right-1 text-indigo-200 text-[10px]">✓</span>
                    )}
                    {restricted && !isLocked && (
                      <span className="text-[8px] text-gray-300 mt-0.5 leading-none">–24h</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per-Day Timing Rows */}
          {selectedDays.length > 0 && (
            <div className="space-y-3 mb-6">
              <p className="text-sm font-semibold text-gray-700">Day Timings</p>
              {DAYS.filter(d => selectedDays.includes(d)).map(day => (
                <div key={day}>
                <div
                  className={`flex items-center gap-4 rounded-xl px-4 py-3 border ${rowErrors[day] ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}
                >
                  <span className="w-24 text-sm font-bold text-indigo-700 shrink-0">{day}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-gray-500 shrink-0">Arrives at</label>
                    <input
                      type="time"
                      value={dayConfigs[day]?.start_time || '09:00'}
                      onChange={e => updateDayConfig(day, 'start_time', e.target.value)}
                      disabled={isLocked}
                      className="px-3 py-1.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 shrink-0">Hours</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isLocked || (dayConfigs[day]?.hours || 8) <= 1}
                        onClick={() => updateDayConfig(day, 'hours', Math.max(1, (dayConfigs[day]?.hours || 8) - 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-indigo-200 text-indigo-600 flex items-center justify-center text-lg font-bold hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-default transition-colors"
                      >−</button>
                      <span className="w-8 text-center text-sm font-bold text-gray-800">
                        {dayConfigs[day]?.hours || 8}
                      </span>
                      <button
                        type="button"
                        disabled={isLocked || (dayConfigs[day]?.hours || 8) >= 12}
                        onClick={() => updateDayConfig(day, 'hours', Math.min(12, (dayConfigs[day]?.hours || 8) + 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-indigo-200 text-indigo-600 flex items-center justify-center text-lg font-bold hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-default transition-colors"
                      >+</button>
                    </div>
                  </div>
                </div>
                {rowErrors[day] && (
                  <p className="text-xs text-red-600 font-medium mt-1 ml-1">{rowErrors[day]}</p>
                )}
                </div>
              ))}
            </div>
          )}

          {selectedDays.length === 0 && !isLocked && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Select working days above to configure timings
            </div>
          )}

          {/* Save Button */}
          {!isLocked && (
            <button
              onClick={handleSubmit}
              disabled={saving || !canSave}
              className="w-full bg-linear-to-r from-indigo-600 to-indigo-700 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Save Schedule'}
            </button>
          )}

          {/* Locked read-only display */}
          {isLocked && schedule && (
            <div className="mt-2 text-center text-xs text-gray-400">
              Next update available:{' '}
              <span className="font-semibold text-gray-600">
                {new Date(schedule.locked_until).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

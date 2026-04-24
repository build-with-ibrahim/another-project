'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Attendance {
    id: string
    clockIn: string | null
    clockOut: string | null
    date: string
}

interface Schedule {
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
}

interface Earnings {
    hourlyRate: number
    weekHours: number
    monthHours: number
    totalHours: number
    weekEarnings: number
    monthEarnings: number
    totalEarnings: number
}

interface Profile {
    id: string
    name: string
    email: string
    hourlyRate: number
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function calcDuration(clockIn: string | null, clockOut: string | null) {
    if (!clockIn || !clockOut) return '—'
    const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
}

export default function DashboardPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [now, setNow] = useState(new Date())
    const [today, setToday] = useState<Attendance | null>(null)
    const [history, setHistory] = useState<Attendance[]>([])
    const [, setSchedules] = useState<Schedule[]>([])
    const [earnings, setEarnings] = useState<Earnings | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [activeTab, setActiveTab] = useState<'attendance' | 'schedule' | 'earnings' | 'settings'>('attendance')

    // Schedule form: day index -> {enabled, start, end}
    const [scheduleForm, setScheduleForm] = useState<{ [key: number]: { enabled: boolean, start: string, end: string } }>({})
    const [schedSaving, setSchedSaving] = useState(false)
    const [schedSaved, setSchedSaved] = useState(false)

    // Settings form
    const [settingsName, setSettingsName] = useState('')
    const [settingsRate, setSettingsRate] = useState('')
    const [settingsSaving, setSettingsSaving] = useState(false)
    const [settingsSaved, setSettingsSaved] = useState(false)

    // Clock action feedback
    const [clockLoading, setClockLoading] = useState(false)
    const [clockError, setClockError] = useState('')

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Auth guard
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        }
    }, [status, router])

    const safeJson = async (res: Response) => {
        const text = await res.text()
        if (!text) return null
        try { return JSON.parse(text) } catch { return null }
    }

    const fetchAll = useCallback(async () => {
        const [todayRes, histRes, schRes, earnRes, profRes] = await Promise.all([
            fetch('/api/attendance/today'),
            fetch('/api/attendance/history'),
            fetch('/api/schedule'),
            fetch('/api/earnings'),
            fetch('/api/profile'),
        ])
        const [todayData, histData, schData, earnData, profData] = await Promise.all([
            safeJson(todayRes),
            safeJson(histRes),
            safeJson(schRes),
            safeJson(earnRes),
            safeJson(profRes),
        ])
        setToday(todayData)
        setHistory(histData ?? [])
        setSchedules(schData ?? [])
        setEarnings(earnData)
        setProfile(profData)

        // Init schedule form
        const form: typeof scheduleForm = {}
        for (let i = 0; i < 7; i++) {
            const existing = (schData ?? []).find((s: Schedule) => s.dayOfWeek === i)
            form[i] = existing
                ? { enabled: true, start: existing.startTime, end: existing.endTime }
                : { enabled: false, start: '09:00', end: '17:00' }
        }
        setScheduleForm(form)
        setSettingsName(profData?.name || '')
        setSettingsRate(String(profData?.hourlyRate || 0))
        setLoaded(true)
    }, [])

    useEffect(() => {
        if (status === 'authenticated') fetchAll()
    }, [status, fetchAll])

    const handleClockIn = async () => {
        setClockLoading(true)
        setClockError('')
        const res = await fetch('/api/attendance/clock-in', { method: 'POST' })
        if (!res.ok) {
            const d = await res.json()
            setClockError(d.error || 'Failed to clock in')
        }
        await fetchAll()
        setClockLoading(false)
    }

    const handleClockOut = async () => {
        setClockLoading(true)
        setClockError('')
        const res = await fetch('/api/attendance/clock-out', { method: 'POST' })
        if (!res.ok) {
            const d = await res.json()
            setClockError(d.error || 'Failed to clock out')
        }
        await fetchAll()
        setClockLoading(false)
    }

    const handleScheduleSave = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        setSchedSaving(true)
        const schedulesToSend = Object.entries(scheduleForm)
            .filter(([, v]) => v.enabled && v.start && v.end)
            .map(([day, times]) => ({
                dayOfWeek: parseInt(day),
                startTime: times.start,
                endTime: times.end
            }))
        await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedules: schedulesToSend })
        })
        await fetchAll()
        setSchedSaving(false)
        setSchedSaved(true)
        setTimeout(() => setSchedSaved(false), 2000)
    }

    const handleSettingsSave = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        setSettingsSaving(true)
        await fetch('/api/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: settingsName, hourlyRate: parseFloat(settingsRate) || 0 })
        })
        await fetchAll()
        setSettingsSaving(false)
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 2000)
    }

    if (status === 'loading' || !loaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-500 text-lg">Loading...</div>
            </div>
        )
    }

    const isClockedIn = today?.clockIn && !today?.clockOut
    const isClockedOut = today?.clockIn && today?.clockOut

    const todayName = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Employee Attendance</h1>
                        <p className="text-sm text-gray-500">Welcome back, {profile?.name || session?.user?.name || 'Employee'}</p>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

                {/* Live Clock Card */}
                <div className="bg-indigo-600 text-white rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <div className="text-4xl font-mono font-bold tracking-wide">{timeStr}</div>
                        <div className="text-indigo-200 mt-1">{todayName}</div>
                    </div>
                    <div className="text-center">
                        <div className={`inline-block px-4 py-1 rounded-full text-sm font-medium mb-3 ${isClockedIn ? 'bg-green-400 text-green-900' : isClockedOut ? 'bg-gray-300 text-gray-700' : 'bg-indigo-400 text-white'}`}>
                            {isClockedIn ? 'Currently Working' : isClockedOut ? 'Done for Today' : 'Not Clocked In'}
                        </div>
                        <div className="flex gap-3 justify-center">
                            {!today?.clockIn && (
                                <button
                                    onClick={handleClockIn}
                                    disabled={clockLoading}
                                    className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition"
                                >
                                    {clockLoading ? '...' : 'Sign In'}
                                </button>
                            )}
                            {isClockedIn && (
                                <button
                                    onClick={handleClockOut}
                                    disabled={clockLoading}
                                    className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition"
                                >
                                    {clockLoading ? '...' : 'Sign Out'}
                                </button>
                            )}
                        </div>
                        {clockError && <p className="text-red-300 text-sm mt-2">{clockError}</p>}
                    </div>
                </div>

                {/* Today's Summary */}
                {today?.clockIn && (
                    <div className="bg-white rounded-xl shadow-sm p-4 flex gap-6 text-center">
                        <div className="flex-1">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Signed In</div>
                            <div className="text-lg font-semibold text-gray-900 mt-1">{formatTime(today.clockIn)}</div>
                        </div>
                        <div className="flex-1 border-x">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Signed Out</div>
                            <div className="text-lg font-semibold text-gray-900 mt-1">{formatTime(today.clockOut)}</div>
                        </div>
                        <div className="flex-1">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Hours Today</div>
                            <div className="text-lg font-semibold text-gray-900 mt-1">
                                {today.clockOut ? calcDuration(today.clockIn, today.clockOut) : 'In progress'}
                            </div>
                        </div>
                    </div>
                )}

                {/* Earnings Quick Stats */}
                {earnings && (
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'This Week', hours: earnings.weekHours, amount: earnings.weekEarnings },
                            { label: 'This Month', hours: earnings.monthHours, amount: earnings.monthEarnings },
                            { label: 'All Time', hours: earnings.totalHours, amount: earnings.totalEarnings },
                        ].map(({ label, hours, amount }) => (
                            <div key={label} className="bg-white rounded-xl shadow-sm p-4 text-center">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
                                <div className="text-2xl font-bold text-indigo-600 mt-1">₹{amount.toFixed(2)}</div>
                                <div className="text-sm text-gray-500">{hours}h worked</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="flex border-b">
                        {(['attendance', 'schedule', 'earnings', 'settings'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-sm font-medium capitalize transition ${activeTab === tab ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">

                        {/* Attendance History Tab */}
                        {activeTab === 'attendance' && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance History</h2>
                                {history.length === 0 ? (
                                    <p className="text-gray-500">No attendance records yet.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b">
                                                    <th className="pb-2 pr-4">Date</th>
                                                    <th className="pb-2 pr-4">Sign In</th>
                                                    <th className="pb-2 pr-4">Sign Out</th>
                                                    <th className="pb-2">Duration</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map(r => (
                                                    <tr key={r.id} className="border-b last:border-0">
                                                        <td className="py-3 pr-4 font-medium text-gray-900">{formatDate(r.date)}</td>
                                                        <td className="py-3 pr-4 text-gray-600">{formatTime(r.clockIn)}</td>
                                                        <td className="py-3 pr-4 text-gray-600">{formatTime(r.clockOut)}</td>
                                                        <td className="py-3 text-gray-600">{calcDuration(r.clockIn, r.clockOut)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Schedule Tab */}
                        {activeTab === 'schedule' && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">Weekly Schedule</h2>
                                <p className="text-sm text-gray-500 mb-5">Check the days you work and set your start/end times.</p>
                                <form onSubmit={handleScheduleSave} className="space-y-3">
                                    {DAY_NAMES.map((day, i) => (
                                        <div key={i} className={`flex items-center gap-4 p-3 rounded-lg border ${scheduleForm[i]?.enabled ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
                                            <input
                                                type="checkbox"
                                                id={`day-${i}`}
                                                checked={scheduleForm[i]?.enabled || false}
                                                onChange={e => setScheduleForm(prev => ({ ...prev, [i]: { ...prev[i], enabled: e.target.checked } }))}
                                                className="w-4 h-4 accent-indigo-600"
                                            />
                                            <label htmlFor={`day-${i}`} className="w-24 font-medium text-gray-700 cursor-pointer">{day}</label>
                                            <div className={`flex items-center gap-2 transition ${scheduleForm[i]?.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                                <input
                                                    type="time"
                                                    value={scheduleForm[i]?.start || '09:00'}
                                                    onChange={e => setScheduleForm(prev => ({ ...prev, [i]: { ...prev[i], start: e.target.value } }))}
                                                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                                                />
                                                <span className="text-gray-400">to</span>
                                                <input
                                                    type="time"
                                                    value={scheduleForm[i]?.end || '17:00'}
                                                    onChange={e => setScheduleForm(prev => ({ ...prev, [i]: { ...prev[i], end: e.target.value } }))}
                                                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={schedSaving}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50"
                                        >
                                            {schedSaving ? 'Saving...' : 'Save Schedule'}
                                        </button>
                                        {schedSaved && <span className="text-green-600 text-sm">Saved!</span>}
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Earnings Tab */}
                        {activeTab === 'earnings' && earnings && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">Earnings Breakdown</h2>
                                <p className="text-sm text-gray-500 mb-5">Based on your hourly rate of <span className="font-semibold text-gray-700">₹{earnings.hourlyRate}/hr</span>. Update it in Settings.</p>
                                <div className="space-y-4">
                                    {[
                                        { period: 'This Week', hours: earnings.weekHours, amount: earnings.weekEarnings },
                                        { period: 'This Month', hours: earnings.monthHours, amount: earnings.monthEarnings },
                                        { period: 'All Time', hours: earnings.totalHours, amount: earnings.totalEarnings },
                                    ].map(({ period, hours, amount }) => (
                                        <div key={period} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                            <div>
                                                <div className="font-medium text-gray-900">{period}</div>
                                                <div className="text-sm text-gray-500">{hours} hours worked</div>
                                            </div>
                                            <div className="text-2xl font-bold text-indigo-600">₹{amount.toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Settings Tab */}
                        {activeTab === 'settings' && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-5">Profile & Settings</h2>
                                <form onSubmit={handleSettingsSave} className="space-y-4 max-w-sm">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={settingsName}
                                            onChange={e => setSettingsName(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (₹)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={settingsRate}
                                            onChange={e => setSettingsRate(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="e.g. 25.00"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Used to calculate your earnings from hours worked.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="submit"
                                            disabled={settingsSaving}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50"
                                        >
                                            {settingsSaving ? 'Saving...' : 'Save Settings'}
                                        </button>
                                        {settingsSaved && <span className="text-green-600 text-sm">Saved!</span>}
                                    </div>
                                </form>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}

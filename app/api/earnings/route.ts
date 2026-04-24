import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getDemoUserId } from '@/lib/demoUser'
import { NextResponse } from 'next/server'

export async function GET() {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? await getDemoUserId()

    const user = await prisma.user.findUnique({ where: { id: userId } })
    const hourlyRate = user?.hourlyRate ?? 0

    // This week (Monday to now)
    const now = new Date()
    const weekStart = new Date(now)
    const day = weekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    weekStart.setDate(weekStart.getDate() + diff)
    weekStart.setHours(0, 0, 0, 0)

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [weekRecords, monthRecords, allRecords] = await Promise.all([
        prisma.attendance.findMany({ where: { userId, date: { gte: weekStart } } }),
        prisma.attendance.findMany({ where: { userId, date: { gte: monthStart } } }),
        prisma.attendance.findMany({ where: { userId } })
    ])

    const calcHours = (records: { clockIn: Date | null, clockOut: Date | null }[]) =>
        records.reduce((total, r) => {
            if (!r.clockIn || !r.clockOut) return total
            const ms = new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()
            return total + ms / 3600000
        }, 0)

    const weekHours = calcHours(weekRecords)
    const monthHours = calcHours(monthRecords)
    const totalHours = calcHours(allRecords)

    return NextResponse.json({
        hourlyRate,
        weekHours: Math.round(weekHours * 100) / 100,
        monthHours: Math.round(monthHours * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        weekEarnings: Math.round(weekHours * hourlyRate * 100) / 100,
        monthEarnings: Math.round(monthHours * hourlyRate * 100) / 100,
        totalEarnings: Math.round(totalHours * hourlyRate * 100) / 100,
    })
}

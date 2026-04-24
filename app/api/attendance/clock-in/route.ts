import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getDemoUserId } from '@/lib/demoUser'
import { NextResponse } from 'next/server'

export async function POST() {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? await getDemoUserId()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const existing = await prisma.attendance.findFirst({
        where: {
            userId,
            date: {
                gte: today,
                lt: tomorrow
            }
        }
    })

    if (existing) {
        return NextResponse.json({ error: 'Already clocked in today' }, { status: 400 })
    }

    const attendance = await prisma.attendance.create({
        data: {
            userId,
            clockIn: new Date(),
            date: today
        }
    })

    return NextResponse.json(attendance)
}
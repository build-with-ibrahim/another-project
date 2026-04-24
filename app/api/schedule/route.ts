import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getDemoUserId } from '@/lib/demoUser'
import { NextResponse } from 'next/server'

function getMonday(d: Date) {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    return new Date(date.setDate(diff))
}

export async function GET() {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? await getDemoUserId()

    const weekStart = getMonday(new Date())

    const schedules = await prisma.schedule.findMany({
        where: {
            userId,
            weekStart
        },
        orderBy: { dayOfWeek: 'asc' }
    })

    return NextResponse.json(schedules)
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? await getDemoUserId()

    const body = await request.json()
    const { schedules } = body // array of {dayOfWeek, startTime, endTime}

    const weekStart = getMonday(new Date())

    // Delete existing
    await prisma.schedule.deleteMany({
        where: {
            userId,
            weekStart
        }
    })

    // Create new
    const newSchedules = await Promise.all(
        schedules.map((s: any) =>
            prisma.schedule.create({
                data: {
                    userId,
                    dayOfWeek: s.dayOfWeek,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    weekStart
                }
            })
        )
    )

    return NextResponse.json(newSchedules)
}
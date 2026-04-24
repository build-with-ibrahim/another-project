import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getDemoUserId } from '@/lib/demoUser'
import { NextResponse } from 'next/server'

export async function GET() {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? await getDemoUserId()

    const records = await prisma.attendance.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 30
    })

    return NextResponse.json(records)
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getDemoUserId } from '@/lib/demoUser'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user?.id ?? await getDemoUserId()

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, hourlyRate: true }
        })

        return NextResponse.json(user ?? { id: userId, name: '', email: '', hourlyRate: 0 })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user?.id ?? await getDemoUserId()

        const body = await request.json()
        const { name, hourlyRate } = body

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(name !== undefined && { name }),
                ...(hourlyRate !== undefined && { hourlyRate: parseFloat(hourlyRate) })
            },
            select: { id: true, name: true, email: true, hourlyRate: true }
        })

        return NextResponse.json(updated)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const DEMO_EMAIL = 'demo@attendance.local'
const DEMO_PASSWORD = 'password'

export async function getDemoUserId() {
    let user = await prisma.user.findUnique({
        where: { email: DEMO_EMAIL }
    })

    if (!user) {
        const password = await bcrypt.hash(DEMO_PASSWORD, 10)
        user = await prisma.user.create({
            data: {
                email: DEMO_EMAIL,
                name: 'Demo User',
                password
            }
        })
    }

    return user.id
}

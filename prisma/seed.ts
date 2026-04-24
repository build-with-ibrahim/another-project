import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const hashed = await bcrypt.hash('password', 10)
    await prisma.user.create({
        data: {
            email: 'employee@example.com',
            name: 'Employee',
            password: hashed
        }
    })
    console.log('User created')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
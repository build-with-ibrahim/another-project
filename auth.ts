import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null
                try {
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email }
                    })
                    if (!user) return null
                    const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
                    if (!isPasswordValid) return null
                    return { id: user.id, email: user.email, name: user.name }
                } catch {
                    return null
                }
            }
        })
    ],
    session: {
        strategy: 'jwt' as const
    },
    pages: {
        signIn: '/login'
    },
    callbacks: {
        session: async ({ session, token }: any) => {
            if (token) {
                session.user.id = token.id as string
            }
            return session
        },
        jwt: async ({ token, user }: any) => {
            if (user) {
                token.id = user.id
            }
            return token
        }
    }
}

export default NextAuth(authOptions)

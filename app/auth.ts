import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient();

export const authConfig = {
    adapter: PrismaAdapter(prisma),
    trustHost: true,
    session: { strategy: 'database' },
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            authorization: {
                params: {
                    prompt: 'select_account',
                    access_type: 'offline',
                    response_type: 'code',
                    hd: 'vitstudent.ac.in',
                },
            },
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session?.user) {
                ;(session.user as any).id = user.id
                if (!session.user.email) session.user.email = user.email
            }
            return session
        },
    },
            logger: {
                error(error: Error) {
                    console.error('[next-auth error]', error)
                },
            },
} satisfies Parameters<typeof NextAuth>[0]

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)


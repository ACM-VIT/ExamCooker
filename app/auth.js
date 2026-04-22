import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

const adapter = PrismaAdapter(prisma);
const ROLE_REFRESH_INTERVAL_SECONDS = 5 * 60;

export const authConfig = {
  adapter,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          hd: "vitstudent.ac.in",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000);

      if (user) {
        token.id = user.id;
        token.role = user.role ?? "USER";
        token.roleSyncedAt = now;
        return token;
      }

      const lastSyncedAt = Number(token.roleSyncedAt ?? 0);
      const userId = typeof token.id === "string" ? token.id : null;
      if (
        userId &&
        (!lastSyncedAt || now - lastSyncedAt > ROLE_REFRESH_INTERVAL_SECONDS)
      ) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });
          if (dbUser?.role) token.role = dbUser.role;
          token.roleSyncedAt = now;
        } catch (error) {
          console.error("[auth] role refresh failed", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        if (typeof token.id === "string") session.user.id = token.id;
        session.user.role = token.role === "MODERATOR" ? "MODERATOR" : "USER";
      }
      return session;
    },
  },
  logger: {
    error(error) {
      console.error("[next-auth error]", error);
    },
  },
};

const nextAuth = NextAuth(authConfig);

export const { handlers, auth, signIn, signOut } = nextAuth;
export default nextAuth;

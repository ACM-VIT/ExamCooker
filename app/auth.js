import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

const adapter = PrismaAdapter(prisma);

export const authConfig = {
  adapter,
  trustHost: true,
  session: { strategy: "database" },
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
    async session({ session, user }) {
      if (session?.user) {
        session.user.id = user.id;
        if (!session.user.email) session.user.email = user.email;
        session.user.role = user.role;
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

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export default NextAuth(authConfig);

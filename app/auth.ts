import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next";
import NextAuth from "next-auth";
import { getServerSession } from "next-auth/next";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import type { PrismaClient as NextAuthPrismaClient } from "@/prisma/generated/client";
import { hasDatabaseUrl, hasGoogleAuthConfig } from "@/lib/serverEnv";

if (process.env.NODE_ENV === "development") {
  process.env.NEXTAUTH_URL ??= "http://localhost:3000";
}

const prismaForAuth = prisma as unknown as NextAuthPrismaClient;
const databaseConfigured = hasDatabaseUrl();
const googleAuthConfigured = hasGoogleAuthConfig();
const adapter = databaseConfigured ? PrismaAdapter(prismaForAuth) : undefined;
const ROLE_REFRESH_INTERVAL_SECONDS = 5 * 60;
let warnedAboutStaleSessionCookie = false;
type AppRole = "USER" | "MODERATOR";
type AuthToken = {
  id?: string;
  role?: AppRole;
  roleSyncedAt?: number;
};
type AuthUser = {
  id?: string;
  role?: AppRole | null;
};
type JwtCallbackParams = {
  token: AuthToken;
  user?: AuthUser | null;
};
type SessionCallbackParams = {
  session: {
    expires: string;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      id?: string;
      role?: AppRole;
    };
  };
  token: AuthToken;
};

function isStaleSessionCookieError(code: string, metadata: unknown) {
  return (
    code === "JWT_SESSION_ERROR" &&
    typeof metadata === "object" &&
    metadata !== null &&
    "code" in metadata &&
    metadata.code === "ERR_JWE_INVALID"
  );
}

export const authConfig = {
  adapter,
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "examcooker-local-dev-secret" : undefined),
  trustHost: true,
  session: { strategy: "jwt" as const },
  providers: googleAuthConfigured
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID!,
          clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          authorization: {
            params: {
              prompt: "select_account",
              access_type: "offline",
              response_type: "code",
              hd: "vitstudent.ac.in",
            },
          },
        }),
      ]
    : [],
  callbacks: {
    async jwt({ token, user }: JwtCallbackParams) {
      const now = Math.floor(Date.now() / 1000);

      if (user) {
        if (typeof user.id === "string") {
          token.id = user.id;
        }
        token.role = user.role ?? "USER";
        token.roleSyncedAt = now;
        return token;
      }

      const lastSyncedAt = Number(token.roleSyncedAt ?? 0);
      const userId = typeof token.id === "string" ? token.id : null;
      if (
        databaseConfigured &&
        userId &&
        (!lastSyncedAt || now - lastSyncedAt > ROLE_REFRESH_INTERVAL_SECONDS)
      ) {
        try {
          const dbUser = await prismaForAuth.user.findUnique({
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
    async session({ session, token }: SessionCallbackParams) {
      if (session?.user) {
        if (typeof token.id === "string") session.user.id = token.id;
        session.user.role = token.role === "MODERATOR" ? "MODERATOR" : "USER";
      }
      return session;
    },
  },
  logger: {
    error(code: string, metadata: unknown) {
      if (isStaleSessionCookieError(code, metadata)) {
        if (!warnedAboutStaleSessionCookie) {
          console.warn(
            "[next-auth] Ignoring stale session cookie left over from the beta auth build. Sign in again to refresh it.",
          );
          warnedAboutStaleSessionCookie = true;
        }
        return;
      }

      console.error("[next-auth error]", code, metadata);
    },
  },
};

export const authHandler = NextAuth(authConfig);

export function auth(
  ...args:
    | [GetServerSidePropsContext["req"], GetServerSidePropsContext["res"]]
    | [NextApiRequest, NextApiResponse]
    | []
) {
  return getServerSession(...args, authConfig);
}

export default authHandler;

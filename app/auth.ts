import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next";
import { after } from "next/server";
import { cache } from "react";
import NextAuth from "next-auth";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { createAuthAdapter } from "@/db/auth-adapter";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { createPostHogServer } from "@/lib/posthog-server";

const adapter = createAuthAdapter();
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
  session: Session;
  token: AuthToken;
};

function requiredEnv(name: "AUTH_GOOGLE_ID" | "AUTH_GOOGLE_SECRET") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required auth environment variable: ${name}`);
  }

  return value;
}

function isStaleSessionCookieError(code: string, metadata: unknown) {
  return (
    code === "JWT_SESSION_ERROR" &&
    typeof metadata === "object" &&
    metadata !== null &&
    "code" in metadata &&
    metadata.code === "ERR_JWE_INVALID"
  );
}

async function captureAuthServerEvent(input: {
  distinctId?: string;
  event: string;
  properties: Record<string, string | number | boolean | null | undefined>;
}) {
  if (!input.distinctId) {
    return;
  }

  try {
    const posthog = createPostHogServer();
    if (!posthog) {
      return;
    }

    posthog.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
    });
    await posthog.shutdown();
  } catch (error) {
    console.error("[auth] posthog capture failed", error);
  }
}

export const authConfig = {
  adapter,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" as const },
  providers: [
    Google({
      clientId: requiredEnv("AUTH_GOOGLE_ID"),
      clientSecret: requiredEnv("AUTH_GOOGLE_SECRET"),
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
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
        userId &&
        (!lastSyncedAt || now - lastSyncedAt > ROLE_REFRESH_INTERVAL_SECONDS)
      ) {
        try {
          const dbUsers = await db
            .select({ role: userTable.role })
            .from(userTable)
            .where(eq(userTable.id, userId));
          const dbUser = dbUsers[0] ?? null;

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
  events: {
    signIn({ user, account, isNewUser }: {
      user: { id?: string | null; email?: string | null };
      account?: { provider?: string | null } | null;
      isNewUser?: boolean;
    }) {
      const emailDomain =
        typeof user.email === "string" && user.email.includes("@")
          ? user.email.split("@")[1] ?? null
          : null;

      const distinctId = typeof user.id === "string" ? user.id : undefined;
      if (!distinctId) {
        return;
      }

      after(async () => {
        await captureAuthServerEvent({
          distinctId,
          event: "sign_in_completed",
          properties: {
            provider: account?.provider ?? "unknown",
            email_domain: emailDomain,
            is_new_user: Boolean(isNewUser),
          },
        });
      });
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

const getCachedServerSession = cache(() => getServerSession(authConfig));

export function auth(
  ...args:
    | [GetServerSidePropsContext["req"], GetServerSidePropsContext["res"]]
    | [NextApiRequest, NextApiResponse]
    | []
) {
  if (args.length === 0) {
    return getCachedServerSession();
  }

  return getServerSession(...args, authConfig);
}

export default authHandler;

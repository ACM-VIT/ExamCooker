import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next";
import { after } from "next/server";
import { cache } from "react";
import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth from "next-auth";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { createAuthAdapter } from "@/db/auth-adapter";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { verifyNativeAuthToken } from "@/lib/native-auth-token";
import { createPostHogServer } from "@/lib/posthog-server";

const adapter = createAuthAdapter();
const ROLE_REFRESH_INTERVAL_SECONDS = 5 * 60;
const useSecureAuthCookies =
  (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "").startsWith(
    "https://",
  ) || process.env.NODE_ENV === "production";
const secureCookiePrefix = useSecureAuthCookies ? "__Secure-" : "";
const crossSiteOAuthCookieOptions = {
  httpOnly: true,
  sameSite: useSecureAuthCookies ? "none" : "lax",
  path: "/",
  secure: useSecureAuthCookies,
  maxAge: 60 * 15,
} as const;
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

function optionalEnv(name: "AUTH_APPLE_ID" | "AUTH_APPLE_SECRET") {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function optionalReviewEnv(
  name:
    | "APP_REVIEW_EMAIL"
    | "APP_REVIEW_PASSWORD"
    | "APP_REVIEW_NAME"
    | "APP_REVIEW_ROLE"
    | "EXAMCOOKER_REVIEW_EMAIL"
    | "EXAMCOOKER_REVIEW_PASSWORD"
    | "EXAMCOOKER_REVIEW_NAME"
    | "EXAMCOOKER_REVIEW_ROLE",
) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getReviewRole(): AppRole {
  const role =
    optionalReviewEnv("APP_REVIEW_ROLE") ??
    optionalReviewEnv("EXAMCOOKER_REVIEW_ROLE");

  return role === "MODERATOR" ? "MODERATOR" : "USER";
}

function getReviewCredentials() {
  const email =
    optionalReviewEnv("APP_REVIEW_EMAIL") ??
    optionalReviewEnv("EXAMCOOKER_REVIEW_EMAIL");
  const password =
    optionalReviewEnv("APP_REVIEW_PASSWORD") ??
    optionalReviewEnv("EXAMCOOKER_REVIEW_PASSWORD");

  if (!email || !password) {
    return null;
  }

  return {
    email: email.toLowerCase(),
    password,
    name:
      optionalReviewEnv("APP_REVIEW_NAME") ??
      optionalReviewEnv("EXAMCOOKER_REVIEW_NAME") ??
      "App Review",
    role: getReviewRole(),
  };
}

function secureCompare(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

async function findOrCreateReviewUser(input: {
  email: string;
  name: string;
  role: AppRole;
}) {
  const existing = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, input.email));
  const existingUser = existing[0] ?? null;

  if (existingUser) {
    const [updatedUser] = await db
      .update(userTable)
      .set({
        name: input.name,
        role: input.role,
        emailVerified: existingUser.emailVerified ?? new Date(),
      })
      .where(eq(userTable.id, existingUser.id))
      .returning();
    return updatedUser ?? existingUser;
  }

  const [createdUser] = await db
    .insert(userTable)
    .values({
      email: input.email,
      name: input.name,
      emailVerified: new Date(),
      role: input.role,
    })
    .onConflictDoNothing()
    .returning();

  if (createdUser) {
    return createdUser;
  }

  const raced = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, input.email));
  return raced[0] ?? null;
}

function buildProviders() {
  const appleClientId = optionalEnv("AUTH_APPLE_ID");
  const appleClientSecret = optionalEnv("AUTH_APPLE_SECRET");

  return [
    Credentials({
      id: "app-review",
      name: "Username and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const reviewCredentials = getReviewCredentials();
        if (!reviewCredentials) {
          return null;
        }

        const email = credentials?.email?.trim().toLowerCase() ?? "";
        const password = credentials?.password ?? "";

        if (
          !secureCompare(email, reviewCredentials.email) ||
          !secureCompare(password, reviewCredentials.password)
        ) {
          return null;
        }

        const reviewUser = await findOrCreateReviewUser({
          email: reviewCredentials.email,
          name: reviewCredentials.name,
          role: reviewCredentials.role,
        });

        if (!reviewUser) {
          return null;
        }

        return {
          id: reviewUser.id,
          email: reviewUser.email,
          name: reviewUser.name,
          image: reviewUser.image,
          role: reviewUser.role,
        };
      },
    }),
    Credentials({
      id: "native-handoff",
      name: "Native Handoff",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token ?? "";
        const payload = verifyNativeAuthToken(token);
        if (!payload) {
          return null;
        }

        const [nativeUser] = await db
          .select()
          .from(userTable)
          .where(eq(userTable.id, payload.userId));

        if (!nativeUser) {
          return null;
        }

        return {
          id: nativeUser.id,
          email: nativeUser.email,
          name: nativeUser.name,
          image: nativeUser.image,
          role: nativeUser.role,
        };
      },
    }),
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
    ...(appleClientId && appleClientSecret
      ? [
          Apple({
            clientId: appleClientId,
            clientSecret: appleClientSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ];
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
  cookies: {
    pkceCodeVerifier: {
      name: `${secureCookiePrefix}next-auth.pkce.code_verifier`,
      options: crossSiteOAuthCookieOptions,
    },
    state: {
      name: `${secureCookiePrefix}next-auth.state`,
      options: crossSiteOAuthCookieOptions,
    },
    nonce: {
      name: `${secureCookiePrefix}next-auth.nonce`,
      options: crossSiteOAuthCookieOptions,
    },
  },
  pages: {
    signIn: "/auth",
  },
  providers: buildProviders(),
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

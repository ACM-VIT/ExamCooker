import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next";
import { after } from "next/server";
import { cookies } from "next/headers";
import { cache } from "react";
import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth from "next-auth";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { decode, type JWT } from "next-auth/jwt";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { and, eq } from "drizzle-orm";
import { createAuthAdapter } from "@/db/auth-adapter";
import { db } from "@/db";
import { accounts, user as userTable } from "@/db/schema";
import { verifyAppleIdentityToken } from "@/lib/apple-identity-token";
import { consumeNativeAuthHandoffCode } from "@/lib/native-auth-token";
import { createPostHogServer } from "@/lib/posthog-server";

const adapter = createAuthAdapter();
const ROLE_REFRESH_INTERVAL_SECONDS = 5 * 60;
const DELETED_ACCOUNT_EMAIL_DOMAIN = "@deleted.examcooker.local";
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

class DeletedAccountSessionError extends Error {
  constructor() {
    super("Session user has been deleted");
    this.name = "DeletedAccountSessionError";
  }
}

function isDeletedAccountEmail(email: string | null | undefined) {
  return email?.endsWith(DELETED_ACCOUNT_EMAIL_DOMAIN) ?? false;
}

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

  // Review credentials are least-privileged unless moderation access is
  // explicitly enabled for the deployment.
  return role === "MODERATOR" ? "MODERATOR" : "USER";
}

function isConfiguredReviewEmail(email: string | null | undefined) {
  if (!email) return false;
  const configuredEmail =
    optionalReviewEnv("APP_REVIEW_EMAIL") ??
    optionalReviewEnv("EXAMCOOKER_REVIEW_EMAIL");
  return configuredEmail?.toLowerCase() === email.toLowerCase();
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

async function findOrCreateAppleUser(input: {
  authorizationCode?: string | null;
  email: string;
  emailVerified: boolean;
  familyName?: string | null;
  givenName?: string | null;
  identityToken: string;
  subject: string;
}) {
  const accountRows = await db
    .select({ user: userTable })
    .from(accounts)
    .innerJoin(userTable, eq(accounts.userId, userTable.id))
    .where(
      and(
        eq(accounts.provider, "apple"),
        eq(accounts.providerAccountId, input.subject),
      ),
    );
  const accountUser = accountRows[0]?.user ?? null;
  if (accountUser) {
    return accountUser;
  }

  const existingUsers = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, input.email));

  let appleUser = existingUsers[0] ?? null;
  if (!appleUser) {
    const name = [input.givenName, input.familyName].filter(Boolean).join(" ");
    const [createdUser] = await db
      .insert(userTable)
      .values({
        email: input.email,
        emailVerified: input.emailVerified ? new Date() : null,
        name: name || null,
        role: "USER",
      })
      .onConflictDoNothing()
      .returning();

    appleUser = createdUser ?? null;
  }

  if (!appleUser) {
    const racedUsers = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, input.email));
    appleUser = racedUsers[0] ?? null;
  }

  if (!appleUser) {
    return null;
  }

  await db
    .insert(accounts)
    .values({
      userId: appleUser.id,
      type: "oauth",
      provider: "apple",
      providerAccountId: input.subject,
      idToken: input.identityToken,
      accessToken: input.authorizationCode ?? undefined,
      tokenType: "bearer",
      scope: "email name",
    })
    .onConflictDoNothing();

  return appleUser;
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
        code: { label: "Code", type: "text" },
        verifier: { label: "Verifier", type: "text" },
      },
      async authorize(credentials) {
        const nativeUser = await consumeNativeAuthHandoffCode({
          code: credentials?.code ?? "",
          verifier: credentials?.verifier ?? "",
        });

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
    Credentials({
      id: "native-apple",
      name: "Native Apple",
      credentials: {
        authorizationCode: { label: "Authorization Code", type: "text" },
        email: { label: "Email", type: "email" },
        familyName: { label: "Family Name", type: "text" },
        givenName: { label: "Given Name", type: "text" },
        identityToken: { label: "Identity Token", type: "text" },
      },
      async authorize(credentials) {
        const identityToken = credentials?.identityToken?.trim();
        if (!identityToken) {
          return null;
        }

        const verifiedToken = await verifyAppleIdentityToken(identityToken);
        if (!verifiedToken) {
          return null;
        }

        const nativeAppleUser = await findOrCreateAppleUser({
          authorizationCode: credentials?.authorizationCode,
          email: verifiedToken.email,
          emailVerified: verifiedToken.emailVerified,
          familyName: credentials?.familyName,
          givenName: credentials?.givenName,
          identityToken,
          subject: verifiedToken.subject,
        });

        if (!nativeAppleUser) {
          return null;
        }

        return {
          id: nativeAppleUser.id,
          email: nativeAppleUser.email,
          name: nativeAppleUser.name,
          image: nativeAppleUser.image,
          role: nativeAppleUser.role,
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

      const userId = typeof token.id === "string" ? token.id : null;
      if (userId) {
        const lastSyncedAt = Number(token.roleSyncedAt ?? 0);
        const shouldRefreshRole =
          !lastSyncedAt || now - lastSyncedAt > ROLE_REFRESH_INTERVAL_SECONDS;

        try {
          const dbUsers = await db
            .select({ email: userTable.email, role: userTable.role })
            .from(userTable)
            .where(eq(userTable.id, userId));
          const dbUser = dbUsers[0] ?? null;

          if (!dbUser || isDeletedAccountEmail(dbUser.email)) {
            throw new DeletedAccountSessionError();
          }

          if (isConfiguredReviewEmail(dbUser.email)) {
            // Existing QA sessions should gain (or lose, when explicitly
            // configured as USER) review access without requiring a sign-out.
            token.role = getReviewRole();
            token.roleSyncedAt = now;
          } else if (shouldRefreshRole) {
            if (dbUser.role) token.role = dbUser.role;
            token.roleSyncedAt = now;
          }
        } catch (error) {
          if (error instanceof DeletedAccountSessionError) {
            throw error;
          }
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

const configuredSessionCookieName = `${secureCookiePrefix}next-auth.session-token`;
const sessionCookieNames = [
  configuredSessionCookieName,
  configuredSessionCookieName.startsWith("__Secure-")
    ? "next-auth.session-token"
    : "__Secure-next-auth.session-token",
];

function sessionCookieChunkIndex(name: string, sessionCookieName: string) {
  if (name === sessionCookieName) return 0;
  const index = Number.parseInt(name.slice(sessionCookieName.length + 1), 10);
  return Number.isFinite(index) ? index : Number.MAX_SAFE_INTEGER;
}

async function readRequestSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  let token: JWT | null = null;
  let userId: string | null = null;
  for (const sessionCookieName of sessionCookieNames) {
    const sessionToken = cookieStore
      .getAll()
      .filter(({ name }) =>
        name === sessionCookieName || name.startsWith(`${sessionCookieName}.`),
      )
      .sort(
        (left, right) =>
          sessionCookieChunkIndex(left.name, sessionCookieName) -
          sessionCookieChunkIndex(right.name, sessionCookieName),
      )
      .map(({ value }) => value)
      .join("");
    if (!sessionToken) continue;

    try {
      const candidate = await decode({ token: sessionToken, secret });
      const candidateUserId =
        typeof candidate?.id === "string"
          ? candidate.id
          : typeof candidate?.sub === "string"
            ? candidate.sub
            : null;
      if (candidate && candidateUserId) {
        token = candidate;
        userId = candidateUserId;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!token || !userId) return null;

  try {
    const [dbUser] = await db
      .select({
        email: userTable.email,
        image: userTable.image,
        name: userTable.name,
        role: userTable.role,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!dbUser || isDeletedAccountEmail(dbUser.email)) return null;

    const role = isConfiguredReviewEmail(dbUser.email)
      ? getReviewRole()
      : dbUser.role === "MODERATOR"
        ? "MODERATOR"
        : "USER";
    const expires =
      typeof token.exp === "number"
        ? new Date(token.exp * 1000).toISOString()
        : new Date(0).toISOString();

    return {
      user: {
        id: userId,
        email: dbUser.email,
        image: dbUser.image,
        name: dbUser.name,
        role,
      },
      expires,
    };
  } catch {
    return null;
  }
}

const getCachedRequestSession = cache(readRequestSession);

export function auth(
  ...args:
    | [GetServerSidePropsContext["req"], GetServerSidePropsContext["res"]]
    | [NextApiRequest, NextApiResponse]
    | []
) {
  if (args.length === 0) {
    return getCachedRequestSession();
  }

  return getServerSession(...args, authConfig);
}

export default authHandler;

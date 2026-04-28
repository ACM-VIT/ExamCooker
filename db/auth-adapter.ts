import { and, eq } from "drizzle-orm";
import type {
  Adapter,
  AdapterSession,
  AdapterUser,
} from "next-auth/adapters";
import { db } from "@/db";
import { accounts, sessions, user } from "@/db/schema";

type CreateUserInput = Parameters<NonNullable<Adapter["createUser"]>>[0];
type UpdateUserInput = Parameters<NonNullable<Adapter["updateUser"]>>[0];
type LinkAccountInput = Parameters<NonNullable<Adapter["linkAccount"]>>[0];
type CreateSessionInput = Parameters<NonNullable<Adapter["createSession"]>>[0];
type UpdateSessionInput = Parameters<NonNullable<Adapter["updateSession"]>>[0];

function first<T>(rows: T[]) {
  return rows[0] ?? null;
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function toAdapterAccount(account: LinkAccountInput) {
  return {
    userId: account.userId,
    type: account.type,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    refreshToken: account.refresh_token,
    accessToken: account.access_token,
    expiresAt: account.expires_at,
    tokenType: account.token_type,
    scope: account.scope,
    idToken: account.id_token,
    sessionState:
      typeof account.session_state === "string"
        ? account.session_state
        : account.session_state == null
          ? undefined
          : JSON.stringify(account.session_state),
  };
}

export function createAuthAdapter(): Adapter {
  return {
    async createUser(data: CreateUserInput) {
      const [createdUser] = await db.insert(user).values(data).returning();
      if (!createdUser) {
        throw new Error("Failed to create auth user");
      }
      return createdUser as AdapterUser;
    },

    async getUser(id) {
      return (await first(await db.select().from(user).where(eq(user.id, id)))) as
        | AdapterUser
        | null;
    },

    async getUserByEmail(email) {
      return (await first(
        await db.select().from(user).where(eq(user.email, email)),
      )) as AdapterUser | null;
    },

    async getUserByAccount(input) {
      const row = await first(
        await db
          .select({ user })
          .from(accounts)
          .innerJoin(user, eq(accounts.userId, user.id))
          .where(
            and(
              eq(accounts.provider, input.provider),
              eq(accounts.providerAccountId, input.providerAccountId),
            ),
          ),
      );

      return (row?.user ?? null) as AdapterUser | null;
    },

    async updateUser(data: UpdateUserInput) {
      const [updatedUser] = await db
        .update(user)
        .set(pickDefined(data))
        .where(eq(user.id, data.id))
        .returning();

      if (!updatedUser) {
        throw new Error(`Auth user ${data.id} not found`);
      }

      return updatedUser as AdapterUser;
    },

    async linkAccount(data: LinkAccountInput) {
      await db.insert(accounts).values(toAdapterAccount(data));
      return undefined;
    },

    async createSession(data: CreateSessionInput) {
      const [createdSession] = await db.insert(sessions).values(data).returning();
      if (!createdSession) {
        throw new Error("Failed to create auth session");
      }
      return createdSession as AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const row = await first(
        await db
          .select({ session: sessions, user })
          .from(sessions)
          .innerJoin(user, eq(sessions.userId, user.id))
          .where(eq(sessions.sessionToken, sessionToken)),
      );

      if (!row) {
        return null;
      }

      return {
        session: row.session as AdapterSession,
        user: row.user as AdapterUser,
      };
    },

    async updateSession(data: UpdateSessionInput) {
      const [updatedSession] = await db
        .update(sessions)
        .set(pickDefined(data))
        .where(eq(sessions.sessionToken, data.sessionToken))
        .returning();

      return (updatedSession ?? null) as AdapterSession | null;
    },

    async deleteSession(sessionToken) {
      await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
      return undefined;
    },
  };
}

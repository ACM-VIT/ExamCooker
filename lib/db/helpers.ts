import { eq, sql } from "drizzle-orm";
import { db, tag, user } from "@/db";

export async function getUserByEmail(email: string) {
  return db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .then((rows) => rows[0] ?? null);
}

export async function requireUserByEmail(email: string) {
  const existingUser = await getUserByEmail(email);
  if (!existingUser) {
    throw new Error(`User with email ${email} does not exist`);
  }

  return existingUser;
}

export async function findOrCreateTag(
  rawName: string,
  options?: { caseInsensitive?: boolean },
) {
  const name = rawName.trim();
  if (!name) {
    throw new Error("Invalid tag name");
  }

  const existingTag = await db
    .select()
    .from(tag)
    .where(
      options?.caseInsensitive
        ? sql`lower(${tag.name}) = lower(${name})`
        : eq(tag.name, name),
    )
    .then((rows) => rows[0] ?? null);

  if (existingTag) {
    return existingTag;
  }

  const [createdTag] = await db
    .insert(tag)
    .values({ name })
    .onConflictDoNothing()
    .returning();

  if (createdTag) {
    return createdTag;
  }

  const conflictedTag = await db
    .select()
    .from(tag)
    .where(eq(tag.name, name))
    .then((rows) => rows[0] ?? null);

  if (conflictedTag) {
    return conflictedTag;
  }

  if (!createdTag) {
    throw new Error(`Failed to create tag ${name}`);
  }
  return createdTag;
}

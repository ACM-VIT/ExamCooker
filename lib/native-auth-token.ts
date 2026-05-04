import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { nativeAuthHandoff, user as userTable } from "@/db/schema";

const HANDOFF_CODE_TTL_SECONDS = 60;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function getSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET/NEXTAUTH_SECRET for native auth.");
  }
  return secret;
}

function hashHandoffCode(code: string) {
  return createHmac("sha256", getSecret()).update(code).digest("base64url");
}

function createVerifierChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function normalizeNativeAuthHandoffChallenge(
  value: string | string[] | undefined,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const challenge = raw?.trim() ?? "";
  if (
    challenge.length !== 43 ||
    !BASE64URL_PATTERN.test(challenge)
  ) {
    return null;
  }

  return challenge;
}

export async function createNativeAuthHandoffCode(input: {
  handoffChallenge: string;
  userId: string;
}) {
  const handoffChallenge = normalizeNativeAuthHandoffChallenge(
    input.handoffChallenge,
  );
  if (!handoffChallenge) {
    throw new Error("Invalid native auth handoff challenge.");
  }

  const code = randomBytes(32).toString("base64url");
  await db.insert(nativeAuthHandoff).values({
    codeHash: hashHandoffCode(code),
    expiresAt: new Date(Date.now() + HANDOFF_CODE_TTL_SECONDS * 1000),
    userId: input.userId,
    verifierChallenge: handoffChallenge,
  });

  return code;
}

export async function consumeNativeAuthHandoffCode(input: {
  code: string;
  verifier: string;
}) {
  const code = input.code.trim();
  const verifier = input.verifier.trim();
  if (
    code.length < 32 ||
    code.length > 128 ||
    verifier.length < 32 ||
    verifier.length > 128 ||
    !BASE64URL_PATTERN.test(code) ||
    !BASE64URL_PATTERN.test(verifier)
  ) {
    return null;
  }

  const now = new Date();
  const codeHash = hashHandoffCode(code);
  const verifierChallenge = createVerifierChallenge(verifier);

  return db.transaction(async (tx) => {
    const [handoff] = await tx
      .update(nativeAuthHandoff)
      .set({ consumedAt: now })
      .where(
        and(
          eq(nativeAuthHandoff.codeHash, codeHash),
          eq(nativeAuthHandoff.verifierChallenge, verifierChallenge),
          isNull(nativeAuthHandoff.consumedAt),
          gt(nativeAuthHandoff.expiresAt, now),
        ),
      )
      .returning({
        userId: nativeAuthHandoff.userId,
      });

    if (!handoff) {
      return null;
    }

    const [nativeUser] = await tx
      .select()
      .from(userTable)
      .where(eq(userTable.id, handoff.userId));

    return nativeUser ?? null;
  });
}

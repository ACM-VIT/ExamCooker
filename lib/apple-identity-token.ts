import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const appleJwks = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

function getAppleAudiences() {
  return Array.from(
    new Set(
      [
        process.env.AUTH_APPLE_ID,
        process.env.AUTH_APPLE_NATIVE_ID,
        process.env.APPLE_NATIVE_CLIENT_ID,
        "in.acmvit.examcooker",
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function getFallbackEmail(subject: string) {
  const digest = createHash("sha256").update(subject).digest("hex").slice(0, 24);
  return `apple-${digest}@appleid.examcooker.local`;
}

export async function verifyAppleIdentityToken(identityToken: string) {
  const audiences = getAppleAudiences();
  if (audiences.length === 0) {
    throw new Error("No Apple client IDs configured for native sign-in.");
  }

  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: APPLE_ISSUER,
    audience: audiences,
  });

  if (!payload.sub) {
    return null;
  }

  return {
    email:
      typeof payload.email === "string" && payload.email.trim()
        ? payload.email.trim().toLowerCase()
        : getFallbackEmail(payload.sub),
    emailVerified:
      payload.email_verified === true || payload.email_verified === "true",
    subject: payload.sub,
  };
}

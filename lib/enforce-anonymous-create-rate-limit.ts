import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkSlidingWindowRateLimit } from "@/lib/redis-rate-limit";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

function getClientIp(requestHeaders: Headers): string | null {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  for (const name of [
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "fastly-client-ip",
    "x-client-ip",
  ]) {
    const value = requestHeaders.get(name);
    if (value) return value;
  }

  return null;
}

export async function enforceAnonymousCreateRateLimit() {
  const requestHeaders = await headers();
  if (
    requestHeaders.get("purpose") === "prefetch" ||
    requestHeaders.get("next-router-prefetch") ||
    requestHeaders.get("x-middleware-prefetch")
  ) {
    return;
  }

  const cookieStore = await cookies();
  if (SESSION_COOKIE_NAMES.some((name) => cookieStore.has(name))) {
    return;
  }

  const ip = getClientIp(requestHeaders);
  if (!ip) return;

  let blocked = false;
  try {
    const { success } = await checkSlidingWindowRateLimit({
      identifier: ip,
      limit: 20,
      prefix: "ec:rate-limit:anonymous-create",
      windowMs: 10_000,
    });
    blocked = !success;
  } catch (error) {
    console.error("[create-rate-limit] failed; allowing request", error);
  }

  if (blocked) {
    redirect("/blocked");
  }
}

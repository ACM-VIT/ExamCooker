import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit =
  redisUrl && redisToken
    ? new Ratelimit({
        redis: new Redis({
          url: redisUrl,
          token: redisToken,
        }),
        limiter: Ratelimit.slidingWindow(20, "10 s"),
      })
    : null;

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const ip = xff.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const candidates = [
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "fastly-client-ip",
    "x-client-ip",
  ];
  for (const h of candidates) {
    const v = req.headers.get(h);
    if (v) return v;
  }

  return null;
}

function isPrefetchRequest(req: NextRequest): boolean {
  if (req.headers.get("purpose") === "prefetch") return true;
  if (req.headers.get("next-router-prefetch")) return true;
  if (req.headers.get("x-middleware-prefetch")) return true;
  return false;
}

function hasSessionCookie(req: NextRequest): boolean {
  return (
    Boolean(req.cookies.get("authjs.session-token")) ||
    Boolean(req.cookies.get("__Secure-authjs.session-token")) ||
    Boolean(req.cookies.get("next-auth.session-token")) ||
    Boolean(req.cookies.get("__Secure-next-auth.session-token"))
  );
}

export default async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const isCreatePath = url.pathname.endsWith("/create") || url.pathname.endsWith("/create/");
  const shouldRateLimit =
    isCreatePath &&
    request.method === "GET" &&
    !isPrefetchRequest(request) &&
    !hasSessionCookie(request);

  if (shouldRateLimit && ratelimit) {
    const ip = getClientIp(request);
    if (ip) {
      try {
        const { success } = await ratelimit.limit(ip);
        if (!success) {
          return NextResponse.redirect(new URL("/blocked", request.url));
        }
      } catch (error) {
        console.error("[proxy] rate limit failed; allowing request", error);
      }
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-url", request.url);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/:path*"],
};

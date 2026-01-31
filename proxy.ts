import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
});

function getClientIp(req: NextRequest): string {
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

  return "127.0.0.1";
}

export default async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const isCreatePath = url.pathname.endsWith("/create") || url.pathname.endsWith("/create/");

  if (isCreatePath) {
    const ip = getClientIp(request);
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.redirect(new URL("/blocked", request.url));
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

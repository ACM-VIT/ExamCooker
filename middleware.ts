import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(5, "10 s"),
});

export default async function middleware(
    request: NextRequest
): Promise<Response | undefined> {
    if (request.url.endsWith("/create")) {
        const ip = request.ip ?? "127.0.0.1";
        const {success} = await ratelimit.limit(
            ip
        );
        if (!success) return NextResponse.redirect(new URL("/blocked", request.url))
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-url', request.url);

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        }
    });

}

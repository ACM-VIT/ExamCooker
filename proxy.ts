import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const WELL_KNOWN_JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=3600",
} as const;

const DEFAULT_APPLE_TEAM_ID = "RZGK9VX3KX";

function readEnvList(...names: string[]) {
  return Array.from(
    new Set(
      names
        .flatMap((name) => (process.env[name] ?? "").split(/[\s,]+/))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

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
  const pathname = url.pathname;

  if (pathname === "/.well-known/apple-app-site-association") {
    const teamId = process.env.APPLE_TEAM_ID?.trim() || DEFAULT_APPLE_TEAM_ID;
    return NextResponse.json(
      {
        applinks: {
          apps: [],
          details: [
            {
              appID: `${teamId}.in.acmvit.examcooker`,
              paths: ["*"],
            },
          ],
        },
      },
      { headers: WELL_KNOWN_JSON_HEADERS },
    );
  }

  if (pathname === "/.well-known/assetlinks.json") {
    const fingerprints = readEnvList(
      "ANDROID_APP_LINK_SHA256",
      "ANDROID_APP_LINK_SHA256_FINGERPRINTS",
    );
    if (fingerprints.length === 0) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.json(
      [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "in.acmvit.examcooker",
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ],
      { headers: WELL_KNOWN_JSON_HEADERS },
    );
  }

  const isCreatePath = url.pathname.endsWith("/create") || url.pathname.endsWith("/create/");
  const shouldRateLimit =
    isCreatePath &&
    request.method === "GET" &&
    !isPrefetchRequest(request) &&
    !hasSessionCookie(request);

  if (shouldRateLimit) {
    const ip = getClientIp(request);
    if (ip) {
      try {
        const { checkSlidingWindowRateLimit } = await import(
          "@/lib/redis-rate-limit"
        );
        const { success } = await checkSlidingWindowRateLimit({
          identifier: ip,
          limit: 20,
          prefix: "ec:rate-limit:anonymous-create",
          windowMs: 10_000,
        });
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

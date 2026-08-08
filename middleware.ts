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

export default async function middleware(request: NextRequest) {
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

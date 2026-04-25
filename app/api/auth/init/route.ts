import { NextRequest, NextResponse } from "next/server";

const PUBLIC_AUTH_HOSTS = new Set([
    "beta.examcooker.acmvit.in",
    "exam-cooker.acmvit.in",
    "examcooker.acmvit.in",
    "examcooker-2024.azurewebsites.net",
    "examcooker-beta-2024.azurewebsites.net",
]);

const LOCAL_AUTH_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "[::1]",
]);

function isAllowedAuthHost(hostname: string) {
    return PUBLIC_AUTH_HOSTS.has(hostname) || LOCAL_AUTH_HOSTS.has(hostname);
}

function isLocalAuthHost(hostname: string) {
    return LOCAL_AUTH_HOSTS.has(hostname);
}

type AllowedHost = {
    host: string;
    hostname: string;
};

function getAllowedHost(value: string | null) {
    if (!value) return null;

    for (const candidate of value.split(",")) {
        const trimmed = candidate.trim();
        if (!trimmed) continue;

        try {
            const url = new URL(`https://${trimmed}`);
            if (isAllowedAuthHost(url.hostname)) {
                return {
                    host: url.host,
                    hostname: url.hostname,
                } satisfies AllowedHost;
            }
        } catch {
            // Ignore malformed forwarded host values.
        }
    }

    return null;
}

export async function GET(req: NextRequest) {
    const callbackUrl = req.nextUrl.searchParams.get("redirect") || "/";
    const forwardedHost = getAllowedHost(req.headers.get("x-forwarded-host"));
    const host = forwardedHost || getAllowedHost(req.headers.get("host"));
    const forwardedProtoRaw =
        req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
    const forwardedProto =
        forwardedProtoRaw === "http" || forwardedProtoRaw === "https"
            ? forwardedProtoRaw
            : undefined;
    const protocol =
        host && isLocalAuthHost(host.hostname)
            ? forwardedProto ?? "http"
            : forwardedProto ?? "https";
    const envBaseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
    const requestBaseUrl =
        host ? `${protocol}://${host.host}` : null;
    const signInUrl = new URL("/api/auth/signin/google", requestBaseUrl || envBaseUrl || req.url);
    signInUrl.searchParams.set("callbackUrl", callbackUrl);

    return NextResponse.redirect(signInUrl);
}

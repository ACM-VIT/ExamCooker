import { NextRequest, NextResponse } from "next/server";

const PUBLIC_AUTH_HOSTS = new Set([
    "beta.examcooker.acmvit.in",
    "exam-cooker.acmvit.in",
    "examcooker.acmvit.in",
    "examcooker-2024.azurewebsites.net",
    "examcooker-beta-2024.azurewebsites.net",
]);

function getAllowedHost(value: string | null) {
    if (!value) return null;

    for (const candidate of value.split(",")) {
        const trimmed = candidate.trim();
        if (!trimmed) continue;

        try {
            const url = new URL(`https://${trimmed}`);
            if (PUBLIC_AUTH_HOSTS.has(url.hostname)) return url.hostname;
        } catch {
            // Ignore malformed forwarded host values.
        }
    }

    return null;
}

export async function GET(req: NextRequest) {
    const callbackUrl = req.nextUrl.searchParams.get("redirect") || "/home";
    const forwardedHost = getAllowedHost(req.headers.get("x-forwarded-host"));
    const host = forwardedHost || getAllowedHost(req.headers.get("host"));
    const forwardedProto =
        req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
    const envBaseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
    const requestBaseUrl =
        host ? `${forwardedProto === "http" ? "http" : "https"}://${host}` : null;
    const signInUrl = new URL("/api/auth/signin/google", requestBaseUrl || envBaseUrl || req.url);
    signInUrl.searchParams.set("callbackUrl", callbackUrl);

    return NextResponse.redirect(signInUrl);
}

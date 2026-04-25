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

const AUTH_ORIGIN_COOKIE_NAME = "examcooker.auth-origin";
const CALLBACK_COOKIE_NAMES = [
    AUTH_ORIGIN_COOKIE_NAME,
    "__Secure-authjs.callback-url",
    "authjs.callback-url",
    "__Secure-next-auth.callback-url",
    "next-auth.callback-url",
];

type AllowedOrigin = {
    host: string;
    hostname: string;
    origin: string;
    port: string;
    protocol: "http" | "https";
};

type RequestLike = {
    headers: Headers;
    url: string;
};

function isHostedDeployment() {
    return Boolean(process.env.WEBSITE_HOSTNAME || process.env.WEBSITE_SITE_NAME);
}

function canUseLocalAuthHost() {
    return !isHostedDeployment();
}

function isAllowedAuthHost(hostname: string) {
    return PUBLIC_AUTH_HOSTS.has(hostname) || (canUseLocalAuthHost() && LOCAL_AUTH_HOSTS.has(hostname));
}

function splitHeaderCandidates(value: string | null) {
    if (!value) return [];
    return value
        .split(",")
        .map((candidate) => candidate.trim())
        .filter(Boolean);
}

function parseAllowedOrigin(rawValue: string, fallbackProto?: string) {
    const value = rawValue.trim();
    if (!value) return null;

    try {
        const url = value.includes("://")
            ? new URL(value)
            : new URL(`${fallbackProto ?? "https"}://${value}`);
        if (!isAllowedAuthHost(url.hostname)) return null;
        const protocol = url.protocol === "http:" ? "http" : "https";
        return {
            host: url.host,
            hostname: url.hostname,
            origin: `${protocol}://${url.host}`,
            port: url.port,
            protocol,
        } satisfies AllowedOrigin;
    } catch {
        return null;
    }
}

function getForwardedProto(headers: Headers) {
    const candidates = [
        headers.get("x-forwarded-proto"),
        headers.get("x-original-proto"),
    ];

    for (const value of candidates) {
        const proto = value?.split(",")[0]?.trim();
        if (proto === "http" || proto === "https") {
            return proto;
        }
    }

    return undefined;
}

function getCookieValue(headers: Headers, name: string) {
    const rawCookie = headers.get("cookie");
    if (!rawCookie) return null;

    for (const part of rawCookie.split(";")) {
        const trimmed = part.trim();
        if (trimmed.startsWith(`${name}=`)) {
            return decodeURIComponent(trimmed.slice(name.length + 1));
        }
    }

    return null;
}

function getOriginFromHeaderValue(value: string | null, fallbackProto?: string) {
    for (const candidate of splitHeaderCandidates(value)) {
        const parsed = parseAllowedOrigin(candidate, fallbackProto);
        if (parsed) return parsed;
    }

    return null;
}

function getOriginFromHeaders(request: RequestLike) {
    const forwardedProto = getForwardedProto(request.headers);
    const headerOrder = [
        request.headers.get("x-forwarded-host"),
        request.headers.get("x-original-host"),
        request.headers.get("x-ms-original-host"),
        request.headers.get("origin"),
        request.headers.get("referer"),
        request.headers.get("host"),
    ];

    for (const value of headerOrder) {
        const parsed = getOriginFromHeaderValue(value, forwardedProto);
        if (parsed) return parsed;
    }

    return null;
}

function getOriginFromCookies(request: RequestLike) {
    for (const cookieName of CALLBACK_COOKIE_NAMES) {
        const value = getCookieValue(request.headers, cookieName);
        if (!value) continue;

        const parsed = parseAllowedOrigin(value);
        if (parsed) return parsed;
    }

    return null;
}

function getOriginFromEnv() {
    const envBaseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.SITE_URL;

    if (!envBaseUrl) return null;
    return parseAllowedOrigin(envBaseUrl);
}

export function getPublicAuthOrigin(request: RequestLike) {
    return (
        getOriginFromHeaders(request) ||
        getOriginFromCookies(request) ||
        getOriginFromEnv()
    );
}

export function buildNormalizedAuthHeaders(request: RequestLike, publicOrigin: AllowedOrigin) {
    const headers = new Headers(request.headers);
    headers.set("host", publicOrigin.host);
    headers.set("x-forwarded-host", publicOrigin.host);
    headers.set("x-forwarded-proto", publicOrigin.protocol);
    headers.set(
        "x-forwarded-port",
        publicOrigin.port || (publicOrigin.protocol === "http" ? "80" : "443"),
    );
    headers.set("origin", publicOrigin.origin);

    return headers;
}

export function getAuthOriginCookieConfig(publicOrigin: AllowedOrigin) {
    return {
        name: AUTH_ORIGIN_COOKIE_NAME,
        value: publicOrigin.origin,
        options: {
            path: "/",
            httpOnly: true,
            sameSite: "lax" as const,
            secure: publicOrigin.protocol === "https",
        },
    };
}

export function buildAuthInitUrl(callbackUrl: string) {
    const url = new URL("/api/auth/init", window.location.origin);
    url.searchParams.set("redirect", callbackUrl || "/");
    return url.toString();
}

export function startGoogleSignIn(callbackUrl: string) {
    window.location.assign(buildAuthInitUrl(callbackUrl));
}

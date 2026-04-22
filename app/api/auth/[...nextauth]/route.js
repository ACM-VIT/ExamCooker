import { handlers } from "@/app/auth";

const PUBLIC_AUTH_HOSTS = new Set([
  "exam-cooker.acmvit.in",
  "examcooker.acmvit.in",
  "examcooker-2024.azurewebsites.net",
]);

function getPublicOriginFromCookie(request) {
  const rawCookie = request.headers.get("cookie");
  if (!rawCookie) return null;

  const callbackCookie = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Secure-authjs.callback-url=") || part.startsWith("authjs.callback-url="));

  if (!callbackCookie) return null;

  try {
    const value = decodeURIComponent(callbackCookie.split("=").slice(1).join("="));
    const url = new URL(value);
    return PUBLIC_AUTH_HOSTS.has(url.host) ? url.origin : null;
  } catch {
    return null;
  }
}

function getPublicOrigin(request) {
  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headers.get("host")?.split(",")[0]?.trim();

  if (host && PUBLIC_AUTH_HOSTS.has(host)) {
    const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    return `${forwardedProto || "https"}://${host}`;
  }

  return getPublicOriginFromCookie(request);
}

function normalizeAuthRequest(request) {
  const publicOrigin = getPublicOrigin(request);
  if (!publicOrigin) return request;

  const currentUrl = new URL(request.url);
  const publicUrl = new URL(publicOrigin);
  currentUrl.protocol = publicUrl.protocol;
  currentUrl.host = publicUrl.host;

  const headers = new Headers(request.headers);
  headers.set("host", publicUrl.host);
  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", publicUrl.protocol.replace(":", ""));

  return new Request(currentUrl, {
    method: request.method,
    headers,
    body: request.body,
    duplex: "half",
  });
}

export function GET(request) {
  return handlers.GET(normalizeAuthRequest(request));
}

export function POST(request) {
  return handlers.POST(normalizeAuthRequest(request));
}

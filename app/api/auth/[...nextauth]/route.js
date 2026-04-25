import { NextRequest } from "next/server";
import { authHandler } from "@/app/auth";

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

function isAllowedAuthHost(hostname) {
  return PUBLIC_AUTH_HOSTS.has(hostname) || LOCAL_AUTH_HOSTS.has(hostname);
}

function isLocalAuthHost(hostname) {
  return LOCAL_AUTH_HOSTS.has(hostname);
}

function getPublicOriginFromCookie(request) {
  const rawCookie = request.headers.get("cookie");
  if (!rawCookie) return null;

  const callbackCookie = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find(
      (part) =>
        part.startsWith("__Secure-authjs.callback-url=") ||
        part.startsWith("authjs.callback-url=") ||
        part.startsWith("__Secure-next-auth.callback-url=") ||
        part.startsWith("next-auth.callback-url="),
    );

  if (!callbackCookie) return null;

  try {
    const value = decodeURIComponent(callbackCookie.split("=").slice(1).join("="));
    const url = new URL(value);
    return isAllowedAuthHost(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

function getAllowedHost(value) {
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
        };
      }
    } catch {
      // Ignore malformed forwarded host values.
    }
  }

  return null;
}

function getPublicOrigin(request) {
  const headers = request.headers;
  const forwardedHost = getAllowedHost(headers.get("x-forwarded-host"));
  const host = forwardedHost || getAllowedHost(headers.get("host"));

  if (host) {
    const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const normalizedProto =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : undefined;
    const proto = isLocalAuthHost(host.hostname)
      ? normalizedProto || "http"
      : normalizedProto || "https";
    return `${proto}://${host.host}`;
  }

  return getPublicOriginFromCookie(request);
}

function normalizeAuthRequest(request) {
  const publicOrigin = getPublicOrigin(request);
  if (!publicOrigin) return request;

  const currentUrl = new URL(request.url);
  const publicUrl = new URL(publicOrigin);
  currentUrl.protocol = publicUrl.protocol;
  currentUrl.hostname = publicUrl.hostname;
  currentUrl.port = publicUrl.port;

  const headers = new Headers(request.headers);
  headers.set("host", publicUrl.host);
  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", publicUrl.protocol.replace(":", ""));
  headers.set("x-forwarded-port", publicUrl.port || (publicUrl.protocol === "http:" ? "80" : "443"));

  return new NextRequest(currentUrl, {
    method: request.method,
    headers,
    body: request.body,
    duplex: "half",
  });
}

export function GET(request, context) {
  return authHandler(normalizeAuthRequest(request), context);
}

export function POST(request, context) {
  return authHandler(normalizeAuthRequest(request), context);
}

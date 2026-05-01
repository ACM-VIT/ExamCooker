import { NextRequest } from "next/server";
import { authHandler } from "@/app/auth";
import {
  buildNormalizedAuthHeaders,
  getPublicAuthOrigin,
} from "@/lib/auth-origin";

function normalizeAuthRequest(request) {
  const publicOrigin = getPublicAuthOrigin(request);
  if (!publicOrigin) return request;

  const currentUrl = new URL(request.url);
  currentUrl.protocol = `${publicOrigin.protocol}:`;
  currentUrl.hostname = publicOrigin.hostname;
  currentUrl.port = publicOrigin.port;
  const headers = buildNormalizedAuthHeaders(request, publicOrigin);

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

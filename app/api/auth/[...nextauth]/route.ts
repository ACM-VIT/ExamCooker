import { NextRequest } from "next/server";
import { authHandler } from "@/app/auth";
import { expireAiSessionCookie } from "@/lib/ai/session-cookie";
import {
  buildNormalizedAuthHeaders,
  getPublicAuthOrigin,
} from "@/lib/auth-origin";

function normalizeAuthRequest(request: NextRequest) {
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
  } as ConstructorParameters<typeof NextRequest>[1] & { duplex: "half" });
}

export function GET(request: NextRequest, context: Parameters<typeof authHandler>[1]) {
  return authHandler(normalizeAuthRequest(request), context);
}

export async function POST(request: NextRequest, context: Parameters<typeof authHandler>[1]) {
  const response = await authHandler(normalizeAuthRequest(request), context);
  return new URL(request.url).pathname.endsWith("/signout")
    ? expireAiSessionCookie(response, process.env.NODE_ENV === "production")
    : response;
}

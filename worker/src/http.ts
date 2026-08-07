export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-ExamCooker-Command-Admin",
};

export function jsonResponse(
  body: Record<string, unknown>,
  init: ResponseInit = {},
) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

export function emptyResponse(init: ResponseInit = {}) {
  return new Response(null, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init.headers,
    },
  });
}

export async function readQuery(request: Request) {
  if (request.method === "GET") {
    return new URL(request.url).searchParams.get("query") ?? "";
  }

  const payload = (await request.json().catch(() => null)) as {
    query?: unknown;
  } | null;

  return typeof payload?.query === "string" ? payload.query : "";
}

export async function readJsonPayload(request: Request) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

export function readBearerToken(value: string | null) {
  const match = value?.match(/^\s*Bearer\s+(.+?)\s*$/i);
  return match?.[1]?.trim() ?? "";
}

export async function readCommandIntentInput(request: Request) {
  if (request.method === "GET") {
    const url = new URL(request.url);

    return {
      query: url.searchParams.get("query") ?? "",
      preferenceQuery: url.searchParams.get("preferenceQuery") ?? "",
      userKey: url.searchParams.get("userKey") ?? "",
      userToken: readBearerToken(request.headers.get("Authorization")),
    };
  }

  const payload = await readJsonPayload(request);
  const surfaceContext =
    payload?.surfaceContext &&
    typeof payload.surfaceContext === "object" &&
    !Array.isArray(payload.surfaceContext)
      ? payload.surfaceContext
      : undefined;

  return {
    query: typeof payload?.query === "string" ? payload.query : "",
    preferenceQuery:
      typeof payload?.preferenceQuery === "string" ? payload.preferenceQuery : "",
    userKey: typeof payload?.userKey === "string" ? payload.userKey : "",
    userToken: typeof payload?.userToken === "string" ? payload.userToken : "",
    surfaceContext,
  };
}

export function readLimit(request: Request, fallback: number, max: number) {
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : fallback;

  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
}

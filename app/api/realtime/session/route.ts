import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/app/auth";

const DEFAULT_REALTIME_MODEL = "gpt-realtime-mini";

function isAbortLikeError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.toLowerCase() === "aborted" ||
      (error as Error & { code?: string }).code === "ECONNRESET")
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      console.warn("[voice-agent] realtime session denied: unauthenticated request");
      return NextResponse.json(
        {
          error: "You must be signed in to start the voice guide.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[voice-agent] realtime session failed: missing OPENAI_API_KEY");
      return NextResponse.json(
        {
          error: "Missing OPENAI_API_KEY.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    console.info("[voice-agent] creating realtime client secret", {
      authenticated: true,
      model: DEFAULT_REALTIME_MODEL,
    });
    const upstreamResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: DEFAULT_REALTIME_MODEL,
        },
      }),
      cache: "no-store",
      signal: request.signal,
    });

    const responseText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      console.error("[voice-agent] realtime client secret request failed", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
      });
      return new Response(responseText || "Failed to create a Realtime client secret.", {
        status: upstreamResponse.status,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": upstreamResponse.headers.get("content-type") ?? "text/plain",
        },
      });
    }

    let payload:
      | {
          value?: unknown;
          session?: unknown;
        }
      | null = null;

    try {
      payload = JSON.parse(responseText) as {
        value?: unknown;
        session?: unknown;
      };
    } catch {
      return NextResponse.json(
        {
          error: "OpenAI returned an invalid Realtime client secret payload.",
        },
        {
          status: 502,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (typeof payload?.value !== "string" || !payload.value.trim()) {
      console.error("[voice-agent] realtime client secret response missing value");
      return NextResponse.json(
        {
          error: "OpenAI did not return a Realtime client secret.",
        },
        {
          status: 502,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    console.info("[voice-agent] realtime client secret created", {
      authenticated: true,
      model: DEFAULT_REALTIME_MODEL,
    });
    return NextResponse.json(
      {
        clientSecret: payload.value,
        session: payload.session ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (request.signal.aborted || isAbortLikeError(error)) {
      console.warn("[voice-agent] realtime session request aborted");
      return NextResponse.json(
        {
          error: "Voice guide startup was cancelled.",
        },
        {
          status: 499,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    console.error("[voice-agent] realtime session route failed", error);
    return NextResponse.json(
      {
        error: "Failed to create a Realtime client secret.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

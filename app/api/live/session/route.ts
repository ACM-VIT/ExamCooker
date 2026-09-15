import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import { buildLiveSessionConfig } from "@/lib/voice/config";
import { createVoiceOpenAIClient } from "@/lib/voice/server";

const OfferSchema = z
  .object({ sdp: z.string().trim().min(1).max(65_536) })
  .strict();
const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  try {
    const userSession = await auth();
    if (!userSession?.user?.email) {
      return NextResponse.json(
        { error: "Sign in to start your study assistant." },
        { status: 401, headers },
      );
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: "Unexpected request origin." },
        { status: 403, headers },
      );
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Voice study is not configured." },
        { status: 503, headers },
      );
    }
    if (Number(request.headers.get("content-length")) > 70_000) {
      return NextResponse.json(
        { error: "The connection offer is too large." },
        { status: 413, headers },
      );
    }
    const body = await request.text();
    if (body.length > 70_000) {
      return NextResponse.json(
        { error: "The connection offer is too large." },
        { status: 413, headers },
      );
    }
    let parsed;
    try {
      parsed = OfferSchema.safeParse(JSON.parse(body));
    } catch {
      /* Invalid JSON. */
    }
    if (!parsed?.success) {
      return NextResponse.json(
        { error: "A valid SDP offer is required." },
        { status: 400, headers },
      );
    }
    const result = await createVoiceOpenAIClient().live.create(
      {
        session: buildLiveSessionConfig(),
        transport: { type: "webrtc", sdp: parsed.data.sdp },
      },
      { signal: request.signal },
    );
    return NextResponse.json(result, { status: 201, headers });
  } catch (error) {
    if (
      request.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return NextResponse.json(
        { error: "Voice startup was cancelled." },
        { status: 499, headers },
      );
    }
    console.error("[voice-agent] Live session creation failed", {
      status: error instanceof OpenAI.APIError ? error.status : undefined,
    });
    return NextResponse.json(
      { error: "Could not start voice study. Please try again." },
      {
        status:
          error instanceof OpenAI.APIError && error.status === 429 ? 429 : 502,
        headers,
      },
    );
  }
}

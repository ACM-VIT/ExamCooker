import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import {
  capturePostHogAiGeneration,
  createAiTextMessage,
} from "@/lib/posthog/llm";

const VoiceRealtimeAnalyticsSchema = z.object({
  browserPath: z.string().trim().min(1).max(2000),
  conversationId: z.string().trim().min(1).max(200).nullable().optional(),
  entryPoint: z.enum(["nav", "home_search"]),
  errorMessage: z.string().trim().min(1).max(500).nullable().optional(),
  inputText: z.string().trim().min(1).max(4000),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  latencySeconds: z.number().nonnegative().max(3600),
  model: z.string().trim().min(1).max(200),
  outputText: z.string().trim().min(1).max(8000).nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  posthogSessionId: z.string().trim().min(1).max(200).nullable().optional(),
  responseId: z.string().trim().min(1).max(200).nullable().optional(),
  status: z.string().trim().min(1).max(50),
  stopReason: z.string().trim().min(1).max(200).nullable().optional(),
  timeToFirstTokenSeconds: z.number().nonnegative().max(3600).nullable().optional(),
  voiceSessionId: z.string().trim().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  const distinctId = session?.user?.id ?? session?.user?.email ?? null;

  if (!distinctId) {
    return NextResponse.json(
      {
        error: "You must be signed in to capture voice analytics.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let parsedBody: z.infer<typeof VoiceRealtimeAnalyticsSchema>;

  try {
    const requestBody = await request.json();
    parsedBody = VoiceRealtimeAnalyticsSchema.parse(requestBody);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid voice analytics payload.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  after(async () => {
    await capturePostHogAiGeneration({
      distinctId,
      traceId: parsedBody.voiceSessionId,
      sessionId: parsedBody.posthogSessionId ?? undefined,
      spanId: parsedBody.responseId ?? crypto.randomUUID(),
      spanName: "voice_turn",
      model: parsedBody.model,
      provider: "openai",
      input: [createAiTextMessage("user", parsedBody.inputText)],
      inputTokens: parsedBody.inputTokens ?? undefined,
      outputChoices: parsedBody.outputText
        ? [createAiTextMessage("assistant", parsedBody.outputText)]
        : undefined,
      outputTokens: parsedBody.outputTokens ?? undefined,
      latencySeconds: parsedBody.latencySeconds,
      timeToFirstTokenSeconds:
        parsedBody.timeToFirstTokenSeconds ?? undefined,
      baseUrl: "https://api.openai.com/v1",
      requestUrl: "https://api.openai.com/v1/realtime/calls",
      isError:
        parsedBody.status !== "completed" || Boolean(parsedBody.errorMessage),
      error: parsedBody.errorMessage ?? undefined,
      stopReason:
        parsedBody.stopReason ??
        (parsedBody.status !== "completed" ? parsedBody.status : undefined),
      stream: true,
      extraProperties: {
        ai_surface: "voice_agent",
        voice_conversation_id: parsedBody.conversationId ?? undefined,
        voice_entry_point: parsedBody.entryPoint,
        voice_response_id: parsedBody.responseId ?? undefined,
        voice_response_status: parsedBody.status,
        voice_route_path: parsedBody.browserPath,
      },
    });
  });

  return NextResponse.json(
    {
      ok: true,
    },
    {
      status: 202,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

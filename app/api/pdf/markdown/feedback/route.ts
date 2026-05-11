import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import { recordPdfMarkdownFeedback } from "@/lib/ai/pdf-markdown-cache";
import type { PdfMarkdownCacheMetadata } from "@/lib/ai/pdf-markdown-cache-types";

const FeedbackRequestSchema = z.object({
  cacheKey: z.string().regex(/^[a-f0-9]{64}$/),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  generationId: z.string().regex(/^[a-f0-9]{64}$/),
  model: z.string().trim().min(1).max(120).optional(),
  vote: z.enum(["up", "down"]),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  const distinctId = session?.user?.id ?? session?.user?.email ?? null;
  if (!distinctId) {
    return NextResponse.json(
      {
        error: "You must be signed in to rate this Markdown generation.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let parsedBody: z.infer<typeof FeedbackRequestSchema>;

  try {
    parsedBody = FeedbackRequestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid Markdown feedback request.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const feedback = await recordPdfMarkdownFeedback({
    cacheKey: parsedBody.cacheKey,
    generationId: parsedBody.generationId,
    voterId: distinctId,
    vote: parsedBody.vote,
  });

  if (!feedback) {
    return NextResponse.json(
      {
        error: "This Markdown generation is no longer available for feedback.",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const cache: PdfMarkdownCacheMetadata = {
    cacheKey: parsedBody.cacheKey,
    contentHash: parsedBody.contentHash,
    feedback,
    generationId: parsedBody.generationId,
    model: parsedBody.model,
    source: "cache",
    status: feedback.status === "needs_review" ? "bypassed" : "hit",
  };

  return NextResponse.json(
    {
      cache,
      success: true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { classifyPaperMetadata } from "@/lib/ai/paper-metadata-classifier";
import { checkSlidingWindowRateLimit } from "@/lib/redis-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CLASSIFIER_BYTES = 12 * 1024 * 1024;
const CLASSIFIER_RATE_LIMIT = 15;
const CLASSIFIER_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, error: "Sign in to classify a paper." },
            { status: 401 },
        );
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error("paper metadata classifier missing OPENAI_API_KEY");
        return NextResponse.json(
            { success: false, error: "Paper classification is not configured." },
            { status: 503 },
        );
    }

    const rateLimit = await checkSlidingWindowRateLimit({
        identifier: session.user.id,
        limit: CLASSIFIER_RATE_LIMIT,
        prefix: "upload-classify",
        windowMs: CLASSIFIER_RATE_WINDOW_MS,
    });
    if (!rateLimit.success) {
        return NextResponse.json(
            {
                success: false,
                error: "You have classified several papers recently. Try again later.",
            },
            { status: 429 },
        );
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json(
            { success: false, error: "Expected multipart form data." },
            { status: 400 },
        );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
        return NextResponse.json(
            { success: false, error: "A PDF is required for classification." },
            { status: 400 },
        );
    }
    if (file.size === 0 || file.size > MAX_CLASSIFIER_BYTES) {
        return NextResponse.json(
            {
                success: false,
                error: "Classifier PDFs must be between 1 byte and 12 MB.",
            },
            { status: 413 },
        );
    }
    if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
    ) {
        return NextResponse.json(
            { success: false, error: "Only PDF classifier input is supported." },
            { status: 400 },
        );
    }

    try {
        const result = await classifyPaperMetadata({
            data: Buffer.from(await file.arrayBuffer()),
            filename: file.name.slice(0, 240) || "paper.pdf",
        });

        return NextResponse.json(
            { success: true, result },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("paper metadata classifier failed", error);
        return NextResponse.json(
            {
                success: false,
                error: "Could not identify paper details. You can still enter them manually.",
            },
            { status: 502 },
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { auth } from "@/app/auth";
import { db, uploadResultReceipt } from "@/db";
import { checkSlidingWindowRateLimit } from "@/lib/redis-rate-limit";
import { processUploadFile } from "@/lib/uploads/processor-client";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const PROCESS_RATE_LIMIT = 20;
const PROCESS_RATE_WINDOW_MS = 60 * 60 * 1000;
const RECEIPT_TTL_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in to upload files." }, { status: 401 });
  }

  const rateLimit = await checkSlidingWindowRateLimit({
    identifier: session.user.id,
    limit: PROCESS_RATE_LIMIT,
    prefix: "upload-process",
    windowMs: PROCESS_RATE_WINDOW_MS,
  });
  if (!rateLimit.success) {
    return NextResponse.json(
      { success: false, error: "You have processed several uploads recently. Try again later." },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const rawTitle = formData.get("filetitle");
  const title = typeof rawTitle === "string" ? rawTitle.trim().slice(0, 240) : "";
  if (!(file instanceof File) || !title) {
    return NextResponse.json({ success: false, error: "A PDF and title are required." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ success: false, error: "PDFs must be 25 MB or smaller." }, { status: 413 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ success: false, error: "Only PDF uploads are supported." }, { status: 400 });
  }

  try {
    const result = await processUploadFile({ file, title });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RECEIPT_TTL_MS);
    await db.delete(uploadResultReceipt).where(lt(uploadResultReceipt.expiresAt, now));
    const [receipt] = await db
      .insert(uploadResultReceipt)
      .values({
        userId: session.user.id,
        result: {
          fileUrl: result.fileUrl,
          thumbnailUrl: result.thumbnailUrl ?? null,
          filename: result.filename,
          message: result.message,
        },
        expiresAt,
      })
      .returning({ id: uploadResultReceipt.id });
    if (!receipt) throw new Error("Could not issue an upload receipt.");

    return NextResponse.json({ success: true, receiptId: receipt.id, result });
  } catch (error) {
    console.error("upload processor api error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload processing failed.",
      },
      { status: 502 },
    );
  }
}

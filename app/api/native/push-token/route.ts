import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import { db, nativePushToken } from "@/db";

const bodySchema = z.object({
  token: z.string().min(8).max(8192),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

export async function POST(req: Request) {
  const secret = process.env.NATIVE_PUSH_INGEST_SECRET?.trim();
  const authorization = req.headers.get("authorization") ?? "";
  const expectedAuthorization = secret ? `Bearer ${secret}` : "";
  const hasServiceAuthorization =
    Boolean(expectedAuthorization) &&
    authorization.length === expectedAuthorization.length &&
    timingSafeEqual(Buffer.from(authorization), Buffer.from(expectedAuthorization));
  const session = hasServiceAuthorization ? null : await auth();
  if (!hasServiceAuthorization && !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const now = new Date();
  const sessionUserId = session?.user?.id;
  await db
    .insert(nativePushToken)
    .values({
      token: parsed.data.token,
      tokenHash,
      platform: parsed.data.platform ?? "unknown",
      userId: sessionUserId ?? null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: nativePushToken.tokenHash,
      set: {
        token: parsed.data.token,
        platform: parsed.data.platform ?? "unknown",
        // A service-authorized refresh does not know which user owns the
        // token, so keep any existing association instead of clearing it.
        ...(sessionUserId ? { userId: sessionUserId } : {}),
        lastSeenAt: now,
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true });
}

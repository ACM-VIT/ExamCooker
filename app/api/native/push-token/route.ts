import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(8).max(8192),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

export async function POST(req: Request) {
  const secret = process.env.NATIVE_PUSH_INGEST_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

  if (process.env.NODE_ENV !== "production") {
    console.info(
      "[api/native/push-token]",
      parsed.data.platform ?? "unknown",
      `${parsed.data.token.slice(0, 14)}…`,
    );
  }

  return NextResponse.json({ ok: true });
}

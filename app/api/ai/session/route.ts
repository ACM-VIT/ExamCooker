import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import { getPublicRequestOrigin } from "@/lib/auth-origin";
import {
  clearAiSession,
  getAiSessionStatus,
  saveAiSession,
} from "@/lib/ai/session";

const noStore = { "Cache-Control": "no-store" };
const SettingsSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  model: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  apiKey: z.string().trim().max(512).optional(),
  preserveSelection: z.boolean().optional(),
});

async function signedInUserId() {
  return (await auth())?.user?.id;
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin === (getPublicRequestOrigin(request)?.origin ?? request.nextUrl.origin);
}

export async function GET() {
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: noStore });
  return NextResponse.json(await getAiSessionStatus(userId), { headers: noStore });
}

export async function POST(request: NextRequest) {
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: noStore });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Unexpected origin." }, { status: 403, headers: noStore });
  const body = await request.json().catch(() => null);
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid AI settings." }, { status: 400, headers: noStore });
  try {
    const settings = await saveAiSession({ userId, ...parsed.data });
    return NextResponse.json(await getAiSessionStatus(userId, settings), { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save AI settings." }, { status: 400, headers: noStore });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: noStore });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Unexpected origin." }, { status: 403, headers: noStore });
  await clearAiSession();
  return NextResponse.json(await getAiSessionStatus(userId, null), { headers: noStore });
}

import { NextRequest, NextResponse } from "next/server";
import { getPublicAuthOrigin } from "@/lib/auth-origin";

export async function GET(req: NextRequest) {
    const callbackUrl = req.nextUrl.searchParams.get("redirect") || "/";
    const publicOrigin = getPublicAuthOrigin(req);
    const authQuery = new URLSearchParams({ callbackUrl }).toString();
    const authUrl = new URL(
        `/auth?${authQuery}`,
        publicOrigin?.origin ||
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_BASE_URL ||
            req.url,
    );

    return NextResponse.redirect(authUrl);
}

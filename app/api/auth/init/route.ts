import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const callbackUrl = req.nextUrl.searchParams.get("redirect") || "/home";
    const signInUrl = new URL("/api/auth/signin/google", req.url);
    signInUrl.searchParams.set("callbackUrl", callbackUrl);

    return NextResponse.redirect(signInUrl);
}

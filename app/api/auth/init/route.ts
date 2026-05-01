import { NextRequest, NextResponse } from "next/server";
import {
    getAuthOriginCookieConfig,
    getPublicAuthOrigin,
} from "@/lib/auth-origin";

export async function GET(req: NextRequest) {
    const callbackUrl = req.nextUrl.searchParams.get("redirect") || "/";
    const publicOrigin = getPublicAuthOrigin(req);
    const authUrl = new URL(
        "/auth",
        publicOrigin?.origin ||
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_BASE_URL ||
            req.url,
    );
    authUrl.searchParams.set("callbackUrl", callbackUrl);

    const response = NextResponse.redirect(authUrl);
    if (publicOrigin) {
        const cookie = getAuthOriginCookieConfig(publicOrigin);
        response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    return response;
}

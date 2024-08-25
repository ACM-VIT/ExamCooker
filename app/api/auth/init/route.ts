import { NextRequest, NextResponse } from "next/server";
import {signIn} from "@/app/auth";

export async function GET(req: NextRequest, res: NextResponse) {
    await signIn('google', {redirectTo: req.nextUrl.searchParams.get('redirect') || "/"});
}
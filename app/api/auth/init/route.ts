import { NextRequest } from "next/server";
import {signIn} from "@/app/auth";

export async function GET(req: NextRequest) {
    await signIn('google', {redirectTo: req.nextUrl.searchParams.get('redirect') || "/home"});
}

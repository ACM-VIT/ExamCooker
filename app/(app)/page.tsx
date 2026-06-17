import type { Metadata } from "next";
import { connection } from "next/server";
import Home from "@/app/(app)/home/home";

export const metadata: Metadata = {
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
};

export default async function Page() {
    // The home page personalizes auth-dependent sections (welcome subtitle,
    // sign-in CTA) inside Suspense boundaries. Under `cacheComponents`, a
    // prerendered static shell bakes in the fallback's auth state and then
    // mismatches the per-request client render, throwing React #418 hydration
    // errors. Render dynamically so the server emits the resolved auth state.
    await connection();
    return <Home />;
}

import { redirect } from "next/navigation";
import { Suspense } from "react";

async function SignInRedirectContent({
    searchParams,
}: {
    searchParams?: Promise<{ callbackUrl?: string; error?: string }>;
}) {
    const resolvedSearchParams = (await searchParams) ?? {};
    const params = new URLSearchParams();
    if (resolvedSearchParams.callbackUrl) {
        params.set("callbackUrl", resolvedSearchParams.callbackUrl);
    }
    if (resolvedSearchParams.error) {
        params.set("error", resolvedSearchParams.error);
    }
    const query = params.toString();
    redirect(`/auth${query ? `?${query}` : ""}`);
    return null;
}

export default function SignInRedirect({
    searchParams,
}: {
    searchParams?: Promise<{ callbackUrl?: string; error?: string }>;
}) {
    return (
        <Suspense fallback={null}>
            <SignInRedirectContent searchParams={searchParams} />
        </Suspense>
    );
}

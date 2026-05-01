import { redirect } from "next/navigation";

export default async function SignInRedirect({
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
}

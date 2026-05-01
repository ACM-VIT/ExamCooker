"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { captureSignInStarted } from "@/lib/posthog/client";

type Provider = {
    id: string;
    name: string;
};

const providerLabels: Record<string, string> = {
    apple: "Continue with Apple",
    google: "Continue with Google",
};

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M21.6 12.23c0-.76-.07-1.49-.2-2.19H12v4.14h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.48Z"
            />
            <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
            />
            <path
                fill="#FBBC05"
                d="M6.4 13.89A6 6 0 0 1 6.08 12c0-.66.11-1.3.32-1.89V7.52H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.48l3.34-2.59Z"
            />
            <path
                fill="#EA4335"
                d="M12 5.99c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.96 3.02 14.69 2 12 2a10 10 0 0 0-8.94 5.52l3.34 2.59C7.19 7.75 9.4 5.99 12 5.99Z"
            />
        </svg>
    );
}

function AppleIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
                fill="currentColor"
                d="M16.65 13.03c-.03-2.73 2.23-4.05 2.33-4.11-1.27-1.86-3.25-2.11-3.95-2.14-1.68-.17-3.28.99-4.13.99-.86 0-2.18-.96-3.58-.94-1.84.03-3.54 1.07-4.49 2.72-1.92 3.33-.49 8.27 1.38 10.97.91 1.32 2 2.81 3.43 2.75 1.38-.05 1.9-.89 3.56-.89 1.67 0 2.13.89 3.59.86 1.48-.03 2.42-1.35 3.33-2.68 1.05-1.53 1.48-3.02 1.5-3.1-.03-.01-2.89-1.11-2.97-4.43ZM13.93 5c.76-.92 1.27-2.2 1.13-3.47-1.09.04-2.42.73-3.2 1.65-.7.81-1.31 2.12-1.15 3.37 1.22.09 2.46-.62 3.22-1.55Z"
            />
        </svg>
    );
}

function ProviderIcon({ providerId }: { providerId: string }) {
    if (providerId === "google") return <GoogleIcon />;
    if (providerId === "apple") return <AppleIcon />;
    return null;
}

function getErrorMessage(error?: string | null) {
    if (!error) return null;
    if (error === "OAuthAccountNotLinked") {
        return "An account with this email already exists. Sign in with the provider you used before.";
    }
    return "Authentication could not be completed. Try again.";
}

export default function AuthClient({
    callbackUrl,
    error,
}: {
    callbackUrl: string;
    error?: string | null;
}) {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const errorMessage = getErrorMessage(error);

    useEffect(() => {
        let cancelled = false;

        async function loadProviders() {
            try {
                const response = await fetch("/api/auth/providers", {
                    cache: "no-store",
                });
                const payload = (await response.json()) as Record<string, Provider>;
                if (cancelled) return;

                setProviders(
                    Object.values(payload).filter((provider) =>
                        ["apple", "google"].includes(provider.id),
                    ),
                );
            } catch {
                if (!cancelled) setProviders([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadProviders();

        return () => {
            cancelled = true;
        };
    }, []);

    const visibleProviders = useMemo(() => {
        const ordered = ["google", "apple"];
        return [...providers].sort(
            (a, b) => ordered.indexOf(a.id) - ordered.indexOf(b.id),
        );
    }, [providers]);

    const handleSignIn = (provider: Provider) => {
        captureSignInStarted({
            source: "auth_page",
            callbackPath: callbackUrl,
        });
        void signIn(provider.id, { callbackUrl });
    };

    return (
        <div className="flex w-full max-w-sm flex-col items-stretch gap-3">
            {errorMessage && (
                <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-700 dark:text-red-200">
                    {errorMessage}
                </p>
            )}

            {loading ? (
                <div className="h-11 rounded-lg border border-black/15 bg-white/60 dark:border-white/15 dark:bg-white/[0.05]" />
            ) : visibleProviders.length > 0 ? (
                visibleProviders.map((provider) => (
                    <button
                        key={provider.id}
                        type="button"
                        onClick={() => handleSignIn(provider)}
                        className="inline-flex h-12 items-center justify-center gap-3 rounded-lg border border-black/20 bg-white px-5 text-sm font-semibold text-black transition-colors hover:border-black hover:bg-black hover:text-white active:translate-y-px dark:border-white/20 dark:bg-white/5 dark:text-[#D5D5D5] dark:hover:border-white/45 dark:hover:bg-white/12"
                    >
                        <ProviderIcon providerId={provider.id} />
                        {providerLabels[provider.id] ?? `Continue with ${provider.name}`}
                    </button>
                ))
            ) : (
                <p className="rounded-lg border border-black/15 bg-white/60 px-4 py-3 text-sm leading-6 text-black/70 dark:border-white/15 dark:bg-white/[0.05] dark:text-[#D5D5D5]/70">
                    Authentication is not available right now.
                </p>
            )}
        </div>
    );
}

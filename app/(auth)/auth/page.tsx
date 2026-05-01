import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/auth";
import AppImage from "@/app/components/common/app-image";
import ThemeToggle from "@/app/components/common/theme-toggle";
import AuthClient from "@/app/(auth)/auth/auth-client";
import AcmLogo from "@/public/assets/acm-logo.svg";
import ExamCookerLogoIcon from "@/public/assets/logo-icon.svg";

export const metadata: Metadata = {
    title: "Authenticate",
    description: "Authenticate with ExamCooker.",
    alternates: { canonical: "/auth" },
    robots: { index: false, follow: false },
};

function getStringParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
}

function normalizeCallbackUrl(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
        return trimmed;
    }
    try {
        const url = new URL(trimmed);
        return `${url.pathname}${url.search}${url.hash}` || "/";
    } catch {
        return "/";
    }
}

function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <main className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#C2E6EC] px-5 text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>

            <section className="flex w-full max-w-md flex-col items-center text-center">
                <Link
                    href="/"
                    aria-label="ExamCooker home"
                    className="mb-10 inline-flex max-w-full items-center justify-center gap-4 sm:gap-5"
                >
                    <AppImage
                        src={ExamCookerLogoIcon}
                        alt="ExamCooker"
                        width={72}
                        height={72}
                        className="h-16 w-16 sm:h-[72px] sm:w-[72px]"
                    />
                    <span className="h-12 w-px bg-black/15 dark:bg-white/15 sm:h-14" />
                    <AppImage
                        src={AcmLogo}
                        alt="ACM"
                        width={156}
                        height={62}
                        className="h-14 w-auto max-w-[42vw] sm:h-16 sm:max-w-none"
                    />
                </Link>

                <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                    Authenticate
                </h1>

                <div className="mt-8 flex w-full justify-center">{children}</div>
            </section>
        </main>
    );
}

function AuthFallback() {
    return (
        <div className="flex w-full max-w-sm flex-col items-stretch gap-3">
            <div className="h-12 rounded-lg border border-black/15 bg-white/60 dark:border-white/15 dark:bg-white/[0.05]" />
        </div>
    );
}

async function AuthContent({
    searchParams,
}: {
    searchParams?: Promise<{
        callbackUrl?: string | string[];
        error?: string | string[];
    }>;
}) {
    const session = await auth();
    const params = (await searchParams) ?? {};
    const rawCallbackUrl = getStringParam(params.callbackUrl).trim() || "/";
    const redirectCallbackUrl = normalizeCallbackUrl(rawCallbackUrl);

    if (session?.user) {
        redirect(redirectCallbackUrl);
    }

    return (
        <AuthClient
            callbackUrl={rawCallbackUrl}
            error={getStringParam(params.error)}
        />
    );
}

export default function AuthPage({
    searchParams,
}: {
    searchParams?: Promise<{
        callbackUrl?: string | string[];
        error?: string | string[];
    }>;
}) {
    return (
        <AuthShell>
            <Suspense fallback={<AuthFallback />}>
                <AuthContent searchParams={searchParams} />
            </Suspense>
        </AuthShell>
    );
}

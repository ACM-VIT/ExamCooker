import { notFound } from "next/navigation";
import { Suspense } from "react";
import { normalizeAuthCallbackPath } from "@/lib/auth-origin";
import { normalizeNativeAuthHandoffChallenge } from "@/lib/native-auth-token";
import NativeAuthStartClient from "./native-auth-start-client";

export const metadata = {
  title: "Start Sign In | ExamCooker",
  description: "Start native app sign-in for ExamCooker.",
};

export const instant = true;

const PROVIDERS = new Set(["apple", "google"]);

async function NativeAuthStartContent({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{
    handoffChallenge?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const [{ provider }, query] = await Promise.all([params, searchParams]);
  if (!PROVIDERS.has(provider)) {
    notFound();
  }

  const handoffChallenge = normalizeNativeAuthHandoffChallenge(
    query.handoffChallenge,
  );
  if (!handoffChallenge) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
        <p className="text-sm font-semibold">
          Authentication could not be started.
        </p>
      </main>
    );
  }

  const returnTo = normalizeAuthCallbackPath(query.returnTo);
  const callbackUrl = `/native-auth/browser-complete?${new URLSearchParams({
    handoffChallenge,
    returnTo,
  }).toString()}`;

  return (
    <NativeAuthStartClient
      provider={provider as "apple" | "google"}
      callbackUrl={callbackUrl}
    />
  );
}

export default function NativeAuthStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{
    handoffChallenge?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
          <p className="text-sm font-semibold">Opening sign in...</p>
        </main>
      }
    >
      <NativeAuthStartContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

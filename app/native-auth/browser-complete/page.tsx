import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { auth } from "@/app/auth";
import { normalizeAuthCallbackPath } from "@/lib/auth-origin";
import {
  createNativeAuthHandoffCode,
  normalizeNativeAuthHandoffChallenge,
} from "@/lib/native-auth-token";
import NativeAuthBrowserCompleteClient from "./native-auth-browser-complete-client";

export const metadata = {
  title: "Completing Sign In | ExamCooker",
  description: "Complete native app sign-in for ExamCooker.",
};

export const instant = true;

function NativeAuthMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      {children}
    </main>
  );
}

async function NativeAuthBrowserCompleteContent({
  searchParams,
}: {
  searchParams: Promise<{
    handoffChallenge?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const [session, query] = await Promise.all([auth(), searchParams]);
  const userId = session?.user?.id;
  const handoffChallenge = normalizeNativeAuthHandoffChallenge(
    query.handoffChallenge,
  );

  if (!userId || !handoffChallenge) {
    return (
      <NativeAuthMessage>
        <div className="max-w-sm">
          <p className="text-sm font-semibold">
            Authentication could not be completed.
          </p>
          <Link
            href="/auth?error=OAuthCallback"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-lg border border-black/20 bg-white px-5 text-sm font-semibold text-black dark:border-white/20 dark:bg-white/5 dark:text-[#D5D5D5]"
          >
            Try again
          </Link>
        </div>
      </NativeAuthMessage>
    );
  }

  return (
    <NativeAuthBrowserCompleteClient
      code={await createNativeAuthHandoffCode({ handoffChallenge, userId })}
      handoffChallenge={handoffChallenge}
      returnTo={normalizeAuthCallbackPath(query.returnTo)}
    />
  );
}

export default function NativeAuthBrowserCompletePage({
  searchParams,
}: {
  searchParams: Promise<{
    handoffChallenge?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  return (
    <Suspense
      fallback={
        <NativeAuthMessage>
          <p className="text-sm font-semibold">Returning to ExamCooker...</p>
        </NativeAuthMessage>
      }
    >
      <NativeAuthBrowserCompleteContent searchParams={searchParams} />
    </Suspense>
  );
}

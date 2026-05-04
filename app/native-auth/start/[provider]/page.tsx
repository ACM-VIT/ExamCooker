import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { normalizeAuthCallbackPath } from "@/lib/auth-origin";
import NativeAuthStartClient from "./native-auth-start-client";

const PROVIDERS = new Set(["apple", "google"]);

async function NativeAuthStartContent({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  await connection();
  const [{ provider }, query] = await Promise.all([params, searchParams]);
  if (!PROVIDERS.has(provider)) {
    notFound();
  }

  const returnTo = normalizeAuthCallbackPath(query.returnTo);
  const callbackUrl = `/native-auth/browser-complete?${new URLSearchParams({
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
  searchParams: Promise<{ returnTo?: string | string[] }>;
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

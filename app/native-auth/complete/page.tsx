import { Suspense } from "react";
import { connection } from "next/server";
import { normalizeAuthCallbackPath } from "@/lib/auth-origin";
import NativeAuthCompleteClient from "./native-auth-complete-client";

async function NativeAuthCompleteContent({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string | string[];
    token?: string | string[];
  }>;
}) {
  await connection();
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;

  return (
    <NativeAuthCompleteClient
      token={token ?? ""}
      returnTo={normalizeAuthCallbackPath(query.returnTo)}
    />
  );
}

export default function NativeAuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string | string[];
    token?: string | string[];
  }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
          <p className="text-sm font-semibold">Finishing sign in...</p>
        </main>
      }
    >
      <NativeAuthCompleteContent searchParams={searchParams} />
    </Suspense>
  );
}

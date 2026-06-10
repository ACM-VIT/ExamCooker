import { Suspense } from "react";
import { connection } from "next/server";
import { normalizeAuthCallbackPath } from "@/lib/auth-origin";
import { normalizeNativeAuthHandoffChallenge } from "@/lib/native-auth-token";
import NativeAuthCompleteClient from "./native-auth-complete-client";

export const metadata = {
  title: "Finishing Sign In | ExamCooker",
  description: "Return to the ExamCooker app after sign-in.",
};

async function NativeAuthCompleteContent({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string | string[];
    handoffChallenge?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  await connection();
  const query = await searchParams;
  const code = Array.isArray(query.code) ? query.code[0] : query.code;

  return (
    <NativeAuthCompleteClient
      code={code ?? ""}
      handoffChallenge={
        normalizeNativeAuthHandoffChallenge(query.handoffChallenge) ?? ""
      }
      returnTo={normalizeAuthCallbackPath(query.returnTo)}
    />
  );
}

export default function NativeAuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string | string[];
    handoffChallenge?: string | string[];
    returnTo?: string | string[];
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

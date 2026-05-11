"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { invalidateAuthSessionCache } from "@/app/components/auth-gate";

const HANDOFF_STORAGE_PREFIX = "examcooker.nativeAuthHandoff.";

export default function NativeAuthCompleteClient({
  code,
  handoffChallenge,
  returnTo,
}: {
  code: string;
  handoffChallenge: string;
  returnTo: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function completeNativeAuth() {
      if (!code || !handoffChallenge) {
        return false;
      }

      const storageKey = `${HANDOFF_STORAGE_PREFIX}${handoffChallenge}`;
      const verifier = window.sessionStorage.getItem(storageKey) ?? "";
      window.sessionStorage.removeItem(storageKey);

      if (!verifier) {
        return false;
      }

      invalidateAuthSessionCache();
      const result = await signIn("native-handoff", {
        code,
        verifier,
        callbackUrl: returnTo,
        redirect: false,
      });

      if (result?.ok) {
        window.location.assign(result.url ?? returnTo);
        return true;
      }

      return false;
    }

    void completeNativeAuth()
      .then((completed) => {
        if (!completed && !cancelled) {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, handoffChallenge, returnTo]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <p className="text-sm font-semibold">
        {failed ? "Authentication could not be completed." : "Finishing sign in..."}
      </p>
    </main>
  );
}

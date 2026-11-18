"use client";

import { useEffect, useRef, useState } from "react";
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
  // The handoff code is single-use, so it is exchanged once per page even when
  // React re-runs the effect (Strict Mode in development).
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function completeNativeAuth() {
      if (!code || !handoffChallenge) {
        return false;
      }

      const storageKey = `${HANDOFF_STORAGE_PREFIX}${handoffChallenge}`;
      const verifier = window.sessionStorage.getItem(storageKey) ?? "";
      if (!verifier) {
        return false;
      }

      invalidateAuthSessionCache();
      try {
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
      } finally {
        // The server consumes the code whatever the outcome, so the verifier
        // is useless after this attempt.
        window.sessionStorage.removeItem(storageKey);
      }
    }

    void completeNativeAuth()
      .then((completed) => {
        if (!completed && mountedRef.current) setFailed(true);
      })
      .catch(() => {
        if (mountedRef.current) setFailed(true);
      });
  }, [code, handoffChallenge, returnTo]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <p className="text-sm font-semibold">
        {failed ? "Authentication could not be completed." : "Finishing sign in..."}
      </p>
      {failed ? (
        <a
          href={`/auth?${new URLSearchParams({ callbackUrl: returnTo || "/" }).toString()}`}
          className="text-sm font-semibold underline underline-offset-4"
        >
          Try signing in again
        </a>
      ) : null}
    </main>
  );
}

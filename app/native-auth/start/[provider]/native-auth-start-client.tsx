"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

type StartState = "starting" | "failed";

export default function NativeAuthStartClient({
  provider,
  callbackUrl,
}: {
  provider: "apple" | "google";
  callbackUrl: string;
}) {
  const [state, setState] = useState<StartState>("starting");
  // signIn redirects this browser; start it once even if the effect re-runs.
  const startedRef = useRef(false);

  const start = useCallback(() => {
    setState("starting");
    // On success signIn navigates away, so only a failure changes the state.
    void signIn(provider, { callbackUrl }).catch(() => setState("failed"));
  }, [callbackUrl, provider]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
  }, [start]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <p className="text-sm font-semibold">
        {state === "failed" ? "Authentication could not be started." : "Opening sign in..."}
      </p>
      {state === "failed" ? (
        <button
          type="button"
          onClick={start}
          className="text-sm font-semibold underline underline-offset-4"
        >
          Try again
        </button>
      ) : null}
    </main>
  );
}

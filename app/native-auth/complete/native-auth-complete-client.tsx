"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { invalidateAuthSessionCache } from "@/app/components/auth-gate";

export default function NativeAuthCompleteClient({
  token,
  returnTo,
}: {
  token: string;
  returnTo: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) {
      setFailed(true);
      return;
    }

    void (async () => {
      invalidateAuthSessionCache();
      const result = await signIn("native-handoff", {
        token,
        callbackUrl: returnTo,
        redirect: false,
      });

      if (result?.ok) {
        window.location.assign(result.url ?? returnTo);
        return;
      }

      setFailed(true);
    })().catch(() => {
      setFailed(true);
    });
  }, [returnTo, token]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <p className="text-sm font-semibold">
        {failed ? "Authentication could not be completed." : "Finishing sign in..."}
      </p>
    </main>
  );
}

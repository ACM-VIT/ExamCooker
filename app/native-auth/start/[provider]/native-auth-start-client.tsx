"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function NativeAuthStartClient({
  provider,
  callbackUrl,
}: {
  provider: "apple" | "google";
  callbackUrl: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void signIn(provider, { callbackUrl }).catch(() => {
      setFailed(true);
    });
  }, [callbackUrl, provider]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <p className="text-sm font-semibold">
        {failed ? "Authentication could not be started." : "Opening sign in..."}
      </p>
    </main>
  );
}

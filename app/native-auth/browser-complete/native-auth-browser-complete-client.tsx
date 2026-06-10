"use client";

import { useEffect } from "react";

export default function NativeAuthBrowserCompleteClient({
  code,
  handoffChallenge,
  returnTo,
}: {
  code: string;
  handoffChallenge: string;
  returnTo: string;
}) {
  useEffect(() => {
    const target = `examcooker://native-auth/complete?${new URLSearchParams({
      code,
      handoffChallenge,
      returnTo,
    }).toString()}`;
    window.location.replace(target);
  }, [code, handoffChallenge, returnTo]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <p className="text-sm font-semibold">Returning to ExamCooker...</p>
    </main>
  );
}

"use client";

import { useEffect } from "react";

export default function NativeAuthBrowserCompleteClient({
  token,
  returnTo,
}: {
  token: string;
  returnTo: string;
}) {
  useEffect(() => {
    const target = `examcooker://native-auth/complete?${new URLSearchParams({
      token,
      returnTo,
    }).toString()}`;
    window.location.replace(target);
  }, [returnTo, token]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#C2E6EC] px-6 text-center text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <p className="text-sm font-semibold">Returning to ExamCooker...</p>
    </main>
  );
}

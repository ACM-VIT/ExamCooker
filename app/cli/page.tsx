import { Suspense } from "react";
import type { Metadata } from "next";
import CliAuthScreen, { CliAuthScreenFallback } from "./cli-auth-screen";

export const metadata: Metadata = {
    title: "CLI sign-in",
    alternates: { canonical: "/cli" },
    robots: { index: false, follow: false },
};

export default function CliPage() {
  return (
    <Suspense fallback={<CliAuthScreenFallback />}>
      <CliAuthScreen />
    </Suspense>
  );
}

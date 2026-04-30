import { Suspense } from "react";
import CliAuthScreen, { CliAuthScreenFallback } from "./cli-auth-screen";

export default function CliPage() {
  return (
    <Suspense fallback={<CliAuthScreenFallback />}>
      <CliAuthScreen />
    </Suspense>
  );
}

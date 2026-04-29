import { Suspense } from "react";
import CliAuthScreen, { CliAuthScreenFallback } from "./CliAuthScreen";

export default function CliPage() {
  return (
    <Suspense fallback={<CliAuthScreenFallback />}>
      <CliAuthScreen />
    </Suspense>
  );
}

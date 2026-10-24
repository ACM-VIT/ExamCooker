"use client";

import { invalidateAuthSessionCache } from "@/app/components/auth-gate";
import { captureUserSignedOut } from "@/lib/posthog/client";

export async function signOutWithAiSession() {
  const response = await fetch("/api/ai/session", { method: "DELETE", cache: "no-store" });
  if (!response.ok) throw new Error("Could not remove this browser session's AI key.");

  captureUserSignedOut();
  invalidateAuthSessionCache();
  const { signOut } = await import("next-auth/react");
  try {
    await signOut({ callbackUrl: "/" });
  } finally {
    invalidateAuthSessionCache();
  }
}

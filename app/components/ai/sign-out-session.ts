"use client";

import { invalidateAuthSessionCache } from "@/app/components/auth-gate";
import { captureUserSignedOut } from "@/lib/posthog/client";

export async function signOutWithAiSession() {
  captureUserSignedOut();
  invalidateAuthSessionCache();
  const { signOut } = await import("next-auth/react");
  try {
    await signOut({ callbackUrl: "/" });
  } finally {
    invalidateAuthSessionCache();
  }
}

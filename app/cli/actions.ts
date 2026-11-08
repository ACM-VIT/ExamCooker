"use server";

import { redirect } from "next/navigation";
import { auth } from "@/app/auth";
import {
  authorizeCliDeviceAuthRequest,
  denyCliDeviceAuthRequest,
  type CliDeviceAuthState,
} from "@/lib/cli/device-auth";
import { normalizeCliUserCode } from "@/lib/cli/tokens";

export type CliDeviceDecision = "approve" | "deny";

/**
 * Records the signed-in user's decision and returns the request's resulting
 * state, so the page shows what the server stored rather than what it asked.
 */
export async function decideCliDeviceAuthAction(
  formData: FormData,
): Promise<CliDeviceAuthState> {
  const userCode = normalizeCliUserCode(String(formData.get("userCode") ?? ""));
  const decision = formData.get("decision");

  if (!userCode || (decision !== "approve" && decision !== "deny")) {
    return "invalid";
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect(
      `/api/auth/init?redirect=${encodeURIComponent(`/cli?code=${userCode}`)}`,
    );
  }

  return decision === "approve"
    ? authorizeCliDeviceAuthRequest({ userCode, userId })
    : denyCliDeviceAuthRequest({ userCode });
}

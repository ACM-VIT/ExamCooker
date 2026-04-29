"use server";

import { redirect } from "next/navigation";
import { auth } from "@/app/auth";
import { authorizeCliDeviceAuthRequest } from "@/lib/cli/deviceAuth";
import { normalizeCliUserCode } from "@/lib/cli/tokens";

export async function approveCliDeviceAuthAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  const rawUserCode = String(formData.get("userCode") ?? "");
  const userCode = normalizeCliUserCode(rawUserCode);

  if (!userCode) {
    redirect("/cli");
  }

  if (!userId) {
    redirect(`/api/auth/init?redirect=${encodeURIComponent(`/cli?code=${userCode}`)}`);
  }

  await authorizeCliDeviceAuthRequest({
    userCode,
    userId,
  });

  redirect(`/cli?code=${encodeURIComponent(userCode)}&approved=1`);
}

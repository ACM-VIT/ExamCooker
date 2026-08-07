import { auth } from "@/app/auth";
import { getAzureMonitorSnapshot } from "@/lib/azure-monitor";
import {
  isAzureMonitorRange,
  type AzureMonitorRange,
} from "@/lib/azure-monitor-types";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (session.user.role !== "MODERATOR") {
    return Response.json({ error: "Moderator access required" }, { status: 403 });
  }

  const requestedRange = new URL(request.url).searchParams.get("range");
  const range: AzureMonitorRange = isAzureMonitorRange(requestedRange)
    ? requestedRange
    : "1h";

  try {
    const snapshot = await getAzureMonitorSnapshot(range);
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[azure-monitor] Failed to load metrics", error);
    return Response.json(
      { error: "Azure Monitor is temporarily unavailable" },
      { status: 502 },
    );
  }
}

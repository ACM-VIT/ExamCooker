import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import ClientSide from "@/app/(app)/client-side";
import { auth } from "@/app/auth";
import AzureObservabilityDashboard from "./azure-observability-dashboard";

export const metadata: Metadata = {
  title: "Azure Live | ExamCooker",
  description: "Private live infrastructure telemetry for ExamCooker.",
};

export const instant = true;

async function ProtectedAzureObservabilityDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "MODERATOR") notFound();

  return <AzureObservabilityDashboard />;
}

export default function AzureObservabilityPage() {
  return (
    <ClientSide>
      <Suspense fallback={<AzureObservabilityDashboard enabled={false} />}>
        <ProtectedAzureObservabilityDashboard />
      </Suspense>
    </ClientSide>
  );
}

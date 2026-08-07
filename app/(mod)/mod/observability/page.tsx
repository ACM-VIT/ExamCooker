import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/app/auth";
import AzureObservabilityDashboard from "./azure-observability-dashboard";

export const metadata: Metadata = {
  title: "Azure Live | ExamCooker",
  description: "Private live infrastructure telemetry for ExamCooker.",
};

async function ProtectedAzureObservabilityDashboard() {
  await connection();
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "MODERATOR") notFound();

  return <AzureObservabilityDashboard />;
}

export default function AzureObservabilityPage() {
  return (
    <Suspense fallback={<AzureObservabilityDashboard enabled={false} />}>
      <ProtectedAzureObservabilityDashboard />
    </Suspense>
  );
}

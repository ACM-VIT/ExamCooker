import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/auth";

export const metadata: Metadata = { title: "Cloudflare Metrics | ExamCooker" };

async function CloudflareMetrics() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "MODERATOR") notFound();
  return redirect("https://dash.cloudflare.com/4ee36e42cabfd44e8ce61b2a6bd637c5/workers/services/view/examcooker-prod/production/metrics");
}

export default function ObservabilityPage() {
  return <Suspense fallback={null}><CloudflareMetrics /></Suspense>;
}

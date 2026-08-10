import React, { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import ClientSide from "@/app/(app)/client-side";
import { auth } from "@/app/auth";
import { fetchModerationWorkbenchSnapshot } from "@/app/actions/moderator-actions";
import ModerationWorkbench, {
    ModerationWorkbenchSkeleton,
} from "@/app/components/mod/moderation-workbench";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Moderator Dashboard | ExamCooker",
};

export const instant = true;

async function ModerationWorkbenchContent() {
    const session = await auth();
    if (!session?.user) redirect("/");
    if (session.user.role !== "MODERATOR") notFound();

    const snapshot = await fetchModerationWorkbenchSnapshot();
    return (
        <ModerationWorkbench
            initialNotes={snapshot.notes}
            initialPastPapers={snapshot.pastPapers}
            initialCorrectionReports={snapshot.correctionReports}
            totalUsers={snapshot.totalUsers}
        />
    );
}

function ModeratorDashboard() {
    return (
        <ClientSide>
            <Suspense fallback={<ModerationWorkbenchSkeleton />}>
                <ModerationWorkbenchContent />
            </Suspense>
        </ClientSide>
    );
}

export default ModeratorDashboard;

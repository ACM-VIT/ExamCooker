import React, { Suspense } from "react";
import {auth} from "../../auth";
import {fetchUnclearedItems} from "../../actions/moderator-actions";
import ModeratorDashboardClient from "../../components/moderator-dash-board";
import { notFound, redirect } from "next/navigation";

type ModeratorSearchParams = { page?: string; search?: string; tags?: string | string[] };

function ModeratorDashboardShell() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)]" aria-hidden="true">
            <div className="h-8 w-8 animate-spin border-2 border-black border-t-transparent dark:border-[#D5D5D5] dark:border-t-transparent" />
        </div>
    );
}

async function ModeratorDashboardContent({
    searchParamsPromise,
}: {
    searchParamsPromise: Promise<ModeratorSearchParams> | undefined;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    if (session.user.role !== "MODERATOR") {
        notFound();
    }

    try {
        const params = (await searchParamsPromise) ?? {};
        const {notes, pastPapers, totalUsers} = await fetchUnclearedItems();
        return (
            <ModeratorDashboardClient
                initialNotes={notes}
                initialPastPapers={pastPapers}
                searchParams={params}
                totalUsers={totalUsers}
            />
        );
    } catch (error) {
        if (error instanceof Error) {
            return <div>Error fetching data: {error.message}</div>;
        } else {
            return <div>Error fetching data: Unknown error occurred.</div>;
        }
    }
}

function ModeratorDashboard({
    searchParams,
}: {
    searchParams?: Promise<ModeratorSearchParams>;
}) {
    return (
        <Suspense fallback={<ModeratorDashboardShell />}>
            <ModeratorDashboardContent searchParamsPromise={searchParams} />
        </Suspense>
    );
}

export default ModeratorDashboard;

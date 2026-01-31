import React from "react";
import {auth} from "../../auth";
import {fetchUnclearedItems} from "../../actions/moderatorActions";
import ModeratorDashboardClient from "../../components/ModeratorDashBoard";
import { notFound, redirect } from "next/navigation";

async function ModeratorDashboard({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string; tags?: string | string[] }>;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "MODERATOR") {
        notFound();
    }

    try {
        const params = (await searchParams) ?? {};
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

export default ModeratorDashboard;

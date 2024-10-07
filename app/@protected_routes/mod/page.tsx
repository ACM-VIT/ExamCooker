import React from "react";
import {auth} from "../../auth";
import {fetchUnclearedItems} from "../../actions/moderatorActions";
import ModeratorDashboardClient from "../../components/ModeratorDashBoard";

async function ModeratorDashboard({searchParams}: {
    searchParams: { page?: string; search?: string; tags?: string | string[] };
}) {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        return <div>Access denied. Only moderators can view this page.</div>;
    }

    try {
        const {notes, pastPapers, totalUsers} = await fetchUnclearedItems();
        return (
            <ModeratorDashboardClient
                initialNotes={notes}
                initialPastPapers={pastPapers}
                searchParams={searchParams}
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

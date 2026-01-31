"use client";

import React from "react";
import { useSession } from "next-auth/react";
import EditButton from "@/app/components/EditButton";
import DeleteButton from "@/app/components/DeleteButton";

type ItemActionsProps = {
    itemId: string;
    title: string;
    authorId?: string | null;
    activeTab: "pastPaper" | "notes";
};

export default function ItemActions({ itemId, title, authorId, activeTab }: ItemActionsProps) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const role = session?.user?.role;

    return (
        <>
            {role === "MODERATOR" && (
                <EditButton itemID={itemId} title={title} activeTab={activeTab} />
            )}
            {authorId && userId === authorId && (
                <DeleteButton itemID={itemId} activeTab={activeTab} />
            )}
        </>
    );
}

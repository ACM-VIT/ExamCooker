"use client";

import React from "react";
import EditButton from "@/app/components/edit-button";
import DeleteButton from "@/app/components/delete-button";
import { useGuestPrompt } from "@/app/components/auth-gate";

type ItemActionsProps = {
    itemId: string;
    title: string;
    authorId?: string | null;
    activeTab: "pastPaper" | "notes";
};

export default function ItemActions({ itemId, title, authorId, activeTab }: ItemActionsProps) {
    const { session } = useGuestPrompt();
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

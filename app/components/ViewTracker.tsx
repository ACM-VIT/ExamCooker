"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { recordGuestRecentView } from "@/app/lib/guestStorage";
import { recordViewAction, type ViewableItemType } from "@/app/actions/recordView";

type ViewTrackerProps = {
    id: string;
    type: ViewableItemType;
    title: string;
};

export default function ViewTracker({ id, type, title }: ViewTrackerProps) {
    const { status } = useSession();
    const didRun = useRef(false);

    useEffect(() => {
        if (didRun.current || status === "loading") return;
        didRun.current = true;

        if (status === "authenticated") {
            recordViewAction(type, id).catch(() => undefined);
            return;
        }

        if (type !== "syllabus") {
            recordGuestRecentView({ id, type, title });
        }
    }, [id, type, title, status]);

    return null;
}

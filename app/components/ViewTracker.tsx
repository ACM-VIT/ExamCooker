"use client";

import { useEffect, useRef } from "react";
import { recordGuestRecentView } from "@/lib/guestStorage";
import { recordViewAction, type ViewableItemType } from "@/app/actions/recordView";

type ViewTrackerProps = {
    id: string;
    type: ViewableItemType;
    title: string;
};

export default function ViewTracker({ id, type, title }: ViewTrackerProps) {
    const didRun = useRef(false);

    useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;

        recordViewAction(type, id)
            .then((result) => {
                if (!result.success && type !== "syllabus") {
                    recordGuestRecentView({ id, type, title });
                }
            })
            .catch(() => {
                if (type !== "syllabus") {
                    recordGuestRecentView({ id, type, title });
                }
            });
    }, [id, type, title]);

    return null;
}

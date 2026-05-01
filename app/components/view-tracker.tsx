"use client";

import { useEffect, useRef } from "react";
import { recordGuestRecentView } from "@/lib/guest-storage";
import { recordViewAction, type ViewableItemType } from "@/app/actions/record-view";
import { captureContentViewed } from "@/lib/posthog/client";

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

        captureContentViewed({
            contentType: type,
            contentId: id,
            title,
        });

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

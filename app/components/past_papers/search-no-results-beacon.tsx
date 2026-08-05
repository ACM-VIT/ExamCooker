"use client";

import { useEffect, useRef } from "react";
import { captureCourseSearchNoResults } from "@/lib/posthog/client";

/**
 * Fires `course_search_no_results` from the server-rendered empty results page.
 *
 * The client dropdown only captured no-results while someone was typing, so a
 * back-navigation, a shared dead-end link, or a direct `/past_papers?search=…`
 * URL that landed on the empty page emitted nothing — undercounting the very
 * failures this page is trying to fix. This mounts on the empty state and
 * reports once per distinct query.
 */
export default function SearchNoResultsBeacon({ query }: { query: string }) {
    const firedFor = useRef<string | null>(null);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed || firedFor.current === trimmed) return;
        firedFor.current = trimmed;
        captureCourseSearchNoResults({ context: "past_papers", query: trimmed });
    }, [query]);

    return null;
}

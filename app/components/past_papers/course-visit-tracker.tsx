"use client";

import { useEffect, useRef } from "react";
import { recordCourseVisit } from "./course-visit-ranking";
import { capturePastPapersCourseViewed } from "@/lib/posthog/client";
import {
    getCourseNotesPath,
    getCoursePastPapersPath,
    getCourseSyllabusPath,
} from "@/lib/seo";

type CourseVisitContext = "past_papers" | "notes" | "syllabus";

type Props = {
    code: string;
    context?: CourseVisitContext;
};

const CONTEXT_LABEL: Record<CourseVisitContext, string> = {
    past_papers: "Past papers",
    notes: "Notes",
    syllabus: "Syllabus",
};

function getContextPath(context: CourseVisitContext, code: string) {
    if (context === "notes") return getCourseNotesPath(code);
    if (context === "syllabus") return getCourseSyllabusPath(code);
    return getCoursePastPapersPath(code);
}

export default function CourseVisitTracker({
    code,
    context = "past_papers",
}: Props) {
    const lastTrackedKey = useRef<string | null>(null);

    useEffect(() => {
        const trackingKey = `${code}:${context}`;
        if (lastTrackedKey.current === trackingKey) return;
        lastTrackedKey.current = trackingKey;

        if (context === "past_papers") {
            capturePastPapersCourseViewed(code);
        }
        recordCourseVisit(code, {
            label: CONTEXT_LABEL[context],
            path: getContextPath(context, code),
        });
    }, [code, context]);

    return null;
}

"use client";

import { useEffect, useRef } from "react";
import { recordCourseVisit } from "./courseVisitRanking";

type Props = {
    code: string;
};

export default function CourseVisitTracker({ code }: Props) {
    const didRun = useRef(false);

    useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;
        recordCourseVisit(code);
    }, [code]);

    return null;
}

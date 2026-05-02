"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CourseGridItem } from "@/lib/data/course-catalog";
import CourseGridCard from "./course-grid-card";
import {
    loadCourseVisitRecords,
    subscribeToCourseVisitChanges,
    type CourseVisitRecord,
} from "./course-visit-ranking";
import {
    usePersonalSchedule,
    isExamUpcoming,
} from "./personal-schedule";

type Props = {
    courses: CourseGridItem[];
    className: string;
    page: number;
    pageSize: number;
    rankCourses?: boolean;
};

const MIN_PERSONAL_SIGNAL = 2;
const RECENCY_WINDOW_MS = 1000 * 60 * 60 * 24 * 90;

function hasUsefulPersonalSignal(records: Record<string, CourseVisitRecord>) {
    const now = Date.now();
    const relevant = Object.values(records).filter(
        (record) =>
            record.count >= MIN_PERSONAL_SIGNAL &&
            now - record.lastVisitedAt <= RECENCY_WINDOW_MS,
    );
    return relevant.length > 0;
}

function personalScore(record: CourseVisitRecord | undefined) {
    if (!record) return 0;
    const ageDays = Math.max(0, (Date.now() - record.lastVisitedAt) / 86_400_000);
    const recencyBoost = Math.max(0, 90 - ageDays) / 90;
    return record.count * 100 + recencyBoost;
}

export default function SmartCourseGrid({
    courses,
    className,
    page,
    pageSize,
    rankCourses = true,
}: Props) {
    const [records, setRecords] = useState<Record<string, CourseVisitRecord> | null>(null);
    const personalSchedule = usePersonalSchedule();

    useEffect(() => {
        setRecords(loadCourseVisitRecords());

        const unsubVisits = subscribeToCourseVisitChanges(() => {
            setRecords(loadCourseVisitRecords());
        });

        return unsubVisits;
    }, []);

    const sortedCourses = useMemo(() => {
        if (!rankCourses) return courses;

        const currentRecords = records ?? {};
        const usePersonalSignal = records !== null && hasUsefulPersonalSignal(currentRecords);
        const currentSchedule = personalSchedule ?? {};
        return [...courses].sort((a, b) => {
            const schedA = currentSchedule[a.code]?.scheduledAt;
            const schedB = currentSchedule[b.code]?.scheduledAt;
            const isUpcomingA = schedA !== undefined && isExamUpcoming(schedA);
            const isUpcomingB = schedB !== undefined && isExamUpcoming(schedB);

            if (isUpcomingA && !isUpcomingB) return -1;
            if (!isUpcomingA && isUpcomingB) return 1;
            if (isUpcomingA && isUpcomingB) {
                return schedA - schedB;
            }

            if (usePersonalSignal) {
                const personalDelta =
                    personalScore(currentRecords[b.code]) - personalScore(currentRecords[a.code]);
                if (personalDelta !== 0) return personalDelta;
            }

            return (
                b.viewCount - a.viewCount ||
                b.paperCount - a.paperCount ||
                b.noteCount - a.noteCount ||
                a.title.localeCompare(b.title)
            );
        });
    }, [courses, rankCourses, records, personalSchedule]);

    const start = (page - 1) * pageSize;
    const visibleCourses = sortedCourses.slice(start, start + pageSize);

    return (
        <div className={className}>
            {visibleCourses.map((course) => (
                <CourseGridCard key={course.id} course={course} />
            ))}
        </div>
    );
}

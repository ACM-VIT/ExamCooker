"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CourseGridItem } from "@/lib/data/course-catalog";
import CourseGridCard from "./course-grid-card";
import {
    loadCourseVisitRecords,
    subscribeToCourseVisitChanges,
    type CourseVisitRecord,
} from "./course-visit-ranking";

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

    useEffect(() => {
        setRecords(loadCourseVisitRecords());
        return subscribeToCourseVisitChanges(() => {
            setRecords(loadCourseVisitRecords());
        });
    }, []);

    const sortedCourses = useMemo(() => {
        if (!rankCourses) return courses;

        const currentRecords = records ?? {};
        const usePersonalSignal = records !== null && hasUsefulPersonalSignal(currentRecords);

        return [...courses].sort((a, b) => {
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
    }, [courses, rankCourses, records]);

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

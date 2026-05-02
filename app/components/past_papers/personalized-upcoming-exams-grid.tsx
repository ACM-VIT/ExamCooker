"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CourseGridItem, CourseSearchRecord } from "@/lib/data/course-catalog";
import CourseGridCard from "./course-grid-card";
import SmartCourseGrid from "./smart-course-grid";
import {
    usePersonalSchedule,
    isExamUpcoming,
} from "./personal-schedule";

type Props = {
    fallbackCourses: CourseGridItem[];
    allCourses: CourseSearchRecord[];
    className: string;
};

export default function PersonalizedUpcomingExamsGrid({
    fallbackCourses,
    allCourses,
    className,
}: Props) {
    const personalSchedule = usePersonalSchedule();

    const scheduledCourses = useMemo(() => {
        if (!personalSchedule) return null;
        
        const activeCodes = Object.keys(personalSchedule).filter((code) => {
            const time = personalSchedule[code].scheduledAt;
            return isExamUpcoming(time);
        });
        
        if (activeCodes.length === 0) return null;

        const scheduledItems: CourseGridItem[] = [];
        for (const code of activeCodes) {
            const course = allCourses.find((c) => c.code === code);
            if (course) {
                scheduledItems.push({
                    id: course.id,
                    code: course.code,
                    title: course.title,
                    paperCount: course.paperCount,
                    noteCount: course.noteCount,
                    viewCount: 0,
                });
            }
        }
        
        return scheduledItems.sort((a, b) => {
            return personalSchedule[a.code].scheduledAt - personalSchedule[b.code].scheduledAt;
        });
    }, [personalSchedule, allCourses]);

    if (scheduledCourses && scheduledCourses.length > 0) {
        return (
            <div className={className}>
                {scheduledCourses.map((course) => (
                    <CourseGridCard key={course.id} course={course} />
                ))}
            </div>
        );
    }

    return (
        <SmartCourseGrid
            courses={fallbackCourses}
            className={className}
            page={1}
            pageSize={fallbackCourses.length}
            rankCourses={false}
        />
    );
}

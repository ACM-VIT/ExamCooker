"use client";

import React, { useRef, useState } from "react";
import NoteReviewRow, { type NoteRowData } from "./note-review-row";
import type { CourseOption } from "./course-picker";

type Props = {
    initialNotes: NoteRowData[];
    courses: CourseOption[];
};

export default function NoteReviewList({ initialNotes, courses }: Props) {
    const initialNotesRef = useRef(initialNotes);
    const initialCoursesRef = useRef(courses);
    const [notes, setNotes] = useState(initialNotesRef.current);
    const [courseOptions, setCourseOptions] = useState(initialCoursesRef.current);

    const onResolved = (id: string) => {
        setNotes((prev) => prev.filter((n) => n.id !== id));
    };

    const onCourseCreated = (course: CourseOption) => {
        setCourseOptions((prev) => {
            if (prev.some((c) => c.id === course.id || c.code === course.code)) return prev;
            return [...prev, course].sort((a, b) => a.code.localeCompare(b.code));
        });
    };

    if (notes.length === 0) {
        return (
            <div className="border-2 border-dashed border-black/20 dark:border-[#D5D5D5]/20 p-8 text-center text-black/60 dark:text-[#D5D5D5]/60">
                No notes in the review queue.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                {notes.length} notes pending
            </p>
            <div className="flex flex-col gap-4">
                {notes.map((note) => (
                    <NoteReviewRow
                        key={note.id}
                        note={note}
                        courses={courseOptions}
                        onResolved={onResolved}
                        onCourseCreated={onCourseCreated}
                    />
                ))}
            </div>
        </div>
    );
}

"use client";

import React, { useRef, useState } from "react";
import NoteReviewRow, { type NoteRowData } from "./NoteReviewRow";
import type { CourseOption } from "./CoursePicker";

type Props = {
    initialNotes: NoteRowData[];
    courses: CourseOption[];
};

export default function NoteReviewList({ initialNotes, courses }: Props) {
    const initialNotesRef = useRef(initialNotes);
    const [notes, setNotes] = useState(initialNotesRef.current);

    const onResolved = (id: string) => {
        setNotes((prev) => prev.filter((n) => n.id !== id));
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
                        courses={courses}
                        onResolved={onResolved}
                    />
                ))}
            </div>
        </div>
    );
}

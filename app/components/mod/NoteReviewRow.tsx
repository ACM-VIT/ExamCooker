"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import CoursePicker, { type CourseOption } from "./CoursePicker";
import { updateNoteCourse } from "@/app/actions/updateNoteCourse";

export type NoteRowData = {
    id: string;
    title: string;
    thumbNailUrl: string | null;
    courseId: string | null;
};

type Props = {
    note: NoteRowData;
    courses: CourseOption[];
    onResolved: (id: string) => void;
};

export default function NoteReviewRow({ note, courses, onResolved }: Props) {
    const [courseId, setCourseId] = useState<string | null>(note.courseId);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        setSaving(true);
        try {
            await updateNoteCourse({ id: note.id, courseId });
            if (courseId !== null) onResolved(note.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 border-2 border-black/20 dark:border-[#D5D5D5]/20 bg-white/60 dark:bg-[#0C1222] p-4 sm:flex-row sm:items-start">
            {note.thumbNailUrl ? (
                <div className="relative h-28 w-20 shrink-0 overflow-hidden border border-black/20 dark:border-[#D5D5D5]/20">
                    <Image
                        src={note.thumbNailUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="80px"
                    />
                </div>
            ) : (
                <div className="h-28 w-20 shrink-0 border border-black/20 dark:border-[#D5D5D5]/20 bg-black/5 dark:bg-white/5" />
            )}
            <div className="min-w-0 flex-1">
                <Link
                    href={`/notes/${note.id}`}
                    target="_blank"
                    className="block break-words text-sm font-semibold text-black hover:underline dark:text-[#D5D5D5]"
                >
                    {note.title}
                </Link>
                <p className="mt-1 font-mono text-xs text-black/50 dark:text-[#D5D5D5]/50">
                    {note.id}
                </p>
                <div className="mt-3 max-w-md">
                    <CoursePicker
                        courses={courses}
                        value={courseId}
                        onChange={setCourseId}
                    />
                </div>
                {error && (
                    <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>
                )}
            </div>
            <div className="sm:self-end">
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || courseId === null}
                    className="border-2 border-black bg-[#5FC4E7] px-4 py-2 text-sm font-semibold text-black transition hover:translate-x-[-2px] hover:translate-y-[-2px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? "Saving…" : "Save & resolve"}
                </button>
            </div>
        </div>
    );
}

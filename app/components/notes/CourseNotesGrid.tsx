"use client";

import React, { useCallback, useMemo, useState, ViewTransition } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faXmark } from "@fortawesome/free-solid-svg-icons";
import NotesCard from "@/app/components/NotesCard";
import type { CourseNoteListItem } from "@/lib/data/notes";
import {
    downloadPdfFile,
    downloadPdfZip,
} from "@/lib/downloads/browserDownloads";
import {
    buildNotePdfFileName,
    buildNotesZipFileName,
} from "@/lib/downloads/resourceNames";

type Props = {
    notes: CourseNoteListItem[];
    courseCode: string;
    courseTitle: string;
};

export default function CourseNotesGrid({
    notes,
    courseCode,
    courseTitle,
}: Props) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);

    const noteById = useMemo(
        () => new Map(notes.map((note) => [note.id, note])),
        [notes],
    );

    const getFileName = useCallback(
        (note: CourseNoteListItem) =>
            buildNotePdfFileName({
                courseCode,
                courseTitle,
                title: note.title,
            }),
        [courseCode, courseTitle],
    );

    const toggle = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clear = useCallback(() => setSelected(new Set()), []);

    const downloadNote = useCallback(
        (id: string) => {
            const note = noteById.get(id);
            if (!note) return;

            void downloadPdfFile({
                fileUrl: note.fileUrl,
                fileName: getFileName(note),
            });
        },
        [getFileName, noteById],
    );

    const downloadSelected = useCallback(async () => {
        if (isDownloading) return;

        const selectedNotes = Array.from(selected)
            .map((id) => noteById.get(id))
            .filter((note): note is CourseNoteListItem => Boolean(note));

        if (!selectedNotes.length) return;

        setIsDownloading(true);
        try {
            await downloadPdfZip({
                zipFileName: buildNotesZipFileName({ courseCode, courseTitle }),
                files: selectedNotes.map((note) => ({
                    fileUrl: note.fileUrl,
                    fileName: getFileName(note),
                })),
            });
        } catch {
            window.alert("Could not create the notes zip file. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    }, [courseCode, courseTitle, getFileName, isDownloading, noteById, selected]);

    const count = selected.size;

    return (
        <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {notes.map((note, index) => (
                    <ViewTransition key={note.id}>
                        <NotesCard
                            note={note}
                            index={index}
                            selected={selected.has(note.id)}
                            onToggleSelect={toggle}
                            onDownload={downloadNote}
                        />
                    </ViewTransition>
                ))}
            </section>

            {count > 0 && (
                <div
                    role="region"
                    aria-label="Notes selection toolbar"
                    className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3"
                >
                    <div className="flex items-center gap-2 rounded-md border border-black/15 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/95">
                        <span className="text-xs font-semibold text-black dark:text-[#D5D5D5] sm:text-sm">
                            {count} selected
                        </span>
                        <button
                            type="button"
                            onClick={downloadSelected}
                            disabled={isDownloading}
                            className="inline-flex h-8 items-center gap-1.5 rounded border border-black/20 bg-[#5FC4E7]/90 px-3 text-xs font-semibold text-black transition hover:bg-[#5FC4E7] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/30 sm:text-sm"
                        >
                            <FontAwesomeIcon icon={faDownload} className="h-3 w-3" />
                            {isDownloading ? "Zipping..." : "Download"}
                        </button>
                        <button
                            type="button"
                            onClick={clear}
                            aria-label="Clear selection"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-black/50 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                        >
                            <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

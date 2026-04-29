"use client";

import React, { useCallback, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useToast } from "@/app/components/ui/use-toast";
import CoursePaperCard from "./CoursePaperCard";
import type { CoursePaperListItem } from "@/lib/data/coursePapers";
import { downloadPdfZip } from "@/lib/downloads/browserDownloads";
import {
    buildPastPaperPdfFileName,
    buildPastPaperZipFileName,
} from "@/lib/downloads/resourceNames";
import { examTypeLabel } from "@/lib/examSlug";

type Props = {
    papers: CoursePaperListItem[];
    courseCode: string;
    courseTitle: string;
};

const WIDE_STRETCH_CLASS_BY_REMAINDER: Partial<Record<number, string>> = {
    2: "xl:grow xl:max-w-[calc((100%-0.75rem)/2)]",
    3: "xl:grow xl:max-w-[calc((100%-1.5rem)/3)]",
    4: "xl:grow xl:max-w-[calc((100%-2.25rem)/4)]",
};

export default function CoursePaperGrid({
    papers,
    courseCode,
    courseTitle,
}: Props) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);
    const { toast } = useToast();
    const wideRemainder = papers.length % 5;
    const wideStretchClass = WIDE_STRETCH_CLASS_BY_REMAINDER[wideRemainder] ?? "";

    const toggle = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clear = useCallback(() => setSelected(new Set()), []);

    const paperById = useMemo(
        () => new Map(papers.map((paper) => [paper.id, paper])),
        [papers],
    );

    const downloadSelected = useCallback(async () => {
        if (isDownloading) return;

        const selectedPapers = Array.from(selected)
            .map((id) => paperById.get(id))
            .filter((paper): paper is CoursePaperListItem => Boolean(paper));

        if (!selectedPapers.length) return;

        setIsDownloading(true);
        try {
            await downloadPdfZip({
                zipFileName: buildPastPaperZipFileName({ courseCode, courseTitle }),
                files: selectedPapers.map((paper) => ({
                    fileUrl: paper.fileUrl,
                    fileName: buildPastPaperPdfFileName({
                        courseCode,
                        courseTitle,
                        title: paper.title,
                        examLabel: paper.examType ? examTypeLabel(paper.examType) : null,
                        slot: paper.slot,
                        year: paper.year,
                        hasAnswerKey: paper.hasAnswerKey,
                    }),
                })),
            });
        } catch {
            toast({
                title: "Could not create the zip file.",
                variant: "destructive",
            });
        } finally {
            setIsDownloading(false);
        }
    }, [courseCode, courseTitle, isDownloading, paperById, selected, toast]);

    const count = selected.size;

    return (
        <>
            <div className="flex flex-wrap gap-3">
                {papers.map((paper, index) => (
                    <div
                        key={paper.id}
                        className={`min-w-0 basis-[calc((100%-0.75rem)/2)] sm:basis-[calc((100%-1.5rem)/3)] lg:basis-[calc((100%-2.25rem)/4)] xl:basis-[calc((100%-3rem)/5)] ${wideStretchClass}`}
                    >
                        <CoursePaperCard
                            paper={paper}
                            courseCode={courseCode}
                            courseTitle={courseTitle}
                            index={index}
                            selected={selected.has(paper.id)}
                            onToggleSelect={toggle}
                        />
                    </div>
                ))}
            </div>

            {count > 0 && (
                <div
                    role="region"
                    aria-label="Selection toolbar"
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
                            className="inline-flex h-8 items-center gap-1.5 rounded border border-black/20 bg-[#5FC4E7]/90 px-3 text-xs font-semibold text-black transition hover:bg-[#5FC4E7] dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/30 sm:text-sm"
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

"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import CoursePicker, { type CourseOption } from "./CoursePicker";
import { updatePaperMetadata } from "@/app/actions/updatePaperMetadata";
import type { ExamType, Semester, Campus } from "@/prisma/generated/client";

export type PaperRowData = {
    id: string;
    title: string;
    thumbNailUrl: string | null;
    courseId: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    semester: Semester;
    campus: Campus;
    hasAnswerKey: boolean;
};

type Props = {
    paper: PaperRowData;
    courses: CourseOption[];
    onResolved: (id: string) => void;
    onCourseCreated: (course: CourseOption) => void;
};

const EXAM_OPTIONS: { value: ExamType; label: string }[] = [
    { value: "CAT_1", label: "CAT-1" },
    { value: "CAT_2", label: "CAT-2" },
    { value: "FAT", label: "FAT" },
    { value: "MODEL_CAT_1", label: "Model CAT-1" },
    { value: "MODEL_CAT_2", label: "Model CAT-2" },
    { value: "MODEL_FAT", label: "Model FAT" },
    { value: "MID", label: "Mid" },
    { value: "QUIZ", label: "Quiz" },
    { value: "CIA", label: "CIA" },
    { value: "OTHER", label: "Other" },
];

const SEMESTER_OPTIONS: { value: Semester; label: string }[] = [
    { value: "FALL", label: "Fall" },
    { value: "WINTER", label: "Winter" },
    { value: "SUMMER", label: "Summer" },
    { value: "WEEKEND", label: "Weekend" },
    { value: "UNKNOWN", label: "Unknown" },
];

const CAMPUS_OPTIONS: { value: Campus; label: string }[] = [
    { value: "VELLORE", label: "Vellore" },
    { value: "CHENNAI", label: "Chennai" },
    { value: "AP", label: "AP" },
    { value: "BHOPAL", label: "Bhopal" },
    { value: "BANGALORE", label: "Bangalore" },
    { value: "MAURITIUS", label: "Mauritius" },
];

export default function PaperReviewRow({ paper, courses, onResolved, onCourseCreated }: Props) {
    const initialDraftRef = useRef(paper);
    const [draft, setDraft] = useState<PaperRowData>(initialDraftRef.current);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isComplete =
        draft.courseId !== null && draft.examType !== null && draft.year !== null;

    const save = async () => {
        setError(null);
        setSaving(true);
        try {
            await updatePaperMetadata({
                id: draft.id,
                courseId: draft.courseId,
                examType: draft.examType,
                slot: draft.slot,
                year: draft.year,
                semester: draft.semester,
                campus: draft.campus,
                hasAnswerKey: draft.hasAnswerKey,
            });
            if (isComplete) onResolved(draft.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 border-2 border-black/20 dark:border-[#D5D5D5]/20 bg-white/60 dark:bg-[#0C1222] p-4">
            <div className="flex items-start gap-4">
                {draft.thumbNailUrl ? (
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden border border-black/20 dark:border-[#D5D5D5]/20">
                        <Image
                            src={draft.thumbNailUrl}
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
                        href={`/past_papers/${paper.id}`}
                        target="_blank"
                        className="block break-words text-sm font-semibold text-black hover:underline dark:text-[#D5D5D5]"
                    >
                        {draft.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-black/50 dark:text-[#D5D5D5]/50">
                        {draft.id}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        {draft.courseId === null && (
                            <span className="border border-red-600/60 px-1.5 py-0.5 text-red-700 dark:border-red-400/60 dark:text-red-300">
                                no course
                            </span>
                        )}
                        {draft.examType === null && (
                            <span className="border border-red-600/60 px-1.5 py-0.5 text-red-700 dark:border-red-400/60 dark:text-red-300">
                                no exam
                            </span>
                        )}
                        {draft.year === null && (
                            <span className="border border-red-600/60 px-1.5 py-0.5 text-red-700 dark:border-red-400/60 dark:text-red-300">
                                no year
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FieldLabel label="Course" required missing={draft.courseId === null}>
                    <CoursePicker
                        courses={courses}
                        value={draft.courseId}
                        onChange={(id) => setDraft({ ...draft, courseId: id })}
                        allowCreateCourse
                        onCourseCreated={onCourseCreated}
                    />
                </FieldLabel>

                <FieldLabel label="Exam" required missing={draft.examType === null}>
                    <select
                        value={draft.examType ?? ""}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                examType: (e.target.value || null) as ExamType | null,
                            })
                        }
                        className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                    >
                        <option value="">—</option>
                        {EXAM_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </FieldLabel>

                <FieldLabel label="Year" required missing={draft.year === null}>
                    <input
                        type="number"
                        min={2000}
                        max={2100}
                        value={draft.year ?? ""}
                        onChange={(e) => {
                            const v = e.target.value;
                            setDraft({
                                ...draft,
                                year: v === "" ? null : Number(v),
                            });
                        }}
                        className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                        placeholder="e.g. 2024"
                    />
                </FieldLabel>

                <FieldLabel label="Slot">
                    <input
                        type="text"
                        value={draft.slot ?? ""}
                        onChange={(e) => {
                            const raw = e.target.value.toUpperCase();
                            const v = /^[A-G][12]$/.test(raw) ? raw : raw === "" ? "" : raw.slice(0, 2);
                            setDraft({
                                ...draft,
                                slot: v === "" ? null : v,
                            });
                        }}
                        maxLength={2}
                        className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 font-mono text-sm text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                        placeholder="A1..G2"
                    />
                </FieldLabel>

                <FieldLabel label="Semester">
                    <select
                        value={draft.semester}
                        onChange={(e) =>
                            setDraft({ ...draft, semester: e.target.value as Semester })
                        }
                        className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                    >
                        {SEMESTER_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </FieldLabel>

                <FieldLabel label="Campus">
                    <select
                        value={draft.campus}
                        onChange={(e) =>
                            setDraft({ ...draft, campus: e.target.value as Campus })
                        }
                        className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                    >
                        {CAMPUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </FieldLabel>

                <FieldLabel label="Answer key">
                    <label className="flex h-[38px] items-center gap-2 border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3">
                        <input
                            type="checkbox"
                            checked={draft.hasAnswerKey}
                            onChange={(e) =>
                                setDraft({ ...draft, hasAnswerKey: e.target.checked })
                            }
                            className="h-4 w-4 accent-[#5FC4E7]"
                        />
                        <span className="text-sm text-black dark:text-[#D5D5D5]">
                            included in paper
                        </span>
                    </label>
                </FieldLabel>

                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="w-full border-2 border-black bg-[#5FC4E7] px-4 py-2 text-sm font-semibold text-black transition hover:translate-x-[-2px] hover:translate-y-[-2px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? "Saving…" : isComplete ? "Save & resolve" : "Save"}
                    </button>
                </div>
            </div>
            {error && (
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            )}
        </div>
    );
}

function FieldLabel({
    label,
    required,
    missing,
    children,
}: {
    label: string;
    required?: boolean;
    missing?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/60 dark:text-[#D5D5D5]/60">
                {label}
                {required && <span className={missing ? "text-red-600 dark:text-red-400" : ""}> *</span>}
            </span>
            {children}
        </label>
    );
}

"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import CoursePicker, { type CourseOption } from "./course-picker";
import PaperPicker from "./paper-picker";
import { updatePaperMetadata } from "@/app/actions/update-paper-metadata";
import type { Campus, ExamType, Semester } from "@/db";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-slug";
import { formatPaperLinkOption, type PaperLinkOption } from "./paper-link-types";

export type PaperRowData = {
    id: string;
    title: string;
    thumbNailUrl: string | null;
    isClear: boolean;
    courseId: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    semester: Semester;
    campus: Campus;
    hasAnswerKey: boolean;
    questionPaper: PaperLinkOption | null;
};

type Props = {
    paper: PaperRowData;
    courses: CourseOption[];
    onResolved: (id: string) => void;
    /** Reports a saved but still incomplete paper, so the list keeps the saved values. */
    onSaved: (paper: PaperRowData) => void;
    onCourseCreated: (course: CourseOption) => void;
};

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

export default function PaperReviewRow({ paper, courses, onResolved, onSaved, onCourseCreated }: Props) {
    const [draft, setDraft] = useState(paper);
    const [savedDraft, setSavedDraft] = useState<PaperRowData | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canResolve =
        draft.isClear &&
        draft.courseId !== null &&
        draft.examType !== null &&
        draft.year !== null;

    const save = async () => {
        // Save exactly what was on screen when Save was pressed.
        const saved = draft;
        const savedCanResolve = canResolve;
        setError(null);
        setSavedDraft(null);
        setSaving(true);
        try {
            const result = await updatePaperMetadata({
                id: saved.id,
                courseId: saved.courseId,
                examType: saved.examType,
                slot: saved.slot,
                year: saved.year,
                semester: saved.semester,
                campus: saved.campus,
                hasAnswerKey: saved.hasAnswerKey,
                questionPaperId: saved.hasAnswerKey ? saved.questionPaper?.id ?? null : null,
            });
            if (!result.success) {
                setError(result.error);
                return;
            }
            setSavedDraft(saved);
            if (savedCanResolve) onResolved(saved.id);
            else onSaved(saved);
        } catch (err) {
            console.error("Failed to save paper metadata:", err);
            setError("Could not save paper metadata. Please try again.");
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
                    {draft.questionPaper && (
                        <p className="mt-1 text-xs text-black/60 dark:text-[#D5D5D5]/60">
                            Linked to:{" "}
                            <span className="font-semibold">
                                {draft.questionPaper.title}
                            </span>
                            {formatPaperLinkOption(draft.questionPaper)
                                ? ` (${formatPaperLinkOption(draft.questionPaper)})`
                                : ""}
                        </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        {!draft.isClear && (
                            <span className="border border-amber-600/60 px-1.5 py-0.5 text-amber-700 dark:border-amber-400/60 dark:text-amber-300">
                                uncleared
                            </span>
                        )}
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
                        onChange={(id) =>
                            setDraft((currentDraft) => ({
                                ...currentDraft,
                                courseId: id,
                            }))
                        }
                        allowCreateCourse
                        onCourseCreated={onCourseCreated}
                    />
                </FieldLabel>

                <FieldLabel label="Exam" required missing={draft.examType === null}>
                    <select
                        value={draft.examType ?? ""}
                        onChange={(e) =>
                            setDraft((currentDraft) => ({
                                ...currentDraft,
                                examType: (e.target.value || null) as ExamType | null,
                            }))
                        }
                        className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                    >
                        <option value="">—</option>
                        {EXAM_TYPE_OPTIONS.map((o) => (
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
                        aria-label="Year"
                        value={draft.year ?? ""}
                        onChange={(e) => {
                            const v = e.target.value;
                            setDraft((currentDraft) => ({
                                ...currentDraft,
                                year: v === "" ? null : Number(v),
                            }));
                        }}
                        className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                        placeholder="e.g. 2024"
                    />
                </FieldLabel>

                <FieldLabel label="Slot">
                    <input
                        type="text"
                        aria-label="Slot"
                        value={draft.slot ?? ""}
                        onChange={(e) => {
                            const slot = e.target.value.toUpperCase();
                            setDraft((currentDraft) => ({
                                ...currentDraft,
                                slot: slot || null,
                            }));
                        }}
                        className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 font-mono text-sm text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                        placeholder="e.g. A1 or A1+TA1"
                    />
                </FieldLabel>

                <FieldLabel label="Semester">
                    <select
                        value={draft.semester}
                        onChange={(e) =>
                            setDraft((currentDraft) => ({
                                ...currentDraft,
                                semester: e.target.value as Semester,
                            }))
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
                            setDraft((currentDraft) => ({
                                ...currentDraft,
                                campus: e.target.value as Campus,
                            }))
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
                    <span className="flex h-[38px] items-center gap-2 border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3">
                        <input
                            type="checkbox"
                            checked={draft.hasAnswerKey}
                            onChange={(e) => {
                                const hasAnswerKey = e.target.checked;
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    hasAnswerKey,
                                    questionPaper: hasAnswerKey
                                        ? currentDraft.questionPaper
                                        : null,
                                }));
                            }}
                            className="size-4 accent-[#5FC4E7]"
                        />
                        <span className="text-sm text-black dark:text-[#D5D5D5]">
                            Includes an answer key
                        </span>
                    </span>
                </FieldLabel>

                {draft.hasAnswerKey && (
                    <div className="sm:col-span-2 lg:col-span-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-black/60 dark:text-[#D5D5D5]/60">
                                Link a separate question paper (optional)
                            </span>
                            <PaperPicker
                                value={draft.questionPaper}
                                excludePaperId={draft.id}
                                courseId={draft.courseId}
                                onChange={(questionPaper) =>
                                    setDraft((currentDraft) => ({
                                        ...currentDraft,
                                        questionPaper,
                                    }))
                                }
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="w-full border-2 border-black bg-[#5FC4E7] px-4 py-2 text-sm font-semibold text-black transition hover:translate-x-[-2px] hover:translate-y-[-2px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? "Saving…" : canResolve ? "Save & resolve" : "Save"}
                    </button>
                </div>
            </div>
            {error && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>
            )}
            {savedDraft === draft && (
                <p role="status" className="text-sm text-black/70 dark:text-[#D5D5D5]/70">Saved.</p>
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

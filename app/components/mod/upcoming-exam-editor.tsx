"use client";

import React, { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CoursePicker, { type CourseOption } from "./course-picker";
import { useToast } from "@/app/components/ui/use-toast";
import {
    createUpcomingExam,
    deleteUpcomingExam,
    updateUpcomingExam,
} from "@/app/actions/upcoming-exams";
import type { UpcomingExamItem } from "@/lib/data/upcoming-exams";
import type { ExamType } from "@/db";

type Props = {
    courses: CourseOption[];
    existing: UpcomingExamItem[];
};

const EXAM_TYPES: { value: ExamType; label: string }[] = [
    { value: "CAT_1", label: "CAT-1" },
    { value: "CAT_2", label: "CAT-2" },
    { value: "FAT", label: "FAT" },
    { value: "MID", label: "Mid" },
    { value: "QUIZ", label: "Quiz" },
    { value: "CIA", label: "CIA" },
    { value: "OTHER", label: "Other" },
];

function formatScheduledAt(value: string | Date) {
    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(value instanceof Date ? value : new Date(value));
}

function parseSlots(raw: string): string[] {
    return raw
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
}

function CreateForm({ courses }: { courses: CourseOption[] }) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, start] = useTransition();
    const [courseId, setCourseId] = useState<string | null>(null);
    const [slotsText, setSlotsText] = useState("");
    const [examType, setExamType] = useState<ExamType | "">("");
    const [scheduledAt, setScheduledAt] = useState("");
    const slotsFieldId = useId();
    const examTypeFieldId = useId();
    const scheduledAtFieldId = useId();

    const reset = () => {
        setCourseId(null);
        setSlotsText("");
        setExamType("");
        setScheduledAt("");
    };

    const submit = () => {
        if (!courseId) {
            toast({ title: "Pick a course first", variant: "destructive" });
            return;
        }
        start(async () => {
            try {
                await createUpcomingExam({
                    courseId,
                    slots: parseSlots(slotsText),
                    examType: examType === "" ? null : (examType as ExamType),
                    scheduledAt: scheduledAt
                        ? new Date(scheduledAt).toISOString()
                        : null,
                });
                toast({ title: "Added" });
                reset();
                router.refresh();
            } catch (err) {
                toast({
                    title: "Could not add",
                    description: err instanceof Error ? err.message : undefined,
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <section className="flex flex-col gap-3 rounded-md border border-black/15 bg-white p-4 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-black/70 dark:text-[#D5D5D5]/70">
                Add upcoming exam
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-black/70 dark:text-[#D5D5D5]/70">
                        Course
                    </span>
                    <CoursePicker
                        courses={courses}
                        value={courseId}
                        onChange={setCourseId}
                        placeholder="Search course"
                    />
                </div>
                <label htmlFor={slotsFieldId} className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-black/70 dark:text-[#D5D5D5]/70">
                        Slots (comma-separated, e.g. A1, C2)
                    </span>
                    <input
                        id={slotsFieldId}
                        value={slotsText}
                        onChange={(e) => setSlotsText(e.target.value)}
                        className="w-full border border-black/30 bg-white px-3 py-2 text-sm text-black dark:border-[#D5D5D5]/40 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                        placeholder="A1, C2"
                    />
                </label>
                <label htmlFor={examTypeFieldId} className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-black/70 dark:text-[#D5D5D5]/70">
                        Exam type
                    </span>
                    <select
                        id={examTypeFieldId}
                        value={examType}
                        onChange={(e) => setExamType(e.target.value as ExamType | "")}
                        className="w-full border border-black/30 bg-white px-3 py-2 text-sm text-black dark:border-[#D5D5D5]/40 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                    >
                        <option value="">—</option>
                        {EXAM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label htmlFor={scheduledAtFieldId} className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-black/70 dark:text-[#D5D5D5]/70">
                        Scheduled at (optional)
                    </span>
                    <input
                        id={scheduledAtFieldId}
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="w-full border border-black/30 bg-white px-3 py-2 text-sm text-black dark:border-[#D5D5D5]/40 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                    />
                </label>
            </div>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={pending}
                    className="rounded-md bg-[#5FC4E7] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#3BF4C7] disabled:opacity-60 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/35"
                >
                    {pending ? "Adding…" : "Add"}
                </button>
                <button
                    type="button"
                    onClick={reset}
                    disabled={pending}
                    className="rounded-md border border-black/20 px-4 py-2 text-sm text-black/70 transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5]/70 dark:hover:bg-white/5"
                >
                    Reset
                </button>
            </div>
        </section>
    );
}

function Row({
    item,
    courses,
}: {
    item: UpcomingExamItem;
    courses: CourseOption[];
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, start] = useTransition();
    const [editing, setEditing] = useState(false);
    const [courseId, setCourseId] = useState<string | null>(item.courseId);
    const [slotsText, setSlotsText] = useState(item.slots.join(", "));
    const [examType, setExamType] = useState<ExamType | "">(
        item.examType ?? "",
    );
    const [scheduledAt, setScheduledAt] = useState(
        () =>
        item.scheduledAt
            ? new Date(item.scheduledAt).toISOString().slice(0, 16)
            : "",
    );

    const save = () => {
        if (!courseId) return;
        start(async () => {
            try {
                await updateUpcomingExam(item.id, {
                    courseId,
                    slots: parseSlots(slotsText),
                    examType: examType === "" ? null : (examType as ExamType),
                    scheduledAt: scheduledAt
                        ? new Date(scheduledAt).toISOString()
                        : null,
                });
                toast({ title: "Updated" });
                setEditing(false);
                router.refresh();
            } catch (err) {
                toast({
                    title: "Could not update",
                    description: err instanceof Error ? err.message : undefined,
                    variant: "destructive",
                });
            }
        });
    };

    const remove = () => {
        if (!confirm(`Delete upcoming exam for ${item.courseCode}?`)) return;
        start(async () => {
            try {
                await deleteUpcomingExam(item.id);
                toast({ title: "Deleted" });
                router.refresh();
            } catch (err) {
                toast({
                    title: "Could not delete",
                    description: err instanceof Error ? err.message : undefined,
                    variant: "destructive",
                });
            }
        });
    };

    if (editing) {
        return (
            <tr className="border-b border-black/10 dark:border-[#D5D5D5]/10">
                <td className="p-2" colSpan={5}>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <CoursePicker
                            courses={courses}
                            value={courseId}
                            onChange={setCourseId}
                        />
                        <input
                            value={slotsText}
                            onChange={(e) => setSlotsText(e.target.value)}
                            className="border border-black/30 bg-white px-2 py-1 text-sm dark:border-[#D5D5D5]/40 dark:bg-[#0C1222]"
                            placeholder="A1, C2"
                        />
                        <select
                            value={examType}
                            onChange={(e) =>
                                setExamType(e.target.value as ExamType | "")
                            }
                            className="border border-black/30 bg-white px-2 py-1 text-sm dark:border-[#D5D5D5]/40 dark:bg-[#0C1222]"
                        >
                            <option value="">—</option>
                            {EXAM_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="border border-black/30 bg-white px-2 py-1 text-sm dark:border-[#D5D5D5]/40 dark:bg-[#0C1222]"
                        />
                    </div>
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={save}
                            disabled={pending}
                            className="rounded-md bg-[#5FC4E7] px-3 py-1 text-xs font-semibold text-black disabled:opacity-60 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7]"
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="rounded-md border border-black/20 px-3 py-1 text-xs text-black/70 dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5]/70"
                        >
                            Cancel
                        </button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="border-b border-black/10 text-sm dark:border-[#D5D5D5]/10">
            <td className="p-2">
                <span className="font-mono text-xs text-black/60 dark:text-[#D5D5D5]/60">
                    {item.courseCode}
                </span>
                <div className="text-black dark:text-[#D5D5D5]">
                    {item.courseTitle}
                </div>
            </td>
            <td className="p-2">
                <div className="flex flex-wrap gap-1">
                    {item.slots.map((s) => (
                        <span
                            key={s}
                            className="inline-flex items-center rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] font-bold dark:bg-white/10"
                        >
                            {s}
                        </span>
                    ))}
                </div>
            </td>
            <td className="p-2 text-xs text-black/70 dark:text-[#D5D5D5]/70">
                {item.examType ? item.examType.replace("_", "-") : "—"}
            </td>
            <td className="p-2 text-xs text-black/70 dark:text-[#D5D5D5]/70">
                {item.scheduledAt ? formatScheduledAt(item.scheduledAt) : "—"}
            </td>
            <td className="p-2">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-xs text-black/70 underline hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                    >
                        edit
                    </button>
                    <button
                        type="button"
                        onClick={remove}
                        disabled={pending}
                        className="text-xs text-red-500 underline hover:text-red-600"
                    >
                        delete
                    </button>
                </div>
            </td>
        </tr>
    );
}

export default function UpcomingExamEditor({ courses, existing }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <CreateForm courses={courses} />
            <section className="rounded-md border border-black/15 bg-white dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
                <header className="border-b border-black/10 p-3 dark:border-[#D5D5D5]/10">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-black/70 dark:text-[#D5D5D5]/70">
                        Current ({existing.length})
                    </h2>
                </header>
                {existing.length === 0 ? (
                    <div className="p-6 text-center text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        No upcoming exams yet.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="text-left text-[10px] font-semibold uppercase tracking-widest text-black/50 dark:text-[#D5D5D5]/50">
                            <tr className="border-b border-black/10 dark:border-[#D5D5D5]/10">
                                <th className="p-2">Course</th>
                                <th className="p-2">Slots</th>
                                <th className="p-2">Exam</th>
                                <th className="p-2">When</th>
                                <th className="p-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {existing.map((item) => (
                                <Row key={item.id} item={item} courses={courses} />
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}

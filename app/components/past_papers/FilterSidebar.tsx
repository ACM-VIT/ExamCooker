"use client";

import React, { useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { examTypeLabel, examTypeToSlug, examSlugToType } from "@/lib/examSlug";
import type { ExamType, Semester, Campus } from "@/prisma/generated/client";

type Props = {
    options: {
        examTypes: ExamType[];
        slots: string[];
        years: number[];
        semesters: Semester[];
        campuses: Campus[];
        answerKeyCount: number;
        totalPapers: number;
    };
    searchString?: string;
};

const SEMESTER_LABEL: Record<Semester, string> = {
    FALL: "Fall",
    WINTER: "Winter",
    SUMMER: "Summer",
    WEEKEND: "Weekend",
    UNKNOWN: "Unknown",
};

const CAMPUS_LABEL: Record<Campus, string> = {
    VELLORE: "Vellore",
    CHENNAI: "Chennai",
    AP: "AP",
    BHOPAL: "Bhopal",
    BANGALORE: "Bangalore",
    MAURITIUS: "Mauritius",
};

function readList(param: string | null): string[] {
    if (!param) return [];
    return param
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function FilterSidebar({ options, searchString = "" }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [pending, startTransition] = useTransition();
    const searchParams = useMemo(
        () => new URLSearchParams(searchString),
        [searchString],
    );

    const selected = useMemo(
        () => ({
            exams: readList(searchParams.get("exam"))
                .map((s) => examSlugToType(s))
                .filter((v): v is ExamType => v !== null),
            slots: readList(searchParams.get("slot")),
            years: readList(searchParams.get("year")).map((y) => Number(y)).filter((y) => !Number.isNaN(y)),
            semesters: readList(searchParams.get("semester")).map((s) => s.toUpperCase() as Semester),
            campuses: readList(searchParams.get("campus")).map((c) => c.toUpperCase() as Campus),
            answerKey: searchParams.get("answer_key") === "1",
        }),
        [searchParams],
    );

    const hasAny =
        selected.exams.length > 0 ||
        selected.slots.length > 0 ||
        selected.years.length > 0 ||
        selected.semesters.length > 0 ||
        selected.campuses.length > 0 ||
        selected.answerKey;

    const updateParam = (key: string, value: string | null) => {
        const next = new URLSearchParams(searchParams.toString());
        if (!value) next.delete(key);
        else next.set(key, value);
        next.delete("page"); // reset pagination on filter change
        const qs = next.toString();
        startTransition(() => {
            router.replace(qs ? `${pathname}?${qs}` : pathname);
        });
    };

    const toggleIn = (key: string, value: string, enabled: boolean) => {
        const existing = readList(searchParams.get(key));
        const set = new Set(existing);
        if (enabled) set.add(value);
        else set.delete(value);
        updateParam(key, set.size ? Array.from(set).join(",") : null);
    };

    const resetAll = () => {
        const next = new URLSearchParams();
        const sort = searchParams.get("sort");
        if (sort) next.set("sort", sort);
        const qs = next.toString();
        startTransition(() => {
            router.replace(qs ? `${pathname}?${qs}` : pathname);
        });
    };

    return (
        <aside className={`flex flex-col gap-5 ${pending ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5]">
                    Filters
                </h2>
                {hasAny && (
                    <button
                        type="button"
                        onClick={resetAll}
                        className="text-xs font-semibold text-black/60 underline underline-offset-2 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:text-[#3BF4C7]"
                    >
                        Reset
                    </button>
                )}
            </div>

            <label className="flex items-center gap-2 border border-black/20 bg-white/60 px-3 py-2 text-sm text-black dark:border-[#D5D5D5]/20 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                <input
                    type="checkbox"
                    checked={selected.answerKey}
                    onChange={(e) => updateParam("answer_key", e.target.checked ? "1" : null)}
                    className="h-4 w-4 accent-[#5FC4E7]"
                />
                <span className="flex-1">Answer key included</span>
                <span className="text-xs text-black/50 dark:text-[#D5D5D5]/50">
                    {options.answerKeyCount}
                </span>
            </label>

            {options.examTypes.length > 0 && (
                <FilterGroup title="Exam">
                    {options.examTypes.map((type) => (
                        <FilterCheckbox
                            key={type}
                            label={examTypeLabel(type)}
                            checked={selected.exams.includes(type)}
                            onChange={(checked) =>
                                toggleIn("exam", examTypeToSlug(type), checked)
                            }
                        />
                    ))}
                </FilterGroup>
            )}

            {options.slots.length > 0 && (
                <FilterGroup title="Slot">
                    {options.slots.map((slot) => (
                        <FilterCheckbox
                            key={slot}
                            label={slot}
                            checked={selected.slots.includes(slot)}
                            onChange={(checked) => toggleIn("slot", slot, checked)}
                        />
                    ))}
                </FilterGroup>
            )}

            {options.years.length > 0 && (
                <FilterGroup title="Year">
                    {options.years.map((year) => (
                        <FilterCheckbox
                            key={year}
                            label={String(year)}
                            checked={selected.years.includes(year)}
                            onChange={(checked) => toggleIn("year", String(year), checked)}
                        />
                    ))}
                </FilterGroup>
            )}

            {options.semesters.filter((s) => s !== "UNKNOWN").length > 0 && (
                <FilterGroup title="Semester">
                    {options.semesters
                        .filter((s) => s !== "UNKNOWN")
                        .map((sem) => (
                            <FilterCheckbox
                                key={sem}
                                label={SEMESTER_LABEL[sem]}
                                checked={selected.semesters.includes(sem)}
                                onChange={(checked) =>
                                    toggleIn("semester", sem.toLowerCase(), checked)
                                }
                            />
                        ))}
                </FilterGroup>
            )}

            {options.campuses.length > 1 && (
                <FilterGroup title="Campus">
                    {options.campuses.map((c) => (
                        <FilterCheckbox
                            key={c}
                            label={CAMPUS_LABEL[c]}
                            checked={selected.campuses.includes(c)}
                            onChange={(checked) =>
                                toggleIn("campus", c.toLowerCase(), checked)
                            }
                        />
                    ))}
                </FilterGroup>
            )}
        </aside>
    );
}

function FilterGroup({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black/70 dark:text-[#D5D5D5]/70">
                {title}
            </h3>
            <div className="flex flex-col gap-1">{children}</div>
        </div>
    );
}

function FilterCheckbox({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm text-black hover:bg-black/5 dark:text-[#D5D5D5] dark:hover:bg-white/5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 accent-[#5FC4E7]"
            />
            <span>{label}</span>
        </label>
    );
}

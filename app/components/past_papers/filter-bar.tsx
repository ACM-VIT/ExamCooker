"use client";

import React, { addTransitionType, memo, useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { examTypeLabel, examTypeToSlug, examSlugToType } from "@/lib/exam-slug";
import type { Campus, ExamType, Semester } from "@/db";

type Props = {
    basePath: string;
    options: {
        examTypes: ExamType[];
        slots: string[];
        years: number[];
        semesters: Semester[];
        campuses: Campus[];
        answerKeyCount: number;
        totalPapers: number;
    };
    examCounts: Partial<Record<ExamType, number>>;
    yearCounts: Partial<Record<number, number>>;
    slotCounts: Partial<Record<string, number>>;
    searchString: string;
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

function readList(raw: string | null): string[] {
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function FilterBar({
    basePath,
    options,
    examCounts,
    yearCounts,
    slotCounts,
    searchString,
}: Props) {
    const router = useRouter();
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
            slots: readList(searchParams.get("slot")).map((s) => s.toUpperCase()),
            years: readList(searchParams.get("year"))
                .map((y) => Number(y))
                .filter((y) => !Number.isNaN(y)),
            semesters: readList(searchParams.get("semester")).map(
                (s) => s.toUpperCase() as Semester,
            ),
            campuses: readList(searchParams.get("campus")).map(
                (c) => c.toUpperCase() as Campus,
            ),
        }),
        [searchParams],
    );

    const pushParams = useCallback((next: URLSearchParams) => {
        next.delete("page");
        const qs = next.toString();
        startTransition(() => {
            addTransitionType("filter-results");
            router.replace(qs ? `${basePath}?${qs}` : basePath);
        });
    }, [basePath, router, startTransition]);

    const replaceList = useCallback((key: string, values: string[]) => {
        const next = new URLSearchParams(searchParams.toString());
        if (values.length === 0) next.delete(key);
        else next.set(key, values.join(","));
        pushParams(next);
    }, [pushParams, searchParams]);

    const toggleIn = useCallback((key: string, value: string) => {
        const current = readList(searchParams.get(key));
        const set = new Set(current);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        replaceList(key, Array.from(set));
    }, [replaceList, searchParams]);

    const clearExamFilters = useCallback(() => {
        replaceList("exam", []);
    }, [replaceList]);

    const toggleExamType = useCallback((type: ExamType) => {
        toggleIn("exam", examTypeToSlug(type));
    }, [toggleIn]);

    const examTabs = useMemo(
        () => options.examTypes.map((type) => ({
            type,
            label: examTypeLabel(type),
            count: examCounts[type] ?? 0,
            active: selected.exams.includes(type),
        })),
        [examCounts, options.examTypes, selected.exams],
    );
    const allActive = selected.exams.length === 0;

    const visibleSemesters = useMemo(
        () => options.semesters.filter((s) => s !== "UNKNOWN"),
        [options.semesters],
    );

    const hasMoreFilters =
        options.slots.length > 0 ||
        options.years.length > 0 ||
        visibleSemesters.length > 0 ||
        options.campuses.length > 1;

    const yearItems = useMemo(
        () => options.years.map((y) => ({
            value: String(y),
            label: String(y),
            count: yearCounts[y] ?? 0,
            active: selected.years.includes(y),
        })),
        [options.years, selected.years, yearCounts],
    );

    const slotItems = useMemo(
        () => options.slots.map((s) => ({
            value: s,
            label: s,
            count: slotCounts[s] ?? 0,
            active: selected.slots.includes(s),
        })),
        [options.slots, selected.slots, slotCounts],
    );

    const semesterItems = useMemo(
        () => visibleSemesters.map((sem) => ({
            value: sem.toLowerCase(),
            label: SEMESTER_LABEL[sem],
            active: selected.semesters.includes(sem),
        })),
        [selected.semesters, visibleSemesters],
    );

    const campusItems = useMemo(
        () => options.campuses.map((c) => ({
            value: c.toLowerCase(),
            label: CAMPUS_LABEL[c],
            active: selected.campuses.includes(c),
        })),
        [options.campuses, selected.campuses],
    );

    const toggleYear = useCallback((value: string) => toggleIn("year", value), [toggleIn]);
    const toggleSlot = useCallback((value: string) => toggleIn("slot", value), [toggleIn]);
    const toggleSemester = useCallback((value: string) => toggleIn("semester", value), [toggleIn]);
    const toggleCampus = useCallback((value: string) => toggleIn("campus", value), [toggleIn]);

    return (
        <div
            className={`flex flex-col gap-2 sm:gap-1.5 ${pending ? "opacity-70" : ""}`}
        >
            {examTabs.length > 0 && (
                <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                    <div className="flex w-max items-center gap-1.5 pb-0.5 sm:w-full sm:flex-wrap">
                        <FilterButton
                            label="All"
                            count={options.totalPapers}
                            active={allActive}
                            onClick={clearExamFilters}
                        />
                        {examTabs.map((tab) => (
                            <FilterButton
                                key={tab.type}
                                label={tab.label}
                                count={tab.count}
                                active={tab.active}
                                onClick={() => toggleExamType(tab.type)}
                            />
                        ))}
                    </div>
                </div>
            )}
            {hasMoreFilters && (
                <div className="flex flex-col gap-2 sm:gap-1.5">
                    {options.years.length > 0 && (
                        <ChipRow
                            items={yearItems}
                            onToggle={toggleYear}
                        />
                    )}
                    {options.slots.length > 0 && (
                        <ChipRow
                            items={slotItems}
                            onToggle={toggleSlot}
                        />
                    )}
                    {visibleSemesters.length > 0 && (
                        <ChipRow
                            items={semesterItems}
                            onToggle={toggleSemester}
                        />
                    )}
                    {options.campuses.length > 1 && (
                        <ChipRow
                            items={campusItems}
                            onToggle={toggleCampus}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function FilterButton({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count?: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 border px-3 text-sm font-semibold transition ${active
                    ? "border-[#5FC4E7] bg-[#5FC4E7]/25 text-black dark:border-[#3BF4C7]/60 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                    : "border-black/15 bg-white text-black hover:border-black/30 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/40"
                }`}
        >
            <span>{label}</span>
            {count !== undefined && <FilterCount count={count} active={active} />}
        </button>
    );
}

function FilterCount({ count, active }: { count: number; active: boolean }) {
    return (
        <span
            className={`text-xs font-normal ${active
                    ? "text-black/60 dark:text-[#3BF4C7]/70"
                    : "text-black/50 dark:text-[#D5D5D5]/50"
                }`}
        >
            {count}
        </span>
    );
}

const ChipRow = memo(function ChipRow({
    items,
    onToggle,
}: {
    items: Array<{ value: string; label: string; count?: number; active: boolean }>;
    onToggle: (value: string) => void;
}) {
    return (
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <div className="flex w-max items-center gap-1.5 pb-0.5 sm:w-full sm:flex-wrap">
                {items.map((item) => (
                    <FilterButton
                        key={item.value}
                        label={item.label}
                        count={item.count}
                        active={item.active}
                        onClick={() => onToggle(item.value)}
                    />
                ))}
            </div>
        </div>
    );
});

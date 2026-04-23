"use client";

import React, { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faXmark } from "@fortawesome/free-solid-svg-icons";
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
    examCounts: Partial<Record<ExamType, number>>;
    yearCounts: Partial<Record<number, number>>;
    slotCounts: Partial<Record<string, number>>;
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
    options,
    examCounts,
    yearCounts,
    slotCounts,
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const [moreOpen, setMoreOpen] = useState(false);

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
            answerKey: searchParams.get("answer_key") === "1",
        }),
        [searchParams],
    );

    const activeCount =
        selected.exams.length +
        selected.slots.length +
        selected.years.length +
        selected.semesters.length +
        selected.campuses.length +
        (selected.answerKey ? 1 : 0);

    const pushParams = (next: URLSearchParams) => {
        next.delete("page");
        const qs = next.toString();
        startTransition(() => {
            router.replace(qs ? `${pathname}?${qs}` : pathname);
        });
    };

    const replaceList = (key: string, values: string[]) => {
        const next = new URLSearchParams(searchParams.toString());
        if (values.length === 0) next.delete(key);
        else next.set(key, values.join(","));
        pushParams(next);
    };

    const toggleIn = (key: string, value: string) => {
        const current = readList(searchParams.get(key));
        const set = new Set(current);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        replaceList(key, Array.from(set));
    };

    const setSingle = (key: string, value: string | null) => {
        const next = new URLSearchParams(searchParams.toString());
        if (!value) next.delete(key);
        else next.set(key, value);
        pushParams(next);
    };

    const resetAll = () => {
        const next = new URLSearchParams();
        const sort = searchParams.get("sort");
        if (sort) next.set("sort", sort);
        pushParams(next);
    };

    const setExamSingle = (type: ExamType | null) => {
        setSingle("exam", type ? examTypeToSlug(type) : null);
    };

    // --- Exam tabs (primary filter) --------------------------------------
    const examTabs = options.examTypes.map((type) => ({
        type,
        label: examTypeLabel(type),
        count: examCounts[type] ?? 0,
        active: selected.exams.length === 1 && selected.exams[0] === type,
    }));
    const allActive = selected.exams.length === 0;

    const totalShown = allActive
        ? options.totalPapers
        : selected.exams.reduce((sum, e) => sum + (examCounts[e] ?? 0), 0);

    // --- Activity filter chips (for pills row) ---------------------------
    type ActiveChip = { key: string; value: string; label: string };
    const chips: ActiveChip[] = [];
    if (selected.exams.length > 1) {
        selected.exams.forEach((e) =>
            chips.push({
                key: "exam",
                value: examTypeToSlug(e),
                label: examTypeLabel(e),
            }),
        );
    }
    selected.years.forEach((y) =>
        chips.push({ key: "year", value: String(y), label: String(y) }),
    );
    selected.slots.forEach((s) =>
        chips.push({ key: "slot", value: s, label: `Slot ${s}` }),
    );
    selected.semesters.forEach((s) =>
        chips.push({
            key: "semester",
            value: s.toLowerCase(),
            label: SEMESTER_LABEL[s],
        }),
    );
    selected.campuses.forEach((c) =>
        chips.push({
            key: "campus",
            value: c.toLowerCase(),
            label: CAMPUS_LABEL[c],
        }),
    );
    if (selected.answerKey)
        chips.push({ key: "answer_key", value: "1", label: "Has answer key" });

    const removeChip = (key: string, value: string) => {
        if (key === "answer_key") {
            setSingle("answer_key", null);
            return;
        }
        const current = readList(searchParams.get(key));
        const next = current.filter((v) => v.toLowerCase() !== value.toLowerCase());
        replaceList(key, next);
    };

    const hasMoreFilters =
        options.slots.length > 0 ||
        options.years.length > 0 ||
        options.semesters.filter((s) => s !== "UNKNOWN").length > 0 ||
        options.campuses.length > 1 ||
        options.answerKeyCount > 0;

    const visibleSemesters = options.semesters.filter((s) => s !== "UNKNOWN");

    return (
        <div
            className={`flex flex-col gap-3 ${pending ? "opacity-70" : ""}`}
        >
            {/* Exam type tabs — primary filter */}
            {examTabs.length > 0 && (
                <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                    <div className="flex w-max items-center gap-1.5 pb-0.5 sm:w-full sm:flex-wrap">
                        <TabButton
                            label="All"
                            count={options.totalPapers}
                            active={allActive}
                            onClick={() => setExamSingle(null)}
                        />
                        {examTabs.map((tab) => (
                            <TabButton
                                key={tab.type}
                                label={tab.label}
                                count={tab.count}
                                active={tab.active}
                                onClick={() => setExamSingle(tab.active ? null : tab.type)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* More filters toggle + active count summary */}
            {hasMoreFilters && (
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setMoreOpen((o) => !o)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-black/15 bg-white px-3 text-xs font-semibold text-black transition hover:border-black/30 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/40"
                    >
                        <span>More filters</span>
                        {activeCount > 0 && (
                            <span className="inline-flex h-4 min-w-[1rem] items-center justify-center bg-black/10 px-1 text-[10px] font-bold dark:bg-white/10">
                                {activeCount}
                            </span>
                        )}
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className={`h-3 w-3 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                        />
                    </button>
                    {chips.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {chips.map((chip) => (
                                <button
                                    key={`${chip.key}:${chip.value}`}
                                    type="button"
                                    onClick={() => removeChip(chip.key, chip.value)}
                                    className="inline-flex h-7 items-center gap-1.5 rounded border border-[#5FC4E7]/60 bg-[#5FC4E7]/25 px-2 text-xs font-semibold text-black transition hover:bg-[#5FC4E7]/40 dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/10 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/20"
                                >
                                    {chip.label}
                                    <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" />
                                </button>
                            ))}
                            {activeCount > 1 && (
                                <button
                                    type="button"
                                    onClick={resetAll}
                                    className="text-xs font-semibold text-black/60 underline underline-offset-2 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:text-[#D5D5D5]"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    )}
                    <span className="ml-auto text-xs text-black/60 dark:text-[#D5D5D5]/60">
                        {totalShown} paper{totalShown === 1 ? "" : "s"}
                    </span>
                </div>
            )}

            {/* Expandable more-filters panel */}
            {moreOpen && hasMoreFilters && (
                <div className="flex flex-col gap-3 rounded-md border border-black/10 bg-white/60 p-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]/80">
                    {options.years.length > 0 && (
                        <ChipRow
                            label="Year"
                            items={options.years.map((y) => ({
                                value: String(y),
                                label: String(y),
                                count: yearCounts[y] ?? 0,
                                active: selected.years.includes(y),
                            }))}
                            onToggle={(v) => toggleIn("year", v)}
                        />
                    )}
                    {options.slots.length > 0 && (
                        <ChipRow
                            label="Slot"
                            items={options.slots.map((s) => ({
                                value: s,
                                label: s,
                                count: slotCounts[s] ?? 0,
                                active: selected.slots.includes(s),
                            }))}
                            onToggle={(v) => toggleIn("slot", v)}
                            mono
                        />
                    )}
                    {visibleSemesters.length > 0 && (
                        <ChipRow
                            label="Semester"
                            items={visibleSemesters.map((sem) => ({
                                value: sem.toLowerCase(),
                                label: SEMESTER_LABEL[sem],
                                active: selected.semesters.includes(sem),
                            }))}
                            onToggle={(v) => toggleIn("semester", v)}
                        />
                    )}
                    {options.campuses.length > 1 && (
                        <ChipRow
                            label="Campus"
                            items={options.campuses.map((c) => ({
                                value: c.toLowerCase(),
                                label: CAMPUS_LABEL[c],
                                active: selected.campuses.includes(c),
                            }))}
                            onToggle={(v) => toggleIn("campus", v)}
                        />
                    )}
                    {options.answerKeyCount > 0 && (
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={selected.answerKey}
                                onChange={(e) =>
                                    setSingle("answer_key", e.target.checked ? "1" : null)
                                }
                                className="h-4 w-4 accent-[#5FC4E7]"
                            />
                            <span className="text-black dark:text-[#D5D5D5]">
                                Answer key included
                            </span>
                            <span className="text-xs text-black/50 dark:text-[#D5D5D5]/50">
                                {options.answerKeyCount}
                            </span>
                        </label>
                    )}
                </div>
            )}
        </div>
    );
}

function TabButton({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition ${active
                    ? "border-[#5FC4E7] bg-[#5FC4E7]/25 text-black dark:border-[#3BF4C7]/60 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                    : "border-black/15 bg-white text-black hover:border-black/30 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/40"
                }`}
        >
            <span>{label}</span>
            <span
                className={`text-xs font-normal ${active
                        ? "text-black/60 dark:text-[#3BF4C7]/70"
                        : "text-black/50 dark:text-[#D5D5D5]/50"
                    }`}
            >
                {count}
            </span>
        </button>
    );
}

function ChipRow({
    label,
    items,
    onToggle,
    mono,
}: {
    label: string;
    items: Array<{ value: string; label: string; count?: number; active: boolean }>;
    onToggle: (value: string) => void;
    mono?: boolean;
}) {
    return (
        <div className="flex flex-wrap items-baseline gap-2">
            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                {label}
            </span>
            <div className="flex flex-1 flex-wrap gap-1.5">
                {items.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => onToggle(item.value)}
                        className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-xs transition ${mono ? "font-mono" : "font-semibold"
                            } ${item.active
                                ? "border-[#5FC4E7] bg-[#5FC4E7]/30 text-black dark:border-[#3BF4C7]/50 dark:bg-[#3BF4C7]/10 dark:text-[#3BF4C7]"
                                : "border-black/15 bg-white text-black hover:border-black/35 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/40"
                            }`}
                    >
                        {item.label}
                        {item.count !== undefined && (
                            <span className="text-[10px] font-normal text-black/40 dark:text-[#D5D5D5]/40">
                                {item.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

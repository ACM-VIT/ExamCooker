"use client";

import React, {
    useCallback,
    useMemo,
    useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { SlidersHorizontal, X } from "lucide-react";
import { examTypeLabel, examTypeToSlug, examSlugToType } from "@/lib/examSlug";
import type { Campus, ExamType, Semester } from "@/src/db";
import { cn } from "@/lib/utils";

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
    searchString: string;
    totalCount: number;
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

const SORT_OPTIONS = [
    { value: "year_desc", label: "Newest" },
    { value: "year_asc", label: "Oldest" },
    { value: "recent", label: "Recently added" },
] as const;

function readList(raw: string | null): string[] {
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function FilterSheet({
    options,
    examCounts,
    yearCounts,
    slotCounts,
    searchString,
    totalCount,
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

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
            sort: searchParams.get("sort") ?? "year_desc",
        }),
        [searchParams],
    );

    const activeCount =
        selected.exams.length +
        selected.slots.length +
        selected.years.length +
        selected.semesters.length +
        selected.campuses.length;

    const pushParams = useCallback(
        (next: URLSearchParams) => {
            next.delete("page");
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, {
                transitionTypes: ["filter-sheet-update"],
            });
        },
        [pathname, router],
    );

    const toggleIn = useCallback(
        (key: string, value: string) => {
            const next = new URLSearchParams(searchParams.toString());
            const current = readList(next.get(key));
            const set = new Set(current);
            if (set.has(value)) set.delete(value);
            else set.add(value);
            const arr = Array.from(set);
            if (arr.length === 0) next.delete(key);
            else next.set(key, arr.join(","));
            pushParams(next);
        },
        [pushParams, searchParams],
    );

    const setSingle = useCallback(
        (key: string, value: string | null) => {
            const next = new URLSearchParams(searchParams.toString());
            if (!value) next.delete(key);
            else next.set(key, value);
            pushParams(next);
        },
        [pushParams, searchParams],
    );

    const clearExamFilters = useCallback(() => {
        setSingle("exam", null);
    }, [setSingle]);

    const toggleExamType = useCallback((type: ExamType) => {
        toggleIn("exam", examTypeToSlug(type));
    }, [toggleIn]);

    const setSort = useCallback(
        (value: string) => {
            if (value === "year_desc") setSingle("sort", null);
            else setSingle("sort", value);
        },
        [setSingle],
    );

    const resetAll = useCallback(() => {
        const next = new URLSearchParams();
        const answerKey = searchParams.get("answer_key");
        if (answerKey) next.set("answer_key", answerKey);
        pushParams(next);
    }, [pushParams, searchParams]);

    const visibleSemesters = useMemo(
        () => options.semesters.filter((s) => s !== "UNKNOWN"),
        [options.semesters],
    );

    return (
        <Drawer.Root open={open} onOpenChange={setOpen}>
            <Drawer.Trigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 border px-3.5 text-sm font-semibold transition active:scale-[0.98]",
                        activeCount > 0
                            ? "border-[#5FC4E7] bg-[#5FC4E7]/25 text-black dark:border-[#3BF4C7]/60 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                            : "border-black/15 bg-white text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]",
                    )}
                >
                    <SlidersHorizontal className="h-4 w-4" strokeWidth={2.25} />
                    <span>Filters</span>
                    {activeCount > 0 && (
                        <span
                            className={cn(
                                "inline-flex h-5 min-w-5 items-center justify-center px-1.5 text-[11px] font-bold leading-none tabular-nums",
                                "bg-black text-white dark:bg-[#3BF4C7] dark:text-[#0C1222]",
                            )}
                        >
                            {activeCount}
                        </span>
                    )}
                </button>
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className="filter-sheet-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
                <Drawer.Content
                    className={cn(
                        "filter-sheet-content fixed inset-x-0 bottom-0 z-50 mt-24 flex h-[88dvh] max-h-[88dvh] flex-col outline-none",
                        "border-t-2 border-black/15 bg-white text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]",
                        "shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)]",
                    )}
                >
                    <div className="mx-auto mt-2 h-1 w-10 shrink-0 bg-black/20 dark:bg-[#D5D5D5]/25" />

                    <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 pb-3 pt-3 dark:border-[#D5D5D5]/10">
                        <Drawer.Title className="text-lg font-bold tracking-tight">
                            Filters
                        </Drawer.Title>
                        <div className="flex items-center gap-1">
                            {activeCount > 0 && (
                                <button
                                    type="button"
                                    onClick={resetAll}
                                    className="px-2 py-1 text-sm font-semibold text-black/60 underline-offset-2 hover:underline dark:text-[#D5D5D5]/60"
                                >
                                    Reset
                                </button>
                            )}
                            <Drawer.Close asChild>
                                <button
                                    type="button"
                                    aria-label="Close filters"
                                    className="inline-flex h-9 w-9 items-center justify-center text-black/55 hover:bg-black/5 active:scale-95 dark:text-[#D5D5D5]/55 dark:hover:bg-white/5"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </Drawer.Close>
                        </div>
                    </div>

                    <Drawer.Description className="sr-only">
                        Filter past papers by exam, year, slot, semester, campus, and sort order.
                    </Drawer.Description>

                    <div
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4"
                        style={{ WebkitOverflowScrolling: "touch" }}
                    >
                        <div className="flex flex-col gap-6 pb-2">
                            {options.examTypes.length > 0 && (
                                <Section title="Exam type">
                                    <ChipWrap>
                                        <SheetChip
                                            label="All"
                                            count={options.totalPapers}
                                            active={selected.exams.length === 0}
                                            onClick={clearExamFilters}
                                        />
                                        {options.examTypes.map((type) => {
                                            const active = selected.exams.includes(type);
                                            return (
                                                <SheetChip
                                                    key={type}
                                                    label={examTypeLabel(type)}
                                                    count={examCounts[type] ?? 0}
                                                    active={active}
                                                    onClick={() => toggleExamType(type)}
                                                />
                                            );
                                        })}
                                    </ChipWrap>
                                </Section>
                            )}

                            {options.years.length > 0 && (
                                <Section title="Year">
                                    <ChipWrap>
                                        {options.years.map((y) => (
                                            <SheetChip
                                                key={y}
                                                label={String(y)}
                                                count={yearCounts[y] ?? 0}
                                                active={selected.years.includes(y)}
                                                onClick={() => toggleIn("year", String(y))}
                                            />
                                        ))}
                                    </ChipWrap>
                                </Section>
                            )}

                            {options.slots.length > 0 && (
                                <Section title="Slot">
                                    <ChipWrap>
                                        {options.slots.map((s) => (
                                            <SheetChip
                                                key={s}
                                                label={s}
                                                count={slotCounts[s] ?? 0}
                                                active={selected.slots.includes(s)}
                                                onClick={() => toggleIn("slot", s)}
                                            />
                                        ))}
                                    </ChipWrap>
                                </Section>
                            )}

                            {visibleSemesters.length > 0 && (
                                <Section title="Semester">
                                    <ChipWrap>
                                        {visibleSemesters.map((sem) => (
                                            <SheetChip
                                                key={sem}
                                                label={SEMESTER_LABEL[sem]}
                                                active={selected.semesters.includes(sem)}
                                                onClick={() =>
                                                    toggleIn("semester", sem.toLowerCase())
                                                }
                                            />
                                        ))}
                                    </ChipWrap>
                                </Section>
                            )}

                            {options.campuses.length > 1 && (
                                <Section title="Campus">
                                    <ChipWrap>
                                        {options.campuses.map((c) => (
                                            <SheetChip
                                                key={c}
                                                label={CAMPUS_LABEL[c]}
                                                active={selected.campuses.includes(c)}
                                                onClick={() =>
                                                    toggleIn("campus", c.toLowerCase())
                                                }
                                            />
                                        ))}
                                    </ChipWrap>
                                </Section>
                            )}

                            <Section title="Sort by">
                                <div className="grid grid-cols-3 border border-black/15 dark:border-[#D5D5D5]/15">
                                    {SORT_OPTIONS.map((opt, idx) => {
                                        const active = selected.sort === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setSort(opt.value)}
                                                className={cn(
                                                    "h-10 text-xs font-semibold transition active:scale-[0.98]",
                                                    idx > 0 && "border-l border-black/15 dark:border-[#D5D5D5]/15",
                                                    active
                                                        ? "bg-[#5FC4E7]/25 text-black dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                                                        : "bg-white text-black/60 dark:bg-[#0C1222] dark:text-[#D5D5D5]/60",
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Section>

                        </div>
                    </div>

                    <div
                        className="shrink-0 border-t border-black/10 bg-white px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                    >
                        <Drawer.Close asChild>
                            <button
                                type="button"
                                className="inline-flex h-12 w-full items-center justify-center border-2 border-black bg-[#3BF4C7] text-sm font-bold uppercase tracking-[0.08em] text-black transition duration-150 active:scale-[0.99] dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:active:border-[#3BF4C7] dark:active:text-[#3BF4C7]"
                            >
                                Show {totalCount} {totalCount === 1 ? "result" : "results"}
                            </button>
                        </Drawer.Close>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/55 dark:text-[#D5D5D5]/55">
                {title}
            </h3>
            {children}
        </section>
    );
}

function ChipWrap({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function SheetChip({
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
            className={cn(
                "inline-flex h-10 items-center gap-1.5 border px-3.5 text-sm font-semibold transition active:scale-[0.97]",
                active
                    ? "border-[#5FC4E7] bg-[#5FC4E7]/25 text-black dark:border-[#3BF4C7]/60 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                    : "border-black/15 bg-white text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]",
            )}
        >
            <span>{label}</span>
            {count !== undefined && (
                <span
                    className={cn(
                        "text-xs font-normal tabular-nums",
                        active
                            ? "text-black/60 dark:text-[#3BF4C7]/70"
                            : "text-black/45 dark:text-[#D5D5D5]/45",
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    );
}

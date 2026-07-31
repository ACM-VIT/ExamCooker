import React from "react";

// Skeleton placeholders for the course past-papers page's local `<Suspense>`
// boundaries. With Cache Components and partial prefetching enabled, the root
// fallback becomes the App Shell prefetched by links to this route without a
// segment-wide `loading.tsx` that would also affect nested paper routes.

const SHELL_EXAM_TABS = [
    { labelW: "w-6", countW: "w-5" },
    { labelW: "w-12", countW: "w-4" },
    { labelW: "w-12", countW: "w-4" },
    { labelW: "w-10", countW: "w-3" },
    { labelW: "w-10", countW: "w-4" },
];

const SHELL_YEAR_CHIPS = Array.from({ length: 6 }).map(() => ({
    labelW: "w-9",
    countW: "w-4",
}));

const SHELL_SLOT_CHIPS = Array.from({ length: 6 }).map(() => ({
    labelW: "w-6",
    countW: "w-4",
}));

function ShellChip({
    labelW,
    countW,
}: {
    labelW: string;
    countW?: string;
}) {
    return (
        <div className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-black/15 bg-white px-3 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
            <span className={`h-3 ${labelW} bg-black/15 dark:bg-white/15`} />
            {countW && (
                <span className={`h-3 ${countW} bg-black/10 dark:bg-white/10`} />
            )}
        </div>
    );
}

export function CoursePastPapersSectionsShell() {
    return (
        <>
            <section className="flex flex-col gap-2" aria-hidden="true">
                {/* Mobile: Filters button + Key button + result count */}
                <div className="flex items-center justify-between gap-2 sm:hidden">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex h-10 items-center gap-2 border border-black/15 bg-white px-3.5 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
                            <span className="size-4 bg-black/15 dark:bg-white/15" />
                            <span className="h-3 w-12 bg-black/15 dark:bg-white/15" />
                        </div>
                        <div className="inline-flex h-10 items-center gap-2 border border-black/15 bg-white px-3.5 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
                            <span className="size-3.5 bg-black/15 dark:bg-white/15" />
                            <span className="h-3 w-6 bg-black/15 dark:bg-white/15" />
                        </div>
                    </div>
                    <span className="h-3 w-20 bg-black/10 dark:bg-white/10" />
                </div>

                {/* Desktop: stacked chip rows + bottom toolbar */}
                <div className="hidden flex-col gap-1.5 sm:flex">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {SHELL_EXAM_TABS.map((chip, index) => (
                            <ShellChip
                                key={`exam-${index}`}
                                labelW={chip.labelW}
                                countW={chip.countW}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {SHELL_YEAR_CHIPS.map((chip, index) => (
                            <ShellChip
                                key={`year-${index}`}
                                labelW={chip.labelW}
                                countW={chip.countW}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {SHELL_SLOT_CHIPS.map((chip, index) => (
                            <ShellChip
                                key={`slot-${index}`}
                                labelW={chip.labelW}
                                countW={chip.countW}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-[#D5D5D5]/10">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center gap-2">
                                <span className="h-3 w-20 bg-black/15 dark:bg-white/15" />
                                <span className="size-4 border border-black/30 bg-white dark:border-[#D5D5D5]/30 dark:bg-[#0C1222]" />
                            </div>
                            <div className="inline-flex items-center gap-2">
                                <span className="h-3 w-8 bg-black/15 dark:bg-white/15" />
                                <span className="h-7 w-36 border border-black/25 bg-white dark:border-[#D5D5D5]/25 dark:bg-[#0C1222]" />
                            </div>
                        </div>
                        <span className="h-3 w-24 bg-black/10 dark:bg-white/10" />
                    </div>
                </div>
            </section>

            <div className="flex flex-wrap gap-3" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => `paper-shell-${index + 1}`).map((shellKey) => (
                    <div
                        key={shellKey}
                        className="min-w-0 basis-[calc((100%-0.75rem)/2)] sm:basis-[calc((100%-1.5rem)/3)] lg:basis-[calc((100%-2.25rem)/4)] xl:basis-[calc((100%-3rem)/5)]"
                    >
                        <div className="flex h-full flex-col border-2 border-[#5FC4E7] bg-[#5FC4E7] p-3 text-black dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222]">
                            <div className="flex flex-col gap-1.5 pb-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex h-[18px] w-12 items-center bg-black/10 dark:bg-[#D5D5D5]/15" />
                                    <span className="inline-flex h-[18px] w-10 items-center bg-black/10 dark:bg-[#D5D5D5]/15" />
                                    <span className="inline-flex h-[13px] w-8 items-center bg-black/10 dark:bg-[#D5D5D5]/10" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="h-[14px] w-full bg-black/10 dark:bg-[#D5D5D5]/15" />
                                    <span className="h-[14px] w-3/5 bg-black/10 dark:bg-[#D5D5D5]/15" />
                                </div>
                            </div>
                            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#d9d9d9] dark:bg-white/5" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-center" aria-hidden="true">
                <nav className="flex flex-wrap items-center justify-center gap-1">
                    {["‹", "1", "2", "3", "4", "›"].map((label, index) => (
                        <span
                            key={label}
                            className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center border px-3 text-sm font-semibold ${
                                index === 1
                                    ? "border-black bg-[#5FC4E7] text-black dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7]"
                                    : "border-black/30 text-black dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5]"
                            }`}
                        >
                            {label}
                        </span>
                    ))}
                </nav>
            </div>
        </>
    );
}

export function CoursePastPapersHeaderShell() {
    return (
        <div
            className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-10 lg:py-10"
            aria-hidden="true"
        >
            <header className="flex flex-col gap-4">
                <span className="h-3 w-32 bg-black/10 dark:bg-white/10" />
                <span className="h-9 w-2/3 bg-black/10 dark:bg-white/10 sm:h-10 lg:h-12" />
            </header>
            <CoursePastPapersSectionsShell />
        </div>
    );
}

"use client";

import { PanelLeft, X, BookOpen, FileText, GraduationCap } from "lucide-react";
import type { StudyScope } from "@/lib/study/scope";

interface StudyHeaderProps {
    scope: StudyScope | null;
    scopeLabel: string | null;
    scopeSubtitle: string | null;
    onToggleSidebar: () => void;
    onClearScope: () => void;
    compact?: boolean;
}

function scopeMetaFor(type: StudyScope["type"]) {
    if (type === "NOTE") return { label: "Note", Icon: BookOpen };
    if (type === "PAST_PAPER") return { label: "Past paper", Icon: FileText };
    return { label: "Course", Icon: GraduationCap };
}

export function StudyHeader({
    scope,
    scopeLabel,
    onToggleSidebar,
    onClearScope,
    compact,
}: StudyHeaderProps) {
    const showScope = !compact && scope && scopeLabel;
    const meta = scope ? scopeMetaFor(scope.type) : null;

    return (
        <header className={`sticky top-0 z-20 flex min-h-[48px] shrink-0 items-center gap-2 px-3 py-2 backdrop-blur-md sm:px-5 ${compact ? "bg-transparent" : "border-b border-black/[0.06] bg-[#C2E6EC]/85 dark:border-white/[0.06] dark:bg-[#0C1222]/85"}`}>
            <button
                type="button"
                onClick={onToggleSidebar}
                aria-label="Toggle sidebar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-black/60 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5] md:hidden"
            >
                <PanelLeft className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-3">
                {!compact && (
                    <span className="hidden shrink-0 text-[13px] font-semibold tracking-tight text-black/80 sm:inline dark:text-[#D5D5D5]/80">
                        Study assistant
                    </span>
                )}
                {showScope && meta && (
                    <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
                        <meta.Icon className="h-3 w-3 shrink-0 text-black/55 dark:text-[#D5D5D5]/55" strokeWidth={1.75} />
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/50 dark:text-[#D5D5D5]/50">
                            {meta.label}
                        </span>
                        <span className="truncate text-[12.5px] text-black dark:text-[#D5D5D5]">
                            {scopeLabel}
                        </span>
                        <button
                            type="button"
                            onClick={onClearScope}
                            aria-label="Remove context"
                            className="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-black/40 hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/40 dark:hover:bg-white/10 dark:hover:text-[#D5D5D5]"
                        >
                            <X className="h-2.5 w-2.5" />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}

"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
    basePath: string;
    currentPage: number;
    totalPages: number;
    searchString: string;
};

const MAX_VISIBLE = 5;

export default function CoursePagination({ basePath, currentPage, totalPages, searchString }: Props) {
    if (totalPages <= 1) return null;

    const buildHref = (page: number) => {
        const next = new URLSearchParams(searchString);
        if (page <= 1) next.delete("page");
        else next.set("page", String(page));
        const qs = next.toString();
        return qs ? `${basePath}?${qs}` : basePath;
    };

    const transitionForPage = (page: number) => {
        if (page === currentPage) return undefined;
        return page > currentPage ? ["nav-forward"] : ["nav-back"];
    };

    const startPage = Math.max(
        1,
        Math.min(
            currentPage - Math.floor(MAX_VISIBLE / 2),
            totalPages - MAX_VISIBLE + 1,
        ),
    );
    const endPage = Math.min(totalPages, startPage + MAX_VISIBLE - 1);
    const pageNumbers = [] as number[];
    for (let i = Math.max(1, startPage); i <= endPage; i++) pageNumbers.push(i);

    const base =
        "inline-flex h-9 min-w-[2.25rem] items-center justify-center border px-3 text-sm font-semibold transition";
    const inactive =
        "border-black/30 text-black hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5";
    const active =
        "border-black bg-[#5FC4E7] text-black dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7]";
    const disabled = "pointer-events-none opacity-40";

    return (
        <nav className="flex flex-wrap items-center justify-center gap-1">
            <Link
                href={buildHref(currentPage - 1)}
                transitionTypes={transitionForPage(currentPage - 1)}
                aria-label="Previous page"
                className={`${base} ${inactive} ${currentPage <= 1 ? disabled : ""}`}
            >
                <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>

            {startPage > 1 && (
                <>
                    <Link
                        href={buildHref(1)}
                        transitionTypes={transitionForPage(1)}
                        className={`${base} ${inactive}`}
                    >
                        1
                    </Link>
                    {startPage > 2 && (
                        <span className="px-1 text-sm text-black/40 dark:text-[#D5D5D5]/40">
                            …
                        </span>
                    )}
                </>
            )}

            {pageNumbers.map((page) => (
                <Link
                    key={page}
                    href={buildHref(page)}
                    transitionTypes={transitionForPage(page)}
                    className={`${base} ${page === currentPage ? active : inactive}`}
                >
                    {page}
                </Link>
            ))}

            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && (
                        <span className="px-1 text-sm text-black/40 dark:text-[#D5D5D5]/40">
                            …
                        </span>
                    )}
                    <Link
                        href={buildHref(totalPages)}
                        transitionTypes={transitionForPage(totalPages)}
                        className={`${base} ${inactive}`}
                    >
                        {totalPages}
                    </Link>
                </>
            )}

            <Link
                href={buildHref(currentPage + 1)}
                transitionTypes={transitionForPage(currentPage + 1)}
                aria-label="Next page"
                className={`${base} ${inactive} ${currentPage >= totalPages ? disabled : ""}`}
            >
                <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
        </nav>
    );
}

"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOptionalTransitionType } from "@/app/components/common/react-transition";

const OPTIONS = [
    { value: "seasonal", label: "Current exam first" },
    { value: "year_desc", label: "Year (newest first)" },
    { value: "year_asc", label: "Year (oldest first)" },
    { value: "recent", label: "Recently uploaded" },
] as const;

type SortValue = (typeof OPTIONS)[number]["value"];

export default function SortDropdown({
    basePath,
    value,
    searchString,
}: {
    basePath: string;
    value: SortValue;
    searchString: string;
}) {
    const { replace } = useRouter();
    const [, startTransition] = useTransition();

    const onChange = (next: SortValue) => {
        const params = new URLSearchParams(searchString);
        if (next === "seasonal") {
            params.delete("sort");
        } else {
            params.set("sort", next);
        }
        params.delete("page");
        const qs = params.toString();
        startTransition(() => {
            addOptionalTransitionType("filter-results");
            replace(qs ? `${basePath}?${qs}` : basePath);
        });
    };

    return (
        <label className="inline-flex items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                Sort
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as SortValue)}
                className="border border-black/25 bg-white px-2 py-1 text-xs font-semibold text-black focus:border-black focus:outline-none dark:border-[#D5D5D5]/25 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:focus:border-[#D5D5D5]/60"
            >
                {OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

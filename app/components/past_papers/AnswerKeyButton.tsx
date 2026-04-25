"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faKey } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

type Props = {
    count: number;
    searchString: string;
};

export default function AnswerKeyButton({ count, searchString }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const params = new URLSearchParams(searchString);
    const checked = params.get("answer_key") === "1";

    const toggle = useCallback(() => {
        const next = new URLSearchParams(searchString);
        if (checked) next.delete("answer_key");
        else next.set("answer_key", "1");
        next.delete("page");
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, {
            transitionTypes: ["filter-sheet-update"],
        });
    }, [checked, pathname, router, searchString]);

    if (count <= 0) return null;

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={checked}
            className={cn(
                "inline-flex h-10 items-center gap-2 border px-3.5 text-sm font-semibold transition active:scale-[0.98]",
                checked
                    ? "border-[#5FC4E7] bg-[#5FC4E7]/25 text-black dark:border-[#3BF4C7]/60 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                    : "border-black/15 bg-white text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]",
            )}
        >
            <FontAwesomeIcon icon={faKey} className="h-3.5 w-3.5" />
            <span>Key</span>
        </button>
    );
}

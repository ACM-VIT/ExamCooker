"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbtack } from "@fortawesome/free-solid-svg-icons";
import { usePinnedCourses } from "./usePinnedCourses";

type Props = {
    code: string;
    size?: "sm" | "md";
    stopPropagation?: boolean;
    className?: string;
};

export default function PinButton({
    code,
    size = "md",
    stopPropagation = true,
    className = "",
}: Props) {
    const { isPinned, toggle, mounted } = usePinnedCourses();
    const pinned = mounted && isPinned(code);

    const handle = (e: React.MouseEvent) => {
        if (stopPropagation) {
            e.stopPropagation();
            e.preventDefault();
        }
        toggle(code);
    };

    const dim =
        size === "sm"
            ? "h-6 w-6 text-[10px]"
            : "h-8 w-8 text-xs";

    return (
        <button
            type="button"
            onClick={handle}
            aria-label={pinned ? `Unpin ${code}` : `Pin ${code}`}
            aria-pressed={pinned}
            title={pinned ? "Unpin course" : "Pin course"}
            className={`inline-flex shrink-0 ${dim} items-center justify-center rounded-full transition-colors duration-200 ${
                pinned
                    ? "bg-[#5FC4E7]/30 text-black hover:bg-[#5FC4E7]/50 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/30"
                    : "text-black/50 hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:bg-white/5 dark:hover:text-[#3BF4C7]"
            } ${className}`}
        >
            <FontAwesomeIcon
                icon={faThumbtack}
                className={`${size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} ${
                    pinned ? "-rotate-0" : "-rotate-45"
                } transition-transform duration-200`}
            />
        </button>
    );
}

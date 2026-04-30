"use client";
import React, { useCallback } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { useGuestPrompt } from "@/app/components/guest-prompt-provider";
import { captureUploadClick } from "@/lib/posthog/client";

const UploadButtonNotes: React.FC = () => {
    const { requireAuth } = useGuestPrompt();
    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLAnchorElement>) => {
            if (!requireAuth("upload notes")) {
                event.preventDefault();
                return;
            }
            captureUploadClick("note");
        },
        [requireAuth]
    );

    return (
        <div className="group relative inline-flex h-12 w-fit items-stretch">
            <div className="absolute inset-0 dark:bg-[#3BF4C7]" />
            <div className="absolute inset-0 blur-[60px] bg-[#3BF4C7] opacity-0 transition duration-200 group-hover:opacity-20 dark:hidden" />
            <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
            <Link
                href="/notes/create"
                transitionTypes={["nav-forward"]}
                onClick={handleClick}
                title="Create New Note"
                className="relative inline-flex h-full items-center gap-2 border-2 border-black bg-[#3BF4C7] px-4 text-sm font-bold text-black transition duration-150 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7] dark:group-hover:-translate-x-1 dark:group-hover:-translate-y-1"
            >
                <FontAwesomeIcon icon={faPlus} className="text-sm" />
                <span className="leading-none">New</span>
            </Link>
        </div>
    );
};

export default UploadButtonNotes;

"use client";
import React, { useCallback } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";

const UploadButtonPaper: React.FC = () => {
    const { requireAuth } = useGuestPrompt();
    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLAnchorElement>) => {
            if (!requireAuth("upload past papers")) {
                event.preventDefault();
            }
        },
        [requireAuth]
    );

    return (
        <div className="group relative inline-flex h-12 w-fit shrink-0 items-stretch">
            <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
            <div className="transition duration-1000 dark:absolute dark:inset-0 dark:blur-[75px] dark:group-hover:duration-200 dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7]" />
            <Link
                href={"/past_papers/create"}
                onClick={handleClick}
                title="Upload New Past Paper"
                aria-label="Upload new past paper"
                className="border-black relative inline-flex h-full w-12 items-center justify-center gap-2 border-2 bg-[#3BF4C7] px-0 text-base font-bold text-black transition duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7] sm:w-auto sm:px-4 sm:text-lg"
            >
                <FontAwesomeIcon icon={faPlus} className="text-sm" />
                <span className="hidden text-lg leading-none sm:inline">New</span>
            </Link>
        </div>
    );
};

export default UploadButtonPaper;

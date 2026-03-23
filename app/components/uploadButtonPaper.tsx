"use client";
import React, { useCallback } from "react";
import Link from "next/link";
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
    <div className="relative inline-flex w-fit shrink-0 group">
      <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
      <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
      <Link
        href={"/past_papers/create"}
        onClick={handleClick}
        title="Upload New Past Paper"
        className="relative inline-flex h-11 items-center justify-center gap-1 border-2 border-black bg-[#3BF4C7] px-6 text-base font-bold text-black transition duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7]"
      >
        <span className="text-lg leading-none">+</span>
        <span className="leading-none">New</span>
      </Link>
    </div>
  );
};

export default UploadButtonPaper;

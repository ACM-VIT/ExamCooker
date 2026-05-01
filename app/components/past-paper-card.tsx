"use client";
import React from "react";
import Link from "next/link";
import Image from "@/app/components/common/app-image";
import { getPastPaperDetailPath } from "@/lib/seo";

interface PastPaperCardProps {
  pastPaper: {
    id: string;
    title: string;
    thumbNailUrl?: string | null;
    examType?: string | null;
    slot?: string | null;
    year?: number | null;
    course?: { code: string; title?: string } | null;
  };
  index: number;
  openInNewTab?: boolean;
  transitionTypes?: string[] | false;
}

function buildMetadata(p: PastPaperCardProps["pastPaper"]) {
  return [
    p.examType?.replace(/_/g, "-"),
    p.slot ? `Slot ${p.slot}` : undefined,
    p.year?.toString(),
    p.course?.code,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PastPaperCard({
  pastPaper,
  index,
  openInNewTab,
  transitionTypes,
}: PastPaperCardProps) {
  const displayTitle =
    pastPaper.course?.title ??
    pastPaper.title.replace(/\.pdf$/i, "");
  const metadata = buildMetadata(pastPaper);
  const href = getPastPaperDetailPath(pastPaper.id, pastPaper.course?.code);

  return (
    <div className={`max-w-sm w-full h-full text-black dark:text-[#D5D5D5]`}>
      <Link
        href={href}
        prefetch={index < 3}
        transitionTypes={openInNewTab || transitionTypes === false ? undefined : transitionTypes ?? ["nav-forward"]}
        target={openInNewTab ? "_blank" : undefined}
        className="group block max-w-96 cursor-pointer border-2 border-[#5FC4E7] bg-[#5FC4E7] text-center transition duration-200 hover:scale-105 hover:shadow-xl hover:border-b-2 hover:border-b-[#ffffff] dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10 lg:dark:bg-[#0C1222]"
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1 text-left">
            {metadata ? (
              <div className="mb-1 text-xs font-bold text-black/60 dark:text-[#D5D5D5]/70">
                {metadata}
              </div>
            ) : null}
            <div className="w-full text-sm font-semibold leading-snug text-black dark:text-[#D5D5D5] line-clamp-2 select-text">
              {displayTitle}
            </div>
          </div>
        </div>

        <div className="bg-[#d9d9d9] w-full h-44 relative overflow-hidden">
          <Image
            src={pastPaper.thumbNailUrl || "/assets/exam-cooker.png"}
            alt={displayTitle}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 768px) 45vw, 90vw"
            className="object-cover"
            priority={index < 3}
          />
        </div>
      </Link>
    </div>
  );
}

export default PastPaperCard;

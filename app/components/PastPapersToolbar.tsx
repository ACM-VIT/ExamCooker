"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import PastPaperSearch from "@/app/components/PastPaperSearch";
import UploadButtonPaper from "@/app/components/uploadButtonPaper";

const SLOT_OPTIONS = [
    "A1",
    "A2",
    "B1",
    "B2",
    "C1",
    "C2",
    "D1",
    "D2",
    "E1",
    "E2",
    "F1",
    "F2",
    "G1",
    "G2",
] as const;

export default function PastPapersToolbar({
    initialQuery,
    initialDisplay,
}: {
    initialQuery: string;
    initialDisplay: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const router = useRouter();
    const searchParams = useSearchParams();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSelectedTags(searchParams.getAll("tags"));
    }, [searchParams]);

    const selectedSlotSet = useMemo(
        () => new Set(selectedTags.filter((tag) => SLOT_OPTIONS.includes(tag as typeof SLOT_OPTIONS[number]))),
        [selectedTags]
    );

    const updateUrl = useCallback((tags: string[]) => {
        const params = new URLSearchParams(searchParams);
        params.delete("tags");
        tags.forEach((tag) => params.append("tags", tag));
        router.push(`/past_papers?${params.toString()}`);
    }, [router, searchParams]);

    const toggleSlot = useCallback((slot: string) => {
        const otherTags = selectedTags.filter((tag) => !SLOT_OPTIONS.includes(tag as typeof SLOT_OPTIONS[number]));
        const nextSlots = selectedSlotSet.has(slot)
            ? Array.from(selectedSlotSet).filter((selectedSlot) => selectedSlot !== slot)
            : [...selectedSlotSet, slot];
        const nextTags = [...otherTags, ...nextSlots];
        setSelectedTags(nextTags);
        updateUrl(nextTags);
    }, [selectedSlotSet, selectedTags, updateUrl]);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [handleClickOutside, isOpen]);

    return (
        <div ref={containerRef} className="w-5/6 lg:w-1/2">
            <div className="hidden md:flex flex-col gap-3 p-4 pt-2">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => setIsOpen((open) => !open)}
                        aria-expanded={isOpen}
                        aria-controls="past-papers-slot-panel"
                        className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border-2 border-black bg-[#C2E6EC] px-4 py-2 text-lg font-bold text-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all duration-200 ease-linear hover:-translate-y-0.5 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                    >
                        Filter
                        <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <PastPaperSearch initialQuery={initialQuery} initialDisplay={initialDisplay} />
                    </div>
                    <UploadButtonPaper />
                </div>

                <div
                    id="past-papers-slot-panel"
                    className={`overflow-hidden transition-[max-height,opacity,transform,padding] duration-200 ease-linear ${
                        isOpen ? "max-h-40 opacity-100 translate-y-0 pt-1" : "max-h-0 opacity-0 -translate-y-1 pt-0"
                    }`}
                >
                    <div className="mx-auto w-full border border-black px-4 py-3 dark:border-[#D5D5D5]">
                        <div className="mb-3 text-left text-sm font-semibold text-black dark:text-[#D5D5D5]">Slots</div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {SLOT_OPTIONS.map((slot) => {
                                const isSelected = selectedSlotSet.has(slot);
                                return (
                                    <button
                                        key={slot}
                                        type="button"
                                        onClick={() => toggleSlot(slot)}
                                        aria-pressed={isSelected}
                                        className={`min-w-[2.85rem] border px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ease-linear ${
                                            isSelected
                                                ? "border-[#3BF4C7] bg-[#3BF4C7] text-black"
                                                : "border-black bg-[#C2E6EC] text-black hover:bg-[#5FC4E7] dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/10"
                                        }`}
                                    >
                                        {slot}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="md:hidden space-y-4">
                <PastPaperSearch initialQuery={initialQuery} initialDisplay={initialDisplay} />
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setIsOpen((open) => !open)}
                        aria-expanded={isOpen}
                        aria-controls="past-papers-slot-panel-mobile"
                        className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-black bg-[#C2E6EC] px-4 py-2 text-lg font-bold text-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all duration-200 ease-linear hover:-translate-y-0.5 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                    >
                        Filter
                        <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} />
                    </button>
                    <UploadButtonPaper />
                </div>

                <div
                    id="past-papers-slot-panel-mobile"
                    className={`overflow-hidden transition-[max-height,opacity,transform,padding] duration-200 ease-linear ${
                        isOpen ? "max-h-56 opacity-100 translate-y-0 pt-1" : "max-h-0 opacity-0 -translate-y-1 pt-0"
                    }`}
                >
                    <div className="mx-auto w-full border border-black px-4 py-3 dark:border-[#D5D5D5]">
                        <div className="mb-3 text-left text-sm font-semibold text-black dark:text-[#D5D5D5]">Slots</div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {SLOT_OPTIONS.map((slot) => {
                                const isSelected = selectedSlotSet.has(slot);
                                return (
                                    <button
                                        key={slot}
                                        type="button"
                                        onClick={() => toggleSlot(slot)}
                                        aria-pressed={isSelected}
                                        className={`min-w-[2.85rem] border px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ease-linear ${
                                            isSelected
                                                ? "border-[#3BF4C7] bg-[#3BF4C7] text-black"
                                                : "border-black bg-[#C2E6EC] text-black hover:bg-[#5FC4E7] dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/10"
                                        }`}
                                    >
                                        {slot}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

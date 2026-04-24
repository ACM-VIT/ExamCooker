"use client";

import React, { useRef, useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/app/components/common/AppImage";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { formatSyllabusDisplayName, getCourseSyllabusPath, parseSyllabusName } from "@/lib/seo";

type SyllabusItem = { id: string; name: string };

function SyllabusRow({ syllabus }: { syllabus: SyllabusItem }) {
    const parsed = parseSyllabusName(syllabus.name);
    const displayName = parsed.courseName || formatSyllabusDisplayName(syllabus.name);
    const code = parsed.courseCode ?? syllabus.name.split("_")[0];
    const href = parsed.courseCode
        ? getCourseSyllabusPath(parsed.courseCode)
        : `/syllabus/${syllabus.id}`;

    return (
        <Link
            href={href}
            prefetch
            transitionTypes={["nav-forward"]}
            className="group flex min-w-0 items-center gap-3 border-2 border-[#5FC4E7] bg-white px-3 py-2.5 transition-colors hover:border-b-white hover:bg-[#5FC4E7]/10 dark:border-[#ffffff]/20 dark:bg-[#0C1222] dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10"
        >
            <span className="w-20 shrink-0 text-xs font-bold text-black/70 transition-colors group-hover:text-black dark:text-[#D5D5D5]/65 dark:group-hover:text-[#3BF4C7]">
                {code}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm leading-snug text-black dark:text-[#D5D5D5]">
                {displayName}
            </span>
        </Link>
    );
}

function normalize(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function SyllabusGrid({ syllabi }: { syllabi: SyllabusItem[] }) {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        const q = normalize(query);
        if (!q) return syllabi;
        return syllabi.filter((s) => {
            const parsed = parseSyllabusName(s.name);
            const code = normalize(parsed.courseCode ?? "");
            const name = normalize(parsed.courseName ?? formatSyllabusDisplayName(s.name));
            return code.includes(q) || name.includes(q);
        });
    }, [query, syllabi]);

    const clear = () => {
        setQuery("");
        inputRef.current?.focus();
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="relative flex h-12 w-full items-center border border-black/25 bg-white px-2 dark:border-[#D5D5D5]/30 dark:bg-[#3D414E]">
                <Image src={SearchIcon} alt="search" className="dark:invert-[.835]" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by code or name..."
                    className="h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-sm text-black placeholder:text-black/50 outline-none focus:outline-none focus-visible:outline-none sm:text-base dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60"
                    autoComplete="off"
                    spellCheck={false}
                />
                {query && (
                    <button
                        onClick={clear}
                        type="button"
                        aria-label="Clear search"
                        className="inline-flex h-7 w-7 items-center justify-center text-black/60 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                    >
                        <svg viewBox="0 0 14 14" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M1 1L13 13M13 1L1 13" />
                        </svg>
                    </button>
                )}
            </div>

            {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-black/40 dark:text-[#D5D5D5]/40">
                    No syllabi match &ldquo;{query}&rdquo;
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {query && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-black/35 dark:text-[#D5D5D5]/35">
                            {filtered.length} result{filtered.length === 1 ? "" : "s"}
                        </p>
                    )}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {filtered.map((s) => (
                            <SyllabusRow key={s.id} syllabus={s} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

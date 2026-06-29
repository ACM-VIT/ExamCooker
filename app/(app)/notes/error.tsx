"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function NotesError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Surface the failure so it still reaches our logs / error tracking even
        // though the boundary keeps the user on a recoverable screen.
        console.error("[notes] segment render failed", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-5 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
                <h1 className="text-2xl font-black leading-tight sm:text-3xl">
                    This notes page didn&apos;t load
                </h1>
                <p className="text-sm text-black/65 dark:text-[#D5D5D5]/65">
                    Something went wrong while loading these notes. This is usually
                    temporary — try again, or head back to the notes library.
                </p>
                {error.digest ? (
                    <p className="text-xs font-medium text-black/40 dark:text-[#D5D5D5]/40">
                        Reference: {error.digest}
                    </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="inline-flex h-10 items-center border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-4 text-sm font-semibold transition hover:bg-[#5FC4E7]/60 dark:border-white/20 dark:bg-white/10 dark:text-[#D5D5D5] dark:hover:bg-white/15"
                    >
                        Try again
                    </button>
                    <Link
                        href="/notes"
                        className="inline-flex h-10 items-center border-2 border-black/15 px-4 text-sm font-semibold transition hover:border-black/30 dark:border-white/15 dark:text-[#D5D5D5] dark:hover:border-white/30"
                    >
                        Back to notes
                    </Link>
                </div>
            </div>
        </div>
    );
}

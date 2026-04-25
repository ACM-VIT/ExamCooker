"use client";

import type { MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useBookmarks } from "@/app/components/BookmarksProvider";
import { useToast } from "@/components/ui/use-toast";

type ResourceBookmarkButtonProps = {
    id: string;
    title: string;
    className?: string;
};

export default function ResourceBookmarkButton({
    id,
    title,
    className,
}: ResourceBookmarkButtonProps) {
    const { isBookmarked, toggleBookmark } = useBookmarks();
    const { toast } = useToast();
    const bookmarked = isBookmarked(id, "subject");

    const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        toggleBookmark(
            {
                id,
                type: "subject",
                title,
            },
            !bookmarked,
        ).catch(() =>
            toast({
                title: "Error",
                description: "Could not update favorites right now.",
                variant: "destructive",
            }),
        );
    };

    return (
        <button
            type="button"
            onClick={handleToggle}
            aria-label={bookmarked ? "Remove from favorites" : "Add to favorites"}
            className={[
                "inline-flex h-10 w-10 items-center justify-center border border-black/10 bg-white/90 text-black transition hover:border-black/25 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/14",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <Heart
                className={`h-4 w-4 ${bookmarked ? "fill-red-500 text-red-500" : ""}`}
            />
        </button>
    );
}

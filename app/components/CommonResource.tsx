"use client"
import React from 'react';
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useBookmarks } from './BookmarksProvider';
import { useRouter } from 'next/navigation';
import {useToast} from "@/components/ui/use-toast";
import { parsePaperTitle, ParsedPaperTitle } from "@/lib/paperTitle";

type FavoriteType = "note" | "pastpaper" | "forumpost" | "subject";

function removePdfExtension(title: string) {
    return title.replace(/\.pdf$/, '');
}

function humanizeCategory(category: string) {
    const normalized = category
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim()
        .toLowerCase();
    if (normalized === "pastpaper" || normalized === "past paper") return "Past Paper";
    if (normalized === "forumpost" || normalized === "forum post") return "Forum Post";
    if (normalized === "note") return "Note";
    if (normalized === "subject") return "Subject";
    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPastPaperDisplayTitle(title: string, parsed: ParsedPaperTitle) {
    const courseName = parsed.courseName?.trim();
    const baseTitle = courseName ?? parsed.cleanTitle;
    return baseTitle || parsed.cleanTitle || title.replace(/\.pdf$/i, "");
}

function mapCategoryToType(category: string): FavoriteType {
    switch (category.toLowerCase()) {
        case 'note':
            return 'note';
        case 'pastpaper':
            return 'pastpaper';
        case 'forumpost':
            return 'forumpost';
        case 'subject':
            return 'subject';
        default:
            throw new Error(`Invalid category: ${category}`);
    }
}

export default function CommonFav({ category, title, thing }: { category: string, title: string, thing: any }) {
    const { toggleBookmark, isBookmarked } = useBookmarks();
    const { toast } = useToast()
    const favoriteType = mapCategoryToType(category);
    const isFav = isBookmarked(thing.id, favoriteType);
    const router = useRouter();
    const parsedTitle = favoriteType === "pastpaper" ? parsePaperTitle(title) : null;
    const displayTitle = favoriteType === "pastpaper" && parsedTitle
        ? getPastPaperDisplayTitle(title, parsedTitle)
        : removePdfExtension(title);
    const metadataParts = favoriteType === "pastpaper" && parsedTitle
        ? [
              parsedTitle.examType,
              parsedTitle.slot ? `Slot ${parsedTitle.slot}` : undefined,
              parsedTitle.academicYear ?? parsedTitle.year,
              parsedTitle.courseCode,
          ].filter(Boolean)
        : [];
    const metadata = metadataParts.join(" | ");
    const categoryLabel = humanizeCategory(category);

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        toggleBookmark({
            id: thing.id,
            type: favoriteType,
            title: displayTitle,
        }, !isFav).catch(()=>toast({title: "Error! Could not add to favorites", variant: "destructive"}));
    };

    const getLink = () => {
        switch (favoriteType) {
            case 'note':
                return `/notes/${thing.id}`;
            case 'pastpaper':
                return `/past_papers/${thing.id}`;
            case 'forumpost':
                return `/forum/${thing.id}`;
            case 'subject':
                return `/resources/${thing.id}`;
            default:
                return '';
        }
    };

    return (
        <div className="w-full p-2 flex flex-col justify-between gap-2 bg-[#5FC4E7] dark:bg-white/10 lg:dark:bg-[#0C1222] border-2 border-[#5FC4E7] dark:border-white/20 dark:border-b-[#3BF4C7] lg:dark:border-white/20 hover:dark:bg-white/10 hover:scale-105 hover:border-b-white hover:dark:border-b-[#3BF4C7] transition duration-200 cursor-pointer"
            onClick={() => router.push(getLink())}>
            <h6 className="opacity-50 text-xs">{categoryLabel}</h6>
                <h5 className='break-all'>
                    {displayTitle}
                </h5>
                {metadata ? (
                    <div className="text-xs text-black/70 dark:text-white/70 whitespace-nowrap overflow-hidden text-ellipsis">
                        {metadata}
                    </div>
                ) : null}
                <div className="flex justify-between">
                <div></div>
                <button onClick={handleFavoriteClick} className="transition-colors duration-200">
                    <FontAwesomeIcon icon={faHeart} className={isFav ? "text-red-500" : "text-gray-300"} />
                </button>
            </div>

            <div className="flex justify-between gap-2">
                {/* <Link href={} className="w-fit py-1 px-2 text-sm flex items-center bg-white dark:bg-[#3F4451]">
                    <span className="mr-1 flex items-center justify-center">
                        <FontAwesomeIcon icon={faEye} />
                    </span>
                    View
                </Link> */}


            </div>
        </div>
    );
}

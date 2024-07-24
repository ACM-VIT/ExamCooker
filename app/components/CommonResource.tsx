"use client"
import React from 'react';
import { faEye, faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useBookmarks } from './BookmarksProvider';
import { useRouter } from 'next/navigation';
import {useToast} from "@/components/ui/use-toast";

type FavoriteType = "note" | "pastpaper" | "forumpost" | "subject";

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

export default function CommonFav({ category, title, thing, index }: { category: string, title: string, thing: any, index: number}) {
    const { toggleBookmark, isBookmarked } = useBookmarks();
    const { toast } = useToast()
    const favoriteType = mapCategoryToType(category);
    const isFav = isBookmarked(thing.id, favoriteType);
    const router = useRouter();

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        toggleBookmark({
            id: thing.id,
            type: favoriteType,
            title: title,
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
            <h6 className="opacity-50 text-xs">{category.toUpperCase()}</h6>
            <div className="flex justify-between">
            <h5>
                {title}
            </h5>
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

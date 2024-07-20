"use client"
import React from 'react';
import { faEye, faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useBookmarks } from './BookmarksProvider';

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

export default function CommonFav({ category, title, thing }: { category: string, title: string, thing: any }) {
    const { toggleBookmark, isBookmarked } = useBookmarks();
    const favoriteType = mapCategoryToType(category);
    const isFav = isBookmarked(thing.id, favoriteType);

    const handleFavoriteClick = () => {
        toggleBookmark({
            id: thing.id,
            type: favoriteType,
            title: title,
        }, !isFav);
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
        <div className="w-full p-2 flex flex-col justify-between gap-2 bg-[#5FC4E7] dark:bg-white/10 lg:dark:bg-[#0C1222] border-2 border-[#5FC4E7] dark:border-white/20 dark:border-b-[#3BF4C7] lg:dark:border-white/20 hover:dark:bg-white/10 hover:scale-105 hover:border-b-white hover:dark:border-b-[#3BF4C7] transition duration-200">
            <h6>{category.toUpperCase()}</h6>
            <h5>{title}</h5>

            <div className="flex justify-between gap-2">
                <Link href={getLink()} className="w-fit py-1 px-2 text-sm flex items-center bg-white dark:bg-[#3F4451]">
                    <span className="mr-1 flex items-center justify-center">
                        <FontAwesomeIcon icon={faEye} />
                    </span>
                    View
                </Link>

                <button onClick={handleFavoriteClick} className="transition-colors duration-200">
                    <FontAwesomeIcon icon={faHeart} className={isFav ? "text-red-500" : "text-gray-300"} />
                </button>
            </div>
        </div>
    );
}

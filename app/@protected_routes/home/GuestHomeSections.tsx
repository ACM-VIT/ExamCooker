"use client";

import React, { useCallback, useEffect, useState } from "react";
import CommonResource from "@/app/components/CommonResource";
import NothingViewedOrFav from "./NothingViewedOrFav";
import {
    GUEST_BOOKMARKS_EVENT,
    GUEST_RECENTS_EVENT,
    loadGuestBookmarks,
    loadGuestRecentViews,
    type GuestRecentItem,
} from "@/app/lib/guestStorage";
import type { Bookmark } from "@/app/actions/Favourites";

type GuestDisplayItem = {
    id: string;
    type: string;
    title: string;
};

function mapRecentsToDisplay(items: GuestRecentItem[]): GuestDisplayItem[] {
    return items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
    }));
}

function mapBookmarksToDisplay(items: Bookmark[]): GuestDisplayItem[] {
    return items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
    }));
}

export default function GuestHomeSections() {
    const [recentItems, setRecentItems] = useState<GuestDisplayItem[]>([]);
    const [favoriteItems, setFavoriteItems] = useState<GuestDisplayItem[]>([]);

    const refresh = useCallback(() => {
        const recents = loadGuestRecentViews()
            .sort((a, b) => b.viewedAt - a.viewedAt)
            .slice(0, 3);
        setRecentItems(mapRecentsToDisplay(recents));
        setFavoriteItems(mapBookmarksToDisplay(loadGuestBookmarks()).slice(0, 9));
    }, []);

    useEffect(() => {
        refresh();
        const handle = () => refresh();
        window.addEventListener(GUEST_RECENTS_EVENT, handle);
        window.addEventListener(GUEST_BOOKMARKS_EVENT, handle);
        window.addEventListener("storage", handle);
        return () => {
            window.removeEventListener(GUEST_RECENTS_EVENT, handle);
            window.removeEventListener(GUEST_BOOKMARKS_EVENT, handle);
            window.removeEventListener("storage", handle);
        };
    }, [refresh]);

    const emptyRecentlyViewed = recentItems.length === 0;
    const emptyFav = favoriteItems.length === 0;

    return (
        <>
            <section className="mb-16">
                <div className="flex items-center justify-center text-xl sm:text-2xl font-bold mb-6 pt-4">
                    <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                    <span className="mx-4">Recently Viewed</span>
                    <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                </div>
                {emptyRecentlyViewed && (
                    <div className="flex justify-center">
                        <NothingViewedOrFav sectionName="RecentlyViewed" />
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                    {recentItems.map((item) => (
                        <CommonResource
                            key={item.id}
                            category={item.type}
                            title={item.title}
                            thing={{ id: item.id }}
                        />
                    ))}
                </div>
            </section>

            <section>
                <div className="flex items-center justify-center text-xl sm:text-2xl font-bold mb-6 pt-4">
                    <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                    <span className="mx-4">Favourites</span>
                    <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                </div>
                {emptyFav && (
                    <div className="flex justify-center">
                        <NothingViewedOrFav sectionName="Favourites" />
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                    {favoriteItems.map((item) => (
                        <CommonResource
                            key={item.id}
                            category={item.type}
                            title={item.title}
                            thing={{ id: item.id }}
                        />
                    ))}
                </div>
            </section>
        </>
    );
}

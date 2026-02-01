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
        <div className="mt-10 lg:mt-25 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recently Viewed */}
            <section>
                    <div className="flex items-center text-xl sm:text-2xl font-bold mb-6">
                        <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                        <span className="mx-4 whitespace-nowrap">Recently Viewed</span>
                        <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                    </div>
                    {emptyRecentlyViewed ? (
                        <div className="flex justify-center">
                            <NothingViewedOrFav sectionName="RecentlyViewed" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {recentItems.map((item) => (
                                <CommonResource
                                    key={item.id}
                                    category={item.type}
                                    title={item.title}
                                    thing={{ id: item.id }}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Favourites */}
                <section>
                    <div className="flex items-center text-xl sm:text-2xl font-bold mb-6">
                        <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                        <span className="mx-4 whitespace-nowrap">Favourites</span>
                        <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                    </div>
                    {emptyFav ? (
                        <div className="flex justify-center">
                            <NothingViewedOrFav sectionName="Favourites" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {favoriteItems.map((item) => (
                                <CommonResource
                                    key={item.id}
                                    category={item.type}
                                    title={item.title}
                                    thing={{ id: item.id }}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>

    );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import CommonResource from "@/app/components/CommonResource";
import {
    GUEST_BOOKMARKS_EVENT,
    GUEST_RECENTS_EVENT,
    loadGuestBookmarks,
    loadGuestRecentViews,
    type GuestRecentItem,
} from "@/lib/guestStorage";
import type { Bookmark } from "@/app/actions/Favourites";
import NothingViewedOrFav from "./NothingViewedOrFav";

type GuestDisplayItem = {
    id: string;
    type: string;
    title: string;
};

type GuestHomeSectionsProps = {
    courses?: unknown;
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

export default function GuestHomeSections(_props: GuestHomeSectionsProps) {
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

    if (emptyRecentlyViewed && emptyFav) return null;

    const renderSection = (sectionName: "Recently Viewed" | "Favourites", items: GuestDisplayItem[]) => (
        <section>
            <div className="flex items-center text-xl sm:text-2xl font-bold mb-6">
                <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                <span className="mx-4 whitespace-nowrap">{sectionName}</span>
                <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
            </div>
            <div className="flex flex-col gap-4">
                {items.length > 0 ? (
                    items.map((item) => (
                        <CommonResource
                            key={item.id}
                            category={item.type}
                            title={item.title}
                            thing={{ id: item.id }}
                        />
                    ))
                ) : (
                    <NothingViewedOrFav sectionName={sectionName} />
                )}
            </div>
        </section>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {renderSection("Recently Viewed", recentItems)}
            {renderSection("Favourites", favoriteItems)}
        </div>
    );
}

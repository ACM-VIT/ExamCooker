'use client'

import React, { createContext, useState, useContext, useCallback, useTransition, useEffect, useRef } from 'react';
import { Bookmark, toggleBookmarkAction } from '../actions/Favourites';
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";
import { loadGuestBookmarks, saveGuestBookmarks } from "@/lib/guestStorage";
import { getBookmarksAction } from "@/app/actions/getBookmarks";

type BookmarksContextType = {
    bookmarks: Bookmark[];
    toggleBookmark: (bookmark: Bookmark, favorite: boolean) => Promise<void>;
    isBookmarked: (id: string, type: Bookmark['type']) => boolean;
};

const BookmarksContext = createContext<BookmarksContextType>({
    bookmarks: [],
    toggleBookmark: async () => undefined,
    isBookmarked: () => false,
});

function toggleBookmarkInList(bookmarks: Bookmark[], bookmark: Bookmark) {
    const index = bookmarks.findIndex(
        (item) => item.id === bookmark.id && item.type === bookmark.type,
    );

    if (index > -1) {
        return bookmarks.filter((_, itemIndex) => itemIndex !== index);
    }

    return [...bookmarks, bookmark];
}

export function useBookmarks() {
    return useContext(BookmarksContext);
}

export default function BookmarksProvider({ children, initialBookmarks }: { children: React.ReactNode, initialBookmarks: Bookmark[] }) {
    const initialBookmarksRef = useRef(initialBookmarks);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarksRef.current);
    const [, startTransition] = useTransition();
    const { requireAuth, isAuthed, status } = useGuestPrompt();

    useEffect(() => {
        let cancelled = false;

        async function syncBookmarks() {
            if (status === "unauthenticated") {
                if (!cancelled) {
                    setBookmarks(loadGuestBookmarks());
                }
                return;
            }

            if (status !== "authenticated") {
                return;
            }

            const nextBookmarks =
                initialBookmarksRef.current.length > 0
                    ? initialBookmarksRef.current
                    : await getBookmarksAction().catch(() => []);

            if (!cancelled) {
                setBookmarks(nextBookmarks);
            }
        }

        void syncBookmarks();

        return () => {
            cancelled = true;
        };
    }, [status]);

    const toggleBookmark = useCallback(async (bookmark: Bookmark, favourite: boolean) => {
        if (!isAuthed) {
            setBookmarks(prevBookmarks => {
                const next = toggleBookmarkInList(prevBookmarks, bookmark);
                saveGuestBookmarks(next);
                return next;
            });
            return;
        }

        if (!requireAuth("save to favourites")) {
            return;
        }

        setBookmarks((prevBookmarks) => toggleBookmarkInList(prevBookmarks, bookmark));

        startTransition(async () => {
            try {
                const result = await toggleBookmarkAction(bookmark, favourite);

                if (!result.success) {
                    setBookmarks((prevBookmarks) =>
                        toggleBookmarkInList(prevBookmarks, bookmark),
                    );
                    console.error('Failed to toggle bookmark:', result.error);
                }
            } catch (error) {
                setBookmarks((prevBookmarks) =>
                    toggleBookmarkInList(prevBookmarks, bookmark),
                );
                console.error('Error toggling bookmark:', error);
            }
        })
    }, [isAuthed, requireAuth]);

    const isBookmarked = useCallback((id: string, type: Bookmark['type']) => {
        return bookmarks.some(b => b.id === id && b.type === type);
    }, [bookmarks]);

    return (
        <BookmarksContext.Provider value={{ bookmarks, toggleBookmark, isBookmarked }}>
            {children}
        </BookmarksContext.Provider>
    );
}

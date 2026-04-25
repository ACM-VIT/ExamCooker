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

const BookmarksContext = createContext<BookmarksContextType | undefined>(undefined);

export function useBookmarks() {
    const context = useContext(BookmarksContext);
    if (context === undefined) {
        throw new Error('useBookmarks must be used within a BookmarksProvider');
    }
    return context;
}

export default function BookmarksProvider({ children, initialBookmarks }: { children: React.ReactNode, initialBookmarks: Bookmark[] }) {
    const initialBookmarksRef = useRef(initialBookmarks);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarksRef.current);
    const [pending, startTransition] = useTransition();
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

            let nextBookmarks = initialBookmarksRef.current;
            if (nextBookmarks.length === 0) {
                nextBookmarks = await getBookmarksAction().catch(() => []);
            }

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
                const index = prevBookmarks.findIndex(b => b.id === bookmark.id && b.type === bookmark.type);
                const next = index > -1
                    ? prevBookmarks.filter((_, i) => i !== index)
                    : [...prevBookmarks, bookmark];
                saveGuestBookmarks(next);
                return next;
            });
            return;
        }

        if (!requireAuth("save to favourites")) {
            return;
        }

        setBookmarks(prevBookmarks => {
            const index = prevBookmarks.findIndex(b => b.id === bookmark.id && b.type === bookmark.type);
            if (index > -1) {
                return prevBookmarks.filter((_, i) => i !== index);
            } else {
                return [...prevBookmarks, bookmark];
            }
        });

        startTransition(async () => {
            try {

                const result = await toggleBookmarkAction(bookmark, favourite);

                if (!result.success) {
                    setBookmarks(prevBookmarks => {
                        const index = prevBookmarks.findIndex(b => b.id === bookmark.id && b.type === bookmark.type);
                        if (index > -1 && result.isBookmarked) {
                            return [...prevBookmarks.slice(0, index), bookmark, ...prevBookmarks.slice(index + 1)];
                        } else if (index === -1 && !result.isBookmarked) {
                            return prevBookmarks.filter(b => b.id !== bookmark.id || b.type !== bookmark.type);
                        }
                        return prevBookmarks;
                    });
                    console.error('Failed to toggle bookmark:', result.error);
                }

            } catch (error) {
                setBookmarks(prevBookmarks => {
                    const index = prevBookmarks.findIndex(b => b.id === bookmark.id && b.type === bookmark.type);
                    if (index > -1) {
                        return prevBookmarks.filter((_, i) => i !== index);
                    } else {
                        return [...prevBookmarks, bookmark];
                    }
                });
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

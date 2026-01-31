'use client'

import React, { createContext, useState, useContext, useCallback, useTransition } from 'react';
import { Bookmark, toggleBookmarkAction } from '../actions/Favourites';
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";

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
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
    const [pending, startTransition] = useTransition();
    const { requireAuth } = useGuestPrompt();

    const toggleBookmark = useCallback(async (bookmark: Bookmark, favourite: boolean) => {
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
    }, []);

    const isBookmarked = useCallback((id: string, type: Bookmark['type']) => {
        return bookmarks.some(b => b.id === id && b.type === type);
    }, [bookmarks]);

    return (
        <BookmarksContext.Provider value={{ bookmarks, toggleBookmark, isBookmarked }}>
            {children}
        </BookmarksContext.Provider>
    );
}

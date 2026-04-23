import type { Bookmark } from "@/app/actions/Favourites";

export type GuestRecentItemType =
    | Bookmark["type"]
    | "syllabus";

export type GuestRecentItem = {
    id: string;
    type: GuestRecentItemType;
    title: string;
    viewedAt: number;
};

const BOOKMARKS_KEY = "guestBookmarks";
const RECENTS_KEY = "guestRecentViews";
const MAX_RECENTS = 12;

export const GUEST_BOOKMARKS_EVENT = "guest-bookmarks-changed";
export const GUEST_RECENTS_EVENT = "guest-recents-changed";

function isBrowser() {
    return typeof window !== "undefined";
}

function safeParse<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

export function loadGuestBookmarks(): Bookmark[] {
    if (!isBrowser()) return [];
    const data = safeParse<Bookmark[]>(localStorage.getItem(BOOKMARKS_KEY), []);
    if (!Array.isArray(data)) return [];
    return data.filter((item) => item && typeof item.id === "string" && typeof item.title === "string");
}

export function saveGuestBookmarks(bookmarks: Bookmark[]) {
    if (!isBrowser()) return;
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    window.dispatchEvent(new Event(GUEST_BOOKMARKS_EVENT));
}

export function loadGuestRecentViews(): GuestRecentItem[] {
    if (!isBrowser()) return [];
    const data = safeParse<GuestRecentItem[]>(localStorage.getItem(RECENTS_KEY), []);
    if (!Array.isArray(data)) return [];
    return data.filter(
        (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.type === "string"
    );
}

export function recordGuestRecentView(input: Omit<GuestRecentItem, "viewedAt">) {
    if (!isBrowser()) return;
    const existing = loadGuestRecentViews();
    const now = Date.now();
    const next: GuestRecentItem[] = [
        { ...input, viewedAt: now },
        ...existing.filter((item) => !(item.id === input.id && item.type === input.type)),
    ].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(GUEST_RECENTS_EVENT));
}

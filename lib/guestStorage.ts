export type GuestRecentItemType =
    | "note"
    | "pastpaper"
    | "forumpost"
    | "subject"
    | "syllabus";

export type GuestRecentItem = {
    id: string;
    type: GuestRecentItemType;
    title: string;
    viewedAt: number;
};

const RECENTS_KEY = "guestRecentViews";
const MAX_RECENTS = 12;

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

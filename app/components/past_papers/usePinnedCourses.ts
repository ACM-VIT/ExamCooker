"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ec:pinnedCourses";
const CHANGE_EVENT = "ec:pinnedCoursesChanged";

function readList(): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((v): v is string => typeof v === "string")
            : [];
    } catch {
        return [];
    }
}

function writeList(list: string[]) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePinnedCourses() {
    const [pinned, setPinned] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setPinned(readList());
        setMounted(true);
        const handler = () => setPinned(readList());
        window.addEventListener(CHANGE_EVENT, handler);
        window.addEventListener("storage", handler);
        return () => {
            window.removeEventListener(CHANGE_EVENT, handler);
            window.removeEventListener("storage", handler);
        };
    }, []);

    const pin = useCallback((code: string) => {
        const list = readList();
        if (list.includes(code)) return;
        writeList([code, ...list].slice(0, 20));
    }, []);

    const unpin = useCallback((code: string) => {
        const list = readList().filter((c) => c !== code);
        writeList(list);
    }, []);

    const toggle = useCallback((code: string) => {
        const list = readList();
        if (list.includes(code)) {
            writeList(list.filter((c) => c !== code));
        } else {
            writeList([code, ...list].slice(0, 20));
        }
    }, []);

    const isPinned = useCallback(
        (code: string) => pinned.includes(code),
        [pinned],
    );

    return { pinned, pin, unpin, toggle, isPinned, mounted };
}

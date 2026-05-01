"use client";

export type CourseVisitRecord = {
    count: number;
    lastVisitedAt: number;
};

const STORAGE_KEY = "ec:pastPaperCourseVisits";
const CHANGE_EVENT = "ec:pastPaperCourseVisitsChanged";
const MAX_TRACKED = 80;

function readRecords(): Record<string, CourseVisitRecord> {
    if (typeof window === "undefined") return {};
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

        const records: Record<string, CourseVisitRecord> = {};
        for (const [code, value] of Object.entries(parsed)) {
            if (
                typeof code === "string" &&
                value &&
                typeof value === "object" &&
                typeof (value as CourseVisitRecord).count === "number" &&
                typeof (value as CourseVisitRecord).lastVisitedAt === "number"
            ) {
                records[code] = value as CourseVisitRecord;
            }
        }
        return records;
    } catch {
        return {};
    }
}

function writeRecords(records: Record<string, CourseVisitRecord>) {
    const trimmed = Object.fromEntries(
        Object.entries(records)
            .sort(([, a], [, b]) => b.lastVisitedAt - a.lastVisitedAt)
            .slice(0, MAX_TRACKED),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function recordCourseVisit(code: string) {
    if (typeof window === "undefined") return;

    const normalized = code.trim().toUpperCase();
    if (!normalized) return;

    const records = readRecords();
    const current = records[normalized] ?? { count: 0, lastVisitedAt: 0 };
    records[normalized] = {
        count: current.count + 1,
        lastVisitedAt: Date.now(),
    };
    writeRecords(records);
}

export function loadCourseVisitRecords() {
    return readRecords();
}

export function subscribeToCourseVisitChanges(handler: () => void) {
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
        window.removeEventListener(CHANGE_EVENT, handler);
        window.removeEventListener("storage", handler);
    };
}

"use client";

export type PersonalExamRecord = {
    scheduledAt: number;
    title?: string;
    dateStr?: string;
};

const STORAGE_KEY = "ec:personalExamSchedule";
const CHANGE_EVENT = "ec:personalExamScheduleChanged";

function readRecords(): Record<string, PersonalExamRecord> {
    if (typeof window === "undefined") return {};
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

        const records: Record<string, PersonalExamRecord> = {};
        for (const [code, value] of Object.entries(parsed)) {
            if (
                typeof code === "string" &&
                value &&
                typeof value === "object" &&
                typeof (value as PersonalExamRecord).scheduledAt === "number"
            ) {
                records[code] = value as PersonalExamRecord;
            }
        }
        return records;
    } catch {
        return {};
    }
}

export function writePersonalSchedule(records: Record<string, PersonalExamRecord>) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function loadPersonalSchedule() {
    return readRecords();
}

export function subscribeToPersonalScheduleChanges(handler: () => void) {
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
        window.removeEventListener(CHANGE_EVENT, handler);
        window.removeEventListener("storage", handler);
    };
}

export function isExamUpcoming(scheduledAt: number): boolean {
    const now = Date.now();
    return scheduledAt >= now - 86400000; // allow exams from today onwards
}

import { useState, useEffect } from "react";

export function usePersonalSchedule() {
    const [schedule, setSchedule] = useState<Record<string, PersonalExamRecord> | null>(null);

    useEffect(() => {
        setSchedule(loadPersonalSchedule());
        return subscribeToPersonalScheduleChanges(() => {
            setSchedule(loadPersonalSchedule());
        });
    }, []);

    return schedule;
}

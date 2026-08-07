import type { ExamType } from "@/db";

const EXAM_FOCUS_BY_MONTH: readonly ExamType[] = [
    "CAT_1", // January
    "CAT_1", // February
    "CAT_2", // March
    "FAT", // April
    "FAT", // May
    "FAT", // June
    "CAT_1", // July
    "CAT_1", // August
    "CAT_2", // September
    "CAT_2", // October
    "FAT", // November
    "FAT", // December
];

export function getExamFocusForDate(date: Date): ExamType {
    const month = Number(
        new Intl.DateTimeFormat("en-US", {
            month: "numeric",
            timeZone: "Asia/Kolkata",
        }).format(date),
    ) - 1;

    return EXAM_FOCUS_BY_MONTH[month] ?? "CAT_1";
}

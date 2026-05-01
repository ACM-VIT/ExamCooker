import type { ExamType } from "@/db";

export type PaperLinkOption = {
    id: string;
    title: string;
    courseCode: string | null;
    courseTitle: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    hasAnswerKey: boolean;
};

function formatExamType(examType: ExamType | null) {
    return examType ? examType.replace(/_/g, "-") : null;
}

export function formatPaperLinkOption(option: PaperLinkOption) {
    return [
        option.courseCode,
        formatExamType(option.examType),
        option.slot ? `Slot ${option.slot}` : null,
        option.year?.toString() ?? null,
        option.hasAnswerKey ? "Marked answer key" : null,
    ]
        .filter(Boolean)
        .join(" · ");
}

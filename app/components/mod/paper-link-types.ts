import type { ExamType } from "@/db";
import { examTypeLabel } from "@/lib/exam-slug";

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

export function formatPaperLinkOption(option: PaperLinkOption) {
    return [
        option.courseCode,
        option.examType ? examTypeLabel(option.examType) : null,
        option.slot ? `Slot ${option.slot}` : null,
        option.year?.toString() ?? null,
        option.hasAnswerKey ? "Includes an answer key" : null,
    ]
        .filter(Boolean)
        .join(" · ");
}

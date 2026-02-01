import { generateText, Output } from "ai";
import { z } from "zod";
import { normalizeCourseCode } from "@/lib/courseTags";

const AI_PAST_PAPER_MODEL = "google/gemini-3-flash";
const COURSE_CODE_REGEX = /^[A-Z]{2,5}\s?\d{3,4}[A-Z]{0,3}$/i;
const SLOT_OPTIONS = [
    "A1",
    "A2",
    "B1",
    "B2",
    "C1",
    "C2",
    "D1",
    "D2",
    "E1",
    "E2",
    "F1",
    "F2",
    "G1",
    "G2",
] as const;
const EXAM_TYPE_OPTIONS = ["CAT-1", "CAT-2", "FAT", "MID", "QUIZ", "CIA"] as const;

const PastPaperMetadataSchema = z.object({
    courseTitle: z
        .string()
        .min(2)
        .describe("Course name only. Do not include the course code or brackets."),
    courseCode: z
        .string()
        .regex(COURSE_CODE_REGEX)
        .describe("Course code like CSE1001, without brackets."),
    examType: z
        .enum(EXAM_TYPE_OPTIONS)
        .nullable()
        .describe("One of CAT-1, CAT-2, FAT, MID, QUIZ, CIA if present."),
    slot: z
        .enum(SLOT_OPTIONS)
        .nullable()
        .describe("Slot like A1, B2, etc. Null if not found."),
    year: z
        .string()
        .regex(/^20\d{2}$/)
        .nullable()
        .describe("Year like 2024 if present."),
    academicYear: z
        .string()
        .regex(/^20\d{2}-20\d{2}$/)
        .nullable()
        .describe("Academic year like 2023-2024 if present."),
});

type PastPaperMetadata = z.infer<typeof PastPaperMetadataSchema>;

function buildPastPaperTitle(metadata: PastPaperMetadata) {
    const cleanedTitle = metadata.courseTitle.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
    const normalizedCode = normalizeCourseCode(metadata.courseCode);
    const base = `${cleanedTitle} [${normalizedCode}]`;
    const suffix = [
        metadata.examType,
        metadata.slot,
        metadata.academicYear ?? metadata.year,
    ].filter(Boolean);
    return suffix.length ? `${base} ${suffix.join(" ")}` : base;
}

export async function generatePastPaperTitleFromPdf(input: {
    fileUrl: string;
    fallbackTitle: string;
}) {
    try {
        const response = await fetch(input.fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status}`);
        }
        const data = Buffer.from(await response.arrayBuffer());

        const { output } = await generateText({
            model: AI_PAST_PAPER_MODEL,
            output: Output.object({
                name: "PastPaperMetadata",
                description:
                    "Extract course metadata from a VIT past paper PDF to build a standardized title.",
                schema: PastPaperMetadataSchema,
            }),
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text:
                                "Extract the course title and course code from the PDF. " +
                                "Course titles follow the format 'Course Title [COURSECODE]' in our system, " +
                                "but return courseTitle without brackets or code. " +
                                "If exam type, slot, or year are not found, return null for those fields.",
                        },
                        {
                            type: "file",
                            mediaType: "application/pdf",
                            data,
                            filename: `${input.fallbackTitle}.pdf`,
                        },
                    ],
                },
            ],
        });

        return buildPastPaperTitle(output);
    } catch (error) {
        console.warn("AI title generation failed, using fallback title.", error);
        return input.fallbackTitle;
    }
}

import { asc, eq } from "drizzle-orm";
import {
    course,
    db,
    note,
    noteToTag,
    pastPaper,
    pastPaperToTag,
    tag,
    type StudyScope as StudyScopeEnum,
} from "@/db";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";

export type StudyScope =
    | { type: "NOTE"; id: string }
    | { type: "PAST_PAPER"; id: string }
    | { type: "COURSE"; code: string };

export interface ScopeContext {
    type: StudyScopeEnum;
    title: string;
    fileUrl?: string;
    courseCode?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
}

function pickCourseCodeFromTags(tags: { name: string }[]): string | undefined {
    // The past-paper / note title itself often already contains the course
    // code (e.g. "Theory of Computation [BCSE304L] CAT-1 E1 2025-2026"), and
    // the tags list contains the raw tag name which is the same code. Pull
    // the first tag that looks like a course code.
    for (const tag of tags) {
        const trimmed = tag.name.trim();
        if (/^[A-Z]{2,5}\s?\d{3,4}[A-Z]{0,3}$/i.test(trimmed)) {
            return trimmed.replace(/\s+/g, "").toUpperCase();
        }
    }
    return undefined;
}

export async function loadScopeContext(scope: StudyScope): Promise<ScopeContext | null> {
    if (scope.type === "NOTE") {
        const rows = await db
            .select({
                id: note.id,
                title: note.title,
                fileUrl: note.fileUrl,
                courseCode: course.code,
                tagName: tag.name,
            })
            .from(note)
            .leftJoin(course, eq(note.courseId, course.id))
            .leftJoin(noteToTag, eq(noteToTag.a, note.id))
            .leftJoin(tag, eq(noteToTag.b, tag.id))
            .where(eq(note.id, scope.id))
            .orderBy(asc(tag.name));
        const noteRow = rows[0];
        if (!noteRow) return null;
        const tags = rows.flatMap((row) => row.tagName ? [{ name: row.tagName }] : []);
        return {
            type: "NOTE",
            title: noteRow.title,
            fileUrl: normalizeGcsUrl(noteRow.fileUrl) ?? noteRow.fileUrl,
            tags: tags.map((t) => t.name),
            courseCode: noteRow.courseCode ?? pickCourseCodeFromTags(tags),
        };
    }

    if (scope.type === "PAST_PAPER") {
        const rows = await db
            .select({
                id: pastPaper.id,
                title: pastPaper.title,
                fileUrl: pastPaper.fileUrl,
                courseCode: course.code,
                tagName: tag.name,
            })
            .from(pastPaper)
            .leftJoin(course, eq(pastPaper.courseId, course.id))
            .leftJoin(pastPaperToTag, eq(pastPaperToTag.a, pastPaper.id))
            .leftJoin(tag, eq(pastPaperToTag.b, tag.id))
            .where(eq(pastPaper.id, scope.id))
            .orderBy(asc(tag.name));
        const paper = rows[0];
        if (!paper) return null;
        const tags = rows.flatMap((row) => row.tagName ? [{ name: row.tagName }] : []);
        return {
            type: "PAST_PAPER",
            title: paper.title,
            fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
            tags: tags.map((t) => t.name),
            courseCode: paper.courseCode ?? pickCourseCodeFromTags(tags),
        };
    }

    if (scope.type === "COURSE" && scope.code !== "GENERAL") {
        return {
            type: "COURSE",
            title: scope.code,
            courseCode: scope.code,
        };
    }

    return null;
}

export function buildStudySystemPrompt(
    scope: StudyScope,
    context: ScopeContext | null
): string {
    const intro = [
        "You are the ExamCooker study assistant for VIT students.",
        "Your job: help them understand course material, solve past papers, plan revision, and find content that exists inside ExamCooker.",
        "",
        "Voice and formatting:",
        "- Be concise and direct. Short paragraphs. No emojis. Do not use em dashes.",
        "- Use markdown for structure (headings, lists, bold). Use LaTeX via $...$ or $$...$$ for math.",
        "- When you link to ExamCooker resources returned by tools, always include the direct link.",
        "",
        "Tool usage rules:",
        "- Prefer tools over guessing whenever the answer involves ExamCooker data.",
        "- `search_past_papers` for anything about past papers. Pass courseCode, examType (CAT-1 | CAT-2 | FAT), slot, or year when known.",
        "- `search_notes` for study-notes lookups.",
        "- `get_course_overview` when the user asks what is available for a course, or wants a syllabus + papers + notes snapshot.",
        "- `get_syllabus` for the official VIT syllabus PDF of a course.",
        "- `search_forum` when the user wants student discussions, doubts, or community perspective on a topic.",
        "- `image_generation` when the user explicitly asks to generate, draw, or create an image, diagram, visual, poster, or illustration.",
        "- `summarize_document` only when there is a PDF in scope and the user asked for a summary.",
        "- `quiz_me` when the user says quiz me or test me.",
        "- `explain_concept` when the user asks to understand a specific idea, with or without a pasted excerpt.",
        "- Never invent past papers, notes, forum threads, or syllabus items. Only surface what tools return.",
        "- After a tool runs, write a short natural-language follow-up summarising what you found, do not just paste the data.",
    ];

    const contextLines: string[] = [];
    if (context?.type === "NOTE") {
        contextLines.push(
            "",
            `SCOPE: The user is viewing a NOTE titled "${context.title}".`,
            context.courseCode ? `Course code: ${context.courseCode}.` : "",
            context.tags?.length ? `Tags: ${context.tags.join(", ")}.` : "",
            "The PDF of this note is available on document-specific turns. Ground your answers in its content when relevant.",
        );
    } else if (context?.type === "PAST_PAPER") {
        contextLines.push(
            "",
            `SCOPE: The user is viewing a PAST PAPER titled "${context.title}".`,
            context.courseCode ? `Course code: ${context.courseCode}.` : "",
            context.tags?.length ? `Tags: ${context.tags.join(", ")}.` : "",
            "The PDF of this paper is available on document-specific turns. You can walk through questions, grade attempts, or suggest similar papers.",
        );
    } else if (context?.type === "COURSE") {
        contextLines.push(
            "",
            `SCOPE: The user is exploring course ${context.courseCode}.`,
            "Use get_course_overview or get_syllabus to ground anything that depends on the actual course content.",
        );
    } else {
        contextLines.push(
            "",
            "SCOPE: No document or course in scope. If the user references a course, ask for the course code or infer it from their message.",
        );
    }

    return [...intro, ...contextLines].filter(Boolean).join("\n");
}

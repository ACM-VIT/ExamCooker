import { cacheLife, cacheTag } from "next/cache";
import {
    and,
    asc,
    desc,
    eq,
    ne,
    sql,
} from "drizzle-orm";
import { cache } from "react";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import {
    course,
    db,
    pastPaper,
    pastPaperToTag,
    tag,
    user,
    type Campus,
    type ExamType,
    type Semester,
} from "@/src/db";

function normalizePaperLinkSummary<T extends {
    id: string;
    title: string;
    hasAnswerKey: boolean;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    course?: { code: string; title: string } | null;
    courseCode?: string | null;
    courseTitle?: string | null;
}>(paper: T) {
    return {
        ...paper,
        title: paper.title,
        course:
            paper.course ??
            mapCourse(paper.courseCode ?? null, paper.courseTitle ?? null),
    };
}

function mapCourse(
    courseCode: string | null,
    courseTitle: string | null,
) {
    if (!courseCode || !courseTitle) {
        return null;
    }

    return {
        code: courseCode,
        title: courseTitle,
    };
}

const loadPastPaperDetail = cache(async (id: string) => {
    const rows = await db
        .select({
            id: pastPaper.id,
            title: pastPaper.title,
            fileUrl: pastPaper.fileUrl,
            authorId: pastPaper.authorId,
            isClear: pastPaper.isClear,
            createdAt: pastPaper.createdAt,
            updatedAt: pastPaper.updatedAt,
            thumbNailUrl: pastPaper.thumbNailUrl,
            courseId: pastPaper.courseId,
            examType: pastPaper.examType,
            slot: pastPaper.slot,
            year: pastPaper.year,
            semester: pastPaper.semester,
            campus: pastPaper.campus,
            hasAnswerKey: pastPaper.hasAnswerKey,
            questionPaperId: pastPaper.questionPaperId,
            authorName: user.name,
            authorImage: user.image,
            courseCode: course.code,
            courseTitle: course.title,
            tagId: tag.id,
            tagName: tag.name,
        })
        .from(pastPaper)
        .leftJoin(user, eq(pastPaper.authorId, user.id))
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .leftJoin(pastPaperToTag, eq(pastPaperToTag.a, pastPaper.id))
        .leftJoin(tag, eq(pastPaperToTag.b, tag.id))
        .where(eq(pastPaper.id, id))
        .orderBy(asc(tag.name));

    const firstRow = rows[0];

    if (!firstRow) return null;

    const { tagId: _ignoredTagId, tagName: _ignoredTagName, ...paper } = firstRow;
    const tags = rows.flatMap((row) =>
        row.tagId && row.tagName ? [{ id: row.tagId, name: row.tagName }] : [],
    );

    return {
        ...paper,
        fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
        thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
        author: {
            id: paper.authorId,
            name: paper.authorName,
            image: paper.authorImage,
        },
        tags,
        course: mapCourse(paper.courseCode, paper.courseTitle),
    };
});

export async function getPastPaperDetail(id: string) {
    "use cache";
    cacheTag("past_papers");
    cacheTag(`past_paper:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return loadPastPaperDetail(id);
}

export async function getSiblingPastPaper(input: {
    paperId: string;
    questionPaperId: string | null;
    courseId: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    semester: Semester;
    campus: Campus;
    hasAnswerKey: boolean;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheTag(`past_paper:${input.paperId}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const select = {
        id: pastPaper.id,
        title: pastPaper.title,
        hasAnswerKey: pastPaper.hasAnswerKey,
        examType: pastPaper.examType,
        slot: pastPaper.slot,
        year: pastPaper.year,
        courseCode: course.code,
        courseTitle: course.title,
    };

    if (input.hasAnswerKey && input.questionPaperId) {
        const linkedQuestionPaperRows = await db
            .select(select)
            .from(pastPaper)
            .leftJoin(course, eq(pastPaper.courseId, course.id))
            .where(eq(pastPaper.id, input.questionPaperId))
            .limit(1);

        const linkedQuestionPaper = linkedQuestionPaperRows[0];

        if (linkedQuestionPaper) return normalizePaperLinkSummary(linkedQuestionPaper);
    }

    const linkedAnswerKeyRows = await db
        .select(select)
        .from(pastPaper)
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .where(
            and(
                eq(pastPaper.questionPaperId, input.paperId),
                ne(pastPaper.id, input.paperId),
                eq(pastPaper.isClear, true),
            ),
        )
        .orderBy(desc(pastPaper.createdAt))
        .limit(1);

    const linkedAnswerKey = linkedAnswerKeyRows[0];

    if (linkedAnswerKey) return normalizePaperLinkSummary(linkedAnswerKey);

    if (!input.courseId || !input.examType || !input.slot || input.year === null) {
        return null;
    }

    const metadataSiblingRows = await db
        .select(select)
        .from(pastPaper)
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .where(
            and(
                ne(pastPaper.id, input.paperId),
                eq(pastPaper.courseId, input.courseId),
                eq(pastPaper.examType, input.examType),
                eq(pastPaper.slot, input.slot),
                eq(pastPaper.year, input.year),
                eq(pastPaper.semester, input.semester),
                eq(pastPaper.campus, input.campus),
                eq(pastPaper.hasAnswerKey, !input.hasAnswerKey),
                eq(pastPaper.isClear, true),
            ),
        )
        .orderBy(desc(pastPaper.createdAt))
        .limit(1);

    const metadataSibling = metadataSiblingRows[0];

    return metadataSibling ? normalizePaperLinkSummary(metadataSibling) : null;
}

export async function getAdjacentPapersInCourse(input: {
    paperId: string;
    courseId: string;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const rows = await db
        .select({
            id: pastPaper.id,
            year: pastPaper.year,
            examType: pastPaper.examType,
            slot: pastPaper.slot,
            courseCode: course.code,
        })
        .from(pastPaper)
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .where(
            and(
                eq(pastPaper.courseId, input.courseId),
                eq(pastPaper.isClear, true),
            ),
        )
        .orderBy(sql`${pastPaper.year} desc nulls last`, desc(pastPaper.createdAt));

    const papers = rows.map((row) => ({
        id: row.id,
        year: row.year,
        examType: row.examType,
        slot: row.slot,
        course: row.courseCode ? { code: row.courseCode } : null,
    }));

    const index = papers.findIndex((p) => p.id === input.paperId);
    if (index === -1) return { prev: null, next: null };

    return {
        prev: index > 0 ? papers[index - 1] : null,
        next: index < papers.length - 1 ? papers[index + 1] : null,
    };
}

export async function getRelatedPapersForCourse(input: {
    paperId: string;
    courseId: string;
    examType?: ExamType | null;
    limit?: number;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const filters = [
        ne(pastPaper.id, input.paperId),
        eq(pastPaper.courseId, input.courseId),
        eq(pastPaper.isClear, true),
    ];

    if (input.examType) {
        filters.push(eq(pastPaper.examType, input.examType));
    }

    const papers = await db
        .select({
            id: pastPaper.id,
            title: pastPaper.title,
            thumbNailUrl: pastPaper.thumbNailUrl,
            examType: pastPaper.examType,
            slot: pastPaper.slot,
            year: pastPaper.year,
            courseCode: course.code,
            courseTitle: course.title,
        })
        .from(pastPaper)
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .where(and(...filters))
        .orderBy(sql`${pastPaper.year} desc nulls last`, desc(pastPaper.createdAt))
        .limit(input.limit ?? 6);

    return papers.map((paper) => ({
        id: paper.id,
        title: paper.title,
        thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
        examType: paper.examType,
        slot: paper.slot,
        year: paper.year,
        course: mapCourse(paper.courseCode, paper.courseTitle),
    }));
}

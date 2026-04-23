import { extractCourseFromTag, normalizeCourseCode } from "@/lib/courseTags";
import { getPastPaperDetail } from "@/lib/data/pastPaperDetail";
import { parsePaperTitle } from "@/lib/paperTitle";
import {
    OG_ALT,
    OG_CONTENT_TYPE,
    OG_IMAGE_SIZE,
    renderExamCookerOgImage,
} from "@/lib/og";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

function resolveCanonicalCourseCode(input: {
    requestedCode: string;
    relatedCode?: string | null;
    taggedCode?: string | null;
    parsedCode?: string | null;
}) {
    const candidates = [
        input.relatedCode,
        input.taggedCode,
        input.parsedCode,
        input.requestedCode,
    ];

    for (const candidate of candidates) {
        const normalized = normalizeCourseCode(candidate ?? "");
        if (normalized) {
            return normalized;
        }
    }

    return "unassigned";
}

export default async function Image({
    params,
}: {
    params: Promise<{ code: string; id: string }>;
}) {
    const { code, id } = await params;
    const paper = await getPastPaperDetail(id);

    if (!paper) {
        return renderExamCookerOgImage({
            eyebrow: "Past Paper",
            title: "Past Paper",
            subtitle: "View previous year question papers on ExamCooker.",
        });
    }

    const parsedTitle = parsePaperTitle(paper.title);
    const courseTags = paper.tags.filter((tag) => extractCourseFromTag(tag.name));
    const courseFromTag = courseTags.length ? extractCourseFromTag(courseTags[0].name) : null;
    const parsedCourseCode = parsedTitle.courseCode?.replace(/\s+/g, "").toUpperCase();
    const taggedCourseCode = courseFromTag?.code?.replace(/\s+/g, "").toUpperCase();
    const relatedCourseCode = paper.course?.code?.replace(/\s+/g, "").toUpperCase();
    const canonicalCode = resolveCanonicalCourseCode({
        requestedCode: code,
        relatedCode: relatedCourseCode,
        taggedCode: taggedCourseCode,
        parsedCode: parsedCourseCode,
    });

    const useParsedCourse = Boolean(
        parsedCourseCode && (!taggedCourseCode || parsedCourseCode !== taggedCourseCode),
    );
    const courseTitle = useParsedCourse
        ? parsedTitle.courseName ?? parsedTitle.cleanTitle
        : courseFromTag?.title ?? paper.course?.title ?? parsedTitle.courseName ?? parsedTitle.cleanTitle;
    const courseCode = useParsedCourse
        ? parsedCourseCode
        : courseFromTag?.code ?? relatedCourseCode ?? parsedCourseCode ?? canonicalCode;
    const displayTitle =
        courseCode && courseTitle && !courseTitle.toUpperCase().includes(courseCode)
            ? `${courseTitle} (${courseCode})`
            : courseTitle ?? parsedTitle.cleanTitle;
    const examType = parsedTitle.examType;
    const displaySlot = parsedTitle.slot;
    const displayYear = parsedTitle.academicYear ?? parsedTitle.year;
    const primaryTitle = [courseCode, examType].filter(Boolean).join(" ") || "Past Paper";
    const secondaryTitle =
        courseTitle && primaryTitle !== courseTitle ? courseTitle : displayTitle;

    return renderExamCookerOgImage({
        eyebrow: "Past Paper",
        title: primaryTitle,
        subtitle: secondaryTitle,
        description:
            displayTitle && displayTitle !== secondaryTitle ? displayTitle : undefined,
        chips: [
            displaySlot ? `Slot ${displaySlot}` : undefined,
            displayYear,
            "Question paper",
        ],
    });
}

import { examTypeLabel } from "@/lib/examSlug";
import { normalizeCourseCode } from "@/lib/courseTags";
import type { ExamType } from "@/prisma/generated/client";

const PRODUCTION_BASE_URL = "https://examcooker.acmvit.in";
const BETA_BASE_URL = "https://beta.examcooker.acmvit.in";
const FALLBACK_BASE_URL = PRODUCTION_BASE_URL;
const COURSE_CODE_PATTERN = /^[A-Z]{2,6}\d{3,5}[A-Z]?$/;
const UNASSIGNED_COURSE_SEGMENT = "unassigned";

const EXAM_TYPE_KEYWORDS: Partial<Record<ExamType, string[]>> = {
    CAT_1: ["cat 1", "cat-1", "cat1", "cat 1 exam", "cat 1 question paper"],
    CAT_2: ["cat 2", "cat-2", "cat2", "cat 2 exam", "cat 2 question paper"],
    FAT: ["fat", "fat exam", "final assessment test", "fat question paper"],
    MODEL_CAT_1: [
        "model cat 1",
        "model cat-1",
        "sample cat 1 paper",
        "practice cat 1 paper",
    ],
    MODEL_CAT_2: [
        "model cat 2",
        "model cat-2",
        "sample cat 2 paper",
        "practice cat 2 paper",
    ],
    MODEL_FAT: [
        "model fat",
        "sample fat paper",
        "practice fat paper",
        "model final assessment test",
    ],
    MID: ["mid", "mid sem", "mid semester", "midterm", "mid exam"],
    QUIZ: ["quiz", "quiz paper", "quiz questions", "quiz practice paper"],
    CIA: ["cia", "continuous internal assessment", "cia paper"],
    OTHER: ["exam paper", "question paper", "previous year paper"],
};

export const DEFAULT_KEYWORDS = [
    "examcooker",
    "exam cooker",
    "vit",
    "vellore institute of technology",
    "vit vellore",
    "vit chennai",
    "vit acm",
    "acm vit",
    "vit question bank",
    "vit exam papers",
    "vit previous year papers",
    "vit pyq",
    "vit question papers pdf",
    "vit notes",
    "vit study material",
    "vit syllabus",
    "vit course materials",
    "vit assignments",
    "vit lab manuals",
    "vit solved papers",
    "vit sample papers",
    "vit mock tests",
    "previous year question papers",
    "question papers",
    "question bank",
    "past papers",
    "pyq",
    "pyq pdf",
    "previous year papers pdf",
    "exam papers pdf",
    "semester exam papers",
    "semester exam questions",
    "internal assessment papers",
    "mid sem papers",
    "end sem papers",
    "cat1 papers",
    "cat2 papers",
    "fat papers",
    "notes",
    "lecture notes",
    "class notes",
    "study notes",
    "revision notes",
    "course notes",
    "study resources",
    "study guide",
    "exam preparation",
    "exam prep",
    "exam revision",
    "exam practice",
    "practice questions",
    "question bank pdf",
    "download question papers",
    "acm vit",
    "acm vit resources",
    "engineering exam prep",
    "computer science notes",
    "cse notes",
    "ece notes",
    "eee notes",
    "mech notes",
    "it notes",
    "btech notes",
    "btech question papers",
    "btech previous year papers",
    "college exam papers",
    "university exam papers",
    "study material pdf",
];

function stripTrailingSlash(value: string) {
    return value.replace(/\/$/, "");
}

function isLocalhostUrl(value: string) {
    try {
        const url = new URL(value);
        return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch {
        return value.includes("localhost") || value.includes("127.0.0.1");
    }
}

function isBetaDeployment() {
    return [
        process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
        process.env.NEXT_PUBLIC_APP_ENV,
        process.env.APP_ENV,
        process.env.DEPLOYMENT_ENV,
        process.env.WEBSITE_SITE_NAME,
        process.env.WEBSITE_HOSTNAME,
    ].some((value) => value?.toLowerCase().includes("beta"));
}

export function getBaseUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL;
    if (configuredUrl && !isLocalhostUrl(configuredUrl)) {
        return stripTrailingSlash(configuredUrl);
    }

    if (process.env.NODE_ENV === "production" && isBetaDeployment()) {
        return BETA_BASE_URL;
    }

    if (process.env.NODE_ENV === "production" && configuredUrl && isLocalhostUrl(configuredUrl)) {
        return FALLBACK_BASE_URL;
    }

    return stripTrailingSlash(configuredUrl || FALLBACK_BASE_URL);
}

export function absoluteUrl(path: string) {
    const baseUrl = getBaseUrl();
    if (!path) return baseUrl;
    return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function normalizeTitle(title: string) {
    return title.replace(/\.pdf$/i, "").trim();
}

export function safeDecodeURIComponent(value: string) {
    try {
        return decodeURIComponent(value).trim();
    } catch {
        return value.trim();
    }
}

export function safeEncodeURIComponent(value: string) {
    return encodeURIComponent(value.trim());
}

export function buildKeywords(primary: string[], secondary: string[] = []) {
    const normalized = new Set<string>();
    [...primary, ...secondary].forEach((keyword) => {
        const cleaned = keyword.trim();
        if (cleaned) normalized.add(cleaned);
    });
    return Array.from(normalized);
}

function buildKeywordCombos(entities: string[], intents: string[]) {
    const combos: string[] = [];

    entities.forEach((entity) => {
        const normalizedEntity = entity.trim();
        if (!normalizedEntity) return;

        intents.forEach((intent) => {
            const normalizedIntent = intent.trim();
            if (!normalizedIntent) return;
            combos.push(`${normalizedEntity} ${normalizedIntent}`);
        });
    });

    return combos;
}

export function getExamKeywordVariants(examType: ExamType) {
    return buildKeywords(
        [examTypeLabel(examType)],
        EXAM_TYPE_KEYWORDS[examType] ?? [],
    );
}

export function buildCourseKeywordSet(input: {
    code: string;
    title: string;
    aliases?: string[];
    intents?: string[];
    extras?: string[];
}) {
    const aliases = input.aliases ?? [];
    const intents = input.intents ?? [];
    const entities = buildKeywords(
        [
            input.code,
            input.title,
            `${input.title} ${input.code}`,
            `${input.code} ${input.title}`,
        ],
        aliases,
    );

    return buildKeywords(
        entities,
        [
            ...buildKeywordCombos(entities, intents),
            ...(input.extras ?? []),
        ],
    );
}

export function buildCourseExamKeywordSet(input: {
    code: string;
    title: string;
    examType: ExamType;
    aliases?: string[];
    extras?: string[];
}) {
    const examKeywords = getExamKeywordVariants(input.examType);
    const examIntents = [
        "past papers",
        "previous year question papers",
        "pyq",
        "question papers pdf",
        "exam papers",
        "sample papers",
    ];

    const courseKeywords = buildCourseKeywordSet({
        code: input.code,
        title: input.title,
        aliases: input.aliases,
        intents: examKeywords,
    });

    return buildKeywords(courseKeywords, [
        ...buildKeywordCombos(
            buildKeywords([input.code, input.title], input.aliases ?? []),
            examIntents.map((intent) => `${examTypeLabel(input.examType)} ${intent}`),
        ),
        ...buildKeywordCombos(
            examKeywords,
            ["vit", "vit vellore", "question papers", "previous year papers"],
        ),
        ...(input.extras ?? []),
    ]);
}

export function buildExamHubKeywordSet(examType: ExamType) {
    const examKeywords = getExamKeywordVariants(examType);
    return buildKeywords(examKeywords, [
        ...buildKeywordCombos(examKeywords, [
            "past papers",
            "previous year question papers",
            "pyq",
            "question papers pdf",
            "sample papers",
            "download pdf",
        ]),
        ...buildKeywordCombos(examKeywords, [
            "vit",
            "vit vellore",
            "engineering",
        ]),
    ]);
}

export function getCoursePath(code: string) {
    return `/past_papers/${safeEncodeURIComponent(code)}`;
}

export function getCoursePastPapersPath(code: string) {
    return `/past_papers/${safeEncodeURIComponent(code)}`;
}

export function getCourseExamPath(code: string, examSlug: string) {
    return `${getCoursePastPapersPath(code)}/${safeEncodeURIComponent(examSlug)}`;
}

export function getCourseNotesPath(code: string) {
    return `/notes/course/${safeEncodeURIComponent(code)}`;
}

export function getCourseSyllabusPath(code: string) {
    return `/syllabus/course/${safeEncodeURIComponent(code)}`;
}

export function getCourseResourcesPath(code: string) {
    return `/resources/course/${safeEncodeURIComponent(code)}`;
}

export function getExamHubPath(examSlug: string) {
    return `/past_papers/exam/${safeEncodeURIComponent(examSlug)}`;
}

export function getPastPaperDetailPath(paperId: string, courseCode?: string | null) {
    const trimmedCode = courseCode?.trim();
    if (!trimmedCode) {
        return `${getCoursePastPapersPath(UNASSIGNED_COURSE_SEGMENT)}/paper/${safeEncodeURIComponent(paperId)}`;
    }

    const normalizedCode =
        trimmedCode.toLowerCase() === UNASSIGNED_COURSE_SEGMENT
            ? UNASSIGNED_COURSE_SEGMENT
            : normalizeCourseCode(trimmedCode);

    return `${getCoursePastPapersPath(normalizedCode || UNASSIGNED_COURSE_SEGMENT)}/paper/${safeEncodeURIComponent(paperId)}`;
}

export function isLikelyCourseCode(value: string | null | undefined) {
    if (!value) return false;
    return COURSE_CODE_PATTERN.test(normalizeCourseCode(value));
}

export function parseSubjectName(name: string) {
    const normalized = name.replace(/_/g, " ").trim();
    const dashMatch = normalized.match(/^([A-Za-z0-9\s]+?)\s*-\s*(.+)$/);

    if (dashMatch) {
        const possibleCode = normalizeCourseCode(dashMatch[1]);
        const courseName = dashMatch[2].trim();
        if (isLikelyCourseCode(possibleCode)) {
            return {
                courseCode: possibleCode,
                courseName: courseName || possibleCode,
            };
        }
    }

    const tokens = normalized.split(/\s+/);
    const maybeCode = normalizeCourseCode(tokens[0] ?? "");
    if (isLikelyCourseCode(maybeCode)) {
        return {
            courseCode: maybeCode,
            courseName: tokens.slice(1).join(" ").trim() || maybeCode,
        };
    }

    return {
        courseCode: null,
        courseName: normalized,
    };
}

export function formatSyllabusDisplayName(name: string) {
    const noExtension = name.replace(/\.pdf$/i, "").trim();
    const withoutPrefix = noExtension.replace(/^syllabus[_\-\s]*/i, "");
    return withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function parseSyllabusName(name: string) {
    const displayName = formatSyllabusDisplayName(name);
    const tokens = displayName.split(" ").filter(Boolean);
    const maybeCode = normalizeCourseCode(tokens[0] ?? "");

    if (isLikelyCourseCode(maybeCode)) {
        return {
            courseCode: maybeCode,
            courseName: tokens.slice(1).join(" ").trim() || null,
            displayName,
        };
    }

    return {
        courseCode: null,
        courseName: displayName || null,
        displayName,
    };
}

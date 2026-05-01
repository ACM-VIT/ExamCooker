import vinCatalog from "@/lib/generated/vinTogether.json";

export type VinRichItem = {
    text?: string;
    image?: string;
};

export type VinSubtopic = {
    id: string;
    slug: string;
    remotePath: string;
    name: string;
    title: string;
    videos: string[];
    exampleVideos: string[];
    pdfLink: string | null;
    takeaways: VinRichItem[];
    questions: VinRichItem[];
    counts: {
        videoCount: number;
        exampleVideoCount: number;
        takeawayCount: number;
        questionCount: number;
        assetCount: number;
    };
    sourceFile: string | null;
    order: number;
};

export type VinModule = {
    id: string;
    slug: string;
    title: string;
    order: number;
    counts: {
        topicCount: number;
        videoCount: number;
        exampleVideoCount: number;
        takeawayCount: number;
        questionCount: number;
        assetCount: number;
        resourceCount: number;
    };
    subtopics: VinSubtopic[];
};

type VinCourseSnapshot = {
    id: string;
    slug: string;
    name: string;
    year: string;
    image: string | null;
    remotePath: string;
    sourceModulesPath: string | null;
    counts: {
        moduleCount: number;
        topicCount: number;
        videoCount: number;
        exampleVideoCount: number;
        takeawayCount: number;
        questionCount: number;
        assetCount: number;
        resourceCount: number;
    };
    order: number;
    modules: VinModule[];
};

type VinCatalogSnapshot = {
    syncedAt: string;
    source: {
        origin: string;
        coursesUrl: string;
        bundleUrl: string;
        sourceMapUrl: string;
    };
    counts: {
        courseCount: number;
        moduleCount: number;
        topicCount: number;
        videoCount: number;
        questionCount: number;
    };
    courses: VinCourseSnapshot[];
};

export type VinCourse = VinCourseSnapshot & {
    displayName: string;
    shortName?: string;
    aliases: string[];
    matchKeys: string[];
};

const catalog = vinCatalog as VinCatalogSnapshot;

const COURSE_ALIASES: Record<
    string,
    {
        displayName?: string;
        shortName?: string;
        aliases?: string[];
    }
> = {
    "cao": {
        displayName: "Computer Architecture and Organization",
        shortName: "CAO",
        aliases: ["computer architecture", "computer organization"],
    },
    "daa": {
        displayName: "Design and Analysis of Algorithms",
        shortName: "DAA",
        aliases: ["algorithm design", "analysis of algorithms"],
    },
    "toc": {
        displayName: "Theory of Computation",
        shortName: "TOC",
        aliases: ["automata", "formal languages"],
    },
    "mpmc": {
        displayName: "Microprocessors and Microcontrollers",
        shortName: "MPMC",
        aliases: ["microprocessors", "microcontrollers"],
    },
    "oops": {
        displayName: "Object-Oriented Programming",
        shortName: "OOPS",
        aliases: ["oop", "oops"],
    },
    "dsd": {
        displayName: "Digital Systems Design",
        shortName: "DSD",
        aliases: ["digital design", "digital systems"],
    },
    "cryptography-and-network-security": {
        aliases: ["cns", "network security", "cryptography"],
    },
    "data-structures-and-algorithms": {
        aliases: ["dsa"],
    },
    "database-systems": {
        aliases: ["dbms", "database management systems"],
    },
    "basic-engineering": {
        shortName: "Basic Engineering",
        aliases: ["beee", "basic electrical and electronics engineering"],
    },
    "multivariable-calculus-and-differential-equations": {
        aliases: ["calculus", "differential equations", "de", "mde"],
    },
};

function normalizeKey(value: string) {
    return value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\b(the|and|of|to|for|in)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function yearSortValue(value: string) {
    const match = value.match(/\d+/);
    if (!match) return 999;
    return Number(match[0]);
}

function uniqueStrings(values: Array<string | null | undefined>) {
    return Array.from(
        new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
    );
}

function buildCourseMatchKeys(course: VinCourseSnapshot) {
    const overrides = COURSE_ALIASES[course.slug] ?? {};
    const displayName = overrides.displayName ?? course.name;
    const shortName = overrides.shortName ?? undefined;
    const aliases = uniqueStrings([
        course.name,
        displayName,
        shortName,
        ...(overrides.aliases ?? []),
    ]);
    const moduleKeys = course.modules.map((module) => module.title);
    const subtopicKeys = course.modules.flatMap((module) =>
        module.subtopics.flatMap((topic) => [topic.name, topic.title]),
    );

    return {
        displayName,
        shortName,
        aliases,
        matchKeys: uniqueStrings([
            course.slug,
            course.remotePath.replace(/^\//, ""),
            ...aliases,
            ...moduleKeys,
            ...subtopicKeys,
        ]),
    };
}

const courses: VinCourse[] = catalog.courses
    .map((course) => ({
        ...course,
        ...buildCourseMatchKeys(course),
    }))
    .sort((left, right) => {
        const yearDelta = yearSortValue(left.year) - yearSortValue(right.year);
        if (yearDelta !== 0) return yearDelta;
        return left.displayName.localeCompare(right.displayName);
    });

export function getVinCatalogMeta() {
    return {
        syncedAt: catalog.syncedAt,
        source: catalog.source,
        counts: catalog.counts,
    };
}

export function getVinYears() {
    return uniqueStrings(courses.map((course) => course.year)).sort(
        (left, right) => yearSortValue(left) - yearSortValue(right),
    );
}

export function getVinCourses(input?: { search?: string; year?: string }) {
    const normalizedSearch = normalizeKey(input?.search ?? "");
    const normalizedYear = input?.year?.trim() ?? "";

    return courses.filter((course) => {
        if (normalizedYear && course.year !== normalizedYear) {
            return false;
        }

        if (!normalizedSearch) {
            return true;
        }

        return course.matchKeys.some((value) =>
            normalizeKey(value).includes(normalizedSearch),
        );
    });
}

export function getVinCourseById(id: string) {
    const normalizedId = id.trim().toLowerCase();
    if (!normalizedId) return null;

    return (
        courses.find((course) => {
            const remoteKey = course.remotePath.replace(/^\//, "").toLowerCase();
            return (
                course.id === normalizedId ||
                course.slug === normalizedId ||
                remoteKey === normalizedId
            );
        }) ?? null
    );
}

function tokenScore(left: string, right: string) {
    const leftTokens = new Set(normalizeKey(left).split(" ").filter(Boolean));
    const rightTokens = new Set(normalizeKey(right).split(" ").filter(Boolean));

    if (!leftTokens.size || !rightTokens.size) return 0;

    let overlap = 0;
    leftTokens.forEach((token) => {
        if (rightTokens.has(token)) overlap += 1;
    });

    return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function findVinCourseByNames(values: Array<string | null | undefined>) {
    const candidates = uniqueStrings(values).map((value) => value.trim());
    if (candidates.length === 0) return null;

    let bestMatch: { course: VinCourse; score: number } | null = null;

    for (const course of courses) {
        let score = 0;

        for (const candidate of candidates) {
            const normalizedCandidate = normalizeKey(candidate);
            if (!normalizedCandidate) continue;

            for (const key of course.matchKeys) {
                const normalizedKey = normalizeKey(key);

                if (!normalizedKey) continue;

                if (normalizedCandidate === normalizedKey) {
                    score = Math.max(score, 1);
                    continue;
                }

                if (
                    normalizedCandidate.includes(normalizedKey) ||
                    normalizedKey.includes(normalizedCandidate)
                ) {
                    score = Math.max(score, 0.92);
                    continue;
                }

                score = Math.max(score, tokenScore(normalizedCandidate, normalizedKey));
            }
        }

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { course, score };
        }
    }

    return bestMatch && bestMatch.score >= 0.72 ? bestMatch.course : null;
}

export function getVinCourseCount() {
    return courses.length;
}

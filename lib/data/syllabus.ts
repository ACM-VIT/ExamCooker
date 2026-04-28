import { cacheLife, cacheTag } from "next/cache";
import { asc, count, ilike, or } from "drizzle-orm";
import { normalizeCourseCode } from "@/lib/courseTags";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { db, syllabi } from "@/db";

function buildSearchTerms(search: string) {
    const rawSearch = search.trim().replace(/\s+/g, " ");
    if (!rawSearch) return [];

    const compactCourseCode = normalizeCourseCode(rawSearch);
    const terms = new Set<string>([
        rawSearch,
        rawSearch.replace(/\s+/g, "_"),
    ]);

    if (compactCourseCode) {
        terms.add(compactCourseCode);
    }

    return Array.from(terms);
}

function buildWhere(search: string) {
    const terms = buildSearchTerms(search);
    if (!terms.length) return undefined;

    return or(...terms.map((term) => ilike(syllabi.name, `%${term}%`)));
}

export async function getAllSyllabi() {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const items = await db
        .select({
            id: syllabi.id,
            name: syllabi.name,
            fileUrl: syllabi.fileUrl,
        })
        .from(syllabi)
        .orderBy(asc(syllabi.name));

    return items.map((syllabus) => ({
        ...syllabus,
        fileUrl: normalizeGcsUrl(syllabus.fileUrl) ?? syllabus.fileUrl,
    }));
}

export async function getSyllabusCount(input: { search: string }) {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search);
    const rows = await db
        .select({ total: count() })
        .from(syllabi)
        .where(where);

    return rows[0]?.total ?? 0;
}

export async function getSyllabusPage(input: {
    search: string;
    page: number;
    pageSize: number;
}) {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search);
    const skip = (input.page - 1) * input.pageSize;

    return db
        .select({
            id: syllabi.id,
            name: syllabi.name,
        })
        .from(syllabi)
        .where(where)
        .orderBy(asc(syllabi.name))
        .offset(skip)
        .limit(input.pageSize);
}

export async function getSyllabusByCourseCode(code: string) {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code);
    if (!normalized) return null;

    const rows = await db
        .select({
            id: syllabi.id,
            name: syllabi.name,
        })
        .from(syllabi)
        .where(ilike(syllabi.name, `${normalized}_%`))
        .orderBy(asc(syllabi.name))
        .limit(1);

    return rows[0] ?? null;
}

export async function getSyllabusDetailByCourseCode(code: string) {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code);
    if (!normalized) return null;

    const rows = await db
        .select({
            id: syllabi.id,
            name: syllabi.name,
            fileUrl: syllabi.fileUrl,
        })
        .from(syllabi)
        .where(ilike(syllabi.name, `${normalized}_%`))
        .orderBy(asc(syllabi.name))
        .limit(1);

    const syllabus = rows[0];

    if (!syllabus) return null;

    return {
        ...syllabus,
        fileUrl: normalizeGcsUrl(syllabus.fileUrl) ?? syllabus.fileUrl,
    };
}

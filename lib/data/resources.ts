import { withRuntimeIo } from "@/lib/data/runtime-io";
import { cacheLife, cacheTag } from "next/cache";
import { asc, count, eq, ilike, or } from "drizzle-orm";
import { normalizeCourseCode } from "@/lib/course-tags";
import { db, module, subject } from "@/db";

function buildWhere(search: string) {
    const value = search.trim();
    if (!value) return undefined;
    return ilike(subject.name, `%${value}%`);
}

async function getResourcesCountCached(input: { search: string }) {
    "use cache";
    cacheTag("resources");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search);
    const rows = await db
        .select({ total: count() })
        .from(subject)
        .where(where);

    return rows[0]?.total ?? 0;
}

async function getResourcesPageCached(input: {
    search: string;
    page: number;
    pageSize: number;
}) {
    "use cache";
    cacheTag("resources");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search);
    const skip = (input.page - 1) * input.pageSize;

    return db
        .select({
            id: subject.id,
            name: subject.name,
        })
        .from(subject)
        .where(where)
        .orderBy(asc(subject.name))
        .offset(skip)
        .limit(input.pageSize);
}

async function getSubjectByCourseCodeCached(code: string) {
    "use cache";
    cacheTag("resources");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code);
    if (!normalized) return null;

    const subjectRows = await db
        .select({
            id: subject.id,
            name: subject.name,
        })
        .from(subject)
        .where(
            or(
                ilike(subject.name, `${normalized} -%`),
                ilike(subject.name, `${normalized}-%`),
                ilike(subject.name, normalized),
            ),
        )
        .orderBy(asc(subject.name))
        .limit(1);

    const foundSubject = subjectRows[0];
    if (!foundSubject) return null;

    const modules = await db
        .select({
            id: module.id,
            title: module.title,
            subjectId: module.subjectId,
            webReferences: module.webReferences,
            youtubeLinks: module.youtubeLinks,
        })
        .from(module)
        .where(eq(module.subjectId, foundSubject.id))
        .orderBy(asc(module.title));

    return {
        ...foundSubject,
        modules,
    };
}

async function getSubjectDetailCached(id: string) {
    "use cache";
    cacheTag("resources");
    cacheTag(`resource:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const subjectRows = await db
        .select({
            id: subject.id,
            name: subject.name,
        })
        .from(subject)
        .where(eq(subject.id, id))
        .limit(1);

    const foundSubject = subjectRows[0];
    if (!foundSubject) return null;

    const modules = await db
        .select({
            id: module.id,
            title: module.title,
            subjectId: module.subjectId,
            webReferences: module.webReferences,
            youtubeLinks: module.youtubeLinks,
        })
        .from(module)
        .where(eq(module.subjectId, foundSubject.id))
        .orderBy(asc(module.title));

    return {
        ...foundSubject,
        modules,
    };
}

export const getResourcesCount = withRuntimeIo(getResourcesCountCached);
export const getResourcesPage = withRuntimeIo(getResourcesPageCached);
export const getSubjectByCourseCode = withRuntimeIo(getSubjectByCourseCodeCached);
export const getSubjectDetail = withRuntimeIo(getSubjectDetailCached);

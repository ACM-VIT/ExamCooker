import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { db, syllabi } from "@/src/db";

export async function getSyllabusDetail(id: string) {
    "use cache";
    cacheTag("syllabus");
    cacheTag(`syllabus:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const rows = await db
        .select({
            id: syllabi.id,
            name: syllabi.name,
            fileUrl: syllabi.fileUrl,
        })
        .from(syllabi)
        .where(eq(syllabi.id, id))
        .limit(1);

    const syllabus = rows[0];

    if (!syllabus) return null;

    return {
        ...syllabus,
        fileUrl: normalizeGcsUrl(syllabus.fileUrl) ?? syllabus.fileUrl,
    };
}

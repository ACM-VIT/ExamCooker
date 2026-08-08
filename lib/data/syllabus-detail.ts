import { withRuntimeData } from "@/lib/data/runtime-data";
import { eq } from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { db, syllabi } from "@/db";

async function getSyllabusDetailCached(id: string) {
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

export const getSyllabusDetail = withRuntimeData(getSyllabusDetailCached);

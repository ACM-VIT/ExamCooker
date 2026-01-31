import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";

export async function getSyllabusDetail(id: string) {
    "use cache";
    cacheTag("syllabus");
    cacheTag(`syllabus:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const syllabus = await prisma.syllabi.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            fileUrl: true,
        },
    });

    if (!syllabus) return null;

    return {
        ...syllabus,
        fileUrl: normalizeGcsUrl(syllabus.fileUrl) ?? syllabus.fileUrl,
    };
}

import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";

export async function getNoteDetail(id: string) {
    "use cache";
    cacheTag("notes");
    cacheTag(`note:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const note = await prisma.note.findUnique({
        where: { id },
        include: {
            author: true,
            tags: true,
        },
    });

    if (!note) return null;

    return {
        ...note,
        fileUrl: normalizeGcsUrl(note.fileUrl) ?? note.fileUrl,
        thumbNailUrl: normalizeGcsUrl(note.thumbNailUrl) ?? note.thumbNailUrl,
    };
}

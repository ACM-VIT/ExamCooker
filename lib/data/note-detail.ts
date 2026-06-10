import { cacheLife, cacheTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { course, db, note, noteToTag, tag, user } from "@/db";

const loadNoteDetail = cache(async (id: string) => {
    const rows = await db
        .select({
            id: note.id,
            title: note.title,
            authorId: note.authorId,
            fileUrl: note.fileUrl,
            isClear: note.isClear,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            thumbNailUrl: note.thumbNailUrl,
            courseId: note.courseId,
            authorName: user.name,
            authorImage: user.image,
            courseCode: course.code,
            courseTitle: course.title,
            tagId: tag.id,
            tagName: tag.name,
        })
        .from(note)
        .leftJoin(user, eq(note.authorId, user.id))
        .leftJoin(course, eq(note.courseId, course.id))
        .leftJoin(noteToTag, eq(noteToTag.a, note.id))
        .leftJoin(tag, eq(noteToTag.b, tag.id))
        .where(eq(note.id, id))
        .orderBy(asc(tag.name));

    const firstRow = rows[0];

    if (!firstRow) return null;

    const { tagId: _ignoredTagId, tagName: _ignoredTagName, ...noteDetail } = firstRow;
    const tags = rows.flatMap((row) =>
        row.tagId && row.tagName ? [{ id: row.tagId, name: row.tagName }] : [],
    );

    return {
        ...noteDetail,
        fileUrl: normalizeGcsUrl(noteDetail.fileUrl) ?? noteDetail.fileUrl,
        thumbNailUrl:
            normalizeGcsUrl(noteDetail.thumbNailUrl) ?? noteDetail.thumbNailUrl,
        author: {
            id: noteDetail.authorId,
            name: noteDetail.authorName,
            image: noteDetail.authorImage,
        },
        tags,
        course:
            noteDetail.courseCode && noteDetail.courseTitle
                ? {
                    code: noteDetail.courseCode,
                    title: noteDetail.courseTitle,
                }
                : null,
    };
});

export async function getNoteDetail(id: string) {
    "use cache";
    cacheTag("notes");
    cacheTag(`note:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return loadNoteDetail(id);
}

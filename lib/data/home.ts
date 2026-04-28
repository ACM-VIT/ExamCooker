import { cacheLife, cacheTag } from "next/cache";
import { desc, eq, inArray } from "drizzle-orm";
import {
    db,
    forumPost,
    note,
    pastPaper,
    subject,
    viewHistory,
} from "@/db";

export type HomeItem =
    | { type: "note"; item: { id: string; title: string } }
    | { type: "pastPaper"; item: { id: string; title: string } }
    | { type: "forumPost"; item: { id: string; title: string } }
    | { type: "subject"; item: { id: string; name: string } };

export async function getHomeRecentViews(userId: string): Promise<HomeItem[]> {
    "use cache";
    cacheTag("home");
    cacheTag(`home:${userId}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const recentViews = await db
        .select({
            noteId: viewHistory.noteId,
            pastPaperId: viewHistory.pastPaperId,
            forumPostId: viewHistory.forumPostId,
            subjectId: viewHistory.subjectId,
        })
        .from(viewHistory)
        .where(eq(viewHistory.userId, userId))
        .orderBy(desc(viewHistory.viewedAt))
        .limit(3);

    const noteIds = recentViews
        .map((view) => view.noteId)
        .filter((id): id is string => Boolean(id));
    const pastPaperIds = recentViews
        .map((view) => view.pastPaperId)
        .filter((id): id is string => Boolean(id));
    const forumPostIds = recentViews
        .map((view) => view.forumPostId)
        .filter((id): id is string => Boolean(id));
    const subjectIds = recentViews
        .map((view) => view.subjectId)
        .filter((id): id is string => Boolean(id));

    const [notes, papers, posts, subjects] = await Promise.all([
        noteIds.length > 0
            ? db
                .select({ id: note.id, title: note.title })
                .from(note)
                .where(inArray(note.id, noteIds))
            : Promise.resolve([]),
        pastPaperIds.length > 0
            ? db
                .select({ id: pastPaper.id, title: pastPaper.title })
                .from(pastPaper)
                .where(inArray(pastPaper.id, pastPaperIds))
            : Promise.resolve([]),
        forumPostIds.length > 0
            ? db
                .select({ id: forumPost.id, title: forumPost.title })
                .from(forumPost)
                .where(inArray(forumPost.id, forumPostIds))
            : Promise.resolve([]),
        subjectIds.length > 0
            ? db
                .select({ id: subject.id, name: subject.name })
                .from(subject)
                .where(inArray(subject.id, subjectIds))
            : Promise.resolve([]),
    ]);

    const noteById = new Map(notes.map((item) => [item.id, item]));
    const paperById = new Map(papers.map((item) => [item.id, item]));
    const postById = new Map(posts.map((item) => [item.id, item]));
    const subjectById = new Map(subjects.map((item) => [item.id, item]));

    return recentViews
        .map((view) => {
            if (view.noteId) {
                const item = noteById.get(view.noteId);
                return item ? { type: "note" as const, item } : null;
            }
            if (view.pastPaperId) {
                const item = paperById.get(view.pastPaperId);
                return item ? { type: "pastPaper" as const, item } : null;
            }
            if (view.forumPostId) {
                const item = postById.get(view.forumPostId);
                return item ? { type: "forumPost" as const, item } : null;
            }
            if (view.subjectId) {
                const item = subjectById.get(view.subjectId);
                return item ? { type: "subject" as const, item } : null;
            }
            return null;
        })
        .filter((item): item is HomeItem => item !== null);
}

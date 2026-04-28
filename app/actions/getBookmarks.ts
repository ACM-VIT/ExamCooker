"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { auth } from "@/app/auth";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import type { Bookmark } from "@/app/actions/Favourites";
import {
    comment,
    db,
    forumPost,
    forumPostToTag,
    note,
    pastPaper,
    tag,
    subject,
    user,
    userBookmarkedForumPosts,
    userBookmarkedNotes,
    userBookmarkedPastPapers,
    userBookmarkedResources,
    vote,
} from "@/src/db";
import { requireUserByEmail } from "@/src/db/helpers";

type BookmarkWithMeta = Bookmark & {
    thumbNailUrl?: string | null;
    upvoteCount?: number;
    createdAt?: Date;
    downvoteCount?: number;
    votes?: Array<{ type: string }>;
    author?: { name: string | null };
    tags?: Array<{ id: string; name: string }>;
    comments?: Array<{
        id: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        author?: { name: string | null };
    }>;
};

export async function getBookmarksAction(): Promise<BookmarkWithMeta[]> {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
        return [];
    }

    const currentUser = await requireUserByEmail(email);

    const [bookmarkedNotes, bookmarkedPapers, bookmarkedResources, bookmarkedPosts] =
        await Promise.all([
            db
                .select({
                    id: note.id,
                    title: note.title,
                    thumbNailUrl: note.thumbNailUrl,
                })
                .from(userBookmarkedNotes)
                .innerJoin(note, eq(userBookmarkedNotes.a, note.id))
                .where(eq(userBookmarkedNotes.b, currentUser.id)),
            db
                .select({
                    id: pastPaper.id,
                    title: pastPaper.title,
                    thumbNailUrl: pastPaper.thumbNailUrl,
                })
                .from(userBookmarkedPastPapers)
                .innerJoin(pastPaper, eq(userBookmarkedPastPapers.a, pastPaper.id))
                .where(eq(userBookmarkedPastPapers.b, currentUser.id)),
            db
                .select({
                    id: subject.id,
                    title: subject.name,
                })
                .from(userBookmarkedResources)
                .innerJoin(subject, eq(userBookmarkedResources.a, subject.id))
                .where(eq(userBookmarkedResources.b, currentUser.id)),
            db
                .select({
                    id: forumPost.id,
                    title: forumPost.title,
                    upvoteCount: forumPost.upvoteCount,
                    createdAt: forumPost.createdAt,
                    downvoteCount: forumPost.downvoteCount,
                    authorName: user.name,
                })
                .from(userBookmarkedForumPosts)
                .innerJoin(forumPost, eq(userBookmarkedForumPosts.a, forumPost.id))
                .innerJoin(user, eq(forumPost.authorId, user.id))
                .where(eq(userBookmarkedForumPosts.b, currentUser.id)),
        ]);

    const forumPostIds = bookmarkedPosts.map((post) => post.id);

    const [postTags, postVotes, postComments] =
        forumPostIds.length > 0
            ? await Promise.all([
                  db
                      .select({
                          postId: forumPostToTag.a,
                          id: tag.id,
                          name: tag.name,
                      })
                      .from(forumPostToTag)
                      .innerJoin(tag, eq(forumPostToTag.b, tag.id))
                      .where(inArray(forumPostToTag.a, forumPostIds)),
                  db
                      .select({
                          forumPostId: vote.forumPostId,
                          type: vote.type,
                      })
                      .from(vote)
                      .where(
                          and(
                              eq(vote.userId, currentUser.id),
                              inArray(vote.forumPostId, forumPostIds),
                          ),
                      ),
                  db
                      .select({
                          forumPostId: comment.forumPostId,
                          id: comment.id,
                          content: comment.content,
                          createdAt: comment.createdAt,
                          updatedAt: comment.updatedAt,
                          authorName: user.name,
                      })
                      .from(comment)
                      .innerJoin(user, eq(comment.authorId, user.id))
                      .where(inArray(comment.forumPostId, forumPostIds)),
              ])
            : [[], [], []];

    const tagsByPostId = new Map<string, Array<{ id: string; name: string }>>();
    for (const row of postTags) {
        const existing = tagsByPostId.get(row.postId) ?? [];
        existing.push({ id: row.id, name: row.name });
        tagsByPostId.set(row.postId, existing);
    }

    const votesByPostId = new Map(
        postVotes.map((row) => [row.forumPostId, [{ type: row.type }]]),
    );
    const commentsByPostId = new Map<
        string,
        Array<{
            id: string;
            content: string;
            createdAt: Date;
            updatedAt: Date;
            author?: { name: string | null };
        }>
    >();
    for (const row of postComments) {
        const existing = commentsByPostId.get(row.forumPostId) ?? [];
        existing.push({
            id: row.id,
            content: row.content,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            author: { name: row.authorName },
        });
        commentsByPostId.set(row.forumPostId, existing);
    }

    return [
        ...bookmarkedNotes.map((item) => ({
            id: item.id,
            type: "note" as const,
            title: item.title,
            thumbNailUrl: normalizeGcsUrl(item.thumbNailUrl),
        })),
        ...bookmarkedPapers.map((item) => ({
            id: item.id,
            type: "pastpaper" as const,
            title: item.title,
            thumbNailUrl: normalizeGcsUrl(item.thumbNailUrl),
        })),
        ...bookmarkedPosts.map((item) => ({
            id: item.id,
            type: "forumpost" as const,
            title: item.title,
            upvoteCount: item.upvoteCount,
            createdAt: item.createdAt,
            downvoteCount: item.downvoteCount,
            votes: votesByPostId.get(item.id) ?? [],
            author: { name: item.authorName },
            tags: tagsByPostId.get(item.id) ?? [],
            comments: commentsByPostId.get(item.id) ?? [],
        })),
        ...bookmarkedResources.map((item) => ({
            id: item.id,
            type: "subject" as const,
            title: item.title,
        })),
    ];
}

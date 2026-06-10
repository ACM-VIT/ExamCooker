import { tool } from "ai";
import { z } from "zod";
import {
    and,
    count,
    desc,
    eq,
    exists,
    ilike,
    inArray,
    or,
} from "drizzle-orm";
import {
    comment,
    db,
    forum,
    forumPost,
    forumPostToTag,
    tag,
    user,
} from "@/db";
import { normalizeCourseCode } from "@/lib/course-tags";
import type { ScopeContext } from "@/lib/study/scope";

export function createSearchForumTool(context: ScopeContext | null, userId: string) {
    return tool({
        description:
            "Search the ExamCooker forum for student discussions on a topic, concept, or course. Returns recent threads with title, snippet, and vote counts. Use when the user wants real student perspectives or common doubts on a topic.",
        inputSchema: z.object({
            query: z.string().min(2).describe("What to search for."),
            courseCode: z
                .string()
                .optional()
                .describe("Optional course code to scope the search."),
            limit: z.number().int().min(1).max(8).default(6),
        }),
        execute: async ({ query, courseCode, limit }) => {
            const normalizedCourse = courseCode
                ? normalizeCourseCode(courseCode)
                : context?.courseCode ?? null;
            const filters = [buildTextSearch(query)];
            if (normalizedCourse) {
                filters.push(buildTextSearch(normalizedCourse));
            }

            const posts = await db
                .select({
                    id: forumPost.id,
                    title: forumPost.title,
                    description: forumPost.description,
                    upvoteCount: forumPost.upvoteCount,
                    downvoteCount: forumPost.downvoteCount,
                    createdAt: forumPost.createdAt,
                    authorName: user.name,
                    forumName: forum.courseName,
                })
                .from(forumPost)
                .leftJoin(user, eq(forumPost.authorId, user.id))
                .leftJoin(forum, eq(forumPost.forumId, forum.id))
                .where(and(...filters))
                .orderBy(desc(forumPost.createdAt))
                .limit(limit);

            const postIds = posts.map((post) => post.id);
            const commentCounts = postIds.length
                ? await db
                    .select({
                        forumPostId: comment.forumPostId,
                        total: count(),
                    })
                    .from(comment)
                    .where(inArray(comment.forumPostId, postIds))
                    .groupBy(comment.forumPostId)
                : [];
            const commentCountByPostId = new Map(
                commentCounts.map((row) => [row.forumPostId, row.total]),
            );

            return {
                query,
                items: posts.map((p) => ({
                    id: p.id,
                    title: p.title,
                    href: `/forum/${p.id}`,
                    snippet: (p.description ?? "").slice(0, 200),
                    author: p.authorName ?? "Unknown",
                    upvotes: p.upvoteCount,
                    downvotes: p.downvoteCount,
                    commentCount: commentCountByPostId.get(p.id) ?? 0,
                    createdAt: p.createdAt.toISOString(),
                })),
                total: posts.length,
            };
        },
    });
}

function buildTextSearch(value: string) {
    const pattern = `%${value.trim()}%`;
    const search = or(
        ilike(forumPost.title, pattern),
        ilike(forumPost.description, pattern),
        ilike(forum.courseName, pattern),
        exists(
            db
                .select({ id: forumPostToTag.a })
                .from(forumPostToTag)
                .innerJoin(tag, eq(forumPostToTag.b, tag.id))
                .where(and(eq(forumPostToTag.a, forumPost.id), ilike(tag.name, pattern))),
        ),
    );

    if (!search) {
        throw new Error("Unable to build forum search query");
    }

    return search;
}

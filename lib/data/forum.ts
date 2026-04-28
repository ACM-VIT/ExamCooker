import { cacheLife, cacheTag } from "next/cache";
import {
    and,
    count,
    desc,
    eq,
    exists,
    ilike,
    inArray,
    or,
    sql,
} from "drizzle-orm";
import {
    comment,
    db,
    forumPost,
    forumPostToTag,
    tag,
    user,
    vote,
} from "@/src/db";

function buildWhere(search: string, tags: string[]) {
    const filters = [];

    if (tags.length > 0) {
        filters.push(
            exists(
                db
                    .select({ id: forumPostToTag.a })
                    .from(forumPostToTag)
                    .innerJoin(tag, eq(forumPostToTag.b, tag.id))
                    .where(
                        and(
                            eq(forumPostToTag.a, forumPost.id),
                            inArray(tag.name, tags),
                        ),
                    ),
            ),
        );
    }

    if (search) {
        const pattern = `%${search}%`;
        filters.push(
            or(
                ilike(forumPost.title, pattern),
                ilike(forumPost.description, pattern),
                exists(
                    db
                        .select({ id: user.id })
                        .from(user)
                        .where(
                            and(
                                eq(user.id, forumPost.authorId),
                                ilike(user.name, pattern),
                            ),
                        ),
                ),
                exists(
                    db
                        .select({ id: forumPostToTag.a })
                        .from(forumPostToTag)
                        .innerJoin(tag, eq(forumPostToTag.b, tag.id))
                        .where(
                            and(
                                eq(forumPostToTag.a, forumPost.id),
                                ilike(tag.name, pattern),
                            ),
                        ),
                ),
            ),
        );
    }

    if (filters.length === 0) {
        return undefined;
    }

    return filters.length === 1 ? filters[0] : and(...filters);
}

export async function getForumCount(input: { search: string; tags: string[] }) {
    "use cache";
    cacheTag("forum");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    return db
        .select({ total: count() })
        .from(forumPost)
        .where(where)
        .then((rows) => rows[0]?.total ?? 0);
}

export async function getForumPage(input: {
    search: string;
    tags: string[];
    page: number;
    pageSize: number;
    currentUserId: string | null | undefined;
}) {
    "use cache";
    cacheTag("forum");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    const skip = (input.page - 1) * input.pageSize;

    const posts = await db
        .select({
            id: forumPost.id,
            title: forumPost.title,
            description: forumPost.description,
            createdAt: forumPost.createdAt,
            upvoteCount: forumPost.upvoteCount,
            downvoteCount: forumPost.downvoteCount,
            authorName: user.name,
        })
        .from(forumPost)
        .innerJoin(user, eq(forumPost.authorId, user.id))
        .where(where)
        .orderBy(desc(forumPost.createdAt))
        .limit(input.pageSize)
        .offset(skip);

    if (posts.length === 0) {
        return [];
    }

    const postIds = posts.map((post) => post.id);

    const [postTags, postVotes, postCommentCounts] = await Promise.all([
        db
            .select({
                postId: forumPostToTag.a,
                id: tag.id,
                name: tag.name,
            })
            .from(forumPostToTag)
            .innerJoin(tag, eq(forumPostToTag.b, tag.id))
            .where(inArray(forumPostToTag.a, postIds)),
        input.currentUserId
            ? db
                  .select({
                      forumPostId: vote.forumPostId,
                      type: vote.type,
                  })
                  .from(vote)
                  .where(
                      and(
                          eq(vote.userId, input.currentUserId),
                          inArray(vote.forumPostId, postIds),
                      ),
                  )
            : Promise.resolve([]),
        db
            .select({
                forumPostId: comment.forumPostId,
                total: count(),
            })
            .from(comment)
            .where(inArray(comment.forumPostId, postIds))
            .groupBy(comment.forumPostId),
    ]);

    const tagsByPostId = new Map<string, Array<{ id: string; name: string }>>();
    for (const row of postTags) {
        const existing = tagsByPostId.get(row.postId) ?? [];
        existing.push({ id: row.id, name: row.name });
        tagsByPostId.set(row.postId, existing);
    }

    const votesByPostId = new Map(
        postVotes.map((row) => [row.forumPostId, [{ type: row.type }]]),
    );
    const commentCountByPostId = new Map(
        postCommentCounts.map((row) => [row.forumPostId, row.total]),
    );

    return posts.map((post) => ({
        id: post.id,
        title: post.title,
        description: post.description,
        createdAt: post.createdAt,
        upvoteCount: post.upvoteCount,
        downvoteCount: post.downvoteCount,
        author: { name: post.authorName },
        tags: tagsByPostId.get(post.id) ?? [],
        votes: votesByPostId.get(post.id) ?? [],
        _count: {
            comments: commentCountByPostId.get(post.id) ?? 0,
        },
    }));
}

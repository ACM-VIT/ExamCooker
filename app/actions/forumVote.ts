'use server'

import { and, eq, sql } from 'drizzle-orm'
import { auth } from "@/app/auth";
import { revalidateTag } from "next/cache";
import { db, forumPost, type VoteType, vote } from '@/src/db'

async function toggleVote(postId: string, nextType: VoteType) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
        return;
    }

    try {
        const counts = await db.transaction(async (tx) => {
            const existingVote = await tx
                .select()
                .from(vote)
                .where(and(eq(vote.userId, userId), eq(vote.forumPostId, postId)))
                .then((rows) => rows[0] ?? null);

            if (!existingVote) {
                await tx.insert(vote).values({
                    userId,
                    forumPostId: postId,
                    type: nextType,
                });
                await tx
                    .update(forumPost)
                    .set(
                        nextType === "UPVOTE"
                            ? { upvoteCount: sql`${forumPost.upvoteCount} + 1` }
                            : { downvoteCount: sql`${forumPost.downvoteCount} + 1` },
                    )
                    .where(eq(forumPost.id, postId));
            } else if (existingVote.type === nextType) {
                await tx.delete(vote).where(eq(vote.id, existingVote.id));
                await tx
                    .update(forumPost)
                    .set(
                        nextType === "UPVOTE"
                            ? { upvoteCount: sql`${forumPost.upvoteCount} - 1` }
                            : { downvoteCount: sql`${forumPost.downvoteCount} - 1` },
                    )
                    .where(eq(forumPost.id, postId));
            } else {
                await tx
                    .update(vote)
                    .set({ type: nextType })
                    .where(eq(vote.id, existingVote.id));
                await tx
                    .update(forumPost)
                    .set(
                        nextType === "UPVOTE"
                            ? {
                                upvoteCount: sql`${forumPost.upvoteCount} + 1`,
                                downvoteCount: sql`${forumPost.downvoteCount} - 1`,
                            }
                            : {
                                upvoteCount: sql`${forumPost.upvoteCount} - 1`,
                                downvoteCount: sql`${forumPost.downvoteCount} + 1`,
                            },
                    )
                    .where(eq(forumPost.id, postId));
            }

            return tx
                .select({
                    upvoteCount: forumPost.upvoteCount,
                    downvoteCount: forumPost.downvoteCount,
                })
                .from(forumPost)
                .where(eq(forumPost.id, postId))
                .then((rows) => rows[0] ?? null);
        });

        revalidateTag("forum", "minutes");
        return {
            success: true,
            upvoteCount: counts?.upvoteCount,
            downvoteCount: counts?.downvoteCount,
        };
    } catch (error) {
        console.error(`Error toggling ${nextType.toLowerCase()} vote:`, error);
        return { success: false, error: `Failed to ${nextType.toLowerCase()} post` };
    }
}

export async function upvotePost(postId: string) {
    return toggleVote(postId, "UPVOTE");
}

export async function downvotePost(postId: string) {
    return toggleVote(postId, "DOWNVOTE");
}

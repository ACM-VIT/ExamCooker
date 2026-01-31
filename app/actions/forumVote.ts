'use server'

import { PrismaClient } from '@/src/generated/prisma';
import { auth } from "@/app/auth";
import { revalidateTag } from "next/cache";

const prisma = new PrismaClient()

export async function upvotePost(postId: string) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
        return
    }
    try {
        const existingVote = await prisma.vote.findUnique({
            where: {
                userId_forumPostId: {
                    userId,
                    forumPostId: postId,
                },
            },
        });

        if (existingVote) {
            if (existingVote.type === 'UPVOTE') {
                await prisma.vote.delete({
                    where: {
                        id: existingVote.id,
                    },
                });
                await prisma.forumPost.update({
                    where: { id: postId },
                    data: { upvoteCount: { decrement: 1 } },
                });
            } else {
                // Change downvote to upvote
                await prisma.vote.update({
                    where: { id: existingVote.id },
                    data: { type: 'UPVOTE' },
                });
                await prisma.forumPost.update({
                    where: { id: postId },
                    data: {
                        upvoteCount: { increment: 1 },
                        downvoteCount: { decrement: 1 },
                    },
                });
            }
        } else {
            await prisma.vote.create({
                data: {
                    userId,
                    forumPostId: postId,
                    type: 'UPVOTE',
                },
            });
            await prisma.forumPost.update({
                where: { id: postId },
                data: { upvoteCount: { increment: 1 } },
            });
        }

        const updatedPost = await prisma.forumPost.findUnique({
            where: { id: postId },
            select: { upvoteCount: true },
        });

        revalidateTag("forum", "minutes");
        return { success: true, upvoteCount: updatedPost?.upvoteCount };
    } catch (error) {
        console.error('Error upvoting post:', error);
        return { success: false, error: 'Failed to upvote post' };
    }
}



export async function downvotePost(postId: string) {
    try {
        const session = await auth();
        const userId = session?.user?.id;
        if (!userId) {
            return
        }
        const existingVote = await prisma.vote.findUnique({
            where: {
                userId_forumPostId: {
                    userId,
                    forumPostId: postId,
                },
            },
        });

        if (existingVote) {
            if (existingVote.type === 'DOWNVOTE') {
                await prisma.vote.delete({
                    where: {
                        id: existingVote.id,
                    },
                });
                await prisma.forumPost.update({
                    where: { id: postId },
                    data: { downvoteCount: { decrement: 1 } },
                });
            } else {
                await prisma.vote.update({
                    where: { id: existingVote.id },
                    data: { type: 'DOWNVOTE' },
                });
                await prisma.forumPost.update({
                    where: { id: postId },
                    data: {
                        upvoteCount: { decrement: 1 },
                        downvoteCount: { increment: 1 },
                    },
                });
            }
        } else {
            // Add a new downvote
            await prisma.vote.create({
                data: {
                    userId,
                    forumPostId: postId,
                    type: 'DOWNVOTE',
                },
            });
            await prisma.forumPost.update({
                where: { id: postId },
                data: { downvoteCount: { increment: 1 } },
            });
        }

        const updatedPost = await prisma.forumPost.findUnique({
            where: { id: postId },
            select: { downvoteCount: true },
        });

        revalidateTag("forum", "minutes");
        return { success: true, downvoteCount: updatedPost?.downvoteCount };
    } catch (error) {
        console.error('Error downvoting post:', error);
        return { success: false, error: 'Failed to downvote post' };
    }

}

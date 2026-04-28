import { and, asc, eq } from "drizzle-orm";
import ForumPost, { type ForumThreadPost } from "./ForumPost";
import { auth } from "@/app/auth";
import { notFound } from "next/navigation";
import ViewTracker from "@/app/components/ViewTracker";
import {
  comment,
  db,
  forumPost,
  forumPostToTag,
  tag,
  user,
  vote,
} from "@/db";

async function forumPostThread({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  const [postRows, userVotes, comments] = await Promise.all([
    db
      .select({
        id: forumPost.id,
        title: forumPost.title,
        description: forumPost.description,
        upvoteCount: forumPost.upvoteCount,
        downvoteCount: forumPost.downvoteCount,
        authorName: user.name,
        tagId: tag.id,
        tagName: tag.name,
      })
      .from(forumPost)
      .innerJoin(user, eq(forumPost.authorId, user.id))
      .leftJoin(forumPostToTag, eq(forumPostToTag.a, forumPost.id))
      .leftJoin(tag, eq(forumPostToTag.b, tag.id))
      .where(eq(forumPost.id, id))
      .orderBy(asc(tag.name)),
    userId
      ? db
          .select({ type: vote.type })
          .from(vote)
          .where(and(eq(vote.forumPostId, id), eq(vote.userId, userId)))
      : Promise.resolve([]),
    db
      .select({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        authorName: user.name,
      })
      .from(comment)
      .innerJoin(user, eq(comment.authorId, user.id))
      .where(eq(comment.forumPostId, id))
      .orderBy(asc(comment.createdAt)),
  ]);

  const firstRow = postRows[0];
  if (!firstRow) {
    return notFound();
  }

  const tags = postRows.flatMap((row) =>
    row.tagId && row.tagName ? [{ id: row.tagId, name: row.tagName }] : [],
  );

  const post: ForumThreadPost = {
    id: firstRow.id,
    title: firstRow.title,
    description: firstRow.description,
    upvoteCount: firstRow.upvoteCount,
    downvoteCount: firstRow.downvoteCount,
    author: { name: firstRow.authorName },
    votes: userVotes.map((row) => ({ type: row.type })),
    tags,
    comments: comments.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: { name: row.authorName },
    })),
  };

  return (
    <>
      <ViewTracker id={post.id} type="forumpost" title={post.title} />
      <ForumPost post={post} />
    </>
  );
}

export default forumPostThread;

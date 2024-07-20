import { PrismaClient } from "@prisma/client";
import ForumPost from "./ForumPost";
import { auth } from "@/app/auth";
import { recordViewHistory } from "@/app/actions/viewHistory";

async function forumPostThread({ params }: { params: { id: string } }) {

  const prisma = new PrismaClient();
  const forumpost = await prisma.forumPost.findUnique({
    where: {
      id: params.id,
    },
    include: {
      author: {
        select: {
          name: true,
        }
      },
      tags: true,
      comments: {
        include: {
          author: true,
        }
      },
    },
  });
  if (!forumpost) {
    throw new Error('Forum post not found');
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (userId) {
    await recordViewHistory('forumPost', forumpost.id, userId);
  }


  return (
    <ForumPost post={forumpost} tagArray={forumpost?.tags} commentArray={forumpost?.comments} />
  )
}

export default forumPostThread;

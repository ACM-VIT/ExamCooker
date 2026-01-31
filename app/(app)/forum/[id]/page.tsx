import { PrismaClient } from "@/src/generated/prisma";
import ForumPost from "./ForumPost";
import { auth } from "@/app/auth";
import {notFound} from "next/navigation";
import ViewTracker from "@/app/components/ViewTracker";

async function forumPostThread({ params }: { params: Promise<{ id: string }> }) {

  const prisma = new PrismaClient();

  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  const forumpost = await prisma.forumPost.findUnique({
    where: {
      id: id,
    },
    include: {
      author: {
        select: {
          name: true,
        }
      },
      votes: {
        where: {
          userId: userId
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
    return notFound();
  }

  return (
    <>
      <ViewTracker
        id={forumpost.id}
        type="forumpost"
        title={forumpost.title}
      />
      <ForumPost post={forumpost} />
    </>
  )
}

export default forumPostThread;

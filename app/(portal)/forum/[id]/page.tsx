// dummy home.tsx to view forumpost page

import { PrismaClient } from "@prisma/client";
import ForumPost from "./ForumPost";

async function forumPostThread({params}: {params : {id : string}}) {
  
    const prisma = new PrismaClient();
    const forumpost = await prisma.forumPost.findUnique({
      where : {
        id : params.id,
      },
      include: {
        author: {
            select: {
                name: true,
            }
        },
        tags: true, 
        comments: {
          include : {
            author : true,
          }
        },
      },
    });

return(
    <ForumPost post={forumpost} tagArray={forumpost?.tags} commentArray={forumpost?.comments}/>
)
}

export default forumPostThread;

// include {
//   comments: {
//     include: {
//       author: {
//         select: {
//           name: true,
//         },
//       },
//     },
//     select: {
//       content: true,
//       author: true,
//     },
//       },
//     },
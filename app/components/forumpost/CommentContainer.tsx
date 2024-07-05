import { PrismaClient, type Comment } from "@prisma/client";
import { ReplyButton, LikeButton, DislikeButton } from "../common/Buttons";


let count: number | undefined = 0;

export function NumberOfComments({ commentArray }: { commentArray: Comment[] | undefined }) {
    return (
        <div>
            <text className="bg-none text-black text-base py-4 px-2">{commentArray?.length} Comments</text>
        </div>
    );
}

export default async function CommentContainer({ comments }: { comments: Comment[] | undefined }) {
    count = comments?.length;

    return (
        <div className="bg-[#5FC4E7] p-0 md:px-2">
            {comments?.map((comment: Comment) => (
                <Comment
                    key={comment.id}
                    userName={comment.authorId}
                    time={comment.createdAt.toISOString()}
                    content={comment.content}
                />
            ))}
        </div>
    );
}



export function Comment({ userName, time, content }: { userName: string | null | undefined, time: string, content: string }) {
    return (
        <div className="m-0 p-2 border-black border-l w-full">
            <div className="flex justify-between">
                <div>
                    <p className="font-semibold">{userName}</p>
                    <p className="text-xs md:text-base">{time}</p>
                </div>
                <div className="flex gap-2">
                    <ReplyButton />
                    <div className="flex-column">
                        {/* <LikeButton />
                        <DislikeButton /> */}
                    </div>
                </div>
            </div>
            <h6>{content}</h6>
            <hr className="border-0 h-px my-2 bg-black" />
        </div>
    );
}


// const prisma = new PrismaClient();
//     const writer = await prisma.comment.findUnique({
//       where : {
//         id : comment.authorId,
//       },
//       include: {
//         author: true,
//       },
//     });
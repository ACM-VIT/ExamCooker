import { Prisma, PrismaClient, type Comment } from "@prisma/client";
const prisma = new PrismaClient();

let count: number | undefined = 0;

export function NumberOfComments({ commentArray }: { commentArray: Comment[] | undefined }) {
    return (
        <div>
            <text className="bg-none text-base py-4 px-2">{commentArray?.length} Comments</text>
        </div>
    );
}


export default async function CommentContainer({ comments }: { comments: Comment[] | undefined }) {
    count = comments?.length;

    return (
        <div className="bg-[#7BBFE8] dark:bg-[#008A90] p-0 md:px-2 h-full">
            {comments?.map((comment: Comment) => (
                <Comment
                    key={comment.id}
                    commentId={comment.id}
                    time={comment.createdAt.toISOString()}
                    content={comment.content}
                />
            ))}
        </div>
    );
}



export async function Comment({ commentId, time, content }: { commentId: string, time: string, content: string }) {
    const creator = await prisma.comment.findUnique({
        where: {
            id: commentId,
        },
        include: {
            author: {
                select: {
                    name : true
                }
            },
        }
    })
    return (
        <div className="m-0 p-2 border-black border-l w-full">
            <div className="flex justify-between w-full">
                    <p className="font-semibold">{creator?.author.name}</p>
                    <p className="text-xs md:text-base">{time}</p>
            </div>
            <h6>{content}</h6>
            <hr className="border-0 h-px my-2 bg-black" />
        </div>
    );
}

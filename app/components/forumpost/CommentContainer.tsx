import prisma from "@/lib/prisma";
import type { Comment } from "@/prisma/generated/client";


import { TimeHandler } from "./CommentHelpers";

export default function CommentContainer({ comments }: { comments: Comment[] | undefined }) {

    return (
        <div className="bg-[#7BBFE8] dark:bg-[#008A90] p-0 md:px-2 h-full">
            {comments?.map((comment: Comment) => (
                <Comment
                    key={comment.id}
                    commentId={comment.id}
                    time={comment.createdAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })}
                    content={comment.content}
                />
            ))}
        </div>
    );
}

export async function Comment({ commentId, time, content }: { commentId: string, time: string, content: string }) {
    const dateTimeObj = TimeHandler(time);
    const creator = await prisma.comment.findUnique({
        where: {
            id: commentId,
        },
        include: {
            author: {
                select: {
                    name: true
                }
            },
        }
    })
    return (
        <div className="m-0 p-2 border-black border-l w-full">
            <div className="flex justify-between w-full">
                <p className="font-semibold">{creator?.author.name?.slice(0, -10)}</p>
                <p className="text-xs md:text-base">Posted at {dateTimeObj.hours}:{dateTimeObj.minutes} {dateTimeObj.amOrPm}, {dateTimeObj.day}/{dateTimeObj.month}/{dateTimeObj.year}</p>
            </div>
            <h6>{content}</h6>
            <hr className="border-0 h-px my-2 bg-black" />
        </div>
    );
}

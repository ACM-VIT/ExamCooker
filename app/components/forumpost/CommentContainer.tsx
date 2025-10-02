import {type Comment, PrismaClient} from "@/src/generated/prisma";

const prisma = new PrismaClient();


export function NumberOfComments({ commentArray }: { commentArray: Comment[] | undefined }) {
    return (
        <div>
            <text className="bg-none text-base py-4 px-2">{commentArray?.length} Comments</text>
        </div>
    );
}


export default function CommentContainer({ comments }: { comments: Comment[] | undefined }) {

    return (
        <div className="bg-[#7BBFE8] dark:bg-[#008A90] p-0 md:px-2 h-full">
            {comments?.map((comment: Comment) => (
                <Comment
                    key={comment.id}
                    commentId={comment.id}
                    time={comment.createdAt.toLocaleString("en-US", {timeZone: "Asia/Kolkata"})}
                    content={comment.content}
                />
            ))}
        </div>
    );
}

export function TimeHandler(isoString: string) {
    const dateObj = new Date(isoString);

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String((dateObj.getHours() > 12 ? dateObj.getHours() - 12 : dateObj.getHours())).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    const amOrPm = Number(dateObj.getHours()) < 12 ? 'am' : 'pm';

    return {
        year,
        month,
        day,
        hours,
        minutes,
        seconds,
        amOrPm,
    };
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

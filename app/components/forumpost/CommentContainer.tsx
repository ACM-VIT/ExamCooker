import type { ForumThreadComment } from "@/app/(app)/forum/[id]/ForumPost";
import { TimeHandler } from "./CommentHelpers";

export default function CommentContainer({
    comments,
}: {
    comments: ForumThreadComment[] | undefined;
}) {
    return (
        <div className="bg-[#7BBFE8] dark:bg-[#008A90] p-0 md:px-2 h-full">
            {comments?.map((comment) => (
                <Comment key={comment.id} comment={comment} />
            ))}
        </div>
    );
}

function Comment({ comment }: { comment: ForumThreadComment }) {
    const dateTimeObj = TimeHandler(
        comment.createdAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );

    return (
        <div className="m-0 p-2 border-black border-l w-full">
            <div className="flex justify-between w-full">
                <p className="font-semibold">{comment.author?.name?.slice(0, -10)}</p>
                <p className="text-xs md:text-base">
                    Posted at {dateTimeObj.hours}:{dateTimeObj.minutes}{" "}
                    {dateTimeObj.amOrPm}, {dateTimeObj.day}/{dateTimeObj.month}/
                    {dateTimeObj.year}
                </p>
            </div>
            <h6>{comment.content}</h6>
            <hr className="border-0 h-px my-2 bg-black" />
        </div>
    );
}

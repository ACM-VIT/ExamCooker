import type { ForumThreadComment } from "@/app/(app)/forum/[id]/ForumPost";

function formatCommentTimestamp(date: Date) {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

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
    return (
        <div className="m-0 p-2 border-black border-l w-full">
            <div className="flex justify-between w-full">
                <p className="font-semibold">{comment.author?.name?.slice(0, -10)}</p>
                <p className="text-xs md:text-base">
                    Posted at {formatCommentTimestamp(comment.createdAt)}
                </p>
            </div>
            <h6>{comment.content}</h6>
            <hr className="border-0 h-px my-2 bg-black" />
        </div>
    );
}

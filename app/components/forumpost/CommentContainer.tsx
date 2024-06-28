import type { Comment } from "@prisma/client";
import { ReplyButton, LikeButton, DislikeButton } from "../common/Buttons";

let count: number = 0;

export function NumberOfComments() {
    return (
        <div>
            <text className="bg-none text-black text-base py-4 px-2">{count} Comments</text>
        </div>
    );
}

export default function CommentContainer({comments}:{comments:Comment[]}) {
    count = comments.length;
    return (
        <div className="bg-[#5FC4E7] p-0 md:px-2">
            {comments.map((comment: Comment) => (
                <Comment
                    key={comment.id}
                    userName={comment.authorId}
                    time={comment.createdAt}
                    content={comment.content}
                />
            ))}
        </div>
    );
}



export function Comment({ userName, time, content }: { userName: string, time: string, content: string }) {
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
                        <LikeButton />
                        <DislikeButton />
                    </div>
                </div>
            </div>
            <h6>{content}</h6>
            <hr className="border-0 h-px my-2 bg-black" />
        </div>
    );
}

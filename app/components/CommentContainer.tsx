import { ReplyButton, LikeButton, DislikeButton } from "./Buttons";

//dummy data created using gemini with respect to current schema
const jsonData = JSON.parse(`{
  "comments": [
    {
      "id": "c1",
      "content": "This is a helpful post!",
      "author": {
        "id": "u1",
        "email": "olivia.johnson@example.com"
      },
      "authorId": "u1",
      "forumPost": {
        "id": "p1",
        "forumId": "f1"
      },
      "forumPostId": "p1",
      "createdAt": "2024-06-25T16:34:00.000Z",
      "updatedAt": "2024-06-25T16:34:00.000Z"
    },
    {
      "id": "c2",
      "content": "I agree, the examples are clear!",
      "author": {
        "id": "u2",
        "email": "noah.wright@example.com"
      },
      "authorId": "u2",
      "forumPost": {
        "id": "p1",
        "forumId": "f1"
      },
      "forumPostId": "p1",
      "createdAt": "2024-06-25T16:35:00.000Z",
      "updatedAt": "2024-06-25T16:35:00.000Z"
    },
    {
      "id": "c3",
      "content": "Thanks for sharing this resource!",
      "author": {
        "id": "u3",
        "email": "ethan.miller@example.com"
      },
      "authorId": "u3",
      "forumPost": {
        "id": "p1",
        "forumId": "f1"
      },
      "forumPostId": "p1",
      "createdAt": "2024-06-25T16:36:00.000Z",
      "updatedAt": "2024-06-25T16:36:00.000Z"
    }
  ]
}`);

const comments: any[] = jsonData.comments;
let count: number = comments.length;

export function NumberOfComments() {
    return (
        <div>
            <text className="bg-none text-black text-base py-4 px-2">{count} Comments</text>
        </div>
    );
}

export default function CommentContainer() {

    return (
        <div className="bg-[#5FC4E7] px-2">
            {comments.map((comment: any) => (
                <Comment
                    key={comment.id}
                    userName={comment.author.email}
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
                    <p>{time}</p>
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

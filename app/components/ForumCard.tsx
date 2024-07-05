import { NumberOfComments } from "@/app/components/forumpost/CommentContainer";
import TagContainer from "@/app/components/forumpost/TagContainer";
import { DislikeButton, LikeButton } from "@/app/components/common/Buttons";
import { ForumPost, Tag, Comment } from "@prisma/client";
import Link from "next/link";

export default function ForumCard({ post, title, desc, author, tags, createdAt, comments }: { post: ForumPost, title: string, desc: string, author: string | null, tags: Tag[], createdAt: Date, comments: Comment[] | undefined }) {
    return (
        <div className="flex pl-11 pr-7 pt-7 justify-center text-black">
            <div className="bg-[#5FC4E7] p-5 md:p-10 size-full md:size-5/6">
                <div className="flex justify-between items-center">
                    <Link href={`/forum/${post.id}`}>
                        <h2 className="font-extrabold lg:text-3xl md:text-xl text-base">{title}</h2>
                    </Link>
                    <div className="flex items-center space-x-4">
                        <div className="bg-white p-1 hidden md:block">
                            <NumberOfComments commentArray={comments} />
                        </div>
                        <div className="flex space-x-2 p-0.5 bg-white">
                            <LikeButton postId={post.id} upvoteCount={post.upvoteCount} />
                            <DislikeButton postId={post.id} downvoteCount={post.downvoteCount} />
                        </div>
                    </div>
                </div>

                <br></br>
                <p className="text-xs">{desc}</p>
                <br></br>

                <div className="flex justify-between items-center sm:w-2/3 md:w-full">
                    <div className="sm:w-2/3 md:flex md:w-full md:justify-between">
                        <TagContainer tags={tags} />
                    </div>
                </div>
                <div className="text-xs text-right">
                    <p>{author} posted at {createdAt.toISOString()}</p>
                </div>
            </div>
        </div>
    );
}

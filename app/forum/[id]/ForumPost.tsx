import TagContainer from "@/app/components/forumpost/TagContainer";
import CommentField from "@/app/components/forumpost/CommentField";
import CommentContainer from "@/app/components/forumpost/CommentContainer";
import { NumberOfComments } from "@/app/components/forumpost/CommentContainer";
import { DislikeButton, LikeButton } from "@/app/components/common/Buttons";

import type { Tag, Comment, ForumPost } from "@prisma/client";

 function ForumPost({post, tagArray, commentArray}: {post : ForumPost | null, tagArray : Tag[] | undefined, commentArray : Comment[] | undefined}) {
    
    return (
        <div className="flex text-black h-screen">
            <div className="bg-[#82BEE9] p-4 md:p-10 overflow-auto">
                <h2 className="font-extrabold">{post?.title}</h2>
                <hr className="border-0 h-px my-5 bg-black" />
                <h6>{}UngaBunga</h6>
                <br />
                <div className="sm:w-2/3 md:flex md:w-full md:justify-between">
                    <div>
                        <TagContainer tags={tagArray} />
                    </div>
                    <div className="hidden md:flex justify-center p-0.5 bg-white">
                        <LikeButton />
                        <DislikeButton />
                    </div>
                </div>

                <br />
                <div className="flex justify-between">
                    <NumberOfComments commentArray={commentArray}/>
                    <div className="flex md:hidden justify-center p-0.5 bg-none">
                        <LikeButton />
                        <DislikeButton />
                    </div>
                </div>
                <CommentField forumPostId={post.id}/>
                <CommentContainer comments={commentArray} />
            </div>
        </div>
    );
}

export default ForumPost;
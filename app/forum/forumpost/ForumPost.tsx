import TagContainer from "@/app/components/forumpost/TagContainer";
import CommentField from "@/app/components/forumpost/CommentField";
import CommentContainer from "@/app/components/forumpost/CommentContainer";
import { NumberOfComments } from "@/app/components/forumpost/CommentContainer";
import { DislikeButton, LikeButton } from "@/app/components/common/Buttons";

import type { Tag, Comment } from "@prisma/client";

import jsonData from "@/temp/testdata.json";

const tags: Tag[] = jsonData.tags;
const comments: Comment[] = jsonData.comments;

export default function ForumPost({
    title,
    desc,
}: {
    title: string;
    desc: string;
}) {
    let lorem: string =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Nisl nunc mi ipsum faucibus vitae aliquet nec. Suspendisse potenti nullam ac tortor vitae purus. Ut sem nulla pharetra diam sit amet nisl suscipit. Nullam non nisi est sit amet facilisis. Augue ut lectus arcu bibendum at varius. Erat pellentesque adipiscing commodo elit. Sit amet aliquam id diam maecenas ultricies. Elit scelerisque mauris pellentesque pulvinar pellentesque habitant morbi tristique. Enim diam vulputate ut pharetra sit amet aliquam. Nisi lacus sed viverra tellus in. Placerat in egestas erat imperdiet sed euismod nisi. Nunc eget lorem dolor sed viverra ipsum nunc aliquet bibendum. Nec nam aliquam sem et tortor consequat id porta. Massa eget egestas purus viverra accumsan in. Leo integer malesuada nunc vel risus.";

    title = title === "" ? "Title of the Forum Post" : title;
    desc = desc === "" ? lorem : desc;

    return (
        <div className="flex text-black h-screen">
            <div className="bg-[#82BEE9] p-4 md:p-10 overflow-auto">
                <h2 className="font-extrabold">{title}</h2>
                <hr className="border-0 h-px my-5 bg-black" />
                <h6>{desc}</h6>
                <br />
                <div className="sm:w-2/3 md:flex md:w-full md:justify-between">
                    <div>
                        <TagContainer tags={tags} />
                    </div>
                    <div className="hidden md:flex justify-center p-0.5 bg-white">
                        <LikeButton />
                        <DislikeButton />
                    </div>
                </div>

                <br />
                <div className="flex justify-between">
                    <NumberOfComments />
                    <div className="flex md:hidden justify-center p-0.5 bg-none">
                        <LikeButton />
                        <DislikeButton />
                    </div>
                </div>
                <CommentField />
                <CommentContainer comments={comments} />
            </div>
        </div>
    );
}

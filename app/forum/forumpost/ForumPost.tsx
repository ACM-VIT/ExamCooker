import CommentField from "@/app/components/CommentField";
import CommentContainer from "@/app/components/CommentContainer";
import { NumberOfComments } from "@/app/components/CommentContainer";
import TagContainer from "../TagContainer";
import { DislikeButton, LikeButton } from "@/app/components/Buttons";

import jsonData from "@/temp/testdata.json";

const tags: any[] = jsonData.tags;
const comments: any[] = jsonData.comments;

export default function ForumPost({ title, desc }: { title: string, desc: string }) {
    let lorem: string = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Nisl nunc mi ipsum faucibus vitae aliquet nec. Suspendisse potenti nullam ac tortor vitae purus. Ut sem nulla pharetra diam sit amet nisl suscipit. Nullam non nisi est sit amet facilisis. Augue ut lectus arcu bibendum at varius. Erat pellentesque adipiscing commodo elit. Sit amet aliquam id diam maecenas ultricies. Elit scelerisque mauris pellentesque pulvinar pellentesque habitant morbi tristique. Enim diam vulputate ut pharetra sit amet aliquam. Nisi lacus sed viverra tellus in. Placerat in egestas erat imperdiet sed euismod nisi. Nunc eget lorem dolor sed viverra ipsum nunc aliquet bibendum. Nec nam aliquam sem et tortor consequat id porta. Massa eget egestas purus viverra accumsan in. Leo integer malesuada nunc vel risus.";

    title = title === "" ? "Title of the Thread" : title;
    desc = desc === "" ? lorem : desc;

    return (
        <div className="flex justify-center text-black">
            <div className="bg-[#82BEE9] p-4 md:p-10 size-full md:size-5/6">
                <h2 className="font-extrabold">{title}</h2>
                <hr className="border-0 h-px my-5 bg-black" />
                <h6>{desc}</h6>
                <br />
                <div className="flex w-full justify-between">
                    <TagContainer tags={tags}/>
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


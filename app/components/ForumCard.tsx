//Forum Card

import { NumberOfComments } from "@/app/components/forumpost/CommentContainer";
import TagContainer from "@/app/components/forumpost/TagContainer";
import { DislikeButton, LikeButton } from "@/app/components/common/Buttons";

import jsonData from "@/temp/testdata.json";

const tags: any[] = jsonData.tags;

export default function ForumCard({ title, desc }: { title: string, desc: string }) {
    let lorem: string = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Nisl nunc mi ipsum faucibus vitae aliquet nec. Suspendisse potenti nullam ac tortor vitae purus.";

    return (
            <div className="flex pl-11 pr-7 pt-7 justify-center text-black">
            <div className="bg-[#5FC4E7] p-5 md:p-10 size-full md:size-5/6">

                <div className="flex justify-between items-center">

                    <h2 className="font-extrabold text-3xl md-text-xl">Title</h2>
                    <div className="flex items-center space-x-4">
                        <div className="bg-white p-1 hidden md:block">
                            <NumberOfComments />
                        </div>
                        <div className="flex space-x-2 p-0.5 bg-white">
                                <LikeButton />
                                <DislikeButton />
                        </div>
                    </div>
                </div>

                <br></br>
                <p className="text-xs">{lorem}</p>
                <br></br>

                <div className="flex justify-between items-center sm:w-2/3 md:w-full">
                    <div className="sm:w-2/3 md:flex md:w-full md:justify-between">
                        <TagContainer tags={tags} />
                    </div>
                </div>
                <div className="text-xs text-right">
                        <p>John Doe posted at --</p>
                </div>
            </div>
        </div>
    );
}

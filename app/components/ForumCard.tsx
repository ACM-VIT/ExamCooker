
// import { NumberOfComments } from "@/app/components/forumpost/CommentContainer";
// import TagContainer from "@/app/components/forumpost/TagContainer";
// import { DislikeButton, LikeButton } from "@/app/components/common/Buttons";

// import jsonData from "@/temp/testdata.json";
// import { Tag } from "@prisma/client";

// const tags: any[] = jsonData.tags;

// export default function ForumCard({ title, desc, author,  tags, createdAt }: { title: string, desc: string, author : string | null, tags : Tag[], createdAt : Date}) {
    
//     return (
//             <div className="flex pl-11 pr-7 pt-7 justify-center text-black">
//             <div className="bg-[#5FC4E7] p-5 md:p-10 size-full md:size-5/6">

//                 <div className="flex justify-between items-center">

//                     <h2 className="font-extrabold lg:text-3xl md:text-xl text-base">{title}</h2>
//                     <div className="flex items-center space-x-4">
//                         <div className="bg-white p-1 hidden md:block">
//                             <NumberOfComments />
//                         </div>
//                         <div className="flex space-x-2 p-0.5 bg-white">
//                                 <LikeButton />
//                                 <DislikeButton />
//                         </div>
//                     </div>
//                 </div>

//                 <br></br>
//                 <p className="text-xs">{desc}</p>
//                 <br></br>

//                 <div className="flex justify-between items-center sm:w-2/3 md:w-full">
//                     <div className="sm:w-2/3 md:flex md:w-full md:justify-between">
//                         <TagContainer tags={tags} />
//                     </div>
//                 </div>
//                 <div className="text-xs text-right">
//                         <p>{author} posted at {createdAt.toISOString()}</p>
//                 </div>
//             </div>
//         </div>
//     );
// }

import { NumberOfComments } from "@/app/components/forumpost/CommentContainer";
import TagContainer from "@/app/components/forumpost/TagContainer";
import { DislikeButton, LikeButton } from "@/app/components/common/Buttons";

import jsonData from "@/temp/testdata.json";
import { Tag } from "@prisma/client";

const tags: any[] = jsonData.tags;

export default function ForumCard({
    title,
    desc,
    author,
    tags,
    createdAt
}: {
    title: string,
    desc: string,
    author: string | null,
    tags: Tag[],
    createdAt: Date
}) {
    return (
        <div className="flex justify-center text-black p-4 md:p-7">
            <div className="bg-[#5FC4E7] p-4 md:p-7 w-full md:w-5/6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <h2 className="font-extrabold text-base md:text-xl lg:text-3xl">{title}</h2>
                    <div className="flex items-center space-x-4 mt-2 md:mt-0">
                        <div className="bg-white p-1 hidden md:block">
                            <NumberOfComments />
                        </div>
                        <div className="flex space-x-2 p-0.5 bg-white">
                            <LikeButton />
                            <DislikeButton />
                        </div>
                    </div>
                </div>

                <p className="text-xs mt-2 md:mt-4">{desc}</p>

                <div className="flex flex-wrap justify-between items-center mt-2 md:mt-4">
                    <TagContainer tags={tags} />
                </div>

                <div className="text-xs text-right mt-2 md:mt-4">
                    <p>{author} posted at {createdAt.toISOString()}</p>
                </div>
            </div>
        </div>
    );
}

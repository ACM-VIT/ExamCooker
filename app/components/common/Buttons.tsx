//file which contains all ze buttons

// import * as React from "react"
// import { SVGProps } from "react"
// const ThumbsUp = (props: SVGProps<SVGSVGElement>) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     width={21}
//     height={21}
//     fill="none"
//     {...props}
//   >
//     <path
//       stroke="currentColor"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//       strokeWidth={2}
//       d="M1.5 8.214a1 1 0 0 1 1-1h3v12h-3a1 1 0 0 1-1-1v-10ZM5.5 9.214v8l1.992 1.328a4 4 0 0 0 2.22.672h5.247a3 3 0 0 0 2.959-2.507l1.194-7.164a2 2 0 0 0-1.973-2.33H12.5"
//     />
//     <path
//       stroke="currentColor"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//       strokeWidth={2}
//       d="m12.5 7.214.687-3.436A1.807 1.807 0 0 0 9.8 2.615L6.5 9.214h-1"
//     />
//   </svg>
// )
// export default ThumbsUp

"use client";
import { useState } from "react";
import Image from "next/image";
export function LikeButton() {

    const [likes, setLikes] = useState(0);

    function handleClick() {
        setLikes(likes + 1);
    }

    return <>
        <div className="flex gap-1 p-1">
            <button onClick={handleClick} className="hover:bg-gray-300">
                <Image
                    src={"/comment/ThumbsUpIcon.svg"}
                    alt="ThumbsUp"
                    width={21}
                    height={21}
                    className="hidden md:flex"
                />
                <Image
                    src={"/comment/ThumbsUpIcon.svg"}
                    alt="ThumbsUp"
                    width={16}
                    height={16}
                    className="flex md:hidden"
                />
            </button>
            {likes}
        </div>
    </>;
}


export function DislikeButton() {
    const [dislikeCount, setDislikeCount] = useState(0);

    function handleClick() {
        setDislikeCount(dislikeCount + 1);
    }

    return <>
        <div className="flex gap-1 p-1">
            <button onClick={handleClick} className="hover:bg-gray-300">
                <Image
                    src={"/comment/ThumbsDownIcon.svg"}
                    alt="ThumbsDown"
                    width={21}
                    height={21}
                    className="hidden md:flex"
                />
                <Image
                    src={"/comment/ThumbsDownIcon.svg"}
                    alt="ThumbsDown"
                    width={16}
                    height={16}
                    className="flex md:hidden"
                />
            </button>
            {dislikeCount}
        </div>
    </>;
}

export function ReplyButton() {

    function handleClick() {
        alert("RANDOM BULLSHIT GO"); //yes that's a moonknight reference ;)
    }

    return <div className="p-1">
        <button onClick={handleClick} className="hover:bg-gray-300">
            <Image
                src={"/comment/ReplyIcon.svg"}
                alt="Reply"
                width={21}
                height={21}
                className="hidden md:flex"
            />
            <Image
                src={"/comment/ReplyIcon.svg"}
                alt="Reply"
                width={14}
                height={14}
                className="flex md:hidden"
            />
        </button>
    </div>;
}



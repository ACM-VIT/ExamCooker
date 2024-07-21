
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
                    src={"/public/comments/ThumbsUpIcon.svg"}
                    alt="ThumbsUp"
                    width={21}
                    height={21}
                    className="hidden md:flex"
                />
                <Image
                    src={"/public/commentsThumbsUpIcon.svg"}
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
                    src={"/ThumbsDownIcon.svg"}
                    alt="ThumbsDown"
                    width={21}
                    height={21}
                    className="hidden md:flex"
                />
                <Image
                    src={"/ThumbsDownIcon.svg"}
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





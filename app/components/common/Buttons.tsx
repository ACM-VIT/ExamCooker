'use client'

import { useState } from "react"
import Image from "next/image"
import { upvotePost, downvotePost } from '@/app/actions/forumVote'

export function LikeButton({ postId, upvoteCount }: { postId: string, upvoteCount: number }) {
    const [likes, setLikes] = useState(upvoteCount)

    async function handleClick() {
        const result = await upvotePost(postId)
        if (result.success) {
            setLikes(result.upvoteCount || 0)
        } else {
            console.error('Error upvoting post:', result.error)
        }
    }

    return (
        <div className="flex gap-1 p-1">
            <button onClick={handleClick} className="hover:bg-gray-300">
                <Image
                    src={"/comment/ThumbsUpIcon.svg"}
                    alt="ThumbsUp"
                    width={21}
                    height={21}
                    className="hidden md:flex dark:invert-[.835]"
                />
                <Image
                    src={"/comment/ThumbsUpIcon.svg"}
                    alt="ThumbsUp"
                    width={16}
                    height={16}
                    className="flex md:hidden dark:invert-[.835]"
                />
            </button>
            {likes}
        </div>
    )
}

export function DislikeButton({ postId, downvoteCount }: { postId: string, downvoteCount: number }) {
    const [dislikes, setDislikes] = useState(downvoteCount)

    async function handleClick() {
        const result = await downvotePost(postId)
        if (result.success) {
            setDislikes(result.downvoteCount || 0)
        } else {
            console.error('Error downvoting post:', result.error)
        }
    }

    return (
        <div className="flex gap-1 p-1">
            <button onClick={handleClick} className="hover:bg-gray-300">
                <Image
                    src={"/comment/ThumbsDownIcon.svg"}
                    alt="ThumbsDown"
                    width={21}
                    height={21}
                    className="hidden md:flex dark:invert-[.835]"
                />
                <Image
                    src={"/comment/ThumbsDownIcon.svg"}
                    alt="ThumbsDown"
                    width={16}
                    height={16}
                    className="flex md:hidden dark:invert-[.835]"
                />
            </button>
            {dislikes}
        </div>
    )
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



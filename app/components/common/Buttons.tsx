"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { upvotePost, downvotePost } from '@/app/actions/forumVote';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbsDown, faThumbsUp } from "@fortawesome/free-solid-svg-icons";
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";

interface VoteButtonsProps {
    postId: string;
    initialUpvotes: number;
    initialDownvotes: number;
    initialUserVote: 'up' | 'down' | null;
}

export function VoteButtons({ postId, initialUpvotes, initialDownvotes, initialUserVote }: VoteButtonsProps) {
    const [votes, setVotes] = useState({
        upvotes: initialUpvotes,
        downvotes: initialDownvotes,
        userVote: initialUserVote
    });
    const [isLocked, setIsLocked] = useState(false);
    const router = useRouter();
    const { requireAuth } = useGuestPrompt();

    const handleVote = useCallback(async (voteType: 'up' | 'down') => {
        if (!requireAuth("vote on posts")) return;
        if (isLocked) return;
        setIsLocked(true);

        const oldVotes = { ...votes };
        let newVotes = { ...votes };

        if (votes.userVote === voteType) {
            newVotes[voteType === 'up' ? 'upvotes' : 'downvotes'] -= 1;
            newVotes.userVote = null;
        } else {
            if (votes.userVote) {
                newVotes[votes.userVote === 'up' ? 'upvotes' : 'downvotes'] -= 1;
            }
            newVotes[voteType === 'up' ? 'upvotes' : 'downvotes'] += 1;
            newVotes.userVote = voteType;
        }

        setVotes(newVotes);

        try {
            await (voteType === 'up' ? upvotePost : downvotePost)(postId);
        } catch (error) {
            console.error('Error voting:', error);
            setVotes(oldVotes);
        } finally {
            setIsLocked(false);
            router.refresh();
        }
    }, [votes, isLocked, postId, router, requireAuth]);

    return (
        <div className="flex gap-2">
            <VoteButton
                type="up"
                count={votes.upvotes}
                isActive={votes.userVote === 'up'}
                onClick={() => handleVote('up')}
                isLocked={isLocked}
            />
            <VoteButton
                type="down"
                count={votes.downvotes}
                isActive={votes.userVote === 'down'}
                onClick={() => handleVote('down')}
                isLocked={isLocked}
            />
        </div>
    );
}

interface VoteButtonProps {
    type: 'up' | 'down';
    count: number;
    isActive: boolean;
    onClick: () => void;
    isLocked: boolean;
}

function VoteButton({ type, count, isActive, onClick, isLocked }: VoteButtonProps) {
    //const imageSrc = type === 'up' ? "/comment/ThumbsUpIcon.svg" : "/comment/ThumbsDownIcon.svg";
    const upVote = type === 'up';
    const downVote = type === 'down'
    const altText = type === 'up' ? "Thumb Up" : "Thumb Down";
    // const activeClass = isActive ? (type === 'up' ? 'bg-blue-200 dark:bg-blue-800' : 'bg-red-200 dark:bg-red-800') : '';

    return (
        <div className="flex gap-1 p-1">
            <button
                onClick={onClick}
                className={`relative flex items-center justify-center transition-colors duration-150 ease-in-out hover:bg-gray-200 dark:hover:bg-white/20 `} //${activeClass}
                title={type === 'up' ? "Like" : "Dislike"}
                disabled={isLocked}
            >
            {/* {imageSrc === "/comment/ThumbsUpIcon.svg" && <FontAwesomeIcon icon={ faThumbsUp}/>} */}
            {upVote && <FontAwesomeIcon icon={faThumbsUp} color={ isActive ? "green" : "black"}/>}
            {downVote && <FontAwesomeIcon icon={faThumbsDown} color={ isActive ? "red" : "black"}/>}
                {/* <Image
                    src={imageSrc}
                    alt={altText}
                    width={21}
                    height={21}
                    className={`w-6 h-6 ${isActive ? (type === 'up' ? 'text-blue-500' : 'text-red-500') : 'text-gray-500'}`}
                /> */}
            </button>
            {count}
        </div>
    );
}

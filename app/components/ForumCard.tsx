"use client";

import React from 'react';
import { NumberOfComments, TimeHandler } from "@/app/components/forumpost/CommentContainer";
import TagContainer from "@/app/components/forumpost/TagContainer";
import { VoteButtons } from "@/app/components/common/Buttons";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { useBookmarks } from './BookmarksProvider';
import { useRouter } from 'next/navigation';
import { ForumPost, Tag, User, Vote } from "@/src/generated/prisma";
import {useToast} from "@/components/ui/use-toast";


interface ForumCardProps {
    post: ForumPost & {
        author: User;
        tags: Tag[];
        votes: Vote[];
    } | any;
    title: string;
    desc: string;
    author: string | null;
    tags: Tag[];
    createdAt: Date;
    commentCount: number;
}

function formatTimeDifference(hours: string, minutes: string, seconds: string, amOrPm: string, day: string, month: string, year: number): string {

    let inputHours = parseInt(hours);
    const inputMinutes = parseInt(minutes);
    const inputSeconds = parseInt(seconds);
    const inputDay = parseInt(day);
    const inputMonth = parseInt(month) - 1;
    const inputYear = year;

    if (amOrPm.toLowerCase() === 'pm' && inputHours < 12) {
      inputHours += 12;
    } else if (amOrPm.toLowerCase() === 'am' && inputHours === 12) {
      inputHours = 0;
    }

    const inputDate = new Date(inputYear, inputMonth, inputDay, inputHours, inputMinutes, inputSeconds);

    const currentDate = new Date();

    const diffMillis = currentDate.getTime() - inputDate.getTime();

    const diffMinutes = Math.floor(diffMillis / (1000 * 60));
    const diffHours = Math.floor(diffMillis / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMillis / (1000 * 60 * 60 * 24));

    if (diffMillis < 0) {
      return "Input time is in the future";
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }
  }

export default function ForumCard({ post, title, desc, author, tags, createdAt, commentCount }: ForumCardProps) {
    const dateTimeObj = TimeHandler(createdAt.toISOString());
    const router = useRouter();

    const {toast} = useToast();
    const { isBookmarked, toggleBookmark } = useBookmarks();

    const isFav = isBookmarked(post.id, 'forumpost');

    const handleToggleFav = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        toggleBookmark({ id: post.id, type: 'forumpost', title: post.title }, !isFav).catch(()=> toast({title: "Error! Could not add to favorites", variant: "destructive"}));
    };

    const userVote = post.votes && post.votes.length > 0 ? post.votes[0].type : null;

    const handleVoteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    };

    return (
        <div className="w-full flex pl-11 pr-7 pt-7 justify-center text-black dark:text-[#D5D5D5]">
            <div
                className="bg-[#5FC4E7] dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222] border-2 border-[#5FC4E7] dark:border-[#ffffff]/20 dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:hover:bg-[#ffffff]/10 hover:border-b-2 dark:hover:border-b-[#3BF4C7] hover:border-b-white p-5 md:p-10 size-full md:size-5/6 transition duration-200 transform hover:scale-105 hover:shadow-xl cursor-pointer"
                onClick={() => router.push(`/forum/${post.id}`)}
            >
                <div className="flex justify-between items-center">
                    <h2 className="font-extrabold lg:text-3xl md:text-xl text-base">{title}</h2>
                    <div className="flex items-center space-x-4">
                        <div className="bg-white dark:bg-[#3F4451] p-1 hidden md:block">
                            <NumberOfComments count={commentCount} />
                        </div>
                        <div className="flex space-x-2 p-0.5 bg-white dark:bg-[#3F4451]" onClick={handleVoteClick}>
                            <VoteButtons
                                postId={post.id}
                                initialUpvotes={post.upvoteCount ?? 0}
                                initialDownvotes={post.downvoteCount ?? 0}
                                initialUserVote={userVote === 'UPVOTE' ? 'up' : userVote === 'DOWNVOTE' ? 'down' : null}
                            />
                        </div>
                    </div>
                </div>

                <br />
                <p className="text-xs">{desc}</p>
                <br />

                <div className="flex justify-between items-center sm:w-2/3 md:w-full">
                    <div className="sm:w-2/3 md:flex md:w-full md:justify-between">
                        <TagContainer tags={tags} />
                    </div>
                    <button onClick={handleToggleFav} className="transition-colors duration-200">
                        <FontAwesomeIcon icon={faHeart} color={isFav ? 'red' : 'lightgrey'} />
                    </button>
                </div>

                <div className="text-xs text-right">
                    <p>{author?.slice(0, -10)} asked {formatTimeDifference(dateTimeObj.hours, dateTimeObj.minutes, dateTimeObj.seconds, dateTimeObj.amOrPm, dateTimeObj.day, dateTimeObj.month, dateTimeObj.year)} ago</p>
                </div>
            </div>
        </div>
    );
}

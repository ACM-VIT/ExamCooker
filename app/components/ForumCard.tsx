"use client";
import React from 'react';
import { NumberOfComments, TimeHandler } from "@/app/components/forumpost/CommentContainer";
import TagContainer from "@/app/components/forumpost/TagContainer";
import { DislikeButton, LikeButton } from "@/app/components/common/Buttons";
import { ForumPost, Tag, Comment } from "@prisma/client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import Link from "next/link";
import { useBookmarks } from './BookmarksProvider';

interface ForumCardProps {
    post: ForumPost;
    title: string;
    desc: string;
    author: string | null;
    tags: Tag[];
    createdAt: Date;
    comments: Comment[] | undefined;
}

export default function ForumCard({ post, title, desc, author, tags, createdAt, comments }: ForumCardProps) {
    const dateTimeObj = TimeHandler(createdAt.toISOString());

    const { isBookmarked, toggleBookmark } = useBookmarks();

    const isFav = isBookmarked(post.id, 'forumpost');

    const handleToggleFav = () => {
        toggleBookmark({ id: post.id, type: 'forumpost', title: post.title }, !isFav);
    };


    return (
        <div className="w-full flex pl-11 pr-7 pt-7 justify-center text-black dark:text-[#D5D5D5] ">
            <div className="bg-[#5FC4E7] dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222]  border-2 border-[#5FC4E7] dark:border-[#ffffff]/20 dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:hover:bg-[#ffffff]/10 hover:border-b-2 dark:hover:border-b-[#3BF4C7] hover:border-b-white p-5 md:p-10 size-full md:size-5/6 transition duration-200 transform hover:scale-105 hover:shadow-xl">
                <div className="flex justify-between items-center">
                    <Link href={`/forum/${post.id}`}>
                        <h2 className="font-extrabold lg:text-3xl md:text-xl text-base">{title}</h2>
                    </Link>
                    <div className="flex items-center space-x-4">
                        <div className="bg-white dark:bg-[#3F4451] p-1 hidden md:block">
                            <NumberOfComments commentArray={comments} />
                        </div>
                        <div className="flex space-x-2 p-0.5 bg-white dark:bg-[#3F4451]">
                            <LikeButton postId={post.id} upvoteCount={post.upvoteCount} />
                            <DislikeButton postId={post.id} downvoteCount={post.downvoteCount} />
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
                    <p>{author} posted at {dateTimeObj.hours}:{dateTimeObj.minutes} {dateTimeObj.amOrPm}, {dateTimeObj.day}/{dateTimeObj.month}/{dateTimeObj.year}</p>
                </div>
            </div>
        </div>
    );
}
